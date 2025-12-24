import { useMemo } from 'react';
import { MessageSquare, Terminal, User } from 'lucide-react';

interface HistoryMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: string;
}

interface SessionTimelineProps {
  messages: HistoryMessage[];
  onJumpTo: (index: number) => void;
  activeIndex?: number;
  highlightedIndex?: number | null;
}

export function SessionTimeline({ messages, onJumpTo, activeIndex, highlightedIndex }: SessionTimelineProps) {
  // Group consecutive messages of same type for cleaner visualization
  const segments = useMemo(() => {
    const result: Array<{
      type: 'user' | 'assistant' | 'tool';
      startIndex: number;
      count: number;
      toolNames?: string[];
    }> = [];

    let currentType: string | null = null;
    let currentStart = 0;
    let currentCount = 0;
    let currentTools: string[] = [];

    messages.forEach((msg, idx) => {
      if (msg.role !== currentType) {
        if (currentType !== null) {
          result.push({
            type: currentType as 'user' | 'assistant' | 'tool',
            startIndex: currentStart,
            count: currentCount,
            toolNames: currentType === 'tool' ? [...currentTools] : undefined
          });
        }
        currentType = msg.role;
        currentStart = idx;
        currentCount = 1;
        currentTools = msg.toolName ? [msg.toolName] : [];
      } else {
        currentCount++;
        if (msg.toolName && !currentTools.includes(msg.toolName)) {
          currentTools.push(msg.toolName);
        }
      }
    });

    if (currentType !== null) {
      result.push({
        type: currentType as 'user' | 'assistant' | 'tool',
        startIndex: currentStart,
        count: currentCount,
        toolNames: currentType === 'tool' ? currentTools : undefined
      });
    }

    return result;
  }, [messages]);

  const getColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-500';
      case 'assistant': return 'bg-orange-500';
      case 'tool': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getHoverColor = (type: string) => {
    switch (type) {
      case 'user': return 'hover:bg-blue-400';
      case 'assistant': return 'hover:bg-orange-400';
      case 'tool': return 'hover:bg-purple-400';
      default: return 'hover:bg-gray-400';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'user': return <User size={8} />;
      case 'assistant': return <MessageSquare size={8} />;
      case 'tool': return <Terminal size={8} />;
      default: return null;
    }
  };

  const totalMessages = messages.length;

  return (
    <div className="w-full">
      {/* Mini header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono">Timeline</span>
        <span className="text-[10px] text-white/40 font-mono">{messages.length} msgs</span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-6 bg-white/5 rounded-lg overflow-hidden border border-white/10">
        {segments.map((seg, idx) => {
          const width = (seg.count / totalMessages) * 100;
          const left = (seg.startIndex / totalMessages) * 100;
          const isActive = activeIndex !== undefined &&
            activeIndex >= seg.startIndex &&
            activeIndex < seg.startIndex + seg.count;
          const isHighlighted = highlightedIndex !== null &&
            highlightedIndex !== undefined &&
            highlightedIndex >= seg.startIndex &&
            highlightedIndex < seg.startIndex + seg.count;

          return (
            <button
              key={idx}
              onClick={() => onJumpTo(seg.startIndex)}
              className={`absolute top-0 bottom-0 transition-all duration-200 ${getColor(seg.type)} ${getHoverColor(seg.type)}
                ${isActive ? 'ring-2 ring-white/50 z-10' : ''}
                ${isHighlighted ? 'ring-2 ring-cyan-400 z-10 animate-pulse' : ''}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
              title={`${seg.type}: ${seg.count} message${seg.count > 1 ? 's' : ''}${seg.toolNames ? ` (${seg.toolNames.join(', ')})` : ''}`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-white/80">
                {width > 8 && getIcon(seg.type)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-white/40">You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-[10px] text-white/40">Claude</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-[10px] text-white/40">Tools</span>
        </div>
      </div>
    </div>
  );
}
