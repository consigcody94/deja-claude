import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  History,
  FolderOpen,
  Settings,
  Play,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useSessionsStore, Session } from '../stores/sessions';
import { createSession, startSession, stopSession, deleteSession } from '../hooks/useSession';

interface SidebarProps {
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onShowHistory: () => void;
  onShowFiles: () => void;
  activeView: 'chat' | 'history' | 'files';
}

export function Sidebar({
  activeSessionId,
  onSelectSession,
  onShowHistory,
  onShowFiles,
  activeView
}: SidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { sessions, addSession, updateSession, removeSession } = useSessionsStore();

  const sessionList = Array.from(sessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const name = `Session ${sessionList.length + 1}`;
      const result = await createSession(name, '/home/ajs');
      addSession(result);
      onSelectSession(result.id);

      // Auto-start the session
      setActionLoading(result.id);
      await startSession(result.id);
      updateSession(result.id, { status: 'running' });
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
      setActionLoading(null);
    }
  };

  const handleStartSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await startSession(id);
      updateSession(id, { status: 'running' });
    } catch (error) {
      console.error('Failed to start session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStopSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(id);
    try {
      await stopSession(id);
      updateSession(id, { status: 'stopped' });
    } catch (error) {
      console.error('Failed to stop session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;

    setActionLoading(id);
    try {
      await deleteSession(id);
      removeSession(id);
      if (activeSessionId === id) {
        const remaining = sessionList.filter(s => s.id !== id);
        if (remaining.length > 0) {
          onSelectSession(remaining[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'running':
        return 'bg-emerald-500';
      case 'stopped':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="w-72 h-full bg-claude-surface border-r border-claude-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-claude-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claude-orange to-amber-600 flex items-center justify-center">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h1 className="font-bold text-claude-text">Claude GUI</h1>
            <p className="text-xs text-claude-muted">Multi-session interface</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={handleCreateSession}
          disabled={isCreating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3
            bg-claude-orange hover:bg-claude-orange/90 text-white rounded-xl
            font-medium transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Plus size={18} />
          )}
          New Chat
        </button>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-1">
        <button
          onClick={onShowHistory}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            transition-colors duration-200 text-left
            ${activeView === 'history'
              ? 'bg-claude-border text-claude-text'
              : 'text-claude-muted hover:bg-claude-border/50 hover:text-claude-text'}`}
        >
          <History size={18} />
          <span className="text-sm font-medium">Chat History</span>
        </button>

        <button
          onClick={onShowFiles}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
            transition-colors duration-200 text-left
            ${activeView === 'files'
              ? 'bg-claude-border text-claude-text'
              : 'text-claude-muted hover:bg-claude-border/50 hover:text-claude-text'}`}
        >
          <FolderOpen size={18} />
          <span className="text-sm font-medium">File Browser</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <button
          onClick={() => setExpandedSessions(!expandedSessions)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold
            text-claude-muted uppercase tracking-wider hover:text-claude-text transition-colors"
        >
          {expandedSessions ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Active Sessions ({sessionList.length})
        </button>

        {expandedSessions && (
          <div className="mt-2 space-y-1">
            {sessionList.length === 0 ? (
              <p className="text-sm text-claude-muted px-2 py-4 text-center">
                No active sessions
              </p>
            ) : (
              sessionList.map((session) => (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
                    cursor-pointer transition-all duration-200
                    ${activeSessionId === session.id && activeView === 'chat'
                      ? 'bg-claude-border'
                      : 'hover:bg-claude-border/50'}`}
                >
                  {/* Status indicator */}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(session.status)}`} />

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={14} className="text-claude-muted flex-shrink-0" />
                      <span className="text-sm text-claude-text truncate">{session.name}</span>
                    </div>
                    <p className="text-xs text-claude-muted truncate">
                      {formatDate(session.createdAt)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {actionLoading === session.id ? (
                      <Loader2 size={14} className="animate-spin text-claude-muted" />
                    ) : session.status === 'running' ? (
                      <button
                        onClick={(e) => handleStopSession(session.id, e)}
                        className="p-1.5 rounded-md hover:bg-claude-bg text-claude-muted hover:text-red-400 transition-colors"
                        title="Stop session"
                      >
                        <Square size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleStartSession(session.id, e)}
                        className="p-1.5 rounded-md hover:bg-claude-bg text-claude-muted hover:text-emerald-400 transition-colors"
                        title="Start session"
                      >
                        <Play size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-1.5 rounded-md hover:bg-claude-bg text-claude-muted hover:text-red-400 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-claude-border">
        <div className="flex items-center justify-between">
          <span className="text-xs text-claude-muted">Claude Code GUI v1.0</span>
          <button className="p-2 rounded-lg hover:bg-claude-border/50 text-claude-muted hover:text-claude-text transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
