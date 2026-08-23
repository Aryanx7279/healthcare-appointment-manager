import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';
import { slotService } from '../services/slot.service';
import { prisma } from '../config/database';

// ─── Job Types ────────────────────────────────────────────────────────────────
export type JobName =
  | 'send-email'
  | 'send-medication-reminder'
  | 'send-appointment-reminder'
  | 'cleanup-expired-holds'
  | 'retry-failed-emails';

// ─── Redis Connection ─────────────────────────────────────────────────────────
let redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis | null {
  // If explicitly disabled or running default local redis without daemon, return null for DB fallback
  if (!config.redis.url || process.env.ENABLE_REDIS === 'false') {
    return null;
  }
  try {
    if (!redisConnection) {
      redisConnection = new IORedis(config.redis.url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      });
      redisConnection.on('error', () => {
        redisConnection = null;
      });
    }
    return redisConnection;
  } catch (error) {
    return null;
  }
}

// ─── Queues ───────────────────────────────────────────────────────────────────
let emailQueue: Queue | null = null;
let reminderQueue: Queue | null = null;
let maintenanceQueue: Queue | null = null;

export function initializeQueues(): void {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Running without Redis - background jobs disabled. Use DB polling fallback.');
    return;
  }

  const defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 60000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  };

  emailQueue = new Queue('email', { connection, defaultJobOptions });
  reminderQueue = new Queue('reminders', { connection, defaultJobOptions });
  maintenanceQueue = new Queue('maintenance', { connection, defaultJobOptions });

  logger.info('BullMQ queues initialized');
}

// ─── Workers ──────────────────────────────────────────────────────────────────
let emailWorker: Worker | null = null;
let reminderWorker: Worker | null = null;
let maintenanceWorker: Worker | null = null;

export function startWorkers(): void {
  const connection = getRedisConnection();
  if (!connection) {
    logger.warn('Redis unavailable - starting DB-based job processor instead');
    startDbBasedProcessor();
    return;
  }

  // Email worker
  emailWorker = new Worker(
    'email',
    async (job: Job) => {
      logger.info(`Processing email job: ${job.name} (${job.id})`);
      if (job.name === 'send-email') {
        await emailService.processEmailJob(job.data.emailJobId);
      }
    },
    {
      connection,
      concurrency: 3,
    }
  );

  emailWorker.on('completed', (job) => {
    logger.info(`Email job completed: ${job.id}`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(`Email job failed: ${job?.id}`, { error: err.message });
  });

  // Reminder worker
  reminderWorker = new Worker(
    'reminders',
    async (job: Job) => {
      if (job.name === 'send-medication-reminder') {
        await sendMedicationReminder(job.data.reminderId);
      } else if (job.name === 'send-appointment-reminder') {
        await sendAppointmentReminder(job.data.appointmentId);
      }
    },
    { connection, concurrency: 5 }
  );

  reminderWorker.on('failed', (job, err) => {
    logger.error(`Reminder job failed: ${job?.id}`, { error: err.message });
  });

  // Maintenance worker (recurring)
  maintenanceWorker = new Worker(
    'maintenance',
    async (job: Job) => {
      if (job.name === 'cleanup-expired-holds') {
        const count = await slotService.cleanupExpiredHolds();
        logger.debug(`Cleaned ${count} expired holds`);
      } else if (job.name === 'retry-failed-emails') {
        await retryFailedEmails();
      }
    },
    { connection, concurrency: 1 }
  );

  maintenanceWorker.on('error', (err) => {
    logger.error('Maintenance worker error:', err.message);
  });

  logger.info('BullMQ workers started');

  // Schedule recurring maintenance
  scheduleRecurring();
}

async function scheduleRecurring(): Promise<void> {
  if (!maintenanceQueue) return;

  // Cleanup expired holds every minute
  await maintenanceQueue.add(
    'cleanup-expired-holds',
    {},
    {
      repeat: { every: 60000 }, // Every 60s
      jobId: 'cleanup-holds-recurring',
    } as any
  );

  // Retry failed emails every 5 minutes
  await maintenanceQueue.add(
    'retry-failed-emails',
    {},
    {
      repeat: { every: 5 * 60000 }, // Every 5 min
      jobId: 'retry-emails-recurring',
    } as any
  );

  logger.info('Recurring maintenance jobs scheduled');
}

// ─── Queue Helpers ─────────────────────────────────────────────────────────────
export async function queueEmail(emailJobId: string): Promise<void> {
  if (emailQueue) {
    await emailQueue.add('send-email', { emailJobId }, { jobId: `email-${emailJobId}` });
  }
}

export async function queueMedicationReminder(reminderId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  if (reminderQueue) {
    await reminderQueue.add(
      'send-medication-reminder',
      { reminderId },
      { delay, jobId: `med-reminder-${reminderId}` }
    );
  }
}

export async function queueAppointmentReminder(appointmentId: string, reminderAt: Date): Promise<void> {
  const delay = Math.max(0, reminderAt.getTime() - Date.now());
  if (reminderQueue) {
    await reminderQueue.add(
      'send-appointment-reminder',
      { appointmentId },
      { delay, jobId: `appt-reminder-${appointmentId}` }
    );
  }
}

// ─── Job Handlers ─────────────────────────────────────────────────────────────
async function sendMedicationReminder(reminderId: string): Promise<void> {
  const reminder = await prisma.medicationReminder.findUnique({
    where: { id: reminderId },
    include: {
      medication: true,
      patient: { include: { user: true } },
    },
  });

  if (!reminder || reminder.status !== 'SCHEDULED') return;

  await emailService.sendEmail({
    to: reminder.patient.user.email,
    subject: `Medication Reminder: ${reminder.medication.name}`,
    html: emailService.renderTemplate('medication-reminder', {
      patientName: `${reminder.patient.user.firstName} ${reminder.patient.user.lastName}`,
      medicationName: reminder.medication.name,
      dosage: reminder.medication.dosage,
      instructions: reminder.medication.instructions || 'As prescribed',
    }),
  });

  await prisma.medicationReminder.update({
    where: { id: reminderId },
    data: { status: 'SENT', sentAt: new Date() },
  });
}

async function sendAppointmentReminder(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      doctor: { include: { user: true, specialization: true } },
      patient: { include: { user: true } },
    },
  });

  if (!appointment || appointment.status !== 'CONFIRMED') return;

  await emailService.queueReminderEmail(appointment as any);
}

async function retryFailedEmails(): Promise<void> {
  const pendingJobs = await emailService.getPendingEmailJobs();
  for (const job of pendingJobs) {
    try {
      await emailService.processEmailJob(job.id);
    } catch (error) {
      // Already logged in processEmailJob
    }
  }
}

// ─── DB-based Fallback (when Redis unavailable) ────────────────────────────────
function startDbBasedProcessor(): void {
  // Slot hold cleanup every minute
  setInterval(async () => {
    try {
      await slotService.cleanupExpiredHolds();
    } catch (err) {
      logger.error('DB-based slot cleanup error:', err);
    }
  }, 60000);

  // Email retry every 5 minutes
  setInterval(async () => {
    try {
      await retryFailedEmails();
    } catch (err) {
      logger.error('DB-based email retry error:', err);
    }
  }, 5 * 60000);

  // Medication reminders every minute
  setInterval(async () => {
    try {
      await processDueMedicationReminders();
    } catch (err) {
      logger.error('DB-based medication reminder error:', err);
    }
  }, 60000);

  logger.info('DB-based job processor started (Redis fallback mode)');
}

async function processDueMedicationReminders(): Promise<void> {
  const dueReminders = await prisma.medicationReminder.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: new Date() },
    },
    take: 20,
  });

  for (const reminder of dueReminders) {
    try {
      await sendMedicationReminder(reminder.id);
    } catch (err) {
      await prisma.medicationReminder.update({
        where: { id: reminder.id },
        data: {
          status: 'FAILED',
          attempts: { increment: 1 },
        },
      });
    }
  }
}

export async function gracefulShutdown(): Promise<void> {
  logger.info('Shutting down workers...');
  await emailWorker?.close();
  await reminderWorker?.close();
  await maintenanceWorker?.close();
  await emailQueue?.close();
  await reminderQueue?.close();
  await maintenanceQueue?.close();
  if (redisConnection) {
    await redisConnection.quit();
  }
}
