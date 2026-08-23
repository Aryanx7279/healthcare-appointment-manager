import React from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, X } from 'lucide-react';

/* ── Alert ──────────────────────────────────────────────────────────────────── */
interface AlertProps {
  type?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const ALERT_CFG = {
  info:    { bg: 'var(--primary-light)',  border: 'var(--primary-mid)',  color: 'var(--primary)',  icon: <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> },
  success: { bg: 'var(--success-light)',  border: '#A7F3D0',             color: 'var(--success)',  icon: <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> },
  warning: { bg: 'var(--warning-light)',  border: '#FDE68A',             color: 'var(--warning)',  icon: <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> },
  error:   { bg: 'var(--danger-light)',   border: '#FECACA',             color: 'var(--danger)',   icon: <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> },
};

export function Alert({ type = 'info', title, children, className = '' }: AlertProps) {
  const cfg = ALERT_CFG[type];
  return (
    <div className={`flex gap-3 p-4 rounded-xl text-sm ${className}`}
      style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.icon}
      <div>
        {title && <p className="font-semibold mb-0.5" style={{ fontFamily: 'Manrope, sans-serif' }}>{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────────────────── */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      {icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
          {icon}
        </div>
      )}
      <h3 className="text-base font-bold mb-1.5" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>{title}</h3>
      {description && <p className="text-sm max-w-xs" style={{ color: 'var(--text-3)' }}>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── Loading Spinner ─────────────────────────────────────────────────────── */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sz = { sm: 'w-4 h-4', md: 'w-7 h-7', lg: 'w-10 h-10' };
  return (
    <div className="flex items-center justify-center">
      <div className={`${sz[size]} rounded-full animate-spin`}
        style={{ border: '2.5px solid var(--primary-mid)', borderTopColor: 'var(--primary)' }} />
    </div>
  );
}

/* ── Page Loader ─────────────────────────────────────────────────────────── */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="text-center animate-fade-in">
        {/* CareFlow logo mark */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-blue"
          style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 3C8.477 3 4 7.477 4 13s4.477 10 10 10 10-4.477 10-10S19.523 3 14 3z" stroke="#fff" strokeWidth="2" fill="none"/>
            <path d="M14 8v10M9 13h10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="text-sm font-semibold mb-1" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--primary)' }}>CareFlow</p>
        <LoadingSpinner />
      </div>
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────────────────── */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 backdrop-blur-sm" style={{ background: 'rgba(15,23,42,0.4)' }} onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} animate-slide-up card shadow-xl`}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
