import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { appointmentService } from '../services/appointment.service';
import { slotService } from '../services/slot.service';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export class AppointmentController {
  async getSlots(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Support both /doctors/:id/slots and /appointments/doctors/:doctorId/slots route patterns
      const doctorId = (req.params.id || req.params.doctorId) as string;
      const { date } = req.query as { date: string };

      if (!doctorId) {
        throw new AppError('Doctor ID is required', 400, 'VALIDATION_ERROR');
      }
      if (!date) {
        throw new AppError('Date is required', 400, 'VALIDATION_ERROR');
      }

      const slots = await slotService.getAvailableSlots(doctorId, date);
      res.json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  async holdSlot(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date, startTime, endTime } = req.body;

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: req.user!.id },
      });

      if (!patientProfile) {
        throw new AppError('Patient profile not found', 404, 'NOT_FOUND');
      }

      const hold = await slotService.holdSlot(
        doctorId,
        patientProfile.id,
        date,
        startTime,
        endTime
      );

      res.status(201).json({ success: true, data: hold });
    } catch (error) {
      next(error);
    }
  }

  async bookAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { doctorId, date, startTime, endTime, holdId, notes } = req.body;

      const appointment = await appointmentService.bookAppointment({
        doctorId,
        patientUserId: req.user!.id,
        date,
        startTime,
        endTime,
        holdId,
        notes,
      });

      res.status(201).json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async getMyAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.query as { status?: any };
      const appointments = await appointmentService.getPatientAppointments(
        req.user!.id,
        status
      );
      res.json({ success: true, data: appointments });
    } catch (error) {
      next(error);
    }
  }

  async getDoctorAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.query as { date?: string };
      const appointments = await appointmentService.getDoctorAppointments(
        req.user!.id,
        date
      );
      res.json({ success: true, data: appointments });
    } catch (error) {
      next(error);
    }
  }

  async getAppointmentById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const appointment = await appointmentService.getAppointmentById(
        req.params.id as string,
        req.user!.id,
        req.user!.role
      );
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async cancelAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body;
      const appointment = await appointmentService.cancelAppointment(
        req.params.id as string,
        req.user!.id,
        reason || 'Cancelled by user',
        req.user!.role
      );
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async rescheduleAppointment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { newDate, newStartTime, newEndTime } = req.body;
      const appointment = await appointmentService.rescheduleAppointment(
        req.params.id as string,
        req.user!.id,
        newDate,
        newStartTime,
        newEndTime
      );
      res.json({ success: true, data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async getAllAppointments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, doctorId, patientId, date } = req.query as Record<string, string>;
      const appointments = await appointmentService.getAllAppointments({
        status: status as any,
        doctorId,
        patientId,
        date,
      });
      res.json({ success: true, data: appointments });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
