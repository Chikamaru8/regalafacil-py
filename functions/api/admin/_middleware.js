import { getCookieValue, verifySessionToken } from './_auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/admin/login' || url.pathname === '/api/admin/logout') {
    return next();
  }

  const token = getCookieValue(request);
  const valid = await verifySessionToken(token, env);
  if (!valid) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  return next();
}
