import React, { useState } from 'react';
import { Search, ChevronRight, MessageCircle, Calendar, Folder } from 'lucide-react';
import { useProjects, useProjectSessions, useHistorySearch, HistorySession, ProjectInfo } from '../hooks/useHistory';

interface MessagePreviewProps {
  session: HistorySession;
  onClick: () => void;
}

function MessagePreview({ session, onClick }: MessagePreviewProps) {
  const date = new Date(session.createdAt);
  const dateStr = date.toLocaleDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg hover:bg-claude-border/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 p-2 rounded-lg bg-claude-orange/20 text-claude-orange">
          <MessageCircle size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-claude-text line-clamp-2">
            {session.summary || 'Empty session'}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-claude-muted">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {dateStr} {timeStr}
            </span>
            <span>{session.messages.length} messages</span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedProject: string | null;
  onSelect: (path: string) => void;
}

function ProjectList({ projects, selectedProject, onSelect }: ProjectListProps) {
  return (
    <div className="space-y-1">
      {projects.map((project) => (
        <button
          key={project.path}
          onClick={() => onSelect(project.path)}
          className={`
            w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left
            ${selectedProject === project.path
              ? 'bg-claude-orange/20 text-claude-orange'
              : 'hover:bg-claude-border/50 text-claude-muted hover:text-claude-text'
            }
          `}
        >
          <Folder size={16} />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{project.name}</p>
            <p className="text-xs text-claude-muted">{project.sessionCount} sessions</p>
          </div>
          <ChevronRight size={16} className="opacity-50" />
        </button>
      ))}
    </div>
  );
}

interface SessionDetailProps {
  session: HistorySession;
  onBack: () => void;
}

function SessionDetail({ session, onBack }: SessionDetailProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-claude-border">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-claude-border/50 text-claude-muted"
        >
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h3 className="text-sm font-medium text-claude-text">Session Detail</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {session.messages.map((msg, i) => (
          <div
            key={i}
            className={`
              p-3 rounded-lg
              ${msg.role === 'user'
                ? 'bg-claude-border/30 ml-8'
                : 'bg-claude-orange/10 mr-8'
              }
            `}
          >
            <div className="text-xs text-claude-muted mb-1">
              {msg.role === 'user' ? 'You' : 'Claude'}
            </div>
            <p className="text-sm text-claude-text whitespace-pre-wrap">
              {msg.content.slice(0, 500)}
              {msg.content.length > 500 && '...'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryBrowser() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null);

  const { projects, loading: projectsLoading } = useProjects();
  const { sessions, loading: sessionsLoading } = useProjectSessions(selectedProject);
  const { results: searchResults, loading: searchLoading, search } = useHistorySearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      search(searchQuery);
    }
  };

  if (selectedSession) {
    return <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />;
  }

  const displaySessions = searchQuery.trim() ? searchResults : sessions;

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-claude-border">
        <form onSubmit={handleSearch} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
            className="w-full pl-9 pr-4 py-2 bg-claude-darker border border-claude-border rounded-lg
              text-sm text-claude-text placeholder:text-claude-muted
              focus:outline-none focus:border-claude-orange"
          />
        </form>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Projects list */}
        {!searchQuery.trim() && (
          <div className="w-64 border-r border-claude-border overflow-y-auto p-3">
            <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wider mb-3 px-2">
              Projects
            </h3>
            {projectsLoading ? (
              <div className="text-sm text-claude-muted p-2">Loading...</div>
            ) : (
              <ProjectList
                projects={projects}
                selectedProject={selectedProject}
                onSelect={setSelectedProject}
              />
            )}
          </div>
        )}

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-claude-muted uppercase tracking-wider mb-3 px-2">
            {searchQuery.trim() ? 'Search Results' : 'Sessions'}
          </h3>

          {(sessionsLoading || searchLoading) ? (
            <div className="text-sm text-claude-muted p-2">Loading...</div>
          ) : displaySessions.length === 0 ? (
            <div className="text-sm text-claude-muted p-2">
              {searchQuery.trim()
                ? 'No results found'
                : selectedProject
                  ? 'No sessions in this project'
                  : 'Select a project'
              }
            </div>
          ) : (
            <div className="space-y-2">
              {displaySessions.map((session) => (
                <MessagePreview
                  key={session.id}
                  session={session}
                  onClick={() => setSelectedSession(session)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
