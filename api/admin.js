const { createAdminApp } = require('../lib/adminMount');

const adminApp = createAdminApp();

function normalizeUrl(req) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const queryPath = requestUrl.searchParams.get('path');
  if (queryPath) {
    return `/${queryPath.replace(/^\/+/, '')}`;
  }

  const pathname = requestUrl.pathname || '/';
  for (const prefix of ['/api/admin', '/admin']) {
    if (pathname === prefix) return '/';
    if (pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || '/';
    }
  }

  return pathname;
}

module.exports = function adminHandler(req, res) {
  const originalUrl = req.url || '/';
  req.url = normalizeUrl(req);

  return adminApp(req, res, (error) => {
    req.url = originalUrl;
    if (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: error.message || 'Admin handler failed' }));
      return;
    }
  });
};