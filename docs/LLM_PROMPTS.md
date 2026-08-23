# AI / LLM Integration & Prompt Engineering Guide

This document details the prompt engineering, JSON schema enforcement, and fallback handling strategies for the AI features in the Healthcare Appointment & Follow-up Manager.

---

## 1. Pre-Visit Symptom Summary

### System Prompt
```text
You are a expert clinical intake AI assistant. Your job is to analyze patient-submitted symptoms and produce a structured, high-accuracy pre-visit summary for the doctor.

CRITICAL REQUIREMENTS:
1. Assess urgency level based strictly on symptoms provided: LOW, MEDIUM, or HIGH.
2. HIGH urgency includes: chest pain, severe shortness of breath, sudden numbness, high fever in infants/elderly, severe head trauma, or uncontrollable bleeding.
3. Suggest 3 concise, relevant clinical questions for the doctor to ask during the consultation.
4. Output MUST be valid JSON strictly matching the requested schema. Do not include markdown codeblocks or conversational text.
```

### JSON Schema
```json
{
  "urgencyLevel": "LOW | MEDIUM | HIGH",
  "chiefComplaint": "string (concise 1-2 sentence clinical summary)",
  "suggestedQuestions": [
    "string (question 1)",
    "string (question 2)",
    "string (question 3)"
  ]
}
```

### Response Validation & Normalization
```typescript
// Enforce valid UrgencyLevel enum in backend (llm.service.ts)
const validUrgency: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'HIGH',
  URGENT: 'HIGH',
  MODERATE: 'MEDIUM',
};
const urgencyLevel = validUrgency[parsed.urgencyLevel?.toUpperCase()] || 'MEDIUM';
```

---

## 2. Patient-Friendly Post-Visit Summary

### System Prompt
```text
You are a compassionate medical communicator. Convert doctor's clinical notes and prescription details into clear, patient-friendly language.

CRITICAL REQUIREMENTS:
1. Avoid complex medical jargon (e.g., replace "dyspnea" with "shortness of breath", "cephalea" with "headache").
2. Format medications into clear list items: name, dosage, frequency, duration.
3. Provide actionable step-by-step follow-up instructions.
4. Output MUST be valid JSON matching the schema.
```

### JSON Schema
```json
{
  "summary": "string (layperson-friendly visit summary)",
  "medications": [
    {
      "name": "string",
      "dosage": "string",
      "frequency": "string",
      "duration": "string"
    }
  ],
  "followUpSteps": [
    "string (step 1)",
    "string (step 2)"
  ]
}
```

---

## 3. Fallback & Failure Strategies

| Failure Mode | Detection | System Behavior | User Impact |
|---|---|---|---|
| **Missing `OPENAI_API_KEY`** | `process.env.OPENAI_API_KEY` empty | Returns fallback mock responses | App operates normally, pre/post summaries show fallback indicator |
| **API Timeout / Rate Limit** | Request exceeds 15s or 429 status | Sets `status: FAILED` in DB, logs error | Appointment booking/consultation succeeds; summary shows retry prompt |
| **Invalid JSON Response** | `JSON.parse()` exception | Retries with repaired prompt; falls back if second attempt fails | No crash; original symptom notes remain available to doctor |
| **Malformed Fields** | Runtime type check fails | Normalizes invalid values to safe defaults | UI displays safe fallback data |

---

## 4. Safety & Disclaimer Requirements

Every patient-facing AI output displays the following mandatory disclaimer:

> **Medical Safety Disclaimer:** AI-generated summaries are for informational and preparation purposes only. They do NOT constitute medical advice, diagnosis, or treatment recommendations. Always follow the explicit instructions of your healthcare provider.
