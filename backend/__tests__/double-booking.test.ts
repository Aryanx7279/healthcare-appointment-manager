/**
 * CRITICAL TEST: Double-Booking Prevention
 *
 * This test verifies that two simultaneous booking requests for the same
 * doctor, date, and time slot results in exactly ONE success and ONE failure.
 *
 * This is the core concurrency requirement of the assignment.
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient, AppointmentStatus } from '@prisma/client';
import { appointmentService } from '../src/services/appointment.service';
import {
  createTestDoctor,
  createTestPatient,
  createTestSpecialization,
  cleanupTestData,
} from './helpers';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Mock external services so they don't interfere with concurrency tests
jest.mock('../src/services/email.service', () => ({
  emailService: {
    queueBookingConfirmation: jest.fn().mockResolvedValue(undefined),
    queueCancellationEmail: jest.fn().mockResolvedValue(undefined),
    queueRescheduleEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/calendar.service', () => ({
  calendarService: {
    createAppointmentEvent: jest.fn().mockResolvedValue(undefined),
    deleteAppointmentEvent: jest.fn().mockResolvedValue(undefined),
    updateAppointmentEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/services/notification.service', () => ({
  notificationService: {
    createAppointmentNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('Double-Booking Prevention', () => {
  let doctorProfile: any;
  let patient1Profile: any;
  let patient2Profile: any;
  let patient1User: any;
  let patient2User: any;

  const TEST_DATE = '2027-01-15'; // Future date with no conflicts
  const TEST_START = '10:00';
  const TEST_END = '10:30';

  beforeAll(async () => {
    await cleanupTestData();

    const spec = await createTestSpecialization('General Medicine');
    const { profile } = await createTestDoctor(spec.id);
    doctorProfile = profile;

    const p1 = await createTestPatient();
    patient1User = p1.user;
    patient1Profile = p1.profile;

    const p2 = await createTestPatient();
    patient2User = p2.user;
    patient2Profile = p2.profile;
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  test('Sequential bookings - second booking should fail', async () => {
    const booking1 = await appointmentService.bookAppointment({
      doctorId: doctorProfile.id,
      patientUserId: patient1User.id,
      date: TEST_DATE,
      startTime: TEST_START,
      endTime: TEST_END,
    });

    expect(booking1.id).toBeDefined();
    expect(booking1.status).toBe(AppointmentStatus.CONFIRMED);

    // Second booking for same slot should fail
    await expect(
      appointmentService.bookAppointment({
        doctorId: doctorProfile.id,
        patientUserId: patient2User.id,
        date: TEST_DATE,
        startTime: TEST_START,
        endTime: TEST_END,
      })
    ).rejects.toMatchObject({
      errorCode: 'SLOT_ALREADY_BOOKED',
    });

    // Verify only one appointment exists
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        appointmentDate: new Date(TEST_DATE),
        startTime: TEST_START,
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
    });
    expect(appointments).toHaveLength(1);
    expect(appointments[0].patientId).toBe(patient1Profile.id);
  });

  test('Concurrent bookings - exactly ONE must succeed', async () => {
    const CONCURRENT_DATE = '2027-01-16';
    const CONCURRENT_TIME = '11:00';
    const CONCURRENT_END = '11:30';

    // Create additional patients for concurrent test
    const patients = await Promise.all(
      Array.from({ length: 5 }).map(() => createTestPatient())
    );

    // Fire 5 simultaneous booking requests
    const promises = patients.map(({ user }) =>
      appointmentService
        .bookAppointment({
          doctorId: doctorProfile.id,
          patientUserId: user.id,
          date: CONCURRENT_DATE,
          startTime: CONCURRENT_TIME,
          endTime: CONCURRENT_END,
        })
        .then((appt) => ({ success: true, appointmentId: appt.id }))
        .catch((err) => ({ success: false, error: err.errorCode || err.message }))
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    console.log(
      `Concurrent booking results: ${successes.length} success, ${failures.length} failures`
    );

    // CRITICAL ASSERTION: Exactly one booking must succeed
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(patients.length - 1);

    // Verify failures are due to slot conflict
    failures.forEach((f) => {
      expect(
        (f as { success: false; error: string }).error
      ).toMatch(/SLOT_ALREADY_BOOKED|CONFLICT|P2002/i);
    });

    // Verify exactly one appointment in DB
    const dbAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctorProfile.id,
        appointmentDate: new Date(CONCURRENT_DATE),
        startTime: CONCURRENT_TIME,
        status: { notIn: ['CANCELLED', 'EXPIRED'] },
      },
    });
    expect(dbAppointments).toHaveLength(1);
  });

  test('Cancelled appointment frees the slot', async () => {
    const CANCEL_DATE = '2027-01-17';
    const CANCEL_TIME = '14:00';
    const CANCEL_END = '14:30';

    // Book the slot
    const booking = await appointmentService.bookAppointment({
      doctorId: doctorProfile.id,
      patientUserId: patient1User.id,
      date: CANCEL_DATE,
      startTime: CANCEL_TIME,
      endTime: CANCEL_END,
    });

    // Cancel it
    await appointmentService.cancelAppointment(
      booking.id,
      patient1User.id,
      'Changed plans',
      'PATIENT'
    );

    // Now patient2 should be able to book the same slot
    const rebooking = await appointmentService.bookAppointment({
      doctorId: doctorProfile.id,
      patientUserId: patient2User.id,
      date: CANCEL_DATE,
      startTime: CANCEL_TIME,
      endTime: CANCEL_END,
    });

    expect(rebooking.id).toBeDefined();
    expect(rebooking.status).toBe(AppointmentStatus.CONFIRMED);
  });
});
