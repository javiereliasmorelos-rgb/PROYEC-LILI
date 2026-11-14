import { useEffect, useState } from 'react';
import { History, ChevronLeft, ChevronRight, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { apiRequest, formatCurrency, formatDateTime, formatNumber } from '../lib/api';
import { FlashType, Movimiento, Producto } from '../types';

interface MovimientosPageProps {
  onFlash: (type: FlashType, text: string) => void;
}

export default function MovimientosPage({ onFlash }: MovimientosPageProps) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: number; nombre: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [productoId, setProductoId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  async function loadCatalog() {
    try {
      const res = await apiRequest<{ productos: Producto[] }>('/api/productos/catalogo');
      setProductos(res.productos);
    } catch {
      // ignore
    }
  }

  async function loadMovimientos(targetPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: '15',
      });
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      if (productoId) params.set('productoId', productoId);
      if (usuarioId) params.set('usuarioId', usuarioId);
      if (tipo) params.set('tipo', tipo);

      const res = await apiRequest<{
        movimientos: Movimiento[];
        usuarios: Array<{ id: number; nombre: string }>;
        pagination: { total: number; page: number; totalPages: number };
      }>(`/api/movimientos?${params.toString()}`);

      setMovimientos(res.movimientos);
      setUsuarios(res.usuarios);
      setTotalRecords(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Error al cargar movimientos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    loadMovimientos(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin, productoId, usuarioId, tipo]);

  function clearFilters() {
    setFechaInicio('');
    setFechaFin('');
    setProductoId('');
    setUsuarioId('');
    setTipo('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Movimientos de Inventario
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Bitácora histórica e inmutable de entradas y salidas ({formatNumber(totalRecords)} operaciones)
          </p>
        </div>
        {(fechaInicio || fechaFin || productoId || usuarioId || tipo) && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-9 px-3.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-medium text-[#0F2942] self-start sm:self-auto cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Fecha inicial</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Fecha final</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Producto</label>
          <select
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.codigo}] {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Usuario</label>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748B] mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Entradas y salidas</option>
            <option value="entrada">Solo entradas</option>
            <option value="salida">Solo salidas</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : movimientos.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#0F2942]">
              No se encontraron movimientos
            </h3>
            <p className="text-sm text-[#64748B] mt-1">
              Los registros de entradas y salidas aparecerán aquí de forma cronológica e inmutable.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4 text-right">Cantidad</th>
                    <th className="py-3 px-4 text-right">Anterior / Final</th>
                    <th className="py-3 px-4 text-right">Valor unit.</th>
                    <th className="py-3 px-4">Proveedor / Referencia</th>
                    <th className="py-3 px-4">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-sm">
                  {movimientos.map((m) => {
                    const isEntry = m.tipo_movimiento === 'entrada';
                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="py-3 px-4 font-mono-num text-xs text-[#64748B]">#{m.id}</td>
                        <td className="py-3 px-4 font-mono-num text-xs text-[#43474D] whitespace-nowrap">
                          {formatDateTime(m.fecha_movimiento)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-[#0F2942]">{m.producto_nombre}</p>
                          <p className="text-xs font-mono-num text-[#64748B]">{m.producto_codigo}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              isEntry ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}
                          >
                            {isEntry ? (
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpFromLine className="w-3.5 h-3.5" />
                            )}
                            {isEntry ? 'Entrada' : 'Salida'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num font-bold whitespace-nowrap">
                          <span className={isEntry ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                            {isEntry ? '+' : '-'}
                            {formatNumber(m.cantidad)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-xs text-[#43474D] whitespace-nowrap">
                          {formatNumber(m.stock_anterior)} →{' '}
                          <strong className="text-[#0F2942]">{formatNumber(m.stock_resultante)}</strong>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-num text-xs text-[#43474D] whitespace-nowrap">
                          {formatCurrency(m.precio_unitario)}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#43474D] max-w-[240px]">
                          <p className="font-medium text-[#0F2942] truncate">
                            {m.proveedor_nombre || m.motivo || '—'}
                          </p>
                          {(m.numero_factura || m.observaciones) && (
                            <p className="text-[#64748B] truncate">
                              {m.numero_factura ? `Factura: ${m.numero_factura}` : m.observaciones}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#0F2942] whitespace-nowrap">
                          {m.usuario_nombre}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-mono-num">
                Página {page} de {totalPages} · {formatNumber(totalRecords)} movimientos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadMovimientos(page - 1)}
                  className="h-8 px-2.5 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 inline-flex items-center gap-1 text-[#0F2942] font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => loadMovimientos(page + 1)}
                  className="h-8 px-2.5 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 inline-flex items-center gap-1 text-[#0F2942] font-medium cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
