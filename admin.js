require('dotenv').config();

const { createAdminApp } = require('./lib/adminMount');

const app = createAdminApp();
const port = process.env.ADMIN_PORT || 3002;

app.listen(port, () => {
  console.log(`admin running on ${port}`);
});
