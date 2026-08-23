import React from 'react';
import { Pill, Plus, Clock, Calendar, AlertCircle } from 'lucide-react';

export function PatientMedicationsPage() {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Medications
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>
            Track your prescriptions and medication schedule
          </p>
        </div>
      </div>

      {/* Empty state */}
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: 'var(--primary-light)' }}>
          <Pill className="w-8 h-8" style={{ color: 'var(--primary)' }} />
        </div>
        <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
          No medications yet
        </h3>
        <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-3)' }}>
          Your prescriptions from completed consultations will appear here automatically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto mt-6">
          {[
            { icon: <Calendar className="w-4 h-4" />, label: 'Schedule', desc: 'Medication reminders' },
            { icon: <Clock className="w-4 h-4" />,    label: 'History',  desc: 'Past prescriptions' },
            { icon: <AlertCircle className="w-4 h-4" />, label: 'Alerts', desc: 'Refill reminders' },
          ].map(f => (
            <div key={f.label} className="p-4 rounded-xl text-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                {f.icon}
              </div>
              <p className="text-xs font-bold" style={{ color: 'var(--text)', fontFamily: 'Manrope, sans-serif' }}>{f.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
          Book an appointment and complete a consultation to receive your first prescription.
        </p>
      </div>
    </div>
  );
}
