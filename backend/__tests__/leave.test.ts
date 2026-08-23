import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { leaveService } from '../src/services/leave.service';
import {
  createTestDoctor,
  createTestPatient,
  createTestSpecialization,
  cleanupTestData,
  prisma,
} from './helpers';

// Mock external services
jest.mock('../src/services/email.service', () => ({
  emailService: {
    queueBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    queueCancellationEmail: jest.fn().mockResolvedValue(undefined),
    queueLeaveConflictEmail: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../src/services/calendar.service', () => ({
  calendarService: {
    createAppointmentEvent: jest.fn().mockResolvedValue(undefined),
    deleteAppointmentEvent: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../src/services/notification.service', () => ({
  notificationService: {
    createAppointmentNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Doctor Leave Management', () => {
  let doctorProfile: any;
  let patientProfile: any;

  beforeAll(async () => {
    await cleanupTestData();
    const spec = await createTestSpecialization();
    const { profile } = await createTestDoctor(spec.id);
    doctorProfile = profile;
    const { profile: p } = await createTestPatient();
    patientProfile = p;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  test('Adding leave with no conflicts creates leave record', async () => {
    const result = await leaveService.addLeave(
      doctorProfile.id,
      '2027-02-01',
      'Personal leave'
    );

    expect(result.leave).toBeDefined();
    expect(result.affectedAppointmentsCount).toBe(0);
  });

  test('Adding leave notifies affected patients and updates appointment status', async () => {
    const leaveDate = '2027-02-15';

    // Create an appointment on the leave date
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: doctorProfile.id,
        patientId: patientProfile.id,
        appointmentDate: new Date(leaveDate),
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED',
      },
    });

    const result = await leaveService.addLeave(
      doctorProfile.id,
      leaveDate,
      'Medical conference'
    );

    expect(result.affectedAppointmentsCount).toBe(1);
    expect(result.affectedAppointments[0].id).toBe(appointment.id);

    // Verify appointment status updated to RESCHEDULE_REQUIRED
    const updatedAppointment = await prisma.appointment.findUnique({
      where: { id: appointment.id },
    });
    expect(updatedAppointment?.status).toBe('RESCHEDULE_REQUIRED');

    // Verify email service was called
    const { emailService } = require('../src/services/email.service');
    expect(emailService.queueLeaveConflictEmail).toHaveBeenCalled();
  });

  test('Removing leave restores bookability', async () => {
    const leaveDate = '2027-02-01';

    const result = await leaveService.removeLeave(doctorProfile.id, leaveDate);
    expect(result.message).toContain('removed');

    // Verify leave no longer exists
    const leave = await prisma.doctorLeave.findUnique({
      where: {
        doctorId_date: {
          doctorId: doctorProfile.id,
          date: new Date(leaveDate),
        },
      },
    });
    expect(leave).toBeNull();
  });

  test('Duplicate leave for same date is idempotent (upsert)', async () => {
    const leaveDate = '2027-03-01';

    await leaveService.addLeave(doctorProfile.id, leaveDate, 'First reason');
    const result = await leaveService.addLeave(doctorProfile.id, leaveDate, 'Updated reason');

    expect(result.leave).toBeDefined();

    // Verify only one leave record
    const leaves = await prisma.doctorLeave.findMany({
      where: { doctorId: doctorProfile.id, date: new Date(leaveDate) },
    });
    expect(leaves).toHaveLength(1);
    expect(leaves[0].reason).toBe('Updated reason');
  });
});
