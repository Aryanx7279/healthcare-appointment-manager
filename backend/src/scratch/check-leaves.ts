import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const leaves = await prisma.doctorLeave.findMany();
  console.log(`Found ${leaves.length} leave records:`);
  for (const leave of leaves) {
    console.log(`Doctor: ${leave.doctorId}, Date: ${leave.date.toISOString()}, Reason: ${leave.reason}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
