import OpenAI from 'openai';
// Force reload on env change - compound model
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  userRole: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  userId: string;
  userName: string;
}

export interface ChatAction {
  type: 'navigate';
  path: string;
  label: string;
}

export interface ChatResponse {
  reply: string;
  suggestions: string[];
  action?: ChatAction;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class AiChatService {
  private client: OpenAI | null = null;

  private getClient(): OpenAI | null {
    if (!config.llm.apiKey) return null;
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

  async chat(messages: ChatMessage[], context: ChatContext): Promise<ChatResponse> {
    const client = this.getClient();

    if (!client) {
      logger.warn('AI Chat: LLM key not configured — returning fallback response');
      return {
        reply:
          "I'm sorry, the AI assistant isn't configured yet. Please ask your administrator to add an OpenAI API key to enable this feature.",
        suggestions: ['Browse doctors', 'My appointments', 'Contact support'],
      };
    }

    // Fetch live platform data to ground the AI's answers
    const [specializations, doctors] = await Promise.all([
      prisma.specialization.findMany({ select: { id: true, name: true } }),
      prisma.doctorProfile.findMany({
        where: { isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true } },
          specialization: { select: { name: true } },
        },
        take: 30,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const specializationList = specializations.map((s) => s.name).join(', ');
    const doctorList = doctors
      .map(
        (d) =>
          `Dr. ${d.user.firstName} ${d.user.lastName} — ${d.specialization?.name ?? 'General'} (id: ${d.id})`
      )
      .join('\n');

    const systemPrompt = this.buildSystemPrompt(context, specializationList, doctorList);

    try {
      const response = await client.chat.completions.create({
        model: config.llm.model,
        temperature: 0.65,
        // Note: do NOT use response_format: json_object — not supported by all Groq models.
        // Instead we instruct via the system prompt and extract JSON manually below.
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });

      const raw = response.choices[0]?.message?.content;
      if (!raw) throw new Error('Empty LLM response');

      logger.debug('AI Chat raw response received', { length: raw.length });

      // Robustly extract the JSON object from the response (handles markdown code fences etc.)
      const parsed = this.extractJson(raw);
      return this.validateResponse(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Log the full error so we can diagnose in backend logs
      logger.error('AI Chat LLM error:', { error: msg, model: config.llm.model, baseUrl: config.llm.baseUrl });
      return {
        reply:
          "I'm having a little trouble right now. Please try again in a moment or use the app normally.",
        suggestions: ['Try again', 'Browse doctors', 'View appointments'],
      };
    }
  }

  // ─── JSON Extraction ──────────────────────────────────────────────────────────
  // Handles: raw JSON, ```json ... ```, ``` ... ```, or JSON embedded in text

  private extractJson(raw: string): any {
    // 1. Try direct parse first
    try { return JSON.parse(raw); } catch { /* fall through */ }

    // 2. Try extracting from markdown code fences
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1].trim()); } catch { /* fall through */ }
    }

    // 3. Try extracting the first { ... } block
    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
    }

    // 4. Return the raw text as the reply field
    logger.warn('AI Chat: could not parse JSON, returning raw text');
    return { reply: raw.substring(0, 500), suggestions: ['Try again', 'Browse doctors'] };
  }


  // ─── System Prompt ──────────────────────────────────────────────────────────

  private buildSystemPrompt(
    context: ChatContext,
    specializations: string,
    doctors: string
  ): string {
    const { userRole, userName } = context;

    const roleInstructions =
      userRole === 'PATIENT'
        ? `You help this patient:
- Understand which medical specialist is right for their symptoms (do NOT diagnose — just recommend specialties).
- Navigate to the booking flow for a specific doctor.
- Check on their existing appointments.
- Answer general questions about the CareFlow platform.

When a patient describes symptoms, suggest 1-2 relevant specializations from the list below, then offer to show doctors in that specialty.
Navigation paths you can use:
  - Browse doctors: /patient/doctors
  - Browse by specialty: /patient/doctors (the user can filter on that page)
  - Book specific doctor: /patient/doctors/{doctorId}
  - My appointments: /patient/appointments`
        : userRole === 'DOCTOR'
        ? `You help this doctor:
- Navigate to today's schedule or a specific appointment.
- Answer questions about the CareFlow platform.
Navigation paths you can use:
  - My appointments: /doctor/appointments
  - My schedule: /doctor/schedule
  - Leave management: /doctor/leave`
        : `You help this administrator manage the CareFlow platform.
Navigation paths: /admin, /admin/doctors, /admin/patients, /admin/appointments, /admin/system`;

    return `You are "CareFlow AI", the friendly virtual assistant for the CareFlow Healthcare Appointment Platform.
User: ${userName} | Role: ${userRole}

${roleInstructions}

===AVAILABLE SPECIALIZATIONS===
${specializations}

===AVAILABLE DOCTORS===
${doctors}

===STRICT RULES===
1. NEVER diagnose, prescribe, or give specific medical advice. Always say: "Please consult a doctor for medical advice."
2. For emergencies (chest pain, difficulty breathing, severe bleeding, loss of consciousness), ALWAYS respond: "This sounds like a medical emergency — please call emergency services (108/112) immediately."
3. Keep replies SHORT and friendly (2-4 sentences max).
4. Always respond with EXACTLY this JSON (no extra text outside the JSON):

{
  "reply": "Your friendly, helpful reply here.",
  "suggestions": ["Short chip 1", "Short chip 2", "Short chip 3"],
  "action": {
    "type": "navigate",
    "path": "/patient/doctors",
    "label": "View Doctors"
  }
}

The "action" field is OPTIONAL — include it only when navigation is the logical next step.
The "suggestions" array: 2-4 SHORT chips the user might click next (max 6 words each).`;
  }

  // ─── Response Validation ───────────────────────────────────────────────────

  private validateResponse(parsed: any): ChatResponse {
    const reply =
      typeof parsed?.reply === 'string'
        ? parsed.reply.substring(0, 800)
        : "I'm here to help! What can I assist you with today?";

    const suggestions: string[] = Array.isArray(parsed?.suggestions)
      ? parsed.suggestions.slice(0, 4).map((s: any) => String(s).substring(0, 80))
      : [];

    let action: ChatAction | undefined;
    if (
      parsed?.action?.type === 'navigate' &&
      typeof parsed?.action?.path === 'string'
    ) {
      action = {
        type: 'navigate',
        path: String(parsed.action.path).substring(0, 200),
        label: String(parsed.action.label ?? 'Go').substring(0, 50),
      };
    }

    return { reply, suggestions, action };
  }
}

export const aiChatService = new AiChatService();
