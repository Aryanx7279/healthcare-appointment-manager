import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/auth';
import { authApi } from '../../api';
import { Mail, Stethoscope, Save, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface DoctorProfileForm {
  firstName: string;
  lastName: string;
  phone?: string;
  bio?: string;
  consultationFee?: number;
  slotDurationMinutes?: number;
}

export function DoctorProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['doctor-profile'],
    queryFn: () => authApi.getProfile().then(r => r.data.data),
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DoctorProfileForm>({
    defaultValues: { firstName: '', lastName: '', phone: '', bio: '', consultationFee: undefined, slotDurationMinutes: 30 },
  });

  useEffect(() => {
    if (!profile) return;
    reset({
      firstName:           profile.firstName                         ?? user?.firstName ?? '',
      lastName:            profile.lastName                          ?? user?.lastName  ?? '',
      phone:               profile.doctorProfile?.phone              ?? '',
      bio:                 profile.doctorProfile?.bio                ?? '',
      consultationFee:     profile.doctorProfile?.consultationFee    ?? undefined,
      slotDurationMinutes: profile.doctorProfile?.slotDurationMinutes ?? 30,
    });
  }, [profile, reset]);

  const cancelEdit = () => {
    reset({
      firstName:           profile?.firstName                         ?? user?.firstName ?? '',
      lastName:            profile?.lastName                          ?? user?.lastName  ?? '',
      phone:               profile?.doctorProfile?.phone              ?? '',
      bio:                 profile?.doctorProfile?.bio                ?? '',
      consultationFee:     profile?.doctorProfile?.consultationFee    ?? undefined,
      slotDurationMinutes: profile?.doctorProfile?.slotDurationMinutes ?? 30,
    });
    setEditing(false);
  };

  const updateMutation = useMutation({
    mutationFn: (data: DoctorProfileForm) => authApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated!');
      qc.invalidateQueries({ queryKey: ['doctor-profile'] });
      setEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const initials = `${(profile?.firstName ?? user?.firstName ?? '?')[0]}${(profile?.lastName ?? user?.lastName ?? '')[0]}`;
  const specialization = profile?.doctorProfile?.specialization?.name ?? 'Doctor';

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            My Profile
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Manage your professional information
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
          onClick={() => editing ? cancelEdit() : setEditing(true)}>
          <Edit2 className="w-3.5 h-3.5" />
          {editing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* Avatar card */}
      <div className="card p-6 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #059669, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
          {initials}
        </div>
        <div>
          <p className="font-bold text-lg" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Dr. {profile?.firstName ?? user?.firstName} {profile?.lastName ?? user?.lastName}
          </p>
          <p className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-3)' }}>
            <Mail className="w-3.5 h-3.5" /> {profile?.email ?? user?.email}
          </p>
          <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: '#DCFCE7', color: '#059669' }}>
            <Stethoscope className="w-3 h-3" /> {specialization}
          </span>
        </div>
      </div>

      {/* Details form */}
      <form className="card p-6 space-y-5" onSubmit={handleSubmit(d => updateMutation.mutate(d))}>
        <h3 className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
          Personal Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">First name</label>
            <input className="input" disabled={!editing} {...register('firstName', { required: true })} />
            {errors.firstName && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Required</p>}
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" disabled={!editing} {...register('lastName', { required: true })} />
            {errors.lastName && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Required</p>}
          </div>
        </div>

        <div>
          <label className="label">Phone number</label>
          <input className="input" placeholder="+1-555-0101" disabled={!editing} {...register('phone')} />
        </div>

        <div>
          <label className="label">Professional Bio</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Brief description of your experience and specializations..."
            disabled={!editing}
            style={{ resize: 'none' }}
            {...register('bio')}
          />
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-sm mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Practice Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Consultation Fee (₹)</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="e.g. 500"
                disabled={!editing}
                {...register('consultationFee', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="label">Slot Duration (minutes)</label>
              <select className="input" disabled={!editing} {...register('slotDurationMinutes', { valueAsNumber: true })}>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
          </div>
        </div>

        {editing && (
          <button type="submit" disabled={updateMutation.isPending}
            className="btn btn-primary w-full flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </form>

      {isLoading && (
        <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>Loading profile…</p>
      )}
    </div>
  );
}
