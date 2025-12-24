import { useMemo } from 'react';
import { Clock, MessageSquare, Terminal, User, Zap, FileCode, GitBranch, Search, Edit3, FolderOpen } from 'lucide-react';

interface HistoryMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: string;
}

interface SessionInsightsProps {
  messages: HistoryMessage[];
  createdAt: string;
}

export function SessionInsights({ messages, createdAt }: SessionInsightsProps) {
  const insights = useMemo(() => {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const toolMessages = messages.filter(m => m.role === 'tool');

    // Count tools by name
    const toolCounts: Record<string, number> = {};
    toolMessages.forEach(m => {
      const name = m.toolName || 'Unknown';
      toolCounts[name] = (toolCounts[name] || 0) + 1;
    });

    // Calculate duration if timestamps available
    let duration = '';
    if (messages.length > 0) {
      const firstTs = messages[0].timestamp;
      const lastTs = messages[messages.length - 1].timestamp;
      if (firstTs && lastTs) {
        const diff = new Date(lastTs).getTime() - new Date(firstTs).getTime();
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      }
    }

    // Calculate complexity score (1-5)
    const complexity = Math.min(5, Math.max(1, Math.ceil(
      (toolMessages.length / 10) +
      (Object.keys(toolCounts).length / 3) +
      (messages.length / 20)
    )));

    // Total content size
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    const contentSize = totalChars > 100000 ? `${(totalChars / 1000).toFixed(0)}K` : `${totalChars}`;

    return {
      userCount: userMessages.length,
      assistantCount: assistantMessages.length,
      toolCount: toolMessages.length,
      toolCounts,
      duration,
      complexity,
      contentSize
    };
  }, [messages]);

  const getToolIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('read') || lower.includes('glob')) return <FolderOpen size={10} />;
    if (lower.includes('edit') || lower.includes('write')) return <Edit3 size={10} />;
    if (lower.includes('bash') || lower.includes('terminal')) return <Terminal size={10} />;
    if (lower.includes('search') || lower.includes('grep')) return <Search size={10} />;
    if (lower.includes('git')) return <GitBranch size={10} />;
    return <FileCode size={10} />;
  };

  const topTools = Object.entries(insights.toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-cyan-400" />
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Session Insights</span>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <User size={12} className="text-blue-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{insights.userCount}</div>
          <div className="text-[10px] text-white/40">You</div>
        </div>
        <div className="text-center p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
          <MessageSquare size={12} className="text-orange-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{insights.assistantCount}</div>
          <div className="text-[10px] text-white/40">Claude</div>
        </div>
        <div className="text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <Terminal size={12} className="text-purple-400 mx-auto mb-1" />
          <div className="text-lg font-bold text-white">{insights.toolCount}</div>
          <div className="text-[10px] text-white/40">Tools</div>
        </div>
        <div className="text-center p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
          <Clock size={12} className="text-cyan-400 mx-auto mb-1" />
          <div className="text-sm font-bold text-white">{insights.duration || '—'}</div>
          <div className="text-[10px] text-white/40">Duration</div>
        </div>
      </div>

      {/* Complexity Indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-white/40 uppercase">Complexity</span>
          <span className="text-[10px] text-cyan-400 font-mono">{insights.contentSize} chars</span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(level => (
            <div
              key={level}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                level <= insights.complexity
                  ? level <= 2 ? 'bg-emerald-500' : level <= 4 ? 'bg-amber-500' : 'bg-red-500'
                  : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Top Tools */}
      {topTools.length > 0 && (
        <div>
          <span className="text-[10px] text-white/40 uppercase mb-2 block">Top Tools</span>
          <div className="flex flex-wrap gap-1">
            {topTools.map(([name, count]) => (
              <div
                key={name}
                className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded-lg border border-purple-500/20 text-[10px]"
              >
                {getToolIcon(name)}
                <span className="text-white/70">{name}</span>
                <span className="text-purple-400 font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
