# 🏥 Healthcare Appointment & Follow-up Manager

A production-quality full-stack healthcare appointment, symptom analysis, consultation, and follow-up management system built with **Node.js, Express, TypeScript, React, Tailwind CSS, PostgreSQL, Prisma, BullMQ, and OpenAI**.

---

## 🌟 Highlights & Key Engineering Features

- 🔒 **Atomic Double-Booking Prevention**: 3-layer protection guarantee (Slot Hold reservation, PostgreSQL `SERIALIZABLE` transaction with `SELECT FOR UPDATE NOWAIT` row-level locks, and DB unique constraint `@@unique([doctorId, appointmentDate, startTime])`).
- 🧠 **AI Pre-Visit Symptom Summaries**: Patient symptom intake is processed by OpenAI (with fallback strategies) to generate clinical summaries and suggested questions for doctors.
- 📋 **Patient-Friendly AI Post-Visit Summaries**: Clinical notes and prescriptions are converted into layperson language with actionable follow-up steps.
- 🗓️ **Doctor Leave & Conflict Management**: Adding leave atomically converts conflicting appointments to `RESCHEDULE_REQUIRED`, sends idempotent email alerts to patients, updates in-app notifications, and cleans up calendar events in a single transaction.
- ⏰ **Idempotent Background Reminders**: BullMQ queue worker processes email retries with exponential backoff and schedules medication reminders. Operates with a DB-based fallback when Redis is offline.
- 📅 **Google Calendar OAuth 2.0 Integration**: Two-way sync creates, updates, and deletes Google Calendar events for both doctors and patients.
- 🛡️ **Role-Based Access Control (RBAC)**: JWT authentication with strict role segregation (`PATIENT`, `DOCTOR`, `ADMIN`).

---

## 📁 Repository Structure

```
healthcare-appointment-manager/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Complete relational DB schema
│   │   └── seed.ts                # Realistic demo data seeder
│   ├── src/
│   │   ├── config/                # Centralized config & DB singletons
│   │   ├── controllers/           # HTTP handlers & validators
│   │   ├── jobs/                  # BullMQ background workers & DB fallback
│   │   ├── middleware/            # JWT Auth, RBAC & Error handler
│   │   ├── routes/                # Express API routes
│   │   ├── services/              # Core business logic (Slot, Appointment, LLM, Leave)
│   │   ├── utils/                 # Winston logger & AppError
│   │   ├── app.ts                 # Express application definition
│   │   └── server.ts              # HTTP server startup & graceful shutdown
│   └── __tests__/                 # Jest tests (double-booking concurrency, LLM, Leave)
├── frontend/
│   ├── src/
│   │   ├── api/                   # Axios client & typed API methods
│   │   ├── components/            # UI kit (Badge, Button, Input, Modal, Layout)
│   │   ├── pages/                 # Patient, Doctor, and Admin portals
│   │   ├── store/                 # Auth Context & State
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx                # React Router setup with Role Guards
│   │   └── index.css              # Custom Tailwind CSS design tokens
│   ├── index.html
│   └── vite.config.ts
├── docs/
│   ├── ARCHITECTURE.md            # Architecture diagrams & sequence flows
│   ├── LLM_PROMPTS.md             # AI prompts, JSON schemas & fallbacks
│   └── GOOGLE_CALENDAR_SETUP.md   # Google OAuth 2.0 setup guide
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: Local instance or free cloud database (e.g. Supabase / Neon)
- **Redis** *(Optional)*: Required for BullMQ background workers (falls back to DB polling if offline)

---

### Step 1: Environment Setup

Create `.env` file in `backend/`:

```bash
cp backend/.env.example backend/.env
```

Configure `DATABASE_URL` in `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/healthcare_db"
JWT_SECRET="your-32-character-secret-key-goes-here"
JWT_REFRESH_SECRET="your-refresh-secret-key-goes-here"
```

---

### Step 2: Database Initialization & Seeding

```bash
cd backend

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Seed database with realistic demo data
npm run seed
```

---

### Step 3: Run Backend Server

```bash
# In backend/ directory:
npm run dev
```

The backend server will start at **`http://localhost:5000`**.

---

### Step 4: Run Frontend Client

```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend client will start at **`http://localhost:3000`**.

---

## 🔑 Pre-Configured Demo Credentials

| Role | Email | Password | Access / Features |
|---|---|---|---|
| 👑 **Admin** | `admin@healthcare.app` | `Admin123!` | Platform stats, Doctor CRUD, Specializations, System email queue |
| 🩺 **Doctor** | `sarah.mehta@healthcare.app` | `Doctor123!` | Doctor portal, Patient list, Pre-visit AI summaries, Consultations, Leave mgmt |
| 🩺 **Doctor** | `james.chen@healthcare.app` | `Doctor123!` | Cardiology specialist, Working hours, Appointments |
| 🏥 **Patient** | `john.smith@example.com` | `Patient123!` | Patient portal, Find doctors, Slot holding & booking, Symptoms, Post-visit summaries |
| 🏥 **Patient** | `emily.johnson@example.com` | `Patient123!` | Patient portal, Upcoming appointments |

---

## 🧪 Testing & Verification

### Running Automated Unit & Concurrency Tests

```bash
cd backend

# Run Jest tests
npm test
```

### Double-Booking Concurrency Verification

To verify that concurrent booking requests for the exact same slot result in **exactly 1 success** and **4 failures**:

```bash
npx jest __tests__/double-booking.test.ts
```

The test fires 5 simultaneous `Promise.all()` booking requests against the PostgreSQL database transaction layer.

---

## ⚙️ Architecture & Design Decisions

### 1. Concurrency Model
The platform guarantees zero double-bookings through three security layers:
1. **Application Layer (Slot Hold)**: Temporary 5-minute reservation stored in `SlotHold` table.
2. **Transaction Layer (Row Locking)**: PostgreSQL `SERIALIZABLE` isolation level executing `SELECT ... FOR UPDATE NOWAIT`.
3. **Database Storage Layer (Unique Index)**: Unique composite index `@@unique([doctorId, appointmentDate, startTime])`.

### 2. LLM Resiliency Architecture
All LLM API calls are wrapped in non-blocking try-catch blocks with validation fallbacks:
- If `OPENAI_API_KEY` is missing or the API times out, the system generates fallback summaries and flags `status: FAILED`.
- **Core appointment booking and doctor consultations ALWAYS complete**, regardless of AI status.

### 3. Doctor Leave Atomicity
Adding doctor leave updates all affected appointments to `RESCHEDULE_REQUIRED` and queues patient notification emails within a single atomic Prisma transaction.

---

## 📄 Documentation Links

- 📐 [Architecture & Diagrams (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
- 🤖 [LLM Prompts & Schemas (`docs/LLM_PROMPTS.md`)](docs/LLM_PROMPTS.md)
- 📅 [Google Calendar Integration Guide (`docs/GOOGLE_CALENDAR_SETUP.md`)](docs/GOOGLE_CALENDAR_SETUP.md)

---

## 📜 License

This project is licensed under the MIT License.
