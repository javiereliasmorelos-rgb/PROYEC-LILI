import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

router.get('/alertas', requireAuth, async (_req, res) => {
  try {
    const result = await getPool().query(`
      SELECT
        p.id,
        p.codigo,
        p.nombre,
        p.stock_actual,
        p.stock_minimo,
        p.precio_compra,
        p.precio_venta,
        p.proveedor_id,
        c.nombre AS categoria_nombre,
        pr.nombre_empresa AS proveedor_nombre,
        NOW() AS fecha_consulta,
        CASE
          WHEN p.stock_actual = 0 THEN 'agotado'
          WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
          ELSE 'disponible'
        END AS estado
      FROM productos p
      JOIN categorias c ON c.id = p.categoria_id
      JOIN proveedores pr ON pr.id = p.proveedor_id
      WHERE p.activo = TRUE
      ORDER BY
        CASE
          WHEN p.stock_actual = 0 THEN 0
          WHEN p.stock_actual <= p.stock_minimo THEN 1
          ELSE 2
        END ASC,
        p.stock_actual ASC,
        p.nombre ASC
    `);

    const rows = result.rows;
    const resumen = {
      agotados: rows.filter((r) => r.estado === 'agotado').length,
      stockBajo: rows.filter((r) => r.estado === 'stock_bajo').length,
      disponibles: rows.filter((r) => r.estado === 'disponible').length,
      totalAlertas: rows.filter((r) => r.estado !== 'disponible').length,
      fechaConsulta: new Date().toISOString(),
    };

    res.json({ alertas: rows, resumen });
  } catch (err) {
    console.error('Error consultando alertas:', err);
    res.status(500).json({ error: 'No fue posible consultar las alertas de existencias' });
  }
});

router.get('/alertas/count', requireAuth, async (_req, res) => {
  try {
    const result = await getPool().query<{ total_alertas: number }>(`
      SELECT COUNT(*)::int AS total_alertas
      FROM productos
      WHERE activo = TRUE AND stock_actual <= stock_minimo
    `);
    res.json({ totalAlertas: result.rows[0]?.total_alertas || 0 });
  } catch (err) {
    console.error('Error contando alertas:', err);
    res.status(500).json({ error: 'No fue posible consultar el conteo de alertas' });
  }
});

export default router;
