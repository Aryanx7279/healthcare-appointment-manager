import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, doctorsApi, specializationsApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Alert, EmptyState, LoadingSpinner, Modal } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Stethoscope, Plus, Search, Edit, UserX } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface CreateDoctorForm {
  firstName: string;
  lastName: string;
  email: string;
  specializationId: string;
  licenseNumber?: string;
  bio?: string;
  slotDurationMins?: string;
}

export function AdminDoctorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [leaveModal, setLeaveModal] = useState<{ open: boolean; doctorId: string | null }>({ open: false, doctorId: null });
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ['admin-doctors', search],
    queryFn: () =>
      doctorsApi.list({ search: search || undefined }).then((r) => r.data.data),
  });

  const { data: specs } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specializationsApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateDoctorForm>();

  const createMutation = useMutation({
    mutationFn: (data: CreateDoctorForm) =>
      adminApi.createDoctor({ ...data, slotDurationMins: parseInt(data.slotDurationMins || '30') }),
    onSuccess: () => {
      toast.success('Doctor created successfully!');
      setCreateModal(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to create doctor'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.deactivateDoctor(id),
    onSuccess: () => {
      toast.success('Doctor deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
    },
    onError: () => toast.error('Failed to deactivate doctor'),
  });

  const addLeaveMutation = useMutation({
    mutationFn: () => adminApi.addDoctorLeave(leaveModal.doctorId!, { date: leaveDate, reason: leaveReason }),
    onSuccess: (res) => {
      toast.success(`Leave added. ${res.data.data.affectedAppointmentsCount} patients notified.`);
      setLeaveModal({ open: false, doctorId: null });
    },
    onError: (err: any) => toast.error(err.response?.data?.error?.message || 'Failed to add leave'),
  });

  const doctors = doctorsData?.doctors || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="page-subtitle">Manage healthcare providers</p>
        </div>
        <Button onClick={() => setCreateModal(true)}>
          <Plus className="w-4 h-4" /> Add Doctor
        </Button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Doctors table */}
      <div className="table-container">
        {isLoading ? (
          <div className="p-8"><LoadingSpinner /></div>
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="w-8 h-8" />}
            title="No doctors found"
            action={<Button onClick={() => setCreateModal(true)}>Add First Doctor</Button>}
          />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialization</th>
                <th>License</th>
                <th>Slot Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((d: any) => (
                <tr key={d.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {d.user.firstName[0]}{d.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          Dr. {d.user.firstName} {d.user.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{d.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{d.specialization?.name || '—'}</td>
                  <td className="font-mono text-xs">{d.licenseNumber || '—'}</td>
                  <td>{d.slotDurationMins} min</td>
                  <td>
                    <Badge variant={d.isActive !== false ? 'green' : 'gray'}>
                      {d.isActive !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLeaveModal({ open: true, doctorId: d.id })}
                      >
                        Add Leave
                      </Button>
                      {d.isActive !== false && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Deactivate Dr. ${d.user.lastName}?`)) {
                              deactivateMutation.mutate(d.id);
                            }
                          }}
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Doctor Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Add New Doctor"
        size="lg"
      >
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name"
              error={errors.firstName?.message}
              {...register('firstName', { required: 'Required' })}
            />
            <Input
              label="Last Name"
              error={errors.lastName?.message}
              {...register('lastName', { required: 'Required' })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register('email', { required: 'Required' })}
          />
          <Select
            label="Specialization"
            options={[
              { value: '', label: 'Select specialization...' },
              ...(specs || []).map((s: any) => ({ value: s.id, label: s.name })),
            ]}
            error={errors.specializationId?.message}
            {...register('specializationId', { required: 'Required' })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="License Number" {...register('licenseNumber')} />
            <Input
              label="Slot Duration (mins)"
              type="number"
              defaultValue="30"
              {...register('slotDurationMins')}
            />
          </div>
          <Input label="Bio (optional)" {...register('bio')} />
          <Alert type="info">
            A temporary password will be set to "ChangeMe123!". The doctor should change it on first login.
          </Alert>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending} className="flex-1">
              Create Doctor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Leave Modal */}
      <Modal
        isOpen={leaveModal.open}
        onClose={() => setLeaveModal({ open: false, doctorId: null })}
        title="Add Doctor Leave"
        size="sm"
      >
        <div className="space-y-4">
          <Alert type="warning">
            Affected patients will be notified automatically.
          </Alert>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Reason</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Medical training"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setLeaveModal({ open: false, doctorId: null })}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              isLoading={addLeaveMutation.isPending}
              onClick={() => addLeaveMutation.mutate()}
            >
              Add Leave
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
