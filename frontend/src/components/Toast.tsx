import { useEffect, useState } from 'react';
import { X, Check, AlertCircle, Info, Bookmark } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'bookmark';

interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners: Set<(toast: ToastMessage) => void> = new Set();

export const toast = {
  success: (message: string) => {
    const t = { id: ++toastId, message, type: 'success' as const };
    listeners.forEach(l => l(t));
  },
  error: (message: string) => {
    const t = { id: ++toastId, message, type: 'error' as const };
    listeners.forEach(l => l(t));
  },
  info: (message: string) => {
    const t = { id: ++toastId, message, type: 'info' as const };
    listeners.forEach(l => l(t));
  },
  bookmark: (message: string) => {
    const t = { id: ++toastId, message, type: 'bookmark' as const };
    listeners.forEach(l => l(t));
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 3000);
    };
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <Check size={16} className="text-emerald-400" />;
      case 'error': return <AlertCircle size={16} className="text-red-400" />;
      case 'info': return <Info size={16} className="text-cyan-400" />;
      case 'bookmark': return <Bookmark size={16} className="text-orange-400" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-emerald-500/30 bg-emerald-500/10';
      case 'error': return 'border-red-500/30 bg-red-500/10';
      case 'info': return 'border-cyan-500/30 bg-cyan-500/10';
      case 'bookmark': return 'border-orange-500/30 bg-orange-500/10';
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-in ${getStyles(t.type)}`}
        >
          {getIcon(t.type)}
          <span className="text-sm text-white font-medium">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-2 text-white/40 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
