import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileBarChart2,
  ArrowRight,
  Package,
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDateTime, formatNumber } from '../lib/api';
import { DashboardData, PageRoute, User } from '../types';
import { StockStatusLabel } from '../components/StockStatusText';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface DashboardPageProps {
  user: User;
  onNavigate: (route: PageRoute) => void;
  onQuickCreateProduct: () => void;
  onQuickRestock: (productId: number) => void;
}

export default function DashboardPage({
  user,
  onNavigate,
  onQuickCreateProduct,
  onQuickRestock,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user.rol === 'administrador';

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<DashboardData>('/api/dashboard');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el panel');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white border border-[#E2E8F0] rounded-xl p-5 h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl h-80 animate-pulse" />
          <div className="bg-white border border-[#E2E8F0] rounded-xl h-80 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 text-center">
        <p className="text-sm text-[#DC2626] font-medium">{error || 'Sin datos disponibles'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="mt-4 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { kpis, flujoMensual, productosPorCategoria, movimientosRecientes, alertasRecientes } = data;

  const barChartData = {
    labels: flujoMensual.map((m) => m.etiqueta),
    datasets: [
      {
        label: 'Entradas (unidades)',
        data: flujoMensual.map((m) => m.entradas),
        backgroundColor: '#16A34A',
        borderRadius: 6,
      },
      {
        label: 'Salidas (unidades)',
        data: flujoMensual.map((m) => m.salidas),
        backgroundColor: '#DC2626',
        borderRadius: 6,
      },
    ],
  };

  const categoryPalette = ['#2563EB', '#142B4A', '#16A34A', '#F59E0B', '#0EA5E9', '#64748B', '#DC2626'];

  const doughnutChartData = {
    labels: productosPorCategoria.map((c) => c.nombre),
    datasets: [
      {
        data: productosPorCategoria.map((c) => c.cantidad_productos),
        backgroundColor: productosPorCategoria.map((_, idx) => categoryPalette[idx % categoryPalette.length]),
        borderWidth: 2,
        borderColor: '#FFFFFF',
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Page header & quick actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Panel de Control
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Resumen operativo en tiempo real desde PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={onQuickCreateProduct}
              className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo producto</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('entradas')}
            className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F2942] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-[#16A34A]" />
            <span>Registrar entrada</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('salidas')}
            className="h-10 px-4 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F2942] text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowUpFromLine className="w-4 h-4 text-[#DC2626]" />
            <span>Registrar salida</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('reportes')}
              className="h-10 px-4 rounded-lg bg-[#142B4A] hover:bg-[#0F2942] text-white text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileBarChart2 className="w-4 h-4" />
              <span>Ver reportes</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] tracking-wide uppercase">
            Total de productos
          </p>
          <p className="font-display font-mono-num text-3xl font-bold text-[#0F2942] mt-2">
            {formatNumber(kpis.totalProductosActivos)}
          </p>
          <p className="text-xs text-[#64748B] mt-2 font-mono-num">
            {formatNumber(kpis.unidadesTotales)} unidades en stock · {formatNumber(kpis.totalProductos)} registrados
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] tracking-wide uppercase">
            Valor total del inventario
          </p>
          <p className="font-display font-mono-num text-2xl sm:text-3xl font-bold text-[#0F2942] mt-2 truncate">
            {formatCurrency(kpis.valorInventarioCompra)}
          </p>
          <p className="text-xs text-[#64748B] mt-2 font-mono-num">
            Valor venta estimado: {formatCurrency(kpis.valorInventarioVenta)}
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] tracking-wide uppercase">
            Productos con stock bajo
          </p>
          <p
            className={`font-display font-mono-num text-3xl font-bold mt-2 ${
              kpis.productosStockBajo > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
            }`}
          >
            {formatNumber(kpis.productosStockBajo)}
          </p>
          <p className="text-xs text-[#64748B] mt-2 font-mono-num">
            {formatNumber(kpis.productosAgotados)} agotados ·{' '}
            <button
              type="button"
              onClick={() => onNavigate('alertas')}
              className="text-[#2563EB] hover:underline font-medium cursor-pointer"
            >
              Revisar alertas
            </button>
          </p>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-xs font-semibold text-[#64748B] tracking-wide uppercase">
            Movimientos del mes
          </p>
          <p className="font-display font-mono-num text-3xl font-bold text-[#0F2942] mt-2">
            {formatNumber(kpis.movimientosMes)}
          </p>
          <p className="text-xs text-[#64748B] mt-2 font-mono-num">
            <span className="text-[#16A34A] font-medium">+{formatNumber(kpis.unidadesEntradaMes)} ent.</span>
            {' · '}
            <span className="text-[#DC2626] font-medium">-{formatNumber(kpis.unidadesSalidaMes)} sal.</span>
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Entradas y salidas de mercancía
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Flujo de unidades registradas en los últimos 6 meses
              </p>
            </div>
          </div>
          <div className="h-64">
            <Bar
              data={barChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, boxWidth: 8, font: { size: 12 } },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: '#F1F5F9' },
                  },
                  x: {
                    grid: { display: false },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Productos por categoría
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Distribución del catálogo activo
            </p>
          </div>
          {productosPorCategoria.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <Package className="w-8 h-8 text-[#94A3B8] mb-2" />
              <p className="text-sm text-[#64748B]">Sin productos categorizados aún</p>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <Doughnut
                data={doughnutChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '62%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } },
                    },
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom tables: Recent movements & Low stock alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Movimientos recientes
              </h2>
              <p className="text-xs text-[#64748B]">Últimas operaciones registradas en inventario</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('movimientos')}
              className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Ver historial completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {movimientosRecientes.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[#64748B]">
                No se han registrado movimientos de inventario todavía.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Stock final</th>
                    <th className="py-3 px-4">Responsable</th>
                    <th className="py-3 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-sm">
                  {movimientosRecientes.map((m) => (
                    <tr key={m.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#0F2942]">{m.producto_nombre}</p>
                        <p className="text-xs text-[#64748B] font-mono-num">{m.producto_codigo}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${
                            m.tipo_movimiento === 'entrada' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          {m.tipo_movimiento === 'entrada' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-semibold">
                        <span
                          className={
                            m.tipo_movimiento === 'entrada' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }
                        >
                          {m.tipo_movimiento === 'entrada' ? '+' : '-'}
                          {formatNumber(m.cantidad)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-[#0F2942]">
                        {formatNumber(m.stock_resultante)}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#43474D]">{m.usuario_nombre}</td>
                      <td className="py-3 px-4 text-xs text-[#64748B] font-mono-num whitespace-nowrap">
                        {formatDateTime(m.fecha_movimiento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Alertas de existencias
              </h2>
              <p className="text-xs text-[#64748B]">Productos por debajo o igual al mínimo</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('alertas')}
              className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
            >
              Ver todas
            </button>
          </div>

          {alertasRecientes.length === 0 ? (
            <div className="p-8 text-center my-auto">
              <p className="text-sm font-medium text-[#16A34A]">
                Sin alertas activas de inventario
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Todos los productos activos superan su stock mínimo configurado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {alertasRecientes.map((item) => (
                <div
                  key={item.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F8FAFC]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F2942] truncate">{item.nombre}</p>
                    <p className="text-xs text-[#64748B] font-mono-num mt-0.5">
                      {item.codigo} · Stock: {item.stock_actual} / Mín: {item.stock_minimo}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StockStatusLabel status={item.estado_stock} />
                    <button
                      type="button"
                      onClick={() => onQuickRestock(item.id)}
                      className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Reabastecer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
