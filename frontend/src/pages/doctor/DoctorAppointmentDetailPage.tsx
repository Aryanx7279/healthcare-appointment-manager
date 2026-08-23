import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi, consultationsApi } from '../../api';
import { StatusBadge, UrgencyBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert, LoadingSpinner, Modal } from '../../components/ui/Alert';
import { Input, Textarea } from '../../components/ui/Input';
import { useForm, useFieldArray } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft, Brain, FileText, Pill, Plus, Trash2,
  CheckCircle, Loader2, AlertTriangle, Send
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConsultationForm {
  clinicalNotes: string;
  diagnosis: string;
  followUpInstructions: string;
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
}

export function DoctorAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [consultationModal, setConsultationModal] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const { data: appt, isLoading, refetch } = useQuery({
    queryKey: ['doctor-appointment', id],
    queryFn: () => appointmentsApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
    refetchInterval: 8000,
  });

  const { register, handleSubmit, control, formState: { errors } } = useForm<ConsultationForm>({
    defaultValues: {
      medications: [{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'medications' });

  const consultMutation = useMutation({
    mutationFn: (data: ConsultationForm) =>
      appointmentsApi.submitConsultation(id!, data),
    onSuccess: async (res) => {
      toast.success('Consultation saved successfully!');
      setConsultationModal(false);
      setGeneratingSummary(true);
      // Trigger post-visit summary generation
      try {
        await consultationsApi.generatePostVisitSummary(res.data.data.id);
      } catch {
        // Non-blocking
      }
      setGeneratingSummary(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['doctor-appointments'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || 'Failed to save consultation');
    },
  });

  if (isLoading) return <div className="p-8"><LoadingSpinner size="lg" /></div>;
  if (!appt) return <div>Appointment not found</div>;

  const preVisit = appt.preVisitSummary;
  const consultation = appt.consultation;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/doctor/appointments')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Appointments
      </button>

      {/* Patient info */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {appt.patient.user.firstName[0]}{appt.patient.user.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {appt.patient.user.firstName} {appt.patient.user.lastName}
              </h1>
              <p className="text-slate-500">{appt.patient.user.email}</p>
            </div>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Date</p>
            <p className="font-semibold text-sm">
              {format(parseISO(appt.appointmentDate), 'EEE, MMM d, yyyy')}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-500">Time</p>
            <p className="font-semibold text-sm">{appt.startTime} – {appt.endTime}</p>
          </div>
        </div>

        {/* Actions */}
        {appt.status === 'CONFIRMED' && !consultation && (
          <Button
            className="mt-4"
            onClick={() => setConsultationModal(true)}
          >
            <FileText className="w-4 h-4" />
            Complete Consultation
          </Button>
        )}
      </div>

      {/* Pre-visit AI Summary (FULL view for doctor) */}
      {preVisit && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            AI Pre-visit Summary
          </h2>
          <p className="text-xs text-slate-500 mb-4">Generated from patient-reported symptoms</p>

          {preVisit.status === 'COMPLETED' ? (
            <div className="space-y-4">
              {preVisit.urgencyLevel && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Urgency Assessment</p>
                  <UrgencyBadge urgency={preVisit.urgencyLevel} />
                </div>
              )}

              {preVisit.chiefComplaint && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-slate-700 text-sm">{preVisit.chiefComplaint}</p>
                </div>
              )}

              {preVisit.suggestedQuestions && preVisit.suggestedQuestions.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    Suggested Questions for Consultation
                  </p>
                  <ul className="space-y-2">
                    {preVisit.suggestedQuestions.map((q: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-slate-700">{q}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : preVisit.status === 'PENDING' ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Generating AI pre-visit summary...
            </div>
          ) : (
            <Alert type="warning">
              AI summary unavailable. Please review patient symptoms directly below.
            </Alert>
          )}
        </div>
      )}

      {/* Patient symptoms */}
      {appt.symptomSubmission && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Patient-Reported Symptoms
          </h2>
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Chief Complaint</p>
              <p className="text-slate-800 font-medium">{appt.symptomSubmission.chiefComplaint}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
              <p className="text-slate-700 text-sm">{appt.symptomSubmission.symptoms}</p>
            </div>
            {(appt.symptomSubmission.duration || appt.symptomSubmission.severity) && (
              <div className="flex gap-4">
                {appt.symptomSubmission.duration && (
                  <div className="bg-slate-50 rounded-xl p-3 flex-1">
                    <p className="text-xs text-slate-500">Duration</p>
                    <p className="font-semibold text-sm">{appt.symptomSubmission.duration}</p>
                  </div>
                )}
                {appt.symptomSubmission.severity && (
                  <div className="bg-slate-50 rounded-xl p-3 flex-1">
                    <p className="text-xs text-slate-500">Severity</p>
                    <p className="font-semibold text-sm">{appt.symptomSubmission.severity}/10</p>
                  </div>
                )}
              </div>
            )}
            {appt.symptomSubmission.additionalNotes && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">Additional Notes</p>
                <p className="text-sm text-slate-700">{appt.symptomSubmission.additionalNotes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Consultation results */}
      {consultation && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Consultation Notes
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Clinical Notes</p>
              <p className="text-sm text-slate-700">{consultation.clinicalNotes}</p>
            </div>
            {consultation.diagnosis && (
              <div>
                <p className="text-xs text-slate-500 mb-1">Diagnosis</p>
                <p className="text-sm font-medium text-slate-800">{consultation.diagnosis}</p>
              </div>
            )}
            {consultation.prescription?.medications &&
              consultation.prescription.medications.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                  <Pill className="w-3.5 h-3.5" /> Prescription
                </p>
                {consultation.prescription.medications.map((med: any) => (
                  <div key={med.id} className="bg-blue-50 rounded-xl p-3 mb-2">
                    <p className="font-semibold text-blue-900">{med.name} — {med.dosage}</p>
                    <p className="text-sm text-blue-700">{med.frequency} for {med.duration}</p>
                    {med.instructions && (
                      <p className="text-xs text-blue-600 mt-1">{med.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {generatingSummary && (
            <div className="flex items-center gap-2 mt-4 text-sm text-indigo-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating patient-friendly summary...
            </div>
          )}
        </div>
      )}

      {/* Consultation Modal */}
      <Modal
        isOpen={consultationModal}
        onClose={() => setConsultationModal(false)}
        title="Complete Consultation"
        size="xl"
      >
        <form onSubmit={handleSubmit((d) => consultMutation.mutate(d))} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Textarea
            label="Clinical Notes *"
            placeholder="Document your clinical findings, observations, examination results..."
            rows={4}
            error={errors.clinicalNotes?.message}
            {...register('clinicalNotes', { required: 'Clinical notes are required' })}
          />

          <Input
            label="Diagnosis"
            placeholder="Primary diagnosis or assessment"
            {...register('diagnosis')}
          />

          <Textarea
            label="Follow-up Instructions"
            placeholder="Instructions for the patient to follow..."
            rows={2}
            {...register('followUpInstructions')}
          />

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Prescription</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => append({ name: '', dosage: '', frequency: '', duration: '', instructions: '' })}
              >
                <Plus className="w-3 h-3" /> Add Medication
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={field.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-semibold text-slate-500">Medication {i + 1}</p>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(i)}>
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Drug name" {...register(`medications.${i}.name`)} />
                    <Input placeholder="Dosage (e.g. 500mg)" {...register(`medications.${i}.dosage`)} />
                    <Input placeholder="Frequency (e.g. twice daily)" {...register(`medications.${i}.frequency`)} />
                    <Input placeholder="Duration (e.g. 7 days)" {...register(`medications.${i}.duration`)} />
                    <div className="col-span-2">
                      <Input placeholder="Special instructions" {...register(`medications.${i}.instructions`)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Alert type="info">
            After saving, an AI-generated patient-friendly summary will be created automatically and sent to the patient.
          </Alert>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setConsultationModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={consultMutation.isPending} className="flex-1">
              <Send className="w-4 h-4" />
              Save Consultation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
