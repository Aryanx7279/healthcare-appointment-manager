import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { doctorsApi, appointmentsApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Alert, LoadingSpinner } from '../../components/ui/Alert';
import { useForm } from 'react-hook-form';
import { format, addDays } from 'date-fns';
import { Calendar, Clock, ChevronLeft, CheckCircle, Loader2, Brain, Heart, Mail, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'slot' | 'symptoms' | 'confirm' | 'success';

interface SymptomForm {
  chiefComplaint: string; symptoms: string;
  duration?: string; severity?: string; additionalNotes?: string;
}

const SEVERITY_LABELS: Record<number, string> = {
  1:'Very mild', 2:'Mild', 3:'Mild', 4:'Moderate', 5:'Moderate',
  6:'Moderate', 7:'Severe', 8:'Severe', 9:'Very severe', 10:'Critical',
};

const STEPS = [
  { key: 'slot',     label: 'Date & Slot', num: 1 },
  { key: 'symptoms', label: 'Symptoms',    num: 2 },
  { key: 'confirm',  label: 'Confirmed',   num: 3 },
];

export function BookAppointmentPage() {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate     = useNavigate();

  const [step,              setStep]              = useState<Step>('slot');
  const [selectedDate,      setSelectedDate]      = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedSlot,      setSelectedSlot]      = useState<{ startTime: string; endTime: string } | null>(null);
  const [holdId,            setHoldId]            = useState<string | null>(null);
  const [holdExpiry,        setHoldExpiry]        = useState<Date | null>(null);
  const [bookingStatus,     setBookingStatus]     = useState('');
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);
  const [error,             setError]             = useState('');

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ['doctor', doctorId],
    queryFn: () => doctorsApi.getById(doctorId!).then(r => r.data.data),
    enabled: !!doctorId,
  });

  // Automatically select the first available working day when doctor data is loaded
  React.useEffect(() => {
    if (doctor?.workingHours && doctor.workingHours.length > 0) {
      const dayMap: Record<string, number> = {
        SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
      };
      const activeDays = new Set(doctor.workingHours.map((wh: any) => dayMap[wh.dayOfWeek]));
      
      let current = addDays(new Date(), 1);
      // Scan up to 7 days ahead
      for (let i = 0; i < 7; i++) {
        if (activeDays.has(current.getDay())) {
          setSelectedDate(format(current, 'yyyy-MM-dd'));
          break;
        }
        current = addDays(current, 1);
      }
    }
  }, [doctor]);

  const { data: slots, isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: ['slots', doctorId, selectedDate],
    queryFn: () => doctorsApi.getSlots(doctorId!, selectedDate).then(r => r.data.data),
    enabled: !!doctorId && !!selectedDate,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<SymptomForm>();

  const holdMutation = useMutation({
    mutationFn: (slot: { startTime: string; endTime: string }) =>
      appointmentsApi.holdSlot({ doctorId: doctorId!, date: selectedDate, ...slot }),
    onSuccess: (res) => {
      const { holdId: hId, expiresAt } = res.data.data;
      setHoldId(hId); setHoldExpiry(new Date(expiresAt)); setStep('symptoms');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || 'Slot is no longer available');
      refetchSlots();
    },
  });

  const bookMutation = useMutation({
    mutationFn: async (symptoms: SymptomForm) => {
      setBookingStatus('Confirming appointment…');
      const apptRes = await appointmentsApi.book({
        doctorId: doctorId!, date: selectedDate,
        startTime: selectedSlot!.startTime, endTime: selectedSlot!.endTime,
        holdId: holdId || undefined, notes: symptoms.chiefComplaint,
      });
      const appt = apptRes.data.data;
      setBookingStatus('Submitting symptoms…');
      try {
        await appointmentsApi.submitSymptoms(appt.id, {
          chiefComplaint: symptoms.chiefComplaint, symptoms: symptoms.symptoms,
          duration: symptoms.duration,
          severity: symptoms.severity ? parseInt(symptoms.severity) : undefined,
          additionalNotes: symptoms.additionalNotes,
        });
      } catch { /* symptoms can fail without breaking the appointment */ }
      return appt;
    },
    onSuccess: (appt) => {
      setBookedAppointment(appt); setStep('success');
      toast.success('Appointment booked successfully!');
    },
    onError: (err: any) => {
      const code = err.response?.data?.error?.code;
      const msg  = err.response?.data?.error?.message;
      if (code === 'SLOT_ALREADY_BOOKED' || code === 'HOLD_EXPIRED') {
        setError(msg || 'This slot is no longer available. Please select another.');
        setStep('slot'); setSelectedSlot(null); refetchSlots();
      } else {
        setError(msg || 'Booking failed. Please try again.');
      }
    },
    onSecondary: () => {},
    onSettled: () => setBookingStatus(''),
  });

  const handleSlotSelect = (slot: { startTime: string; endTime: string }) => {
    setSelectedSlot(slot); setError(''); holdMutation.mutate(slot);
  };

  if (doctorLoading) return <div className="p-12 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (!doctor)       return <div className="p-8 text-center" style={{ color: 'var(--text-3)' }}>Doctor not found</div>;

  const stepIdx = STEPS.findIndex(s => s.key === (step === 'success' ? 'confirm' : step));

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-sm mb-6 transition-colors"
        style={{ color: 'var(--text-3)' }}
        onClick={() => step === 'slot' ? navigate('/patient/doctors') : setStep('slot')}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--primary)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}>
        <ChevronLeft className="w-4 h-4" />
        {step === 'slot' ? 'Back to Doctors' : 'Back to slot selection'}
      </button>

      {/* Doctor info card */}
      <div className="card p-5 mb-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563EB, #0891B2)', fontFamily: 'Manrope, sans-serif' }}>
          {doctor.user.firstName[0]}{doctor.user.lastName[0]}
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Dr. {doctor.user.firstName} {doctor.user.lastName}
          </h2>
          <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{doctor.specialization?.name}</p>
          {doctor.bio && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{doctor.bio}</p>}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)', display: 'inline-block' }} />
          Available
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-5">
        {STEPS.map((s, i) => {
          const done   = i < stepIdx || step === 'success';
          const active = i === stepIdx && step !== 'success';
          return (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: done ? 'var(--success)' : active ? 'var(--primary)' : 'var(--surface-3)',
                    color: (done || active) ? '#fff' : 'var(--text-muted)',
                  }}>
                  {done ? '✓' : s.num}
                </div>
                <span className="text-xs font-semibold hidden sm:block"
                  style={{ color: active ? 'var(--primary)' : done ? 'var(--success)' : 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 rounded"
                  style={{ background: i < stepIdx ? 'var(--success)' : 'var(--border)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && <Alert type="error" className="mb-4">{error}</Alert>}

      {/* ── STEP 1: Slot Selection ──────────────────────────────────────────── */}
      {step === 'slot' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif' }}>Select Date & Time</h3>
          </div>

          {/* Date */}
          <div>
            <label className="label">Choose a date</label>
            <input type="date" className="input"
              value={selectedDate}
              min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              max={format(addDays(new Date(), 90), 'yyyy-MM-dd')}
              onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null); }} />
          </div>

          {/* Slots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label" style={{ marginBottom: 0 }}>Available Time Slots</label>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--primary-light)', display: 'inline-block' }} /> Available</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ background: 'var(--surface-3)', display: 'inline-block' }} /> Unavailable</span>
              </div>
            </div>

            {slotsLoading ? (
              <div className="py-8"><LoadingSpinner /></div>
            ) : !slots || slots.length === 0 ? (
              <div className="py-10 text-center rounded-xl" style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)' }}>
                <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--primary-mid)' }} />
                <p className="font-semibold text-sm" style={{ color: 'var(--text-2)' }}>No slots available on this date</p>
                <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Please select a working day from the schedule below:</p>
                
                {doctor?.workingHours && doctor.workingHours.length > 0 ? (
                  <div className="max-w-xs mx-auto text-left bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-sm">
                    <p className="font-bold text-slate-800 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Weekly Schedule:</p>
                    {doctor.workingHours.map((wh: any) => (
                      <div key={wh.id} className="flex justify-between text-slate-600">
                        <span className="font-semibold">{wh.dayOfWeek}</span>
                        <span>{wh.startTime} - {wh.endTime}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Please try a different date</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot: any) => (
                  <button key={slot.startTime}
                    disabled={!slot.isAvailable || holdMutation.isPending}
                    onClick={() => handleSlotSelect(slot)}
                    className="py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-150"
                    style={{
                      background: !slot.isAvailable ? 'var(--surface-3)' : 'var(--primary-light)',
                      border: `1.5px solid ${!slot.isAvailable ? 'var(--border)' : 'var(--primary-mid)'}`,
                      color: !slot.isAvailable ? 'var(--text-muted)' : 'var(--primary)',
                      cursor: !slot.isAvailable ? 'not-allowed' : 'pointer',
                      opacity: holdMutation.isPending ? 0.6 : 1,
                      fontFamily: 'Manrope, sans-serif',
                    }}
                    onMouseEnter={e => { if (slot.isAvailable && !holdMutation.isPending) { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}}
                    onMouseLeave={e => { if (slot.isAvailable) { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}}>
                    {slot.isAvailable ? slot.startTime : (
                      <span className="text-xs">{slot.isHeld ? '🔒 Held' : '✗ Booked'}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {holdMutation.isPending && (
              <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: 'var(--primary)' }}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reserving slot…
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 2: Symptoms ─────────────────────────────────────────────────── */}
      {step === 'symptoms' && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h3 className="font-bold text-base" style={{ fontFamily: 'Manrope, sans-serif' }}>Tell Us About Your Symptoms</h3>
          </div>
          <p className="text-sm mb-5" style={{ color: 'var(--text-3)' }}>
            This helps your doctor prepare. An AI summary will be generated to assist with your consultation.
          </p>

          {holdExpiry && (
            <Alert type="info" className="mb-4">
              ⏱ Slot reserved until <strong>{format(holdExpiry, 'HH:mm')}</strong> — please complete your booking within this time.
            </Alert>
          )}

          {/* AI badge */}
          <div className="flex items-start gap-3 p-4 rounded-xl mb-5"
            style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary-mid)' }}>
            <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--primary)' }}>
              <strong>AI Pre-Visit Summary:</strong> Your symptoms will be analyzed by our AI to generate a pre-visit summary for your doctor. This is informational only and is <strong>not a medical diagnosis</strong>. For emergencies, call emergency services immediately.
            </p>
          </div>

          <form onSubmit={handleSubmit(d => bookMutation.mutate(d))} className="space-y-4">
            <Textarea label="Chief Complaint *" placeholder="e.g., Persistent headaches for the past 3 days" rows={2}
              error={errors.chiefComplaint?.message} {...register('chiefComplaint', { required: 'Chief complaint is required' })} />

            <Textarea label="Describe Your Symptoms *" rows={4}
              placeholder="Describe when they started, what makes them better or worse, any other symptoms…"
              error={errors.symptoms?.message} {...register('symptoms', { required: 'Please describe your symptoms' })} />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Duration" placeholder="e.g., 3 days, 2 weeks" {...register('duration')} />
              <Select label="Severity (1–10)"
                options={[{ value: '', label: 'Select severity' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i+1), label: `${i+1} — ${SEVERITY_LABELS[i+1]}` }))]}
                {...register('severity')} />
            </div>

            <Textarea label="Additional Notes (optional)" rows={2}
              placeholder="Current medications, allergies, recent test results…" {...register('additionalNotes')} />

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" onClick={() => setStep('slot')}>Back</Button>
              <Button type="submit" isLoading={bookMutation.isPending} className="flex-1">
                {bookMutation.isPending ? bookingStatus || 'Booking…' : 'Confirm Appointment'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP: Success ────────────────────────────────────────────────────── */}
      {step === 'success' && bookedAppointment && (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--success-light)' }}>
            <CheckCircle className="w-8 h-8" style={{ color: 'var(--success)' }} />
          </div>
          <h3 className="text-xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>
            Appointment Confirmed!
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-3)' }}>
            Your appointment has been booked. A confirmation email has been sent.
          </p>

          {/* Summary */}
          <div className="rounded-xl p-5 mb-5 text-left" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Doctor',         value: `Dr. ${bookedAppointment.doctor.user.firstName} ${bookedAppointment.doctor.user.lastName}` },
                { label: 'Specialization', value: bookedAppointment.doctor.specialization.name },
                { label: 'Date',           value: format(new Date(bookedAppointment.appointmentDate), 'EEEE, MMMM d, yyyy') },
                { label: 'Time',           value: `${bookedAppointment.startTime} – ${bookedAppointment.endTime}` },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'Manrope, sans-serif' }}>{item.label}</p>
                  <p className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--text)' }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Status chips */}
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <Mail className="w-3 h-3" /> Confirmation email sent
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Sparkles className="w-3 h-3" /> AI summary processing
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/patient/appointments')}>
              My Appointments
            </Button>
            <Button className="flex-1" onClick={() => navigate(`/patient/appointments/${bookedAppointment.id}`)}>
              View Details
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
