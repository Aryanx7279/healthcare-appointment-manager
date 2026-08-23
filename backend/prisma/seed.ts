import { PrismaClient, Role, DayOfWeek } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with demo data...');

  // Clean existing data (in order to handle foreign key constraints)
  await prisma.calendarEvent.deleteMany();
  await prisma.calendarConnection.deleteMany();
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
  await prisma.doctorProfile.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.specialization.deleteMany();

  // ─── Specializations ─────────────────────────────────────────────────────────
  console.log('Creating specializations...');
  const specs = await Promise.all([
    prisma.specialization.create({ data: { name: 'General Medicine', description: 'Primary healthcare and general medical conditions' } }),
    prisma.specialization.create({ data: { name: 'Cardiology', description: 'Heart and cardiovascular system' } }),
    prisma.specialization.create({ data: { name: 'Dermatology', description: 'Skin, hair, and nail conditions' } }),
    prisma.specialization.create({ data: { name: 'Orthopedics', description: 'Musculoskeletal conditions and injuries' } }),
    prisma.specialization.create({ data: { name: 'Neurology', description: 'Brain, spinal cord, and nervous system' } }),
    prisma.specialization.create({ data: { name: 'Pediatrics', description: 'Medical care for children' } }),
  ]);

  const [genMed, cardiology, dermatology, ortho, neuro, peds] = specs;

  // ─── Admin User ───────────────────────────────────────────────────────────────
  console.log('Creating admin user...');
  const adminPassword = await bcrypt.hash('Admin123!', 12);
  await prisma.user.create({
    data: {
      email: 'admin@healthcare.app',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      firstName: 'System',
      lastName: 'Admin',
    },
  });

  // ─── Doctors ──────────────────────────────────────────────────────────────────
  console.log('Creating doctors...');
  const doctorPassword = await bcrypt.hash('Doctor123!', 12);

  const doctor1User = await prisma.user.create({
    data: {
      email: 'sarah.mehta@healthcare.app',
      passwordHash: doctorPassword,
      role: Role.DOCTOR,
      firstName: 'Sarah',
      lastName: 'Mehta',
    },
  });

  const doctor1Profile = await prisma.doctorProfile.create({
    data: {
      userId: doctor1User.id,
      specializationId: genMed.id,
      bio: 'Dr. Sarah Mehta is a board-certified General Practitioner with 12 years of experience. She specializes in preventive care and chronic disease management.',
      licenseNumber: 'GM-2014-5892',
      slotDurationMins: 30,
    },
  });

  const doctor2User = await prisma.user.create({
    data: {
      email: 'james.chen@healthcare.app',
      passwordHash: doctorPassword,
      role: Role.DOCTOR,
      firstName: 'James',
      lastName: 'Chen',
    },
  });

  const doctor2Profile = await prisma.doctorProfile.create({
    data: {
      userId: doctor2User.id,
      specializationId: cardiology.id,
      bio: 'Dr. James Chen is an interventional cardiologist with 18 years of experience. He has expertise in cardiac catheterization and heart failure management.',
      licenseNumber: 'CA-2006-1234',
      slotDurationMins: 45,
    },
  });

  const doctor3User = await prisma.user.create({
    data: {
      email: 'priya.patel@healthcare.app',
      passwordHash: doctorPassword,
      role: Role.DOCTOR,
      firstName: 'Priya',
      lastName: 'Patel',
    },
  });

  const doctor3Profile = await prisma.doctorProfile.create({
    data: {
      userId: doctor3User.id,
      specializationId: dermatology.id,
      bio: 'Dr. Priya Patel is a dermatologist specializing in medical and cosmetic dermatology with 8 years of experience.',
      licenseNumber: 'DM-2016-7823',
      slotDurationMins: 20,
    },
  });

  // ─── Working Hours ────────────────────────────────────────────────────────────
  console.log('Setting up working hours...');
  const weekdays: DayOfWeek[] = [
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
  ];

  // Dr. Mehta: Mon-Fri 9AM-5PM with lunch break
  for (const day of weekdays) {
    await prisma.doctorWorkingHour.create({
      data: {
        doctorId: doctor1Profile.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
      },
    });
  }

  // Dr. Chen: Mon, Wed, Fri 8AM-4PM
  for (const day of [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY]) {
    await prisma.doctorWorkingHour.create({
      data: {
        doctorId: doctor2Profile.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '16:00',
        breakStart: '12:00',
        breakEnd: '13:00',
      },
    });
  }

  // Dr. Patel: Tue-Thu, Sat 10AM-6PM
  for (const day of [DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.SATURDAY]) {
    await prisma.doctorWorkingHour.create({
      data: {
        doctorId: doctor3Profile.id,
        dayOfWeek: day,
        startTime: '10:00',
        endTime: '18:00',
        breakStart: '14:00',
        breakEnd: '15:00',
      },
    });
  }

  // ─── Patients ─────────────────────────────────────────────────────────────────
  console.log('Creating patients...');
  const patientPassword = await bcrypt.hash('Patient123!', 12);

  const patient1User = await prisma.user.create({
    data: {
      email: 'john.smith@example.com',
      passwordHash: patientPassword,
      role: Role.PATIENT,
      firstName: 'John',
      lastName: 'Smith',
    },
  });

  const patient1Profile = await prisma.patientProfile.create({
    data: {
      userId: patient1User.id,
      phone: '+1-555-0101',
      dateOfBirth: new Date('1985-03-15'),
      bloodGroup: 'O+',
      allergies: 'Penicillin',
    },
  });

  const patient2User = await prisma.user.create({
    data: {
      email: 'emily.johnson@example.com',
      passwordHash: patientPassword,
      role: Role.PATIENT,
      firstName: 'Emily',
      lastName: 'Johnson',
    },
  });

  const patient2Profile = await prisma.patientProfile.create({
    data: {
      userId: patient2User.id,
      phone: '+1-555-0202',
      dateOfBirth: new Date('1992-07-22'),
      bloodGroup: 'A+',
    },
  });

  const patient3User = await prisma.user.create({
    data: {
      email: 'robert.wilson@example.com',
      passwordHash: patientPassword,
      role: Role.PATIENT,
      firstName: 'Robert',
      lastName: 'Wilson',
    },
  });

  const patient3Profile = await prisma.patientProfile.create({
    data: {
      userId: patient3User.id,
      phone: '+1-555-0303',
      dateOfBirth: new Date('1978-11-08'),
    },
  });

  // ─── Sample Appointments ──────────────────────────────────────────────────────
  console.log('Creating sample appointments...');

  // Past completed appointment with full consultation
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 7);
  const pastDateStr = pastDate.toISOString().split('T')[0];

  const pastAppointment = await prisma.appointment.create({
    data: {
      doctorId: doctor1Profile.id,
      patientId: patient1Profile.id,
      appointmentDate: new Date(pastDateStr),
      startTime: '10:00',
      endTime: '10:30',
      status: 'COMPLETED',
      notes: 'Patient reports persistent headache and fatigue',
    },
  });

  // Add symptoms to past appointment
  const symptomSub = await prisma.symptomSubmission.create({
    data: {
      appointmentId: pastAppointment.id,
      chiefComplaint: 'Persistent headache and fatigue',
      symptoms: 'Headache for 3 days, fatigue, mild nausea, no fever',
      duration: '3 days',
      severity: 5,
    },
  });

  // Add pre-visit summary
  await prisma.preVisitSummary.create({
    data: {
      appointmentId: pastAppointment.id,
      urgencyLevel: 'LOW',
      chiefComplaint: 'Patient experiencing mild headache and fatigue for 3 days without fever or other acute symptoms.',
      suggestedQuestions: [
        'Have you experienced similar headaches before, and if so, what helped them resolve?',
        'Are you currently under any unusual stress or have you had significant changes in sleep patterns?',
        'Are you staying adequately hydrated and have you noticed any vision changes along with the headache?',
      ],
      status: 'COMPLETED',
      generatedAt: new Date(),
    },
  });

  // Add consultation
  const consultation = await prisma.consultation.create({
    data: {
      appointmentId: pastAppointment.id,
      clinicalNotes: 'Patient presents with tension-type headache and fatigue. BP 120/80, HR 72. No neurological deficits. Likely related to dehydration and stress. Advised rest, increased fluid intake.',
      diagnosis: 'Tension headache, fatigue secondary to dehydration',
      followUpInstructions: 'Follow up in 2 weeks if symptoms persist. Return immediately if headache worsens or develops fever.',
      completedAt: new Date(),
    },
  });

  const prescription = await prisma.prescription.create({
    data: {
      consultationId: consultation.id,
      instructions: 'Take medications as directed. Drink at least 8 glasses of water daily.',
    },
  });

  const medication = await prisma.medication.create({
    data: {
      prescriptionId: prescription.id,
      name: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'twice daily',
      duration: '5 days',
      instructions: 'Take with food. Do not exceed 3 doses in 24 hours.',
    },
  });

  // Post-visit summary
  await prisma.postVisitSummary.create({
    data: {
      consultationId: consultation.id,
      summary: 'You were seen for a tension headache and tiredness likely caused by not drinking enough water and stress. Your blood pressure and heart rate are normal. There are no signs of any serious conditions.',
      medications: [
        { name: 'Ibuprofen', dosage: '400mg', frequency: 'Twice daily', duration: '5 days' },
      ],
      followUpSteps: [
        'Drink at least 8 glasses of water every day',
        'Get 7-8 hours of sleep per night',
        'Practice stress reduction techniques such as deep breathing or gentle exercise',
        'Book a follow-up appointment in 2 weeks if symptoms continue',
        'Go to the emergency room immediately if your headache suddenly becomes very severe',
      ],
      status: 'COMPLETED',
      generatedAt: new Date(),
    },
  });

  // Upcoming confirmed appointment
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);
  // Make sure it's a weekday
  while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
    futureDate.setDate(futureDate.getDate() + 1);
  }
  const futureDateStr = futureDate.toISOString().split('T')[0];

  await prisma.appointment.create({
    data: {
      doctorId: doctor1Profile.id,
      patientId: patient2Profile.id,
      appointmentDate: new Date(futureDateStr),
      startTime: '11:00',
      endTime: '11:30',
      status: 'CONFIRMED',
    },
  });

  // Another upcoming appointment
  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 5);
  while (futureDate2.getDay() === 0 || futureDate2.getDay() === 6) {
    futureDate2.setDate(futureDate2.getDate() + 1);
  }
  const futureDateStr2 = futureDate2.toISOString().split('T')[0];

  await prisma.appointment.create({
    data: {
      doctorId: doctor2Profile.id,
      patientId: patient3Profile.id,
      appointmentDate: new Date(futureDateStr2),
      startTime: '09:00',
      endTime: '09:45',
      status: 'CONFIRMED',
    },
  });

  console.log('\n✅ Database seeded successfully!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('  DEMO CREDENTIALS');
  console.log('═══════════════════════════════════════════════');
  console.log('  Admin:');
  console.log('    Email: admin@healthcare.app');
  console.log('    Password: Admin123!');
  console.log('');
  console.log('  Doctors:');
  console.log('    Email: sarah.mehta@healthcare.app');
  console.log('    Password: Doctor123!');
  console.log('');
  console.log('    Email: james.chen@healthcare.app');
  console.log('    Password: Doctor123!');
  console.log('');
  console.log('  Patients:');
  console.log('    Email: john.smith@example.com');
  console.log('    Password: Patient123!');
  console.log('');
  console.log('    Email: emily.johnson@example.com');
  console.log('    Password: Patient123!');
  console.log('═══════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
