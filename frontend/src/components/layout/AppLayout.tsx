import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { AIChatWidget } from '../ai/AIChatWidget';
import {
  LayoutDashboard, Calendar, Users, Search, Stethoscope, Settings,
  Bell, LogOut, Menu, X, ClipboardList, UserCog, Activity, Pill,
  Shield, ChevronRight, Heart
} from 'lucide-react';

interface NavItem { label: string; href: string; icon: React.ReactNode; end?: boolean; }

const patientNav: NavItem[] = [
  { label: 'Dashboard',       href: '/patient',              icon: <LayoutDashboard className="w-4 h-4" />, end: true },
  { label: 'Find Doctors',    href: '/patient/doctors',      icon: <Search className="w-4 h-4" /> },
  { label: 'My Appointments', href: '/patient/appointments', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Medications',     href: '/patient/medications',  icon: <Pill className="w-4 h-4" /> },
  { label: 'Profile',         href: '/patient/profile',      icon: <UserCog className="w-4 h-4" /> },
];

const doctorNav: NavItem[] = [
  { label: 'Dashboard',        href: '/doctor',              icon: <LayoutDashboard className="w-4 h-4" />, end: true },
  { label: 'Appointments',     href: '/doctor/appointments', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Schedule & Hours', href: '/doctor/schedule',     icon: <ClipboardList className="w-4 h-4" /> },
  { label: 'Leave Management', href: '/doctor/leave',        icon: <Activity className="w-4 h-4" /> },
  { label: 'Profile',          href: '/doctor/profile',      icon: <UserCog className="w-4 h-4" /> },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard',       href: '/admin',                 icon: <LayoutDashboard className="w-4 h-4" />, end: true },
  { label: 'Doctors',         href: '/admin/doctors',         icon: <Stethoscope className="w-4 h-4" /> },
  { label: 'Patients',        href: '/admin/patients',        icon: <Users className="w-4 h-4" /> },
  { label: 'Appointments',    href: '/admin/appointments',    icon: <Calendar className="w-4 h-4" /> },
  { label: 'Specializations', href: '/admin/specializations', icon: <Shield className="w-4 h-4" /> },
  { label: 'System',          href: '/admin/system',          icon: <Settings className="w-4 h-4" /> },
  { label: 'Profile',         href: '/admin/profile',         icon: <UserCog className="w-4 h-4" /> },
];

const ROLE_META = {
  PATIENT: { label: 'Patient Portal',  color: '#2563EB', navItems: patientNav },
  DOCTOR:  { label: 'Doctor Portal',   color: '#059669', navItems: doctorNav  },
  ADMIN:   { label: 'Admin Console',   color: '#7C3AED', navItems: adminNav   },
} as const;

/* ── Avatar with initials ─────────────────────────────────────────────────── */
function Avatar({ firstName = '', lastName = '', size = 36, color = '#2563EB' }: { firstName?: string; lastName?: string; size?: number; color?: string }) {
  return (
    <div className="flex items-center justify-center rounded-full font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, #0891B2)`, fontSize: size * 0.35, fontFamily: 'Manrope, sans-serif' }}>
      {firstName[0]}{lastName[0]}
    </div>
  );
}

/* ── Sidebar NavItem ──────────────────────────────────────────────────────── */
function SideNavLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <NavLink
      to={item.href}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
    >
      {item.icon}
      <span className="flex-1">{item.label}</span>
    </NavLink>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = (user?.role ?? 'PATIENT') as keyof typeof ROLE_META;
  const meta = ROLE_META[role];

  /* Derive page title from path — skip UUID-like segments */
  const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  const segments = location.pathname.split('/').filter(Boolean);
  // Walk backwards to find the first non-UUID, non-numeric segment
  const meaningfulSeg = [...segments].reverse().find(s => !UUID_RE.test(s) && !/^\d+$/.test(s)) ?? segments[0] ?? '';
  // Map known segments to friendly names
  const SEG_LABELS: Record<string, string> = {
    patient: 'Dashboard', doctor: 'Dashboard', admin: 'Dashboard',
    doctors: 'Find Doctors', medications: 'Medications', profile: 'Profile',
    appointments: 'Appointments', schedule: 'Schedule & Hours', leave: 'Leave Management',
    specializations: 'Specializations', system: 'System', notifications: 'Notifications',
    book: 'Book Appointment',
  };
  const pageTitle = (SEG_LABELS[meaningfulSeg] ?? meaningfulSeg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`
        fixed top-0 left-0 h-full flex flex-col z-30 w-60
        transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

        {/* Brand */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            {/* CareFlow logo */}
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.color}, #0891B2)` }}>
              <Heart className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-sm leading-none" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                CareFlow
              </p>
              <p className="text-xs mt-0.5" style={{ color: meta.color, fontFamily: 'Manrope, sans-serif' }}>
                {meta.label}
              </p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: 'var(--surface-2)' }}>
            <Avatar firstName={user?.firstName} lastName={user?.lastName} color={meta.color} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate leading-tight" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                {role === 'DOCTOR' ? 'Dr. ' : ''}{user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-thin space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest px-3 mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
            Navigation
          </p>
          {meta.navItems.map((item) => (
            <SideNavLink key={item.href} item={item} onClose={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={logout}
            className="nav-item w-full"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-light)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top header */}
        <header className="flex items-center gap-4 px-4 lg:px-6 py-3.5 flex-shrink-0"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>

          {/* Mobile hamburger */}
          <button className="lg:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="flex-1">
            <h1 className="text-base font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
              {pageTitle}
            </h1>
          </div>

          {/* Notifications */}
          <button
            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
            onClick={() => navigate(role === 'PATIENT' ? '/patient/notifications' : role === 'DOCTOR' ? '/doctor/notifications' : '/admin/system')}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-mid)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Avatar — click to open profile */}
          <button
            onClick={() => navigate(
              role === 'PATIENT' ? '/patient/profile' :
              role === 'DOCTOR'  ? '/doctor/profile'  : '/admin/profile'
            )}
            className="rounded-full transition-all duration-150 focus:outline-none"
            title="View Profile"
            style={{ outline: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px var(--primary-mid)`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <Avatar firstName={user?.firstName} lastName={user?.lastName} size={36} color={meta.color} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 scrollbar-thin">
          {children}
        </main>
      </div>

      {/* AI Assistant — floats on every authenticated page */}
      <AIChatWidget />
    </div>
  );
}
