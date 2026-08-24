import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Alert';
import { Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const DAYS = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
  { key: 'SUNDAY', label: 'Sunday' },
];

export function DoctorSchedulePage() {
  const queryClient = useQueryClient();

  const { data: workingHours } = useQuery({
    queryKey: ['my-working-hours'],
    queryFn: () => doctorsApi.getWorkingHours().then((r) => r.data.data),
  });

  const [whModal, setWhModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  const [whStart, setWhStart] = useState('09:00');
  const [whEnd, setWhEnd] = useState('17:00');
  const [whBreakStart, setWhBreakStart] = useState('13:00');
  const [whBreakEnd, setWhBreakEnd] = useState('14:00');

  const openModalForDay = (dayKey: string) => {
    const wh = workingHours?.find((w: any) => w.dayOfWeek === dayKey);
    setSelectedDay(dayKey);
    setWhStart(wh?.startTime ?? '09:00');
    setWhEnd(wh?.endTime ?? '17:00');
    setWhBreakStart(wh?.breakStart ?? '13:00');
    setWhBreakEnd(wh?.breakEnd ?? '14:00');
    setWhModal(true);
  };

  const upsertWhMutation = useMutation({
    mutationFn: () =>
      doctorsApi.upsertWorkingHour({
        dayOfWeek: selectedDay,
        startTime: whStart,
        endTime: whEnd,
        breakStart: whBreakStart || undefined,
        breakEnd: whBreakEnd || undefined,
      }),
    onSuccess: () => {
      toast.success('Working hours updated');
      setWhModal(false);
      queryClient.invalidateQueries({ queryKey: ['my-working-hours'] });
    },
    onError: () => toast.error('Failed to update working hours'),
  });

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Schedule & Hours
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Configure your weekly working hours and break times
          </p>
        </div>
        <button className="btn btn-primary btn-sm flex items-center gap-1.5" onClick={() => openModalForDay(selectedDay)}>
          <Clock className="w-3.5 h-3.5" /> Add / Update
        </button>
      </div>

      {/* Working Hours Grid */}
      <div className="card p-0 overflow-hidden">
        {DAYS.map((day, i) => {
          const wh = workingHours?.find((w: any) => w.dayOfWeek === day.key);
          return (
            <div
              key={day.key}
              className="flex items-center justify-between px-6 py-4 cursor-pointer transition-colors"
              style={{
                borderBottom: i < DAYS.length - 1 ? '1px solid var(--border)' : 'none',
              }}
              onClick={() => openModalForDay(day.key)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="text-sm font-semibold w-28" style={{ color: 'var(--text)' }}>{day.label}</span>
              {wh ? (
                <div className="text-right">
                  <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
                    {wh.startTime} – {wh.endTime}
                  </span>
                  {wh.breakStart && (
                    <span className="text-xs ml-3" style={{ color: 'var(--text-muted)' }}>
                      Break: {wh.breakStart} – {wh.breakEnd}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-sm px-2.5 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Day off
                </span>
              )}
            </div>
          );
        })}
        {(!workingHours || workingHours.length === 0) && (
          <div className="px-6 py-10 text-center">
            <Clock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No working hours configured yet.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click any day or the button above to get started.</p>
          </div>
        )}
      </div>

      {/* Working Hours Modal */}
      <Modal isOpen={whModal} onClose={() => setWhModal(false)} title={`Update ${DAYS.find(d => d.key === selectedDay)?.label} Hours`} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Day of Week</label>
            <select className="input" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
              {DAYS.map((d) => (<option key={d.key} value={d.key}>{d.label}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Time</label>
              <input type="time" className="input" value={whStart} onChange={(e) => setWhStart(e.target.value)} />
            </div>
            <div>
              <label className="label">End Time</label>
              <input type="time" className="input" value={whEnd} onChange={(e) => setWhEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Break Start</label>
              <input type="time" className="input" value={whBreakStart} onChange={(e) => setWhBreakStart(e.target.value)} />
            </div>
            <div>
              <label className="label">Break End</label>
              <input type="time" className="input" value={whBreakEnd} onChange={(e) => setWhBreakEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setWhModal(false)}>Cancel</Button>
            <Button className="flex-1" isLoading={upsertWhMutation.isPending} onClick={() => upsertWhMutation.mutate()}>Save Hours</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
