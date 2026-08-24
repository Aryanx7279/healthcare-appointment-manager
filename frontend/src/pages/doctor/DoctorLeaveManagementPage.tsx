import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Alert, Modal } from '../../components/ui/Alert';
import { format, parseISO, addDays } from 'date-fns';
import { Calendar, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

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

  const handleAddLeave = () => {
    if (!leaveDate) { toast.error('Please select a date'); return; }
    addLeaveMutation.mutate();
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Leave Management
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Schedule and manage your time off
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm flex items-center gap-1.5"
          onClick={() => { setLeaveModal(true); setLeaveResult(null); }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Leave
        </button>
      </div>

      {/* Leave List */}
      <div className="card p-0 overflow-hidden">
        {!leaves || leaves.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No leave scheduled.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click "Add Leave" to schedule time off.</p>
          </div>
        ) : (
          <div>
            {leaves.map((leave: any, i: number) => (
              <div
                key={leave.id}
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: i < leaves.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                    {format(parseISO(leave.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  {leave.reason && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{leave.reason}</p>
                  )}
                </div>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: 'var(--danger)', background: 'var(--danger-light)' }}
                  onClick={() => removeLeaveMutation.mutate(format(parseISO(leave.date), 'yyyy-MM-dd'))}
                  disabled={removeLeaveMutation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
}
