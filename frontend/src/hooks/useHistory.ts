import { useState, useEffect, useCallback } from 'react';

const API_URL = '/api';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface HistorySession {
  id: string;
  project: string;
  messages: HistoryMessage[];
  createdAt: string;
  summary?: string;
}

export interface ProjectInfo {
  path: string;
  name: string;
  sessionCount: number;
  lastActivity: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/projects`);
      const data = await res.json();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, refresh: fetchProjects };
}

export function useProjectSessions(projectPath: string | null) {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/projects/${encodeURIComponent(projectPath)}/sessions`);
      const data = await res.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refresh: fetchSessions };
}

export function useHistorySearch() {
  const [results, setResults] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit: number = 50) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/history/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      const data = await res.json();
      setResults(data);
      setError(null);
    } catch (err) {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search };
}

export async function getSessionDetail(projectPath: string, sessionId: string): Promise<HistorySession | null> {
  try {
    const res = await fetch(`${API_URL}/history/projects/${encodeURIComponent(projectPath)}/sessions/${sessionId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
