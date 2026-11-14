import { Router } from 'express';
import { getPool, withTransaction } from '../db.js';
import { AuthenticatedRequest, requireAdmin, requireAuth } from '../auth.js';

const router = Router();

router.get('/productos', requireAuth, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : null;
    const proveedorId = req.query.proveedorId ? Number(req.query.proveedorId) : null;
    const disponibilidad = String(req.query.disponibilidad || 'todos');
    const sortBy = String(req.query.sortBy || 'fecha_creacion');
    const sortDir = String(req.query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 12)));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(p.nombre ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`);
    }
    if (categoriaId) {
      params.push(categoriaId);
      whereClauses.push(`p.categoria_id = $${params.length}`);
    }
    if (proveedorId) {
      params.push(proveedorId);
      whereClauses.push(`p.proveedor_id = $${params.length}`);
    }

    if (disponibilidad === 'disponible') {
      whereClauses.push('p.activo = TRUE AND p.stock_actual > p.stock_minimo');
    } else if (disponibilidad === 'stock_bajo') {
      whereClauses.push('p.activo = TRUE AND p.stock_actual > 0 AND p.stock_actual <= p.stock_minimo');
    } else if (disponibilidad === 'agotado') {
      whereClauses.push('p.activo = TRUE AND p.stock_actual = 0');
    } else if (disponibilidad === 'inactivos') {
      whereClauses.push('p.activo = FALSE');
    } else if (disponibilidad === 'activos') {
      whereClauses.push('p.activo = TRUE');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sortColumns: Record<string, string> = {
      codigo: 'p.codigo',
      nombre: 'p.nombre',
      stock_actual: 'p.stock_actual',
      precio_compra: 'p.precio_compra',
      precio_venta: 'p.precio_venta',
      fecha_creacion: 'p.fecha_creacion',
    };
    const orderColumn = sortColumns[sortBy] || 'p.fecha_creacion';

    const countQuery = `SELECT COUNT(*)::int AS total FROM productos p ${whereSql}`;
    const countRes = await getPool().query<{ total: number }>(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT
        p.*,
        COALESCE(c.nombre, 'Sin categoría') AS categoria_nombre,
        COALESCE(pr.nombre_empresa, 'Sin proveedor') AS proveedor_nombre,
        (SELECT COUNT(*)::int FROM movimientos_inventario m WHERE m.producto_id = p.id) AS total_movimientos,
        CASE
          WHEN p.stock_actual = 0 THEN 'agotado'
          WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
          ELSE 'disponible'
        END AS estado_stock
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      ${whereSql}
      ORDER BY ${orderColumn} ${sortDir}, p.id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const result = await getPool().query(dataQuery, dataParams);
    res.json({
      productos: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error('Error listando productos:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.get('/productos/catalogo', requireAuth, async (_req, res) => {
  try {
    const result = await getPool().query(`
      SELECT
        p.id, p.codigo, p.nombre, p.precio_compra, p.precio_venta,
        p.stock_actual, p.stock_minimo, p.categoria_id, p.proveedor_id, p.activo,
        COALESCE(c.nombre, 'Sin categoría') AS categoria_nombre,
        COALESCE(pr.nombre_empresa, 'Sin proveedor') AS proveedor_nombre
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
      WHERE p.activo = TRUE
      ORDER BY p.nombre ASC
    `);
    res.json({ productos: result.rows });
  } catch (err) {
    console.error('Error cargando catálogo:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.get('/productos/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const [prodRes, movRes] = await Promise.all([
      getPool().query(
        `SELECT p.*, COALESCE(c.nombre, 'Sin categoría') AS categoria_nombre,
          COALESCE(pr.nombre_empresa, 'Sin proveedor') AS proveedor_nombre,
          CASE
            WHEN p.stock_actual = 0 THEN 'agotado'
            WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
            ELSE 'disponible'
          END AS estado_stock
         FROM productos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
         WHERE p.id = $1`,
        [id]
      ),
      getPool().query(
        `SELECT m.*, u.nombre AS usuario_nombre, pr.nombre_empresa AS proveedor_nombre
         FROM movimientos_inventario m
         JOIN usuarios u ON u.id = m.usuario_id
         LEFT JOIN proveedores pr ON pr.id = m.proveedor_id
         WHERE m.producto_id = $1
         ORDER BY m.fecha_movimiento DESC, m.id DESC
         LIMIT 15`,
        [id]
      ),
    ]);

    if (prodRes.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    res.json({ producto: prodRes.rows[0], movimientos: movRes.rows });
  } catch (err) {
    console.error('Error consultando producto:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/productos/inicializar-catalogo', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await withTransaction(async (client) => {
      const existingCount = await client.query<{ total: number }>(
        'SELECT COUNT(*)::int AS total FROM productos'
      );
      if ((existingCount.rows[0]?.total || 0) > 0) {
        return { alreadyPopulated: true, createdCount: 0 };
      }

      const categoryDefs = [
        {
          nombre: 'Tecnología y Cómputo',
          descripcion: 'Equipos portátiles, monitores, periféricos y estaciones de trabajo',
        },
        {
          nombre: 'Redes y Conectividad',
          descripcion: 'Switches, routers empresariales, cableado estructurado y puntos de acceso',
        },
        {
          nombre: 'Suministros de Oficina',
          descripcion: 'Papelería, consumibles de impresión y artículos operativos',
        },
        {
          nombre: 'Mobiliario Corporativo',
          descripcion: 'Sillas ergonómicas, escritorios modulares y archivadores',
        },
      ];

      const catIds: Record<string, number> = {};
      for (const cat of categoryDefs) {
        const found = await client.query<{ id: number }>(
          'SELECT id FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
          [cat.nombre]
        );
        if (found.rows.length > 0) {
          catIds[cat.nombre] = found.rows[0].id;
        } else {
          const inserted = await client.query<{ id: number }>(
            'INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2) RETURNING id',
            [cat.nombre, cat.descripcion]
          );
          catIds[cat.nombre] = inserted.rows[0].id;
        }
      }

      const supplierDefs = [
        {
          nombre_empresa: 'TechSupply Colombia S.A.S.',
          identificacion: '900.412.880-1',
          contacto: 'Carlos Mendoza',
          telefono: '+57 310 442 1980',
          correo: 'ventas@techsupply.co',
          direccion: 'Av. El Dorado # 68C-61',
          ciudad: 'Bogotá',
          observaciones: 'Proveedor principal de hardware y pantallas empresariales',
        },
        {
          nombre_empresa: 'Conectividad Global Ltda.',
          identificacion: '830.119.540-3',
          contacto: 'Ana María Pardo',
          telefono: '+57 315 789 3310',
          correo: 'comercial@conectividadglobal.com',
          direccion: 'Calle 10 # 43E-25',
          ciudad: 'Medellín',
          observaciones: 'Equipos de red y cableado certificado',
        },
        {
          nombre_empresa: 'OfiCentral Distribuciones',
          identificacion: '901.205.774-9',
          contacto: 'Julián Restrepo',
          telefono: '+57 300 612 4590',
          correo: 'pedidos@oficentral.co',
          direccion: 'Cra. 52 # 18-40',
          ciudad: 'Cali',
          observaciones: 'Suministros de oficina y mobiliario corporativo',
        },
      ];

      const provIds: Record<string, number> = {};
      for (const sup of supplierDefs) {
        const found = await client.query<{ id: number }>(
          'SELECT id FROM proveedores WHERE identificacion = $1 LIMIT 1',
          [sup.identificacion]
        );
        if (found.rows.length > 0) {
          provIds[sup.nombre_empresa] = found.rows[0].id;
        } else {
          const inserted = await client.query<{ id: number }>(
            `INSERT INTO proveedores
              (nombre_empresa, identificacion, contacto, telefono, correo, direccion, ciudad, observaciones, activo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
             RETURNING id`,
            [
              sup.nombre_empresa,
              sup.identificacion,
              sup.contacto,
              sup.telefono,
              sup.correo,
              sup.direccion,
              sup.ciudad,
              sup.observaciones,
            ]
          );
          provIds[sup.nombre_empresa] = inserted.rows[0].id;
        }
      }

      const starterProducts = [
        {
          codigo: 'TEC-001',
          nombre: 'Monitor LED Corporativo 24" Full HD',
          descripcion: 'Panel IPS antirreflejo HDMI/DisplayPort con ajuste de inclinación',
          cat: 'Tecnología y Cómputo',
          prov: 'TechSupply Colombia S.A.S.',
          precio_compra: 480000,
          precio_venta: 690000,
          stock_actual: 18,
          stock_minimo: 5,
        },
        {
          codigo: 'TEC-002',
          nombre: 'Portátil Empresarial 14" Core i5 16GB',
          descripcion: 'SSD NVMe 512GB, chasis aluminio, Windows 11 Pro',
          cat: 'Tecnología y Cómputo',
          prov: 'TechSupply Colombia S.A.S.',
          precio_compra: 2450000,
          precio_venta: 3250000,
          stock_actual: 4,
          stock_minimo: 5,
        },
        {
          codigo: 'RED-001',
          nombre: 'Switch Gigabit Administrable 24 Puertos',
          descripcion: 'Switch rackeable Capa 2 con 4 puertos SFP uplink',
          cat: 'Redes y Conectividad',
          prov: 'Conectividad Global Ltda.',
          precio_compra: 720000,
          precio_venta: 980000,
          stock_actual: 9,
          stock_minimo: 3,
        },
        {
          codigo: 'RED-002',
          nombre: 'Cable Patch Cord Cat6A 3m Certificado',
          descripcion: 'Cable de red blindado S/FTP para centros de cableado',
          cat: 'Redes y Conectividad',
          prov: 'Conectividad Global Ltda.',
          precio_compra: 18500,
          precio_venta: 32000,
          stock_actual: 3,
          stock_minimo: 10,
        },
        {
          codigo: 'OFI-001',
          nombre: 'Resma Papel Carta 75g Caja x 10',
          descripcion: 'Caja de 10 resmas de 500 hojas alta blancura',
          cat: 'Suministros de Oficina',
          prov: 'OfiCentral Distribuciones',
          precio_compra: 145000,
          precio_venta: 198000,
          stock_actual: 25,
          stock_minimo: 8,
        },
        {
          codigo: 'MOB-001',
          nombre: 'Silla Ergonómica Gerencial Malla Negra',
          descripcion: 'Soporte lumbar regulable, brazos 3D y base cromada',
          cat: 'Mobiliario Corporativo',
          prov: 'OfiCentral Distribuciones',
          precio_compra: 420000,
          precio_venta: 640000,
          stock_actual: 11,
          stock_minimo: 4,
        },
      ];

      let createdCount = 0;
      for (const item of starterProducts) {
        const exists = await client.query(
          'SELECT id FROM productos WHERE UPPER(codigo) = $1 LIMIT 1',
          [item.codigo]
        );
        if (exists.rows.length > 0) continue;

        const insertedProd = await client.query<{ id: number }>(
          `INSERT INTO productos
            (codigo, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock_actual, stock_minimo, activo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
           RETURNING id`,
          [
            item.codigo,
            item.nombre,
            item.descripcion,
            catIds[item.cat],
            provIds[item.prov],
            item.precio_compra,
            item.precio_venta,
            item.stock_actual,
            item.stock_minimo,
          ]
        );

        await client.query(
          `INSERT INTO movimientos_inventario
            (producto_id, tipo_movimiento, cantidad, stock_resultante, precio_unitario, proveedor_id, usuario_id, numero_factura, observaciones)
           VALUES ($1, 'entrada', $2, $2, $3, $4, $5, 'INV-INICIAL-001', 'Carga inicial de catálogo en PostgreSQL')`,
          [
            insertedProd.rows[0].id,
            item.stock_actual,
            item.precio_compra,
            provIds[item.prov],
            req.user!.id,
          ]
        );
        createdCount++;
      }

      return { alreadyPopulated: false, createdCount };
    });

    if (summary.alreadyPopulated) {
      res.status(409).json({ error: 'El inventario ya contiene productos registrados' });
      return;
    }

    res.status(201).json({
      createdCount: summary.createdCount,
      message: `Catálogo inicial cargado correctamente (${summary.createdCount} productos registrados en PostgreSQL)`,
    });
  } catch (err) {
    console.error('Error inicializando catálogo:', err);
    res.status(500).json({ error: 'No fue posible inicializar el catálogo' });
  }
});

router.post('/productos', requireAuth, requireAdmin, async (req, res) => {
  try {
    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const categoriaId = Number(req.body?.categoria_id);
    const proveedorId = Number(req.body?.proveedor_id);
    const precioCompra = Number(req.body?.precio_compra);
    const precioVenta = Number(req.body?.precio_venta);
    const stockActual = Number(req.body?.stock_actual ?? 0);
    const stockMinimo = Number(req.body?.stock_minimo ?? 5);

    if (
      !codigo ||
      !nombre ||
      !categoriaId ||
      !proveedorId ||
      Number.isNaN(precioCompra) ||
      Number.isNaN(precioVenta) ||
      Number.isNaN(stockActual) ||
      Number.isNaN(stockMinimo) ||
      precioCompra < 0 ||
      precioVenta < 0 ||
      stockActual < 0 ||
      stockMinimo < 0 ||
      !Number.isInteger(stockActual) ||
      !Number.isInteger(stockMinimo)
    ) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query('SELECT id FROM productos WHERE UPPER(codigo) = $1', [codigo]);
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'El código del producto ya existe' });
      return;
    }

    const inserted = await getPool().query(
      `INSERT INTO productos
        (codigo, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock_actual, stock_minimo, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       RETURNING *`,
      [codigo, nombre, descripcion, categoriaId, proveedorId, precioCompra, precioVenta, stockActual, stockMinimo]
    );

    res.status(201).json({
      producto: inserted.rows[0],
      message: 'Producto registrado correctamente',
    });
  } catch (err: unknown) {
    console.error('Error registrando producto:', err);
    const pgCode = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : '';
    if (pgCode === '23505') {
      res.status(409).json({ error: 'El código del producto ya existe' });
      return;
    }
    if (pgCode === '23503') {
      res.status(400).json({ error: 'La categoría o el proveedor seleccionado no existe' });
      return;
    }
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.put('/productos/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const codigo = String(req.body?.codigo || '').trim().toUpperCase();
    const nombre = String(req.body?.nombre || '').trim();
    const descripcion = String(req.body?.descripcion || '').trim();
    const categoriaId = Number(req.body?.categoria_id);
    const proveedorId = Number(req.body?.proveedor_id);
    const precioCompra = Number(req.body?.precio_compra);
    const precioVenta = Number(req.body?.precio_venta);
    const stockMinimo = Number(req.body?.stock_minimo ?? 5);
    const activo = typeof req.body?.activo === 'boolean' ? req.body.activo : true;

    if (
      !id ||
      !codigo ||
      !nombre ||
      !categoriaId ||
      !proveedorId ||
      Number.isNaN(precioCompra) ||
      Number.isNaN(precioVenta) ||
      Number.isNaN(stockMinimo) ||
      precioCompra < 0 ||
      precioVenta < 0 ||
      stockMinimo < 0 ||
      !Number.isInteger(stockMinimo)
    ) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM productos WHERE UPPER(codigo) = $1 AND id <> $2',
      [codigo, id]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'El código del producto ya existe' });
      return;
    }

    const updated = await getPool().query(
      `UPDATE productos
       SET codigo = $1,
           nombre = $2,
           descripcion = $3,
           categoria_id = $4,
           proveedor_id = $5,
           precio_compra = $6,
           precio_venta = $7,
           stock_minimo = $8,
           activo = $9
       WHERE id = $10
       RETURNING *`,
      [codigo, nombre, descripcion, categoriaId, proveedorId, precioCompra, precioVenta, stockMinimo, activo, id]
    );

    if (updated.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    res.json({
      producto: updated.rows[0],
      message: 'Inventario actualizado',
    });
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.delete('/productos/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const movCount = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM movimientos_inventario WHERE producto_id = $1',
      [id]
    );

    if (Number(movCount.rows[0]?.count || 0) > 0) {
      const deactivated = await getPool().query(
        'UPDATE productos SET activo = FALSE WHERE id = $1 RETURNING *',
        [id]
      );
      if (deactivated.rows.length === 0) {
        res.status(404).json({ error: 'Producto no encontrado' });
        return;
      }
      res.json({
        deactivated: true,
        producto: deactivated.rows[0],
        message: 'El producto tiene movimientos históricos asociados y fue desactivado de forma segura',
      });
      return;
    }

    const deleted = await getPool().query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
    if (deleted.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado' });
      return;
    }

    res.json({ deactivated: false, message: 'Producto eliminado' });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

export default router;
