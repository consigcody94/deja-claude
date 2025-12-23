import React, { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { Send, Square, Loader2 } from 'lucide-react';
import { ChatMessage, Message } from './ChatMessage';
import { useSessionsStore } from '../stores/sessions';
import { useSession } from '../hooks/useSession';

interface ChatPanelProps {
  sessionId: string | null;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { sessions, sessionMessages } = useSessionsStore();
  const { sendInput } = useSession(sessionId);

  const session = sessionId ? sessions.get(sessionId) : null;
  const messages = sessionId ? (sessionMessages.get(sessionId) || []) : [];
  const isRunning = session?.status === 'running';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || !sessionId || !isRunning) return;

    // Send the input to Claude CLI
    sendInput(input + '\n');
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    if (sessionId) {
      sendInput('\x03'); // Ctrl+C
    }
  };

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-claude-bg">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-claude-orange to-amber-600 flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <h2 className="text-2xl font-bold text-claude-text mb-3">Welcome to Claude GUI</h2>
          <p className="text-claude-muted leading-relaxed">
            Select a session from the sidebar or create a new one to start chatting with Claude.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center bg-claude-bg">
        <p className="text-claude-muted">Session not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-claude-bg">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg px-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-claude-surface flex items-center justify-center">
                <Send size={24} className="text-claude-muted" />
              </div>
              <h3 className="text-lg font-semibold text-claude-text mb-2">
                {isRunning ? 'Ready to chat' : 'Session not started'}
              </h3>
              <p className="text-claude-muted text-sm">
                {isRunning
                  ? 'Type a message below to start your conversation with Claude.'
                  : 'Start the session from the sidebar to begin chatting.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-claude-border/30">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-claude-border p-4 bg-claude-surface">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRunning ? "Message Claude..." : "Start session to chat"}
                disabled={!isRunning}
                rows={1}
                className="w-full px-4 py-3 pr-12 bg-claude-bg border border-claude-border rounded-xl
                  text-claude-text placeholder-claude-muted resize-none
                  focus:outline-none focus:ring-2 focus:ring-claude-orange focus:border-transparent
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
              />
            </div>

            {messages.some(m => m.isStreaming) ? (
              <button
                onClick={handleStop}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center
                  bg-red-600 hover:bg-red-700 text-white rounded-xl
                  transition-colors duration-200"
                title="Stop generation"
              >
                <Square size={18} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || !isRunning}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center
                  bg-claude-orange hover:bg-claude-orange/90 text-white rounded-xl
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200"
                title="Send message"
              >
                <Send size={18} />
              </button>
            )}
          </div>

          <p className="text-xs text-claude-muted text-center mt-3">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
