import { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = 'max-w-2xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F2942]/50 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${maxWidthClass} bg-white border border-[#E2E8F0] rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold text-[#0F2942]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F2942] hover:bg-[#E2E8F0]/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
