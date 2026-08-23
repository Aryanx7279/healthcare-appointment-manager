import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../../api';
import { StatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState, LoadingSpinner, Modal, Alert } from '../../components/ui/Alert';
import { Appointment } from '../../types';
import { format, parseISO, isAfter } from 'date-fns';
import { Calendar, ChevronRight, Clock, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

export function PatientAppointmentsPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [filter,       setFilter]      = useState('all');
  const [cancelModal,  setCancelModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['patient-appointments'],
    queryFn: () => appointmentsApi.list().then((r) => r.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => appointmentsApi.cancel(id, reason),
    onSuccess: () => {
      toast.success('Appointment cancelled');
      queryClient.invalidateQueries({ queryKey: ['patient-appointments'] });
      setCancelModal({ open: false, id: null });
      setCancelReason('');
    },
    onError: () => toast.error('Failed to cancel appointment'),
  });

  const appointments: Appointment[] = data || [];

  const filtered = appointments.filter((a) => {
    if (filter === 'all')       return true;
    if (filter === 'upcoming')  return ['CONFIRMED','PENDING'].includes(a.status) && isAfter(parseISO(a.appointmentDate), new Date());
    if (filter === 'action')    return a.status === 'RESCHEDULE_REQUIRED';
    if (filter === 'past')      return a.status === 'COMPLETED';
    if (filter === 'cancelled') return a.status === 'CANCELLED';
    return true;
  });

  const FILTERS = [
    { key: 'all',       label: 'All' },
    { key: 'upcoming',  label: 'Upcoming' },
    { key: 'action',    label: 'Action Required', badge: appointments.filter(a => a.status === 'RESCHEDULE_REQUIRED').length },
    { key: 'past',      label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">Manage and track your medical visits</p>
        </div>
        <Button onClick={() => navigate('/patient/doctors')} leftIcon={<Search className="w-4 h-4" />}>
          Book New
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5"
            style={{
              background: filter === f.key ? 'var(--primary)' : 'var(--surface)',
              color:      filter === f.key ? '#fff' : 'var(--text-3)',
              border:     `1.5px solid ${filter === f.key ? 'var(--primary)' : 'var(--border)'}`,
              boxShadow:  filter === f.key ? 'var(--shadow-blue)' : 'none',
              fontFamily: 'Manrope, sans-serif',
            }}>
            {f.label}
            {!!f.badge && f.badge > 0 && (
              <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                style={{ background: filter === f.key ? 'rgba(255,255,255,0.3)' : 'var(--orange)', color: '#fff', fontSize: 10 }}>
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No appointments found"
          description={filter === 'all' ? 'Book an appointment to get started' : 'No appointments in this category'}
          action={<Button onClick={() => navigate('/patient/doctors')}>Book an Appointment</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => (
            <div key={appt.id}
              className="card p-5 flex items-center gap-4 cursor-pointer transition-all duration-150"
              onClick={() => navigate(`/patient/appointments/${appt.id}`)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary-mid)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>

              {/* Date badge */}
              <div className="flex-shrink-0 w-14 text-center">
                <div className="rounded-xl p-2 text-center" style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)' }}>
                  <p className="text-xs font-semibold text-white/80">{format(parseISO(appt.appointmentDate), 'MMM')}</p>
                  <p className="text-2xl font-bold text-white leading-none">{format(parseISO(appt.appointmentDate), 'd')}</p>
                  <p className="text-xs text-white/80">{format(parseISO(appt.appointmentDate), 'EEE')}</p>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                  Dr. {appt.doctor.user.firstName} {appt.doctor.user.lastName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--primary)' }}>{appt.doctor.specialization.name}</p>
                <div className="flex items-center gap-1.5 mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                  <Clock className="w-3 h-3" />
                  {appt.startTime} – {appt.endTime}
                </div>
                {appt.status === 'RESCHEDULE_REQUIRED' && (
                  <p className="text-xs mt-1.5 font-semibold" style={{ color: 'var(--warning)' }}>
                    ⚠ Doctor is on leave — please reschedule
                  </p>
                )}
              </div>

              {/* Status + actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={appt.status} />
                {['CONFIRMED','PENDING'].includes(appt.status) && isAfter(parseISO(appt.appointmentDate), new Date()) && (
                  <button className="btn btn-sm"
                    style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1.5px solid #FECACA' }}
                    onClick={e => { e.stopPropagation(); setCancelModal({ open: true, id: appt.id }); }}>
                    Cancel
                  </button>
                )}
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel modal */}
      <Modal isOpen={cancelModal.open} onClose={() => setCancelModal({ open: false, id: null })} title="Cancel Appointment" size="sm">
        <div className="space-y-4">
          <Alert type="warning">Are you sure you want to cancel this appointment?</Alert>
          <div>
            <label className="label">Reason for cancellation</label>
            <textarea className="input resize-none" rows={3} placeholder="Please provide a reason…"
              value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelModal({ open: false, id: null })}>
              Keep Appointment
            </Button>
            <Button variant="danger" className="flex-1" isLoading={cancelMutation.isPending}
              onClick={() => { if (cancelModal.id) cancelMutation.mutate({ id: cancelModal.id, reason: cancelReason || 'Cancelled by patient' }); }}>
              Cancel Appointment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
