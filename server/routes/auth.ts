import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getPool } from '../db.js';
import {
  AuthenticatedRequest,
  AuthUser,
  CSRF_COOKIE_NAME,
  clearAuthCookies,
  requireAdmin,
  requireAuth,
  setAuthCookies,
} from '../auth.js';

const router = Router();

function getFirebaseApiKey(): string {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as { apiKey?: string };
  if (!parsed.apiKey) {
    throw new Error('Firebase apiKey no encontrada en firebase-applet-config.json');
  }
  return parsed.apiKey;
}

router.post('/auth/login', async (req, res) => {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!correo || !password) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    const result = await getPool().query<AuthUser & { password_hash: string; auth_provider?: string }>(
      'SELECT id, nombre, correo, password_hash, rol, activo, auth_provider FROM usuarios WHERE LOWER(correo) = $1',
      [correo]
    );

    const userRow = result.rows[0];
    if (!userRow) {
      res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
      return;
    }

    if (!userRow.activo) {
      res.status(403).json({ error: 'Esta cuenta se encuentra desactivada. Contacta al administrador.' });
      return;
    }

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas. Verifica tu correo y contraseña.' });
      return;
    }

    const user: AuthUser = {
      id: userRow.id,
      nombre: userRow.nombre,
      correo: userRow.correo,
      rol: userRow.rol,
      activo: userRow.activo,
    };

    const { token, csrfToken } = setAuthCookies(req, res, user);
    res.json({ user, token, csrfToken });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/auth/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || '').trim();
    const bearerHeader = req.headers.authorization;
    const accessToken =
      bearerHeader && bearerHeader.startsWith('Bearer ')
        ? bearerHeader.slice(7).trim()
        : String(req.body?.accessToken || '').trim();

    if (!idToken && !accessToken) {
      res.status(400).json({ error: 'Token de autenticación de Google requerido.' });
      return;
    }

    let verifiedEmail = '';
    let verifiedName = '';
    let emailVerified = false;

    if (idToken) {
      const apiKey = getFirebaseApiKey();
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );

      if (!lookupRes.ok) {
        res.status(401).json({ error: 'No se pudo verificar la identidad de Google.' });
        return;
      }

      const lookupData = (await lookupRes.json()) as {
        users?: Array<{
          email?: string;
          emailVerified?: boolean;
          displayName?: string;
        }>;
      };

      const fbUser = lookupData.users?.[0];
      if (!fbUser?.email) {
        res.status(401).json({ error: 'La cuenta de Google no devolvió un correo válido.' });
        return;
      }
      verifiedEmail = fbUser.email.trim().toLowerCase();
      verifiedName = (fbUser.displayName || verifiedEmail.split('@')[0]).trim();
      emailVerified = Boolean(fbUser.emailVerified);
    } else if (accessToken) {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userInfoRes.ok) {
        res.status(401).json({ error: 'Token de acceso de Google inválido o expirado.' });
        return;
      }
      const profile = (await userInfoRes.json()) as {
        email?: string;
        email_verified?: boolean;
        name?: string;
      };
      if (!profile.email) {
        res.status(401).json({ error: 'La cuenta de Google no devolvió un correo válido.' });
        return;
      }
      verifiedEmail = profile.email.trim().toLowerCase();
      verifiedName = (profile.name || verifiedEmail.split('@')[0]).trim();
      emailVerified = Boolean(profile.email_verified);
    }

    if (!emailVerified) {
      res.status(403).json({
        error: 'Tu cuenta de Google debe tener el correo electrónico verificado.',
      });
      return;
    }

    const db = getPool();
    const existingRes = await db.query<AuthUser>(
      'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE LOWER(correo) = $1',
      [verifiedEmail]
    );

    let user: AuthUser;
    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (!existing.activo) {
        res.status(403).json({
          error: 'Esta cuenta se encuentra desactivada. Contacta al administrador.',
        });
        return;
      }
      user = existing;
    } else {
      const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
      const assignedRole = ownerEmail && verifiedEmail === ownerEmail ? 'administrador' : 'empleado';
      const randomSecret = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomSecret, 12);

      const inserted = await db.query<AuthUser>(
        `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo, auth_provider)
         VALUES ($1, $2, $3, $4, TRUE, 'google')
         RETURNING id, nombre, correo, rol, activo`,
        [verifiedName, verifiedEmail, passwordHash, assignedRole]
      );
      user = inserted.rows[0];
    }

    const { token, csrfToken } = setAuthCookies(req, res, user);
    res.json({ user, token, csrfToken });
  } catch (err) {
    console.error('Error en login con Google:', err);
    res.status(500).json({ error: 'No fue posible completar el inicio de sesión con Google' });
  }
});

router.post('/auth/logout', (req, res) => {
  clearAuthCookies(req, res);
  res.json({ message: 'Sesión cerrada correctamente' });
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const { token, csrfToken } = setAuthCookies(req, res, req.user!);
  res.json({ user: req.user, token, csrfToken });
});

// Admin-controlled User Management
router.get('/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await getPool().query(
      `SELECT id, nombre, correo, rol, activo, fecha_creacion
       FROM usuarios
       ORDER BY id ASC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Error listando usuarios:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const rol = req.body?.rol === 'administrador' ? 'administrador' : 'empleado';

    if (!nombre || !correo || password.length < 6) {
      res.status(400).json({
        error: 'Verifica los datos ingresados. La contraseña debe tener al menos 6 caracteres.',
      });
      return;
    }

    const existing = await getPool().query('SELECT id FROM usuarios WHERE LOWER(correo) = $1', [correo]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Ya existe un usuario registrado con ese correo electrónico.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await getPool().query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, nombre, correo, rol, activo, fecha_creacion`,
      [nombre, correo, passwordHash, rol]
    );

    res.status(201).json({
      user: created.rows[0],
      message: 'Usuario registrado correctamente',
    });
  } catch (err) {
    console.error('Error creando usuario:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

router.patch('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const nombre = String(req.body?.nombre || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const rol = req.body?.rol === 'administrador' ? 'administrador' : 'empleado';
    const activo = typeof req.body?.activo === 'boolean' ? req.body.activo : true;
    const newPassword = req.body?.password ? String(req.body.password) : '';

    if (!targetId || !nombre || !correo) {
      res.status(400).json({ error: 'Verifica los datos ingresados' });
      return;
    }

    if (req.user!.id === targetId && !activo) {
      res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador.' });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    const dup = await getPool().query(
      'SELECT id FROM usuarios WHERE LOWER(correo) = $1 AND id <> $2',
      [correo, targetId]
    );
    if (dup.rows.length > 0) {
      res.status(409).json({ error: 'Ese correo electrónico ya pertenece a otro usuario.' });
      return;
    }

    let result;
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      result = await getPool().query(
        `UPDATE usuarios
         SET nombre = $1, correo = $2, rol = $3, activo = $4, password_hash = $5
         WHERE id = $6
         RETURNING id, nombre, correo, rol, activo, fecha_creacion`,
        [nombre, correo, rol, activo, hash, targetId]
      );
    } else {
      result = await getPool().query(
        `UPDATE usuarios
         SET nombre = $1, correo = $2, rol = $3, activo = $4
         WHERE id = $5
         RETURNING id, nombre, correo, rol, activo, fecha_creacion`,
        [nombre, correo, rol, activo, targetId]
      );
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ user: result.rows[0], message: 'Usuario actualizado correctamente' });
  } catch (err) {
    console.error('Error actualizando usuario:', err);
    res.status(500).json({ error: 'No fue posible completar la operación' });
  }
});

export default router;
