import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    datasources: {
        db: {
            url: string | undefined;
        };
    };
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export { prisma };
export declare function createTestUser(overrides?: {
    email?: string;
    role?: 'PATIENT' | 'DOCTOR' | 'ADMIN';
    firstName?: string;
    lastName?: string;
}): Promise<{
    id: string;
    email: string;
    passwordHash: string;
    role: import(".prisma/client").$Enums.Role;
    firstName: string;
    lastName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function createTestSpecialization(name?: string): Promise<{
    name: string;
    id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
}>;
export declare function createTestDoctor(specializationId: string): Promise<{
    user: {
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.Role;
        firstName: string;
        lastName: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    profile: {
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        specializationId: string;
        bio: string | null;
        licenseNumber: string | null;
        slotDurationMins: number;
    };
}>;
export declare function createTestPatient(): Promise<{
    user: {
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.Role;
        firstName: string;
        lastName: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
    };
    profile: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        dateOfBirth: Date | null;
        phone: string | null;
        address: string | null;
        bloodGroup: string | null;
        allergies: string | null;
        timezone: string;
    };
}>;
export declare function cleanupTestData(): Promise<void>;
//# sourceMappingURL=helpers.d.ts.map