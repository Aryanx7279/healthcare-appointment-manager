# Google Calendar OAuth 2.0 Integration Guide

This guide explains how to set up Google OAuth 2.0 credentials and integrate Google Calendar with the Healthcare Appointment & Follow-up Manager.

---

## 1. Setting Up Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `Healthcare-Appointment-Manager`.
3. In the left navigation menu, go to **APIs & Services** > **Library**.
4. Search for **Google Calendar API** and click **Enable**.

---

## 2. Configuring OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**.
2. Select **User Type**: `External` (or `Internal` if using Google Workspace).
3. Fill in the App Information:
   - App Name: `HealthCare Appointment Manager`
   - User Support Email: your email
   - Developer Contact Email: your email
4. Click **Save and Continue**.
5. Under **Scopes**, add the scope: `https://www.googleapis.com/auth/calendar.events`.
6. Under **Test Users**, add your Google account email for local testing.

---

## 3. Creating OAuth Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Healthcare API Web Client`.
5. Authorized JavaScript origins:
   - `http://localhost:5000`
   - `http://localhost:3000`
6. Authorized redirect URIs:
   - `http://localhost:5000/api/calendar/callback`
7. Click **Create**.
8. Copy the **Client ID** and **Client Secret**.

---

## 4. Environment Variables Configuration

Add the credentials to `backend/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/callback
```

---

## 5. Testing Calendar Sync Flow

1. Log in to the application as a Patient or Doctor.
2. Go to the Calendar settings page (`/patient/calendar` or `/doctor/schedule`).
3. Click **Connect Google Calendar**. You will be redirected to Google's consent page.
4. Grant permission for Calendar access.
5. After granting access, you will be redirected back to the application.
6. Book a new appointment.
7. Open [Google Calendar](https://calendar.google.com/) — an event will automatically appear with:
   - Appointment date and time range
   - Doctor and patient details
   - Specialization information
   - Automated email & popup reminders

---

## 6. Token Refresh & Resilience

- Tokens are automatically refreshed when expired using the stored `refreshToken`.
- If Google API is unreachable, calendar failures are logged as non-blocking warnings and **never crash appointment booking**.
