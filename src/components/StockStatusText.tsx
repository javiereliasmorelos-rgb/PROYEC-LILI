import { CheckCircle2, AlertTriangle, XCircle, Ban } from 'lucide-react';
import { StockStatus } from '../types';

export function StockStatusLabel({
  status,
  activo = true,
}: {
  status?: StockStatus;
  activo?: boolean;
}) {
  if (!activo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] whitespace-nowrap">
        <Ban className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
        Inactivo
      </span>
    );
  }

  if (status === 'agotado') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
        Agotado
      </span>
    );
  }

  if (status === 'stock_bajo') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
        Stock bajo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] whitespace-nowrap">
      <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
      Disponible
    </span>
  );
}
