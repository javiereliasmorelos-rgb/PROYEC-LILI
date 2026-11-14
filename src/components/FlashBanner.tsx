import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { FlashMessage } from '../types';

interface FlashBannerProps {
  messages: FlashMessage[];
  onDismiss: (id: string) => void;
}

export default function FlashBanner({ messages, onDismiss }: FlashBannerProps) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-2 mb-5" aria-live="polite">
      {messages.map((msg) => {
        const config = {
          success: {
            bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
            icon: <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0" />,
          },
          warning: {
            bg: 'bg-amber-50 border-amber-200 text-amber-900',
            icon: <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0" />,
          },
          error: {
            bg: 'bg-red-50 border-red-200 text-red-900',
            icon: <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />,
          },
          info: {
            bg: 'bg-blue-50 border-blue-200 text-blue-900',
            icon: <Info className="w-5 h-5 text-[#2563EB] shrink-0" />,
          },
        }[msg.type];

        return (
          <div
            key={msg.id}
            role="alert"
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-sm font-medium shadow-xs ${config.bg}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {config.icon}
              <span className="leading-snug">{msg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(msg.id)}
              aria-label="Cerrar notificación"
              className="p-1 rounded-md hover:bg-black/5 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
