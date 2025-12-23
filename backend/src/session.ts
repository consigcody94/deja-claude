import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  name: string;
  workingDir: string;
  pty: pty.IPty | null;
  status: 'running' | 'stopped' | 'error';
  createdAt: Date;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private claudePath: string;

  constructor(claudePath: string = 'claude') {
    super();
    this.claudePath = claudePath;
  }

  createSession(name: string, workingDir: string): Session {
    const id = uuidv4();
    const session: Session = {
      id,
      name: name || `Session ${this.sessions.size + 1}`,
      workingDir,
      pty: null,
      status: 'stopped',
      createdAt: new Date(),
      logs: []
    };

    this.sessions.set(id, session);
    this.emit('session:created', session);
    return session;
  }

  startSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

      session.pty = pty.spawn(shell, ['-c', `${this.claudePath} --dangerously-skip-permissions`], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: session.workingDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });

      session.status = 'running';

      session.pty.onData((data: string) => {
        const entry: LogEntry = {
          timestamp: new Date(),
          type: 'stdout',
          content: data
        };
        session.logs.push(entry);
        this.emit('session:data', { sessionId, data, type: 'stdout' });
      });

      session.pty.onExit(({ exitCode }) => {
        session.status = 'stopped';
        const entry: LogEntry = {
          timestamp: new Date(),
          type: 'system',
          content: `Process exited with code ${exitCode}`
        };
        session.logs.push(entry);
        this.emit('session:exit', { sessionId, exitCode });
      });

      this.emit('session:started', session);
      return true;
    } catch (error) {
      session.status = 'error';
      this.emit('session:error', { sessionId, error });
      return false;
    }
  }

  sendInput(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) return false;

    session.pty.write(data);
    return true;
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) return false;

    session.pty.resize(cols, rows);
    return true;
  }

  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session?.pty) return false;

    session.pty.kill();
    session.status = 'stopped';
    this.emit('session:stopped', session);
    return true;
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.pty) {
      session.pty.kill();
    }

    this.sessions.delete(sessionId);
    this.emit('session:deleted', { sessionId });
    return true;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(s => ({
      ...s,
      pty: null // Don't expose pty object
    }));
  }

  getLogs(sessionId: string, limit?: number): LogEntry[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    if (limit) {
      return session.logs.slice(-limit);
    }
    return session.logs;
  }
}

export const sessionManager = new SessionManager();
