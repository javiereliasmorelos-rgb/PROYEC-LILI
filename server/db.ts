import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL no está configurada. Configura la cadena de conexión de PostgreSQL (Neon) en el archivo .env.'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      correo VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(20) NOT NULL DEFAULT 'empleado' CHECK (rol IN ('administrador', 'empleado')),
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL UNIQUE,
      descripcion TEXT NOT NULL DEFAULT '',
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id SERIAL PRIMARY KEY,
      nombre_empresa VARCHAR(160) NOT NULL,
      identificacion VARCHAR(60) NOT NULL UNIQUE,
      contacto VARCHAR(120) NOT NULL,
      telefono VARCHAR(40) NOT NULL,
      correo VARCHAR(160) NOT NULL,
      direccion VARCHAR(255) NOT NULL DEFAULT '',
      ciudad VARCHAR(100) NOT NULL DEFAULT '',
      observaciones TEXT NOT NULL DEFAULT '',
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(60) NOT NULL UNIQUE,
      nombre VARCHAR(180) NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
      proveedor_id INTEGER NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
      precio_compra NUMERIC(12, 2) NOT NULL CHECK (precio_compra >= 0),
      precio_venta NUMERIC(12, 2) NOT NULL CHECK (precio_venta >= 0),
      stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
      stock_minimo INTEGER NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
      proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
      tipo_movimiento VARCHAR(20) NOT NULL CHECK (tipo_movimiento IN ('entrada', 'salida')),
      cantidad INTEGER NOT NULL CHECK (cantidad > 0),
      stock_anterior INTEGER NOT NULL CHECK (stock_anterior >= 0),
      stock_resultante INTEGER NOT NULL CHECK (stock_resultante >= 0),
      precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
      numero_factura VARCHAR(80) NOT NULL DEFAULT '',
      motivo VARCHAR(160) NOT NULL DEFAULT '',
      observaciones TEXT NOT NULL DEFAULT '',
      fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
    CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
    CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id);
    CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
    CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_inventario(producto_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos_inventario(usuario_id);
    CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_inventario(fecha_movimiento DESC);
    CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_inventario(tipo_movimiento);

    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
  `);

  // Bootstrap initial administrator user ONLY if usuarios table is completely empty
  const countRes = await db.query<{ count: string }>('SELECT COUNT(*) AS count FROM usuarios');
  if (Number(countRes.rows[0]?.count ?? 0) === 0) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'InventPro2026!';
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@inventpro.com';
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'administrador', TRUE)`,
      ['Administrador Principal', adminEmail, hash]
    );
  }
}
