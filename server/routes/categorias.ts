import { Router } from 'express';
import { getPool } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';

const router = Router();

router.get('/categorias', requireAuth, async (_req, res) => {
  try {
    const result = await getPool().query(`
      SELECT
        c.*,
        COUNT(p.id)::int AS total_productos,
        COALESCE(SUM(p.stock_actual), 0)::int AS stock_total
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre ASC
    `);
    res.json({ categorias: result.rows });
  } catch (err) {
    console.error('Error listando categorías:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/categorias', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();

    if (!nombre) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
      return;
    }

    const result = await getPool().query(
      'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );

    res.status(201).json({
      categoria: result.rows[0],
      message: 'Categoría registrada correctamente',
    });
  } catch (err) {
    console.error('Error creando categoría:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.put('/categorias/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();

    if (!id || !nombre) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1) AND id <> $2',
      [nombre, id]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe otra categoría con ese nombre.' });
      return;
    }

    const result = await getPool().query(
      'UPDATE categorias SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
      [nombre, descripcion, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }

    res.json({
      categoria: result.rows[0],
      message: 'Categoría actualizada correctamente',
    });
  } catch (err) {
    console.error('Error actualizando categoría:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.delete('/categorias/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const prodCount = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM productos WHERE categoria_id = $1',
      [id]
    );
    if (Number(prodCount.rows[0]?.count || 0) > 0) {
      res.status(409).json({
        error: 'No es posible eliminar la categoría porque tiene productos asociados.',
      });
      return;
    }

    const deleted = await getPool().query('DELETE FROM categorias WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }

    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (err) {
    console.error('Error eliminando categoría:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

export default router;
