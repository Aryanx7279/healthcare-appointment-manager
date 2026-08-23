import { Router } from 'express';
import { body } from 'express-validator';
import { doctorController } from '../controllers/doctor.controller';
import { appointmentController } from '../controllers/appointment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/errorHandler.middleware';

const router = Router();

// GET /api/doctors (public)
router.get('/', doctorController.getDoctors.bind(doctorController));

// GET /api/doctors/:id/slots (public) - get available time slots for a doctor on a given date
router.get('/:id/slots', appointmentController.getSlots.bind(appointmentController));

// GET /api/doctors/:id (public)
router.get('/:id', doctorController.getDoctorById.bind(doctorController));

// GET /api/doctors/me/profile (doctor only)
router.get(
  '/me/profile',
  authenticate,
  authorize('DOCTOR'),
  doctorController.getDoctorProfile.bind(doctorController)
);

// GET /api/doctors/me/working-hours
router.get(
  '/me/working-hours',
  authenticate,
  authorize('DOCTOR'),
  doctorController.getWorkingHours.bind(doctorController)
);

// PUT /api/doctors/me/working-hours
router.put(
  '/me/working-hours',
  authenticate,
  authorize('DOCTOR'),
  [
    body('dayOfWeek').notEmpty().withMessage('Day of week is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM'),
  ],
  validateRequest,
  doctorController.upsertWorkingHour.bind(doctorController)
);

// GET /api/doctors/me/leaves
router.get(
  '/me/leaves',
  authenticate,
  authorize('DOCTOR'),
  doctorController.getLeaves.bind(doctorController)
);

// POST /api/doctors/me/leaves
router.post(
  '/me/leaves',
  authenticate,
  authorize('DOCTOR'),
  [body('date').isDate().withMessage('Valid date (YYYY-MM-DD) is required')],
  validateRequest,
  doctorController.addLeave.bind(doctorController)
);

// DELETE /api/doctors/me/leaves/:date
router.delete(
  '/me/leaves/:date',
  authenticate,
  authorize('DOCTOR'),
  doctorController.removeLeave.bind(doctorController)
);

export default router;
