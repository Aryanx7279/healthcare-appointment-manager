import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../api';
import { StatusBadge, UrgencyBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { Calendar, ChevronRight, Filter } from 'lucide-react';

export function DoctorAppointmentsPage() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['doctor-appointments', dateFilter],
    queryFn: () =>
      appointmentsApi.list({ date: dateFilter || undefined }).then((r) => r.data.data),
  });

  const appointments = data || [];

  const getDateLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
  };

  // Group by date
  const grouped = appointments.reduce((acc: Record<string, any[]>, appt: any) => {
    const date = format(parseISO(appt.appointmentDate), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(appt);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">View and manage your patient consultations</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-auto"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date"
          />
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter('')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12"><LoadingSpinner size="lg" /></div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8" />}
          title="No appointments found"
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, appts]) => (
            <div key={date}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
                {getDateLabel(date)}
                <span className="ml-2 normal-case font-medium" style={{ color: 'var(--text-3)' }}>
                  {(appts as any[]).length} appointment{(appts as any[]).length > 1 ? 's' : ''}
                </span>
              </h3>
              <div className="space-y-2">
                {(appts as any[])
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((appt: any) => (
                  <div
                    key={appt.id}
                    className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all duration-200"
                    onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                  >
                    <div className="flex-shrink-0 text-center rounded-xl px-3 py-2 min-w-[70px]" style={{ background: 'var(--success-light)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--success)', fontFamily: 'Manrope, sans-serif' }}>{appt.startTime}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{appt.endTime}</p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                        {appt.patient.user.firstName} {appt.patient.user.lastName}
                      </p>
                      {appt.symptomSubmission && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {appt.symptomSubmission.chiefComplaint}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {appt.preVisitSummary?.urgencyLevel && (
                        <UrgencyBadge urgency={appt.preVisitSummary.urgencyLevel} />
                      )}
                      <StatusBadge status={appt.status} />
                      <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
