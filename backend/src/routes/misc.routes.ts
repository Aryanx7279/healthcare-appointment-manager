import { Router } from 'express';
import { calendarController, notificationController } from '../controllers/calendar.controller';
import { authenticate } from '../middleware/auth.middleware';
import { consultationController } from '../controllers/consultation.controller';

const router = Router();

// ─── Calendar Routes ────────────────────────────────────────────────────────
// GET /api/calendar/connect
router.get('/calendar/connect', authenticate, calendarController.initiateConnection.bind(calendarController));

// GET /api/calendar/callback (OAuth redirect)
router.get('/calendar/callback', calendarController.handleCallback.bind(calendarController));

// DELETE /api/calendar/disconnect
router.delete('/calendar/disconnect', authenticate, calendarController.disconnect.bind(calendarController));

// GET /api/calendar/status
router.get('/calendar/status', authenticate, calendarController.getStatus.bind(calendarController));

// ─── Notification Routes ────────────────────────────────────────────────────
// GET /api/notifications
router.get('/notifications', authenticate, notificationController.getNotifications.bind(notificationController));

// PATCH /api/notifications/read-all
router.patch('/notifications/read-all', authenticate, notificationController.markAllAsRead.bind(notificationController));

// PATCH /api/notifications/:id/read
router.patch('/notifications/:id/read', authenticate, notificationController.markAsRead.bind(notificationController));

// GET /api/notifications/unread-count
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadCount.bind(notificationController));

// ─── Consultation (Doctor can access directly) ──────────────────────────────
// GET /api/consultations/:consultationId
router.get(
  '/consultations/:consultationId',
  authenticate,
  consultationController.getConsultation.bind(consultationController)
);

// POST /api/consultations/:consultationId/postvisit-summary
router.post(
  '/consultations/:consultationId/postvisit-summary',
  authenticate,
  consultationController.generatePostVisitSummary.bind(consultationController)
);

// ─── Specializations (public) ────────────────────────────────────────────────
router.get('/specializations', async (req, res) => {
  const { prisma } = require('../config/database');
  const specs = await prisma.specialization.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: specs });
});

export default router;
