import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import { aiApi, AiChatMessage } from '../../api';
import {
  Sparkles, X, Send, Mic, MicOff, Volume2, VolumeX,
  ChevronRight, Loader2, Bot, RotateCcw, Heart
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatAction {
  type: 'navigate';
  path: string;
  label: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  action?: ChatAction;
  isError?: boolean;
}

// ─── Web Speech API types ──────────────────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GREETING_BY_ROLE = {
  PATIENT: "Hi! I'm CareFlow AI 👋 I can help you find the right doctor, understand your symptoms, or book an appointment. What brings you in today?",
  DOCTOR:  "Hello Doctor! I'm CareFlow AI. I can help you navigate your schedule, find patient info, or manage appointments. How can I assist?",
  ADMIN:   "Hi! I'm CareFlow AI. I can help you manage the platform, navigate to sections, or answer questions. How can I help?",
};

const INITIAL_SUGGESTIONS_BY_ROLE = {
  PATIENT: ['I have a headache', 'Book an appointment', 'My appointments', 'Find a specialist'],
  DOCTOR:  ["Today's schedule", 'Manage leave', 'My appointments', 'Working hours'],
  ADMIN:   ['View doctors', 'View patients', 'System status', 'Appointments overview'],
};

const makeId = () => Math.random().toString(36).substring(2, 9);

// ─── Component ─────────────────────────────────────────────────────────────────

export function AIChatWidget() {
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [isOpen,       setIsOpen]       = useState(false);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [isListening,  setIsListening]  = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [hasUnread,    setHasUnread]    = useState(false);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const recognitionRef  = useRef<any>(null);
  const synthRef        = useRef<SpeechSynthesis | null>(null);

  const role = (user?.role ?? 'PATIENT') as keyof typeof GREETING_BY_ROLE;

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Initialise speech synthesis ref ───────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // ── Open widget and seed greeting ────────────────────────────────────────
  const openWidget = () => {
    setIsOpen(true);
    setHasUnread(false);
    if (messages.length === 0) {
      const greeting: Message = {
        id: makeId(),
        role: 'assistant',
        content: GREETING_BY_ROLE[role],
        suggestions: INITIAL_SUGGESTIONS_BY_ROLE[role],
      };
      setMessages([greeting]);
    }
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  const closeWidget = () => {
    setIsOpen(false);
    stopListening();
  };

  // ── Speak text aloud ───────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 1.0;
    utt.pitch = 1.0;
    utt.volume = 0.9;
    // Prefer a female English voice if available
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
      ?? voices.find(v => v.lang.startsWith('en'))
      ?? voices[0];
    if (preferred) utt.voice = preferred;
    synthRef.current.speak(utt);
  }, [voiceEnabled]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInput('');
    const userMsg: Message = { id: makeId(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Build history for the API (last 10 messages as [user, assistant] pairs)
    const history: AiChatMessage[] = [...messages, userMsg]
      .filter(m => !m.isError)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await aiApi.chat(history);
      const data = res.data.data;

      const botMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: data.reply,
        suggestions: data.suggestions ?? [],
        action: data.action,
      };
      setMessages(prev => [...prev, botMsg]);
      speak(data.reply);

      if (!isOpen) setHasUnread(true);
    } catch (err: any) {
      const errMsg: Message = {
        id: makeId(),
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please check your internet connection and try again.",
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, isOpen, speak]);

  // ── Submit on Enter ────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Voice Recognition ──────────────────────────────────────────────────────
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang            = 'en-IN';
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);

      if (event.results[event.results.length - 1].isFinal) {
        sendMessage(transcript);
      }
    };

    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      synthRef.current?.cancel();
    }
    setVoiceEnabled(v => !v);
  };

  const resetChat = () => {
    setMessages([]);
    synthRef.current?.cancel();
    setTimeout(() => openWidget(), 50);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const hasSpeechRecognition = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const ACCENT = role === 'DOCTOR' ? '#059669' : role === 'ADMIN' ? '#7C3AED' : '#2563EB';

  return (
    <>
      {/* ── Floating trigger bubble ──────────────────────────────────────── */}
      {!isOpen && (
        <button
          id="ai-chat-trigger"
          onClick={openWidget}
          aria-label="Open AI assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9998,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${ACCENT}, #0891B2)`,
            boxShadow: `0 4px 24px ${ACCENT}55`,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'aiPulse 2.5s ease-in-out infinite',
          }}>
          <Sparkles className="w-6 h-6 text-white" />
          {hasUnread && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#EF4444', border: '2px solid #fff',
            }} />
          )}
        </button>
      )}

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="ai-chat-panel"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: 'min(400px, calc(100vw - 32px))',
            height: 'min(560px, calc(100vh - 80px))',
            background: 'var(--surface)',
            borderRadius: 'var(--r-2xl)',
            boxShadow: 'var(--shadow-xl)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'aiSlideUp 0.25s ease both',
          }}>

          {/* ─ Header ─────────────────────────────────────────────────── */}
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT}, #0891B2)`,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>
                CareFlow AI
              </p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                {isLoading ? 'Thinking…' : isListening ? '🎤 Listening…' : 'Online'}
              </p>
            </div>

            {/* Voice output toggle */}
            {hasSpeechSynthesis && (
              <button onClick={toggleVoice} aria-label="Toggle voice output"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}

            {/* Reset chat */}
            <button onClick={resetChat} aria-label="Reset chat"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Close */}
            <button onClick={closeWidget} aria-label="Close chat"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ─ Messages ───────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}
            className="scrollbar-thin">

            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {/* Avatar for assistant */}
                {msg.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${ACCENT}, #0891B2)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Heart className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    <div style={{
                      maxWidth: '85%',
                      background: msg.isError ? 'var(--danger-light)' : 'var(--surface-2)',
                      border: `1px solid ${msg.isError ? '#FECACA' : 'var(--border)'}`,
                      color: msg.isError ? 'var(--danger)' : 'var(--text)',
                      borderRadius: '4px 14px 14px 14px',
                      padding: '10px 12px',
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )}

                {/* User bubble */}
                {msg.role === 'user' && (
                  <div style={{
                    maxWidth: '80%',
                    background: ACCENT,
                    color: '#fff',
                    borderRadius: '14px 4px 14px 14px',
                    padding: '10px 12px',
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}>
                    {msg.content}
                  </div>
                )}

                {/* Action button */}
                {msg.role === 'assistant' && msg.action && (
                  <div style={{ marginLeft: 34, marginTop: 6 }}>
                    <button
                      onClick={() => { navigate(msg.action!.path); closeWidget(); }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: ACCENT, color: '#fff',
                        border: 'none', borderRadius: 8,
                        padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        fontFamily: 'Manrope, sans-serif', cursor: 'pointer',
                        boxShadow: `0 2px 8px ${ACCENT}55`,
                      }}>
                      {msg.action.label}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Suggestion chips */}
                {msg.role === 'assistant' && msg.suggestions && msg.suggestions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 34, marginTop: 6, maxWidth: '90%' }}>
                    {msg.suggestions.map((s, i) => (
                      <button key={i} onClick={() => sendMessage(s)}
                        style={{
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          border: '1.5px solid var(--primary-mid)',
                          borderRadius: 20, padding: '4px 10px',
                          fontSize: 11, fontWeight: 600,
                          fontFamily: 'Manrope, sans-serif',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${ACCENT}, #0891B2)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Heart className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <div style={{
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: '4px 14px 14px 14px', padding: '12px 14px',
                  display: 'flex', gap: 4, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)',
                      display: 'inline-block',
                      animation: `aiDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ─ Listening banner ────────────────────────────────────────── */}
          {isListening && (
            <div style={{
              padding: '8px 16px', background: 'var(--danger-light)',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
              borderTop: '1px solid #FECACA',
            }}>
              <span style={{ display: 'flex', gap: 3 }}>
                {[0,1,2,3].map(i => (
                  <span key={i} style={{
                    width: 3, height: 14, background: 'var(--danger)',
                    borderRadius: 2, display: 'inline-block',
                    animation: `aiBar 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                  }} />
                ))}
              </span>
              <p style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600, fontFamily: 'Manrope, sans-serif' }}>
                Listening… Speak now
              </p>
            </div>
          )}

          {/* ─ Input area ─────────────────────────────────────────────── */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
            background: 'var(--surface)',
          }}>
            <input
              ref={inputRef}
              id="ai-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening…' : 'Ask anything…'}
              disabled={isLoading || isListening}
              style={{
                flex: 1,
                border: '1.5px solid var(--border)',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
                color: 'var(--text)',
                background: 'var(--surface-2)',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />

            {/* Mic button */}
            {hasSpeechRecognition && (
              <button onClick={toggleListening} aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: 'none',
                  background: isListening ? 'var(--danger)' : 'var(--surface-2)',
                  border: `1.5px solid ${isListening ? 'var(--danger)' : 'var(--border)'}`,
                  color: isListening ? '#fff' : 'var(--text-3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Send button */}
            <button
              id="ai-chat-send"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: 'none',
                background: (!input.trim() || isLoading) ? 'var(--surface-3)' : ACCENT,
                color: (!input.trim() || isLoading) ? 'var(--text-muted)' : '#fff',
                cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
                boxShadow: (!input.trim() || isLoading) ? 'none' : `0 2px 8px ${ACCENT}55`,
              }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>

          {/* ─ Footer disclaimer ───────────────────────────────────────── */}
          <p style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', padding: '4px 12px 8px', flexShrink: 0 }}>
            Not a medical advisor · For emergencies call 108/112
          </p>
        </div>
      )}

      {/* ── Keyframe animations ───────────────────────────────────────────── */}
      <style>{`
        @keyframes aiPulse {
          0%, 100% { box-shadow: 0 4px 24px ${ACCENT}55, 0 0 0 0 ${ACCENT}33; }
          50% { box-shadow: 0 4px 24px ${ACCENT}55, 0 0 0 10px transparent; }
        }
        @keyframes aiSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes aiDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes aiBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </>
  );
}
