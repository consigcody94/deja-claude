import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Terminal, FileText, Search, Edit, Loader2 } from 'lucide-react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolName?: string;
  toolInput?: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTool = message.role === 'tool';
  const isSystem = message.role === 'system';

  const getIcon = () => {
    if (isUser) return <User size={18} />;
    if (isAssistant) return <Bot size={18} />;
    if (isTool) {
      switch (message.toolName) {
        case 'Read':
        case 'read_file':
          return <FileText size={18} />;
        case 'Bash':
        case 'bash':
          return <Terminal size={18} />;
        case 'Search':
        case 'Grep':
          return <Search size={18} />;
        case 'Edit':
        case 'Write':
          return <Edit size={18} />;
        default:
          return <Terminal size={18} />;
      }
    }
    return <Bot size={18} />;
  };

  const getRoleLabel = () => {
    if (isUser) return 'You';
    if (isAssistant) return 'Claude';
    if (isTool) return message.toolName || 'Tool';
    return 'System';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`group flex gap-4 px-4 py-6 ${isUser ? 'bg-claude-bg' : 'bg-claude-surface'}`}>
      {/* Avatar */}
      <div className={`
        flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
        ${isUser ? 'bg-blue-600' : isAssistant ? 'bg-claude-orange' : isTool ? 'bg-emerald-600' : 'bg-gray-600'}
      `}>
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-claude-text">{getRoleLabel()}</span>
          <span className="text-xs text-claude-muted">{formatTime(message.timestamp)}</span>
          {message.isStreaming && (
            <Loader2 size={14} className="animate-spin text-claude-orange" />
          )}
        </div>

        {/* Tool input preview */}
        {isTool && message.toolInput && (
          <div className="text-xs text-claude-muted bg-claude-bg px-3 py-2 rounded-lg font-mono truncate">
            {message.toolInput}
          </div>
        )}

        {/* Message content */}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-lg !bg-[#1a1a2e] !my-3"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-claude-border px-1.5 py-0.5 rounded text-claude-orange font-mono text-sm" {...props}>
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-3 last:mb-0 text-claude-text leading-relaxed">{children}</p>;
              },
              ul({ children }) {
                return <ul className="list-disc list-inside mb-3 space-y-1 text-claude-text">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside mb-3 space-y-1 text-claude-text">{children}</ol>;
              },
              li({ children }) {
                return <li className="text-claude-text">{children}</li>;
              },
              h1({ children }) {
                return <h1 className="text-xl font-bold text-claude-text mb-3 mt-4">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-lg font-bold text-claude-text mb-2 mt-3">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-base font-semibold text-claude-text mb-2 mt-3">{children}</h3>;
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-claude-orange pl-4 italic text-claude-muted my-3">
                    {children}
                  </blockquote>
                );
              },
              a({ href, children }) {
                return (
                  <a href={href} className="text-claude-orange hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                );
              },
              table({ children }) {
                return (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-claude-border rounded-lg">{children}</table>
                  </div>
                );
              },
              th({ children }) {
                return <th className="px-4 py-2 bg-claude-border text-left text-claude-text font-semibold">{children}</th>;
              },
              td({ children }) {
                return <td className="px-4 py-2 border-t border-claude-border text-claude-text">{children}</td>;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
