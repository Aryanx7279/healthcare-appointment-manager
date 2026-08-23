import { google } from 'googleapis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

interface AppointmentEventData {
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
}

export class CalendarService {
  private isConfigured(): boolean {
    return !!(config.google.clientId && config.google.clientSecret);
  }

  getOAuthClient() {
    return new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  getAuthUrl(userId: string): string {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    const oauth2Client = this.getOAuthClient();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state: userId,
      prompt: 'consent',
    });
  }

  async handleOAuthCallback(code: string, userId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Calendar not configured');
    }

    const oauth2Client = this.getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error('Invalid OAuth tokens received');
    }

    await prisma.calendarConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date),
        isConnected: true,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(tokens.expiry_date),
        isConnected: true,
      },
    });

    logger.info(`Google Calendar connected for user: ${userId}`);
  }

  async disconnectCalendar(userId: string): Promise<void> {
    await prisma.calendarConnection.updateMany({
      where: { userId },
      data: { isConnected: false },
    });
    logger.info(`Google Calendar disconnected for user: ${userId}`);
  }

  private async getAuthorizedClient(userId: string) {
    const connection = await prisma.calendarConnection.findUnique({
      where: { userId },
    });

    if (!connection || !connection.isConnected) {
      return null;
    }

    const oauth2Client = this.getOAuthClient();
    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken,
      expiry_date: connection.tokenExpiry.getTime(),
    });

    // Auto-refresh token if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await prisma.calendarConnection.update({
          where: { userId },
          data: {
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date
              ? new Date(tokens.expiry_date)
              : connection.tokenExpiry,
          },
        });
      }
    });

    return { client: oauth2Client, calendarId: connection.calendarId };
  }

  private formatEventDateTime(date: Date, time: string): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${dateStr}T${time}:00`;
  }

  async createAppointmentEvent(appointment: AppointmentEventData): Promise<void> {
    if (!this.isConfigured()) {
      logger.debug('Calendar not configured, skipping event creation');
      return;
    }

    const userIds = [
      appointment.doctor.user,
      appointment.patient.user,
    ];

    // Get the actual user IDs
    const doctorUser = await prisma.user.findUnique({
      where: { email: appointment.doctor.user.email },
      select: { id: true },
    });
    const patientUser = await prisma.user.findUnique({
      where: { email: appointment.patient.user.email },
      select: { id: true },
    });

    for (const userInfo of [
      { userId: doctorUser?.id, role: 'doctor' },
      { userId: patientUser?.id, role: 'patient' },
    ]) {
      if (!userInfo.userId) continue;

      try {
        // Check for existing event (idempotency)
        const existingEvent = await prisma.calendarEvent.findUnique({
          where: {
            appointmentId_userId: {
              appointmentId: appointment.id,
              userId: userInfo.userId,
            },
          },
        });

        if (existingEvent) {
          logger.debug(`Calendar event already exists for user ${userInfo.userId}`);
          continue;
        }

        const auth = await this.getAuthorizedClient(userInfo.userId);
        if (!auth) continue;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        const event = await calendar.events.insert({
          calendarId: auth.calendarId,
          requestBody: {
            summary: `Healthcare Appointment - Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
            description: [
              `Patient: ${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`,
              `Doctor: Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
              `Specialization: ${appointment.doctor.specialization.name}`,
              `Appointment ID: ${appointment.id}`,
            ].join('\n'),
            start: {
              dateTime: this.formatEventDateTime(appointment.appointmentDate, appointment.startTime),
              timeZone: 'UTC',
            },
            end: {
              dateTime: this.formatEventDateTime(appointment.appointmentDate, appointment.endTime),
              timeZone: 'UTC',
            },
            attendees: [
              { email: appointment.doctor.user.email },
              { email: appointment.patient.user.email },
            ],
            reminders: {
              useDefault: false,
              overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 30 },
              ],
            },
          },
        });

        if (event.data.id) {
          await prisma.calendarEvent.create({
            data: {
              appointmentId: appointment.id,
              userId: userInfo.userId,
              googleEventId: event.data.id,
              calendarId: auth.calendarId,
            },
          });

          logger.info(`Calendar event created for ${userInfo.role}: ${event.data.id}`);
        }
      } catch (error) {
        logger.error(
          `Failed to create calendar event for ${userInfo.role}:`,
          error instanceof Error ? error.message : error
        );
        // Non-fatal: calendar failures don't break appointment booking
      }
    }
  }

  async updateAppointmentEvent(
    oldAppointmentId: string,
    newAppointment: AppointmentEventData
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const existingEvents = await prisma.calendarEvent.findMany({
      where: { appointmentId: oldAppointmentId },
    });

    for (const event of existingEvents) {
      try {
        const auth = await this.getAuthorizedClient(event.userId);
        if (!auth) continue;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        await calendar.events.update({
          calendarId: event.calendarId,
          eventId: event.googleEventId,
          requestBody: {
            summary: `Healthcare Appointment - Dr. ${newAppointment.doctor.user.firstName} ${newAppointment.doctor.user.lastName}`,
            start: {
              dateTime: this.formatEventDateTime(
                newAppointment.appointmentDate,
                newAppointment.startTime
              ),
              timeZone: 'UTC',
            },
            end: {
              dateTime: this.formatEventDateTime(
                newAppointment.appointmentDate,
                newAppointment.endTime
              ),
              timeZone: 'UTC',
            },
          },
        });

        logger.info(`Calendar event updated: ${event.googleEventId}`);
      } catch (error) {
        logger.error(`Failed to update calendar event:`, error instanceof Error ? error.message : error);
      }
    }
  }

  async deleteAppointmentEvent(appointmentId: string): Promise<void> {
    if (!this.isConfigured()) return;

    const events = await prisma.calendarEvent.findMany({
      where: { appointmentId },
    });

    for (const event of events) {
      try {
        const auth = await this.getAuthorizedClient(event.userId);
        if (!auth) continue;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        await calendar.events.delete({
          calendarId: event.calendarId,
          eventId: event.googleEventId,
        });

        await prisma.calendarEvent.delete({ where: { id: event.id } });

        logger.info(`Calendar event deleted: ${event.googleEventId}`);
      } catch (error) {
        logger.error(`Failed to delete calendar event:`, error instanceof Error ? error.message : error);
      }
    }
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; calendarId?: string }> {
    const connection = await prisma.calendarConnection.findUnique({
      where: { userId },
    });

    return {
      connected: !!(connection?.isConnected),
      calendarId: connection?.calendarId,
    };
  }
}

export const calendarService = new CalendarService();
