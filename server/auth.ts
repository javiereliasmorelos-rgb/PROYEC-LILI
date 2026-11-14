import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getPool } from './db.js';

export type UserRole = 'administrador' | 'empleado';

export interface AuthUser {
  id: number;
  nombre: string;
  correo: string;
  rol: UserRole;
  activo: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const TOKEN_COOKIE_NAME = 'inventpro_token';
export const CSRF_COOKIE_NAME = 'inventpro_csrf';

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'inventpro_fallback_dev_secret_change_in_prod';
}

export function deriveCsrfToken(sessionToken: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(sessionToken)
    .digest('hex');
}

export function isHttpsRequest(req: Request): boolean {
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim() === 'https';
  }
  return req.secure;
}

export function extractSessionToken(req: Request): string | null {
  const cookieToken = req.cookies?.[TOKEN_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim()) {
    return cookieToken.trim();
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  return null;
}

export function setAuthCookies(
  req: Request,
  res: Response,
  user: AuthUser
): { token: string; csrfToken: string } {
  const token = jwt.sign(
    {
      sub: user.id,
      rol: user.rol,
      correo: user.correo,
    },
    getSessionSecret(),
    { expiresIn: '12h' }
  );
  const csrfToken = deriveCsrfToken(token);
  const secure = isHttpsRequest(req);
  const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';

  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });

  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });

  return { token, csrfToken };
}

export function clearAuthCookies(req: Request, res: Response): void {
  const secure = isHttpsRequest(req);
  const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';
  res.clearCookie(TOKEN_COOKIE_NAME, { path: '/', secure, sameSite });
  res.clearCookie(CSRF_COOKIE_NAME, { path: '/', secure, sameSite });
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      res.status(401).json({ error: 'Sesión no autenticada. Inicia sesión para continuar.' });
      return;
    }

    const decoded = jwt.verify(token, getSessionSecret()) as unknown as { sub: number | string };
    const result = await getPool().query<AuthUser>(
      'SELECT id, nombre, correo, rol, activo FROM usuarios WHERE id = $1',
      [Number(decoded.sub)]
    );

    const user = result.rows[0];
    if (!user || !user.activo) {
      clearAuthCookies(req, res);
      res.status(401).json({ error: 'Tu usuario se encuentra inactivo o no existe.' });
      return;
    }

    req.user = user;
    next();
  } catch {
    clearAuthCookies(req, res);
    res.status(401).json({ error: 'Sesión expirada o inválida. Vuelve a iniciar sesión.' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.rol !== 'administrador') {
    res.status(403).json({
      error: 'Acceso denegado. Esta operación requiere privilegios de administrador.',
    });
    return;
  }
  next();
}

export function csrfGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    next();
    return;
  }
  // Pre-session login and logout endpoints
  if (
    req.path === '/api/auth/login' ||
    req.path === '/api/auth/google' ||
    req.path === '/api/auth/logout'
  ) {
    next();
    return;
  }

  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !headerToken) {
    res.status(403).json({ error: 'Validación CSRF inválida. Recarga la sesión e inténtalo nuevamente.' });
    return;
  }

  const cookieCsrf = req.cookies?.[CSRF_COOKIE_NAME];
  if (typeof cookieCsrf === 'string' && cookieCsrf === headerToken) {
    next();
    return;
  }

  // Fallback for iframe environments blocking third-party cookies:
  // validate X-CSRF-Token against the HMAC derived from the verified Bearer JWT
  const sessionToken = extractSessionToken(req);
  if (sessionToken) {
    try {
      jwt.verify(sessionToken, getSessionSecret());
      const expected = deriveCsrfToken(sessionToken);
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(headerToken, 'utf8');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        next();
        return;
      }
    } catch {
      // fall through to 403
    }
  }

  res.status(403).json({ error: 'Validación CSRF inválida. Recarga la sesión e inténtalo nuevamente.' });
}
