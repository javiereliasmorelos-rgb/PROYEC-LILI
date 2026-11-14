import { useEffect, useState } from 'react';
import { BellRing, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { apiRequest, formatDateTime, formatNumber } from '../lib/api';
import { AlertaItem, FlashType } from '../types';
import { StockStatusLabel } from '../components/StockStatusText';

interface AlertasPageProps {
  onFlash: (type: FlashType, text: string) => void;
  onRestock: (productId: number) => void;
}

export default function AlertasPage({ onFlash, onRestock }: AlertasPageProps) {
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const [resumen, setResumen] = useState({
    agotados: 0,
    stockBajo: 0,
    disponibles: 0,
    totalAlertas: 0,
    fechaConsulta: '',
  });
  const [filter, setFilter] = useState<'alertas' | 'agotado' | 'stock_bajo' | 'todos'>('alertas');
  const [loading, setLoading] = useState(true);

  async function loadAlertas() {
    setLoading(true);
    try {
      const res = await apiRequest<{
        alertas: AlertaItem[];
        resumen: {
          agotados: number;
          stockBajo: number;
          disponibles: number;
          totalAlertas: number;
          fechaConsulta: string;
        };
      }>('/api/alertas');
      setAlertas(res.alertas);
      setResumen(res.resumen);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible consultar alertas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredItems = alertas.filter((item) => {
    if (filter === 'alertas') return item.estado === 'agotado' || item.estado === 'stock_bajo';
    if (filter === 'agotado') return item.estado === 'agotado';
    if (filter === 'stock_bajo') return item.estado === 'stock_bajo';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Alertas de Existencias Mínimas
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitoreo automático de stock agotado, stock bajo y disponibilidad en tiempo real
          </p>
        </div>

        <button
          type="button"
          onClick={loadAlertas}
          className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-sm font-medium text-[#0F2942] inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Actualizar consulta</span>
        </button>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] uppercase">Productos agotados</p>
          <p className="font-display font-mono-num text-3xl font-bold text-[#DC2626] mt-1">
            {formatNumber(resumen.agotados)}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Stock actual igual a 0</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] uppercase">Stock bajo</p>
          <p className="font-display font-mono-num text-3xl font-bold text-[#B45309] mt-1">
            {formatNumber(resumen.stockBajo)}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Menor o igual al stock mínimo</p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] uppercase">Disponibles</p>
          <p className="font-display font-mono-num text-3xl font-bold text-[#16A34A] mt-1">
            {formatNumber(resumen.disponibles)}
          </p>
          <p className="text-xs text-[#64748B] mt-1">Superan el mínimo establecido</p>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'alertas', label: `Todas las alertas (${resumen.totalAlertas})` },
          { id: 'agotado', label: `Agotados (${resumen.agotados})` },
          { id: 'stock_bajo', label: `Stock bajo (${resumen.stockBajo})` },
          { id: 'todos', label: `Catálogo completo (${alertas.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === tab.id
                ? 'bg-[#0F2942] text-white'
                : 'bg-white border border-[#E2E8F0] text-[#43474D] hover:bg-[#F8FAFC]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <BellRing className="w-10 h-10 text-[#16A34A] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#0F2942]">
              Sin alertas en esta vista
            </h3>
            <p className="text-sm text-[#64748B] mt-1">
              No hay productos que cumplan con la condición seleccionada en este momento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría / Proveedor</th>
                  <th className="py-3 px-4 text-right">Stock actual</th>
                  <th className="py-3 px-4 text-right">Stock mínimo</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha de consulta</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 font-mono-num text-xs font-semibold text-[#0F2942]">
                      {item.codigo}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#0F2942]">{item.nombre}</td>
                    <td className="py-3 px-4 text-xs text-[#43474D]">
                      <p>{item.categoria_nombre}</p>
                      <p className="text-[#64748B]">{item.proveedor_nombre}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-bold text-[#0F2942]">
                      {formatNumber(item.stock_actual)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-[#43474D]">
                      {formatNumber(item.stock_minimo)}
                    </td>
                    <td className="py-3 px-4">
                      <StockStatusLabel status={item.estado} />
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-[#64748B] whitespace-nowrap">
                      {formatDateTime(item.fecha_consulta)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onRestock(item.id)}
                        className="h-8 px-3 rounded-md bg-[#EFF4FF] hover:bg-[#DBE1FF] text-[#2563EB] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>Registrar entrada</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
