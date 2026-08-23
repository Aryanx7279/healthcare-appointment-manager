import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { leaveService } from '../services/leave.service';
import { AppError } from '../utils/AppError';

export class DoctorController {
  async getDoctors(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { specialization, search, page = '1', limit = '20' } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where: any = { isActive: true };

      if (specialization) {
        where.specialization = {
          name: { contains: specialization, mode: 'insensitive' },
        };
      }

      if (search) {
        where.OR = [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [doctors, total] = await Promise.all([
        prisma.doctorProfile.findMany({
          where,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            specialization: true,
            workingHours: { where: { isActive: true } },
          },
          skip,
          take: parseInt(limit),
          orderBy: { user: { firstName: 'asc' } },
        }),
        prisma.doctorProfile.count({ where }),
      ]);

      res.json({ success: true, data: { doctors, total, page: parseInt(page), limit: parseInt(limit) } });
    } catch (error) {
      next(error);
    }
  }

  async getDoctorById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctor = await prisma.doctorProfile.findUnique({
        where: { id: req.params.id as string },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          specialization: true,
          workingHours: { where: { isActive: true } },
        },
      });

      if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

      res.json({ success: true, data: doctor });
    } catch (error) {
      next(error);
    }
  }

  async getDoctorProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          specialization: true,
          workingHours: { where: { isActive: true } },
          leaves: { orderBy: { date: 'asc' } },
        },
      });

      if (!profile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }

  // ─── Working Hours ────────────────────────────────────────────────────────

  async getWorkingHours(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctorProfile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      const hours = await leaveService.getWorkingHours(doctorProfile.id);
      res.json({ success: true, data: hours });
    } catch (error) {
      next(error);
    }
  }

  async upsertWorkingHour(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctorProfile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      const { dayOfWeek, startTime, endTime, breakStart, breakEnd } = req.body;
      const result = await leaveService.upsertWorkingHour(
        doctorProfile.id,
        dayOfWeek,
        startTime,
        endTime,
        breakStart,
        breakEnd
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Leave Management ─────────────────────────────────────────────────────

  async addLeave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctorProfile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      const { date, reason } = req.body;
      const result = await leaveService.addLeave(doctorProfile.id, date, reason);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeLeave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctorProfile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      const result = await leaveService.removeLeave(doctorProfile.id, req.params.date as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getLeaves(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: req.user!.id },
      });
      if (!doctorProfile) throw new AppError('Doctor profile not found', 404, 'NOT_FOUND');

      const leaves = await leaveService.getDoctorLeaves(doctorProfile.id);
      res.json({ success: true, data: leaves });
    } catch (error) {
      next(error);
    }
  }
}

export const doctorController = new DoctorController();
