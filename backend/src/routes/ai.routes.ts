import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { aiChatService, ChatMessage } from '../services/ai-chat.service';
import { logger } from '../utils/logger';

const router = Router();

// ─── Simple in-memory rate limiter (20 req/min per user) ──────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || entry.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post('/chat', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    if (!checkRateLimit(user.id)) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait a moment before trying again.',
        },
      });
    }

    const { messages } = req.body as { messages: ChatMessage[] };

    if (!Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: '"messages" must be an array.' },
      });
    }

    const sanitizedMessages: ChatMessage[] = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10) // keep last 10 messages for context window efficiency
      .map((m) => ({ role: m.role, content: m.content.substring(0, 1000) }));

    const response = await aiChatService.chat(sanitizedMessages, {
      userRole: user.role,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`.trim(),
    });

    return res.json({ success: true, data: response });
  } catch (err) {
    logger.error('AI chat route error:', err);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'AI service is temporarily unavailable.' },
    });
  }
});

export default router;
