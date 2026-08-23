import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
import { calendarService } from './calendar.service';

export class LeaveService {
  /**
   * Add doctor leave for a specific date.
   * Finds all existing appointments on that date and:
   * 1. Marks them as RESCHEDULE_REQUIRED
   * 2. Notifies affected patients via email
   * 3. Creates in-app notifications
   * 4. Handles calendar events
   */
  async addLeave(
    doctorId: string,
    date: string,
    reason?: string
  ) {
    // Verify doctor exists
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const leaveDate = new Date(date);

    // Find all affected appointments
    const affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: leaveDate,
        status: {
          in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
        },
      },
      include: {
        patient: {
          include: { user: true },
        },
        doctor: {
          include: {
            user: true,
            specialization: true,
          },
        },
      },
    });

    const doctorName = `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`;

    // Use transaction to atomically create leave and update appointments
    const leave = await prisma.$transaction(async (tx) => {
      // Create the leave record
      const leaveRecord = await tx.doctorLeave.upsert({
        where: { doctorId_date: { doctorId, date: leaveDate } },
        create: { doctorId, date: leaveDate, reason },
        update: { reason },
      });

      // Update all affected appointments
      if (affectedAppointments.length > 0) {
        await tx.appointment.updateMany({
          where: {
            id: { in: affectedAppointments.map((a) => a.id) },
          },
          data: {
            status: AppointmentStatus.RESCHEDULE_REQUIRED,
            cancelReason: `Doctor on leave: ${reason || 'Schedule change'}`,
          },
        });
      }

      return leaveRecord;
    });

    logger.info(
      `Leave added for doctor ${doctorId} on ${date}. ${affectedAppointments.length} appointments affected.`
    );

    // Notify all affected patients (non-blocking)
    for (const appointment of affectedAppointments) {
      const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;

      // Queue email notification
      emailService
        .queueLeaveConflictEmail(
          appointment.patient.user.email,
          patientName,
          doctorName,
          leaveDate,
          appointment.id
        )
        .catch((err) =>
          logger.error(`Failed to queue leave conflict email for appointment ${appointment.id}:`, err)
        );

      // In-app notification
      notificationService
        .createAppointmentNotification(
          {
            ...appointment,
            doctor: {
              ...appointment.doctor,
              specialization: appointment.doctor.specialization,
            },
          },
          'DOCTOR_LEAVE_CONFLICT'
        )
        .catch((err) =>
          logger.error(`Failed to create leave conflict notification for appointment ${appointment.id}:`, err)
        );

      // Handle calendar events
      calendarService
        .deleteAppointmentEvent(appointment.id)
        .catch((err) =>
          logger.error(`Failed to delete calendar event for appointment ${appointment.id}:`, err)
        );
    }

    return {
      leave,
      affectedAppointmentsCount: affectedAppointments.length,
      affectedAppointments: affectedAppointments.map((a) => ({
        id: a.id,
        patientName: `${a.patient.user.firstName} ${a.patient.user.lastName}`,
        startTime: a.startTime,
      })),
    };
  }

  async removeLeave(doctorId: string, date: string) {
    const leaveDate = new Date(date);
    const existing = await prisma.doctorLeave.findUnique({
      where: { doctorId_date: { doctorId, date: leaveDate } },
    });

    if (!existing) {
      throw new AppError('Leave record not found', 404, 'NOT_FOUND');
    }

    await prisma.doctorLeave.delete({
      where: { doctorId_date: { doctorId, date: leaveDate } },
    });

    logger.info(`Leave removed for doctor ${doctorId} on ${date}`);
    return { message: 'Leave removed successfully' };
  }

  async getDoctorLeaves(doctorId: string, fromDate?: string, toDate?: string) {
    return prisma.doctorLeave.findMany({
      where: {
        doctorId,
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate ? { gte: new Date(fromDate) } : {}),
                ...(toDate ? { lte: new Date(toDate) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
    });
  }

  async getWorkingHours(doctorId: string) {
    return prisma.doctorWorkingHour.findMany({
      where: { doctorId, isActive: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async upsertWorkingHour(
    doctorId: string,
    dayOfWeek: string,
    startTime: string,
    endTime: string,
    breakStart?: string,
    breakEnd?: string
  ) {
    return prisma.doctorWorkingHour.upsert({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: dayOfWeek as any } },
      create: {
        doctorId,
        dayOfWeek: dayOfWeek as any,
        startTime,
        endTime,
        breakStart,
        breakEnd,
      },
      update: { startTime, endTime, breakStart, breakEnd, isActive: true },
    });
  }

  async deleteWorkingHour(doctorId: string, dayOfWeek: string) {
    await prisma.doctorWorkingHour.updateMany({
      where: { doctorId, dayOfWeek: dayOfWeek as any },
      data: { isActive: false },
    });
  }
}

export const leaveService = new LeaveService();
