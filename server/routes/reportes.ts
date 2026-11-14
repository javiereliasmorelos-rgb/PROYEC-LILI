import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';

const router = Router();

export type ReportType =
  | 'inventario_general'
  | 'productos_disponibles'
  | 'productos_agotados'
  | 'productos_stock_bajo'
  | 'entradas_mercancia'
  | 'salidas_mercancia'
  | 'movimientos_periodo'
  | 'valor_inventario';

router.get('/reportes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tipo = (String(req.query.tipo || 'inventario_general') as ReportType);
    const fechaInicio = String(req.query.fechaInicio || '').trim();
    const fechaFin = String(req.query.fechaFin || '').trim();
    const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : null;
    const productoId = req.query.productoId ? Number(req.query.productoId) : null;
    const tipoMovimiento = String(req.query.tipoMovimiento || '').trim();

    const db = getPool();

    const isMovementReport =
      tipo === 'entradas_mercancia' ||
      tipo === 'salidas_mercancia' ||
      tipo === 'movimientos_periodo';

    if (isMovementReport) {
      const whereClauses: string[] = [];
      const params: unknown[] = [];

      if (tipo === 'entradas_mercancia') {
        whereClauses.push(`m.tipo_movimiento = 'entrada'`);
      } else if (tipo === 'salidas_mercancia') {
        whereClauses.push(`m.tipo_movimiento = 'salida'`);
      } else if (tipoMovimiento === 'entrada' || tipoMovimiento === 'salida') {
        params.push(tipoMovimiento);
        whereClauses.push(`m.tipo_movimiento = $${params.length}`);
      }

      if (fechaInicio) {
        params.push(fechaInicio);
        whereClauses.push(`m.fecha_movimiento >= $${params.length}::date`);
      }
      if (fechaFin) {
        params.push(fechaFin);
        whereClauses.push(`m.fecha_movimiento < ($${params.length}::date + INTERVAL '1 day')`);
      }
      if (categoriaId) {
        params.push(categoriaId);
        whereClauses.push(`p.categoria_id = $${params.length}`);
      }
      if (productoId) {
        params.push(productoId);
        whereClauses.push(`m.producto_id = $${params.length}`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const result = await db.query(
        `SELECT
          m.id,
          m.fecha_movimiento,
          m.tipo_movimiento,
          p.codigo AS producto_codigo,
          p.nombre AS producto_nombre,
          c.nombre AS categoria_nombre,
          m.cantidad,
          m.stock_anterior,
          m.stock_resultante,
          m.precio_unitario,
          (m.cantidad * m.precio_unitario)::numeric(14,2) AS valor_total,
          u.nombre AS usuario_nombre,
          COALESCE(pr.nombre_empresa, '—') AS proveedor_nombre,
          COALESCE(NULLIF(m.numero_factura, ''), NULLIF(m.motivo, ''), '—') AS referencia,
          m.observaciones
         FROM movimientos_inventario m
         JOIN productos p ON p.id = m.producto_id
         JOIN categorias c ON c.id = p.categoria_id
         JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN proveedores pr ON pr.id = m.proveedor_id
         ${whereSql}
         ORDER BY m.fecha_movimiento DESC, m.id DESC`,
        params
      );

      const totalUnidades = result.rows.reduce((acc, r) => acc + Number(r.cantidad || 0), 0);
      const totalValor = result.rows.reduce((acc, r) => acc + Number(r.valor_total || 0), 0);

      res.json({
        tipo,
        modo: 'movimientos',
        generadoEn: new Date().toISOString(),
        resumen: {
          totalRegistros: result.rows.length,
          totalUnidades,
          totalValor,
        },
        rows: result.rows,
      });
      return;
    }

    // Product / Inventory reports
    const whereClauses: string[] = ['p.activo = TRUE'];
    const params: unknown[] = [];

    if (tipo === 'productos_disponibles') {
      whereClauses.push('p.stock_actual > p.stock_minimo');
    } else if (tipo === 'productos_agotados') {
      whereClauses.push('p.stock_actual = 0');
    } else if (tipo === 'productos_stock_bajo') {
      whereClauses.push('p.stock_actual <= p.stock_minimo');
    }

    if (categoriaId) {
      params.push(categoriaId);
      whereClauses.push(`p.categoria_id = $${params.length}`);
    }
    if (productoId) {
      params.push(productoId);
      whereClauses.push(`p.id = $${params.length}`);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
    const result = await db.query(
      `SELECT
        p.id,
        p.codigo,
        p.nombre,
        c.nombre AS categoria_nombre,
        pr.nombre_empresa AS proveedor_nombre,
        p.stock_actual,
        p.stock_minimo,
        p.precio_compra,
        p.precio_venta,
        (p.stock_actual * p.precio_compra)::numeric(14,2) AS valor_compra,
        (p.stock_actual * p.precio_venta)::numeric(14,2) AS valor_venta,
        CASE
          WHEN p.stock_actual = 0 THEN 'Agotado'
          WHEN p.stock_actual <= p.stock_minimo THEN 'Stock bajo'
          ELSE 'Disponible'
        END AS estado_stock
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       JOIN proveedores pr ON pr.id = p.proveedor_id
       ${whereSql}
       ORDER BY p.nombre ASC`,
      params
    );

    const totalUnidades = result.rows.reduce((acc, r) => acc + Number(r.stock_actual || 0), 0);
    const totalValorCompra = result.rows.reduce((acc, r) => acc + Number(r.valor_compra || 0), 0);
    const totalValorVenta = result.rows.reduce((acc, r) => acc + Number(r.valor_venta || 0), 0);

    res.json({
      tipo,
      modo: 'productos',
      generadoEn: new Date().toISOString(),
      resumen: {
        totalRegistros: result.rows.length,
        totalUnidades,
        totalValorCompra,
        totalValorVenta,
      },
      rows: result.rows,
    });
  } catch (err) {
    console.error('Error generando reporte:', err);
    res.status(500).json({ error: 'No fue posible generar el reporte solicitado' });
  }
});

export default router;
