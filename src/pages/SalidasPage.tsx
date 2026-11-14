import { useEffect, useState, FormEvent } from 'react';
import { ArrowUpFromLine, AlertTriangle } from 'lucide-react';
import { apiRequest, formatNumber } from '../lib/api';
import { FlashType, Producto, User } from '../types';

interface SalidasPageProps {
  user: User;
  onFlash: (type: FlashType, text: string) => void;
  onInventoryMutated: () => void;
  onGoToProductos?: () => void;
}

export default function SalidasPage({
  user,
  onFlash,
  onInventoryMutated,
  onGoToProductos,
}: SalidasPageProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [productoId, setProductoId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [motivo, setMotivo] = useState('Venta / Despacho a cliente');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [observaciones, setObservaciones] = useState('');

  async function loadCatalog() {
    setLoading(true);
    try {
      const res = await apiRequest<{ productos: Producto[] }>('/api/productos/catalogo');
      setProductos(res.productos);
      if (res.productos.length > 0 && !productoId) {
        setProductoId(String(res.productos[0].id));
      }
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Error al cargar catálogo');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = productos.find((p) => String(p.id) === productoId) || null;
  const qtyNum = Number(cantidad) || 0;
  const remainingStock = selectedProduct ? selectedProduct.stock_actual - qtyNum : 0;
  const insufficient = selectedProduct ? qtyNum > selectedProduct.stock_actual : false;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productoId || !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0 || !motivo.trim()) {
      onFlash('error', 'Verifica los datos ingresados');
      return;
    }

    if (selectedProduct && Number(cantidad) > selectedProduct.stock_actual) {
      onFlash('error', 'No hay suficiente inventario disponible para realizar esta operación');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; warning?: string | null }>(
        '/api/movimientos/salida',
        {
          method: 'POST',
          body: JSON.stringify({
            producto_id: Number(productoId),
            cantidad: Number(cantidad),
            motivo: motivo.trim(),
            fecha,
            observaciones: observaciones.trim(),
          }),
        }
      );

      onFlash('success', res.message || 'Salida registrada correctamente');
      if (res.warning) {
        onFlash('warning', res.warning);
      }

      setCantidad('1');
      setObservaciones('');
      await loadCatalog();
      onInventoryMutated();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
          Salidas de Mercancía
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Descuenta existencias con validación estricta de stock y control de saldos mínimos
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl h-80 animate-pulse" />
      ) : productos.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0F2942]">
            No hay productos activos disponibles en catálogo.
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {user.rol === 'administrador'
              ? 'Registra productos en el catálogo antes de procesar salidas de mercancía.'
              : 'Solicita a un administrador registrar productos en el catálogo.'}
          </p>
          {user.rol === 'administrador' && onGoToProductos && (
            <button
              type="button"
              onClick={onGoToProductos}
              className="mt-4 h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold cursor-pointer"
            >
              Ir a Gestión de Productos
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Producto *
                </label>
                <select
                  required
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo}] {p.nombre} — Disponible: {p.stock_actual}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Cantidad de salida *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Motivo de salida *
                </label>
                <select
                  required
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="Venta / Despacho a cliente">Venta / Despacho a cliente</option>
                  <option value="Consumo interno operativo">Consumo interno operativo</option>
                  <option value="Traslado entre sedes">Traslado entre sedes</option>
                  <option value="Devolución a proveedor">Devolución a proveedor</option>
                  <option value="Merma o producto dañado">Merma o producto dañado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Fecha de salida *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Usuario responsable
                </label>
                <input
                  type="text"
                  disabled
                  value={user.nombre}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#64748B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Observaciones
              </label>
              <textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Orden de despacho, cliente destinatario o detalle de salida..."
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            {insufficient && (
              <div
                role="alert"
                className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>No hay suficiente inventario disponible para realizar esta operación</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                disabled={submitting || insufficient}
                className="h-10 px-5 rounded-lg bg-[#DC2626] hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowUpFromLine className="w-4 h-4" />
                <span>{submitting ? 'Procesando salida...' : 'Confirmar salida de mercancía'}</span>
              </button>
            </div>
          </form>

          {/* Availability preview */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Validación de existencias
            </h2>

            {selectedProduct && (
              <div className="space-y-3 text-sm pt-2 border-t border-[#F1F5F9]">
                <div>
                  <p className="text-xs text-[#64748B]">Artículo</p>
                  <p className="font-semibold text-[#0F2942]">{selectedProduct.nombre}</p>
                  <p className="text-xs font-mono-num text-[#64748B]">{selectedProduct.codigo}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F1F5F9]">
                  <div>
                    <p className="text-xs text-[#64748B]">Disponible actual</p>
                    <p className="font-mono-num text-lg font-bold text-[#0F2942]">
                      {formatNumber(selectedProduct.stock_actual)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Stock resultante</p>
                    <p
                      className={`font-mono-num text-lg font-bold ${
                        remainingStock < 0
                          ? 'text-[#DC2626]'
                          : remainingStock === 0
                          ? 'text-[#DC2626]'
                          : remainingStock <= selectedProduct.stock_minimo
                          ? 'text-[#B45309]'
                          : 'text-[#16A34A]'
                      }`}
                    >
                      {formatNumber(remainingStock)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F1F5F9] text-xs text-[#64748B]">
                  Stock mínimo configurado:{' '}
                  <span className="font-mono-num font-semibold text-[#0F2942]">
                    {formatNumber(selectedProduct.stock_minimo)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
