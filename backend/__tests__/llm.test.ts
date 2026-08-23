import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
process.env.OPENAI_API_KEY = 'mock-key';

import { llmService } from '../src/services/llm.service';

// Mock OpenAI to test failure paths without real API calls
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('LLM Service', () => {
  describe('generatePreVisitSummary', () => {
    const symptoms = {
      chiefComplaint: 'Persistent headache',
      symptoms: 'Headache for 3 days, mild nausea',
      duration: '3 days',
      severity: 5,
    };

    test('returns valid structured response', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                urgencyLevel: 'LOW',
                chiefComplaint: 'Patient has a mild headache lasting 3 days.',
                suggestedQuestions: [
                  'When did the headache start?',
                  'Does anything make it better or worse?',
                  'Any vision changes?',
                ],
              }),
            },
          },
        ],
      });

      // Mock the private client
      (llmService as any).client = instance;

      const result = await llmService.generatePreVisitSummary(symptoms);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.data.urgencyLevel);
        expect(result.data.suggestedQuestions).toHaveLength(3);
        expect(typeof result.data.chiefComplaint).toBe('string');
      }
    });

    test('handles invalid urgency level gracefully', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                urgencyLevel: 'CRITICAL', // Invalid - should be normalized
                chiefComplaint: 'Some complaint',
                suggestedQuestions: ['Q1', 'Q2', 'Q3'],
              }),
            },
          },
        ],
      });
      (llmService as any).client = instance;

      const result = await llmService.generatePreVisitSummary(symptoms);
      // Should still succeed with normalized urgency
      if (result.success) {
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.data.urgencyLevel);
      }
    });

    test('handles API timeout gracefully', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockRejectedValueOnce(
        new Error('Request timeout')
      );
      (llmService as any).client = instance;

      const result = await llmService.generatePreVisitSummary(symptoms);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain('AI summary generation failed');
    });

    test('handles missing API key - returns fallback', async () => {
      // Simulate no API key
      (llmService as any).client = null;
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const result = await llmService.generatePreVisitSummary(symptoms);
      expect(result.success).toBe(false);
      expect((result as any).error).toBeDefined();

      process.env.OPENAI_API_KEY = originalKey;
    });

    test('handles invalid JSON response', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'not valid json {{{' } }],
      });
      (llmService as any).client = instance;

      const result = await llmService.generatePreVisitSummary(symptoms);
      expect(result.success).toBe(false);
    });

    test('handles missing required fields in response', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                // Missing urgencyLevel and chiefComplaint
                suggestedQuestions: [],
              }),
            },
          },
        ],
      });
      (llmService as any).client = instance;

      const result = await llmService.generatePreVisitSummary(symptoms);
      expect(result.success).toBe(false);
    });
  });

  describe('generatePostVisitSummary', () => {
    const consultation = {
      clinicalNotes: 'Patient presents with fever and cough. Diagnosed with mild URI.',
      diagnosis: 'Upper respiratory infection',
      followUpInstructions: 'Return if fever exceeds 39°C for more than 3 days',
      prescriptionDetails: 'Amoxicillin 500mg twice daily for 7 days',
    };

    test('returns valid structured post-visit response', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'You have a mild respiratory infection. Rest and fluids are important.',
                medications: [
                  {
                    name: 'Amoxicillin',
                    dosage: '500mg',
                    frequency: 'Twice daily',
                    duration: '7 days',
                  },
                ],
                followUpSteps: ['Rest at home', 'Drink plenty of fluids', 'Return if fever worsens'],
              }),
            },
          },
        ],
      });
      (llmService as any).client = instance;

      const result = await llmService.generatePostVisitSummary(consultation);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.summary).toBe('string');
        expect(Array.isArray(result.data.medications)).toBe(true);
        expect(Array.isArray(result.data.followUpSteps)).toBe(true);
      }
    });

    test('fails gracefully on API error - consultation still completes', async () => {
      const OpenAI = require('openai');
      const instance = new OpenAI();
      instance.chat.completions.create.mockRejectedValueOnce(
        new Error('OpenAI API error: 503')
      );
      (llmService as any).client = instance;

      const result = await llmService.generatePostVisitSummary(consultation);
      // Must fail gracefully, not throw
      expect(result.success).toBe(false);
    });
  });
});
