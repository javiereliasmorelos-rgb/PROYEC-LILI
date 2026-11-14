import { useCallback, useEffect, useState } from 'react';
import {
  Menu,
  BellRing,
  LayoutDashboard,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
} from 'lucide-react';
import { apiRequest, clearAuthSession, setAuthSession } from './lib/api';
import { signOutFirebase } from './lib/firebaseAuth';
import { FlashMessage, FlashType, PageRoute, User } from './types';
import LoginView from './components/LoginView';
import Sidebar from './components/Sidebar';
import FlashBanner from './components/FlashBanner';
import DashboardPage from './pages/DashboardPage';
import ProductosPage from './pages/ProductosPage';
import CategoriasPage from './pages/CategoriasPage';
import ProveedoresPage from './pages/ProveedoresPage';
import EntradasPage from './pages/EntradasPage';
import SalidasPage from './pages/SalidasPage';
import MovimientosPage from './pages/MovimientosPage';
import AlertasPage from './pages/AlertasPage';
import ReportesPage from './pages/ReportesPage';
import UsuariosPage from './pages/UsuariosPage';

const ROUTE_TITLES: Record<PageRoute, string> = {
  dashboard: 'Panel Principal',
  productos: 'Productos',
  categorias: 'Categorías',
  proveedores: 'Proveedores',
  entradas: 'Entradas de Mercancía',
  salidas: 'Salidas de Mercancía',
  movimientos: 'Movimientos de Inventario',
  alertas: 'Alertas de Existencias',
  reportes: 'Reportes',
  usuarios: 'Usuarios',
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [route, setRoute] = useState<PageRoute>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [flashes, setFlashes] = useState<FlashMessage[]>([]);
  const [openCreateProductTrigger, setOpenCreateProductTrigger] = useState(0);
  const [restockProductId, setRestockProductId] = useState<number | null>(null);

  const pushFlash = useCallback((type: FlashType, text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlashes((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setFlashes((prev) => prev.filter((m) => m.id !== id));
    }, 6500);
  }, []);

  const dismissFlash = useCallback((id: string) => {
    setFlashes((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const refreshAlertCount = useCallback(async () => {
    try {
      const res = await apiRequest<{ totalAlertas: number }>('/api/alertas/count');
      setAlertCount(res.totalAlertas);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await apiRequest<{ user: User; token: string; csrfToken: string }>(
          '/api/auth/me'
        );
        setAuthSession(res.token, res.csrfToken);
        setUser(res.user);
      } catch {
        clearAuthSession();
        setUser(null);
      } finally {
        setAuthChecking(false);
      }
    }
    checkSession();
  }, []);

  useEffect(() => {
    if (user) {
      refreshAlertCount();
    }
  }, [user, refreshAlertCount]);

  async function handleLogout() {
    try {
      await Promise.allSettled([
        apiRequest('/api/auth/logout', { method: 'POST' }),
        signOutFirebase(),
      ]);
    } catch {
      // clear locally anyway
    }
    clearAuthSession();
    setUser(null);
    setRoute('dashboard');
    setFlashes([]);
  }

  function handleNavigate(next: PageRoute) {
    if (
      user?.rol !== 'administrador' &&
      (next === 'categorias' || next === 'proveedores' || next === 'reportes' || next === 'usuarios')
    ) {
      pushFlash('error', 'Acceso denegado. Esta sección requiere rol de administrador.');
      return;
    }
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleQuickCreateProduct() {
    setRoute('productos');
    setOpenCreateProductTrigger((n) => n + 1);
  }

  function handleQuickRestock(productId: number) {
    setRestockProductId(productId);
    setRoute('entradas');
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F3F6FA] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#0F2942]">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          setRoute('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col lg:flex-row">
      <Sidebar
        currentRoute={route}
        onNavigate={handleNavigate}
        user={user}
        alertCount={alertCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de navegación"
              className="lg:hidden p-2 rounded-lg text-[#0F2942] hover:bg-[#F3F6FA]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#64748B] hidden sm:inline">InventPro</span>
              <span className="text-[#CBD5E1] hidden sm:inline">/</span>
              <span className="font-semibold text-[#0F2942] truncate">
                {ROUTE_TITLES[route]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('alertas')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-medium text-[#0F2942] cursor-pointer whitespace-nowrap"
            >
              <BellRing
                className={`w-4 h-4 ${alertCount > 0 ? 'text-[#DC2626]' : 'text-[#64748B]'}`}
              />
              <span className="font-mono-num">
                {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'}
              </span>
            </button>

            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-[#0F2942] leading-tight">{user.nombre}</p>
              <p className="text-[11px] text-[#64748B]">
                {user.rol === 'administrador' ? 'Administrador' : 'Empleado'}
              </p>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <FlashBanner messages={flashes} onDismiss={dismissFlash} />

          {route === 'dashboard' && (
            <DashboardPage
              user={user}
              onNavigate={handleNavigate}
              onQuickCreateProduct={handleQuickCreateProduct}
              onQuickRestock={handleQuickRestock}
            />
          )}

          {route === 'productos' && (
            <ProductosPage
              user={user}
              onFlash={pushFlash}
              onInventoryMutated={refreshAlertCount}
              openCreateTrigger={openCreateProductTrigger}
            />
          )}

          {route === 'categorias' && <CategoriasPage onFlash={pushFlash} />}

          {route === 'proveedores' && <ProveedoresPage onFlash={pushFlash} />}

          {route === 'entradas' && (
            <EntradasPage
              user={user}
              preselectedProductId={restockProductId}
              onFlash={pushFlash}
              onInventoryMutated={refreshAlertCount}
              onGoToProductos={() => handleNavigate('productos')}
            />
          )}

          {route === 'salidas' && (
            <SalidasPage
              user={user}
              onFlash={pushFlash}
              onInventoryMutated={refreshAlertCount}
              onGoToProductos={() => handleNavigate('productos')}
            />
          )}

          {route === 'movimientos' && <MovimientosPage onFlash={pushFlash} />}

          {route === 'alertas' && (
            <AlertasPage onFlash={pushFlash} onRestock={handleQuickRestock} />
          )}

          {route === 'reportes' && <ReportesPage onFlash={pushFlash} />}

          {route === 'usuarios' && <UsuariosPage currentUser={user} onFlash={pushFlash} />}
        </main>
      </div>

      {/* Mobile bottom bar (compact <= 15% viewport height) */}
      <nav
        aria-label="Navegación rápida móvil"
        className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-[#E2E8F0] z-30 grid grid-cols-5"
      >
        {[
          { id: 'dashboard' as PageRoute, label: 'Inicio', icon: LayoutDashboard },
          { id: 'productos' as PageRoute, label: 'Productos', icon: Package },
          { id: 'entradas' as PageRoute, label: 'Entradas', icon: ArrowDownToLine },
          { id: 'salidas' as PageRoute, label: 'Salidas', icon: ArrowUpFromLine },
          { id: 'alertas' as PageRoute, label: 'Alertas', icon: BellRing },
        ].map((item) => {
          const Icon = item.icon;
          const active = route === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-[#2563EB]' : 'text-[#64748B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
