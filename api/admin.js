const { createAdminApp } = require('../lib/adminMount');

const adminApp = createAdminApp();
const ROOT_PREFIXES = ['/api/admin', '/admin'];

function normalizeUrl(req) {
  const originalUrl = `${req.url || '/'}`;
  for (const prefix of ROOT_PREFIXES) {
    if (originalUrl === prefix) return '/';
    if (originalUrl.startsWith(`${prefix}/`)) {
      return originalUrl.slice(prefix.length) || '/';
    }
  }
  return originalUrl;
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