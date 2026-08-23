import app from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initializeQueues, startWorkers, gracefulShutdown } from './jobs/queue';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  // Connect to database
  await connectDatabase();

  // Initialize background job queues
  initializeQueues();

  // Start background workers
  startWorkers();

  // Start HTTP server
  const server = app.listen(config.port, () => {
    logger.info(`🏥 Healthcare API running on port ${config.port}`);
    logger.info(`   Environment: ${config.env}`);
    logger.info(`   Frontend URL: ${config.frontendUrl}`);
    logger.info(`   LLM Mode: ${config.llm.apiKey ? 'enabled' : 'mock/fallback'}`);
    logger.info(`   Email Mode: ${config.email.user ? 'SMTP' : 'mock'}`);
    logger.info(`   Calendar: ${config.google.clientId ? 'enabled' : 'disabled'}`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      await gracefulShutdown();
      await disconnectDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
