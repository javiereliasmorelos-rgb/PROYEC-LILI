import { useState, FormEvent } from 'react';
import { Boxes, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { apiRequest, setAuthSession } from '../lib/api';
import { signInWithGoogle } from '../lib/firebaseAuth';
import { User } from '../types';

interface LoginViewProps {
  onSuccess: (user: User) => void;
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest<{ user: User; token: string; csrfToken: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ correo, password }),
        }
      );
      setAuthSession(data.token, data.csrfToken);
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);
    try {
      const { idToken, accessToken } = await signInWithGoogle();
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const data = await apiRequest<{ user: User; token: string; csrfToken: string }>(
        '/api/auth/google',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ idToken, accessToken }),
        }
      );
      setAuthSession(data.token, data.csrfToken);
      onSuccess(data.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Inicio de sesión con Google cancelado.');
      } else if (code === 'auth/popup-blocked') {
        setError('El navegador bloqueó la ventana emergente. Habilita las ventanas emergentes para continuar.');
      } else {
        setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión con Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  function fillInitialAdmin() {
    setCorreo('admin@inventpro.com');
    setPassword('InventPro2026!');
    setError('');
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col lg:flex-row">
      {/* Institutional left column */}
      <div className="lg:w-[44%] bg-[#142B4A] text-white px-8 py-12 lg:px-14 lg:py-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight">INVENTPRO</span>
          </div>

          <div className="mt-12 lg:mt-20 max-w-md">
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              Control empresarial de inventarios en tiempo real
            </h1>
            <p className="mt-4 text-sm lg:text-base text-slate-300 leading-relaxed">
              Centraliza productos, proveedores, categorías, entradas, salidas y alertas de existencias mínimas con trazabilidad completa en PostgreSQL.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-white/15 grid grid-cols-2 gap-6 text-xs text-slate-300">
          <div>
            <p className="font-semibold text-white">Transacciones ACID</p>
            <p className="mt-1 leading-relaxed">
              Validación estricta de existencias sin saldos negativos.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Control por roles</p>
            <p className="mt-1 leading-relaxed">
              Permisos diferenciados para administradores y operadores.
            </p>
          </div>
        </div>
      </div>

      {/* Login Form Area */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-[#0F2942]">
              Iniciar sesión
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              Ingresa tus credenciales corporativas para acceder al sistema.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-[#DC2626]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-[#1E293B] mb-1.5"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="nombre@empresa.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-[#1E293B] mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-10 rounded-lg border border-[#CBD5E1] bg-white text-sm text-[#0B1C30] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F2942]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full h-11 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>{loading ? 'Verificando acceso...' : 'Acceder al sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-xs font-medium text-[#64748B]">o continúa con</span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading || googleLoading}
            className="w-full h-11 px-4 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] disabled:opacity-60 text-[#1F1F1F] text-sm font-medium flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5 shrink-0 block"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span>
              {googleLoading ? 'Conectando con Google...' : 'Iniciar sesión con Google'}
            </span>
          </button>

          <div className="mt-6 pt-5 border-t border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-3 text-xs text-[#64748B]">
              <div>
                <p className="font-medium text-[#1E293B]">Acceso inicial del administrador</p>
                <p className="font-mono-num mt-0.5">admin@inventpro.com · InventPro2026!</p>
              </div>
              <button
                type="button"
                onClick={fillInitialAdmin}
                className="px-3 py-1.5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#EFF4FF] text-xs font-medium text-[#0F2942] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Completar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
