import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { homedir } from 'os';
import { join } from 'path';

import { sessionManager, Session } from './session.js';
import { getProjects, getProjectSessions, getSession, searchHistory } from './history.js';
import { fileManager } from './files.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Track WebSocket connections per session
const sessionConnections: Map<string, Set<WebSocket>> = new Map();

// WebSocket handling
wss.on('connection', (ws) => {
  let subscribedSessionId: string | null = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          // Subscribe to a session's output
          subscribedSessionId = message.sessionId;
          if (!sessionConnections.has(message.sessionId)) {
            sessionConnections.set(message.sessionId, new Set());
          }
          sessionConnections.get(message.sessionId)!.add(ws);

          // Send recent logs
          const logs = sessionManager.getLogs(message.sessionId, 100);
          ws.send(JSON.stringify({ type: 'logs', logs }));
          break;

        case 'input':
          // Send input to session
          if (subscribedSessionId) {
            sessionManager.sendInput(subscribedSessionId, message.data);
          }
          break;

        case 'resize':
          // Resize terminal
          if (subscribedSessionId) {
            sessionManager.resizeSession(subscribedSessionId, message.cols, message.rows);
          }
          break;

        case 'unsubscribe':
          if (subscribedSessionId) {
            sessionConnections.get(subscribedSessionId)?.delete(ws);
            subscribedSessionId = null;
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (subscribedSessionId) {
      sessionConnections.get(subscribedSessionId)?.delete(ws);
    }
  });
});

// Forward session events to WebSocket clients
sessionManager.on('session:data', ({ sessionId, data, type }) => {
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    const message = JSON.stringify({ type: 'data', data, dataType: type });
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
});

sessionManager.on('session:exit', ({ sessionId, exitCode }) => {
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    const message = JSON.stringify({ type: 'exit', exitCode });
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
});

// REST API Routes

// Sessions
app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json(sessions);
});

app.post('/api/sessions', (req, res) => {
  const { name, workingDir } = req.body;
  const dir = workingDir || process.cwd();
  const session = sessionManager.createSession(name, dir);
  res.json(session);
});

app.post('/api/sessions/:id/start', (req, res) => {
  const success = sessionManager.startSession(req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Failed to start session' });
  }
});

app.post('/api/sessions/:id/stop', (req, res) => {
  const success = sessionManager.stopSession(req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Failed to stop session' });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  const success = sessionManager.deleteSession(req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/sessions/:id/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || undefined;
  const logs = sessionManager.getLogs(req.params.id, limit);
  res.json(logs);
});

// History
app.get('/api/history/projects', async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

app.get('/api/history/projects/:path/sessions', async (req, res) => {
  const sessions = await getProjectSessions(req.params.path);
  res.json(sessions);
});

app.get('/api/history/projects/:path/sessions/:sessionId', async (req, res) => {
  const session = await getSession(req.params.path, req.params.sessionId);
  if (session) {
    res.json(session);
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/history/search', async (req, res) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 50;

  if (!query) {
    res.status(400).json({ error: 'Query parameter required' });
    return;
  }

  const results = await searchHistory(query, limit);
  res.json(results);
});

// Files
app.get('/api/files/list', async (req, res) => {
  const path = (req.query.path as string) || homedir();
  const showHidden = req.query.hidden === 'true';

  const entries = await fileManager.listDirectory(path, showHidden);
  res.json(entries);
});

app.get('/api/files/read', async (req, res) => {
  const path = req.query.path as string;

  if (!path) {
    res.status(400).json({ error: 'Path parameter required' });
    return;
  }

  const content = await fileManager.readFile(path);
  if (content) {
    res.json(content);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.post('/api/files/write', async (req, res) => {
  const { path, content } = req.body;

  if (!path || content === undefined) {
    res.status(400).json({ error: 'Path and content required' });
    return;
  }

  const success = await fileManager.writeFile(path, content);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

app.get('/api/files/info', async (req, res) => {
  const path = req.query.path as string;

  if (!path) {
    res.status(400).json({ error: 'Path parameter required' });
    return;
  }

  const info = await fileManager.getFileInfo(path);
  if (info) {
    res.json(info);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, () => {
  console.log(`Claude GUI Backend running on http://localhost:${PORT}`);
  console.log(`WebSocket available on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  sessionManager.getAllSessions().forEach(session => {
    sessionManager.stopSession(session.id);
  });
  fileManager.closeAllWatchers();
  server.close();
  process.exit(0);
});
