import { getSession } from './_auth.js';

export async function onRequest({ request, env, data, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/admin/login' || url.pathname === '/api/admin/logout') {
    return next();
  }

  const session = await getSession(request, env);
  if (!session) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (data) {
    data.session = session;
  }

  return next();
}