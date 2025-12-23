import { useEffect, useRef, useCallback } from 'react';
import { useSessionsStore, createMessage, parseClaudeOutput } from '../stores/sessions';
import { Message } from '../components/ChatMessage';

const API_URL = '/api';
const WS_URL = 'ws://localhost:3001';

// State machine for parsing Claude CLI output
interface OutputParser {
  currentRole: 'user' | 'assistant' | 'tool' | null;
  buffer: string;
  currentMessageId: string | null;
}

export function useSession(sessionId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const parserRef = useRef<OutputParser>({
    currentRole: null,
    buffer: '',
    currentMessageId: null
  });

  const {
    appendLog,
    setLogs,
    updateSession,
    addMessage,
    updateMessage,
    appendToMessage
  } = useSessionsStore();

  // Process incoming data and convert to messages
  const processData = useCallback((sessionId: string, data: string) => {
    const parser = parserRef.current;

    // Comprehensive ANSI/terminal escape code stripping
    let cleanData = data
      // Standard ANSI escape codes
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
      // OSC sequences (like \x1B]...\x07)
      .replace(/\x1B\][^\x07]*\x07/g, '')
      // DEC private mode sequences
      .replace(/\x1B\[\?[0-9;]*[a-zA-Z]/g, '')
      // Other escape sequences
      .replace(/\x1B[()][AB012]/g, '')
      .replace(/\x1B[>=]/g, '')
      // Control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // Filter out Claude CLI UI elements
    const uiPatterns = [
      /^─+$/,                                    // Horizontal lines
      /^[\s]*$/,                                 // Empty/whitespace lines
      /⏵⏵\s*bypass permissions/i,               // Permission mode indicator
      /shift\+tab to cycle/i,                   // Help text
      /MCP server/i,                            // MCP status
      /^\s*\/\w+\s+for\s+info/i,               // Command hints
      /Try ".*"/,                               // Example prompts
      /^\[.*\]$/,                               // Status indicators like [?2026l
      /^\s*\d+\s+tokens/i,                      // Token counts
    ];

    // Split by newlines to process line by line
    const lines = cleanData.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip UI elements
      if (uiPatterns.some(pattern => pattern.test(trimmed))) continue;
      // Skip lines that are just escape code remnants
      if (trimmed.length < 3 && !/[a-zA-Z]/.test(trimmed)) continue;

      const parsed = parseClaudeOutput(trimmed);

      // Skip filtered content
      if (parsed.type === 'skip') continue;

      // Handle different message types
      if (parsed.type === 'user') {
        // User messages are added by sendInput, skip duplicates from CLI echo
        // Just finalize any existing assistant message
        if (parser.currentRole === 'assistant' && parser.currentMessageId) {
          updateMessage(sessionId, parser.currentMessageId, { isStreaming: false });
          parser.currentRole = null;
          parser.currentMessageId = null;
          parser.buffer = '';
        }
        continue;

      } else if (parsed.type === 'tool') {
        // Finalize any existing assistant message
        if (parser.currentRole === 'assistant' && parser.currentMessageId) {
          updateMessage(sessionId, parser.currentMessageId, { isStreaming: false });
        }

        // Create tool message
        const toolMsg = createMessage('tool', parsed.content, {
          toolName: parsed.toolName,
          toolInput: parsed.toolInput
        });
        addMessage(sessionId, toolMsg);

        parser.currentRole = null;
        parser.currentMessageId = null;

      } else if (parsed.type === 'system') {
        // System messages are standalone
        const sysMsg = createMessage('system', parsed.content);
        addMessage(sessionId, sysMsg);

      } else {
        // Raw content - accumulate into assistant message
        if (parser.currentRole !== 'assistant' || !parser.currentMessageId) {
          // Start new assistant message
          const assistantMsg = createMessage('assistant', line, { isStreaming: true });
          addMessage(sessionId, assistantMsg);
          parser.currentRole = 'assistant';
          parser.currentMessageId = assistantMsg.id;
          parser.buffer = line;
        } else {
          // Append to existing assistant message
          parser.buffer += '\n' + line;
          updateMessage(sessionId, parser.currentMessageId, {
            content: parser.buffer,
            isStreaming: true
          });
        }
      }
    }
  }, [addMessage, updateMessage, appendToMessage]);

  // Connect to WebSocket for session
  useEffect(() => {
    if (!sessionId) return;

    // Reset parser state for new session
    parserRef.current = {
      currentRole: null,
      buffer: '',
      currentMessageId: null
    };

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected, subscribing to session:', sessionId);
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'logs':
          // Process existing logs
          setLogs(sessionId, message.logs.map((l: any) => ({
            ...l,
            timestamp: new Date(l.timestamp)
          })));

          // Convert logs to messages
          message.logs.forEach((log: any) => {
            processData(sessionId, log.content);
          });
          break;

        case 'data':
          // Append to logs
          appendLog(sessionId, {
            timestamp: new Date(),
            type: message.dataType,
            content: message.data
          });

          // Process data into messages
          processData(sessionId, message.data);
          break;

        case 'exit':
          updateSession(sessionId, { status: 'stopped' });

          // Finalize any streaming message
          const parser = parserRef.current;
          if (parser.currentMessageId) {
            updateMessage(sessionId, parser.currentMessageId, { isStreaming: false });
          }

          // Add exit message
          addMessage(sessionId, createMessage('system', `Process exited with code ${message.exitCode}`));
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed for session:', sessionId);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe' }));
      }
      ws.close();
    };
  }, [sessionId, appendLog, setLogs, updateSession, addMessage, updateMessage, processData]);

  // Send input to session
  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add user message immediately for better UX
      if (data.trim() && data !== '\x03') { // Don't add Ctrl+C as message
        const userMsg = createMessage('user', data.replace(/\n$/, ''));
        if (sessionId) {
          addMessage(sessionId, userMsg);

          // Also finalize any existing assistant streaming message
          const parser = parserRef.current;
          if (parser.currentRole === 'assistant' && parser.currentMessageId) {
            updateMessage(sessionId, parser.currentMessageId, { isStreaming: false });
            parser.currentRole = null;
            parser.currentMessageId = null;
            parser.buffer = '';
          }
        }
      }

      wsRef.current.send(JSON.stringify({ type: 'input', data }));
    }
  }, [sessionId, addMessage, updateMessage]);

  // Resize terminal
  const resize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  return { sendInput, resize };
}

// API functions
export async function fetchSessions() {
  const res = await fetch(`${API_URL}/sessions`);
  return res.json();
}

export async function createSession(name: string, workingDir: string) {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, workingDir })
  });
  return res.json();
}

export async function startSession(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/start`, {
    method: 'POST'
  });
  return res.json();
}

export async function stopSession(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/stop`, {
    method: 'POST'
  });
  return res.json();
}

export async function deleteSession(sessionId: string) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  return res.json();
}
