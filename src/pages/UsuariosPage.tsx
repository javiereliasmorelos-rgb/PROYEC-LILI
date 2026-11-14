import { useEffect, useState, FormEvent } from 'react';
import { Plus, Pencil, Users, AlertCircle } from 'lucide-react';
import { apiRequest, formatDate } from '../lib/api';
import { FlashType, User, UserRole } from '../types';
import Modal from '../components/Modal';

interface UsuariosPageProps {
  currentUser: User;
  onFlash: (type: FlashType, text: string) => void;
}

export default function UsuariosPage({ currentUser, onFlash }: UsuariosPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UserRole>('empleado');
  const [activo, setActivo] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await apiRequest<{ users: User[] }>('/api/users');
      setUsers(res.users);
    } catch (err) {
      onFlash('error', err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setModalError('');
    setNombre('');
    setCorreo('');
    setPassword('');
    setRol('empleado');
    setActivo(true);
    setFormOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setModalError('');
    setNombre(u.nombre);
    setCorreo(u.correo);
    setPassword('');
    setRol(u.rol);
    setActivo(u.activo);
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setModalError('');
    if (!nombre.trim() || !correo.trim() || (!editing && password.length < 6)) {
      setModalError('Verifica el nombre, correo y una contraseña de al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        const res = await apiRequest<{ message: string }>(`/api/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nombre: nombre.trim(),
            correo: correo.trim(),
            rol,
            activo,
            password: password || undefined,
          }),
        });
        onFlash('success', res.message);
      } else {
        const res = await apiRequest<{ message: string }>('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            nombre: nombre.trim(),
            correo: correo.trim(),
            password,
            rol,
          }),
        });
        onFlash('success', res.message);
      }
      setFormOpen(false);
      await loadUsers();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No fue posible completar la operación');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942] tracking-tight">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Registro controlado por administrador y asignación de roles de acceso
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-10 px-4 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar usuario</span>
        </button>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F8FAFC] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <p className="text-sm text-[#64748B]">Sin usuarios registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Nombre</th>
                  <th className="py-3 px-4">Correo electrónico</th>
                  <th className="py-3 px-4">Rol</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Fecha de creación</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] text-sm">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-4 font-mono-num text-xs text-[#64748B]">#{u.id}</td>
                    <td className="py-3 px-4 font-semibold text-[#0F2942]">
                      {u.nombre}
                      {u.id === currentUser.id && (
                        <span className="ml-2 text-xs font-normal text-[#2563EB]">(Sesión actual)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#43474D]">{u.correo}</td>
                    <td className="py-3 px-4 font-medium text-[#0F2942]">
                      {u.rol === 'administrador' ? 'Administrador' : 'Empleado'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span className={u.activo ? 'text-[#16A34A]' : 'text-[#DC2626]'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-num text-xs text-[#64748B]">
                      {formatDate(u.fecha_creacion)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        title="Editar usuario"
                        className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F2942] hover:bg-[#F1F5F9] cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
        title={editing ? 'Editar usuario' : 'Registrar nuevo usuario'}
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
            <label className="block text-sm font-medium text-[#1E293B] mb-1">
              Nombre completo *
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Laura Martínez"
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
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
              placeholder="usuario@empresa.com"
              className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">
                {editing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}
              </label>
              <input
                type="password"
                required={!editing}
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] text-sm focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1">Rol *</label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as UserRole)}
                className="w-full h-10 px-3 rounded-lg border border-[#CBD5E1] bg-white text-sm focus:outline-none focus:border-[#2563EB]"
              >
                <option value="empleado">Empleado</option>
                <option value="administrador">Administrador</option>
              </select>
            </div>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-[#1E293B]">
              <input
                type="checkbox"
                checked={activo}
                disabled={editing.id === currentUser.id}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4 h-4 rounded border-[#CBD5E1]"
              />
              <span>Cuenta activa (habilitada para iniciar sesión)</span>
            </label>
          )}

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
              {submitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
