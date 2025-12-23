import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Save,
  RefreshCw,
  Home,
  ArrowUp
} from 'lucide-react';

const API_URL = '/api';

interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  extension?: string;
}

interface FileTreeProps {
  entries: FileEntry[];
  onSelect: (entry: FileEntry) => void;
  onNavigate: (path: string) => void;
}

function FileTree({ entries, onSelect, onNavigate }: FileTreeProps) {
  return (
    <div className="space-y-0.5">
      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => entry.type === 'directory' ? onNavigate(entry.path) : onSelect(entry)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-claude-border/50
            text-sm text-claude-text text-left transition-colors group"
        >
          {entry.type === 'directory' ? (
            <Folder size={16} className="text-claude-orange shrink-0" />
          ) : (
            <File size={16} className="text-claude-muted shrink-0" />
          )}
          <span className="truncate">{entry.name}</span>
          {entry.type === 'directory' && (
            <ChevronRight size={14} className="ml-auto text-claude-muted opacity-0 group-hover:opacity-100" />
          )}
        </button>
      ))}
    </div>
  );
}

export function FileBrowser() {
  const [currentPath, setCurrentPath] = useState<string>('/home/ajs');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const [modified, setModified] = useState(false);
  const [editorContent, setEditorContent] = useState('');

  const fetchDirectory = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/files/list?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setEntries(data);
      setCurrentPath(path);
    } catch (error) {
      console.error('Failed to fetch directory:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFile = useCallback(async (path: string) => {
    try {
      const res = await fetch(`${API_URL}/files/read?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setSelectedFile(data);
      setEditorContent(data.content);
      setModified(false);
    } catch (error) {
      console.error('Failed to fetch file:', error);
    }
  }, []);

  const saveFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const res = await fetch(`${API_URL}/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content: editorContent })
      });
      if (res.ok) {
        setModified(false);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [selectedFile, editorContent]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveFile]);

  // Initial load
  useEffect(() => {
    fetchDirectory(currentPath);
  }, []);

  const navigateUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    fetchDirectory(parentPath);
  };

  const navigateHome = () => {
    fetchDirectory('/home/ajs');
  };

  return (
    <div className="h-full flex">
      {/* File tree panel */}
      <div className="w-72 border-r border-claude-border flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-claude-border">
          <button
            onClick={navigateHome}
            className="p-1.5 rounded hover:bg-claude-border/50 text-claude-muted hover:text-claude-text"
            title="Home"
          >
            <Home size={16} />
          </button>
          <button
            onClick={navigateUp}
            className="p-1.5 rounded hover:bg-claude-border/50 text-claude-muted hover:text-claude-text"
            title="Go up"
          >
            <ArrowUp size={16} />
          </button>
          <button
            onClick={() => fetchDirectory(currentPath)}
            className="p-1.5 rounded hover:bg-claude-border/50 text-claude-muted hover:text-claude-text"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Current path */}
        <div className="px-3 py-2 text-xs text-claude-muted border-b border-claude-border truncate">
          {currentPath}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-sm text-claude-muted p-2">Loading...</div>
          ) : (
            <FileTree
              entries={entries}
              onSelect={(entry) => fetchFile(entry.path)}
              onNavigate={(path) => fetchDirectory(path)}
            />
          )}
        </div>
      </div>

      {/* Editor panel */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-claude-border">
              <div className="flex items-center gap-2">
                <File size={16} className="text-claude-muted" />
                <span className="text-sm text-claude-text">
                  {selectedFile.path.split('/').pop()}
                </span>
                {modified && (
                  <span className="w-2 h-2 rounded-full bg-claude-orange" title="Modified" />
                )}
              </div>
              <button
                onClick={saveFile}
                disabled={!modified}
                className={`
                  flex items-center gap-1 px-3 py-1 rounded text-sm transition-colors
                  ${modified
                    ? 'bg-claude-orange text-white hover:bg-claude-orange/90'
                    : 'bg-claude-border/50 text-claude-muted cursor-not-allowed'
                  }
                `}
              >
                <Save size={14} />
                Save
              </button>
            </div>

            {/* Monaco editor */}
            <div className="flex-1">
              <Editor
                height="100%"
                language={selectedFile.language}
                value={editorContent}
                onChange={(value) => {
                  setEditorContent(value || '');
                  setModified(value !== selectedFile.content);
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-claude-muted">
            <div className="text-center">
              <File size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a file to edit</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
