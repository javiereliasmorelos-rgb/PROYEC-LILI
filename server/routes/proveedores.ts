import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';

const router = Router();

router.get('/proveedores', requireAuth, async (req, res) => {
  try {
    const onlyActive = req.query.activos === 'true';
    const whereSql = onlyActive ? 'WHERE pr.activo = TRUE' : '';
    const result = await getPool().query(`
      SELECT
        pr.*,
        (SELECT COUNT(*)::int FROM productos p WHERE p.proveedor_id = pr.id) AS total_productos,
        (SELECT COUNT(*)::int FROM movimientos_inventario m WHERE m.proveedor_id = pr.id) AS total_movimientos
      FROM proveedores pr
      ${whereSql}
      ORDER BY pr.nombre_empresa ASC
    `);
    res.json({ proveedores: result.rows });
  } catch (err) {
    console.error('Error listando proveedores:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/proveedores', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nombreEmpresa = String(req.body?.nombre_empresa || '').trim();
    const identificacion = String(req.body?.identificacion || '').trim();
    const contacto = String(req.body?.contacto || '').trim();
    const telefono = String(req.body?.telefono || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const direccion = String(req.body?.direccion || '').trim();
    const ciudad = String(req.body?.ciudad || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim();

    if (!nombreEmpresa || !identificacion || !contacto || !telefono || !correo) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM proveedores WHERE LOWER(identificacion) = LOWER($1)',
      [identificacion]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe un proveedor registrado con esa identificación.' });
      return;
    }

    const result = await getPool().query(
      `INSERT INTO proveedores
        (nombre_empresa, identificacion, contacto, telefono, correo, direccion, ciudad, observaciones, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING *`,
      [nombreEmpresa, identificacion, contacto, telefono, correo, direccion, ciudad, observaciones]
    );

    res.status(201).json({
      proveedor: result.rows[0],
      message: 'Proveedor registrado correctamente',
    });
  } catch (err) {
    console.error('Error creando proveedor:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.put('/proveedores/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombreEmpresa = String(req.body?.nombre_empresa || '').trim();
    const identificacion = String(req.body?.identificacion || '').trim();
    const contacto = String(req.body?.contacto || '').trim();
    const telefono = String(req.body?.telefono || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const direccion = String(req.body?.direccion || '').trim();
    const ciudad = String(req.body?.ciudad || '').trim();
    const observaciones = String(req.body?.observaciones || '').trim();
    const activo = typeof req.body?.activo === 'boolean' ? req.body.activo : true;

    if (!id || !nombreEmpresa || !identificacion || !contacto || !telefono || !correo) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM proveedores WHERE LOWER(identificacion) = LOWER($1) AND id <> $2',
      [identificacion, id]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'Esa identificación ya pertenece a otro proveedor.' });
      return;
    }

    const result = await getPool().query(
      `UPDATE proveedores
       SET nombre_empresa = $1,
           identificacion = $2,
           contacto = $3,
           telefono = $4,
           correo = $5,
           direccion = $6,
           ciudad = $7,
           observaciones = $8,
           activo = $9
       WHERE id = $10
       RETURNING *`,
      [nombreEmpresa, identificacion, contacto, telefono, correo, direccion, ciudad, observaciones, activo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    res.json({
      proveedor: result.rows[0],
      message: 'Proveedor actualizado correctamente',
    });
  } catch (err) {
    console.error('Error actualizando proveedor:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.delete('/proveedores/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const refs = await getPool().query<{ productos: string; movimientos: string }>(
      `SELECT
        (SELECT COUNT(*) FROM productos WHERE proveedor_id = $1) AS productos,
        (SELECT COUNT(*) FROM movimientos_inventario WHERE proveedor_id = $1) AS movimientos`,
      [id]
    );

    const hasProducts = Number(refs.rows[0]?.productos || 0) > 0;
    const hasMovements = Number(refs.rows[0]?.movimientos || 0) > 0;

    if (hasProducts || hasMovements) {
      const deactivated = await getPool().query(
        'UPDATE proveedores SET activo = FALSE WHERE id = $1 RETURNING *',
        [id]
      );
      if (deactivated.rows.length === 0) {
        res.status(404).json({ error: 'Proveedor no encontrado' });
        return;
      }
      res.json({
        deactivated: true,
        proveedor: deactivated.rows[0],
        message: 'El proveedor tiene productos o movimientos históricos asociados y fue desactivado de forma segura',
      });
      return;
    }

    const deleted = await getPool().query('DELETE FROM proveedores WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: 'Proveedor no encontrado' });
      return;
    }

    res.json({ deactivated: false, message: 'Proveedor eliminado correctamente' });
  } catch (err) {
    console.error('Error eliminando proveedor:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

export default router;
