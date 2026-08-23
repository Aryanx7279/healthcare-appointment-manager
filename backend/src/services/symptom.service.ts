import { LLMSummaryStatus, UrgencyLevel } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { llmService } from './llm.service';

export class SymptomService {
  async submitSymptoms(
    appointmentId: string,
    userId: string,
    data: {
      chiefComplaint: string;
      symptoms: string;
      duration?: string;
      severity?: number;
      additionalNotes?: string;
    }
  ) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
      },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    // Authorization: only the patient can submit symptoms
    if (appointment.patient.user.id !== userId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Upsert symptoms
    const symptomSubmission = await prisma.symptomSubmission.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        duration: data.duration,
        severity: data.severity,
        additionalNotes: data.additionalNotes,
      },
      update: {
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        duration: data.duration,
        severity: data.severity,
        additionalNotes: data.additionalNotes,
      },
    });

    // Trigger LLM pre-visit summary generation
    this.generatePreVisitSummary(appointmentId, data).catch((err) =>
      logger.error(`Background LLM generation failed for appointment ${appointmentId}:`, err)
    );

    return symptomSubmission;
  }

  async generatePreVisitSummary(
    appointmentId: string,
    symptoms: {
      chiefComplaint: string;
      symptoms: string;
      duration?: string;
      severity?: number;
      additionalNotes?: string;
    }
  ) {
    // Create pending record
    await prisma.preVisitSummary.upsert({
      where: { appointmentId },
      create: {
        appointmentId,
        status: LLMSummaryStatus.PENDING,
      },
      update: {
        status: LLMSummaryStatus.PENDING,
        errorMessage: null,
      },
    });

    const result = await llmService.generatePreVisitSummary({
      chiefComplaint: symptoms.chiefComplaint,
      symptoms: symptoms.symptoms,
      duration: symptoms.duration,
      severity: symptoms.severity,
      additionalNotes: symptoms.additionalNotes,
    });

    if (result.success) {
      return prisma.preVisitSummary.update({
        where: { appointmentId },
        data: {
          urgencyLevel: result.data.urgencyLevel,
          chiefComplaint: result.data.chiefComplaint,
          suggestedQuestions: result.data.suggestedQuestions,
          status: LLMSummaryStatus.COMPLETED,
          generatedAt: new Date(),
        },
      });
    } else {
      await prisma.preVisitSummary.update({
        where: { appointmentId },
        data: {
          status: LLMSummaryStatus.FAILED,
          errorMessage: result.error,
        },
      });
      logger.warn(`Pre-visit LLM failed for appointment ${appointmentId}: ${result.error}`);
      return null;
    }
  }

  async getPreVisitSummary(appointmentId: string, userId: string, role: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
        preVisitSummary: true,
        symptomSubmission: true,
      },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    // Authorization: patient or doctor or admin
    if (role !== 'ADMIN') {
      const isPatient = appointment.patient.user.id === userId;
      const isDoctor = appointment.doctor.user.id === userId;
      if (!isPatient && !isDoctor) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
    }

    return {
      symptoms: appointment.symptomSubmission,
      preVisitSummary: appointment.preVisitSummary,
    };
  }
}

export const symptomService = new SymptomService();
