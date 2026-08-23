import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../api';
import { LoadingSpinner } from '../../components/ui/Alert';
import { Users, Stethoscope, Calendar, Mail, TrendingUp, ChevronRight, Shield, Settings, Activity } from 'lucide-react';

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data.data),
    refetchInterval: 30000,
  });

  const kpiCards = [
    { label: 'Total Doctors',        value: stats?.totalDoctors      || 0, icon: <Stethoscope className="w-5 h-5" />, color: '#059669', bg: 'var(--success-light)', href: '/admin/doctors' },
    { label: 'Total Patients',       value: stats?.totalPatients     || 0, icon: <Users className="w-5 h-5" />,       color: '#2563EB', bg: 'var(--primary-light)', href: '/admin/patients' },
    { label: "Today's Appointments", value: stats?.todayAppointments || 0, icon: <Calendar className="w-5 h-5" />,    color: '#7C3AED', bg: 'var(--purple-light)',  href: '/admin/appointments' },
    { label: 'Total Appointments',   value: stats?.totalAppointments || 0, icon: <TrendingUp className="w-5 h-5" />,  color: '#0891B2', bg: 'var(--accent-light)',  href: '/admin/appointments' },
    { label: 'Pending Email Jobs',   value: stats?.pendingJobs       || 0, icon: <Mail className="w-5 h-5" />,        color: '#D97706', bg: 'var(--warning-light)', href: '/admin/system' },
  ];

  const quickActions = [
    { label: 'Manage Doctors',    href: '/admin/doctors',         icon: <Stethoscope className="w-4 h-4" /> },
    { label: 'Manage Patients',   href: '/admin/patients',        icon: <Users className="w-4 h-4" /> },
    { label: 'Specializations',   href: '/admin/specializations', icon: <Activity className="w-4 h-4" /> },
    { label: 'System Status',     href: '/admin/system',          icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Banner */}
      <div className="rounded-2xl p-6 overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #4F46E5 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-purple-200 text-sm font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Admin Console</p>
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Platform Overview</h1>
            <p className="text-purple-100/80 text-sm">Monitor and manage your CareFlow platform</p>
          </div>
          <div className="hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center bg-white/15 flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiCards.map((c, i) => (
              <button key={c.label}
                onClick={() => navigate(c.href)}
                className="card p-5 text-left flex items-center gap-4 group transition-all duration-200 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-mid)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: c.bg, color: c.color }}>
                  {c.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                    {c.value.toLocaleString()}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
              Quick Actions
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickActions.map(a => (
                <button key={a.label}
                  onClick={() => navigate(a.href)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150"
                  style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', color: 'var(--text-2)', fontFamily: 'Manrope, sans-serif' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--purple-light)'; (e.currentTarget as HTMLElement).style.borderColor = '#C4B5FD'; (e.currentTarget as HTMLElement).style.color = '#7C3AED'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}>
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
