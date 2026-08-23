import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UrgencyLevel } from '@prisma/client';

interface PreVisitSummaryResult {
  urgencyLevel: UrgencyLevel;
  chiefComplaint: string;
  suggestedQuestions: string[];
}

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface PostVisitSummaryResult {
  summary: string;
  medications: MedicationItem[];
  followUpSteps: string[];
}

type LLMResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export class LLMService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    if (!config.llm.apiKey) {
      logger.warn('LLM API key not configured - AI features will use fallback mode');
      return null;
    }

    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.llm.apiKey,
        baseURL: config.llm.baseUrl,
        timeout: config.llm.timeoutMs,
        maxRetries: 1,
      });
    }

    return this.client;
  }

  private async callLLM(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const client = this.getClient();
    if (!client) {
      throw new Error('LLM client not configured');
    }

    const response = await client.chat.completions.create({
      model: config.llm.model,
      temperature: config.llm.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from LLM');
    }

    return content;
  }

  /**
   * Generate a pre-visit summary from patient symptoms.
   * IMPORTANT: This is an informational summary only, NOT a medical diagnosis.
   */
  async generatePreVisitSummary(
    symptoms: {
      chiefComplaint: string;
      symptoms: string;
      duration?: string | null;
      severity?: number | null;
      additionalNotes?: string | null;
    }
  ): Promise<LLMResult<PreVisitSummaryResult>> {
    const systemPrompt = `You are a medical triage assistant helping doctors prepare for patient consultations.
IMPORTANT: You are NOT diagnosing the patient. You are providing an informational summary to help the doctor prepare.
Always respond with valid JSON matching the requested schema.
Urgency levels must be exactly: "LOW", "MEDIUM", or "HIGH".
Do not include any text outside the JSON object.`;

    const userPrompt = `Analyse these patient-reported symptoms and return a JSON object with:
- urgencyLevel: "LOW", "MEDIUM", or "HIGH" (based on reported severity)
- chiefComplaint: a concise 1-2 sentence summary of the primary concern
- suggestedQuestions: an array of exactly 3 questions the doctor should ask the patient

Patient symptoms:
Chief Complaint: ${symptoms.chiefComplaint}
Symptoms: ${symptoms.symptoms}
Duration: ${symptoms.duration || 'Not specified'}
Severity (1-10): ${symptoms.severity || 'Not specified'}
Additional Notes: ${symptoms.additionalNotes || 'None'}

Respond with exactly this JSON structure:
{
  "urgencyLevel": "LOW" | "MEDIUM" | "HIGH",
  "chiefComplaint": "...",
  "suggestedQuestions": ["...", "...", "..."]
}`;

    try {
      const rawResponse = await this.callLLM(systemPrompt, userPrompt);
      logger.debug('Pre-visit LLM raw response received');

      const parsed = JSON.parse(rawResponse);
      const result = this.validatePreVisitResponse(parsed);

      if (!result) {
        throw new Error('LLM response failed validation');
      }

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown LLM error';
      logger.error('Pre-visit LLM generation failed:', { error: errorMessage });
      return {
        success: false,
        error: `AI summary generation failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate a patient-friendly post-visit summary from clinical notes.
   */
  async generatePostVisitSummary(
    consultation: {
      clinicalNotes: string;
      diagnosis?: string | null;
      followUpInstructions?: string | null;
      prescriptionDetails?: string;
    }
  ): Promise<LLMResult<PostVisitSummaryResult>> {
    const systemPrompt = `You are a medical communication assistant helping patients understand their consultation results.
Convert clinical notes into clear, patient-friendly language.
Be compassionate, clear, and avoid medical jargon where possible.
Always respond with valid JSON matching the requested schema.
Do not include any text outside the JSON object.`;

    const userPrompt = `Convert these clinical consultation notes into a patient-friendly summary.

Clinical Notes: ${consultation.clinicalNotes}
Diagnosis/Assessment: ${consultation.diagnosis || 'To be discussed with patient'}
Follow-up Instructions: ${consultation.followUpInstructions || 'None specified'}
Prescription: ${consultation.prescriptionDetails || 'No medications prescribed'}

Respond with exactly this JSON structure:
{
  "summary": "A clear, patient-friendly 2-3 sentence summary of the consultation and what was found",
  "medications": [
    {
      "name": "medication name",
      "dosage": "dosage amount",
      "frequency": "how often to take",
      "duration": "how long to take"
    }
  ],
  "followUpSteps": [
    "Step 1...",
    "Step 2...",
    "Step 3..."
  ]
}`;

    try {
      const rawResponse = await this.callLLM(systemPrompt, userPrompt);
      logger.debug('Post-visit LLM raw response received');

      const parsed = JSON.parse(rawResponse);
      const result = this.validatePostVisitResponse(parsed);

      if (!result) {
        throw new Error('LLM response failed validation');
      }

      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown LLM error';
      logger.error('Post-visit LLM generation failed:', { error: errorMessage });
      return {
        success: false,
        error: `AI summary generation failed: ${errorMessage}`,
      };
    }
  }

  private validatePreVisitResponse(parsed: any): PreVisitSummaryResult | null {
    try {
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.chiefComplaint !== 'string' ||
        !Array.isArray(parsed.suggestedQuestions) ||
        parsed.suggestedQuestions.length < 1
      ) {
        return null;
      }

      // Normalize and validate urgency level
      const urgencyRaw = (parsed.urgencyLevel || '').toUpperCase();
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(urgencyRaw)) {
        logger.warn(`Invalid urgency level from LLM: ${urgencyRaw}, defaulting to MEDIUM`);
        parsed.urgencyLevel = 'MEDIUM';
      }

      return {
        urgencyLevel: (parsed.urgencyLevel as UrgencyLevel) || UrgencyLevel.MEDIUM,
        chiefComplaint: String(parsed.chiefComplaint).substring(0, 500),
        suggestedQuestions: parsed.suggestedQuestions
          .slice(0, 3)
          .map((q: any) => String(q).substring(0, 300)),
      };
    } catch {
      return null;
    }
  }

  private validatePostVisitResponse(parsed: any): PostVisitSummaryResult | null {
    try {
      if (!parsed || typeof parsed !== 'object' || typeof parsed.summary !== 'string') {
        return null;
      }

      const medications: MedicationItem[] = Array.isArray(parsed.medications)
        ? parsed.medications.map((m: any) => ({
            name: String(m.name || '').substring(0, 100),
            dosage: String(m.dosage || '').substring(0, 100),
            frequency: String(m.frequency || '').substring(0, 100),
            duration: String(m.duration || '').substring(0, 100),
          }))
        : [];

      const followUpSteps: string[] = Array.isArray(parsed.followUpSteps)
        ? parsed.followUpSteps.map((s: any) => String(s).substring(0, 300))
        : [];

      return {
        summary: String(parsed.summary).substring(0, 2000),
        medications,
        followUpSteps,
      };
    } catch {
      return null;
    }
  }
}

export const llmService = new LLMService();
