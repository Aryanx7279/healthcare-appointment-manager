import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Alert, Modal } from '../../components/ui/Alert';
import { format, parseISO, addDays } from 'date-fns';
import { Calendar, Plus, Trash2, AlertTriangle } from 'lucide-react';
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

export function DoctorLeaveManagementPage() {
  const queryClient = useQueryClient();
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveResult, setLeaveResult] = useState<any>(null);

  const { data: leaves } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => doctorsApi.getLeaves().then((r) => r.data.data),
  });

  const { data: workingHours } = useQuery({
    queryKey: ['my-working-hours'],
    queryFn: () => doctorsApi.getWorkingHours().then((r) => r.data.data),
  });

  const addLeaveMutation = useMutation({
    mutationFn: () => doctorsApi.addLeave(leaveDate, leaveReason),
    onSuccess: (res) => {
      setLeaveResult(res.data.data);
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to add leave');
    },
  });

  const removeLeaveMutation = useMutation({
    mutationFn: (date: string) => doctorsApi.removeLeave(date),
    onSuccess: () => {
      toast.success('Leave removed');
      queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
    },
    onError: () => toast.error('Failed to remove leave'),
  });

  const [whModal, setWhModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState('MONDAY');
  const [whStart, setWhStart] = useState('09:00');
  const [whEnd, setWhEnd] = useState('17:00');
  const [whBreakStart, setWhBreakStart] = useState('13:00');
  const [whBreakEnd, setWhBreakEnd] = useState('14:00');

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

  const handleAddLeave = () => {
    if (!leaveDate) { toast.error('Please select a date'); return; }
    addLeaveMutation.mutate();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Schedule & Leave Management</h1>
        <p className="page-subtitle">Manage your working hours and time off</p>
      </div>

      {/* Working Hours */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Working Hours</h2>
          <Button size="sm" onClick={() => setWhModal(true)}>
            <Plus className="w-4 h-4" /> Add / Update
          </Button>
        </div>
        <div className="p-6">
          {workingHours && workingHours.length > 0 ? (
            <div className="space-y-2">
              {DAYS.map((day) => {
                const wh = workingHours.find((w: any) => w.dayOfWeek === day.key);
                return (
                  <div key={day.key} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm font-medium text-slate-700 w-28">{day.label}</span>
                    {wh ? (
                      <span className="text-sm text-slate-600">
                        {wh.startTime} – {wh.endTime}
                        {wh.breakStart && (
                          <span className="text-slate-400 ml-2">
                            (Break: {wh.breakStart} – {wh.breakEnd})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Day off</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No working hours configured yet.</p>
          )}
        </div>
      </div>

      {/* Leave Management */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Time Off / Leave</h2>
          <Button size="sm" onClick={() => { setLeaveModal(true); setLeaveResult(null); }}>
            <Plus className="w-4 h-4" /> Add Leave
          </Button>
        </div>
        <div className="p-6">
          {!leaves || leaves.length === 0 ? (
            <p className="text-slate-500 text-sm">No leave scheduled.</p>
          ) : (
            <div className="space-y-2">
              {leaves.map((leave: any) => (
                <div
                  key={leave.id}
                  className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {format(parseISO(leave.date), 'EEEE, MMMM d, yyyy')}
                    </p>
                    {leave.reason && (
                      <p className="text-sm text-slate-500">{leave.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() =>
                      removeLeaveMutation.mutate(format(parseISO(leave.date), 'yyyy-MM-dd'))
                    }
                    isLoading={removeLeaveMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Leave Modal */}
      <Modal
        isOpen={leaveModal}
        onClose={() => { setLeaveModal(false); setLeaveResult(null); }}
        title="Add Time Off"
        size="sm"
      >
        {leaveResult ? (
          <div className="space-y-4">
            <Alert type="success">
              Leave added for {format(parseISO(leaveDate), 'MMMM d, yyyy')}.
            </Alert>
            {leaveResult.affectedAppointmentsCount > 0 && (
              <Alert type="warning">
                <strong>{leaveResult.affectedAppointmentsCount} patient appointment{leaveResult.affectedAppointmentsCount > 1 ? 's' : ''} affected.</strong>
                <br />
                Patients have been notified and their appointments marked as requiring rescheduling.
                <div className="mt-2 space-y-1">
                  {leaveResult.affectedAppointments.map((a: any) => (
                    <div key={a.id} className="text-xs">
                      • {a.patientName} — {a.startTime}
                    </div>
                  ))}
                </div>
              </Alert>
            )}
            <Button className="w-full" onClick={() => { setLeaveModal(false); setLeaveResult(null); }}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert type="warning">
              Adding leave on a date with existing appointments will notify all affected patients and mark those appointments as requiring rescheduling.
            </Alert>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={leaveDate}
                min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Medical conference, personal leave"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setLeaveModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                isLoading={addLeaveMutation.isPending}
                onClick={handleAddLeave}
              >
                Confirm Leave
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Working Hours Modal */}
      <Modal
        isOpen={whModal}
        onClose={() => setWhModal(false)}
        title="Update Working Hours"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Day of Week</label>
            <select
              className="input"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {DAYS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
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
            <Button variant="secondary" className="flex-1" onClick={() => setWhModal(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              isLoading={upsertWhMutation.isPending}
              onClick={() => upsertWhMutation.mutate()}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
