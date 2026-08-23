import { NotificationType } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface AppointmentForNotification {
  id: string;
  appointmentDate: Date;
  startTime: string;
  doctor: {
    user: { id: string; firstName: string; lastName: string };
    specialization: { name: string };
  };
  patient: {
    user: { id: string; firstName: string; lastName: string };
  };
  cancelReason?: string | null;
}

export class NotificationService {
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.notification.create({
        data: { userId, type, title, message, metadata },
      });
    } catch (error) {
      logger.error('Failed to create notification:', error);
    }
  }

  async createAppointmentNotification(
    appointment: AppointmentForNotification,
    type: NotificationType
  ): Promise<void> {
    const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
    const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
    const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const metadata = { appointmentId: appointment.id };

    switch (type) {
      case NotificationType.BOOKING_CONFIRMATION:
        await this.createNotification(
          appointment.patient.user.id,
          type,
          'Appointment Confirmed',
          `Your appointment with ${doctorName} is confirmed for ${dateStr} at ${appointment.startTime}.`,
          metadata
        );
        await this.createNotification(
          appointment.doctor.user.id,
          NotificationType.BOOKING_CONFIRMATION,
          'New Appointment',
          `New appointment with ${patientName} on ${dateStr} at ${appointment.startTime}.`,
          metadata
        );
        break;

      case NotificationType.APPOINTMENT_CANCELLED:
        await this.createNotification(
          appointment.patient.user.id,
          type,
          'Appointment Cancelled',
          `Your appointment with ${doctorName} on ${dateStr} has been cancelled. ${appointment.cancelReason ? `Reason: ${appointment.cancelReason}` : ''}`,
          metadata
        );
        break;

      case NotificationType.APPOINTMENT_RESCHEDULED:
        await this.createNotification(
          appointment.patient.user.id,
          type,
          'Appointment Rescheduled',
          `Your appointment with ${doctorName} has been rescheduled to ${dateStr} at ${appointment.startTime}.`,
          metadata
        );
        break;

      case NotificationType.DOCTOR_LEAVE_CONFLICT:
        await this.createNotification(
          appointment.patient.user.id,
          type,
          'Action Required: Appointment Affected',
          `Your appointment with ${doctorName} on ${dateStr} requires rescheduling as the doctor is on leave.`,
          metadata
        );
        break;
    }
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, page, limit };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}

export const notificationService = new NotificationService();
