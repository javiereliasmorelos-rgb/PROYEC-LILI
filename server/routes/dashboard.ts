import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/dashboard', requireAuth, async (_req, res) => {
  try {
    const db = getPool();

    const [
      kpisRes,
      monthlyMovementsRes,
      seriesRes,
      categoryChartRes,
      recentMovementsRes,
      lowStockRes,
    ] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE activo = TRUE)::int AS total_productos_activos,
          COUNT(*)::int AS total_productos,
          COALESCE(SUM(stock_actual * precio_compra) FILTER (WHERE activo = TRUE), 0)::numeric(14,2) AS valor_inventario_compra,
          COALESCE(SUM(stock_actual * precio_venta) FILTER (WHERE activo = TRUE), 0)::numeric(14,2) AS valor_inventario_venta,
          COALESCE(SUM(stock_actual) FILTER (WHERE activo = TRUE), 0)::int AS unidades_totales,
          COUNT(*) FILTER (WHERE activo = TRUE AND stock_actual <= stock_minimo)::int AS productos_stock_bajo,
          COUNT(*) FILTER (WHERE activo = TRUE AND stock_actual = 0)::int AS productos_agotados
        FROM productos
      `),
      db.query(`
        SELECT
          COUNT(*)::int AS total_mes,
          COUNT(*) FILTER (WHERE tipo_movimiento = 'entrada')::int AS entradas_mes,
          COUNT(*) FILTER (WHERE tipo_movimiento = 'salida')::int AS salidas_mes,
          COALESCE(SUM(cantidad) FILTER (WHERE tipo_movimiento = 'entrada'), 0)::int AS unidades_entrada_mes,
          COALESCE(SUM(cantidad) FILTER (WHERE tipo_movimiento = 'salida'), 0)::int AS unidades_salida_mes
        FROM movimientos_inventario
        WHERE date_trunc('month', fecha_movimiento) = date_trunc('month', CURRENT_TIMESTAMP)
      `),
      db.query(`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_TIMESTAMP) - INTERVAL '5 months',
            date_trunc('month', CURRENT_TIMESTAMP),
            INTERVAL '1 month'
          ) AS mes
        )
        SELECT
          to_char(m.mes, 'YYYY-MM') AS periodo,
          to_char(m.mes, 'Mon YY') AS etiqueta,
          COALESCE(SUM(mv.cantidad) FILTER (WHERE mv.tipo_movimiento = 'entrada'), 0)::int AS entradas,
          COALESCE(SUM(mv.cantidad) FILTER (WHERE mv.tipo_movimiento = 'salida'), 0)::int AS salidas
        FROM meses m
        LEFT JOIN movimientos_inventario mv
          ON date_trunc('month', mv.fecha_movimiento) = m.mes
        GROUP BY m.mes
        ORDER BY m.mes ASC
      `),
      db.query(`
        SELECT
          c.id,
          c.nombre,
          COUNT(p.id) FILTER (WHERE p.activo = TRUE)::int AS cantidad_productos,
          COALESCE(SUM(p.stock_actual) FILTER (WHERE p.activo = TRUE), 0)::int AS stock_total
        FROM categorias c
        LEFT JOIN productos p ON p.categoria_id = c.id
        GROUP BY c.id, c.nombre
        HAVING COUNT(p.id) FILTER (WHERE p.activo = TRUE) > 0
        ORDER BY cantidad_productos DESC, c.nombre ASC
      `),
      db.query(`
        SELECT
          m.id,
          m.tipo_movimiento,
          m.cantidad,
          m.stock_anterior,
          m.stock_resultante,
          m.precio_unitario,
          m.numero_factura,
          m.motivo,
          m.observaciones,
          m.fecha_movimiento,
          p.id AS producto_id,
          p.codigo AS producto_codigo,
          p.nombre AS producto_nombre,
          u.nombre AS usuario_nombre,
          pr.nombre_empresa AS proveedor_nombre
        FROM movimientos_inventario m
        JOIN productos p ON p.id = m.producto_id
        JOIN usuarios u ON u.id = m.usuario_id
        LEFT JOIN proveedores pr ON pr.id = m.proveedor_id
        ORDER BY m.fecha_movimiento DESC, m.id DESC
        LIMIT 8
      `),
      db.query(`
        SELECT
          p.id,
          p.codigo,
          p.nombre,
          p.stock_actual,
          p.stock_minimo,
          c.nombre AS categoria_nombre,
          pr.nombre_empresa AS proveedor_nombre,
          CASE
            WHEN p.stock_actual = 0 THEN 'agotado'
            WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
            ELSE 'disponible'
          END AS estado_stock
        FROM productos p
        JOIN categorias c ON c.id = p.categoria_id
        JOIN proveedores pr ON pr.id = p.proveedor_id
        WHERE p.activo = TRUE AND p.stock_actual <= p.stock_minimo
        ORDER BY p.stock_actual ASC, p.nombre ASC
        LIMIT 8
      `),
    ]);

    const kpis = kpisRes.rows[0];
    const monthly = monthlyMovementsRes.rows[0];

    res.json({
      kpis: {
        totalProductosActivos: Number(kpis.total_productos_activos || 0),
        totalProductos: Number(kpis.total_productos || 0),
        valorInventarioCompra: Number(kpis.valor_inventario_compra || 0),
        valorInventarioVenta: Number(kpis.valor_inventario_venta || 0),
        unidadesTotales: Number(kpis.unidades_totales || 0),
        productosStockBajo: Number(kpis.productos_stock_bajo || 0),
        productosAgotados: Number(kpis.productos_agotados || 0),
        movimientosMes: Number(monthly.total_mes || 0),
        entradasMes: Number(monthly.entradas_mes || 0),
        salidasMes: Number(monthly.salidas_mes || 0),
        unidadesEntradaMes: Number(monthly.unidades_entrada_mes || 0),
        unidadesSalidaMes: Number(monthly.unidades_salida_mes || 0),
      },
      flujoMensual: seriesRes.rows,
      productosPorCategoria: categoryChartRes.rows,
      movimientosRecientes: recentMovementsRes.rows,
      alertasRecientes: lowStockRes.rows,
    });
  } catch (err) {
    console.error('Error en dashboard:', err);
    res.status(500).json({ error: 'No fue posible cargar las métricas del panel de control' });
  }
});

export default router;
