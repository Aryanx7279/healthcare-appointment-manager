import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const doctors = await prisma.doctorProfile.findMany({
    include: {
      user: true,
      workingHours: true,
    }
  });

  console.log(`Found ${doctors.length} doctors.`);
  for (const doc of doctors) {
    console.log(`Dr. ${doc.user.firstName} ${doc.user.lastName} (ID: ${doc.id})`);
    console.log(`Working hours count: ${doc.workingHours.length}`);
    for (const wh of doc.workingHours) {
      console.log(`  - ${wh.dayOfWeek}: ${wh.startTime} - ${wh.endTime} (Active: ${wh.isActive})`);
    }
  }

  const appointments = await prisma.appointment.findMany();
  console.log(`Found ${appointments.length} appointments.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
