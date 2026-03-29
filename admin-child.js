try {
  require('dotenv').config();

  const { createAdminApp } = require('./lib/adminMount');

  const app = createAdminApp();
  const port = process.env.ADMIN_PORT || 3002;

  const server = app.listen(port, () => {
    if (process.send) {
      process.send({ type: 'listening', port });
    }
    console.log(`admin running on ${port}`);
  });

  server.on('error', (error) => {
    if (process.send) {
      process.send({ type: 'error', error: error && error.stack ? error.stack : String(error) });
    }
    console.error(error);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    try { server.close(() => process.exit(0)); } catch (_) { process.exit(0); }
  });
  process.on('SIGTERM', () => {
    try { server.close(() => process.exit(0)); } catch (_) { process.exit(0); }
  });
} catch (error) {
  if (process.send) {
    process.send({ type: 'error', error: error && error.stack ? error.stack : String(error) });
  }
  console.error(error);
  process.exit(1);
}
