import { useEffect, useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, Tags, AlertCircle } from 'lucide-react';
import { apiRequest, formatDate, formatNumber } from '../lib/api';
import { Categoria, FlashType } from '../types';
import Modal from '../components/Modal';

interface CategoriasPageProps {
  onFlash: (type: FlashType, text: string) => void;
}

export default function CategoriasPage({ onFlash }: CategoriasPageProps) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Categoria | null>(null);
  const [modalError, setModalError] = useState('');

  async function loadCategorias() {
    setLoading(true);
    try {
      const res = await apiRequest<{ categorias: Categoria[] }>('/api/categorias');
      setCategorias(res.categorias);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setModalError('');
    setNombre('');
    setDescripcion('');
    setFormOpen(true);
  }

  function openEdit(cat: Categoria) {
    setEditing(cat);
    setModalError('');
    setNombre(cat.nombre);
    setDescripcion(cat.descripcion || '');
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    if (!nombre.trim()) {
      setModalError('Ingresa el nombre de la categoría.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const res = await apiRequest<{ message: string }>(`/api/categorias/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() }),
        });
        onFlash('success', res.message);
      } else {
        const res = await apiRequest<{ message: string }>('/api/categorias', {
          method: 'POST',
          body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim() }),
        });
        onFlash('success', res.message);
      }
      setFormOpen(false);
      await loadCategorias();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string }>(`/api/categorias/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      onFlash('success', res.message);
      setDeleteTarget(null);
      await loadCategorias();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
      setDeleteTarget(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Gestión de Categorías
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Clasificación organizacional de productos en inventario
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva categoría</span>
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : categorias.length === 0 ? (
          <div className="p-12 text-center">
            <Tags className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#0F2942]">
              No existen categorías registradas
            </h3>
            <p className="text-sm text-[#64748B] mt-1">
              Crea categorías para organizar tus productos y analizar la distribución del inventario.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear primera categoría</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Descripción</th>
                  <th className="py-3 px-4 text-right">Productos</th>
                  <th className="py-3 px-4 text-right">Unidades totales</th>
                  <th className="py-3 px-4">Fecha de creación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-sm">
                {categorias.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 px-4 font-mono-num text-xs text-[#64748B]">#{cat.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#0F2942]">{cat.nombre}</td>
                    <td className="py-3 px-4 text-[#43474D] max-w-md">
                      {cat.descripcion || <span className="text-[#94A3B8]">Sin descripción</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-medium text-[#0F2942]">
                      {formatNumber(cat.total_productos)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-[#43474D]">
                      {formatNumber(cat.stock_total)}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-[#64748B] whitespace-nowrap">
                      {formatDate(cat.fecha_creacion)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(cat)}
                          title="Editar categoría"
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F2942] hover:bg-[#F1F5F9] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          title="Eliminar categoría"
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar categoría' : 'Nueva categoría'}
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {modalError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{modalError}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Nombre *</label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Tecnología y Cómputo"
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Descripción</label>
            <textarea
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe los artículos agrupados en esta categoría..."
              className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>
          <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white text-sm font-medium text-[#1E293B] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {submitting ? 'Guardando...' : editing ? 'Actualizar' : 'Crear categoría'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar categoría"
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#1E293B]">
              {(deleteTarget.total_productos || 0) > 0 ? (
                <>
                  La categoría <strong>{deleteTarget.nombre}</strong> tiene{' '}
                  <strong>{deleteTarget.total_productos} productos asociados</strong> y no puede eliminarse hasta reasignar dichos productos.
                </>
              ) : (
                <>
                  ¿Confirmas eliminar la categoría <strong>{deleteTarget.nombre}</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-lg border border-[#CBD5E1] bg-white text-sm font-medium text-[#1E293B] cursor-pointer"
              >
                Cerrar
              </button>
              {(deleteTarget.total_productos || 0) === 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleDelete}
                  className="h-10 px-4 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
