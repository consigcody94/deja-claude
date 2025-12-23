import React, { useState } from 'react';
import { Plus, X, Play, Square, Folder } from 'lucide-react';
import { useSessionsStore, Session } from '../stores/sessions';
import { createSession, startSession, stopSession, deleteSession, fetchSessions } from '../hooks/useSession';

interface SessionTabProps {
  session: Session;
  active: boolean;
  onClick: () => void;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
}

function SessionTab({ session, active, onClick, onClose, onStart, onStop }: SessionTabProps) {
  return (
    <div
      className={`
        relative flex items-center gap-2 px-4 py-2.5 cursor-pointer
        border-r border-claude-border transition-colors group
        ${active ? 'bg-claude-darker session-active' : 'bg-claude-dark hover:bg-claude-darker/50'}
      `}
      onClick={onClick}
    >
      {/* Status indicator */}
      <div
        className={`
          w-2 h-2 rounded-full
          ${session.status === 'running' ? 'bg-green-500 animate-pulse' : ''}
          ${session.status === 'stopped' ? 'bg-gray-500' : ''}
          ${session.status === 'error' ? 'bg-red-500' : ''}
        `}
      />

      <span className="text-sm text-claude-text truncate max-w-32">
        {session.name}
      </span>

      {/* Action buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {session.status === 'stopped' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStart(); }}
            className="p-1 rounded hover:bg-claude-border/50 text-green-500"
            title="Start session"
          >
            <Play size={14} />
          </button>
        ) : session.status === 'running' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onStop(); }}
            className="p-1 rounded hover:bg-claude-border/50 text-red-500"
            title="Stop session"
          >
            <Square size={14} />
          </button>
        ) : null}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-1 rounded hover:bg-claude-border/50 text-claude-muted hover:text-claude-text"
          title="Close session"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, dir: string) => void;
}

function NewSessionModal({ open, onClose, onCreate }: NewSessionModalProps) {
  const [name, setName] = useState('');
  const [dir, setDir] = useState('/home/ajs');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(name || `Session ${Date.now()}`, dir);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-claude-dark border border-claude-border rounded-lg p-6 w-96">
        <h2 className="text-lg font-semibold text-claude-text mb-4">New Session</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-claude-muted mb-1">Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Session"
              className="w-full px-3 py-2 bg-claude-darker border border-claude-border rounded-md
                text-claude-text placeholder:text-claude-muted focus:outline-none focus:border-claude-orange"
            />
          </div>
          <div>
            <label className="block text-sm text-claude-muted mb-1">Working Directory</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                className="flex-1 px-3 py-2 bg-claude-darker border border-claude-border rounded-md
                  text-claude-text focus:outline-none focus:border-claude-orange"
              />
              <button
                type="button"
                className="px-3 py-2 bg-claude-border rounded-md hover:bg-claude-muted/20"
              >
                <Folder size={18} />
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-claude-muted hover:text-claude-text"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-claude-orange text-white rounded-md hover:bg-claude-orange/90"
            >
              Create & Start
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SessionTabs() {
  const { sessions, activeSessionId, setActiveSession, addSession, removeSession, updateSession, setSessions } = useSessionsStore();
  const [showModal, setShowModal] = useState(false);

  const handleCreateSession = async (name: string, dir: string) => {
    const session = await createSession(name, dir);
    addSession(session);
    setActiveSession(session.id);
    // Auto-start the session
    await startSession(session.id);
    updateSession(session.id, { status: 'running' });
  };

  const handleStartSession = async (id: string) => {
    await startSession(id);
    updateSession(id, { status: 'running' });
  };

  const handleStopSession = async (id: string) => {
    await stopSession(id);
    updateSession(id, { status: 'stopped' });
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
    removeSession(id);
  };

  return (
    <>
      <div className="flex items-center bg-claude-dark border-b border-claude-border overflow-x-auto">
        {sessions.map((session) => (
          <SessionTab
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            onClick={() => setActiveSession(session.id)}
            onClose={() => handleDeleteSession(session.id)}
            onStart={() => handleStartSession(session.id)}
            onStop={() => handleStopSession(session.id)}
          />
        ))}

        {/* New session button */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 px-4 py-2.5 text-claude-muted hover:text-claude-text
            hover:bg-claude-darker/50 transition-colors"
        >
          <Plus size={16} />
          <span className="text-sm">New</span>
        </button>
      </div>

      <NewSessionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreate={handleCreateSession}
      />
    </>
  );
}
