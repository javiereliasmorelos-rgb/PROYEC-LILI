# INVENTPRO — Sistema Empresarial de Gestión de Inventarios

Aplicación web Full Stack empresarial para la administración integral de inventarios de pequeñas y medianas empresas, conectada en tiempo real a **PostgreSQL (Neon)**.

## Arquitectura Implementada

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Chart.js (`react-chartjs-2`), Lucide Icons, exportación real a **PDF** (`jspdf` + `jspdf-autotable`) y **Excel (.xlsx)** (`xlsx`).
- **Backend**: Node.js + Express (`server.ts`) con API REST modular (`/api/*`), autenticación basada en cookies HTTP-only firmadas con JWT, protección CSRF (*double-submit cookie*), contraseñas protegidas con `bcryptjs` y transacciones ACID en PostgreSQL (`pg`).
- **Base de datos**: PostgreSQL en Neon (`usuarios`, `categorias`, `proveedores`, `productos`, `movimientos_inventario`) con llaves primarias, foráneas, restricciones `CHECK`, índices y migración idempotente al iniciar el servidor.

## Módulos Funcionales

1. **Autenticación y Roles (`administrador` / `empleado`)**: Inicio y cierre de sesión, control de acceso en backend y frontend, y registro de usuarios controlado exclusivamente por el administrador.
2. **Panel Principal (Dashboard)**: 4 indicadores clave en tiempo real, gráfico de entradas vs. salidas, gráfico de productos por categoría, movimientos recientes, alertas de existencias y accesos rápidos.
3. **Productos (CRUD)**: Código único, búsqueda, filtros por categoría/proveedor/disponibilidad, ordenamiento, paginación, detalle con historial y desactivación segura cuando existen movimientos históricos asociados.
4. **Categorías y Proveedores (CRUD)**: Gestión completa respetando integridad referencial con productos y movimientos.
5. **Entradas y Salidas de Mercancía**: Operaciones ejecutadas mediante transacciones SQL con bloqueo de fila (`SELECT ... FOR UPDATE`), validación estricta de existencias disponibles (impide saldos negativos) y generación automática de advertencias de stock mínimo o agotamiento.
6. **Historial de Movimientos**: Bitácora cronológica e inmutable con filtros por fecha, producto, usuario y tipo.
7. **Alertas Automáticas**: Clasificación automática (`Agotado`, `Stock bajo`, `Disponible`), contador en barra lateral y botón de reabastecimiento directo.
8. **Reportes Empresariales**: 8 vistas de reporte con filtros avanzados y descarga directa en **PDF** y **Excel**.

## Configuración y Ejecución Local

1. **Instalar Node.js (v20+) y dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   Copia `.env.example` a `.env` y asigna tu cadena de conexión de Neon PostgreSQL y un secreto JWT:
   ```env
   DATABASE_URL="postgresql://USUARIO:PASSWORD@HOST/neondb?sslmode=require"
   SESSION_SECRET="tu_secreto_seguro_aqui"
   ```

3. **Inicializar esquema y usuario administrador**:
   Al iniciar el servidor, `initDatabase()` verifica y crea automáticamente las tablas e índices en Neon PostgreSQL. Si la tabla `usuarios` está vacía, crea el administrador inicial (`admin@inventpro.com` / `InventPro2026!`, configurable mediante `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`).

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Accede desde el navegador a `http://localhost:3000`.

5. **Compilar para producción**:
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
