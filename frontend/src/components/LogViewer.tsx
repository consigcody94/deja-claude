import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  FileText,
  Code,
  Search,
  Filter,
  Trash2,
  Download,
  Pause,
  Play
} from 'lucide-react';
import { useSessionsStore, LogEntry } from '../stores/sessions';

interface LogEntryDisplay {
  timestamp: Date;
  type: 'tool_call' | 'tool_result' | 'message' | 'system';
  name?: string;
  content: string;
  expanded?: boolean;
}

function parseLogEntry(log: LogEntry): LogEntryDisplay {
  const content = log.content;

  // Try to detect tool calls from Claude's output
  if (content.includes('[Tool:') || content.includes('Tool call:')) {
    const toolMatch = content.match(/\[Tool:\s*(\w+)\]/);
    return {
      timestamp: log.timestamp,
      type: 'tool_call',
      name: toolMatch?.[1] || 'Unknown',
      content: content
    };
  }

  if (log.type === 'system') {
    return {
      timestamp: log.timestamp,
      type: 'system',
      content: content
    };
  }

  return {
    timestamp: log.timestamp,
    type: 'message',
    content: content
  };
}

function LogEntryRow({ entry, expanded, onToggle }: {
  entry: LogEntryDisplay;
  expanded: boolean;
  onToggle: () => void;
}) {
  const timeStr = entry.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const typeColors = {
    tool_call: 'text-blue-400 bg-blue-400/10',
    tool_result: 'text-green-400 bg-green-400/10',
    message: 'text-claude-text bg-transparent',
    system: 'text-yellow-400 bg-yellow-400/10'
  };

  const typeIcons = {
    tool_call: <Code size={14} />,
    tool_result: <FileText size={14} />,
    message: <Terminal size={14} />,
    system: <Terminal size={14} />
  };

  return (
    <div
      className={`
        border-b border-claude-border/50 hover:bg-claude-border/20 cursor-pointer
        ${expanded ? 'bg-claude-border/10' : ''}
      `}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3 px-4 py-2">
        <span className="text-xs text-claude-muted font-mono shrink-0 mt-0.5">
          {timeStr}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${typeColors[entry.type]}`}>
          <span className="flex items-center gap-1">
            {typeIcons[entry.type]}
            {entry.name || entry.type}
          </span>
        </span>
        <div className="flex-1 min-w-0">
          <pre className={`
            text-sm font-mono whitespace-pre-wrap break-all
            ${expanded ? '' : 'line-clamp-2'}
          `}>
            {entry.content}
          </pre>
        </div>
      </div>
    </div>
  );
}

export function LogViewer() {
  const { activeSessionId, sessionLogs } = useSessionsStore();
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const logs = activeSessionId ? sessionLogs.get(activeSessionId) || [] : [];
  const parsedLogs = logs.map(parseLogEntry);

  // Filter logs
  const filteredLogs = parsedLogs.filter((log) => {
    if (filter && !log.content.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    if (typeFilter.length > 0 && !typeFilter.includes(log.type)) {
      return false;
    }
    return true;
  });

  // Auto-scroll to bottom unless paused
  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, paused]);

  const toggleExpand = (index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const clearLogs = () => {
    if (activeSessionId) {
      useSessionsStore.getState().clearLogs(activeSessionId);
    }
  };

  const downloadLogs = () => {
    const content = filteredLogs
      .map((log) => `[${log.timestamp.toISOString()}] [${log.type}] ${log.content}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claude-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeOptions = ['tool_call', 'tool_result', 'message', 'system'];

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-claude-border">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-claude-muted" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-claude-darker border border-claude-border
              rounded text-claude-text placeholder:text-claude-muted focus:outline-none focus:border-claude-orange"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-claude-muted" />
          {typeOptions.map((type) => (
            <button
              key={type}
              onClick={() => {
                setTypeFilter((prev) =>
                  prev.includes(type)
                    ? prev.filter((t) => t !== type)
                    : [...prev, type]
                );
              }}
              className={`
                px-2 py-1 text-xs rounded transition-colors
                ${typeFilter.includes(type)
                  ? 'bg-claude-orange text-white'
                  : 'bg-claude-border/50 text-claude-muted hover:text-claude-text'
                }
              `}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button
          onClick={() => setPaused(!paused)}
          className={`
            p-1.5 rounded transition-colors
            ${paused ? 'bg-claude-orange text-white' : 'text-claude-muted hover:text-claude-text hover:bg-claude-border/50'}
          `}
          title={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          onClick={downloadLogs}
          className="p-1.5 rounded text-claude-muted hover:text-claude-text hover:bg-claude-border/50"
          title="Download logs"
        >
          <Download size={16} />
        </button>
        <button
          onClick={clearLogs}
          className="p-1.5 rounded text-claude-muted hover:text-red-400 hover:bg-claude-border/50"
          title="Clear logs"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!activeSessionId ? (
          <div className="flex items-center justify-center h-full text-claude-muted">
            <p>Select a session to view logs</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-claude-muted">
            <p>No logs yet</p>
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <LogEntryRow
              key={i}
              entry={log}
              expanded={expandedIds.has(i)}
              onToggle={() => toggleExpand(i)}
            />
          ))
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-claude-border text-xs text-claude-muted">
        <span>{filteredLogs.length} entries</span>
        {paused && <span className="text-claude-orange">Paused</span>}
      </div>
    </div>
  );
}
