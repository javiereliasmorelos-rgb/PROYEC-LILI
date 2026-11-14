import { useEffect, useState, FormEvent } from 'react';
import { Plus, Pencil, Trash2, Truck, RotateCcw, AlertCircle } from 'lucide-react';
import { apiRequest, formatNumber } from '../lib/api';
import { FlashType, Proveedor } from '../types';
import Modal from '../components/Modal';

interface ProveedoresPageProps {
  onFlash: (type: FlashType, text: string) => void;
}

export default function ProveedoresPage({ onFlash }: ProveedoresPageProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [contacto, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [observaciones, setObservaciones] = useState('');

  async function loadProveedores() {
    setLoading(true);
    try {
      const res = await apiRequest<{ proveedores: Proveedor[] }>('/api/proveedores');
      setProveedores(res.proveedores);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProveedores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setModalError('');
    setNombreEmpresa('');
    setIdentificacion('');
    setContacto('');
    setTelefono('');
    setCorreo('');
    setDireccion('');
    setCiudad('');
    setObservaciones('');
    setFormOpen(true);
  }

  function openEdit(prov: Proveedor) {
    setEditing(prov);
    setModalError('');
    setNombreEmpresa(prov.nombre_empresa);
    setIdentificacion(prov.identificacion);
    setContacto(prov.contacto);
    setTelefono(prov.telefono);
    setCorreo(prov.correo);
    setDireccion(prov.direccion || '');
    setCiudad(prov.ciudad || '');
    setObservaciones(prov.observaciones || '');
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    if (!nombreEmpresa.trim() || !identificacion.trim() || !contacto.trim() || !telefono.trim() || !correo.trim()) {
      setModalError('Completa todos los campos obligatorios (*) del proveedor.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        nombre_empresa: nombreEmpresa.trim(),
        identificacion: identificacion.trim(),
        contacto: contacto.trim(),
        telefono: telefono.trim(),
        correo: correo.trim(),
        direccion: direccion.trim(),
        ciudad: ciudad.trim(),
        observaciones: observaciones.trim(),
        activo: editing ? editing.activo : true,
      };

      if (editing) {
        const res = await apiRequest<{ message: string }>(`/api/proveedores/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onFlash('success', res.message);
      } else {
        const res = await apiRequest<{ message: string }>('/api/proveedores', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onFlash('success', res.message);
      }
      setFormOpen(false);
      await loadProveedores();
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
      const res = await apiRequest<{ deactivated: boolean; message: string }>(
        `/api/proveedores/${deleteTarget.id}`,
        { method: 'DELETE' }
      );
      onFlash(res.deactivated ? 'warning' : 'success', res.message);
      setDeleteTarget(null);
      await loadProveedores();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReactivate(prov: Proveedor) {
    try {
      await apiRequest(`/api/proveedores/${prov.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...prov, activo: true }),
      });
      onFlash('success', 'Proveedor reactivado correctamente');
      await loadProveedores();
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'No fue posible completar la operación');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Gestión de Proveedores
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Directorio de proveedores, datos fiscales y contacto comercial
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar proveedor</span>
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : proveedores.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#0F2942]">
              Aún no hay proveedores registrados
            </h3>
            <p className="text-sm text-[#64748B] mt-1">
              Registra tus proveedores para asociarlos a los productos y a las entradas de mercancía.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar primer proveedor</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">Empresa / NIT</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Teléfono / Correo</th>
                  <th className="py-3 px-4">Ciudad / Dirección</th>
                  <th className="py-3 px-4 text-right">Productos</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-sm">
                {proveedores.map((prov) => (
                  <tr
                    key={prov.id}
                    className={`hover:bg-[#F8FAFC] transition-colors ${
                      !prov.activo ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#0F2942]">{prov.nombre_empresa}</p>
                      <p className="text-xs font-mono-num text-[#64748B]">{prov.identificacion}</p>
                    </td>
                    <td className="py-3 px-4 text-[#1E293B]">{prov.contacto}</td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-mono-num text-[#0F2942]">{prov.telefono}</p>
                      <p className="text-[#64748B]">{prov.correo}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#43474D]">
                      <p className="font-medium text-[#0F2942]">{prov.ciudad || '—'}</p>
                      <p className="text-[#64748B] truncate max-w-[200px]">
                        {prov.direccion || 'Sin dirección'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-[#0F2942]">
                      {formatNumber(prov.total_productos)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span className={prov.activo ? 'text-[#16A34A]' : 'text-[#64748B]'}>
                        {prov.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(prov)}
                          title="Editar proveedor"
                          className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F2942] hover:bg-[#F1F5F9] cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {prov.activo ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(prov)}
                            title="Eliminar o desactivar proveedor"
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#DC2626] hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(prov)}
                            title="Reactivar proveedor"
                            className="p-1.5 rounded-lg text-[#16A34A] hover:bg-emerald-50 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
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
        title={editing ? 'Editar proveedor' : 'Registrar proveedor'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Nombre de empresa *
              </label>
              <input
                type="text"
                required
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
                placeholder="Ej. Distribuidora Andina S.A.S."
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Identificación / NIT *
              </label>
              <input
                type="text"
                required
                value={identificacion}
                onChange={(e) => setIdentificacion(e.target.value)}
                placeholder="Ej. 900.123.456-7"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Persona de contacto *
              </label>
              <input
                type="text"
                required
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                placeholder="Nombre completo"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Teléfono *
              </label>
              <input
                type="text"
                required
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+57 300 000 0000"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm font-mono-num focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                Correo electrónico *
              </label>
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ventas@proveedor.com"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">Ciudad</label>
              <input
                type="text"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="Bogotá / Medellín / Cali..."
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Dirección</label>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección física o bodega"
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1E293B] mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Condiciones de pago, tiempos de entrega o notas comerciales..."
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
              {submitting ? 'Guardando...' : editing ? 'Actualizar proveedor' : 'Registrar proveedor'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar operación"
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-[#1E293B] leading-relaxed">
              {(deleteTarget.total_productos || 0) > 0 || (deleteTarget.total_movimientos || 0) > 0 ? (
                <>
                  El proveedor <strong>{deleteTarget.nombre_empresa}</strong> tiene productos o movimientos históricos asociados. Se <strong>desactivará de forma segura</strong> para preservar la trazabilidad.
                </>
              ) : (
                <>
                  ¿Confirmas eliminar al proveedor <strong>{deleteTarget.nombre_empresa}</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-3">
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
                onClick={handleDelete}
                className="h-10 px-4 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                {(deleteTarget.total_productos || 0) > 0 || (deleteTarget.total_movimientos || 0) > 0
                  ? 'Desactivar proveedor'
                  : 'Eliminar proveedor'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
