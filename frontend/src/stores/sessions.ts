import { create } from 'zustand';
import { Message } from '../components/ChatMessage';

export interface Session {
  id: string;
  name: string;
  workingDir: string;
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
}

export interface LogEntry {
  timestamp: Date;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

interface SessionsState {
  sessions: Map<string, Session>;
  sessionLogs: Map<string, LogEntry[]>;
  sessionMessages: Map<string, Message[]>;
  currentStreamingMessage: Map<string, Message | null>;

  // Session Actions
  addSession: (session: Session) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;

  // Log Actions
  appendLog: (sessionId: string, log: LogEntry) => void;
  setLogs: (sessionId: string, logs: LogEntry[]) => void;
  clearLogs: (sessionId: string) => void;

  // Message Actions
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  appendToMessage: (sessionId: string, messageId: string, content: string) => void;
  setStreamingMessage: (sessionId: string, message: Message | null) => void;
  finalizeStreamingMessage: (sessionId: string) => void;
}

let messageCounter = 0;
const generateMessageId = () => `msg_${++messageCounter}_${Date.now()}`;

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: new Map(),
  sessionLogs: new Map(),
  sessionMessages: new Map(),
  currentStreamingMessage: new Map(),

  addSession: (session) => set((state) => {
    const newSessions = new Map(state.sessions);
    newSessions.set(session.id, session);
    return { sessions: newSessions };
  }),

  updateSession: (id, updates) => set((state) => {
    const newSessions = new Map(state.sessions);
    const existing = newSessions.get(id);
    if (existing) {
      newSessions.set(id, { ...existing, ...updates });
    }
    return { sessions: newSessions };
  }),

  removeSession: (id) => set((state) => {
    const newSessions = new Map(state.sessions);
    const newLogs = new Map(state.sessionLogs);
    const newMessages = new Map(state.sessionMessages);
    const newStreaming = new Map(state.currentStreamingMessage);

    newSessions.delete(id);
    newLogs.delete(id);
    newMessages.delete(id);
    newStreaming.delete(id);

    return {
      sessions: newSessions,
      sessionLogs: newLogs,
      sessionMessages: newMessages,
      currentStreamingMessage: newStreaming
    };
  }),

  appendLog: (sessionId, log) => set((state) => {
    const newLogs = new Map(state.sessionLogs);
    const existing = newLogs.get(sessionId) || [];
    newLogs.set(sessionId, [...existing, log]);
    return { sessionLogs: newLogs };
  }),

  setLogs: (sessionId, logs) => set((state) => {
    const newLogs = new Map(state.sessionLogs);
    newLogs.set(sessionId, logs);
    return { sessionLogs: newLogs };
  }),

  clearLogs: (sessionId) => set((state) => {
    const newLogs = new Map(state.sessionLogs);
    newLogs.set(sessionId, []);
    return { sessionLogs: newLogs };
  }),

  addMessage: (sessionId, message) => set((state) => {
    const newMessages = new Map(state.sessionMessages);
    const existing = newMessages.get(sessionId) || [];
    newMessages.set(sessionId, [...existing, message]);
    return { sessionMessages: newMessages };
  }),

  updateMessage: (sessionId, messageId, updates) => set((state) => {
    const newMessages = new Map(state.sessionMessages);
    const existing = newMessages.get(sessionId) || [];
    const updated = existing.map(msg =>
      msg.id === messageId ? { ...msg, ...updates } : msg
    );
    newMessages.set(sessionId, updated);
    return { sessionMessages: newMessages };
  }),

  appendToMessage: (sessionId, messageId, content) => set((state) => {
    const newMessages = new Map(state.sessionMessages);
    const existing = newMessages.get(sessionId) || [];
    const updated = existing.map(msg =>
      msg.id === messageId ? { ...msg, content: msg.content + content } : msg
    );
    newMessages.set(sessionId, updated);
    return { sessionMessages: newMessages };
  }),

  setStreamingMessage: (sessionId, message) => set((state) => {
    const newStreaming = new Map(state.currentStreamingMessage);
    newStreaming.set(sessionId, message);
    return { currentStreamingMessage: newStreaming };
  }),

  finalizeStreamingMessage: (sessionId) => set((state) => {
    const streaming = state.currentStreamingMessage.get(sessionId);
    if (!streaming) return state;

    const newMessages = new Map(state.sessionMessages);
    const existing = newMessages.get(sessionId) || [];
    const finalized = { ...streaming, isStreaming: false };
    newMessages.set(sessionId, [...existing, finalized]);

    const newStreaming = new Map(state.currentStreamingMessage);
    newStreaming.set(sessionId, null);

    return {
      sessionMessages: newMessages,
      currentStreamingMessage: newStreaming
    };
  })
}));

// Helper to create a new message
export function createMessage(
  role: Message['role'],
  content: string,
  options?: Partial<Message>
): Message {
  return {
    id: generateMessageId(),
    role,
    content,
    timestamp: new Date(),
    isStreaming: false,
    ...options
  };
}

// Parse Claude CLI output to extract structured messages
export function parseClaudeOutput(data: string): {
  type: 'user' | 'assistant' | 'tool' | 'system' | 'raw' | 'skip';
  content: string;
  toolName?: string;
  toolInput?: string;
} {
  const trimmed = data.trim();

  // Skip empty or very short lines
  if (trimmed.length < 2) {
    return { type: 'skip', content: '' };
  }

  // Skip Claude CLI UI elements that might slip through
  const skipPatterns = [
    /^[─━═]+$/,                    // Horizontal lines
    /^\s*⏵/,                       // Play icons
    /bypass permissions/i,
    /shift\+tab/i,
    /MCP server/i,
    /for info$/i,
    /^\[\?/,                       // Terminal codes like [?2026l
    /^Try "/,                      // Example prompts
  ];

  if (skipPatterns.some(p => p.test(trimmed))) {
    return { type: 'skip', content: '' };
  }

  // Detect user input prompt (starts with ❯ or > or You:)
  if (data.match(/^[❯>]\s/) || data.startsWith('You:') || data.startsWith('Human:')) {
    const content = data.replace(/^[❯>]\s*|^You:\s*|^Human:\s*/, '').trim();
    if (content) {
      return { type: 'user', content };
    }
    return { type: 'skip', content: '' };
  }

  // Detect Claude response markers
  if (data.startsWith('Claude:') || data.startsWith('Assistant:')) {
    return { type: 'assistant', content: data.replace(/^Claude:\s*|^Assistant:\s*/, '') };
  }

  // Detect tool usage patterns - Claude shows these with specific formatting
  const toolPatterns = [
    /^(Read|Write|Edit|Bash|Grep|Glob|Search|WebFetch|Task|LS|TodoWrite)\s*[:(]/i,
    /^Using tool:\s*(Read|Write|Edit|Bash|Grep|Glob|Search|WebFetch|Task)/i,
    /^Tool:\s*(Read|Write|Edit|Bash|Grep|Glob|Search|WebFetch|Task)/i,
  ];

  for (const pattern of toolPatterns) {
    const toolMatch = data.match(pattern);
    if (toolMatch) {
      const toolName = toolMatch[1];
      return {
        type: 'tool',
        content: data,
        toolName,
        toolInput: data.substring(toolMatch[0].length)
      };
    }
  }

  // Detect system messages
  if (data.includes('Session started') || data.includes('Process exited') ||
      data.match(/^Error:/i) || data.includes('Connection')) {
    return { type: 'system', content: data };
  }

  // Default to raw output (will be accumulated into assistant message)
  return { type: 'raw', content: data };
}

// UI State store
interface UIState {
  sidebarOpen: boolean;
  currentView: 'sessions' | 'history' | 'files' | 'logs';
  theme: 'dark' | 'light';

  toggleSidebar: () => void;
  setCurrentView: (view: UIState['currentView']) => void;
  setTheme: (theme: UIState['theme']) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  currentView: 'sessions',
  theme: 'dark',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCurrentView: (view) => set({ currentView: view }),
  setTheme: (theme) => set({ theme })
}));
