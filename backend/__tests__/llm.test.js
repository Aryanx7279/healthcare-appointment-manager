"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../../.env') });
process.env.OPENAI_API_KEY = 'mock-key';
const llm_service_1 = require("../src/services/llm.service");
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
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
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
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
            // Should still succeed with normalized urgency
            if (result.success) {
                expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.data.urgencyLevel);
            }
        });
        test('handles API timeout gracefully', async () => {
            const OpenAI = require('openai');
            const instance = new OpenAI();
            instance.chat.completions.create.mockRejectedValueOnce(new Error('Request timeout'));
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
            expect(result.success).toBe(false);
            expect(result.error).toContain('AI summary generation failed');
        });
        test('handles missing API key - returns fallback', async () => {
            // Simulate no API key
            llm_service_1.llmService.client = null;
            const originalKey = process.env.OPENAI_API_KEY;
            delete process.env.OPENAI_API_KEY;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            process.env.OPENAI_API_KEY = originalKey;
        });
        test('handles invalid JSON response', async () => {
            const OpenAI = require('openai');
            const instance = new OpenAI();
            instance.chat.completions.create.mockResolvedValueOnce({
                choices: [{ message: { content: 'not valid json {{{' } }],
            });
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
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
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePreVisitSummary(symptoms);
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
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePostVisitSummary(consultation);
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
            instance.chat.completions.create.mockRejectedValueOnce(new Error('OpenAI API error: 503'));
            llm_service_1.llmService.client = instance;
            const result = await llm_service_1.llmService.generatePostVisitSummary(consultation);
            // Must fail gracefully, not throw
            expect(result.success).toBe(false);
        });
    });
});
//# sourceMappingURL=llm.test.js.map