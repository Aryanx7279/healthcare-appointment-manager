import api from './client';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.patch('/auth/profile', data),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

// ─── Doctors ──────────────────────────────────────────────────────────────────
export const doctorsApi = {
  list: (params?: { specialization?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/doctors', { params }),
  getById: (id: string) => api.get(`/doctors/${id}`),
  getSlots: (doctorId: string, date: string) =>
    api.get(`/doctors/${doctorId}/slots`, { params: { date } }),
  getMyProfile: () => api.get('/doctors/me/profile'),
  getWorkingHours: () => api.get('/doctors/me/working-hours'),
  upsertWorkingHour: (data: any) => api.put('/doctors/me/working-hours', data),
  getLeaves: () => api.get('/doctors/me/leaves'),
  addLeave: (date: string, reason?: string) =>
    api.post('/doctors/me/leaves', { date, reason }),
  removeLeave: (date: string) => api.delete(`/doctors/me/leaves/${date}`),
};

// ─── Appointments ─────────────────────────────────────────────────────────────
export const appointmentsApi = {
  holdSlot: (data: { doctorId: string; date: string; startTime: string; endTime: string }) =>
    api.post('/appointments/hold', data),
  book: (data: {
    doctorId: string;
    date: string;
    startTime: string;
    endTime: string;
    holdId?: string;
    notes?: string;
  }) => api.post('/appointments', data),
  list: (params?: { status?: string; date?: string }) =>
    api.get('/appointments', { params }),
  getById: (id: string) => api.get(`/appointments/${id}`),
  cancel: (id: string, reason?: string) =>
    api.post(`/appointments/${id}/cancel`, { reason }),
  reschedule: (id: string, data: { newDate: string; newStartTime: string; newEndTime: string }) =>
    api.post(`/appointments/${id}/reschedule`, data),
  submitSymptoms: (appointmentId: string, data: {
    chiefComplaint: string;
    symptoms: string;
    duration?: string;
    severity?: number;
    additionalNotes?: string;
  }) => api.post(`/appointments/${appointmentId}/symptoms`, data),
  getPreVisitSummary: (appointmentId: string) =>
    api.get(`/appointments/${appointmentId}/previsit-summary`),
  submitConsultation: (appointmentId: string, data: any) =>
    api.post(`/appointments/${appointmentId}/consultation`, data),
};

// ─── Consultations ────────────────────────────────────────────────────────────
export const consultationsApi = {
  getById: (consultationId: string) => api.get(`/consultations/${consultationId}`),
  generatePostVisitSummary: (consultationId: string) =>
    api.post(`/consultations/${consultationId}/postvisit-summary`),
};

// ─── Specializations ──────────────────────────────────────────────────────────
export const specializationsApi = {
  list: () => api.get('/specializations'),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};

// ─── Calendar ─────────────────────────────────────────────────────────────────
export const calendarApi = {
  getStatus: () => api.get('/calendar/status'),
  initiateConnect: () => api.get('/calendar/connect'),
  disconnect: () => api.delete('/calendar/disconnect'),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getDoctors: (params?: any) => api.get('/doctors', { params }),
  createDoctor: (data: any) => api.post('/admin/doctors', data),
  updateDoctor: (id: string, data: any) => api.patch(`/admin/doctors/${id}`, data),
  deactivateDoctor: (id: string) => api.delete(`/admin/doctors/${id}/deactivate`),
  getPatients: (params?: any) => api.get('/admin/patients', { params }),
  getSpecializations: () => api.get('/admin/specializations'),
  createSpecialization: (data: { name: string; description?: string }) =>
    api.post('/admin/specializations', data),
  addDoctorLeave: (doctorId: string, data: { date: string; reason?: string }) =>
    api.post(`/admin/doctors/${doctorId}/leave`, data),
  removeDoctorLeave: (doctorId: string, date: string) =>
    api.delete(`/admin/doctors/${doctorId}/leave/${date}`),
  setWorkingHours: (doctorId: string, data: any) =>
    api.post(`/admin/doctors/${doctorId}/working-hours`, data),
  getEmailJobs: (params?: { status?: string }) =>
    api.get('/admin/email-jobs', { params }),
  getAppointments: (params?: any) => api.get('/appointments', { params }),
};

// ─── AI Assistant ─────────────────────────────────────────────────────────────
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const aiApi = {
  chat: (messages: AiChatMessage[]) => api.post('/ai/chat', { messages }),
};
