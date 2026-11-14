export type UserRole = 'administrador' | 'empleado';

export interface User {
  id: number;
  nombre: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
  fecha_creacion?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string;
  fecha_creacion: string;
  total_productos?: number;
  stock_total?: number;
}

export interface Proveedor {
  id: number;
  nombre_empresa: string;
  identificacion: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  ciudad: string;
  observaciones: string;
  activo: boolean;
  fecha_creacion: string;
  total_productos?: number;
  total_movimientos?: number;
}

export type StockStatus = 'disponible' | 'stock_bajo' | 'agotado';

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria_id: number;
  proveedor_id: number;
  categoria_nombre?: string;
  proveedor_nombre?: string;
  precio_compra: string | number;
  precio_venta: string | number;
  stock_actual: number;
  stock_minimo: number;
  activo: boolean;
  fecha_creacion: string;
  total_movimientos?: number;
  estado_stock?: StockStatus;
}

export interface Movimiento {
  id: number;
  producto_id: number;
  usuario_id: number;
  proveedor_id: number | null;
  tipo_movimiento: 'entrada' | 'salida';
  cantidad: number;
  stock_anterior: number;
  stock_resultante: number;
  precio_unitario: string | number;
  numero_factura: string;
  motivo: string;
  observaciones: string;
  fecha_movimiento: string;
  producto_codigo?: string;
  producto_nombre?: string;
  usuario_nombre?: string;
  usuario_rol?: string;
  proveedor_nombre?: string | null;
}

export interface AlertaItem {
  id: number;
  codigo: string;
  nombre: string;
  stock_actual: number;
  stock_minimo: number;
  precio_compra: string | number;
  precio_venta: string | number;
  proveedor_id: number;
  categoria_nombre: string;
  proveedor_nombre: string;
  fecha_consulta: string;
  estado: StockStatus;
}

export interface DashboardData {
  kpis: {
    totalProductosActivos: number;
    totalProductos: number;
    valorInventarioCompra: number;
    valorInventarioVenta: number;
    unidadesTotales: number;
    productosStockBajo: number;
    productosAgotados: number;
    movimientosMes: number;
    entradasMes: number;
    salidasMes: number;
    unidadesEntradaMes: number;
    unidadesSalidaMes: number;
  };
  flujoMensual: Array<{
    periodo: string;
    etiqueta: string;
    entradas: number;
    salidas: number;
  }>;
  productosPorCategoria: Array<{
    id: number;
    nombre: string;
    cantidad_productos: number;
    stock_total: number;
  }>;
  movimientosRecientes: Movimiento[];
  alertasRecientes: Array<{
    id: number;
    codigo: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
    categoria_nombre: string;
    proveedor_nombre: string;
    estado_stock: StockStatus;
  }>;
}

export type FlashType = 'success' | 'warning' | 'error' | 'info';

export interface FlashMessage {
  id: string;
  type: FlashType;
  text: string;
}

export type PageRoute =
  | 'dashboard'
  | 'productos'
  | 'categorias'
  | 'proveedores'
  | 'entradas'
  | 'salidas'
  | 'movimientos'
  | 'alertas'
  | 'reportes'
  | 'usuarios';
