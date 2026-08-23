import { DayOfWeek } from '@prisma/client';
import { prisma } from '../config/database';
import { parseISO, isBefore } from 'date-fns';

function dayOfWeekToPrisma(day: number): DayOfWeek {
  const map: Record<number, DayOfWeek> = {
    0: DayOfWeek.SUNDAY, 1: DayOfWeek.MONDAY, 2: DayOfWeek.TUESDAY,
    3: DayOfWeek.WEDNESDAY, 4: DayOfWeek.THURSDAY, 5: DayOfWeek.FRIDAY,
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

async function debugSlots() {
  const doctorId = '82f303af-82fe-4928-94f8-ed77bbe97d62';
  const date = '2026-08-24';

  const dateObj = parseISO(date);
  const dayOfWeek = dayOfWeekToPrisma(dateObj.getDay());

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { workingHours: { where: { dayOfWeek, isActive: true } } },
  });

  if (!doctorProfile) {
    console.log('Doctor not found');
    return;
  }

  const workingHour = doctorProfile.workingHours[0];
  if (!workingHour) {
    console.log('No working hours for day:', dayOfWeek);
    return;
  }

  console.log('Doctor working hours:', workingHour);

  const startMins = timeToMinutes(workingHour.startTime);
  const endMins = timeToMinutes(workingHour.endTime);
  const slotDuration = doctorProfile.slotDurationMins;

  console.log(`startMins: ${startMins}, endMins: ${endMins}, slotDuration: ${slotDuration}`);

  const now = new Date();
  console.log('Current time (now):', now.toString());

  for (let slotStart = startMins; slotStart + slotDuration <= endMins; slotStart += slotDuration) {
    const slotEnd = slotStart + slotDuration;
    const startTimeStr = minutesToTime(slotStart);
    const slotDateTime = new Date(`${date}T${startTimeStr}:00`);
    const isPast = isBefore(slotDateTime, now);

    console.log(`Slot ${startTimeStr}: slotDateTime=${slotDateTime.toString()} | isBeforeNow=${isPast}`);
  }
}

debugSlots().catch(console.error).finally(() => prisma.$disconnect());
