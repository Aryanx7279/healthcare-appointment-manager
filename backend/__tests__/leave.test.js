"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
const leave_service_1 = require("../src/services/leave.service");
const helpers_1 = require("./helpers");
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
    let doctorProfile;
    let patientProfile;
    beforeAll(async () => {
        await (0, helpers_1.cleanupTestData)();
        const spec = await (0, helpers_1.createTestSpecialization)();
        const { profile } = await (0, helpers_1.createTestDoctor)(spec.id);
        doctorProfile = profile;
        const { profile: p } = await (0, helpers_1.createTestPatient)();
        patientProfile = p;
    });
    afterAll(async () => {
        await (0, helpers_1.cleanupTestData)();
        await helpers_1.prisma.$disconnect();
    });
    test('Adding leave with no conflicts creates leave record', async () => {
        const result = await leave_service_1.leaveService.addLeave(doctorProfile.id, '2027-02-01', 'Personal leave');
        expect(result.leave).toBeDefined();
        expect(result.affectedAppointmentsCount).toBe(0);
    });
    test('Adding leave notifies affected patients and updates appointment status', async () => {
        const leaveDate = '2027-02-15';
        // Create an appointment on the leave date
        const appointment = await helpers_1.prisma.appointment.create({
            data: {
                doctorId: doctorProfile.id,
                patientId: patientProfile.id,
                appointmentDate: new Date(leaveDate),
                startTime: '10:00',
                endTime: '10:30',
                status: 'CONFIRMED',
            },
        });
        const result = await leave_service_1.leaveService.addLeave(doctorProfile.id, leaveDate, 'Medical conference');
        expect(result.affectedAppointmentsCount).toBe(1);
        expect(result.affectedAppointments[0].id).toBe(appointment.id);
        // Verify appointment status updated to RESCHEDULE_REQUIRED
        const updatedAppointment = await helpers_1.prisma.appointment.findUnique({
            where: { id: appointment.id },
        });
        expect(updatedAppointment?.status).toBe('RESCHEDULE_REQUIRED');
        // Verify email service was called
        const { emailService } = require('../src/services/email.service');
        expect(emailService.queueLeaveConflictEmail).toHaveBeenCalled();
    });
    test('Removing leave restores bookability', async () => {
        const leaveDate = '2027-02-01';
        const result = await leave_service_1.leaveService.removeLeave(doctorProfile.id, leaveDate);
        expect(result.message).toContain('removed');
        // Verify leave no longer exists
        const leave = await helpers_1.prisma.doctorLeave.findUnique({
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
        await leave_service_1.leaveService.addLeave(doctorProfile.id, leaveDate, 'First reason');
        const result = await leave_service_1.leaveService.addLeave(doctorProfile.id, leaveDate, 'Updated reason');
        expect(result.leave).toBeDefined();
        // Verify only one leave record
        const leaves = await helpers_1.prisma.doctorLeave.findMany({
            where: { doctorId: doctorProfile.id, date: new Date(leaveDate) },
        });
        expect(leaves).toHaveLength(1);
        expect(leaves[0].reason).toBe('Updated reason');
    });
});
//# sourceMappingURL=leave.test.js.map