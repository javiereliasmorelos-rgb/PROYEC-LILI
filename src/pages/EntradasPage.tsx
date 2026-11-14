import { useEffect, useState, FormEvent } from 'react';
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react';
import { apiRequest, formatCurrency, formatNumber } from '../lib/api';
import { FlashType, Producto, Proveedor, User } from '../types';

interface EntradasPageProps {
  user: User;
  preselectedProductId?: number | null;
  onFlash: (type: FlashType, text: string) => void;
  onInventoryMutated: () => void;
  onGoToProductos?: () => void;
}

export default function EntradasPage({
  user,
  preselectedProductId,
  onFlash,
  onInventoryMutated,
  onGoToProductos,
}: EntradasPageProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [productoId, setProductoId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioCompra, setPrecioCompra] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [numeroFactura, setNumeroFactura] = useState('');
  const [observaciones, setObservaciones] = useState('');

  async function loadCatalog() {
    setLoading(true);
    try {
      const [prodRes, provRes] = await Promise.all([
        apiRequest<{ productos: Producto[] }>('/api/productos/catalogo'),
        apiRequest<{ proveedores: Proveedor[] }>('/api/proveedores?activos=true'),
      ]);
      setProductos(prodRes.productos);
      setProveedores(provRes.proveedores);

      const initialProd =
        prodRes.productos.find((p) => p.id === preselectedProductId) || prodRes.productos[0];
      if (initialProd) {
        setProductoId(String(initialProd.id));
        setProveedorId(String(initialProd.proveedor_id));
        setPrecioCompra(String(initialProd.precio_compra));
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
  }, [preselectedProductId]);

  const selectedProduct = productos.find((p) => String(p.id) === productoId) || null;
  const qtyNum = Math.max(0, Number(cantidad) || 0);
  const projectedStock = selectedProduct ? selectedProduct.stock_actual + qtyNum : 0;

  function handleSelectProduct(id: string) {
    setProductoId(id);
    const prod = productos.find((p) => String(p.id) === id);
    if (prod) {
      setProveedorId(String(prod.proveedor_id));
      setPrecioCompra(String(prod.precio_compra));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productoId || !proveedorId || !Number.isInteger(Number(cantidad)) || Number(cantidad) <= 0 || Number(precioCompra) < 0) {
      onFlash('error', 'Verifica los datos ingresados');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/movimientos/entrada', {
        method: 'POST',
        body: JSON.stringify({
          producto_id: Number(productoId),
          proveedor_id: Number(proveedorId),
          cantidad: Number(cantidad),
          precio_compra: Number(precioCompra),
          fecha,
          numero_factura: numeroFactura.trim(),
          observaciones: observaciones.trim(),
        }),
      });

      onFlash('success', res.message || 'Entrada registrada correctamente');
      setCantidad('1');
      setNumeroFactura('');
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
          Entradas de Mercancía
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">
          Registra ingresos de inventario con actualización transaccional en PostgreSQL
        </p>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl h-80 animate-pulse" />
      ) : productos.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center">
          <p className="text-sm font-medium text-[#0F2942]">
            No hay productos activos disponibles para registrar entradas.
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {user.rol === 'administrador'
              ? 'Registra productos en el catálogo o carga el catálogo inicial para comenzar.'
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
                  onChange={(e) => handleSelectProduct(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo}] {p.nombre} — Stock actual: {p.stock_actual}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Proveedor *
                </label>
                <select
                  required
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="">Selecciona proveedor</option>
                  {proveedores.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nombre_empresa}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Número de factura
                </label>
                <input
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Ej. FAC-2026-0148"
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Cantidad recibida *
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
                  Precio unitario de compra *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={precioCompra}
                  onChange={(e) => setPrecioCompra(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1E293B] mb-1">
                  Fecha de ingreso *
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
                placeholder="Estado del embalaje, lote o comentarios de recepción..."
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>{submitting ? 'Registrando entrada...' : 'Confirmar entrada de mercancía'}</span>
              </button>
            </div>
          </form>

          {/* Live Summary Panel */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#16A34A]">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Resumen de operación
              </h2>
            </div>

            {selectedProduct && (
              <div className="space-y-3 text-sm pt-2 border-t border-[#F1F5F9]">
                <div>
                  <p className="text-xs text-[#64748B]">Artículo seleccionado</p>
                  <p className="font-semibold text-[#0F2942]">{selectedProduct.nombre}</p>
                  <p className="text-xs font-mono-num text-[#64748B]">{selectedProduct.codigo}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#F1F5F9]">
                  <div>
                    <p className="text-xs text-[#64748B]">Stock actual</p>
                    <p className="font-mono-num text-lg font-bold text-[#0F2942]">
                      {formatNumber(selectedProduct.stock_actual)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#64748B]">Stock proyectado</p>
                    <p className="font-mono-num text-lg font-bold text-[#16A34A]">
                      {formatNumber(projectedStock)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F1F5F9]">
                  <p className="text-xs text-[#64748B]">Costo total del ingreso</p>
                  <p className="font-mono-num text-xl font-bold text-[#0F2942] mt-0.5">
                    {formatCurrency(qtyNum * (Number(precioCompra) || 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
