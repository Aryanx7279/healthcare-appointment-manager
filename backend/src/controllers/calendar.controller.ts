import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { calendarService } from '../services/calendar.service';
import { notificationService } from '../services/notification.service';

export class CalendarController {
  async initiateConnection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authUrl = calendarService.getAuthUrl(req.user!.id);
      res.json({ success: true, data: { authUrl } });
    } catch (error) {
      next(error);
    }
  }

  async handleCallback(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code, state: userId } = req.query as { code: string; state: string };

      if (!code || !userId) {
        res.redirect(`${process.env.FRONTEND_URL}/calendar?error=missing_params`);
        return;
      }

      await calendarService.handleOAuthCallback(code, userId);
      res.redirect(`${process.env.FRONTEND_URL}/calendar?connected=true`);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await calendarService.disconnectCalendar(req.user!.id);
      res.json({ success: true, message: 'Google Calendar disconnected' });
    } catch (error) {
      next(error);
    }
  }

  async getStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await calendarService.getConnectionStatus(req.user!.id);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
}

export class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };
      const result = await notificationService.getUserNotifications(
        req.user!.id,
        parseInt(page || '1'),
        parseInt(limit || '20')
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAsRead(req.params.id as string, req.user!.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  }
}

export const calendarController = new CalendarController();
export const notificationController = new NotificationController();
