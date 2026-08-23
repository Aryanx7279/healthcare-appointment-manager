import { AppointmentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { calendarService } from './calendar.service';
import { notificationService } from './notification.service';

/** Flush all pending email jobs immediately (used after booking/cancel/reschedule) */
async function flushPendingEmails(): Promise<void> {
  try {
    const pending = await emailService.getPendingEmailJobs();
    for (const job of pending) {
      emailService.processEmailJob(job.id).catch(() => {}); // fire-and-forget per job
    }
  } catch (err) {
    logger.error('flushPendingEmails error:', err);
  }
}

interface BookAppointmentInput {
  doctorId: string;
  patientUserId: string;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
  holdId?: string;
  notes?: string;
}

export class AppointmentService {
  /**
   * CRITICAL: Books an appointment with full double-booking protection.
   *
   * Protection layers:
   * 1. Slot hold validation (held by this patient)
   * 2. Serializable transaction with row-level locking
   * 3. DB unique constraint on (doctorId, appointmentDate, startTime)
   *
   * Even if two requests bypass #1 and #2, the unique constraint at #3
   * guarantees only one booking succeeds. The other gets P2002 -> 409.
   */
  async bookAppointment(input: BookAppointmentInput) {
    const {
      doctorId,
      patientUserId,
      date,
      startTime,
      endTime,
      holdId,
      notes,
    } = input;

    // Get patient profile
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: patientUserId },
      include: { user: true },
    });

    if (!patientProfile) {
      throw new AppError('Patient profile not found', 404, 'NOT_FOUND');
    }

    // Get doctor profile
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctorProfile || !doctorProfile.isActive) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    // Validate hold if provided
    if (holdId) {
      const hold = await prisma.slotHold.findFirst({
        where: {
          id: holdId,
          patientId: patientProfile.id,
          doctorId,
          appointmentDate: new Date(date),
          startTime,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });

      if (!hold) {
        throw new AppError(
          'Your slot reservation has expired. Please select the slot again.',
          409,
          'HOLD_EXPIRED'
        );
      }
    }

    // Check doctor leave
    const leave = await prisma.doctorLeave.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    if (leave) {
      throw new AppError(
        'The doctor is on leave on this date. Please choose a different date.',
        409,
        'DOCTOR_ON_LEAVE'
      );
    }

    try {
      // Use a serializable transaction to prevent race conditions
      const appointment = await prisma.$transaction(
        async (tx) => {
          // Lock check: look for any existing CONFIRMED/PENDING appointment at this slot
          // Using raw query for explicit row locking
          const existing = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Appointment"
            WHERE "doctorId" = ${doctorId}
              AND "appointmentDate" = ${new Date(date)}::date
              AND "startTime" = ${startTime}
              AND status NOT IN ('CANCELLED', 'EXPIRED')
            FOR UPDATE NOWAIT
          `;

          if (existing.length > 0) {
            throw new AppError(
              'Sorry, this slot was just booked by another patient. Please select a different time.',
              409,
              'SLOT_ALREADY_BOOKED'
            );
          }

          // Create the appointment
          const newAppointment = await tx.appointment.create({
            data: {
              doctorId,
              patientId: patientProfile.id,
              appointmentDate: new Date(date),
              startTime,
              endTime,
              status: AppointmentStatus.CONFIRMED,
              notes,
            },
            include: {
              doctor: {
                include: {
                  user: true,
                  specialization: true,
                },
              },
              patient: {
                include: { user: true },
              },
            },
          });

          // Convert slot hold to CONVERTED status
          if (holdId) {
            await tx.slotHold.update({
              where: { id: holdId },
              data: { status: 'CONVERTED' },
            });
          }

          return newAppointment;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }
      );

      logger.info(
        `Appointment booked: id=${appointment.id} doctor=${doctorId} patient=${patientUserId} date=${date} time=${startTime}`
      );

      // Queue email notifications then flush immediately so emails are sent within seconds
      emailService
        .queueBookingConfirmation(appointment)
        .then(() => flushPendingEmails())
        .catch((err) =>
          logger.error('Failed to queue booking confirmation email:', err)
        );

      // Queue calendar event creation (non-blocking)
      calendarService
        .createAppointmentEvent(appointment)
        .catch((err) =>
          logger.error('Failed to create calendar event:', err)
        );

      // Create in-app notifications
      notificationService
        .createAppointmentNotification(appointment, 'BOOKING_CONFIRMATION')
        .catch((err) => logger.error('Failed to create notification:', err));

      return appointment;
    } catch (error) {
      // Unique constraint violation = double booking
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        logger.warn(`Double booking attempt blocked: doctor=${doctorId} date=${date} time=${startTime}`);
        throw new AppError(
          'Sorry, this slot was just booked by another patient. Please select a different time.',
          409,
          'SLOT_ALREADY_BOOKED'
        );
      }
      throw error;
    }
  }

  async getPatientAppointments(patientUserId: string, status?: AppointmentStatus) {
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: patientUserId },
    });

    if (!patientProfile) {
      throw new AppError('Patient profile not found', 404, 'NOT_FOUND');
    }

    return prisma.appointment.findMany({
      where: {
        patientId: patientProfile.id,
        ...(status ? { status } : {}),
      },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            specialization: true,
          },
        },
        symptomSubmission: true,
        preVisitSummary: true,
        consultation: {
          include: {
            prescription: { include: { medications: true } },
            postVisitSummary: true,
          },
        },
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
    });
  }

  async getDoctorAppointments(doctorUserId: string, date?: string) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
    });

    if (!doctorProfile) {
      throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');
    }

    return prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        ...(date ? { appointmentDate: new Date(date) } : {}),
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        symptomSubmission: true,
        preVisitSummary: true,
        consultation: {
          include: {
            prescription: { include: { medications: true } },
            postVisitSummary: true,
          },
        },
      },
      orderBy: [{ appointmentDate: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getAppointmentById(appointmentId: string, userId: string, role: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            specialization: true,
          },
        },
        patient: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        symptomSubmission: true,
        preVisitSummary: true,
        consultation: {
          include: {
            prescription: { include: { medications: true } },
            postVisitSummary: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    // Authorization: only the doctor, patient, or admin can view
    if (role !== 'ADMIN') {
      const isPatient = appointment.patient.user.id === userId;
      const isDoctor = appointment.doctor.user.id === userId;
      if (!isPatient && !isDoctor) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
    }

    return appointment;
  }

  async cancelAppointment(
    appointmentId: string,
    cancelledById: string,
    reason: string,
    role: string
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED
    ) {
      throw new AppError(
        'This appointment cannot be cancelled in its current state',
        400,
        'INVALID_STATUS'
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledById,
        cancelReason: reason,
      },
      include: {
        doctor: { include: { user: true, specialization: true } },
        patient: { include: { user: true } },
      },
    });

    logger.info(`Appointment cancelled: id=${appointmentId} by=${cancelledById} reason=${reason}`);

    // Queue cancellation emails then flush immediately
    emailService
      .queueCancellationEmail(updated)
      .then(() => flushPendingEmails())
      .catch((err) => logger.error('Failed to queue cancellation email:', err));

    // Handle calendar event deletion (non-blocking)
    calendarService
      .deleteAppointmentEvent(appointmentId)
      .catch((err) => logger.error('Failed to delete calendar event:', err));

    // In-app notification
    notificationService
      .createAppointmentNotification(updated, 'APPOINTMENT_CANCELLED')
      .catch((err) => logger.error('Failed to create cancellation notification:', err));

    return updated;
  }

  async rescheduleAppointment(
    appointmentId: string,
    userId: string,
    newDate: string,
    newStartTime: string,
    newEndTime: string
  ) {
    const original = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: { include: { user: true } },
        patient: { include: { user: true } },
      },
    });

    if (!original) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    if (
      original.status === AppointmentStatus.CANCELLED ||
      original.status === AppointmentStatus.COMPLETED
    ) {
      throw new AppError('Cannot reschedule this appointment', 400, 'INVALID_STATUS');
    }

    try {
      const [cancelled, newAppointment] = await prisma.$transaction(
        async (tx) => {
          // Cancel the old one
          const cancelledOld = await tx.appointment.update({
            where: { id: appointmentId },
            data: {
              status: AppointmentStatus.RESCHEDULED,
              cancelReason: 'Rescheduled by patient',
            },
          });

          // Check new slot
          const existing = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Appointment"
            WHERE "doctorId" = ${original.doctorId}
              AND "appointmentDate" = ${new Date(newDate)}::date
              AND "startTime" = ${newStartTime}
              AND status NOT IN ('CANCELLED', 'EXPIRED', 'RESCHEDULED')
            FOR UPDATE NOWAIT
          `;

          if (existing.length > 0) {
            throw new AppError(
              'The selected new time slot is not available.',
              409,
              'SLOT_UNAVAILABLE'
            );
          }

          const created = await tx.appointment.create({
            data: {
              doctorId: original.doctorId,
              patientId: original.patientId,
              appointmentDate: new Date(newDate),
              startTime: newStartTime,
              endTime: newEndTime,
              status: AppointmentStatus.CONFIRMED,
              rescheduledFrom: appointmentId,
            },
            include: {
              doctor: { include: { user: true, specialization: true } },
              patient: { include: { user: true } },
            },
          });

          return [cancelledOld, created];
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        }
      );

      logger.info(`Appointment rescheduled: old=${appointmentId} new=${newAppointment.id}`);

      emailService
        .queueRescheduleEmail(newAppointment)
        .then(() => flushPendingEmails())
        .catch((err) => logger.error('Failed to queue reschedule email:', err));

      calendarService
        .updateAppointmentEvent(appointmentId, newAppointment)
        .catch((err) => logger.error('Failed to update calendar event:', err));

      return newAppointment;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'The selected new time slot is already booked.',
          409,
          'SLOT_ALREADY_BOOKED'
        );
      }
      throw error;
    }
  }

  async getAllAppointments(filters: {
    status?: AppointmentStatus;
    doctorId?: string;
    patientId?: string;
    date?: string;
  }) {
    return prisma.appointment.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.date ? { appointmentDate: new Date(filters.date) } : {}),
      },
      include: {
        doctor: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            specialization: true,
          },
        },
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
    });
  }
}

export const appointmentService = new AppointmentService();
