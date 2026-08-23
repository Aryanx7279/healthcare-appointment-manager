import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { leaveService } from '../services/leave.service';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';

export class AdminController {
  // ─── Dashboard Stats ─────────────────────────────────────────────────────

  async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [totalDoctors, totalPatients, totalAppointments, pendingJobs, todayAppointments] =
        await Promise.all([
          prisma.doctorProfile.count({ where: { isActive: true } }),
          prisma.patientProfile.count(),
          prisma.appointment.count(),
          prisma.emailJob.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
          prisma.appointment.count({
            where: {
              appointmentDate: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
                lt: new Date(new Date().setHours(23, 59, 59, 999)),
              },
              status: { notIn: ['CANCELLED', 'EXPIRED'] },
            },
          }),
        ]);

      res.json({
        success: true,
        data: { totalDoctors, totalPatients, totalAppointments, pendingJobs, todayAppointments },
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── Doctor Management ────────────────────────────────────────────────────

  async createDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        specializationId,
        bio,
        licenseNumber,
        slotDurationMins,
      } = req.body;

      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) throw new AppError('Email already in use', 409, 'EMAIL_EXISTS');

      const passwordHash = await bcrypt.hash(password || 'ChangeMe123!', 12);

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            passwordHash,
            role: 'DOCTOR',
            firstName,
            lastName,
          },
        });

        await tx.doctorProfile.create({
          data: {
            userId: newUser.id,
            specializationId,
            bio,
            licenseNumber,
            slotDurationMins: slotDurationMins || 30,
          },
        });

        return newUser;
      });

      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json({ success: true, data: safeUser });
    } catch (error) {
      next(error);
    }
  }

  async updateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { firstName, lastName, bio, licenseNumber, specializationId, slotDurationMins, isActive } = req.body;

      const doctorProfile = await prisma.doctorProfile.findUnique({ where: { id } });
      if (!doctorProfile) throw new AppError('Doctor not found', 404, 'NOT_FOUND');

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: doctorProfile.userId },
          data: { firstName, lastName },
        });

        await tx.doctorProfile.update({
          where: { id },
          data: { bio, licenseNumber, specializationId, slotDurationMins, isActive },
        });
      });

      const updated = await prisma.doctorProfile.findUnique({
        where: { id },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, specialization: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async deactivateDoctor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await prisma.doctorProfile.update({
        where: { id: req.params.id as string },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'Doctor deactivated' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Leave Management (Admin) ─────────────────────────────────────────────

  async addDoctorLeave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date, reason } = req.body;
      const result = await leaveService.addLeave(req.params.doctorId as string, date, reason);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeDoctorLeave(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leaveService.removeLeave(req.params.doctorId as string, req.params.date as string);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ─── Specializations ──────────────────────────────────────────────────────

  async getSpecializations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const specializations = await prisma.specialization.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: specializations });
    } catch (error) {
      next(error);
    }
  }

  async createSpecialization(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description } = req.body;
      const spec = await prisma.specialization.create({ data: { name, description } });
      res.status(201).json({ success: true, data: spec });
    } catch (error) {
      next(error);
    }
  }

  // ─── Working Hours (Admin) ────────────────────────────────────────────────

  async setWorkingHours(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dayOfWeek, startTime, endTime, breakStart, breakEnd } = req.body;
      const result = await leaveService.upsertWorkingHour(
        req.params.doctorId as string,
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

  // ─── System Status ────────────────────────────────────────────────────────

  async getEmailJobs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [jobs, total] = await Promise.all([
        prisma.emailJob.findMany({
          where: status ? { status: status as any } : {},
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.emailJob.count({ where: status ? { status: status as any } : {} }),
      ]);

      res.json({ success: true, data: { jobs, total } });
    } catch (error) {
      next(error);
    }
  }

  // ─── Patients ─────────────────────────────────────────────────────────────

  async getPatients(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, page = '1', limit = '20' } = req.query as Record<string, string>;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where: any = {};
      if (search) {
        where.OR = [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [patients, total] = await Promise.all([
        prisma.patientProfile.findMany({
          where,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } },
          },
          skip,
          take: parseInt(limit),
        }),
        prisma.patientProfile.count({ where }),
      ]);

      res.json({ success: true, data: { patients, total } });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
