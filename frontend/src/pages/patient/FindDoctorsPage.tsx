import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { doctorsApi, specializationsApi } from '../../api';
import { EmptyState, LoadingSpinner } from '../../components/ui/Alert';
import { Search, Clock, Filter, ChevronRight, Stethoscope, Star } from 'lucide-react';
import { DoctorProfile } from '../../types';

/* ── Skeleton card ────────────────────────────────────────────────────────── */
function DoctorCardSkeleton() {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="skeleton w-14 h-14 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
        </div>
      </div>
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-5/6 rounded" />
      <div className="flex gap-1">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-5 w-9 rounded" />)}
      </div>
      <div className="skeleton h-9 w-full rounded-lg" />
    </div>
  );
}

/* ── Doctor card ──────────────────────────────────────────────────────────── */
function DoctorCard({ doctor, onClick }: { doctor: DoctorProfile; onClick: () => void }) {
  const days   = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  const dayMap: Record<string,string> = { MON:'MONDAY',TUE:'TUESDAY',WED:'WEDNESDAY',THU:'THURSDAY',FRI:'FRIDAY',SAT:'SATURDAY',SUN:'SUNDAY' };

  return (
    <div className="card-hover p-6" onClick={onClick}>
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
          {doctor.user.firstName[0]}{doctor.user.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Dr. {doctor.user.firstName} {doctor.user.lastName}
          </h3>
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--primary)' }}>
            {doctor.specialization?.name}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {[1,2,3,4,5].map(i => (
              <Star key={i} className="w-3 h-3" style={{ color: '#FBBF24', fill: i <= 4 ? '#FBBF24' : 'none' }} />
            ))}
            <span className="text-xs ml-0.5" style={{ color: 'var(--text-muted)' }}>4.8</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
          style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--success)' }} />
          Available
        </div>
      </div>

      {/* Bio */}
      {doctor.bio && (
        <p className="text-xs leading-relaxed mb-4 line-clamp-2" style={{ color: 'var(--text-3)' }}>{doctor.bio}</p>
      )}

      {/* Slot duration */}
      <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: 'var(--text-3)' }}>
        <Clock className="w-3.5 h-3.5" />
        <span>{doctor.slotDurationMins} min per consultation</span>
      </div>

      {/* Working days */}
      {doctor.workingHours && doctor.workingHours.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          {days.map(day => {
            const works = doctor.workingHours?.some(wh => wh.dayOfWeek === dayMap[day]);
            return (
              <span key={day} className="text-xs px-1.5 py-0.5 rounded font-semibold"
                style={{ background: works ? 'var(--primary-light)' : 'var(--surface-3)', color: works ? 'var(--primary)' : 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
                {day}
              </span>
            );
          })}
        </div>
      )}

      <button className="btn btn-primary w-full text-sm" onClick={(e) => { e.stopPropagation(); onClick(); }}>
        Book Appointment <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export function FindDoctorsPage() {
  const navigate = useNavigate();
  const [search,         setSearch]         = useState('');
  const [specialization, setSpecialization] = useState('');

  const { data: specs } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specializationsApi.list().then((r) => r.data.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['doctors', search, specialization],
    queryFn: () => doctorsApi.list({ search: search || undefined, specialization: specialization || undefined }).then((r) => r.data.data),
  });

  const doctors: DoctorProfile[] = data?.doctors || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Find a Doctor</h1>
        <p className="page-subtitle">Browse our specialists and book your appointment</p>
      </div>

      {/* Search + filter bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input pl-10"
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-56">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            <select
              className="input pl-10"
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}>
              <option value="">All Specializations</option>
              {(specs || []).map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && doctors.length > 0 && (
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Showing <strong style={{ color: 'var(--text)' }}>{doctors.length}</strong> doctor{doctors.length !== 1 ? 's' : ''}
          {specialization ? ` in ${specialization}` : ''}
        </p>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <DoctorCardSkeleton key={i} />)}
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="w-6 h-6" />}
          title="No doctors found"
          description="Try adjusting your search or specialization filter"
          action={<button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setSpecialization(''); }}>Clear filters</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doctors.map(doctor => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              onClick={() => navigate(`/patient/doctors/${doctor.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
