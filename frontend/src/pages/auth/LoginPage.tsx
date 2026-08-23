import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../store/auth';
import { Eye, EyeOff, ArrowRight, Heart, Mail, Lock, Shield, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginForm { email: string; password: string; }

const FEATURES = [
  { icon: <Shield className="w-5 h-5" />, label: 'HIPAA-compliant security' },
  { icon: <Clock className="w-5 h-5" />,  label: 'Real-time slot management' },
  { icon: <CheckCircle className="w-5 h-5" />, label: 'AI-powered visit summaries' },
];

export function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [error, setError]               = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      const u = await login(data.email.trim(), data.password);
      toast.success(`Welcome back, ${u.firstName}!`);
      if (u.role === 'ADMIN') navigate('/admin');
      else if (u.role === 'DOCTOR') navigate('/doctor');
      else navigate('/patient');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1E3A8A 0%, #1D4ED8 45%, #0891B2 100%)' }}>

        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />

        {/* Floating decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10" style={{ background: '#fff' }} />
        <div className="absolute bottom-32 -left-10 w-40 h-40 rounded-full opacity-10" style={{ background: '#fff' }} />

        {/* Brand */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Heart className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-none" style={{ fontFamily: 'Manrope, sans-serif' }}>CareFlow</p>
              <p className="text-blue-200 text-xs">Healthcare Platform</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Your Health,<br />Our Priority.
          </h2>
          <p className="text-blue-100/80 text-sm leading-relaxed mb-8">
            A complete appointment and follow-up management platform designed to connect patients and doctors effortlessly.
          </p>

          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white flex-shrink-0">
                {f.icon}
              </div>
              <p className="text-blue-50 text-sm">{f.label}</p>
            </div>
          ))}
        </div>

        {/* Bottom quote */}
        <div className="relative p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <p className="text-white/90 text-sm italic leading-relaxed">
            "CareFlow has transformed how I manage my appointments and follow up with my patients."
          </p>
          <p className="text-blue-200 text-xs mt-2 font-semibold">— Dr. Sarah Mehta, General Medicine</p>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[400px] animate-fade-in">

          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)' }}>
              <Heart className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <p className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>CareFlow</p>
          </div>

          <h1 className="text-2xl font-bold mb-1.5" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Welcome back
          </h1>
          <p className="text-sm mb-8" style={{ color: 'var(--text-3)' }}>
            Sign in to your CareFlow account to continue
          </p>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl mb-5 text-sm"
              style={{ background: 'var(--danger-light)', border: '1.5px solid #FECACA', color: 'var(--danger)' }}>
              <span className="font-bold flex-shrink-0">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input id="login-email" type="email" autoComplete="email" placeholder="you@example.com"
                  className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                  })} />
              </div>
              {errors.email && <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--danger)' }}>{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                  className={`input pl-10 pr-10 ${errors.password ? 'input-error' : ''}`}
                  {...register('password', { required: 'Password is required' })} />
                <button type="button" tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--danger)' }}>{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={isSubmitting}
              className="btn btn-primary btn-lg w-full mt-2 group">
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--text-3)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold" style={{ color: 'var(--primary)' }}>
              Create one
            </Link>
          </p>

          <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
            Protected by TLS encryption · HIPAA compliant
          </p>
        </div>
      </div>
    </div>
  );
}
