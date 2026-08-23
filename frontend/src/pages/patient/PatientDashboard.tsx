import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../store/auth';
import { appointmentsApi, notificationsApi } from '../../api';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { Calendar, Search, CheckCircle, AlertTriangle, ChevronRight, Bell, Clock, ArrowUpRight, Heart } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const getDateLabel = (dateStr: string) => {
  const d = parseISO(dateStr);
  if (isToday(d))    return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
};

export function PatientDashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['patient-appointments'],
    queryFn: () => appointmentsApi.list().then((r) => r.data.data),
  });
  const { data: notifData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then((r) => r.data.data),
  });

  const upcoming = appointments?.filter((a: any) =>
    ['CONFIRMED','PENDING','RESCHEDULE_REQUIRED'].includes(a.status) && new Date(a.appointmentDate) >= new Date()
  ).slice(0, 5) || [];

  const needsAction = appointments?.filter((a: any) => a.status === 'RESCHEDULE_REQUIRED') || [];
  const completed   = appointments?.filter((a: any) => a.status === 'COMPLETED').length || 0;
  const nextAppt    = upcoming[0];

  const stats = [
    { label: 'Completed Visits', value: completed,             color: '#059669', bg: 'var(--success-light)', icon: <CheckCircle className="w-5 h-5" /> },
    { label: 'Upcoming',         value: upcoming.length,        color: '#2563EB', bg: 'var(--primary-light)', icon: <Calendar className="w-5 h-5" /> },
    { label: 'Notifications',    value: notifData?.count || 0,  color: '#7C3AED', bg: 'var(--purple-light)',  icon: <Bell className="w-5 h-5" /> },
    { label: 'Action Required',  value: needsAction.length,     color: '#D97706', bg: 'var(--warning-light)', icon: <AlertTriangle className="w-5 h-5" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Welcome banner ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 50%, #0891B2 100%)', boxShadow: 'var(--shadow-blue-lg)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-blue-100 text-sm font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {format(new Date(), 'EEEE, MMMM d')}
            </p>
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {greeting()}, {user?.firstName}
            </h1>
            <p className="text-blue-100/80 text-sm">
              {upcoming.length > 0
                ? `You have ${upcoming.length} upcoming appointment${upcoming.length > 1 ? 's' : ''}.`
                : 'No upcoming appointments. Book one today!'}
            </p>
          </div>
          <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center bg-white/15 flex-shrink-0">
            <Heart className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* ── Action required ──────────────────────────────────────────────────── */}
      {needsAction.length > 0 && (
        <div className="card p-4 flex items-start gap-3"
          style={{ borderLeft: '4px solid var(--warning)', background: 'var(--warning-light)' }}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: '#92400E' }}>Action Required</p>
            <p className="text-sm mt-0.5" style={{ color: '#B45309' }}>
              {needsAction.length} appointment{needsAction.length > 1 ? 's' : ''} need{needsAction.length === 1 ? 's' : ''} rescheduling due to doctor leave.
            </p>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--warning)', color: '#fff' }}
            onClick={() => navigate('/patient/appointments')}>
            View
          </button>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
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

      {/* ── Two column: Next appointment + Quick actions ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Next appointment */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
            Next Appointment
          </p>
          {nextAppt ? (
            <div className="cursor-pointer" onClick={() => navigate(`/patient/appointments/${nextAppt.id}`)}>
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-center flex-shrink-0"
                  style={{ background: 'var(--primary-light)' }}>
                  <p className="text-xs font-bold" style={{ color: 'var(--primary)', lineHeight: 1 }}>
                    {format(parseISO(nextAppt.appointmentDate), 'MMM').toUpperCase()}
                  </p>
                  <p className="text-lg font-bold" style={{ color: 'var(--primary)', lineHeight: 1 }}>
                    {format(parseISO(nextAppt.appointmentDate), 'd')}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                    Dr. {nextAppt.doctor.user.firstName} {nextAppt.doctor.user.lastName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>{nextAppt.doctor.specialization.name}</p>
                </div>
                <StatusBadge status={nextAppt.status} />
              </div>
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-3)' }}>
                <Clock className="w-3.5 h-3.5" />
                <span>{getDateLabel(nextAppt.appointmentDate)} · {nextAppt.startTime} – {nextAppt.endTime}</span>
              </div>
              <button className="btn btn-secondary w-full mt-4 text-sm">
                View Details <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--primary-mid)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>No upcoming appointments</p>
              <button className="btn btn-primary btn-sm mt-4" onClick={() => navigate('/patient/doctors')}>
                <Search className="w-3.5 h-3.5" /> Find a Doctor
              </button>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
            Quick Actions
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Find a Doctor',     desc: 'Search by specialization', icon: <Search className="w-4 h-4" />,   href: '/patient/doctors',       color: '#2563EB', bg: 'var(--primary-light)' },
              { label: 'Book Appointment',  desc: 'Reserve your next slot',    icon: <Calendar className="w-4 h-4" />,  href: '/patient/doctors',       color: '#059669', bg: 'var(--success-light)' },
              { label: 'My Appointments',   desc: 'View and manage visits',    icon: <Clock className="w-4 h-4" />,    href: '/patient/appointments',  color: '#7C3AED', bg: 'var(--purple-light)' },
            ].map((a) => (
              <button key={a.label} onClick={() => navigate(a.href)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150 text-left group"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-mid)'; (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: a.bg, color: a.color }}>{a.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>{a.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.desc}</p>
                </div>
                <ArrowUpRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Upcoming appointments list ──────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            <h2 className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>Upcoming Appointments</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/patient/appointments')}>
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center"><LoadingSpinner /></div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No upcoming appointments"
            description="Find a doctor and book your next visit"
            action={<Button onClick={() => navigate('/patient/doctors')}><Search className="w-4 h-4" /> Find a Doctor</Button>}
          />
        ) : (
          <div>
            {upcoming.map((appt: any, idx: number) => (
              <div key={appt.id}
                className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors"
                style={{ borderBottom: idx < upcoming.length - 1 ? '1px solid var(--border)' : 'none' }}
                onClick={() => navigate(`/patient/appointments/${appt.id}`)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div className="w-11 h-11 rounded-xl flex flex-col items-center justify-center text-center flex-shrink-0"
                  style={{ background: 'var(--primary-light)' }}>
                  <p className="text-xs font-bold leading-none" style={{ color: 'var(--primary)' }}>
                    {format(parseISO(appt.appointmentDate), 'MMM').toUpperCase()}
                  </p>
                  <p className="text-base font-bold leading-tight" style={{ color: 'var(--primary)' }}>
                    {format(parseISO(appt.appointmentDate), 'd')}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                    Dr. {appt.doctor.user.firstName} {appt.doctor.user.lastName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {getDateLabel(appt.appointmentDate)} · {appt.startTime} – {appt.endTime} · {appt.doctor.specialization.name}
                  </p>
                </div>
                <StatusBadge status={appt.status} />
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
