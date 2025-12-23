import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: string;
  isThinking?: boolean;
}

export interface HistorySession {
  id: string;
  project: string;
  messages: HistoryMessage[];
  createdAt: Date;
  summary?: string;
}

export interface ProjectInfo {
  path: string;
  name: string;
  sessionCount: number;
  lastActivity: Date;
}

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export async function getProjects(): Promise<ProjectInfo[]> {
  const projects: ProjectInfo[] = [];

  try {
    const entries = await readdir(CLAUDE_PROJECTS_DIR);

    for (const entry of entries) {
      const projectPath = join(CLAUDE_PROJECTS_DIR, entry);
      const projectStat = await stat(projectPath);

      if (projectStat.isDirectory()) {
        const sessions = await readdir(projectPath);
        const jsonlFiles = sessions.filter(f => f.endsWith('.jsonl'));

        // Get last modified time of most recent session
        let lastActivity = projectStat.mtime;
        for (const sessionFile of jsonlFiles) {
          const sessionStat = await stat(join(projectPath, sessionFile));
          if (sessionStat.mtime > lastActivity) {
            lastActivity = sessionStat.mtime;
          }
        }

        // Get actual filtered session count (only count meaningful sessions)
        const filteredSessions = await getProjectSessions(entry);

        // Skip projects with no meaningful sessions
        if (filteredSessions.length === 0) continue;

        // Decode project path (they're URL-encoded with dashes)
        const decodedPath = entry.replace(/-/g, '/');

        projects.push({
          path: entry,
          name: decodedPath,
          sessionCount: filteredSessions.length,
          lastActivity
        });
      }
    }

    // Sort by last activity
    projects.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  } catch (error) {
    console.error('Error reading projects:', error);
  }

  return projects;
}

export async function getProjectSessions(projectPath: string): Promise<HistorySession[]> {
  const sessions: HistorySession[] = [];
  const fullPath = join(CLAUDE_PROJECTS_DIR, projectPath);

  try {
    const entries = await readdir(fullPath);
    const jsonlFiles = entries.filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '');
      const filePath = join(fullPath, file);
      const fileStat = await stat(filePath);

      const content = await readFile(filePath, 'utf-8');
      const messages = parseJsonlMessages(content);

      // Only include sessions with actual meaningful content
      // Skip empty sessions, warmups, and sessions with only 1-2 messages
      if (messages.length < 3) continue;

      // Skip warmup/test sessions
      const firstUserMsg = messages.find(m => m.role === 'user' && m.content.length > 0);
      const firstContent = firstUserMsg?.content.toLowerCase() || '';
      if (firstContent === 'warmup' ||
          firstContent === 'test' ||
          firstContent === 'hi' ||
          firstContent === 'hello' ||
          firstContent.length < 5) continue;

      // Generate summary from first user message (already found above)
      const summary = firstUserMsg?.content.slice(0, 100) || 'Empty session';

      sessions.push({
        id: sessionId,
        project: projectPath,
        messages,
        createdAt: fileStat.birthtime,
        summary
      });
    }

    // Sort by creation date (newest first)
    sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error reading sessions:', error);
  }

  return sessions;
}

export async function getSession(projectPath: string, sessionId: string): Promise<HistorySession | null> {
  const filePath = join(CLAUDE_PROJECTS_DIR, projectPath, `${sessionId}.jsonl`);

  try {
    const fileStat = await stat(filePath);
    const content = await readFile(filePath, 'utf-8');
    const messages = parseJsonlMessages(content);

    return {
      id: sessionId,
      project: projectPath,
      messages,
      createdAt: fileStat.birthtime
    };
  } catch {
    return null;
  }
}

export interface SearchMatch {
  messageIndex: number;
  preview: string;
  role: string;
}

export interface SearchResult extends HistorySession {
  matches: SearchMatch[];
}

export async function searchHistory(query: string, limit: number = 50): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  const projects = await getProjects();

  for (const project of projects) {
    const sessions = await getProjectSessions(project.path);

    for (const session of sessions) {
      const matches: SearchMatch[] = [];

      session.messages.forEach((m, idx) => {
        const contentLower = m.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          // Extract preview with context around match
          const matchIdx = contentLower.indexOf(queryLower);
          const start = Math.max(0, matchIdx - 40);
          const end = Math.min(m.content.length, matchIdx + query.length + 40);
          let preview = m.content.slice(start, end).replace(/\n/g, ' ');
          if (start > 0) preview = '...' + preview;
          if (end < m.content.length) preview = preview + '...';

          matches.push({
            messageIndex: idx,
            preview,
            role: m.role
          });
        }
      });

      if (matches.length > 0) {
        results.push({
          ...session,
          matches
        });
        if (results.length >= limit) break;
      }
    }

    if (results.length >= limit) break;
  }

  return results;
}

function parseJsonlMessages(content: string): HistoryMessage[] {
  const messages: HistoryMessage[] = [];
  const lines = content.trim().split('\n').filter(l => l);

  // Track seen UUIDs to avoid duplicates
  const seenUuids = new Set<string>();
  // Track message content to merge consecutive assistant messages
  let lastAssistantContent = '';
  let lastAssistantTimestamp = '';

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      // Skip non-message types
      if (!parsed.type || parsed.type === 'summary' || parsed.type === 'file-history-snapshot') {
        continue;
      }

      // Skip duplicates
      if (parsed.uuid && seenUuids.has(parsed.uuid)) {
        continue;
      }
      if (parsed.uuid) {
        seenUuids.add(parsed.uuid);
      }

      const timestamp = parsed.timestamp;

      if (parsed.type === 'user') {
        // Flush any pending assistant message
        if (lastAssistantContent) {
          messages.push({
            role: 'assistant',
            content: lastAssistantContent.trim(),
            timestamp: lastAssistantTimestamp
          });
          lastAssistantContent = '';
        }

        const userContent = extractUserContent(parsed.message?.content);
        if (userContent) {
          messages.push({
            role: 'user',
            content: userContent,
            timestamp
          });
        }
      } else if (parsed.type === 'assistant') {
        const assistantContent = extractAssistantContent(parsed.message?.content);

        // Accumulate assistant content
        if (assistantContent.text) {
          if (lastAssistantContent) {
            lastAssistantContent += '\n' + assistantContent.text;
          } else {
            lastAssistantContent = assistantContent.text;
            lastAssistantTimestamp = timestamp;
          }
        }

        // Tool use is added as a separate message
        if (assistantContent.toolUse) {
          // Flush any pending text first
          if (lastAssistantContent) {
            messages.push({
              role: 'assistant',
              content: lastAssistantContent.trim(),
              timestamp: lastAssistantTimestamp
            });
            lastAssistantContent = '';
          }

          messages.push({
            role: 'tool',
            content: `Using tool: ${assistantContent.toolUse.name}`,
            toolName: assistantContent.toolUse.name,
            toolInput: JSON.stringify(assistantContent.toolUse.input, null, 2),
            timestamp
          });
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Flush any remaining assistant content
  if (lastAssistantContent) {
    messages.push({
      role: 'assistant',
      content: lastAssistantContent.trim(),
      timestamp: lastAssistantTimestamp
    });
  }

  return messages;
}

function extractUserContent(content: any): string {
  if (!content) return '';

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];

    for (const block of content) {
      if (block.type === 'text') {
        parts.push(block.text);
      } else if (block.type === 'tool_result') {
        // Tool results - extract the text content
        if (Array.isArray(block.content)) {
          for (const resultBlock of block.content) {
            if (resultBlock.type === 'text' && resultBlock.text) {
              parts.push(`[Tool Result]\n${resultBlock.text}`);
            }
          }
        } else if (typeof block.content === 'string') {
          parts.push(`[Tool Result]\n${block.content}`);
        }
      }
    }

    return parts.join('\n');
  }

  return '';
}

function extractAssistantContent(content: any): { text: string; toolUse: { name: string; input: any } | null } {
  if (!content) return { text: '', toolUse: null };

  if (typeof content === 'string') {
    return { text: content, toolUse: null };
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];
    let toolUse: { name: string; input: any } | null = null;

    for (const block of content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text);
      } else if (block.type === 'tool_use') {
        toolUse = { name: block.name, input: block.input };
      }
      // Skip 'thinking' blocks - they're internal
    }

    return { text: textParts.join('\n'), toolUse };
  }

  return { text: '', toolUse: null };
}
