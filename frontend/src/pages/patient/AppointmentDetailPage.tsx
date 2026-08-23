import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appointmentsApi } from '../../api';
import { StatusBadge, UrgencyBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, LoadingSpinner } from '../../components/ui/Alert';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft, Calendar, Clock, Brain, FileText,
  Pill, AlertTriangle, CheckCircle, Sparkles
} from 'lucide-react';

export function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: apptData, isLoading } = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => appointmentsApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
    refetchInterval: 10000,
  });

  if (isLoading) return <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!apptData) return <div className="p-8 text-center" style={{ color: 'var(--text-3)' }}>Appointment not found</div>;

  const appt = apptData;
  const preVisit = appt.preVisitSummary;
  const consultation = appt.consultation;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/patient/appointments')}
        className="flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: 'var(--text-3)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Appointments
      </button>

      {/* Doctor Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
              {appt.doctor.user.firstName[0]}{appt.doctor.user.lastName[0]}
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
                Dr. {appt.doctor.user.firstName} {appt.doctor.user.lastName}
              </h1>
              <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{appt.doctor.specialization.name}</p>
            </div>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <Calendar className="w-3.5 h-3.5" /> Date
            </div>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
              {format(parseISO(appt.appointmentDate), 'EEEE, MMM d, yyyy')}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <Clock className="w-3.5 h-3.5" /> Time
            </div>
            <p className="font-semibold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
              {appt.startTime} – {appt.endTime}
            </p>
          </div>
        </div>

        {appt.status === 'RESCHEDULE_REQUIRED' && (
          <Alert type="warning" className="mt-4">
            <strong>Action Required:</strong> Your appointment needs to be rescheduled because the doctor is on leave.
          </Alert>
        )}
      </div>

      {/* Symptoms */}
      {appt.symptomSubmission && (
        <div className="card p-6">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <FileText className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Your Reported Symptoms
          </h2>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>Chief Complaint</p>
              <p className="font-medium" style={{ color: 'var(--text)' }}>{appt.symptomSubmission.chiefComplaint}</p>
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-widest mb-1" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>Detailed Symptoms</p>
              <p style={{ color: 'var(--text-2)' }}>{appt.symptomSubmission.symptoms}</p>
            </div>
            {appt.symptomSubmission.duration && (
              <div className="flex gap-8 pt-2" style={{ borderTop: '1px dashed var(--border)' }}>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Duration</p>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{appt.symptomSubmission.duration}</p>
                </div>
                {appt.symptomSubmission.severity && (
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Severity</p>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{appt.symptomSubmission.severity} / 10</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-visit AI summary */}
      {preVisit && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <Brain className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              AI Pre-visit Analysis
            </h2>
            <span className="badge badge-teal"><Sparkles className="w-3 h-3" /> AI Summary</span>
          </div>

          {preVisit.status === 'COMPLETED' ? (
            <div className="space-y-4">
              <Alert type="info">
                <strong>Medical Disclaimer:</strong> This AI summary is generated for pre-visit preparation only and is NOT a medical diagnosis. Always follow your doctor's advice.
              </Alert>

              {preVisit.urgencyLevel && (
                <div>
                  <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>Assessed Urgency Level</p>
                  <UrgencyBadge urgency={preVisit.urgencyLevel} />
                </div>
              )}

              {preVisit.chiefComplaint && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Clinical Overview</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{preVisit.chiefComplaint}</p>
                </div>
              )}
            </div>
          ) : preVisit.status === 'PENDING' ? (
            <div className="flex items-center gap-2.5 text-sm p-4 rounded-xl" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
              <LoadingSpinner size="sm" />
              Generating AI pre-visit summary…
            </div>
          ) : (
            <Alert type="warning">
              AI summary is temporarily unavailable. Your doctor will review your original symptoms directly.
            </Alert>
          )}
        </div>
      )}

      {/* Post-visit results */}
      {consultation && (
        <div className="card p-6">
          <h2 className="font-bold text-base mb-4 flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <CheckCircle className="w-5 h-5" style={{ color: 'var(--success)' }} />
            Doctor Consultation Results
          </h2>

          {consultation.postVisitSummary?.status === 'COMPLETED' ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase font-bold tracking-widest mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>Visit Summary</p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {consultation.postVisitSummary.summary}
                </p>
              </div>

              {consultation.postVisitSummary.medications &&
                (consultation.postVisitSummary.medications as any[]).length > 0 && (
                <div>
                  <p className="text-xs uppercase font-bold tracking-widest mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
                    <Pill className="w-3.5 h-3.5" /> Prescribed Medications
                  </p>
                  <div className="space-y-2">
                    {(consultation.postVisitSummary.medications as any[]).map((med, i) => (
                      <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-mid)' }}>
                        <p className="font-bold text-sm" style={{ color: 'var(--primary)', fontFamily: 'Manrope, sans-serif' }}>{med.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                          {med.dosage} · {med.frequency} · {med.duration}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {consultation.postVisitSummary.followUpSteps &&
                (consultation.postVisitSummary.followUpSteps as string[]).length > 0 && (
                <div>
                  <p className="text-xs uppercase font-bold tracking-widest mb-2" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>Follow-up Steps</p>
                  <ul className="space-y-2">
                    {(consultation.postVisitSummary.followUpSteps as string[]).map((step, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--text-2)' }}>
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 text-white"
                          style={{ background: 'var(--success)', fontFamily: 'Manrope, sans-serif' }}>
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p style={{ color: 'var(--text-2)' }}>{consultation.clinicalNotes}</p>
              {consultation.diagnosis && (
                <p>
                  <strong style={{ color: 'var(--text)' }}>Diagnosis:</strong> {consultation.diagnosis}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
