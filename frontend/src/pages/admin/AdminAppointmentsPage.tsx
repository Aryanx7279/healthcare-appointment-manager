import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { StatusBadge } from '../../components/ui/Badge';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { Calendar, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function AdminAppointmentsPage() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appointments', statusFilter],
    queryFn: () =>
      adminApi.getAppointments({ status: statusFilter || undefined }).then((r) => r.data.data),
  });

  const appointments = data || [];

  const statuses = [
    { value: '', label: 'All' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'RESCHEDULE_REQUIRED', label: 'Action Required' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">All Appointments</h1>
        <p className="page-subtitle">Platform-wide appointment overview</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s.value
                ? 'gradient-primary text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-purple-300'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : appointments.length === 0 ? (
          <EmptyState icon={<Calendar className="w-8 h-8" />} title="No appointments found" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Date & Time</th>
                <th>Specialization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a: any) => (
                <tr key={a.id}>
                  <td className="font-medium">
                    {a.patient.user.firstName} {a.patient.user.lastName}
                  </td>
                  <td>
                    Dr. {a.doctor.user.firstName} {a.doctor.user.lastName}
                  </td>
                  <td className="text-slate-600">
                    {format(parseISO(a.appointmentDate), 'MMM d, yyyy')} · {a.startTime}
                  </td>
                  <td className="text-slate-500">{a.doctor.specialization?.name}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
