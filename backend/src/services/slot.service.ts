import { DayOfWeek, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { config } from '../config';
import { addMinutes, format, parse, isBefore, isAfter, parseISO } from 'date-fns';

export interface TimeSlot {
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  isAvailable: boolean;
  isHeld: boolean;
}

function dayOfWeekToPrisma(day: number): DayOfWeek {
  const map: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY,
    1: DayOfWeek.MONDAY,
    2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY,
    4: DayOfWeek.THURSDAY,
    5: DayOfWeek.FRIDAY,
    6: DayOfWeek.SATURDAY,
  };
  return map[day];
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export class SlotService {
  async getAvailableSlots(
    doctorId: string,
    date: string // "YYYY-MM-DD"
  ): Promise<TimeSlot[]> {
    const dateObj = parseISO(date);
    const dayOfWeek = dayOfWeekToPrisma(dateObj.getDay());

    // Get doctor profile and working hours
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        workingHours: {
          where: { dayOfWeek, isActive: true },
        },
      },
    });

    if (!doctorProfile || !doctorProfile.isActive) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    const workingHour = doctorProfile.workingHours[0];
    if (!workingHour) {
      return []; // Doctor doesn't work on this day
    }

    // Check for leave
    const leave = await prisma.doctorLeave.findUnique({
      where: {
        doctorId_date: {
          doctorId,
          date: new Date(date),
        },
      },
    });

    if (leave) {
      return []; // Doctor is on leave
    }

    // Get existing appointments
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: new Date(date),
        status: {
          notIn: ['CANCELLED', 'EXPIRED'],
        },
      },
      select: { startTime: true, endTime: true },
    });

    // Get active slot holds (excluding expired)
    const activeHolds = await prisma.slotHold.findMany({
      where: {
        doctorId,
        appointmentDate: new Date(date),
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: { startTime: true },
    });

    const bookedSlots = new Set(existingAppointments.map((a) => a.startTime));
    const heldSlots = new Set(activeHolds.map((h) => h.startTime));

    // Generate all slots within working hours
    const slots: TimeSlot[] = [];
    const slotDuration = doctorProfile.slotDurationMins;
    const startMins = timeToMinutes(workingHour.startTime);
    const endMins = timeToMinutes(workingHour.endTime);
    const breakStart = workingHour.breakStart
      ? timeToMinutes(workingHour.breakStart)
      : null;
    const breakEnd = workingHour.breakEnd
      ? timeToMinutes(workingHour.breakEnd)
      : null;

    const now = new Date();

    for (
      let slotStart = startMins;
      slotStart + slotDuration <= endMins;
      slotStart += slotDuration
    ) {
      const slotEnd = slotStart + slotDuration;

      // Skip break time
      if (
        breakStart !== null &&
        breakEnd !== null &&
        slotStart >= breakStart &&
        slotStart < breakEnd
      ) {
        continue;
      }

      const startTimeStr = minutesToTime(slotStart);
      const endTimeStr = minutesToTime(slotEnd);

      // Check if slot is in the past
      const slotDateTime = new Date(`${date}T${startTimeStr}:00`);
      if (isBefore(slotDateTime, now)) {
        continue;
      }

      const isBooked = bookedSlots.has(startTimeStr);
      const isHeld = heldSlots.has(startTimeStr);

      slots.push({
        startTime: startTimeStr,
        endTime: endTimeStr,
        isAvailable: !isBooked && !isHeld,
        isHeld,
      });
    }

    return slots;
  }

  async holdSlot(
    doctorId: string,
    patientId: string, // PatientProfile.id
    date: string,
    startTime: string,
    endTime: string
  ): Promise<{ holdId: string; expiresAt: Date }> {
    const expiresAt = new Date(
      Date.now() + config.slotHold.durationMinutes * 60 * 1000
    );

    try {
      // Release any existing hold by this patient for any slot
      await prisma.slotHold.updateMany({
        where: {
          patientId,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      });

      // Try to create a new hold - unique constraint will prevent double holds
      const hold = await prisma.slotHold.create({
        data: {
          doctorId,
          patientId,
          appointmentDate: new Date(date),
          startTime,
          endTime,
          expiresAt,
          status: 'ACTIVE',
        },
      });

      logger.info(
        `Slot held: doctor=${doctorId} date=${date} time=${startTime} patient=${patientId} expires=${expiresAt.toISOString()}`
      );

      return { holdId: hold.id, expiresAt };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AppError(
          'This slot is currently being held by another patient. Please select a different time.',
          409,
          'SLOT_HELD'
        );
      }
      throw error;
    }
  }

  async releaseHold(holdId: string): Promise<void> {
    await prisma.slotHold.updateMany({
      where: { id: holdId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  }

  async cleanupExpiredHolds(): Promise<number> {
    const result = await prisma.slotHold.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired slot holds`);
    }
    return result.count;
  }
}

export const slotService = new SlotService();
