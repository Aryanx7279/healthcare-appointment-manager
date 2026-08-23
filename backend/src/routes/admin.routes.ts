import { Router } from 'express';
import { body } from 'express-validator';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/errorHandler.middleware';
import { consultationController } from '../controllers/consultation.controller';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, authorize('ADMIN'));

// GET /api/admin/stats
router.get('/stats', adminController.getDashboardStats.bind(adminController));

// ─── Doctors ──────────────────────────────────────────────────────────────────
router.get('/doctors', (req: any, res: any, next: any) => {
  const { doctorController } = require('../controllers/doctor.controller');
  doctorController.getDoctors(req, res, next);
});

router.post(
  '/doctors',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('specializationId').notEmpty().withMessage('Specialization is required'),
  ],
  validateRequest,
  adminController.createDoctor.bind(adminController)
);

router.patch('/doctors/:id', adminController.updateDoctor.bind(adminController));
router.delete('/doctors/:id/deactivate', adminController.deactivateDoctor.bind(adminController));

// ─── Doctor Leave (Admin) ──────────────────────────────────────────────────────
router.post(
  '/doctors/:doctorId/leave',
  [body('date').isDate().withMessage('Valid date is required')],
  validateRequest,
  adminController.addDoctorLeave.bind(adminController)
);

router.delete('/doctors/:doctorId/leave/:date', adminController.removeDoctorLeave.bind(adminController));

// ─── Working Hours (Admin) ─────────────────────────────────────────────────────
router.post(
  '/doctors/:doctorId/working-hours',
  [
    body('dayOfWeek').notEmpty().withMessage('Day of week is required'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('Start time must be HH:MM'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('End time must be HH:MM'),
  ],
  validateRequest,
  adminController.setWorkingHours.bind(adminController)
);

// ─── Specializations ──────────────────────────────────────────────────────────
router.get('/specializations', adminController.getSpecializations.bind(adminController));
router.post(
  '/specializations',
  [body('name').notEmpty().withMessage('Specialization name is required')],
  validateRequest,
  adminController.createSpecialization.bind(adminController)
);

// ─── Patients ──────────────────────────────────────────────────────────────────
router.get('/patients', adminController.getPatients.bind(adminController));

// ─── Email Jobs / System ──────────────────────────────────────────────────────
router.get('/email-jobs', adminController.getEmailJobs.bind(adminController));

// ─── Consultations (admin view) ────────────────────────────────────────────────
router.get(
  '/consultations/:consultationId',
  consultationController.getConsultation.bind(consultationController)
);

// ─── Post-visit Summary ────────────────────────────────────────────────────────
router.post(
  '/consultations/:consultationId/postvisit-summary',
  consultationController.generatePostVisitSummary.bind(consultationController)
);

export default router;
