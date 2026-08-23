export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'RESCHEDULE_REQUIRED';

export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Specialization {
  id: string;
  name: string;
  description?: string;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  bio?: string;
  licenseNumber?: string;
  slotDurationMins: number;
  specialization: Specialization;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  workingHours?: WorkingHour[];
}

export interface WorkingHour {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface DoctorLeave {
  id: string;
  date: string;
  reason?: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isHeld: boolean;
}

export interface SymptomSubmission {
  id: string;
  chiefComplaint: string;
  symptoms: string;
  duration?: string;
  severity?: number;
  additionalNotes?: string;
}

export interface PreVisitSummary {
  id: string;
  urgencyLevel?: UrgencyLevel;
  chiefComplaint?: string;
  suggestedQuestions?: string[];
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';
  generatedAt?: string;
  errorMessage?: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Prescription {
  id: string;
  instructions?: string;
  medications: Medication[];
}

export interface PostVisitSummary {
  id: string;
  summary?: string;
  medications?: { name: string; dosage: string; frequency: string; duration: string }[];
  followUpSteps?: string[];
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE';
  generatedAt?: string;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  clinicalNotes: string;
  diagnosis?: string;
  followUpInstructions?: string;
  completedAt?: string;
  prescription?: Prescription;
  postVisitSummary?: PostVisitSummary;
}

export interface Appointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  cancelReason?: string;
  notes?: string;
  doctor: {
    id: string;
    user: { id: string; firstName: string; lastName: string; email: string };
    specialization: Specialization;
  };
  patient: {
    id: string;
    user: { id: string; firstName: string; lastName: string; email: string };
  };
  symptomSubmission?: SymptomSubmission;
  preVisitSummary?: PreVisitSummary;
  consultation?: Consultation;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };
}
