import { Router } from 'express';
import { body, param } from 'express-validator';
import { appointmentController } from '../controllers/appointment.controller';
import { symptomController, consultationController } from '../controllers/consultation.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/errorHandler.middleware';

const router = Router();

// GET /api/doctors/:doctorId/slots
router.get('/doctors/:doctorId/slots', appointmentController.getSlots.bind(appointmentController));

// POST /api/appointments/hold
router.post(
  '/hold',
  authenticate,
  authorize('PATIENT'),
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('date').isDate().withMessage('Valid date (YYYY-MM-DD) is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM format'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM format'),
  ],
  validateRequest,
  appointmentController.holdSlot.bind(appointmentController)
);

// POST /api/appointments
router.post(
  '/',
  authenticate,
  authorize('PATIENT'),
  [
    body('doctorId').notEmpty().withMessage('Doctor ID is required'),
    body('date').isDate().withMessage('Valid date (YYYY-MM-DD) is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM format'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM format'),
  ],
  validateRequest,
  appointmentController.bookAppointment.bind(appointmentController)
);

// GET /api/appointments (patient: own; doctor: own; admin: all)
router.get('/', authenticate, (req, res, next) => {
  const role = (req as any).user?.role;
  if (role === 'PATIENT') {
    appointmentController.getMyAppointments(req as any, res, next);
  } else if (role === 'DOCTOR') {
    appointmentController.getDoctorAppointments(req as any, res, next);
  } else {
    appointmentController.getAllAppointments(req as any, res, next);
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, appointmentController.getAppointmentById.bind(appointmentController));

// POST /api/appointments/:id/cancel
router.post(
  '/:id/cancel',
  authenticate,
  appointmentController.cancelAppointment.bind(appointmentController)
);

// POST /api/appointments/:id/reschedule
router.post(
  '/:id/reschedule',
  authenticate,
  authorize('PATIENT'),
  [
    body('newDate').isDate().withMessage('Valid new date is required'),
    body('newStartTime').matches(/^\d{2}:\d{2}$/).withMessage('Valid new start time is required'),
    body('newEndTime').matches(/^\d{2}:\d{2}$/).withMessage('Valid new end time is required'),
  ],
  validateRequest,
  appointmentController.rescheduleAppointment.bind(appointmentController)
);

// POST /api/appointments/:appointmentId/symptoms
router.post(
  '/:appointmentId/symptoms',
  authenticate,
  authorize('PATIENT'),
  [
    body('chiefComplaint').notEmpty().trim().withMessage('Chief complaint is required'),
    body('symptoms').notEmpty().trim().withMessage('Symptom description is required'),
    body('severity').optional().isInt({ min: 1, max: 10 }).withMessage('Severity must be 1-10'),
  ],
  validateRequest,
  symptomController.submitSymptoms.bind(symptomController)
);

// GET /api/appointments/:appointmentId/previsit-summary
router.get(
  '/:appointmentId/previsit-summary',
  authenticate,
  symptomController.getPreVisitSummary.bind(symptomController)
);

// POST /api/appointments/:appointmentId/consultation
router.post(
  '/:appointmentId/consultation',
  authenticate,
  authorize('DOCTOR'),
  [
    body('clinicalNotes').notEmpty().trim().withMessage('Clinical notes are required'),
  ],
  validateRequest,
  consultationController.submitConsultation.bind(consultationController)
);

export default router;
