"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.createTestUser = createTestUser;
exports.createTestSpecialization = createTestSpecialization;
exports.createTestDoctor = createTestDoctor;
exports.createTestPatient = createTestPatient;
exports.cleanupTestData = cleanupTestData;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient({
    datasources: {
        db: { url: process.env.DATABASE_URL },
    },
});
exports.prisma = prisma;
async function createTestUser(overrides = {}) {
    const passwordHash = await bcryptjs_1.default.hash('TestPass123!', 10);
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
async function createTestSpecialization(name) {
    return prisma.specialization.create({
        data: { name: name || `Spec-${Date.now()}`, description: 'Test specialization' },
    });
}
async function createTestDoctor(specializationId) {
    const user = await createTestUser({ role: 'DOCTOR' });
    const profile = await prisma.doctorProfile.create({
        data: {
            userId: user.id,
            specializationId,
            slotDurationMins: 30,
        },
    });
    // Add Mon-Fri working hours
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
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
async function createTestPatient() {
    const user = await createTestUser({ role: 'PATIENT' });
    const profile = await prisma.patientProfile.create({
        data: { userId: user.id },
    });
    return { user, profile };
}
async function cleanupTestData() {
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
//# sourceMappingURL=helpers.js.map