import React, { useEffect, useState, useRef } from 'react';
import { Search, FolderOpen, MessageSquare, Download, Settings, RefreshCw, Calendar, Sparkles, ChevronRight, Zap, Clock, Hash } from 'lucide-react';

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
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedMessageIdx !== null && messagesContainerRef.current) {
      const messageEl = messagesContainerRef.current.querySelector(`[data-message-idx="${highlightedMessageIdx}"]`);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedMessageIdx(null), 3000);
      }
    }
  }, [highlightedMessageIdx, selectedSession]);

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
    if (session.project) {
      fetchSession(session.project, session.id).then(() => {
        setHighlightedMessageIdx(matchIdx);
      });
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveSearchQuery('');
    setHighlightedMessageIdx(null);
    fetchSessions(project.path);
  };

  const handleSessionSelect = (session: Session) => {
    setHighlightedMessageIdx(null);
    if (view === 'projects') {
      setActiveSearchQuery('');
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
    md += `**Date:** ${new Date(selectedSession.createdAt).toLocaleString()}\n\n---\n\n`;
    selectedSession.messages.forEach((msg) => {
      if (msg.role === 'user') {
        md += `**You:**\n\n${msg.content}\n\n---\n\n`;
      } else if (msg.role === 'tool') {
        md += `**Tool (${msg.toolName}):**\n\n${msg.content}\n`;
        if (msg.toolInput) md += `\n\`\`\`json\n${msg.toolInput}\n\`\`\`\n`;
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
    if (days === 0) return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const truncate = (str: string, len: number) => str.length <= len ? str : str.slice(0, len) + '...';

  const highlightSearchTerm = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const parts: React.ReactNode[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let lastIdx = 0;
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
      parts.push(<mark key={idx}>{text.slice(idx, idx + query.length)}</mark>);
      lastIdx = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIdx);
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

  return (
    <div className="h-screen flex bg-claude-bg">
      {/* Sidebar */}
      <div className="w-80 glass-dark flex flex-col border-r border-white/5">
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-claude-orange via-amber-500 to-claude-orange flex items-center justify-center shadow-glow">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-claude-bg pulse-dot" />
            </div>
            <div>
              <h1 className="font-semibold text-lg gradient-text">Déjà Claude</h1>
              <p className="text-xs text-claude-muted">Find any conversation</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search conversations..."
              className="w-full pl-10 pr-4 py-2.5 bg-claude-elevated/50 border border-white/5 rounded-xl
                text-claude-text placeholder-claude-muted text-sm
                focus:border-claude-orange/50 focus:bg-claude-elevated transition-all duration-200"
            />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-claude-muted group-focus-within:text-claude-orange transition-colors" />
            {searchQuery && (
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-claude-orange/20 text-claude-orange text-xs rounded-lg hover:bg-claude-orange/30 transition-colors"
              >
                Search
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex p-1 m-4 bg-claude-elevated/30 rounded-xl">
          <button
            onClick={() => setView('projects')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200
              ${view === 'projects'
                ? 'bg-gradient-to-r from-claude-orange/20 to-amber-500/20 text-claude-orange shadow-inner-glow'
                : 'text-claude-muted hover:text-claude-text'}`}
          >
            <FolderOpen size={14} className="inline mr-2" />
            Projects
          </button>
          <button
            onClick={() => setView('search')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200
              ${view === 'search'
                ? 'bg-gradient-to-r from-claude-orange/20 to-amber-500/20 text-claude-orange shadow-inner-glow'
                : 'text-claude-muted hover:text-claude-text'}`}
          >
            <Search size={14} className="inline mr-2" />
            Search
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3">
          {view === 'projects' ? (
            <>
              {!selectedProject ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-2 mb-2">
                    <span className="text-xs font-medium text-claude-muted uppercase tracking-wider flex items-center gap-2">
                      <Hash size={12} />
                      {projects.length} Projects
                    </span>
                    <button
                      onClick={fetchProjects}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-claude-muted hover:text-claude-text transition-all"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {loading && projects.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-claude-orange/30 border-t-claude-orange rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-claude-muted">Loading projects...</p>
                    </div>
                  ) : (
                    projects.map((project, idx) => (
                      <button
                        key={project.path}
                        onClick={() => handleProjectSelect(project)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl
                          hover:bg-white/5 transition-all duration-200 text-left group card-hover fade-up"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-claude-orange/20 to-amber-500/10 flex items-center justify-center group-hover:from-claude-orange/30 group-hover:to-amber-500/20 transition-all">
                          <FolderOpen size={16} className="text-claude-orange" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text truncate font-medium">{project.name.split('/').pop()}</p>
                          <p className="text-xs text-claude-muted flex items-center gap-2">
                            <span>{project.sessionCount} sessions</span>
                            <span className="w-1 h-1 rounded-full bg-claude-muted/50" />
                            <span>{formatDate(project.lastActivity)}</span>
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-claude-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    onClick={() => { setSelectedProject(null); setSessions([]); setSelectedSession(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 mb-3 text-sm text-claude-muted
                      hover:text-claude-orange transition-colors rounded-lg hover:bg-white/5"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                    Back to Projects
                  </button>

                  <div className="px-2 py-2 mb-2">
                    <p className="text-sm font-medium text-claude-text truncate">{selectedProject.name.split('/').pop()}</p>
                    <p className="text-xs text-claude-muted">{sessions.length} sessions</p>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center">
                      <div className="w-8 h-8 border-2 border-claude-orange/30 border-t-claude-orange rounded-full animate-spin mx-auto" />
                    </div>
                  ) : (
                    sessions.map((session, idx) => (
                      <button
                        key={session.id}
                        onClick={() => handleSessionSelect(session)}
                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl
                          transition-all duration-200 text-left group fade-up
                          ${selectedSession?.id === session.id
                            ? 'bg-gradient-to-r from-claude-orange/10 to-transparent border-l-2 border-claude-orange'
                            : 'hover:bg-white/5'}`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all
                          ${selectedSession?.id === session.id
                            ? 'bg-claude-orange/20'
                            : 'bg-claude-elevated group-hover:bg-claude-orange/10'}`}>
                          <MessageSquare size={14} className={selectedSession?.id === session.id ? 'text-claude-orange' : 'text-claude-muted'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text line-clamp-2">{session.summary || 'Empty session'}</p>
                          <p className="text-xs text-claude-muted mt-1 flex items-center gap-2">
                            <Clock size={10} />
                            {formatDate(session.createdAt)}
                            <span className="w-1 h-1 rounded-full bg-claude-muted/50" />
                            {session.messages.length} msgs
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
            <div className="space-y-3">
              {isSearching ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 border-2 border-claude-orange/30 border-t-claude-orange rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-claude-muted">Searching...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <p className="text-xs text-claude-muted px-2 py-2 flex items-center gap-2">
                    <Zap size={12} className="text-claude-orange" />
                    {searchResults.length} sessions found
                  </p>
                  {searchResults.map((session, idx) => (
                    <div
                      key={`${session.project}-${session.id}`}
                      className={`rounded-xl overflow-hidden border transition-all duration-200 fade-up
                        ${selectedSession?.id === session.id
                          ? 'border-claude-orange/50 shadow-glow'
                          : 'border-white/5 hover:border-white/10'}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <button
                        onClick={() => handleSessionSelect(session)}
                        className="w-full flex items-start gap-3 px-4 py-3 bg-claude-elevated/30
                          hover:bg-claude-elevated/50 transition-all text-left"
                      >
                        <MessageSquare size={16} className="text-claude-orange shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-claude-text line-clamp-1 font-medium">
                            {session.summary || 'Session'}
                          </p>
                          <p className="text-xs text-claude-muted mt-0.5">
                            {formatDate(session.createdAt)} · {session.matches?.length || 0} matches
                          </p>
                        </div>
                      </button>
                      {session.matches && session.matches.length > 0 && (
                        <div className="border-t border-white/5 bg-claude-bg/50">
                          {session.matches.slice(0, 3).map((match, mIdx) => (
                            <button
                              key={mIdx}
                              onClick={() => handleMatchClick(session, match.messageIndex)}
                              className="w-full px-4 py-2.5 text-left hover:bg-white/5
                                border-b border-white/5 last:border-b-0 transition-colors group"
                            >
                              <span className={`text-xs font-medium mr-2 px-1.5 py-0.5 rounded
                                ${match.role === 'user'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : match.role === 'tool'
                                    ? 'bg-gray-500/20 text-gray-400'
                                    : 'bg-claude-orange/20 text-claude-orange'}`}>
                                {match.role === 'user' ? 'You' : match.role === 'tool' ? 'Tool' : 'Claude'}
                              </span>
                              <span className="text-xs text-claude-muted group-hover:text-claude-text transition-colors">
                                {match.preview}
                              </span>
                            </button>
                          ))}
                          {session.matches.length > 3 && (
                            <p className="text-xs text-claude-muted px-4 py-2 text-center bg-claude-elevated/20">
                              +{session.matches.length - 3} more matches
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : searchQuery ? (
                <div className="py-12 text-center">
                  <Search size={32} className="text-claude-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-claude-muted">No results found</p>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Search size={32} className="text-claude-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-claude-muted">Enter a search term</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-claude-muted flex items-center gap-2">
              <Sparkles size={12} className="text-claude-orange" />
              Déjà Claude
            </span>
            <button className="p-2 rounded-lg hover:bg-white/5 text-claude-muted hover:text-claude-text transition-all">
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass-dark">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claude-orange/20 to-amber-500/10 flex items-center justify-center">
                  <MessageSquare size={18} className="text-claude-orange" />
                </div>
                <div>
                  <p className="text-sm font-medium text-claude-text">
                    {truncate(selectedSession.summary || 'Session', 60)}
                  </p>
                  <p className="text-xs text-claude-muted flex items-center gap-2">
                    <Calendar size={12} />
                    {new Date(selectedSession.createdAt).toLocaleString()}
                    <span className="w-1 h-1 rounded-full bg-claude-muted/50" />
                    {selectedSession.messages.length} messages
                  </p>
                </div>
              </div>
              <button
                onClick={exportToMarkdown}
                className="flex items-center gap-2 px-4 py-2.5 btn-primary rounded-xl text-sm font-medium"
              >
                <Download size={16} />
                Export
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
                    className={`px-6 py-5 border-b border-white/5 transition-all duration-500 fade-up
                      ${msg.role === 'user'
                        ? 'bg-transparent'
                        : msg.role === 'tool'
                          ? 'bg-claude-elevated/20'
                          : 'bg-claude-surface/30'}
                      ${isHighlighted ? 'highlight-message bg-claude-orange/5' : ''}
                      ${hasSearchMatch && !isHighlighted ? 'border-l-2 border-l-claude-orange' : ''}`}
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold
                          ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                            : msg.role === 'tool'
                              ? 'bg-gradient-to-br from-gray-600 to-gray-700 text-white'
                              : 'bg-gradient-to-br from-claude-orange to-amber-500 text-white'}`}>
                          {msg.role === 'user' ? 'Y' : msg.role === 'tool' ? 'T' : 'C'}
                        </div>
                        <span className="font-medium text-claude-text text-sm">
                          {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `Tool: ${msg.toolName}` : 'Claude'}
                        </span>
                        {msg.timestamp && (
                          <span className="text-xs text-claude-muted">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                        {hasSearchMatch && (
                          <span className="text-xs bg-claude-orange/20 text-claude-orange px-2 py-0.5 rounded-full font-medium">
                            Match
                          </span>
                        )}
                      </div>
                      <div className="pl-11">
                        {msg.role === 'tool' && msg.toolInput ? (
                          <details className="text-claude-muted">
                            <summary className="cursor-pointer text-claude-text hover:text-claude-orange transition-colors text-sm">
                              {msg.content}
                            </summary>
                            <pre className="mt-3 p-4 bg-claude-bg/50 rounded-xl text-xs overflow-x-auto border border-white/5 font-mono">
                              {msg.toolInput}
                            </pre>
                          </details>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-claude-text text-sm leading-relaxed">
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
            <div className="text-center max-w-lg px-8">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-claude-orange/20 to-amber-500/10 animate-pulse" />
                <div className="absolute inset-2 rounded-2xl bg-claude-surface flex items-center justify-center">
                  <Sparkles size={36} className="text-claude-orange float" />
                </div>
              </div>
              <h2 className="text-3xl font-bold gradient-text mb-4">Déjà Claude</h2>
              <p className="text-claude-muted leading-relaxed text-lg mb-2">
                "I know I asked Claude about this before..."
              </p>
              <p className="text-claude-muted/70 text-sm">
                Search, browse, and export your conversation history.
              </p>
              <div className="mt-8 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-elevated/30 border border-white/5">
                  <FolderOpen size={16} className="text-claude-orange" />
                  <span className="text-claude-text font-medium">{projects.length}</span>
                  <span className="text-claude-muted">projects</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-claude-elevated/30 border border-white/5">
                  <MessageSquare size={16} className="text-claude-orange" />
                  <span className="text-claude-text font-medium">{totalSessions}</span>
                  <span className="text-claude-muted">sessions</span>
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
