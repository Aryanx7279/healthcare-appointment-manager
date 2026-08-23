# System Architecture & Technical Specifications

This document describes the design decisions, component interactions, database locking strategies, and concurrency mechanisms of the Healthcare Appointment & Follow-up Manager.

---

## 1. System Architecture Diagram

```mermaid
graph TD
    Client[React Frontend] -->|REST API + Bearer JWT| Express[Express.js API Server]
    
    Express --> Auth[Auth & RBAC Middleware]
    Express --> Lock[Slot Hold & Concurrency Engine]
    Express --> LLM[LLM Service - OpenAI Abstraction]
    Express --> Email[Email Service - Idempotent Queue]
    Express --> Calendar[Google Calendar Service]
    
    Lock -->|Serializable TX + FOR UPDATE NOWAIT| DB[(PostgreSQL Database)]
    Email -->|Idempotency Key| DB
    
    subgraph Async Workers [Background Processing]
        BullMQ[BullMQ Job Queues] -->|Worker Process| EmailWorker[Email Retry & Dispatcher]
        BullMQ -->|Worker Process| ReminderWorker[Medication Reminders]
        BullMQ -->|Worker Process| HoldCleaner[Slot Hold Expiration Cleaner]
        BullMQ -->|Redis Broker| Redis[(Redis Server)]
    end
    
    Express -.->|Fallback if Redis down| DBPolling[DB-based Polling Engine]
```

---

## 2. Double-Booking Prevention Strategy (3-Layer Security)

Double-booking is physically impossible in this platform due to three layered mechanisms:

```
[User Action: Book Slot]
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Slot Hold Reservation                              │
│ • Patient holds slot for 5 mins (SlotHold record)           │
│ • Checked before transaction entry                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Row-Level Locking (Pessimistic)                     │
│ • BEGIN TRANSACTION (Isolation: SERIALIZABLE)               │
│ • SELECT ... FOR UPDATE NOWAIT on existing appointments     │
│ • Immediate 409 error if locked by concurrent transaction   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: DB-Level Unique Constraint (Hard Invariant)        │
│ • @@unique([doctorId, appointmentDate, startTime])          │
│ • Enforced atomically at PostgreSQL storage engine layer    │
│ • Error code P2002 mapped to SLOT_ALREADY_BOOKED (409)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Booking Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Patient
    participant API as Express API
    participant SlotSvc as Slot Service
    participant ApptSvc as Appointment Service
    participant DB as PostgreSQL
    participant Worker as BullMQ / Email

    Patient->>API: POST /api/appointments/hold
    API->>SlotSvc: holdSlot(doctorId, date, time)
    SlotSvc->>DB: INSERT into SlotHold (status=ACTIVE, expiresAt=+5min)
    DB-->>SlotSvc: SlotHold record
    SlotSvc-->>Patient: holdId & expiresAt timestamp

    Patient->>API: POST /api/appointments (holdId, symptoms)
    API->>ApptSvc: bookAppointment(...)
    ApptSvc->>DB: BEGIN TRANSACTION (SERIALIZABLE)
    ApptSvc->>DB: SELECT FOR UPDATE NOWAIT (check existing)
    ApptSvc->>DB: INSERT into Appointment (status=CONFIRMED)
    ApptSvc->>DB: UPDATE SlotHold (status=CONVERTED)
    ApptSvc->>DB: COMMIT TRANSACTION
    DB-->>ApptSvc: Appointment created

    ApptSvc-->>API: Appointment details
    API-->>Patient: 201 Created

    par Non-blocking Async Operations
        ApptSvc->>Worker: Queue confirmation email (idempotent key)
        ApptSvc->>Worker: Sync Google Calendar event
        ApptSvc->>API: Trigger background LLM pre-visit summary
    end
```

---

## 4. Doctor Leave & Conflict Resolution Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Doctor
    participant API as Express API
    participant LeaveSvc as Leave Service
    participant DB as PostgreSQL
    participant Notif as Notification Svc
    participant Email as Email Svc

    Doctor->>API: POST /api/doctors/me/leaves { date: "2026-08-25" }
    API->>LeaveSvc: addLeave(doctorId, date)
    
    LeaveSvc->>DB: BEGIN TRANSACTION
    LeaveSvc->>DB: INSERT into DoctorLeave
    LeaveSvc->>DB: SELECT affected appointments WHERE date = "2026-08-25"
    LeaveSvc->>DB: UPDATE affected status = RESCHEDULE_REQUIRED
    LeaveSvc->>DB: COMMIT TRANSACTION

    loop For each affected appointment
        LeaveSvc->>Notif: Create in-app notification (DOCTOR_LEAVE_CONFLICT)
        LeaveSvc->>Email: Queue leave conflict email to patient
        LeaveSvc->>API: Delete Google Calendar event
    end

    LeaveSvc-->>Doctor: Affected appointments count & details
```

---

## 5. Security & RBAC Matrix

| Endpoint | PATIENT | DOCTOR | ADMIN | Unauthenticated |
|---|:---:|:---:|:---:|:---:|
| `POST /api/auth/register` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/login` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/doctors` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/appointments/hold` | ✅ | ❌ | ❌ | ❌ |
| `POST /api/appointments` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/appointments/me` | ✅ | ❌ | ❌ | ❌ |
| `POST /api/appointments/:id/symptoms` | ✅ | ❌ | ❌ | ❌ |
| `POST /api/appointments/:id/consultation` | ❌ | ✅ | ❌ | ❌ |
| `POST /api/doctors/me/leaves` | ❌ | ✅ | ❌ | ❌ |
| `GET /api/admin/*` | ❌ | ❌ | ✅ | ❌ |
