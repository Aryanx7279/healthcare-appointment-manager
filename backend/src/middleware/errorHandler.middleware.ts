import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { validationResult } from 'express-validator';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Validation errors from express-validator
  if (err.name === 'ValidationError') {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Prisma unique constraint violation (double booking)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ');
      logger.warn(`Unique constraint violation on: ${fields}`, {
        path: req.path,
        method: req.method,
      });
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message:
            fields?.includes('startTime')
              ? 'Sorry, this slot was just booked by another patient. Please select a different time.'
              : 'A conflict occurred. Please try again.',
        },
      });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
        },
      });
      return;
    }
  }

  // Application errors
  if (err instanceof AppError) {
    logger.warn(`AppError: ${err.message}`, {
      code: err.errorCode,
      statusCode: err.statusCode,
      path: req.path,
    });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
      },
    });
    return;
  }

  // Unexpected errors - log fully but don't expose internals
  logger.error('Unexpected error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
}

// Middleware to handle express-validator results
export function validateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array(),
      },
    });
    return;
  }
  next();
}
