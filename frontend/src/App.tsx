import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, FolderOpen, MessageSquare, Download, Settings, RefreshCw, Calendar, Sparkles, ChevronRight, Zap, Clock, Hash, Terminal, Cpu, Database } from 'lucide-react';

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
  const [exporting, setExporting] = useState(false);
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

  // Full export - includes everything
  const exportToMarkdown = useCallback(() => {
    if (!selectedSession || exporting) return;

    setExporting(true);

    requestAnimationFrame(() => {
      try {
        const parts: string[] = [
          `# Chat Session\n\n`,
          `| Property | Value |\n`,
          `|----------|-------|\n`,
          `| **Project** | \`${selectedSession.project || 'Unknown'}\` |\n`,
          `| **Session ID** | \`${selectedSession.id}\` |\n`,
          `| **Date** | ${new Date(selectedSession.createdAt).toLocaleString()} |\n`,
          `| **Messages** | ${selectedSession.messages.length} |\n`,
          `\n---\n\n`
        ];

        selectedSession.messages.forEach((msg, idx) => {
          const timestamp = msg.timestamp ? `\n> *${new Date(msg.timestamp).toLocaleString()}*\n` : '';

          if (msg.role === 'user') {
            parts.push(`## 💬 You (Message ${idx + 1})\n${timestamp}\n${msg.content}\n\n---\n\n`);
          } else if (msg.role === 'tool') {
            parts.push(`## 🔧 Tool: \`${msg.toolName || 'Unknown'}\` (Message ${idx + 1})\n${timestamp}\n`);

            // Tool input/parameters
            if (msg.toolInput) {
              parts.push(`### Input\n\n\`\`\`json\n${msg.toolInput}\n\`\`\`\n\n`);
            }

            // Tool output/result
            if (msg.content) {
              parts.push(`### Output\n\n\`\`\`\n${msg.content}\n\`\`\`\n\n`);
            }

            parts.push(`---\n\n`);
          } else {
            // Assistant message
            parts.push(`## 🤖 Claude (Message ${idx + 1})\n${timestamp}\n${msg.content}\n\n---\n\n`);
          }
        });

        // Add footer
        parts.push(`\n---\n\n*Exported from [Déjà Claude](https://github.com/consigcody94/deja-claude) on ${new Date().toLocaleString()}*\n`);

        const md = parts.join('');
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `deja-claude-${selectedSession.id.slice(0, 8)}.md`;
        link.click();

        URL.revokeObjectURL(url);
        setExporting(false);
      } catch (error) {
        console.error('Export failed:', error);
        setExporting(false);
      }
    });
  }, [selectedSession, exporting]);

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
    let keyIdx = 0;
    while (idx !== -1) {
      if (idx > lastIdx) parts.push(text.slice(lastIdx, idx));
      parts.push(<mark key={keyIdx++}>{text.slice(idx, idx + query.length)}</mark>);
      lastIdx = idx + query.length;
      idx = lowerText.indexOf(lowerQuery, lastIdx);
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
  };

  const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

  return (
    <div className="h-screen flex bg-[#020208] overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Floating orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar */}
      <div className="w-80 relative z-10 flex flex-col border-r border-cyan-500/10 bg-gradient-to-b from-[#0a0a18]/95 to-[#050510]/95 backdrop-blur-xl">
        {/* Sidebar glow line */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Sparkles size={22} className="text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0a0a18] pulse-dot" />
            </div>
            <div>
              <h1 className="font-bold text-xl font-cyber gradient-text tracking-wide">DÉJÀ CLAUDE</h1>
              <p className="text-xs text-cyan-400/60 font-mono">MEMORY_BANK.ACTIVE</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search memory banks..."
              className="relative w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl
                text-white placeholder-white/30 text-sm font-mono
                focus:border-cyan-500/50 focus:bg-white/10 transition-all duration-300"
            />
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-cyan-400 transition-colors" />
            {searchQuery && (
              <button
                onClick={handleSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-orange-500/30 transition-all uppercase tracking-wider"
              >
                Scan
              </button>
            )}
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex p-1.5 m-4 bg-white/5 rounded-xl border border-white/5">
          <button
            onClick={() => setView('projects')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-2
              ${view === 'projects'
                ? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-400 shadow-lg shadow-orange-500/10 border border-orange-500/20'
                : 'text-white/40 hover:text-white/70'}`}
          >
            <Database size={14} />
            Projects
          </button>
          <button
            onClick={() => setView('search')}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-2
              ${view === 'search'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10 border border-cyan-500/20'
                : 'text-white/40 hover:text-white/70'}`}
          >
            <Search size={14} />
            Search
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {view === 'projects' ? (
            <>
              {!selectedProject ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 py-3">
                    <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest flex items-center gap-2">
                      <Terminal size={12} />
                      {projects.length} DATABASES
                    </span>
                    <button
                      onClick={fetchProjects}
                      className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-cyan-400 transition-all"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  {loading && projects.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-sm text-white/40 font-mono">SCANNING...</p>
                    </div>
                  ) : (
                    projects.map((project, idx) => (
                      <button
                        key={project.path}
                        onClick={() => handleProjectSelect(project)}
                        className="w-full group relative overflow-hidden"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <div className="relative flex items-center gap-3 px-4 py-4 rounded-xl border border-transparent hover:border-orange-500/20 hover:bg-white/5 transition-all duration-300 fade-up">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center group-hover:shadow-lg group-hover:shadow-orange-500/20 transition-all border border-orange-500/20">
                            <FolderOpen size={18} className="text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-white font-medium truncate">{project.name.split('/').pop()}</p>
                            <p className="text-xs text-white/40 font-mono flex items-center gap-2 mt-0.5">
                              <span className="text-cyan-400">{project.sessionCount}</span> sessions
                              <span className="text-white/20">|</span>
                              {formatDate(project.lastActivity)}
                            </p>
                          </div>
                          <ChevronRight size={16} className="text-white/20 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => { setSelectedProject(null); setSessions([]); setSelectedSession(null); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/50
                      hover:text-cyan-400 transition-colors rounded-xl hover:bg-white/5 font-mono"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                    ../BACK
                  </button>

                  <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-sm font-medium text-white truncate">{selectedProject.name.split('/').pop()}</p>
                    <p className="text-xs text-cyan-400/60 font-mono mt-1">{sessions.length} RECORDS FOUND</p>
                  </div>

                  {loading ? (
                    <div className="py-16 text-center">
                      <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                    </div>
                  ) : (
                    sessions.map((session, idx) => (
                      <button
                        key={session.id}
                        onClick={() => handleSessionSelect(session)}
                        className={`w-full group relative overflow-hidden fade-up`}
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className={`relative flex items-start gap-3 px-4 py-4 rounded-xl border transition-all duration-300
                          ${selectedSession?.id === session.id
                            ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                            : 'border-transparent hover:border-white/10 hover:bg-white/5'}`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border
                            ${selectedSession?.id === session.id
                              ? 'bg-cyan-500/20 border-cyan-500/30'
                              : 'bg-white/5 border-white/10 group-hover:border-cyan-500/20'}`}>
                            <MessageSquare size={15} className={selectedSession?.id === session.id ? 'text-cyan-400' : 'text-white/50'} />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm text-white/90 line-clamp-2">{session.summary || 'Empty session'}</p>
                            <p className="text-xs text-white/30 mt-1.5 flex items-center gap-2 font-mono">
                              <Clock size={10} className="text-cyan-400/50" />
                              {formatDate(session.createdAt)}
                              <span className="text-white/10">|</span>
                              <span className="text-cyan-400/50">{session.messages.length}</span> msg
                            </p>
                          </div>
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
                <div className="py-16 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-full animate-ping" />
                    <div className="absolute inset-2 border-2 border-cyan-400/50 rounded-full animate-spin" />
                    <div className="absolute inset-4 bg-cyan-500/20 rounded-full" />
                  </div>
                  <p className="text-sm text-cyan-400 font-mono animate-pulse">SCANNING MEMORY BANKS...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 px-2 py-3">
                    <Zap size={14} className="text-cyan-400" />
                    <span className="text-xs text-cyan-400/80 font-mono uppercase tracking-wider">
                      {searchResults.length} MATCHES FOUND
                    </span>
                  </div>
                  {searchResults.map((session, idx) => (
                    <div
                      key={`${session.project}-${session.id}`}
                      className={`rounded-xl overflow-hidden border transition-all duration-300 fade-up
                        ${selectedSession?.id === session.id
                          ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                          : 'border-white/5 hover:border-cyan-500/20'}`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <button
                        onClick={() => handleSessionSelect(session)}
                        className="w-full flex items-start gap-3 px-4 py-4 bg-white/5 hover:bg-white/10 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/20">
                          <MessageSquare size={15} className="text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium line-clamp-1">
                            {session.summary || 'Session'}
                          </p>
                          <p className="text-xs text-white/40 mt-1 font-mono">
                            {formatDate(session.createdAt)} | <span className="text-cyan-400">{session.matches?.length || 0}</span> hits
                          </p>
                        </div>
                      </button>
                      {session.matches && session.matches.length > 0 && (
                        <div className="border-t border-white/5 bg-black/20">
                          {session.matches.slice(0, 3).map((match, mIdx) => (
                            <button
                              key={mIdx}
                              onClick={() => handleMatchClick(session, match.messageIndex)}
                              className="w-full px-4 py-3 text-left hover:bg-white/5 border-b border-white/5 last:border-b-0 transition-colors group"
                            >
                              <span className={`text-[10px] font-bold uppercase tracking-wider mr-2 px-2 py-1 rounded
                                ${match.role === 'user'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : match.role === 'tool'
                                    ? 'bg-purple-500/20 text-purple-400'
                                    : 'bg-orange-500/20 text-orange-400'}`}>
                                {match.role === 'user' ? 'YOU' : match.role === 'tool' ? 'TOOL' : 'AI'}
                              </span>
                              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors font-mono">
                                {match.preview}
                              </span>
                            </button>
                          ))}
                          {session.matches.length > 3 && (
                            <p className="text-xs text-cyan-400/50 px-4 py-2 text-center font-mono">
                              +{session.matches.length - 3} more matches
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : searchQuery ? (
                <div className="py-16 text-center">
                  <Search size={40} className="text-white/10 mx-auto mb-4" />
                  <p className="text-sm text-white/30 font-mono">NO MATCHES FOUND</p>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <Search size={40} className="text-white/10 mx-auto mb-4" />
                  <p className="text-sm text-white/30 font-mono">ENTER SEARCH QUERY</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30 font-mono flex items-center gap-2">
              <Cpu size={12} className="text-cyan-400/50" />
              v1.0.0
            </span>
            <button className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-all">
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {selectedSession ? (
          <>
            {/* Session Header */}
            <div className="relative flex items-center justify-between px-8 py-5 border-b border-white/5 bg-gradient-to-r from-[#0a0a18]/90 to-[#0a0a18]/70 backdrop-blur-xl">
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/30 rounded-xl blur-lg" />
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30">
                    <MessageSquare size={20} className="text-cyan-400" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-medium text-white">
                    {truncate(selectedSession.summary || 'Session', 60)}
                  </p>
                  <p className="text-xs text-white/40 flex items-center gap-3 mt-1 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-cyan-400/50" />
                      {new Date(selectedSession.createdAt).toLocaleString()}
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-cyan-400">{selectedSession.messages.length}</span> messages
                  </p>
                </div>
              </div>

              <button
                onClick={exportToMarkdown}
                disabled={exporting}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300
                  ${exporting
                    ? 'bg-white/10 text-white/50 cursor-wait'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5'}`}
              >
                {exporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Export
                  </>
                )}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-black/20" ref={messagesContainerRef}>
              {selectedSession.messages.map((msg, idx) => {
                const isHighlighted = highlightedMessageIdx === idx;
                const hasSearchMatch = activeSearchQuery && msg.content.toLowerCase().includes(activeSearchQuery.toLowerCase());

                return (
                  <div
                    key={idx}
                    data-message-idx={idx}
                    className={`relative px-8 py-6 border-b border-white/5 transition-all duration-500 fade-up
                      ${msg.role === 'user'
                        ? 'bg-transparent'
                        : msg.role === 'tool'
                          ? 'bg-purple-500/5'
                          : 'bg-cyan-500/5'}
                      ${isHighlighted ? 'highlight-message' : ''}
                      ${hasSearchMatch && !isHighlighted ? 'border-l-2 border-l-cyan-500' : ''}`}
                    style={{ animationDelay: `${idx * 20}ms` }}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold uppercase border
                          ${msg.role === 'user'
                            ? 'bg-gradient-to-br from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400'
                            : msg.role === 'tool'
                              ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400'
                              : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-400'}`}>
                          {msg.role === 'user' ? 'YOU' : msg.role === 'tool' ? 'T' : 'AI'}
                        </div>
                        <div className="flex-1">
                          <span className="font-semibold text-white text-sm">
                            {msg.role === 'user' ? 'You' : msg.role === 'tool' ? `Tool: ${msg.toolName}` : 'Claude'}
                          </span>
                          {msg.timestamp && (
                            <span className="text-xs text-white/30 ml-3 font-mono">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        {hasSearchMatch && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/30">
                            Match
                          </span>
                        )}
                      </div>
                      <div className="pl-14">
                        {msg.role === 'tool' && msg.toolInput ? (
                          <details className="group">
                            <summary className="cursor-pointer text-white/80 hover:text-cyan-400 transition-colors text-sm font-medium">
                              {msg.content}
                            </summary>
                            <pre className="mt-4 p-5 bg-black/30 rounded-xl text-xs overflow-x-auto border border-white/5 font-mono text-cyan-300/80">
                              {msg.toolInput}
                            </pre>
                          </details>
                        ) : (
                          <div className="whitespace-pre-wrap text-white/80 text-sm leading-relaxed">
                            {activeSearchQuery ? highlightSearchTerm(msg.content, activeSearchQuery) : msg.content}
                          </div>
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
              {/* Animated Logo */}
              <div className="relative w-32 h-32 mx-auto mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-cyan-500/20 rounded-3xl blur-2xl animate-pulse" />
                <div className="absolute inset-0 border-2 border-orange-500/20 rounded-3xl animate-spin" style={{ animationDuration: '8s' }} />
                <div className="absolute inset-4 border border-cyan-500/30 rounded-2xl" />
                <div className="absolute inset-8 bg-gradient-to-br from-[#0a0a18] to-[#050510] rounded-xl flex items-center justify-center">
                  <Sparkles size={32} className="text-orange-400 float" />
                </div>
              </div>

              <h2 className="text-4xl font-bold font-cyber gradient-text mb-4 tracking-wider">DÉJÀ CLAUDE</h2>
              <p className="text-white/50 text-lg mb-2 italic">
                "I know I asked Claude about this before..."
              </p>
              <p className="text-white/30 text-sm font-mono">
                SEARCH // BROWSE // EXPORT
              </p>

              <div className="mt-10 flex justify-center gap-4">
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10">
                  <FolderOpen size={18} className="text-orange-400" />
                  <span className="text-white font-bold text-lg">{projects.length}</span>
                  <span className="text-white/40 text-sm font-mono">PROJECTS</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10">
                  <MessageSquare size={18} className="text-cyan-400" />
                  <span className="text-white font-bold text-lg">{totalSessions}</span>
                  <span className="text-white/40 text-sm font-mono">SESSIONS</span>
                </div>
              </div>

              {/* Tech lines decoration */}
              <div className="mt-12 flex items-center justify-center gap-2">
                <div className="w-20 h-px bg-gradient-to-r from-transparent to-orange-500/50" />
                <Hash size={14} className="text-white/20" />
                <div className="w-20 h-px bg-gradient-to-l from-transparent to-cyan-500/50" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
