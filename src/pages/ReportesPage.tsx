import { useEffect, useState } from 'react';
import { FileBarChart2, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { apiRequest, formatCurrency, formatDateTime, formatNumber } from '../lib/api';
import { Categoria, FlashType, Producto } from '../types';

interface ReportesPageProps {
  onFlash: (type: FlashType, text: string) => void;
}

const REPORT_TYPES = [
  { id: 'inventario_general', label: 'Inventario general' },
  { id: 'productos_disponibles', label: 'Productos disponibles' },
  { id: 'productos_agotados', label: 'Productos agotados' },
  { id: 'productos_stock_bajo', label: 'Productos con stock bajo' },
  { id: 'entradas_mercancia', label: 'Entradas de mercancía' },
  { id: 'salidas_mercancia', label: 'Salidas de mercancía' },
  { id: 'movimientos_periodo', label: 'Movimientos por periodo' },
  { id: 'valor_inventario', label: 'Valor total del inventario' },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]['id'];

export default function ReportesPage({ onFlash }: ReportesPageProps) {
  const [tipo, setTipo] = useState<ReportType>('inventario_general');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{
    modo: 'productos' | 'movimientos';
    generadoEn: string;
    resumen: Record<string, number>;
    rows: Array<Record<string, unknown>>;
  } | null>(null);

  async function loadOptions() {
    try {
      const [catRes, prodRes] = await Promise.all([
        apiRequest<{ categorias: Categoria[] }>('/api/categorias'),
        apiRequest<{ productos: Producto[] }>('/api/productos/catalogo'),
      ]);
      setCategorias(catRes.categorias);
      setProductos(prodRes.productos);
    } catch {
      // handled gracefully
    }
  }

  async function generateReport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tipo });
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      if (categoriaId) params.set('categoriaId', categoriaId);
      if (productoId) params.set('productoId', productoId);
      if (tipoMovimiento) params.set('tipoMovimiento', tipoMovimiento);

      const res = await apiRequest<{
        modo: 'productos' | 'movimientos';
        generadoEn: string;
        resumen: Record<string, number>;
        rows: Array<Record<string, unknown>>;
      }>(`/api/reportes?${params.toString()}`);

      setReportData(res);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    generateReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, fechaInicio, fechaFin, categoriaId, productoId, tipoMovimiento]);

  const reportTitle = REPORT_TYPES.find((r) => r.id === tipo)?.label || 'Reporte';

  function exportToPdf() {
    if (!reportData || reportData.rows.length === 0) {
      onFlash('warning', 'No hay registros en el reporte actual para exportar');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(16);
    doc.setTextColor(20, 43, 74);
    doc.text(`INVENTPRO — ${reportTitle}`, 40, 42);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Generado el ${formatDateTime(reportData.generadoEn)} · Registros: ${reportData.resumen.totalRegistros}`,
      40,
      58
    );

    if (reportData.modo === 'productos') {
      autoTable(doc, {
        startY: 74,
        head: [
          [
            'Código',
            'Producto',
            'Categoría',
            'Proveedor',
            'Stock',
            'Mínimo',
            'P. Compra',
            'Valor Compra',
            'Estado',
          ],
        ],
        body: reportData.rows.map((r) => [
          String(r.codigo),
          String(r.nombre),
          String(r.categoria_nombre),
          String(r.proveedor_nombre),
          String(r.stock_actual),
          String(r.stock_minimo),
          formatCurrency(Number(r.precio_compra)),
          formatCurrency(Number(r.valor_compra)),
          String(r.estado_stock),
        ]),
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [20, 43, 74], textColor: 255 },
      });
    } else {
      autoTable(doc, {
        startY: 74,
        head: [
          [
            'ID',
            'Fecha',
            'Código',
            'Producto',
            'Tipo',
            'Cant.',
            'Ant. / Final',
            'Valor Total',
            'Responsable',
            'Referencia',
          ],
        ],
        body: reportData.rows.map((r) => [
          `#${r.id}`,
          formatDateTime(String(r.fecha_movimiento)),
          String(r.producto_codigo),
          String(r.producto_nombre),
          String(r.tipo_movimiento).toUpperCase(),
          String(r.cantidad),
          `${r.stock_anterior} -> ${r.stock_resultante}`,
          formatCurrency(Number(r.valor_total)),
          String(r.usuario_nombre),
          String(r.referencia),
        ]),
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: { fillColor: [20, 43, 74], textColor: 255 },
      });
    }

    doc.save(`inventpro_${tipo}_${new Date().toISOString().slice(0, 10)}.pdf`);
    onFlash('success', 'Reporte PDF exportado correctamente');
  }

  function exportToExcel() {
    if (!reportData || reportData.rows.length === 0) {
      onFlash('warning', 'No hay registros en el reporte actual para exportar');
      return;
    }

    const formattedRows =
      reportData.modo === 'productos'
        ? reportData.rows.map((r) => ({
            Código: r.codigo,
            Producto: r.nombre,
            Categoría: r.categoria_nombre,
            Proveedor: r.proveedor_nombre,
            'Stock Actual': Number(r.stock_actual),
            'Stock Mínimo': Number(r.stock_minimo),
            'Precio Compra': Number(r.precio_compra),
            'Precio Venta': Number(r.precio_venta),
            'Valor Compra': Number(r.valor_compra),
            'Valor Venta': Number(r.valor_venta),
            Estado: r.estado_stock,
          }))
        : reportData.rows.map((r) => ({
            ID: Number(r.id),
            Fecha: formatDateTime(String(r.fecha_movimiento)),
            Código: r.producto_codigo,
            Producto: r.producto_nombre,
            Categoría: r.categoria_nombre,
            Tipo: r.tipo_movimiento,
            Cantidad: Number(r.cantidad),
            'Stock Anterior': Number(r.stock_anterior),
            'Stock Resultante': Number(r.stock_resultante),
            'Precio Unitario': Number(r.precio_unitario),
            'Valor Total': Number(r.valor_total),
            Proveedor: r.proveedor_nombre,
            Referencia: r.referencia,
            Responsable: r.usuario_nombre,
          }));

    const ws = XLSX.utils.json_to_sheet(formattedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `inventpro_${tipo}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onFlash('success', 'Reporte Excel (.xlsx) exportado correctamente');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Reportes Empresariales
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Informes dinámicos desde PostgreSQL con exportación oficial a PDF y Excel
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportToPdf}
            className="h-10 px-4 rounded-lg bg-[#142B4A] hover:bg-[#0F2942] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            className="h-10 px-4 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Report Selector & Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => setTipo(rt.id)}
              className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tipo === rt.id
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-[#F8FAFC] border border-[#E2E8F0] text-[#43474D] hover:bg-[#EFF4FF]'
              }`}
            >
              {rt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-[#F1F5F9]">
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Fecha inicial</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Fecha final</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Categoría</label>
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">Producto</label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm"
            >
              <option value="">Todos</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.codigo}] {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">
              Tipo de movimiento
            </label>
            <select
              value={tipoMovimiento}
              onChange={(e) => setTipoMovimiento(e.target.value)}
              disabled={tipo !== 'movimientos_periodo'}
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
            >
              <option value="">Todos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Summary Strip */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#64748B] uppercase">Registros incluidos</p>
            <p className="font-display font-mono-num text-2xl font-bold text-[#0F2942] mt-1">
              {formatNumber(reportData.resumen.totalRegistros)}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#64748B] uppercase">Unidades totales</p>
            <p className="font-display font-mono-num text-2xl font-bold text-[#0F2942] mt-1">
              {formatNumber(reportData.resumen.totalUnidades)}
            </p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#64748B] uppercase">
              {reportData.modo === 'productos'
                ? 'Valorización total (compra)'
                : 'Valor total de movimientos'}
            </p>
            <p className="font-display font-mono-num text-2xl font-bold text-[#2563EB] mt-1">
              {formatCurrency(
                reportData.modo === 'productos'
                  ? reportData.resumen.totalValorCompra
                  : reportData.resumen.totalValor
              )}
            </p>
          </div>
        </div>
      )}

      {/* Report Data Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-[#2563EB]" />
            <h2 className="font-display text-sm font-semibold text-[#0F2942]">{reportTitle}</h2>
          </div>
          <button
            type="button"
            onClick={generateReport}
            className="text-xs font-medium text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !reportData || reportData.rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-[#0F2942]">
              No hay registros que coincidan con los filtros del reporte.
            </p>
          </div>
        ) : reportData.modo === 'productos' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4 text-right">Stock</th>
                  <th className="py-3 px-4 text-right">Mín.</th>
                  <th className="py-3 px-4 text-right">P. Compra</th>
                  <th className="py-3 px-4 text-right">Valor Compra</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {reportData.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-4 font-mono-num text-xs font-semibold text-[#0F2942]">
                      {String(r.codigo)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#0F2942]">{String(r.nombre)}</td>
                    <td className="py-2.5 px-4 text-xs text-[#43474D]">
                      {String(r.categoria_nombre)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#43474D]">
                      {String(r.proveedor_nombre)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                      {formatNumber(Number(r.stock_actual))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num text-[#64748B]">
                      {formatNumber(Number(r.stock_minimo))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {formatCurrency(Number(r.precio_compra))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-[#0F2942]">
                      {formatCurrency(Number(r.valor_compra))}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          r.estado_stock === 'Agotado'
                            ? 'text-[#DC2626]'
                            : r.estado_stock === 'Stock bajo'
                            ? 'text-[#B45309]'
                            : 'text-[#16A34A]'
                        }
                      >
                        {String(r.estado_stock)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Producto</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4 text-right">Cantidad</th>
                  <th className="py-3 px-4 text-right">Stock final</th>
                  <th className="py-3 px-4 text-right">Valor total</th>
                  <th className="py-3 px-4">Responsable</th>
                  <th className="py-3 px-4">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {reportData.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 px-4 font-mono-num text-xs text-[#64748B]">
                      #{String(r.id)}
                    </td>
                    <td className="py-2.5 px-4 font-mono-num text-xs text-[#43474D] whitespace-nowrap">
                      {formatDateTime(String(r.fecha_movimiento))}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-medium text-[#0F2942]">{String(r.producto_nombre)}</span>
                      <span className="block text-xs font-mono-num text-[#64748B]">
                        {String(r.producto_codigo)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          r.tipo_movimiento === 'entrada' ? 'text-[#16A34A]' : 'text-[#DC2626]'
                        }
                      >
                        {r.tipo_movimiento === 'entrada' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold">
                      {formatNumber(Number(r.cantidad))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num">
                      {formatNumber(Number(r.stock_resultante))}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-num font-semibold text-[#0F2942]">
                      {formatCurrency(Number(r.valor_total))}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#43474D]">
                      {String(r.usuario_nombre)}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-[#64748B]">{String(r.referencia)}</td>
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
