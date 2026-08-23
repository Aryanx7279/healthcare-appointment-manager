import React from 'react';
import { AppointmentStatus, UrgencyLevel } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange' | 'teal';
  className?: string;
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}

/* ── Status badge ─────────────────────────────────────────────────────────── */
const statusConfig: Record<AppointmentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  CONFIRMED:           { label: 'Confirmed',       variant: 'green'  },
  PENDING:             { label: 'Pending',          variant: 'yellow' },
  CANCELLED:           { label: 'Cancelled',        variant: 'red'    },
  RESCHEDULED:         { label: 'Rescheduled',      variant: 'purple' },
  COMPLETED:           { label: 'Completed',        variant: 'blue'   },
  EXPIRED:             { label: 'Expired',          variant: 'gray'   },
  RESCHEDULE_REQUIRED: { label: 'Action Required',  variant: 'orange' },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = statusConfig[status] ?? { label: status, variant: 'gray' as const };
  return (
    <span className={`badge badge-${cfg.variant}`}>
      <span className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: 'currentColor', opacity: 0.7 }} />
      {cfg.label}
    </span>
  );
}

/* ── Urgency badge ────────────────────────────────────────────────────────── */
const urgencyConfig: Record<UrgencyLevel, { label: string; variant: BadgeProps['variant'] }> = {
  LOW:    { label: 'Low Urgency',    variant: 'green'  },
  MEDIUM: { label: 'Medium Urgency', variant: 'yellow' },
  HIGH:   { label: 'High Urgency',   variant: 'red'    },
};

export function UrgencyBadge({ urgency }: { urgency: UrgencyLevel }) {
  const cfg = urgencyConfig[urgency];
  return (
    <span className={`badge badge-${cfg.variant}`}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'currentColor', opacity: 0.7 }} />
      {cfg.label}
    </span>
  );
}
