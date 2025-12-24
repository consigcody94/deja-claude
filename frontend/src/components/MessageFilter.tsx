import { User, MessageSquare, Terminal } from 'lucide-react';

interface MessageFilterProps {
  activeFilters: Set<string>;
  onToggle: (filter: string) => void;
  counts: {
    user: number;
    assistant: number;
    tool: number;
  };
}

export function MessageFilter({ activeFilters, onToggle, counts }: MessageFilterProps) {
  const filters = [
    { id: 'user', label: 'You', icon: User, color: 'blue', count: counts.user },
    { id: 'assistant', label: 'Claude', icon: MessageSquare, color: 'orange', count: counts.assistant },
    { id: 'tool', label: 'Tools', icon: Terminal, color: 'purple', count: counts.tool },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 uppercase tracking-wider">Show:</span>
      {filters.map(f => {
        const isActive = activeFilters.has(f.id);
        return (
          <button
            key={f.id}
            onClick={() => onToggle(f.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
              isActive
                ? `bg-${f.color}-500/20 text-${f.color}-400 border border-${f.color}-500/30`
                : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'
            }`}
          >
            <f.icon size={12} />
            <span>{f.label}</span>
            <span className={`font-mono text-[10px] ${isActive ? `text-${f.color}-400/70` : 'text-white/30'}`}>
              {f.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
