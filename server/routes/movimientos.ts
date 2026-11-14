import { Router } from 'express';
import { getPool, withTransaction } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../auth.js';

const router = Router();

router.get('/movimientos', requireAuth, async (req, res) => {
  try {
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const productoId = req.query.productoId ? Number(req.query.productoId) : null;
    const usuarioId = req.query.usuarioId ? Number(req.query.usuarioId) : null;
    const tipo = String(req.query.tipo || '').trim();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 15)));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (fechaInicio) {
      params.push(fechaInicio);
      whereClauses.push(`m.fecha_movimiento >= $${params.length}::date`);
    }
    if (fechaFin) {
      params.push(fechaFin);
      whereClauses.push(`m.fecha_movimiento < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (productoId) {
      params.push(productoId);
      whereClauses.push(`m.producto_id = $${params.length}`);
    }
    if (usuarioId) {
      params.push(usuarioId);
      whereClauses.push(`m.usuario_id = $${params.length}`);
    }
    if (tipo === 'entrada' || tipo === 'salida') {
      params.push(tipo);
      whereClauses.push(`m.tipo_movimiento = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await getPool().query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM movimientos_inventario m ${whereSql}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const [movRes, usersRes] = await Promise.all([
      getPool().query(
        `SELECT
          m.*,
          p.codigo AS producto_codigo,
          p.nombre AS producto_nombre,
          u.nombre AS usuario_nombre,
          u.rol AS usuario_rol,
          pr.nombre_empresa AS proveedor_nombre
         FROM movimientos_inventario m
         JOIN productos p ON p.id = m.producto_id
         JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN proveedores pr ON pr.id = m.proveedor_id
         ${whereSql}
         ORDER BY m.fecha_movimiento DESC, m.id DESC
         LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
        dataParams
      ),
      getPool().query('SELECT id, nombre FROM usuarios ORDER BY nombre ASC'),
    ]);

    res.json({
      movimientos: movRes.rows,
      usuarios: usersRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error('Error listando movimientos:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/movimientos/entrada', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const productoId = Number(req.body?.producto_id);
    const proveedorId = Number(req.body?.proveedor_id);
    const cantidad = Number(req.body?.cantidad);
    const precioCompra = Number(req.body?.precio_compra);
    const fechaInput = req.body?.fecha ? String(req.body.fecha) : null;
    const numeroFactura = String(req.body?.numero_factura || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim();

    if (
      !productoId ||
      !proveedorId ||
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      Number.isNaN(precioCompra) ||
      precioCompra < 0
    ) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const result = await withTransaction(async (client) => {
      const prodRes = await client.query(
        'SELECT id, nombre, codigo, stock_actual, stock_minimo, activo FROM productos WHERE id = $1 FOR UPDATE',
        [productoId]
      );

      if (prodRes.rows.length === 0) {
        throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      }
      const producto = prodRes.rows[0];
      if (!producto.activo) {
        throw Object.assign(
          new Error('No se pueden registrar movimientos para un producto desactivado.'),
          { status: 400 }
        );
      }

      const provRes = await client.query('SELECT id FROM proveedores WHERE id = $1', [proveedorId]);
      if (provRes.rows.length === 0) {
        throw Object.assign(new Error('Proveedor no encontrado'), { status: 404 });
      }

      const stockAnterior = Number(producto.stock_actual);
      const stockResultante = stockAnterior + cantidad;
      const fechaMovimiento = fechaInput ? new Date(fechaInput) : new Date();
      const safeFecha = Number.isNaN(fechaMovimiento.getTime()) ? new Date() : fechaMovimiento;

      const movInsert = await client.query(
        `INSERT INTO movimientos_inventario
          (producto_id, usuario_id, proveedor_id, tipo_movimiento, cantidad, stock_anterior, stock_resultante, precio_unitario, numero_factura, motivo, observaciones, fecha_movimiento)
         VALUES ($1, $2, $3, 'entrada', $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          productoId,
          req.user!.id,
          proveedorId,
          cantidad,
          stockAnterior,
          stockResultante,
          precioCompra,
          numeroFactura,
          'Entrada de mercancía',
          observaciones,
          safeFecha,
        ]
      );

      const prodUpdate = await client.query(
        `UPDATE productos
         SET stock_actual = $1,
             precio_compra = $2
         WHERE id = $3
         RETURNING *`,
        [stockResultante, precioCompra, productoId]
      );

      return { movimiento: movInsert.rows[0], producto: prodUpdate.rows[0] };
    });

    res.status(201).json({
      ...result,
      message: 'Entrada registrada correctamente',
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    const message =
      status < 500 && err instanceof Error
        ? err.message
        : 'No fue posible completar la operación';
    if (status >= 500) console.error('Error en entrada de mercancía:', err);
    res.status(status).json({ error: message });
  }
});

router.post('/movimientos/salida', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const productoId = Number(req.body?.producto_id);
    const cantidad = Number(req.body?.cantidad);
    const motivo = String(req.body?.motivo || '').trim();
    const fechaInput = req.body?.fecha ? String(req.body.fecha) : null;
    const observaciones = String(req.body?.observaciones || '').trim();

    if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0 || !motivo) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const result = await withTransaction(async (client) => {
      const prodRes = await client.query(
        'SELECT id, nombre, codigo, stock_actual, stock_minimo, precio_venta, activo FROM productos WHERE id = $1 FOR UPDATE',
        [productoId]
      );

      if (prodRes.rows.length === 0) {
        throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      }
      const producto = prodRes.rows[0];
      if (!producto.activo) {
        throw Object.assign(
          new Error('No se pueden registrar movimientos para un producto desactivado.'),
          { status: 400 }
        );
      }

      const stockAnterior = Number(producto.stock_actual);
      if (stockAnterior < cantidad) {
        throw Object.assign(
          new Error('No hay suficiente inventario disponible para realizar esta operación'),
          { status: 400 }
        );
      }

      const stockResultante = stockAnterior - cantidad;
      const fechaMovimiento = fechaInput ? new Date(fechaInput) : new Date();
      const safeFecha = Number.isNaN(fechaMovimiento.getTime()) ? new Date() : fechaMovimiento;

      const movInsert = await client.query(
        `INSERT INTO movimientos_inventario
          (producto_id, usuario_id, proveedor_id, tipo_movimiento, cantidad, stock_anterior, stock_resultante, precio_unitario, numero_factura, motivo, observaciones, fecha_movimiento)
         VALUES ($1, $2, NULL, 'salida', $3, $4, $5, $6, '', $7, $8, $9)
         RETURNING *`,
        [
          productoId,
          req.user!.id,
          cantidad,
          stockAnterior,
          stockResultante,
          Number(producto.precio_venta),
          motivo,
          observaciones,
          safeFecha,
        ]
      );

      const prodUpdate = await client.query(
        'UPDATE productos SET stock_actual = $1 WHERE id = $2 RETURNING *',
        [stockResultante, productoId]
      );

      let warning: string | null = null;
      if (stockResultante === 0) {
        warning = 'El producto se encuentra agotado';
      } else if (stockResultante <= Number(producto.stock_minimo)) {
        warning = 'Advertencia: existencias por debajo del mínimo';
      }

      return {
        movimiento: movInsert.rows[0],
        producto: prodUpdate.rows[0],
        warning,
      };
    });

    res.status(201).json({
      ...result,
      message: 'Salida registrada correctamente',
    });
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status || 500;
    const message =
      status < 500 && err instanceof Error
        ? err.message
        : 'No fue posible completar la operación';
    if (status >= 500) console.error('Error en salida de mercancía:', err);
    res.status(status).json({ error: message });
  }
});

export default router;
