import { useMemo } from 'react';

interface Session {
  id: string;
  createdAt: string;
  messages: any[];
}

interface ActivityHeatmapProps {
  sessions: Session[];
  weeks?: number;
}

export function ActivityHeatmap({ sessions, weeks = 12 }: ActivityHeatmapProps) {
  const heatmapData = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = weeks * 7;

    // Initialize all days
    const days: Array<{ date: Date; count: number; sessions: Session[] }> = [];
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * dayMs);
      date.setHours(0, 0, 0, 0);
      days.push({ date, count: 0, sessions: [] });
    }

    // Count sessions per day
    sessions.forEach(session => {
      const sessionDate = new Date(session.createdAt);
      sessionDate.setHours(0, 0, 0, 0);

      const day = days.find(d => d.date.getTime() === sessionDate.getTime());
      if (day) {
        day.count++;
        day.sessions.push(session);
      }
    });

    // Find max for color scaling
    const maxCount = Math.max(...days.map(d => d.count), 1);

    // Group by week
    const weekGroups: typeof days[] = [];
    for (let i = 0; i < totalDays; i += 7) {
      weekGroups.push(days.slice(i, i + 7));
    }

    return { days, maxCount, weekGroups };
  }, [sessions, weeks]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    const intensity = count / heatmapData.maxCount;
    if (intensity < 0.25) return 'bg-cyan-900/50';
    if (intensity < 0.5) return 'bg-cyan-700/60';
    if (intensity < 0.75) return 'bg-cyan-500/70';
    return 'bg-cyan-400';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; week: number }> = [];
    let lastMonth = -1;

    heatmapData.weekGroups.forEach((week, weekIdx) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (month !== lastMonth) {
          labels.push({
            label: firstDay.date.toLocaleDateString('en-US', { month: 'short' }),
            week: weekIdx
          });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [heatmapData.weekGroups]);

  return (
    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Activity</span>
        <span className="text-[10px] text-white/40 font-mono">{sessions.length} sessions in {weeks} weeks</span>
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-6">
        {monthLabels.map(({ label, week }, idx) => (
          <span
            key={idx}
            className="text-[10px] text-white/40 font-mono"
            style={{ marginLeft: idx === 0 ? `${week * 12}px` : `${(week - (monthLabels[idx - 1]?.week || 0)) * 12 - 24}px` }}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((label, idx) => (
            <span key={idx} className="text-[8px] text-white/30 h-2.5 flex items-center">
              {idx % 2 === 1 ? label : ''}
            </span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-0.5">
          {heatmapData.weekGroups.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-0.5">
              {week.map((day, dayIdx) => (
                <div
                  key={dayIdx}
                  className={`w-2.5 h-2.5 rounded-sm ${getColor(day.count)} hover:ring-1 hover:ring-cyan-400 transition-all cursor-pointer`}
                  title={`${day.date.toLocaleDateString()}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3">
        <span className="text-[10px] text-white/30">Less</span>
        <div className="w-2.5 h-2.5 rounded-sm bg-white/5" />
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-900/50" />
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-700/60" />
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-500/70" />
        <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
        <span className="text-[10px] text-white/30">More</span>
      </div>
    </div>
  );
}
