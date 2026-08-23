import { LLMSummaryStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { llmService } from './llm.service';
import { notificationService } from './notification.service';

export class ConsultationService {
  async createOrUpdateConsultation(
    appointmentId: string,
    doctorUserId: string,
    data: {
      clinicalNotes: string;
      diagnosis?: string;
      followUpInstructions?: string;
      medications?: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions?: string;
      }>;
    }
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

    // Authorization: only the assigned doctor
    if (appointment.doctor.user.id !== doctorUserId) {
      throw new AppError('Only the assigned doctor can submit consultation notes', 403, 'FORBIDDEN');
    }

    const consultation = await prisma.$transaction(async (tx) => {
      // Upsert consultation
      const cons = await tx.consultation.upsert({
        where: { appointmentId },
        create: {
          appointmentId,
          clinicalNotes: data.clinicalNotes,
          diagnosis: data.diagnosis,
          followUpInstructions: data.followUpInstructions,
        },
        update: {
          clinicalNotes: data.clinicalNotes,
          diagnosis: data.diagnosis,
          followUpInstructions: data.followUpInstructions,
        },
      });

      // Handle prescription and medications
      if (data.medications && data.medications.length > 0) {
        // Upsert prescription
        const prescription = await tx.prescription.upsert({
          where: { consultationId: cons.id },
          create: { consultationId: cons.id },
          update: {},
        });

        // Delete existing medications and re-create
        await tx.medication.deleteMany({
          where: { prescriptionId: prescription.id },
        });

        for (const med of data.medications) {
          await tx.medication.create({
            data: {
              prescriptionId: prescription.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              duration: med.duration,
              instructions: med.instructions,
            },
          });
        }
      }

      // Mark appointment as completed
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });

      return cons;
    });

    logger.info(`Consultation completed for appointment ${appointmentId}`);

    // Schedule medication reminders (non-blocking)
    this.scheduleMedicationReminders(consultation.id, appointment.patientId).catch(
      (err) => logger.error('Failed to schedule medication reminders:', err)
    );

    // Notify patient (non-blocking)
    notificationService
      .createNotification(
        appointment.patient.user.id,
        'POST_VISIT_SUMMARY',
        'Consultation Complete',
        'Your doctor has completed the consultation. Your post-visit summary is being prepared.',
        { appointmentId }
      )
      .catch((err) => logger.error('Failed to create post-visit notification:', err));

    return consultation;
  }

  async generatePostVisitSummary(consultationId: string, doctorUserId: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        appointment: {
          include: {
            doctor: { include: { user: true } },
          },
        },
        prescription: { include: { medications: true } },
      },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404, 'NOT_FOUND');
    }

    // Authorization check
    if (consultation.appointment.doctor.user.id !== doctorUserId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Create pending record
    await prisma.postVisitSummary.upsert({
      where: { consultationId },
      create: { consultationId, status: LLMSummaryStatus.PENDING },
      update: { status: LLMSummaryStatus.PENDING, errorMessage: null },
    });

    const prescriptionDetails =
      consultation.prescription?.medications
        .map(
          (m) => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`
        )
        .join(', ') || 'No medications prescribed';

    const result = await llmService.generatePostVisitSummary({
      clinicalNotes: consultation.clinicalNotes,
      diagnosis: consultation.diagnosis,
      followUpInstructions: consultation.followUpInstructions,
      prescriptionDetails,
    });

    if (result.success) {
      const summary = await prisma.postVisitSummary.update({
        where: { consultationId },
        data: {
          summary: result.data.summary,
          medications: result.data.medications as any,
          followUpSteps: result.data.followUpSteps as any,
          status: LLMSummaryStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });

      logger.info(`Post-visit summary generated for consultation ${consultationId}`);
      return summary;
    } else {
      await prisma.postVisitSummary.update({
        where: { consultationId },
        data: {
          status: LLMSummaryStatus.FAILED,
          errorMessage: result.error,
        },
      });

      // IMPORTANT: consultation is still complete even if LLM fails
      logger.warn(`Post-visit LLM failed for consultation ${consultationId}: ${result.error}`);
      return {
        consultationId,
        status: 'FAILED',
        message: 'AI summary is temporarily unavailable. Your doctor\'s original notes are still available.',
        error: result.error,
      };
    }
  }

  async getConsultation(consultationId: string, userId: string, role: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        appointment: {
          include: {
            doctor: { include: { user: true, specialization: true } },
            patient: { include: { user: true } },
          },
        },
        prescription: { include: { medications: true } },
        postVisitSummary: true,
      },
    });

    if (!consultation) {
      throw new AppError('Consultation not found', 404, 'NOT_FOUND');
    }

    // Authorization
    if (role !== 'ADMIN') {
      const isPatient = consultation.appointment.patient.user.id === userId;
      const isDoctor = consultation.appointment.doctor.user.id === userId;
      if (!isPatient && !isDoctor) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
    }

    return consultation;
  }

  private async scheduleMedicationReminders(
    consultationId: string,
    patientProfileId: string
  ): Promise<void> {
    const prescription = await prisma.prescription.findUnique({
      where: { consultationId },
      include: { medications: true },
    });

    if (!prescription) return;

    for (const medication of prescription.medications) {
      const reminderTimes = this.calculateReminderTimes(medication.frequency);

      for (const time of reminderTimes) {
        // Check idempotency - don't create duplicate reminders
        const existing = await prisma.medicationReminder.findFirst({
          where: {
            medicationId: medication.id,
            patientId: patientProfileId,
            scheduledAt: time,
          },
        });

        if (!existing) {
          await prisma.medicationReminder.create({
            data: {
              medicationId: medication.id,
              patientId: patientProfileId,
              scheduledAt: time,
              status: 'SCHEDULED',
            },
          });
        }
      }
    }

    logger.info(
      `Medication reminders scheduled for consultation ${consultationId}`
    );
  }

  private calculateReminderTimes(frequency: string): Date[] {
    const times: Date[] = [];
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const freq = frequency.toLowerCase();

    if (freq.includes('once') || freq.includes('daily')) {
      // Once at 9 AM tomorrow
      const t = new Date(tomorrow);
      t.setHours(9, 0, 0, 0);
      times.push(t);
    } else if (freq.includes('twice') || freq.includes('two')) {
      // 9 AM and 9 PM
      const t1 = new Date(tomorrow);
      t1.setHours(9, 0, 0, 0);
      const t2 = new Date(tomorrow);
      t2.setHours(21, 0, 0, 0);
      times.push(t1, t2);
    } else if (freq.includes('three') || freq.includes('thrice')) {
      // 9 AM, 2 PM, 9 PM
      const t1 = new Date(tomorrow);
      t1.setHours(9, 0, 0, 0);
      const t2 = new Date(tomorrow);
      t2.setHours(14, 0, 0, 0);
      const t3 = new Date(tomorrow);
      t3.setHours(21, 0, 0, 0);
      times.push(t1, t2, t3);
    } else {
      // Default: once at 9 AM
      const t = new Date(tomorrow);
      t.setHours(9, 0, 0, 0);
      times.push(t);
    }

    return times;
  }
}

export const consultationService = new ConsultationService();
