import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../store/auth';
import { appointmentsApi } from '../../api';
import { StatusBadge, UrgencyBadge } from '../../components/ui/Badge';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { format, isToday, parseISO } from 'date-fns';
import { Calendar, Clock, CheckCircle, AlertTriangle, ChevronRight, Stethoscope, Users, Activity } from 'lucide-react';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

export function DoctorDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['doctor-appointments'],
    queryFn: () => appointmentsApi.list().then((r) => r.data.data),
  });

  const todayAppts    = appointments?.filter((a: any) => isToday(parseISO(a.appointmentDate)) && !['CANCELLED','EXPIRED'].includes(a.status)) || [];
  const upcomingAppts = appointments?.filter((a: any) => !isToday(parseISO(a.appointmentDate)) && parseISO(a.appointmentDate) > new Date() && !['CANCELLED','EXPIRED'].includes(a.status)) || [];
  const completedCount = appointments?.filter((a: any) => a.status === 'COMPLETED').length || 0;
  const urgentPatients = appointments?.filter((a: any) => a.preVisitSummary?.urgencyLevel === 'HIGH' && a.status === 'CONFIRMED') || [];

  const stats = [
    { label: "Today's Schedule", value: todayAppts.length,    color: '#059669', bg: 'var(--success-light)', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Upcoming',         value: upcomingAppts.length, color: '#2563EB', bg: 'var(--primary-light)', icon: <Clock className="w-5 h-5" /> },
    { label: 'Completed',        value: completedCount,       color: '#7C3AED', bg: 'var(--purple-light)',  icon: <CheckCircle className="w-5 h-5" /> },
    { label: 'High Urgency',     value: urgentPatients.length, color: '#DC2626', bg: 'var(--danger-light)', icon: <AlertTriangle className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Welcome banner */}
      <div className="rounded-2xl p-6 overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #0891B2 100%)', boxShadow: '0 4px 20px rgba(5,150,105,0.3)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-green-100 text-sm font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {greeting()}, Dr. {user?.lastName}
            </h1>
            <p className="text-green-100/80 text-sm">
              {todayAppts.length > 0
                ? `${todayAppts.length} patient${todayAppts.length > 1 ? 's' : ''} scheduled today`
                : 'No appointments scheduled for today'}
            </p>
          </div>
          <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center bg-white/15 flex-shrink-0">
            <Stethoscope className="w-6 h-6 text-white" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* High urgency alert */}
      {urgentPatients.length > 0 && (
        <div className="card p-4 flex items-start gap-3"
          style={{ borderLeft: '4px solid var(--danger)', background: 'var(--danger-light)' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#7F1D1D' }}>High Urgency Patients</p>
            <p className="text-sm mt-0.5" style={{ color: '#B91C1C' }}>
              {urgentPatients.length} patient{urgentPatients.length > 1 ? 's' : ''} with HIGH urgency symptoms require attention.
            </p>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--danger)', color: '#fff' }}
            onClick={() => navigate('/doctor/appointments')}>
            Review
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: '#059669' }} />
            <h2 className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Today's Schedule</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/doctor/appointments')}>
            All appointments <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><LoadingSpinner /></div>
        ) : todayAppts.length === 0 ? (
          <EmptyState icon={<Calendar className="w-6 h-6" />} title="No appointments today" description="Enjoy a free day or manage your schedule" />
        ) : (
          <div>
            {[...todayAppts].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)).map((appt: any, idx: number) => (
              <div key={appt.id}
                className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors"
                style={{ borderBottom: idx < todayAppts.length - 1 ? '1px solid var(--border)' : 'none' }}
                onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--success-light)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                {/* Time */}
                <div className="flex-shrink-0 text-center w-14">
                  <p className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>{appt.startTime}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{appt.endTime}</p>
                </div>

                <div className="w-px h-8 rounded flex-shrink-0" style={{ background: '#059669' }} />

                {/* Patient */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #059669, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
                  {appt.patient.user.firstName[0]}{appt.patient.user.lastName[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                    {appt.patient.user.firstName} {appt.patient.user.lastName}
                  </p>
                  {appt.symptomSubmission && (
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {appt.symptomSubmission.chiefComplaint}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {appt.preVisitSummary?.urgencyLevel && <UrgencyBadge urgency={appt.preVisitSummary.urgencyLevel} />}
                  <StatusBadge status={appt.status} />
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingAppts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <h2 className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Upcoming Appointments</h2>
            </div>
          </div>
          <div>
            {upcomingAppts.slice(0, 5).map((appt: any, idx: number) => (
              <div key={appt.id}
                className="flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-colors"
                style={{ borderBottom: idx < Math.min(upcomingAppts.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}
                onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0"
                  style={{ background: 'var(--primary-light)' }}>
                  <p className="text-xs font-bold leading-none" style={{ color: 'var(--primary)' }}>
                    {format(parseISO(appt.appointmentDate), 'MMM').toUpperCase()}
                  </p>
                  <p className="text-sm font-bold leading-tight" style={{ color: 'var(--primary)' }}>
                    {format(parseISO(appt.appointmentDate), 'd')}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                    {appt.patient.user.firstName} {appt.patient.user.lastName}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>{appt.startTime} – {appt.endTime}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {appt.preVisitSummary?.urgencyLevel && <UrgencyBadge urgency={appt.preVisitSummary.urgencyLevel} />}
                  <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
