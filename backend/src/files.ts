import { readdir, readFile, writeFile, stat, mkdir } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  extension?: string;
}

export interface FileContent {
  path: string;
  content: string;
  language?: string;
}

// Language detection based on extension
const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'shell',
  '.bash': 'shell',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.vue': 'vue',
  '.svelte': 'svelte'
};

// Directories to ignore
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  '.venv',
  'venv',
  '.next',
  'dist',
  'build',
  '.cache',
  'coverage'
]);

export class FileManager extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();

  async listDirectory(dirPath: string, showHidden: boolean = false): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];

    try {
      const items = await readdir(dirPath);

      for (const item of items) {
        // Skip hidden files unless requested
        if (!showHidden && item.startsWith('.')) continue;
        // Skip ignored directories
        if (IGNORED_DIRS.has(item)) continue;

        const itemPath = join(dirPath, item);

        try {
          const itemStat = await stat(itemPath);

          entries.push({
            name: item,
            path: itemPath,
            type: itemStat.isDirectory() ? 'directory' : 'file',
            size: itemStat.isFile() ? itemStat.size : undefined,
            modified: itemStat.mtime,
            extension: itemStat.isFile() ? extname(item) : undefined
          });
        } catch {
          // Skip items we can't stat
        }
      }

      // Sort: directories first, then alphabetically
      entries.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error(`Error listing directory ${dirPath}:`, error);
    }

    return entries;
  }

  async readFile(filePath: string): Promise<FileContent | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const ext = extname(filePath);

      return {
        path: filePath,
        content,
        language: LANGUAGE_MAP[ext] || 'plaintext'
      };
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return null;
    }
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    try {
      // Ensure directory exists
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      return false;
    }
  }

  async getFileInfo(filePath: string): Promise<FileEntry | null> {
    try {
      const fileStat = await stat(filePath);

      return {
        name: basename(filePath),
        path: filePath,
        type: fileStat.isDirectory() ? 'directory' : 'file',
        size: fileStat.isFile() ? fileStat.size : undefined,
        modified: fileStat.mtime,
        extension: fileStat.isFile() ? extname(filePath) : undefined
      };
    } catch {
      return null;
    }
  }

  watchDirectory(dirPath: string): void {
    if (this.watchers.has(dirPath)) return;

    const watcher = chokidar.watch(dirPath, {
      ignored: /(^|[\/\\])(\.|node_modules|\.git)/,
      persistent: true,
      ignoreInitial: true,
      depth: 1
    });

    watcher.on('add', (path) => {
      this.emit('file:added', { path, type: 'file' });
    });

    watcher.on('change', (path) => {
      this.emit('file:changed', { path });
    });

    watcher.on('unlink', (path) => {
      this.emit('file:removed', { path });
    });

    watcher.on('addDir', (path) => {
      this.emit('file:added', { path, type: 'directory' });
    });

    watcher.on('unlinkDir', (path) => {
      this.emit('file:removed', { path });
    });

    this.watchers.set(dirPath, watcher);
  }

  unwatchDirectory(dirPath: string): void {
    const watcher = this.watchers.get(dirPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(dirPath);
    }
  }

  closeAllWatchers(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}

export const fileManager = new FileManager();
