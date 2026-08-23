import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

export { prisma };

export async function createTestUser(overrides: {
  email?: string;
  role?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  firstName?: string;
  lastName?: string;
} = {}) {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  return prisma.user.create({
    data: {
      email: overrides.email || `test-${Date.now()}@example.com`,
      passwordHash,
      role: overrides.role || 'PATIENT',
      firstName: overrides.firstName || 'Test',
      lastName: overrides.lastName || 'User',
    },
  });
}

export async function createTestSpecialization(name?: string) {
  return prisma.specialization.create({
    data: { name: name || `Spec-${Date.now()}`, description: 'Test specialization' },
  });
}

export async function createTestDoctor(specializationId: string) {
  const user = await createTestUser({ role: 'DOCTOR' });
  const profile = await prisma.doctorProfile.create({
    data: {
      userId: user.id,
      specializationId,
      slotDurationMins: 30,
    },
  });

  // Add Mon-Fri working hours
  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
  for (const day of days) {
    await prisma.doctorWorkingHour.create({
      data: {
        doctorId: profile.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
      },
    });
  }

  return { user, profile };
}

export async function createTestPatient() {
  const user = await createTestUser({ role: 'PATIENT' });
  const profile = await prisma.patientProfile.create({
    data: { userId: user.id },
  });
  return { user, profile };
}

export async function cleanupTestData() {
  await prisma.medicationReminder.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.postVisitSummary.deleteMany();
  await prisma.consultation.deleteMany();
  await prisma.preVisitSummary.deleteMany();
  await prisma.symptomSubmission.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slotHold.deleteMany();
  await prisma.doctorLeave.deleteMany();
  await prisma.doctorWorkingHour.deleteMany();
  await prisma.emailJob.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.specialization.deleteMany();
}
