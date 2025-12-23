import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useSessionsStore } from '../stores/sessions';
import { useSession } from '../hooks/useSession';

interface TerminalProps {
  sessionId: string;
}

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastLogIndexRef = useRef<number>(0);

  const { sessionLogs } = useSessionsStore();
  const { sendInput, resize } = useSession(sessionId);
  const logs = sessionLogs.get(sessionId) || [];

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    console.log('Initializing terminal for session:', sessionId);

    const terminal = new XTerm({
      theme: {
        background: '#0f0f0f',
        foreground: '#e5e5e5',
        cursor: '#d97706',
        cursorAccent: '#0f0f0f',
        selectionBackground: '#d97706',
        selectionForeground: '#0f0f0f',
        black: '#1a1a1a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#4a4a4a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);

    // Delay fit to ensure DOM is ready
    setTimeout(() => {
      fitAddon.fit();
      resize(terminal.cols, terminal.rows);
    }, 100);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    lastLogIndexRef.current = 0;

    // Handle user input
    terminal.onData((data) => {
      sendInput(data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      resize(terminal.cols, terminal.rows);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      xtermRef.current = null;
    };
  }, [sessionId, sendInput, resize]);

  // Write logs when they change
  useEffect(() => {
    if (!xtermRef.current) return;

    // Write only new logs since last time
    const newLogs = logs.slice(lastLogIndexRef.current);
    newLogs.forEach((log) => {
      xtermRef.current?.write(log.content);
    });
    lastLogIndexRef.current = logs.length;
  }, [logs]);

  return (
    <div className="h-full w-full bg-[#0f0f0f] p-2">
      <div ref={terminalRef} className="h-full w-full" />
    </div>
  );
}
