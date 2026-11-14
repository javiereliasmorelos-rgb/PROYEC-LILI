import { useEffect, useState, FormEvent } from 'react';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Package,
  AlertCircle,
  Database,
} from 'lucide-react';
import { apiRequest, formatCurrency, formatDate, formatDateTime, formatNumber } from '../lib/api';
import { Categoria, FlashType, Movimiento, Producto, Proveedor, User } from '../types';
import Modal from '../components/Modal';
import { StockStatusLabel } from '../components/StockStatusText';

interface ProductosPageProps {
  user: User;
  onFlash: (type: FlashType, text: string) => void;
  onInventoryMutated: () => void;
  openCreateTrigger?: number;
}

export default function ProductosPage({
  user,
  onFlash,
  onInventoryMutated,
  openCreateTrigger = 0,
}: ProductosPageProps) {
  const isAdmin = user.rol === 'administrador';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [proveedorFilter, setProveedorFilter] = useState('');
  const [disponibilidad, setDisponibilidad] = useState('todos');
  const [sortBy, setSortBy] = useState('fecha_creacion');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [detailMovements, setDetailMovements] = useState<Movimiento[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Producto | null>(null);
  const [modalError, setModalError] = useState('');
  const [seedingCatalog, setSeedingCatalog] = useState(false);

  // Form state
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockActual, setStockActual] = useState('0');
  const [stockMinimo, setStockMinimo] = useState('5');
  const [activo, setActivo] = useState(true);

  // Inline quick-create states inside Product Modal
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatNombre, setQuickCatNombre] = useState('');
  const [quickCatDesc, setQuickCatDesc] = useState('');
  const [savingQuickCat, setSavingQuickCat] = useState(false);

  const [showQuickProv, setShowQuickProv] = useState(false);
  const [quickProvEmpresa, setQuickProvEmpresa] = useState('');
  const [quickProvNit, setQuickProvNit] = useState('');
  const [quickProvContacto, setQuickProvContacto] = useState('');
  const [quickProvTelefono, setQuickProvTelefono] = useState('');
  const [quickProvCorreo, setQuickProvCorreo] = useState('');
  const [savingQuickProv, setSavingQuickProv] = useState(false);

  async function loadMetadata(): Promise<{ cats: Categoria[]; provs: Proveedor[] }> {
    try {
      const [catRes, provRes] = await Promise.all([
        apiRequest<{ categorias: Categoria[] }>('/api/categorias'),
        apiRequest<{ proveedores: Proveedor[] }>('/api/proveedores'),
      ]);
      setCategorias(catRes.categorias);
      setProveedores(provRes.proveedores);
      return { cats: catRes.categorias, provs: provRes.proveedores };
    } catch {
      return { cats: categorias, provs: proveedores };
    }
  }

  async function loadProducts(targetPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: '10',
        sortBy,
        sortDir,
        disponibilidad,
      });
      if (search.trim()) params.set('search', search.trim());
      if (categoriaFilter) params.set('categoriaId', categoriaFilter);
      if (proveedorFilter) params.set('proveedorId', proveedorFilter);

      const res = await apiRequest<{
        productos: Producto[];
        pagination: { total: number; page: number; totalPages: number };
      }>(`/api/productos?${params.toString()}`);

      setProductos(res.productos);
      setTotalRecords(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible cargar los productos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(1);
    }, 180);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoriaFilter, proveedorFilter, disponibilidad, sortBy, sortDir]);

  useEffect(() => {
    if (openCreateTrigger > 0 && isAdmin) {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateTrigger]);

  async function openCreateModal() {
    setEditingProduct(null);
    setModalError('');
    setCodigo('');
    setNombre('');
    setDescripcion('');
    setPrecioCompra('');
    setPrecioVenta('');
    setStockActual('0');
    setStockMinimo('5');
    setActivo(true);
    setFormOpen(true);

    const { cats, provs } = await loadMetadata();
    setCategoriaId(cats[0] ? String(cats[0].id) : '');
    const activeProv = provs.find((p) => p.activo) || provs[0];
    setProveedorId(activeProv ? String(activeProv.id) : '');
    setShowQuickCat(cats.length === 0);
    setShowQuickProv(provs.length === 0);
  }

  async function handleSeedCatalog() {
    setSeedingCatalog(true);
    try {
      const res = await apiRequest<{ message: string }>('/api/productos/inicializar-catalogo', {
        method: 'POST',
      });
      onFlash('success', res.message);
      await Promise.all([loadMetadata(), loadProducts(1)]);
      onInventoryMutated();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible cargar el catálogo inicial');
    } finally {
      setSeedingCatalog(false);
    }
  }

  async function handleQuickCreateCategoria() {
    setModalError('');
    if (!quickCatNombre.trim()) {
      setModalError('Ingresa el nombre de la categoría para crearla.');
      return;
    }
    setSavingQuickCat(true);
    try {
      const res = await apiRequest<{ categoria: Categoria; message: string }>('/api/categorias', {
        method: 'POST',
        body: JSON.stringify({
          nombre: quickCatNombre.trim(),
          descripcion: quickCatDesc.trim(),
        }),
      });
      await loadMetadata();
      setCategoriaId(String(res.categoria.id));
      setQuickCatNombre('');
      setQuickCatDesc('');
      setShowQuickCat(false);
      onFlash('success', res.message);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No fue posible crear la categoría');
    } finally {
      setSavingQuickCat(false);
    }
  }

  async function handleQuickCreateProveedor() {
    setModalError('');
    if (
      !quickProvEmpresa.trim() ||
      !quickProvNit.trim() ||
      !quickProvContacto.trim() ||
      !quickProvTelefono.trim() ||
      !quickProvCorreo.trim()
    ) {
      setModalError('Completa todos los campos obligatorios (*) del nuevo proveedor.');
      return;
    }
    setSavingQuickProv(true);
    try {
      const res = await apiRequest<{ proveedor: Proveedor; message: string }>('/api/proveedores', {
        method: 'POST',
        body: JSON.stringify({
          nombre_empresa: quickProvEmpresa.trim(),
          identificacion: quickProvNit.trim(),
          contacto: quickProvContacto.trim(),
          telefono: quickProvTelefono.trim(),
          correo: quickProvCorreo.trim(),
        }),
      });
      await loadMetadata();
      setProveedorId(String(res.proveedor.id));
      setQuickProvEmpresa('');
      setQuickProvNit('');
      setQuickProvContacto('');
      setQuickProvTelefono('');
      setQuickProvCorreo('');
      setShowQuickProv(false);
      onFlash('success', res.message);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No fue posible registrar el proveedor');
    } finally {
      setSavingQuickProv(false);
    }
  }

  async function openEditModal(prod: Producto) {
    setEditingProduct(prod);
    setModalError('');
    setShowQuickCat(false);
    setShowQuickProv(false);
    setCodigo(prod.codigo);
    setNombre(prod.nombre);
    setDescripcion(prod.descripcion || '');
    setCategoriaId(String(prod.categoria_id));
    setProveedorId(String(prod.proveedor_id));
    setPrecioCompra(String(prod.precio_compra));
    setPrecioVenta(String(prod.precio_venta));
    setStockActual(String(prod.stock_actual));
    setStockMinimo(String(prod.stock_minimo));
    setActivo(prod.activo);
    setFormOpen(true);
    await loadMetadata();
  }

  async function openDetailModal(prod: Producto) {
    setDetailProduct(prod);
    setDetailMovements([]);
    setDetailLoading(true);
    try {
      const res = await apiRequest<{ producto: Producto; movimientos: Movimiento[] }>(
        `/api/productos/${prod.id}`
      );
      setDetailProduct(res.producto);
      setDetailMovements(res.movimientos);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible consultar el detalle');
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    setModalError('');

    if (!categoriaId || !proveedorId) {
      setModalError('Debes seleccionar o crear una categoría y un proveedor principal antes de guardar.');
      return;
    }

    const pCompra = Number(precioCompra);
    const pVenta = Number(precioVenta);
    const sActual = Number(stockActual);
    const sMinimo = Number(stockMinimo);

    if (
      !codigo.trim() ||
      !nombre.trim() ||
      Number.isNaN(pCompra) ||
      Number.isNaN(pVenta) ||
      pCompra < 0 ||
      pVenta < 0 ||
      sMinimo < 0 ||
      (!editingProduct && sActual < 0)
    ) {
      setModalError('Verifica que el código, nombre, precios y cantidades sean válidos y no negativos.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        const res = await apiRequest<{ message: string }>(`/api/productos/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            categoria_id: Number(categoriaId),
            proveedor_id: Number(proveedorId),
            precio_compra: pCompra,
            precio_venta: pVenta,
            stock_minimo: sMinimo,
            activo,
          }),
        });
        onFlash('success', res.message || 'Inventario actualizado');
      } else {
        const res = await apiRequest<{ message: string }>('/api/productos', {
          method: 'POST',
          body: JSON.stringify({
            codigo: codigo.trim(),
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            categoria_id: Number(categoriaId),
            proveedor_id: Number(proveedorId),
            precio_compra: pCompra,
            precio_venta: pVenta,
            stock_actual: sActual,
            stock_minimo: sMinimo,
          }),
        });
        onFlash('success', res.message || 'Producto registrado correctamente');
      }

      setFormOpen(false);
      await loadProducts(page);
      onInventoryMutated();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ deactivated: boolean; message: string }>(
        `/api/productos/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      onFlash(res.deactivated ? 'warning' : 'success', res.message);
      setDeleteTarget(null);
      await loadProducts(page);
      onInventoryMutated();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(prod: Producto) {
    try {
      await apiRequest(`/api/productos/${prod.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          codigo: prod.codigo,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          categoria_id: prod.categoria_id,
          proveedor_id: prod.proveedor_id,
          precio_compra: Number(prod.precio_compra),
          precio_venta: Number(prod.precio_venta),
          stock_minimo: prod.stock_minimo,
          activo: true,
        }),
      });
      onFlash('success', 'Inventario actualizado');
      await loadProducts(page);
      onInventoryMutated();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
    }
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Gestión de Productos
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Catálogo maestro de artículos, precios y niveles de existencias ({formatNumber(totalRecords)} registros)
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={openCreateModal}
            className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar producto</span>
          </button>
        )}
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            aria-label="Filtrar por categoría"
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <select
            value={proveedorFilter}
            onChange={(e) => setProveedorFilter(e.target.value)}
            aria-label="Filtrar por proveedor"
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre_empresa}
              </option>
            ))}
          </select>

          <select
            value={disponibilidad}
            onChange={(e) => setDisponibilidad(e.target.value)}
            aria-label="Filtrar por disponibilidad"
            className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] focus:outline-none focus:border-[#2563EB]"
          >
            <option value="todos">Todos los estados</option>
            <option value="activos">Solo activos</option>
            <option value="disponible">Disponible (sobre mínimo)</option>
            <option value="stock_bajo">Stock bajo</option>
            <option value="agotado">Agotado (stock 0)</option>
            <option value="inactivos">Desactivados</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            {search.trim() || categoriaFilter || proveedorFilter || disponibilidad !== 'todos' ? (
              <>
                <h3 className="font-display text-base font-semibold text-[#0F2942]">
                  No hay productos que coincidan con los filtros
                </h3>
                <p className="text-sm text-[#64748B] mt-1 max-w-md mx-auto">
                  Ajusta o limpia los filtros aplicados para ver los productos disponibles en inventario.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategoriaFilter('');
                    setProveedorFilter('');
                    setDisponibilidad('todos');
                  }}
                  className="mt-4 h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-sm font-medium text-[#0F2942] inline-flex items-center gap-2 cursor-pointer"
                >
                  Limpiar filtros
                </button>
              </>
            ) : (
              <>
                <h3 className="font-display text-base font-semibold text-[#0F2942]">
                  Aún no hay productos registrados en el inventario
                </h3>
                <p className="text-sm text-[#64748B] mt-1 max-w-lg mx-auto">
                  {isAdmin
                    ? 'Tu base de datos PostgreSQL está lista. Registra tu primer producto manualmente o carga un catálogo inicial para comenzar a operar de inmediato.'
                    : 'Solicita a un administrador registrar productos en el catálogo para consultar existencias o registrar movimientos.'}
                </p>
                {isAdmin && (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar primer producto</span>
                    </button>
                    <button
                      type="button"
                      disabled={seedingCatalog}
                      onClick={handleSeedCatalog}
                      className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] disabled:opacity-60 text-[#0F2942] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Database className="w-4 h-4 text-[#2563EB]" />
                      <span>
                        {seedingCatalog
                          ? 'Cargando catálogo en PostgreSQL...'
                          : 'Cargar catálogo inicial de ejemplo'}
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('codigo')}
                        className="inline-flex items-center gap-1 hover:text-[#0F2942] cursor-pointer"
                      >
                        <span>Código</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => toggleSort('nombre')}
                        className="inline-flex items-center gap-1 hover:text-[#0F2942] cursor-pointer"
                      >
                        <span>Producto</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Categoría / Proveedor</th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('precio_compra')}
                        className="inline-flex items-center gap-1 hover:text-[#0F2942] cursor-pointer"
                      >
                        <span>P. Compra</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('precio_venta')}
                        className="inline-flex items-center gap-1 hover:text-[#0F2942] cursor-pointer"
                      >
                        <span>P. Venta</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => toggleSort('stock_actual')}
                        className="inline-flex items-center gap-1 hover:text-[#0F2942] cursor-pointer"
                      >
                        <span>Stock</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </button>
                    </th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-sm">
                  {productos.map((prod) => (
                    <tr
                      key={prod.id}
                      className={`hover:bg-[#F8FAFC] transition-colors ${
                        !prod.activo ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono-num text-xs font-semibold text-[#0F2942] whitespace-nowrap">
                        {prod.codigo}
                      </td>
                      <td className="py-3 px-4 min-w-[200px]">
                        <p className="font-medium text-[#0F2942]">{prod.nombre}</p>
                        {prod.descripcion && (
                          <p className="text-xs text-[#64748B] truncate max-w-[260px]">
                            {prod.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#43474D]">
                        <p className="font-medium text-[#0F2942]">{prod.categoria_nombre}</p>
                        <p className="text-[#64748B]">{prod.proveedor_nombre}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num text-[#43474D] whitespace-nowrap">
                        {formatCurrency(prod.precio_compra)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num font-medium text-[#0F2942] whitespace-nowrap">
                        {formatCurrency(prod.precio_venta)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-num whitespace-nowrap">
                        <span className="font-semibold text-[#0F2942]">
                          {formatNumber(prod.stock_actual)}
                        </span>
                        <span className="text-xs text-[#64748B] block">
                          Mín: {formatNumber(prod.stock_minimo)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StockStatusLabel status={prod.estado_stock} activo={prod.activo} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetailModal(prod)}
                            title="Consultar detalle"
                            aria-label={`Consultar ${prod.nombre}`}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF4FF] transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(prod)}
                                title="Editar producto"
                                aria-label={`Editar ${prod.nombre}`}
                                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F2942] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              {prod.activo ? (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(prod)}
                                  title="Eliminar o desactivar producto"
                                  aria-label={`Eliminar ${prod.nombre}`}
                                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleReactivate(prod)}
                                  title="Reactivar producto"
                                  aria-label={`Reactivar ${prod.nombre}`}
                                  className="p-1.5 rounded-lg text-[#16A34A] hover:bg-emerald-50 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs text-[#64748B]">
              <span className="font-mono-num">
                Página {page} de {totalPages} · {formatNumber(totalRecords)} productos
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => loadProducts(page - 1)}
                  className="h-8 px-2.5 rounded-md border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] disabled:opacity-40 inline-flex items-center gap-1 text-[#0F2942] font-medium cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => loadProducts(page + 1)}
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

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingProduct ? 'Editar producto' : 'Registrar nuevo producto'}
        subtitle={
          editingProduct
            ? `Código actual: ${editingProduct.codigo}`
            : 'Los cambios de stock posteriores se realizan mediante Entradas y Salidas.'
        }
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {modalError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Código único *
              </label>
              <input
                type="text"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej. PRD-001"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num uppercase focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Nombre del producto *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Monitor LED 24 pulgadas"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Descripción
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Especificaciones técnicas, presentación o unidad de medida..."
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-[#1E293B]">
                  Categoría *
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowQuickCat((v) => !v)}
                    className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    {showQuickCat ? 'Cancelar' : '+ Nueva categoría'}
                  </button>
                )}
              </div>
              <select
                required
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm bg-white focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">
                  {categorias.length === 0 ? 'Sin categorías — crea una nueva' : 'Selecciona una categoría'}
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              {showQuickCat && (
                <div className="mt-2.5 p-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] space-y-2">
                  <p className="text-xs font-semibold text-[#0F2942]">Crear categoría rápida</p>
                  <input
                    type="text"
                    value={quickCatNombre}
                    onChange={(e) => setQuickCatNombre(e.target.value)}
                    placeholder="Nombre de categoría *"
                    className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs focus:outline-none focus:border-[#2563EB]"
                  />
                  <input
                    type="text"
                    value={quickCatDesc}
                    onChange={(e) => setQuickCatDesc(e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs focus:outline-none focus:border-[#2563EB]"
                  />
                  <button
                    type="button"
                    disabled={savingQuickCat}
                    onClick={handleQuickCreateCategoria}
                    className="h-8 px-3 rounded-md bg-[#142B4A] hover:bg-[#0F2942] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingQuickCat ? 'Guardando...' : 'Guardar categoría'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-[#1E293B]">
                  Proveedor principal *
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowQuickProv((v) => !v)}
                    className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                  >
                    {showQuickProv ? 'Cancelar' : '+ Nuevo proveedor'}
                  </button>
                )}
              </div>
              <select
                required
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm bg-white focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">
                  {proveedores.length === 0 ? 'Sin proveedores — crea uno nuevo' : 'Selecciona un proveedor'}
                </option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_empresa}
                    {!p.activo ? ' (Inactivo)' : ''}
                  </option>
                ))}
              </select>

              {showQuickProv && (
                <div className="mt-2.5 p-3 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] space-y-2">
                  <p className="text-xs font-semibold text-[#0F2942]">Registrar proveedor rápido</p>
                  <input
                    type="text"
                    value={quickProvEmpresa}
                    onChange={(e) => setQuickProvEmpresa(e.target.value)}
                    placeholder="Nombre de empresa *"
                    className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs focus:outline-none focus:border-[#2563EB]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickProvNit}
                      onChange={(e) => setQuickProvNit(e.target.value)}
                      placeholder="NIT / ID *"
                      className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs font-mono-num focus:outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="text"
                      value={quickProvContacto}
                      onChange={(e) => setQuickProvContacto(e.target.value)}
                      placeholder="Contacto *"
                      className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={quickProvTelefono}
                      onChange={(e) => setQuickProvTelefono(e.target.value)}
                      placeholder="Teléfono *"
                      className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs font-mono-num focus:outline-none focus:border-[#2563EB]"
                    />
                    <input
                      type="email"
                      value={quickProvCorreo}
                      onChange={(e) => setQuickProvCorreo(e.target.value)}
                      placeholder="Correo *"
                      className="w-full h-9 px-2.5 rounded-md border border-[#CBD5E1] bg-white text-xs focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={savingQuickProv}
                    onClick={handleQuickCreateProveedor}
                    className="h-8 px-3 rounded-md bg-[#142B4A] hover:bg-[#0F2942] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {savingQuickProv ? 'Guardando...' : 'Guardar proveedor'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Precio compra *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={precioCompra}
                onChange={(e) => setPrecioCompra(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Precio venta *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={precioVenta}
                onChange={(e) => setPrecioVenta(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                {editingProduct ? 'Stock actual' : 'Stock inicial *'}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                disabled={Boolean(editingProduct)}
                value={stockActual}
                onChange={(e) => setStockActual(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num disabled:bg-[#F8FAFC] disabled:text-[#64748B] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Stock mínimo *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          {editingProduct && (
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 rounded border-[#CBD5E1]"
              />
              <span>Producto activo en catálogo operativo</span>
            </label>
          )}

          <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-sm font-medium text-[#1E293B] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {submitting ? 'Guardando...' : editingProduct ? 'Guardar cambios' : 'Registrar producto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={Boolean(detailProduct)}
        onClose={() => setDetailProduct(null)}
        title={detailProduct ? detailProduct.nombre : 'Detalle de producto'}
        subtitle={detailProduct ? `Código ${detailProduct.codigo} · Registrado el ${formatDate(detailProduct.fecha_creacion)}` : ''}
      >
        {detailProduct && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#64748B]">Categoría</p>
                <p className="font-medium text-[#0F2942] mt-0.5">{detailProduct.categoria_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">Proveedor</p>
                <p className="font-medium text-[#0F2942] mt-0.5">{detailProduct.proveedor_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">Estado</p>
                <div className="mt-0.5">
                  <StockStatusLabel status={detailProduct.estado_stock} activo={detailProduct.activo} />
                </div>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">Precio de compra</p>
                <p className="font-mono-num font-semibold text-[#0F2942] mt-0.5">
                  {formatCurrency(detailProduct.precio_compra)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">Precio de venta</p>
                <p className="font-mono-num font-semibold text-[#0F2942] mt-0.5">
                  {formatCurrency(detailProduct.precio_venta)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#64748B]">Stock actual / mínimo</p>
                <p className="font-mono-num font-semibold text-[#0F2942] mt-0.5">
                  {formatNumber(detailProduct.stock_actual)} / {formatNumber(detailProduct.stock_minimo)}
                </p>
              </div>
            </div>

            {detailProduct.descripcion && (
              <div className="pt-3 border-t border-[#E2E8F0]">
                <p className="text-xs text-[#64748B]">Descripción</p>
                <p className="text-sm text-[#1E293B] mt-1">{detailProduct.descripcion}</p>
              </div>
            )}

            <div className="pt-3 border-t border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#0F2942] mb-2.5">
                Últimos movimientos del producto
              </h3>
              {detailLoading ? (
                <p className="text-xs text-[#64748B]">Cargando historial...</p>
              ) : detailMovements.length === 0 ? (
                <p className="text-xs text-[#64748B]">
                  Este producto aún no registra entradas ni salidas históricas.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B]">
                        <th className="py-2 px-3">Tipo</th>
                        <th className="py-2 px-3 text-right">Cantidad</th>
                        <th className="py-2 px-3 text-right">Stock final</th>
                        <th className="py-2 px-3">Usuario</th>
                        <th className="py-2 px-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {detailMovements.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2 px-3 font-semibold">
                            <span className={m.tipo_movimiento === 'entrada' ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                              {m.tipo_movimiento === 'entrada' ? 'Entrada' : 'Salida'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono-num font-semibold">
                            {m.tipo_movimiento === 'entrada' ? '+' : '-'}
                            {m.cantidad}
                          </td>
                          <td className="py-2 px-3 text-right font-mono-num">{m.stock_resultante}</td>
                          <td className="py-2 px-3">{m.usuario_nombre}</td>
                          <td className="py-2 px-3 font-mono-num text-[#64748B]">
                            {formatDateTime(m.fecha_movimiento)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete / Deactivate Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar operación"
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#1E293B] leading-relaxed">
              {(deleteTarget.total_movimientos || 0) > 0 ? (
                <>
                  El producto <strong>{deleteTarget.nombre}</strong> ({deleteTarget.codigo}) tiene{' '}
                  <strong>{deleteTarget.total_movimientos} movimientos históricos</strong> asociados. Para preservar la integridad contable, el sistema lo <strong>desactivará de forma segura</strong> en lugar de borrarlo.
                </>
              ) : (
                <>
                  ¿Deseas eliminar permanentemente el producto <strong>{deleteTarget.nombre}</strong> ({deleteTarget.codigo})? Esta acción no se puede deshacer.
                </>
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white text-sm font-medium text-[#1E293B] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmDelete}
                className="h-10 px-4 rounded-lg bg-[#DC2626] hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
              >
                {submitting
                  ? 'Procesando...'
                  : (deleteTarget.total_movimientos || 0) > 0
                  ? 'Desactivar producto'
                  : 'Eliminar producto'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
