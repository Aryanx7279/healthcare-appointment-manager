import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../store/auth';
import { authApi } from '../../api';
import { Mail, Droplets, AlertTriangle, Save, Edit2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string;
  address?: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export function PatientProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();

  // staleTime:0 ensures we always fetch fresh data on navigation
  const { data: profile, isLoading } = useQuery({
    queryKey: ['patient-profile'],
    queryFn: () => authApi.getProfile().then(r => r.data.data),
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: { firstName: '', lastName: '', phone: '', bloodGroup: '', allergies: '', address: '' },
  });

  // Re-populate the form every time fresh data arrives (including after navigation)
  useEffect(() => {
    if (!profile) return;
    reset({
      firstName:  profile.firstName                  ?? user?.firstName ?? '',
      lastName:   profile.lastName                   ?? user?.lastName  ?? '',
      phone:      profile.patientProfile?.phone      ?? '',
      bloodGroup: profile.patientProfile?.bloodGroup ?? '',
      allergies:  profile.patientProfile?.allergies  ?? '',
      address:    profile.patientProfile?.address    ?? '',
    });
  }, [profile, reset]);

  const cancelEdit = () => {
    reset({
      firstName:  profile?.firstName                  ?? user?.firstName ?? '',
      lastName:   profile?.lastName                   ?? user?.lastName  ?? '',
      phone:      profile?.patientProfile?.phone      ?? '',
      bloodGroup: profile?.patientProfile?.bloodGroup ?? '',
      allergies:  profile?.patientProfile?.allergies  ?? '',
      address:    profile?.patientProfile?.address    ?? '',
    });
    setEditing(false);
  };

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated!');
      // Refresh cache so next navigation shows saved values
      qc.invalidateQueries({ queryKey: ['patient-profile'] });
      setEditing(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            My Profile
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Manage your personal and medical information
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
          style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
          {(profile?.firstName ?? user?.firstName ?? '?')[0]}
          {(profile?.lastName  ?? user?.lastName  ?? '')[0]}
        </div>
        <div>
          <p className="font-bold text-lg" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            {profile?.firstName ?? user?.firstName} {profile?.lastName ?? user?.lastName}
          </p>
          <p className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-3)' }}>
            <Mail className="w-3.5 h-3.5" /> {profile?.email ?? user?.email}
          </p>
          <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            Patient
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
          <label className="label">Address</label>
          <input className="input" placeholder="123 Main St, City" disabled={!editing} {...register('address')} />
        </div>

        <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-bold text-sm mb-4" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Medical Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} /> Blood group
              </label>
              <select className="input" disabled={!editing} {...register('bloodGroup')}>
                <option value="">— Select —</option>
                {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} /> Allergies
              </label>
              <input className="input" placeholder="e.g. Penicillin" disabled={!editing} {...register('allergies')} />
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
