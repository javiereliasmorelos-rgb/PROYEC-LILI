import {
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  BellRing,
  FileBarChart2,
  Users,
  Boxes,
  LogOut,
  X,
} from 'lucide-react';
import { PageRoute, User } from '../types';

interface NavItem {
  id: PageRoute;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  badgeCount?: number;
}

interface SidebarProps {
  currentRoute: PageRoute;
  onNavigate: (route: PageRoute) => void;
  user: User;
  alertCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  currentRoute,
  onNavigate,
  user,
  alertCount,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const isAdmin = user.rol === 'administrador';

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'categorias', label: 'Categorías', icon: Tags, adminOnly: true },
    { id: 'proveedores', label: 'Proveedores', icon: Truck, adminOnly: true },
    { id: 'entradas', label: 'Entradas', icon: ArrowDownToLine },
    { id: 'salidas', label: 'Salidas', icon: ArrowUpFromLine },
    { id: 'movimientos', label: 'Movimientos', icon: History },
    { id: 'alertas', label: 'Alertas', icon: BellRing, badgeCount: alertCount },
    { id: 'reportes', label: 'Reportes', icon: FileBarChart2, adminOnly: true },
    { id: 'usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#142B4A] text-white">
      {/* Brand header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => {
            onNavigate('dashboard');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shrink-0">
            <Boxes className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap">
            INVENTPRO
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú lateral"
          className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation items */}
      <nav aria-label="Menú principal" className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = currentRoute === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span
                  className={`font-mono-num text-xs font-semibold px-2 py-0.5 rounded-md ${
                    active ? 'bg-white/20 text-white' : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User account footer */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white truncate">{user.nombre}</p>
          <p className="text-xs text-slate-300 truncate">
            {user.rol === 'administrador' ? 'Administrador' : 'Empleado'} · {user.correo}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Fixed desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 border-r border-[#0F2942]">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCloseMobile();
          }}
        >
          <div className="fixed inset-0 bg-[#0F2942]/50 backdrop-blur-[2px]" onClick={onCloseMobile} />
          <div className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
