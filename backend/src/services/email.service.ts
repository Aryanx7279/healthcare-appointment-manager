import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { EmailJobStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

interface AppointmentEmailData {
  id: string;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  doctor: {
    user: { firstName: string; lastName: string; email: string };
    specialization: { name: string };
  };
  patient: {
    user: { firstName: string; lastName: string; email: string };
  };
  cancelReason?: string | null;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isMockMode: boolean;

  constructor() {
    this.isMockMode = !config.email.user || !config.email.password;

    if (!this.isMockMode) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });
    } else {
      logger.warn('Email running in MOCK mode - emails will be logged but not sent');
    }
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (this.isMockMode) {
      logger.info(`[MOCK EMAIL] To: ${options.to} | Subject: ${options.subject}`);
      return;
    }

    await this.transporter!.sendMail({
      from: config.email.from,
      ...options,
    });
  }

  // ─── Email Templates ───────────────────────────────────────────────────────

  private getEmailWrapper(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 32px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .card { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 16px 0; border-left: 4px solid #0ea5e9; }
    .card h3 { margin: 0 0 12px; color: #1e293b; font-size: 16px; }
    .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #1e293b; font-weight: 600; }
    .btn { display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-red { background: #fee2e2; color: #991b1b; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Healthcare Manager</h1>
      <p>${title}</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated message from Healthcare Appointment Manager.</p>
      <p>Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // ─── Queue Helpers ─────────────────────────────────────────────────────────

  async queueBookingConfirmation(appointment: AppointmentEmailData): Promise<void> {
    const key = `booking-confirm-${appointment.id}`;
    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
    const dateStr = this.formatDate(appointment.appointmentDate);

    await this.upsertEmailJob({
      to: appointment.patient.user.email,
      subject: `Appointment Confirmed with ${doctorName}`,
      templateName: 'booking-confirmation',
      templateData: {
        patientName,
        doctorName,
        specialization: appointment.doctor.specialization.name,
        date: dateStr,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        appointmentId: appointment.id,
      },
      notificationKey: key + '-patient',
    });

    // Also notify doctor
    await this.upsertEmailJob({
      to: appointment.doctor.user.email,
      subject: `New Appointment: ${patientName} on ${dateStr}`,
      templateName: 'booking-notification-doctor',
      templateData: {
        patientName,
        doctorName,
        specialization: appointment.doctor.specialization.name,
        date: dateStr,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        appointmentId: appointment.id,
      },
      notificationKey: key + '-doctor',
    });
  }

  async queueCancellationEmail(appointment: AppointmentEmailData): Promise<void> {
    const key = `cancel-${appointment.id}`;
    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
    const dateStr = this.formatDate(appointment.appointmentDate);

    await this.upsertEmailJob({
      to: appointment.patient.user.email,
      subject: `Appointment Cancelled - ${dateStr}`,
      templateName: 'appointment-cancelled',
      templateData: {
        patientName,
        doctorName,
        date: dateStr,
        startTime: appointment.startTime,
        cancelReason: appointment.cancelReason || 'No reason provided',
        appointmentId: appointment.id,
      },
      notificationKey: key + '-patient',
    });
  }

  async queueRescheduleEmail(appointment: AppointmentEmailData): Promise<void> {
    const key = `reschedule-${appointment.id}`;
    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
    const dateStr = this.formatDate(appointment.appointmentDate);

    await this.upsertEmailJob({
      to: appointment.patient.user.email,
      subject: `Appointment Rescheduled - New time: ${dateStr}`,
      templateName: 'appointment-rescheduled',
      templateData: {
        patientName,
        doctorName,
        date: dateStr,
        startTime: appointment.startTime,
        appointmentId: appointment.id,
      },
      notificationKey: key + '-patient',
    });
  }

  async queueLeaveConflictEmail(
    patientEmail: string,
    patientName: string,
    doctorName: string,
    date: Date,
    appointmentId: string
  ): Promise<void> {
    const dateStr = this.formatDate(date);
    await this.upsertEmailJob({
      to: patientEmail,
      subject: `Important: Your appointment on ${dateStr} has been affected`,
      templateName: 'doctor-leave-conflict',
      templateData: {
        patientName,
        doctorName,
        date: dateStr,
        appointmentId,
      },
      notificationKey: `leave-conflict-${appointmentId}`,
    });
  }

  async queueReminderEmail(appointment: AppointmentEmailData): Promise<void> {
    const key = `reminder-${appointment.id}`;
    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
    const dateStr = this.formatDate(appointment.appointmentDate);

    await this.upsertEmailJob({
      to: appointment.patient.user.email,
      subject: `Reminder: Appointment tomorrow with ${doctorName}`,
      templateName: 'appointment-reminder',
      templateData: {
        patientName,
        doctorName,
        date: dateStr,
        startTime: appointment.startTime,
        appointmentId: appointment.id,
      },
      notificationKey: key + '-reminder',
    });
  }

  // ─── Process Email Job ─────────────────────────────────────────────────────

  async processEmailJob(jobId: string): Promise<void> {
    const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === EmailJobStatus.SENT) return;

    const html = this.renderTemplate(job.templateName, job.templateData as Record<string, string>);

    try {
      await this.sendEmail({ to: job.to, subject: job.subject, html });

      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: EmailJobStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
      });

      logger.info(`Email sent successfully: ${job.notificationKey}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newAttempts = job.attempts + 1;
      const isExhausted = newAttempts >= job.maxAttempts;

      // Exponential backoff: 2^attempts minutes
      const nextRetryAt = isExhausted
        ? null
        : new Date(Date.now() + Math.pow(2, newAttempts) * 60 * 1000);

      await prisma.emailJob.update({
        where: { id: jobId },
        data: {
          status: isExhausted ? EmailJobStatus.FAILED : EmailJobStatus.PENDING,
          attempts: newAttempts,
          lastAttemptAt: new Date(),
          nextRetryAt,
          errorMessage,
        },
      });

      logger.error(`Email job failed (attempt ${newAttempts}/${job.maxAttempts}): ${job.notificationKey}`, {
        error: errorMessage,
        willRetry: !isExhausted,
      });

      throw error;
    }
  }

  async getPendingEmailJobs() {
    return prisma.emailJob.findMany({
      where: {
        status: EmailJobStatus.PENDING,
        attempts: { lt: 3 },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
  }

  // ─── Template Renderer ─────────────────────────────────────────────────────

  renderTemplate(templateName: string, data: Record<string, string>): string {
    switch (templateName) {
      case 'booking-confirmation':
        return this.getEmailWrapper(
          'Your appointment is confirmed',
          `<p>Hello ${data.patientName},</p>
           <p>Your appointment has been confirmed. Here are the details:</p>
           <div class="card">
             <h3>📋 Appointment Details</h3>
             <div class="row"><span class="label">Doctor</span><span class="value">${data.doctorName}</span></div>
             <div class="row"><span class="label">Specialization</span><span class="value">${data.specialization}</span></div>
             <div class="row"><span class="label">Date</span><span class="value">${data.date}</span></div>
             <div class="row"><span class="label">Time</span><span class="value">${data.startTime} - ${data.endTime}</span></div>
           </div>
           <p>Please arrive 10 minutes early. If you need to cancel or reschedule, please do so at least 24 hours in advance.</p>`
        );

      case 'booking-notification-doctor':
        return this.getEmailWrapper(
          'New appointment scheduled',
          `<p>Hello ${data.doctorName},</p>
           <p>A new appointment has been booked.</p>
           <div class="card">
             <h3>📋 Appointment Details</h3>
             <div class="row"><span class="label">Patient</span><span class="value">${data.patientName}</span></div>
             <div class="row"><span class="label">Date</span><span class="value">${data.date}</span></div>
             <div class="row"><span class="label">Time</span><span class="value">${data.startTime} - ${data.endTime}</span></div>
           </div>`
        );

      case 'appointment-cancelled':
        return this.getEmailWrapper(
          'Appointment Cancelled',
          `<p>Hello ${data.patientName},</p>
           <p>Your appointment has been cancelled.</p>
           <div class="card">
             <h3>❌ Cancellation Details</h3>
             <div class="row"><span class="label">Doctor</span><span class="value">${data.doctorName}</span></div>
             <div class="row"><span class="label">Date</span><span class="value">${data.date}</span></div>
             <div class="row"><span class="label">Time</span><span class="value">${data.startTime}</span></div>
             <div class="row"><span class="label">Reason</span><span class="value">${data.cancelReason}</span></div>
           </div>
           <p>Please book a new appointment at your convenience.</p>`
        );

      case 'doctor-leave-conflict':
        return this.getEmailWrapper(
          'Your Appointment Has Been Affected',
          `<p>Hello ${data.patientName},</p>
           <p>We regret to inform you that your appointment has been affected due to the doctor being on leave.</p>
           <div class="card">
             <h3>📅 Affected Appointment</h3>
             <div class="row"><span class="label">Doctor</span><span class="value">${data.doctorName}</span></div>
             <div class="row"><span class="label">Date</span><span class="value">${data.date}</span></div>
           </div>
           <p>Your appointment status has been updated to <strong>Reschedule Required</strong>. Please log in to book a new time.</p>
           <p>We sincerely apologize for the inconvenience.</p>`
        );

      case 'appointment-reminder':
        return this.getEmailWrapper(
          'Appointment Reminder',
          `<p>Hello ${data.patientName},</p>
           <p>This is a reminder about your upcoming appointment.</p>
           <div class="card">
             <h3>⏰ Reminder</h3>
             <div class="row"><span class="label">Doctor</span><span class="value">${data.doctorName}</span></div>
             <div class="row"><span class="label">Date</span><span class="value">${data.date}</span></div>
             <div class="row"><span class="label">Time</span><span class="value">${data.startTime}</span></div>
           </div>
           <p>Please remember to bring any relevant medical records or test results.</p>`
        );

      case 'medication-reminder':
        return this.getEmailWrapper(
          'Medication Reminder',
          `<p>Hello ${data.patientName},</p>
           <p>This is a reminder to take your medication.</p>
           <div class="card">
             <h3>💊 Medication</h3>
             <div class="row"><span class="label">Medication</span><span class="value">${data.medicationName}</span></div>
             <div class="row"><span class="label">Dosage</span><span class="value">${data.dosage}</span></div>
             <div class="row"><span class="label">Instructions</span><span class="value">${data.instructions || 'As prescribed'}</span></div>
           </div>
           <p>Please take your medication as prescribed by your doctor.</p>`
        );

      default:
        return this.getEmailWrapper(
          'Notification',
          `<p>${JSON.stringify(data)}</p>`
        );
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async upsertEmailJob(params: {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, any>;
    notificationKey: string;
  }): Promise<void> {
    await prisma.emailJob.upsert({
      where: { notificationKey: params.notificationKey },
      create: {
        to: params.to,
        subject: params.subject,
        templateName: params.templateName,
        templateData: params.templateData,
        notificationKey: params.notificationKey,
        status: EmailJobStatus.PENDING,
      },
      update: {
        // Already exists - don't re-queue (idempotency)
      },
    });
  }
}

export const emailService = new EmailService();
