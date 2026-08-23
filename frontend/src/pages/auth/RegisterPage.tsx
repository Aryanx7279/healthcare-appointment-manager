import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authApi, specializationsApi } from '../../api';
import { Heart, ArrowRight, User, Mail, Lock, Users, Stethoscope } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';

interface RegisterForm {
  email: string; password: string; confirmPassword: string;
  firstName: string; lastName: string;
  role: 'PATIENT' | 'DOCTOR'; specializationId?: string;
}

export function RegisterPage() {
  const navigate   = useNavigate();
  const [error, setError] = useState('');

  const { data: specs } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specializationsApi.list().then((r) => r.data.data),
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ defaultValues: { role: 'PATIENT' } });
  const selectedRole = watch('role');

  const onSubmit = async (data: RegisterForm) => {
    if (data.password !== data.confirmPassword) { setError('Passwords do not match'); return; }
    try {
      setError('');
      const { confirmPassword, ...payload } = data;
      await authApi.register(payload);
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md animate-fade-in">

        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)' }}>
            <Heart className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <p className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>CareFlow</p>
        </div>

        {/* Card */}
        <div className="card p-7 shadow-lg">
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Create your account</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>Join CareFlow and take control of your healthcare</p>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl mb-5 text-sm"
              style={{ background: 'var(--danger-light)', border: '1.5px solid #FECACA', color: 'var(--danger)' }}>
              <span className="font-bold">⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <input id="reg-firstname" placeholder="John" className={`input pl-9 ${errors.firstName ? 'input-error' : ''}`}
                    {...register('firstName', { required: 'Required' })} />
                </div>
                {errors.firstName && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">Last name</label>
                <input id="reg-lastname" placeholder="Smith" className={`input ${errors.lastName ? 'input-error' : ''}`}
                  {...register('lastName', { required: 'Required' })} />
                {errors.lastName && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input id="reg-email" type="email" placeholder="you@example.com"
                  className={`input pl-9 ${errors.email ? 'input-error' : ''}`}
                  {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
              </div>
              {errors.email && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>}
            </div>

            {/* Role picker */}
            <div>
              <label className="label">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'PATIENT', label: 'Patient',  desc: 'Book & manage visits', icon: <Users className="w-5 h-5" /> },
                  { value: 'DOCTOR',  label: 'Doctor',   desc: 'Manage your schedule',  icon: <Stethoscope className="w-5 h-5" /> },
                ] as const).map(({ value, label, desc, icon }) => {
                  const active = selectedRole === value;
                  return (
                    <label key={value} className="relative flex flex-col items-center gap-1.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200"
                      style={{
                        background: active ? 'var(--primary-light)' : 'var(--surface-2)',
                        border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                      }}>
                      <input type="radio" value={value} className="sr-only" {...register('role')} />
                      <span style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}>{icon}</span>
                      <span className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: active ? 'var(--primary)' : 'var(--text)' }}>{label}</span>
                      <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Specialization */}
            {selectedRole === 'DOCTOR' && (
              <div className="animate-slide-up">
                <label className="label">Specialization</label>
                <select className={`input ${errors.specializationId ? 'input-error' : ''}`}
                  {...register('specializationId', { required: 'Required for doctors' })}>
                  <option value="">Select specialization…</option>
                  {(specs || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {errors.specializationId && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.specializationId.message}</p>}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input id="reg-password" type="password" placeholder="Minimum 8 characters"
                  className={`input pl-9 ${errors.password ? 'input-error' : ''}`}
                  {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Minimum 8 characters' } })} />
              </div>
              {errors.password && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.password.message}</p>}
            </div>

            {/* Confirm */}
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input id="reg-confirm" type="password" placeholder="Repeat your password"
                  className={`input pl-9 ${errors.confirmPassword ? 'input-error' : ''}`}
                  {...register('confirmPassword', { required: 'Please confirm your password' })} />
              </div>
              {errors.confirmPassword && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>{errors.confirmPassword.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg w-full mt-1 group">
              {isSubmitting ? (
                <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Creating account…</>
              ) : (
                <>Create Account <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: 'var(--text-3)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
