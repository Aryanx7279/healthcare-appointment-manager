# System Design Write-up (Deliverable #4)

This document explains the core architectural and concurrency designs of the Healthcare Appointment & Follow-up Manager, covering slot conflict resolution, transactional consistency, and background job reliability.

---

## 1. Slot Hold Mechanism (Temporary Reservation)
To prevent the "checkout race condition" where two patients select the same time slot simultaneously and enter symptom details, the platform implements a **Temporal TTL-based Slot Hold**:
* **Operation**: When a patient selects a doctor and slot, the frontend triggers `POST /api/appointments/hold`. This inserts a record into the `SlotHold` table with an expiration timestamp (`expiresAt = NOW() + 5 minutes`).
* **Enforcement**: While a slot has an active, unexpired hold (and is not yet booked), the backend excludes it from available slots returned to other patients.
* **Resolution**: When the booking is submitted, the hold is converted to `CONVERTED`. If the booking is abandoned, a background cleaner deletes expired holds, releasing the slots back to the public pool automatically.

---

## 2. Double-Booking Prevention (Safe Concurrency)
If two concurrent requests attempt to book the exact same slot at the exact same millisecond, the platform employs a **3-Layer Concurrency Protection Engine**:
1. **Application Layer (State Check)**: Check for active slot holds or existing appointments before entering the transaction.
2. **Transaction Layer (Pessimistic Row-Level Locking)**:
   - The booking query executes inside a database transaction with a **`SERIALIZABLE`** isolation level.
   - It performs a `SELECT ... FOR UPDATE NOWAIT` query on existing appointments matching the target doctor, date, and time.
   - If transaction A is in progress, transaction B will immediately fail with a `409 Conflict` database exception rather than blocking/hanging (due to `NOWAIT`).
3. **Database Constraints (Storage Invariant)**:
   - A unique composite index exists on the database storage layer:
     `@@unique([doctorId, appointmentDate, startTime])`
   - In the rare event that serialization checks bypass, PostgreSQL guarantees database integrity by throwing a `P2002 Unique Constraint Violation` error, which the backend catches and maps to a clean `SLOT_ALREADY_BOOKED` API response.

---

## 3. Doctor Leave Conflict Handling
When a doctor registers a leave day, any pre-existing appointments on that day must be handled atomically to avoid leaving the system in an inconsistent state:
* **Atomic State Updates**: The leave creation, fetching of conflicting appointments, and marking them as `RESCHEDULE_REQUIRED` are wrapped in a single database transaction. This ensures that either the leave is registered and all conflicts are flagged, or nothing changes.
* **Clean-up Triggers**: Once the transaction succeeds, the service triggers non-blocking asynchronous hooks:
  - **In-app Alert**: Inserts a notification record in the DB for the patient.
  - **Email Dispatch**: Queues rescheduling alert emails to the affected patients.
  - **Google Calendar Sync**: Deletes the calendar events for the conflicting appointments to free up both the doctor's and patient's schedules.

---

## 4. Notification & Email Failure Handling
For transactional emails (booking confirmations, reminders, and leave cancellations), delivery failures are handled via an **Idempotent Job Queue**:
* **Queue Architecture**: Emails are queued as jobs in the `EmailJob` table with a state of `PENDING`.
* **Idempotency Guarantee**: Every job is assigned a unique `idempotencyKey` derived from the event type and entity IDs (e.g. `appt_confirm_123`). Before executing any email dispatch, the worker checks if a job with the same key has already run, preventing duplicate emails.
* **Retry Engine (Exponential Backoff)**: If the Resend SMTP server is temporarily offline, the worker catches the failure, increments the `attempts` count, and marks the job as `FAILED`. A scheduler picks it up and retries with an exponential backoff delay (e.g., 2m, 4m, 8m).
* **DB Polling Fallback**: While BullMQ/Redis is preferred, a database-based fallback polling worker activates automatically if Redis is offline (e.g. in single-container hosting environments like Railway's free tier). The polling engine regularly queries the database for `PENDING` or retry-eligible `FAILED` jobs, ensuring zero notification loss.
