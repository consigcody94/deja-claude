import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Search, FolderOpen, MessageSquare, Download, Settings, RefreshCw, Calendar, ChevronRight, Zap, Clock, Hash, Terminal, Cpu, Database, Bookmark, BookmarkCheck, BarChart3, Filter, X, Copy, Check, ChevronDown, ChevronUp, Tag, StickyNote, Minimize2, Type, Layers } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ToastContainer, toast, SessionTimeline, SessionInsights, ActivityHeatmap } from './components';
import { useDebounce } from './hooks';

// Code block component with copy button
const CodeBlock = ({ code, language }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all z-10"
        title="Copy code"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
      </button>
      <SyntaxHighlighter
        language={language || 'typescript'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0.75rem',
          padding: '1.25rem',
          fontSize: '0.75rem',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

// Parse content for code blocks
const parseContent = (content: string) => {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2].trim(), language: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text' as const, content }];
};

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

interface Stats {
  totalProjects: number;
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  mostActiveProject: string;
  sessionsToday: number;
  sessionsThisWeek: number;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Session[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'projects' | 'search' | 'stats' | 'bookmarks'>('projects');
  const [highlightedMessageIdx, setHighlightedMessageIdx] = useState<number | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkedSessions, setBookmarkedSessions] = useState<Session[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [minMessages, setMinMessages] = useState(() => {
    const saved = localStorage.getItem('deja-claude-min-messages');
    return saved ? parseInt(saved) : 3;
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('deja-claude-recent-searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [sessionTags, setSessionTags] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('deja-claude-tags');
    return saved ? JSON.parse(saved) : {};
  });
  const [sessionNotes, setSessionNotes] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('deja-claude-notes');
    return saved ? JSON.parse(saved) : {};
  });
  const [toolFilter, setToolFilter] = useState<string>('');
  const [compactView, setCompactView] = useState(() => {
    return localStorage.getItem('deja-claude-compact') === 'true';
  });
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('deja-claude-fontsize');
    return saved ? parseInt(saved) : 14;
  });
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [collapsedTools, setCollapsedTools] = useState<Set<number>>(new Set());
  const [messageFilters, setMessageFilters] = useState<Set<string>>(new Set(['user', 'assistant', 'tool']));
  const [showInsights, setShowInsights] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load bookmarks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('deja-claude-bookmarks');
    if (saved) {
      setBookmarks(new Set(JSON.parse(saved)));
    }
  }, []);

  // Save bookmarks to localStorage
  const saveBookmarks = (newBookmarks: Set<string>) => {
    localStorage.setItem('deja-claude-bookmarks', JSON.stringify([...newBookmarks]));
    setBookmarks(newBookmarks);
  };

  const toggleBookmark = (sessionId: string, projectPath: string) => {
    const key = `${projectPath}:${sessionId}`;
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(key)) {
      newBookmarks.delete(key);
      toast.bookmark('Bookmark removed');
    } else {
      newBookmarks.add(key);
      toast.bookmark('Session bookmarked');
    }
    saveBookmarks(newBookmarks);
  };

  // Toggle message filter
  const toggleMessageFilter = (filter: string) => {
    const newFilters = new Set(messageFilters);
    if (newFilters.has(filter)) {
      if (newFilters.size > 1) {
        newFilters.delete(filter);
      }
    } else {
      newFilters.add(filter);
    }
    setMessageFilters(newFilters);
  };

  // Filtered messages based on message type filter
  const filteredMessages = useMemo(() => {
    if (!selectedSession) return [];
    return selectedSession.messages.filter(m => messageFilters.has(m.role));
  }, [selectedSession, messageFilters]);

  // Message counts for filter
  const messageCounts = useMemo(() => {
    if (!selectedSession) return { user: 0, assistant: 0, tool: 0 };
    return {
      user: selectedSession.messages.filter(m => m.role === 'user').length,
      assistant: selectedSession.messages.filter(m => m.role === 'assistant').length,
      tool: selectedSession.messages.filter(m => m.role === 'tool').length,
    };
  }, [selectedSession]);

  // Auto-search with debounce
  useEffect(() => {
    if (debouncedSearchQuery.trim() && view === 'search') {
      handleSearch();
    }
  }, [debouncedSearchQuery]);

  const isBookmarked = (sessionId: string, projectPath: string) => {
    return bookmarks.has(`${projectPath}:${sessionId}`);
  };

  // Date and message count filter
  useEffect(() => {
    let filtered = sessions.filter(s => s.messages.length >= minMessages);

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : new Date(0);
      const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.createdAt);
        return sessionDate >= fromDate && sessionDate <= toDate;
      });
    }

    setFilteredSessions(filtered);
  }, [sessions, dateFrom, dateTo, minMessages]);

  // Save minMessages to localStorage
  const updateMinMessages = (value: number) => {
    setMinMessages(value);
    localStorage.setItem('deja-claude-min-messages', value.toString());
  };

  // Clear all bookmarks
  const clearAllBookmarks = () => {
    localStorage.removeItem('deja-claude-bookmarks');
    setBookmarks(new Set());
    setBookmarkedSessions([]);
  };

  // Add recent search
  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('deja-claude-recent-searches', JSON.stringify(updated));
  };

  // Session tags management
  const getSessionKey = (session: Session) => `${session.project}:${session.id}`;

  const addTag = (session: Session, tag: string) => {
    const key = getSessionKey(session);
    const current = sessionTags[key] || [];
    if (!current.includes(tag)) {
      const updated = { ...sessionTags, [key]: [...current, tag] };
      setSessionTags(updated);
      localStorage.setItem('deja-claude-tags', JSON.stringify(updated));
    }
  };

  const removeTag = (session: Session, tag: string) => {
    const key = getSessionKey(session);
    const current = sessionTags[key] || [];
    const updated = { ...sessionTags, [key]: current.filter(t => t !== tag) };
    setSessionTags(updated);
    localStorage.setItem('deja-claude-tags', JSON.stringify(updated));
  };

  const getTags = (session: Session) => sessionTags[getSessionKey(session)] || [];

  // Session notes management
  const setNote = (session: Session, note: string) => {
    const key = getSessionKey(session);
    const updated = { ...sessionNotes, [key]: note };
    setSessionNotes(updated);
    localStorage.setItem('deja-claude-notes', JSON.stringify(updated));
  };

  const getNote = (session: Session) => sessionNotes[getSessionKey(session)] || '';

  // Settings helpers
  const updateCompactView = (value: boolean) => {
    setCompactView(value);
    localStorage.setItem('deja-claude-compact', value.toString());
  };

  const updateFontSize = (value: number) => {
    setFontSize(value);
    localStorage.setItem('deja-claude-fontsize', value.toString());
  };

  // Toggle tool collapse
  const toggleToolCollapse = (idx: number) => {
    const updated = new Set(collapsedTools);
    if (updated.has(idx)) {
      updated.delete(idx);
    } else {
      updated.add(idx);
    }
    setCollapsedTools(updated);
  };

  // Get unique tools used in current sessions
  const getUsedTools = () => {
    const tools = new Set<string>();
    sessions.forEach(s => {
      s.messages.forEach(m => {
        if (m.role === 'tool' && m.toolName) {
          tools.add(m.toolName);
        }
      });
    });
    return Array.from(tools).sort();
  };

  // Calculate stats
  useEffect(() => {
    if (projects.length === 0) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalMessages = 0;
    let sessionsToday = 0;
    let sessionsThisWeek = 0;
    let mostActiveProject = projects[0]?.name || '';
    let maxSessions = 0;

    projects.forEach(p => {
      if (p.sessionCount > maxSessions) {
        maxSessions = p.sessionCount;
        mostActiveProject = p.name.split('/').pop() || p.name;
      }
      const lastActivity = new Date(p.lastActivity);
      if (lastActivity >= today) sessionsToday += p.sessionCount;
      if (lastActivity >= weekAgo) sessionsThisWeek += p.sessionCount;
    });

    const totalSessions = projects.reduce((sum, p) => sum + p.sessionCount, 0);

    setStats({
      totalProjects: projects.length,
      totalSessions,
      totalMessages: totalMessages || totalSessions * 10, // Estimate if not known
      avgMessagesPerSession: Math.round((totalMessages || totalSessions * 10) / totalSessions),
      mostActiveProject,
      sessionsToday,
      sessionsThisWeek,
    });
  }, [projects]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const items = view === 'projects' && !selectedProject
        ? projects
        : view === 'projects' && selectedProject
          ? filteredSessions
          : view === 'search'
            ? searchResults
            : view === 'bookmarks'
              ? bookmarkedSessions
              : [];

      switch (e.key) {
        case 'j': // Down
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, items.length - 1));
          break;
        case 'k': // Up
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (view === 'projects' && !selectedProject && projects[focusedIndex]) {
            handleProjectSelect(projects[focusedIndex]);
          } else if (filteredSessions[focusedIndex]) {
            handleSessionSelect(filteredSessions[focusedIndex]);
          } else if (view === 'search' && searchResults[focusedIndex]) {
            handleSessionSelect(searchResults[focusedIndex]);
          } else if (view === 'bookmarks' && bookmarkedSessions[focusedIndex]) {
            handleSessionSelect(bookmarkedSessions[focusedIndex]);
          }
          break;
        case 'Escape':
          if (selectedSession) {
            setSelectedSession(null);
          } else if (selectedProject) {
            setSelectedProject(null);
            setSessions([]);
          }
          break;
        case 'b': // Toggle bookmark
          if (selectedSession && selectedProject) {
            toggleBookmark(selectedSession.id, selectedProject.path);
          }
          break;
        case 'e': // Export
          if (selectedSession) {
            exportToMarkdown();
          }
          break;
        case '/': // Focus search
          e.preventDefault();
          document.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
          break;
        case '?': // Show shortcuts
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        case '1':
          setView('projects');
          break;
        case '2':
          setView('search');
          break;
        case '3':
          setView('stats');
          break;
        case '4':
          setView('bookmarks');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, projects, filteredSessions, searchResults, bookmarkedSessions, focusedIndex, selectedProject, selectedSession]);

  // Reset focus when list changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [view, selectedProject, searchResults]);

  // Scroll focused item into view
  useEffect(() => {
    if (listContainerRef.current) {
      const focused = listContainerRef.current.querySelector(`[data-index="${focusedIndex}"]`);
      focused?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

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

  // Load bookmarked sessions
  useEffect(() => {
    if (view === 'bookmarks' && bookmarks.size > 0) {
      loadBookmarkedSessions();
    }
  }, [view, bookmarks]);

  const loadBookmarkedSessions = async () => {
    const sessions: Session[] = [];
    for (const key of bookmarks) {
      const [projectPath, sessionId] = key.split(':');
      try {
        const res = await fetch(`${API_URL}/history/projects/${encodeURIComponent(projectPath)}/sessions/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          sessions.push(data);
        }
      } catch (e) {
        console.error('Failed to load bookmarked session:', e);
      }
    }
    setBookmarkedSessions(sessions);
  };

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
      setFilteredSessions(data);
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
    addRecentSearch(searchQuery);
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
    setDateFrom('');
    setDateTo('');
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

  // Full export
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
            if (msg.toolInput) {
              parts.push(`### Input\n\n\`\`\`json\n${msg.toolInput}\n\`\`\`\n\n`);
            }
            if (msg.content) {
              parts.push(`### Output\n\n\`\`\`\n${msg.content}\n\`\`\`\n\n`);
            }
            parts.push(`---\n\n`);
          } else {
            parts.push(`## 🤖 Claude (Message ${idx + 1})\n${timestamp}\n${msg.content}\n\n---\n\n`);
          }
        });

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
        toast.success('Session exported to Markdown');
      } catch (error) {
        console.error('Export failed:', error);
        setExporting(false);
        toast.error('Export failed');
      }
    });
  }, [selectedSession, exporting]);

  // Jump to message in session
  const jumpToMessage = (index: number) => {
    if (messagesContainerRef.current) {
      const messageEl = messagesContainerRef.current.querySelector(`[data-message-idx="${index}"]`);
      if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageIdx(index);
      }
    }
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

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="h-screen flex bg-[#020208] overflow-hidden">
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="bg-[#0a0a18] border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-cyan-500/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white font-cyber">KEYBOARD SHORTCUTS</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['j / ↓', 'Move down'],
                ['k / ↑', 'Move up'],
                ['Enter', 'Select item'],
                ['Esc', 'Go back'],
                ['/', 'Focus search'],
                ['b', 'Toggle bookmark'],
                ['e', 'Export session'],
                ['1-4', 'Switch tabs'],
                ['?', 'Toggle shortcuts'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-white/5">
                  <span className="text-white/70">{desc}</span>
                  <kbd className="px-2 py-1 bg-white/10 rounded text-cyan-400 font-mono text-xs">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-[#0a0a18] border border-orange-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-orange-500/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white font-cyber">SETTINGS</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Min Messages Filter */}
              <div>
                <label className="block text-sm text-white/70 mb-2">Minimum messages to show</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={minMessages}
                    onChange={(e) => updateMinMessages(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                  />
                  <span className="w-8 text-center text-orange-400 font-mono font-bold">{minMessages}</span>
                </div>
              </div>

              {/* Font Size */}
              <div className="border-t border-white/10 pt-4">
                <label className="block text-sm text-white/70 mb-2">
                  <Type size={14} className="inline mr-2" />
                  Font Size
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={fontSize}
                    onChange={(e) => updateFontSize(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
                  />
                  <span className="w-12 text-center text-cyan-400 font-mono font-bold">{fontSize}px</span>
                </div>
              </div>

              {/* Compact View */}
              <div className="border-t border-white/10 pt-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-white/70 flex items-center gap-2">
                    <Minimize2 size={14} />
                    Compact View
                  </span>
                  <button
                    onClick={() => updateCompactView(!compactView)}
                    className={`w-12 h-6 rounded-full transition-colors ${compactView ? 'bg-cyan-500' : 'bg-white/20'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${compactView ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <p className="text-xs text-white/40 mt-1">Denser session list layout</p>
              </div>

              {/* Bookmarks Section */}
              <div className="border-t border-white/10 pt-4">
                <label className="block text-sm text-white/70 mb-2">Bookmarks</label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{bookmarks.size} saved</span>
                  {bookmarks.size > 0 && (
                    <button
                      onClick={() => {
                        if (confirm('Clear all bookmarks?')) {
                          clearAllBookmarks();
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Searches */}
              <div className="border-t border-white/10 pt-4">
                <label className="block text-sm text-white/70 mb-2">Recent Searches</label>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">{recentSearches.length} saved</span>
                  {recentSearches.length > 0 && (
                    <button
                      onClick={() => {
                        localStorage.removeItem('deja-claude-recent-searches');
                        setRecentSearches([]);
                      }}
                      className="px-3 py-1.5 text-xs text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Version Info */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>Version</span>
                  <span className="font-mono">v1.2.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar */}
      <div className="w-80 relative z-10 flex flex-col border-r border-cyan-500/10 bg-gradient-to-b from-[#0a0a18]/95 to-[#050510]/95 backdrop-blur-xl">
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

        {/* Header with Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
              <img src="/logo.png" alt="Déjà Claude" className="relative w-12 h-12 rounded-xl object-cover" />
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#0a0a18] pulse-dot" />
            </div>
            <div>
              <h1 className="font-bold text-xl font-cyber gradient-text tracking-wide">DÉJÀ CLAUDE</h1>
              <p className="text-xs text-cyan-400/60 font-mono">MEMORY_BANK.ACTIVE</p>
            </div>
          </div>

          {/* Search with Recent Searches */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => document.getElementById('recent-searches')?.classList.remove('hidden')}
              onBlur={() => setTimeout(() => document.getElementById('recent-searches')?.classList.add('hidden'), 200)}
              placeholder="Search... (press /)"
              className="relative w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm font-mono focus:border-cyan-500/50 focus:bg-white/10 transition-all duration-300"
            />
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-cyan-400 transition-colors" />
            {searchQuery && (
              <button onClick={handleSearch} className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-orange-500/30 transition-all uppercase tracking-wider">
                Scan
              </button>
            )}
            {/* Recent Searches Dropdown */}
            {recentSearches.length > 0 && (
              <div id="recent-searches" className="hidden absolute top-full left-0 right-0 mt-2 bg-[#0a0a18] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                <div className="px-3 py-2 text-[10px] text-white/40 uppercase tracking-wider border-b border-white/5">Recent</div>
                {recentSearches.slice(0, 5).map((search, idx) => (
                  <button
                    key={idx}
                    onMouseDown={() => { setSearchQuery(search); handleSearch(); }}
                    className="w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Clock size={12} className="text-white/30" />
                    {search}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tool Filter */}
          {selectedProject && getUsedTools().length > 0 && (
            <div className="mt-3">
              <select
                value={toolFilter}
                onChange={(e) => setToolFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 font-mono focus:border-cyan-500/50"
              >
                <option value="">All tools</option>
                {getUsedTools().map(tool => (
                  <option key={tool} value={tool}>{tool}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Toggle - 4 tabs now */}
        <div className="grid grid-cols-4 gap-1 p-1.5 m-4 bg-white/5 rounded-xl border border-white/5">
          {[
            { id: 'projects', icon: Database, label: '1' },
            { id: 'search', icon: Search, label: '2' },
            { id: 'stats', icon: BarChart3, label: '3' },
            { id: 'bookmarks', icon: Bookmark, label: '4' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id as typeof view)}
              className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-300 flex items-center justify-center gap-1
                ${view === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-lg shadow-cyan-500/10 border border-cyan-500/20'
                  : 'text-white/40 hover:text-white/70'}`}
            >
              <tab.icon size={14} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" ref={listContainerRef}>
          {view === 'projects' ? (
            <>
              {!selectedProject ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 py-3">
                    <span className="text-xs font-mono text-cyan-400/60 uppercase tracking-widest flex items-center gap-2">
                      <Terminal size={12} />
                      {projects.length} DATABASES
                    </span>
                    <button onClick={fetchProjects} className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-cyan-400 transition-all">
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
                        data-index={idx}
                        onClick={() => handleProjectSelect(project)}
                        className={`w-full group relative overflow-hidden ${focusedIndex === idx ? 'ring-1 ring-cyan-500/50' : ''}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <div className="relative flex items-center gap-3 px-4 py-4 rounded-xl border border-transparent hover:border-orange-500/20 hover:bg-white/5 transition-all duration-300">
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
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/50 hover:text-cyan-400 transition-colors rounded-xl hover:bg-white/5 font-mono"
                  >
                    <ChevronRight size={16} className="rotate-180" />
                    ../BACK
                  </button>

                  <div className="px-4 py-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-sm font-medium text-white truncate">{selectedProject.name.split('/').pop()}</p>
                    <p className="text-xs text-cyan-400/60 font-mono mt-1">{filteredSessions.length} / {sessions.length} RECORDS</p>
                  </div>

                  {/* Date Filter */}
                  <div className="px-2">
                    <button
                      onClick={() => setShowDateFilter(!showDateFilter)}
                      className="flex items-center gap-2 text-xs text-white/50 hover:text-cyan-400 transition-colors py-2"
                    >
                      <Filter size={12} />
                      {showDateFilter ? 'Hide' : 'Show'} Date Filter
                      {(dateFrom || dateTo) && <span className="text-cyan-400 ml-1">(active)</span>}
                    </button>

                    {showDateFilter && (
                      <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg border border-white/10 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="flex-1 px-2 py-1.5 bg-black/30 border border-white/10 rounded text-xs text-white font-mono"
                          />
                          <span className="text-white/30">to</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="flex-1 px-2 py-1.5 bg-black/30 border border-white/10 rounded text-xs text-white font-mono"
                          />
                        </div>
                        {(dateFrom || dateTo) && (
                          <button onClick={clearDateFilter} className="text-xs text-orange-400 hover:text-orange-300">
                            Clear filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {loading ? (
                    <div className="py-16 text-center">
                      <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                    </div>
                  ) : (
                    filteredSessions.map((session, idx) => (
                      <button
                        key={session.id}
                        data-index={idx}
                        onClick={() => handleSessionSelect(session)}
                        className={`w-full group relative overflow-hidden ${focusedIndex === idx ? 'ring-1 ring-cyan-500/50' : ''}`}
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
                          {isBookmarked(session.id, selectedProject.path) && (
                            <BookmarkCheck size={14} className="text-orange-400 shrink-0" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          ) : view === 'search' ? (
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
                      data-index={idx}
                      className={`rounded-xl overflow-hidden border transition-all duration-300 ${focusedIndex === idx ? 'ring-1 ring-cyan-500/50' : ''}
                        ${selectedSession?.id === session.id
                          ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                          : 'border-white/5 hover:border-cyan-500/20'}`}
                    >
                      <button
                        onClick={() => handleSessionSelect(session)}
                        className="w-full flex items-start gap-3 px-4 py-4 bg-white/5 hover:bg-white/10 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/20">
                          <MessageSquare size={15} className="text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium line-clamp-1">{session.summary || 'Session'}</p>
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
                                ${match.role === 'user' ? 'bg-blue-500/20 text-blue-400' : match.role === 'tool' ? 'bg-purple-500/20 text-purple-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                {match.role === 'user' ? 'YOU' : match.role === 'tool' ? 'TOOL' : 'AI'}
                              </span>
                              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors font-mono">
                                {match.preview}
                              </span>
                            </button>
                          ))}
                          {session.matches.length > 3 && (
                            <p className="text-xs text-cyan-400/50 px-4 py-2 text-center font-mono">+{session.matches.length - 3} more</p>
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
          ) : view === 'stats' ? (
            /* Statistics View */
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 px-2 mb-4">
                <BarChart3 size={14} className="text-cyan-400" />
                <span className="text-xs text-cyan-400/80 font-mono uppercase tracking-wider">USAGE STATISTICS</span>
              </div>

              {/* Activity Heatmap */}
              <ActivityHeatmap sessions={sessions.length > 0 ? sessions : searchResults} weeks={8} />

              {stats && (
                <div className="space-y-3">
                  {[
                    { label: 'Total Projects', value: stats.totalProjects, icon: FolderOpen, color: 'orange' },
                    { label: 'Total Sessions', value: stats.totalSessions, icon: MessageSquare, color: 'cyan' },
                    { label: 'Sessions Today', value: stats.sessionsToday, icon: Calendar, color: 'green' },
                    { label: 'Sessions This Week', value: stats.sessionsThisWeek, icon: Clock, color: 'purple' },
                    { label: 'Most Active', value: stats.mostActiveProject, icon: Zap, color: 'yellow' },
                    { label: 'Bookmarked', value: bookmarks.size, icon: Bookmark, color: 'pink' },
                  ].map((stat, idx) => (
                    <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${stat.color}-500/20`}>
                            <stat.icon size={14} className={`text-${stat.color}-400`} />
                          </div>
                          <span className="text-sm text-white/70">{stat.label}</span>
                        </div>
                        <span className="text-lg font-bold text-white font-mono">{stat.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Bookmarks View */
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2 py-3">
                <Bookmark size={14} className="text-orange-400" />
                <span className="text-xs text-orange-400/80 font-mono uppercase tracking-wider">
                  {bookmarks.size} BOOKMARKED
                </span>
              </div>

              {bookmarks.size === 0 ? (
                <div className="py-16 text-center">
                  <Bookmark size={40} className="text-white/10 mx-auto mb-4" />
                  <p className="text-sm text-white/30 font-mono">NO BOOKMARKS YET</p>
                  <p className="text-xs text-white/20 mt-2">Press 'b' to bookmark a session</p>
                </div>
              ) : (
                bookmarkedSessions.map((session, idx) => (
                  <button
                    key={session.id}
                    data-index={idx}
                    onClick={() => handleSessionSelect(session)}
                    className={`w-full rounded-xl overflow-hidden border transition-all duration-300 ${focusedIndex === idx ? 'ring-1 ring-orange-500/50' : ''}
                      ${selectedSession?.id === session.id
                        ? 'border-orange-500/50 shadow-lg shadow-orange-500/20'
                        : 'border-white/5 hover:border-orange-500/20'}`}
                  >
                    <div className="flex items-start gap-3 px-4 py-4 bg-white/5 hover:bg-white/10 transition-all text-left">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center border border-orange-500/20">
                        <BookmarkCheck size={15} className="text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium line-clamp-1">{session.summary || 'Session'}</p>
                        <p className="text-xs text-white/40 mt-1 font-mono">{formatDate(session.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30 font-mono flex items-center gap-2">
              <Cpu size={12} className="text-cyan-400/50" />
              v1.1.0
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShortcuts(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-all"
                title="Keyboard shortcuts (?)"
              >
                <span className="text-xs font-mono">?</span>
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/70 transition-all"
                title="Settings"
              >
                <Settings size={16} />
              </button>
            </div>
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
                  <p className="text-base font-medium text-white">{truncate(selectedSession.summary || 'Session', 60)}</p>
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

              <div className="flex items-center gap-3">
                {/* Bookmark button */}
                {selectedProject && (
                  <button
                    onClick={() => toggleBookmark(selectedSession.id, selectedProject.path)}
                    className={`p-3 rounded-xl transition-all ${
                      isBookmarked(selectedSession.id, selectedProject.path)
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-white/5 text-white/50 hover:text-orange-400 hover:bg-white/10'
                    }`}
                    title="Toggle bookmark (b)"
                  >
                    {isBookmarked(selectedSession.id, selectedProject.path) ? (
                      <BookmarkCheck size={18} />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </button>
                )}

                {/* Export button */}
                <div className="flex items-center gap-4">
                  {exporting && (
                    <p className="text-xs text-white/50 font-mono animate-pulse max-w-[200px] text-right">
                      Converting... save dialog may take up to 60s
                    </p>
                  )}
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
              </div>
            </div>

            {/* Session Timeline & Insights */}
            {selectedSession && (
              <div className="px-8 py-4 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
                <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Timeline */}
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <SessionTimeline
                      messages={selectedSession.messages}
                      onJumpTo={jumpToMessage}
                      highlightedIndex={highlightedMessageIdx}
                    />
                  </div>

                  {/* Insights toggle */}
                  <div>
                    <button
                      onClick={() => setShowInsights(!showInsights)}
                      className="flex items-center gap-2 text-xs text-white/50 hover:text-cyan-400 mb-2"
                    >
                      <Layers size={12} />
                      {showInsights ? 'Hide' : 'Show'} Insights
                    </button>
                    {showInsights && (
                      <SessionInsights
                        messages={selectedSession.messages}
                        createdAt={selectedSession.createdAt}
                      />
                    )}
                  </div>
                </div>

                {/* Message Type Filters */}
                <div className="max-w-4xl mx-auto mt-4 flex items-center gap-2">
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Show:</span>
                  {[
                    { id: 'user', label: 'You', color: 'blue', count: messageCounts.user },
                    { id: 'assistant', label: 'Claude', color: 'orange', count: messageCounts.assistant },
                    { id: 'tool', label: 'Tools', color: 'purple', count: messageCounts.tool },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => toggleMessageFilter(f.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                        messageFilters.has(f.id)
                          ? `bg-${f.color}-500/20 text-${f.color}-400 border border-${f.color}-500/30`
                          : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className="font-mono text-[10px] opacity-70">{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Session Tags & Notes */}
            {selectedProject && selectedSession && (
              <div className="px-8 py-3 border-b border-white/5 bg-white/5 flex items-center gap-4 flex-wrap">
                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag size={14} className="text-white/40" />
                  {getTags(selectedSession).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg border border-purple-500/30 flex items-center gap-1 group"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(selectedSession, tag)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  {showTagInput ? (
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTag.trim()) {
                          addTag(selectedSession, newTag.trim());
                          setNewTag('');
                          setShowTagInput(false);
                        } else if (e.key === 'Escape') {
                          setShowTagInput(false);
                          setNewTag('');
                        }
                      }}
                      onBlur={() => { setShowTagInput(false); setNewTag(''); }}
                      autoFocus
                      placeholder="Add tag..."
                      className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-xs text-white w-24 focus:border-purple-500/50"
                    />
                  ) : (
                    <button
                      onClick={() => setShowTagInput(true)}
                      className="px-2 py-1 text-white/30 hover:text-purple-400 text-xs border border-dashed border-white/20 rounded-lg hover:border-purple-500/50 transition-colors"
                    >
                      + Tag
                    </button>
                  )}
                </div>

                {/* Notes */}
                <div className="flex items-center gap-2 ml-auto">
                  <StickyNote size={14} className="text-white/40" />
                  {showNoteInput ? (
                    <input
                      type="text"
                      defaultValue={getNote(selectedSession)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setNote(selectedSession, (e.target as HTMLInputElement).value);
                          setShowNoteInput(false);
                        } else if (e.key === 'Escape') {
                          setShowNoteInput(false);
                        }
                      }}
                      onBlur={(e) => {
                        setNote(selectedSession, e.target.value);
                        setShowNoteInput(false);
                      }}
                      autoFocus
                      placeholder="Add note..."
                      className="px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-xs text-white w-48 focus:border-amber-500/50"
                    />
                  ) : (
                    <button
                      onClick={() => setShowNoteInput(true)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        getNote(selectedSession)
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'text-white/30 hover:text-amber-400 border border-dashed border-white/20 hover:border-amber-500/50'
                      }`}
                    >
                      {getNote(selectedSession) || '+ Note'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-black/20" ref={messagesContainerRef} style={{ fontSize: `${fontSize}px` }}>
              {filteredMessages.map((msg) => {
                // Get the original index for highlighting
                const originalIdx = selectedSession.messages.indexOf(msg);
                const isHighlighted = highlightedMessageIdx === originalIdx;
                const hasSearchMatch = activeSearchQuery && msg.content.toLowerCase().includes(activeSearchQuery.toLowerCase());
                const isToolCollapsed = collapsedTools.has(originalIdx);

                return (
                  <div
                    key={originalIdx}
                    data-message-idx={originalIdx}
                    className={`relative px-8 ${compactView ? 'py-3' : 'py-6'} border-b border-white/5 transition-all duration-500
                      ${msg.role === 'user' ? 'bg-transparent' : msg.role === 'tool' ? 'bg-purple-500/5' : 'bg-cyan-500/5'}
                      ${isHighlighted ? 'highlight-message' : ''}
                      ${hasSearchMatch && !isHighlighted ? 'border-l-2 border-l-cyan-500' : ''}`}
                  >
                    <div className="max-w-4xl mx-auto">
                      <div className={`flex items-center gap-4 ${compactView ? 'mb-2' : 'mb-4'}`}>
                        <div className={`${compactView ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center text-xs font-bold uppercase border
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
                            <span className="text-xs text-white/30 ml-3 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                          )}
                        </div>
                        {msg.role === 'tool' && msg.toolInput && (
                          <button
                            onClick={() => toggleToolCollapse(originalIdx)}
                            className="p-1 text-white/30 hover:text-white/70 transition-colors"
                          >
                            {isToolCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                          </button>
                        )}
                        {hasSearchMatch && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/30">Match</span>
                        )}
                      </div>
                      <div className={compactView ? 'pl-10' : 'pl-14'}>
                        {msg.role === 'tool' && msg.toolInput ? (
                          <div>
                            <div className="text-white/80 text-sm font-medium">{msg.content}</div>
                            {!isToolCollapsed && (
                              <CodeBlock code={msg.toolInput} language="json" />
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-white/80 leading-relaxed">
                            {parseContent(msg.content).map((part, i) => (
                              part.type === 'code' ? (
                                <CodeBlock key={i} code={part.content} language={part.language} />
                              ) : (
                                <span key={i}>{activeSearchQuery ? highlightSearchTerm(part.content, activeSearchQuery) : part.content}</span>
                              )
                            ))}
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
              {/* Logo */}
              <div className="relative w-32 h-32 mx-auto mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-cyan-500/20 rounded-3xl blur-2xl animate-pulse" />
                <img src="/logo.png" alt="Déjà Claude" className="relative w-full h-full rounded-2xl object-cover border border-white/10" />
              </div>

              <h2 className="text-4xl font-bold font-cyber gradient-text mb-4 tracking-wider">DÉJÀ CLAUDE</h2>
              <p className="text-white/50 text-lg mb-2 italic">"I know I asked Claude about this before..."</p>
              <p className="text-white/30 text-sm font-mono">SEARCH // BROWSE // EXPORT</p>

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

              {/* Keyboard hint */}
              <div className="mt-8 text-xs text-white/20 font-mono">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded">?</kbd> for keyboard shortcuts
              </div>

              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="w-20 h-px bg-gradient-to-r from-transparent to-orange-500/50" />
                <Hash size={14} className="text-white/20" />
                <div className="w-20 h-px bg-gradient-to-l from-transparent to-cyan-500/50" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default App;
