import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  dateOfBirth?: string;
  specializationId?: string;
  bio?: string;
  licenseNumber?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface UserPayload {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export class AuthService {
  private generateTokens(user: UserPayload): AuthTokens {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
      { id: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  async register(input: RegisterInput): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      if (input.role === Role.PATIENT) {
        await tx.patientProfile.create({
          data: {
            userId: newUser.id,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          },
        });
      } else if (input.role === Role.DOCTOR) {
        if (!input.specializationId) {
          throw new AppError('Specialization is required for doctors', 400, 'MISSING_SPECIALIZATION');
        }
        await tx.doctorProfile.create({
          data: {
            userId: newUser.id,
            specializationId: input.specializationId,
            bio: input.bio,
            licenseNumber: input.licenseNumber,
          },
        });
      }

      return newUser;
    });

    logger.info(`New user registered: ${user.email} (${user.role})`);

    const tokens = this.generateTokens(user);
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return { user: userPayload, tokens };
  }

  async login(email: string, password: string): Promise<{ user: UserPayload; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    logger.info(`User logged in: ${user.email} (${user.role})`);

    const tokens = this.generateTokens(user);
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return { user: userPayload, tokens };
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret) as { id: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user || !user.isActive) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');
      }

      return this.generateTokens(user);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401, 'INVALID_TOKEN');
    }
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        patientProfile: true,
        doctorProfile: {
          include: {
            specialization: true,
            workingHours: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Never return password hash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, data: Partial<RegisterInput> & {
    bloodGroup?: string;
    allergies?: string;
    address?: string;
  }) {
    // Get current user to know their role
    const currentUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!currentUser) throw new AppError('User not found', 404, 'NOT_FOUND');

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName  !== undefined && { lastName:  data.lastName  }),
      },
    });

    // Always upsert the patient profile with all available fields
    if (currentUser.role === Role.PATIENT) {
      await prisma.patientProfile.upsert({
        where: { userId },
        create: {
          userId,
          phone:       data.phone       ?? null,
          bloodGroup:  data.bloodGroup  ?? null,
          allergies:   data.allergies   ?? null,
          address:     data.address     ?? null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        },
        update: {
          ...(data.phone       !== undefined && { phone:       data.phone       ?? null }),
          ...(data.bloodGroup  !== undefined && { bloodGroup:  data.bloodGroup  ?? null }),
          ...(data.allergies   !== undefined && { allergies:   data.allergies   ?? null }),
          ...(data.address     !== undefined && { address:     data.address     ?? null }),
          ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
        },
      });
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }
}

export const authService = new AuthService();
