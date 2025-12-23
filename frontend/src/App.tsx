import React, { useEffect, useState, useRef } from 'react';
import { Search, FolderOpen, MessageSquare, Download, Settings, RefreshCw, Calendar } from 'lucide-react';

const API_URL = '/api';

interface Project {
  path: string;
  name: string;
  sessionCount: number;
  lastActivity: string;
}

interface HistoryMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: string;
}

interface SearchMatch {
  messageIndex: number;
  preview: string;
  role: string;
}

interface Session {
  id: string;
  project: string;
  messages: HistoryMessage[];
  createdAt: string;
  summary?: string;
  matches?: SearchMatch[];
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'projects' | 'search'>('projects');
  const [highlightedMessageIdx, setHighlightedMessageIdx] = useState<number | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState(''); // The query used for highlighting
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted message when it changes
  useEffect(() => {
    if (highlightedMessageIdx !== null && messagesContainerRef.current) {
      const messageEl = messagesContainerRef.current.querySelector(`[data-message-idx="${highlightedMessageIdx}"]`);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear highlight after a delay
        setTimeout(() => setHighlightedMessageIdx(null), 3000);
      }
    }
  }, [highlightedMessageIdx, selectedSession]);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async (projectPath: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/projects/${encodeURIComponent(projectPath)}/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSession = async (projectPath: string, sessionId: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/projects/${encodeURIComponent(projectPath)}/sessions/${sessionId}`);
      const data = await res.json();
      setSelectedSession(data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setView('search');
    setActiveSearchQuery(searchQuery);
    try {
      const res = await fetch(`${API_URL}/history/search?q=${encodeURIComponent(searchQuery)}&limit=50`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMatchClick = (session: Session, matchIdx: number) => {
    // Load the session and jump to the matching message
    if (session.project) {
      fetchSession(session.project, session.id).then(() => {
        setHighlightedMessageIdx(matchIdx);
      });
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveSearchQuery(''); // Clear search highlighting when browsing projects
    setHighlightedMessageIdx(null);
    fetchSessions(project.path);
  };

  const handleSessionSelect = (session: Session) => {
    setHighlightedMessageIdx(null);
    if (view === 'projects') {
      setActiveSearchQuery(''); // Clear search highlighting when browsing projects
    }
    if (selectedProject) {
      fetchSession(selectedProject.path, session.id);
    } else if (session.project) {
      fetchSession(session.project, session.id);
    }
  };

  const exportToMarkdown = () => {
    if (!selectedSession) return;

    let md = `# Chat Session\n\n`;
    md += `**Project:** ${selectedSession.project}\n`;
    md += `**Date:** ${new Date(selectedSession.createdAt).toLocaleString()}\n\n`;
    md += `---\n\n`;

    selectedSession.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `**You:**\n\n${msg.content}\n\n---\n\n`;
      } else if (msg.role === 'tool') {
        md += `**Tool (${msg.toolName}):**\n\n${msg.content}\n`;
        if (msg.toolInput) {
          md += `\n\`\`\`json\n${msg.toolInput}\n\`\`\`\n`;
        }
        md += `\n---\n\n`;
      } else {
        md += `**Claude:**\n\n${msg.content}\n\n---\n\n`;
      }
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${selectedSession.id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    }
    return date.toLocaleDateString();
  };

  const truncate = (str: string, len: number) => {
    if (str.length <= len) return str;
    return str.slice(0, len) + '...';
  };

  // Highlight search terms in text
  const highlightSearchTerm = (text: string, query: string): React.ReactNode => {
    if (!query) return text;

    const parts: React.ReactNode[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIdx = 0;

    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      // Add text before match
      if (idx > lastIdx) {
        parts.push(text.slice(lastIdx, idx));
      }
      // Add highlighted match
      parts.push(
        <mark key={idx} className="bg-yellow-500/40 text-claude-text rounded px-0.5">
          {text.slice(idx, idx + query.length)}
        </mark>
      );
      lastIdx = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIdx);
    }
    // Add remaining text
    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }

    return parts;
  };

  return (
    <div className="h-screen flex bg-claude-bg">
      {/* Sidebar */}
      <div className="w-80 bg-claude-surface border-r border-claude-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-claude-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claude-orange to-amber-600 flex items-center justify-center text-white font-bold">
              C
            </div>
            <div>
              <h1 className="font-bold text-claude-text">Déjà Claude</h1>
              <p className="text-xs text-claude-muted">Find any conversation</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2 bg-claude-bg border border-claude-border rounded-lg
                text-claude-text placeholder-claude-muted text-sm
                focus:outline-none focus:ring-2 focus:ring-claude-orange focus:border-transparent"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-claude-muted" />
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex border-b border-claude-border">
          <button
            onClick={() => setView('projects')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${view === 'projects'
                ? 'text-claude-orange border-b-2 border-claude-orange'
                : 'text-claude-muted hover:text-claude-text'}`}
          >
            Projects
          </button>
          <button
            onClick={() => setView('search')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${view === 'search'
                ? 'text-claude-orange border-b-2 border-claude-orange'
                : 'text-claude-muted hover:text-claude-text'}`}
          >
            Search
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'projects' ? (
            <>
              {/* Projects List */}
              {!selectedProject ? (
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1.5 mb-2">
                    <span className="text-xs font-semibold text-claude-muted uppercase tracking-wider">
                      Projects ({projects.length})
                    </span>
                    <button
                      onClick={fetchProjects}
                      className="p-1 rounded hover:bg-claude-border/50 text-claude-muted hover:text-claude-text"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {loading && projects.length === 0 ? (
                    <p className="text-sm text-claude-muted text-center py-8">Loading...</p>
                  ) : (
                    projects.map((project) => (
                      <button
                        key={project.path}
                        onClick={() => handleProjectSelect(project)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          hover:bg-claude-border/50 transition-colors text-left group"
                      >
                        <FolderOpen size={18} className="text-claude-orange shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text truncate">{project.name}</p>
                          <p className="text-xs text-claude-muted">
                            {project.sessionCount} sessions · {formatDate(project.lastActivity)}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                /* Sessions List */
                <div className="p-2">
                  <button
                    onClick={() => {
                      setSelectedProject(null);
                      setSessions([]);
                      setSelectedSession(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm text-claude-muted
                      hover:text-claude-text transition-colors"
                  >
                    ← Back to Projects
                  </button>

                  <div className="px-2 py-1.5 mb-2">
                    <p className="text-xs font-semibold text-claude-muted uppercase tracking-wider">
                      {selectedProject.name}
                    </p>
                    <p className="text-xs text-claude-muted">{sessions.length} sessions</p>
                  </div>

                  {loading ? (
                    <p className="text-sm text-claude-muted text-center py-8">Loading...</p>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleSessionSelect(session)}
                        className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg
                          transition-colors text-left
                          ${selectedSession?.id === session.id
                            ? 'bg-claude-border'
                            : 'hover:bg-claude-border/50'}`}
                      >
                        <MessageSquare size={16} className="text-claude-muted shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text line-clamp-2">
                            {session.summary || 'Empty session'}
                          </p>
                          <p className="text-xs text-claude-muted mt-1">
                            {formatDate(session.createdAt)} · {session.messages.length} messages
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            /* Search Results */
            <div className="p-2">
              {isSearching ? (
                <p className="text-sm text-claude-muted text-center py-8">Searching...</p>
              ) : searchResults.length > 0 ? (
                <>
                  <p className="text-xs text-claude-muted px-2 py-1.5 mb-2">
                    {searchResults.length} sessions with matches for "{searchQuery}"
                  </p>
                  {searchResults.map((session) => (
                    <div
                      key={`${session.project}-${session.id}`}
                      className={`mb-3 rounded-lg overflow-hidden border
                        ${selectedSession?.id === session.id
                          ? 'border-claude-orange'
                          : 'border-claude-border'}`}
                    >
                      {/* Session header */}
                      <button
                        onClick={() => handleSessionSelect(session)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 bg-claude-surface
                          hover:bg-claude-border/50 transition-colors text-left"
                      >
                        <MessageSquare size={16} className="text-claude-muted shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text line-clamp-1">
                            {session.summary || 'Session'}
                          </p>
                          <p className="text-xs text-claude-muted">
                            {formatDate(session.createdAt)} · {session.matches?.length || 0} matches
                          </p>
                        </div>
                      </button>
                      {/* Match previews */}
                      {session.matches && session.matches.length > 0 && (
                        <div className="bg-claude-bg border-t border-claude-border">
                          {session.matches.slice(0, 3).map((match, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleMatchClick(session, match.messageIndex)}
                              className="w-full px-3 py-2 text-left hover:bg-claude-border/30
                                border-b border-claude-border/50 last:border-b-0 transition-colors"
                            >
                              <span className={`text-xs font-medium mr-2
                                ${match.role === 'user' ? 'text-blue-400' : match.role === 'tool' ? 'text-gray-400' : 'text-claude-orange'}`}>
                                {match.role === 'user' ? 'You' : match.role === 'tool' ? 'Tool' : 'Claude'}:
                              </span>
                              <span className="text-xs text-claude-muted">
                                {match.preview}
                              </span>
                            </button>
                          ))}
                          {session.matches.length > 3 && (
                            <p className="text-xs text-claude-muted px-3 py-1.5 text-center">
                              +{session.matches.length - 3} more matches
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : searchQuery ? (
                <p className="text-sm text-claude-muted text-center py-8">No results found</p>
              ) : (
                <p className="text-sm text-claude-muted text-center py-8">
                  Enter a search term to find conversations
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-claude-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-claude-muted">Déjà Claude v1.0</span>
            <button className="p-2 rounded-lg hover:bg-claude-border/50 text-claude-muted hover:text-claude-text">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSession ? (
          <>
            {/* Session Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-claude-border bg-claude-surface">
              <div className="flex items-center gap-3">
                <MessageSquare size={20} className="text-claude-orange" />
                <div>
                  <p className="text-sm font-medium text-claude-text">
                    {truncate(selectedSession.summary || 'Session', 50)}
                  </p>
                  <p className="text-xs text-claude-muted flex items-center gap-2">
                    <Calendar size={12} />
                    {new Date(selectedSession.createdAt).toLocaleString()}
                    <span>·</span>
                    {selectedSession.messages.length} messages
                  </p>
                </div>
              </div>
              <button
                onClick={exportToMarkdown}
                className="flex items-center gap-2 px-4 py-2 bg-claude-orange hover:bg-claude-orange/90
                  text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download size={16} />
                Export MD
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
              {selectedSession.messages.map((msg, idx) => {
                const isHighlighted = highlightedMessageIdx === idx;
                const hasSearchMatch = activeSearchQuery && msg.content.toLowerCase().includes(activeSearchQuery.toLowerCase());

                return (
                  <div
                    key={idx}
                    data-message-idx={idx}
                    className={`px-6 py-6 border-b border-claude-border/50 transition-all duration-500
                      ${msg.role === 'user' ? 'bg-claude-bg' : msg.role === 'tool' ? 'bg-gray-900/50' : 'bg-claude-surface'}
                      ${isHighlighted ? 'ring-2 ring-claude-orange ring-inset bg-claude-orange/10' : ''}
                      ${hasSearchMatch && !isHighlighted ? 'border-l-4 border-l-claude-orange' : ''}`}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium
                          ${msg.role === 'user' ? 'bg-blue-600' : msg.role === 'tool' ? 'bg-gray-600' : 'bg-claude-orange'}`}>
                          {msg.role === 'user' ? 'Y' : msg.role === 'tool' ? 'T' : 'C'}
                        </div>
                        <span className="font-medium text-claude-text">
                          {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `Tool: ${msg.toolName}` : 'Claude'}
                        </span>
                        {msg.timestamp && (
                          <span className="text-xs text-claude-muted">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                        {hasSearchMatch && (
                          <span className="text-xs bg-claude-orange/20 text-claude-orange px-2 py-0.5 rounded">
                            Match
                          </span>
                        )}
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none pl-11">
                        {msg.role === 'tool' && msg.toolInput ? (
                          <details className="text-claude-muted">
                            <summary className="cursor-pointer text-claude-text hover:text-claude-orange">
                              {msg.content}
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-800 rounded text-xs overflow-x-auto">
                              {msg.toolInput}
                            </pre>
                          </details>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-claude-text leading-relaxed">
                            {activeSearchQuery ? highlightSearchTerm(msg.content, activeSearchQuery) : msg.content}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-claude-orange/20 to-amber-600/20 flex items-center justify-center">
                <MessageSquare size={32} className="text-claude-orange" />
              </div>
              <h2 className="text-2xl font-bold text-claude-text mb-3">Déjà Claude</h2>
              <p className="text-claude-muted leading-relaxed">
                "I know I asked Claude about this before..."
                <br />
                Search, browse, and export your conversation history.
              </p>
              <div className="mt-6 flex justify-center gap-4 text-sm text-claude-muted">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-claude-orange" />
                  {projects.length} projects
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-claude-orange" />
                  {projects.reduce((sum, p) => sum + p.sessionCount, 0)} sessions
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
