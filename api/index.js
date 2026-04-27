const path = require('path');
const fs = require('fs');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(404).json({ error: 'Not found' });
  }

  // Serve index.html for root route
  const indexPath = path.join(__dirname, '../public/index.html');
  
  try {
    const html = fs.readFileSync(indexPath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    console.error('[api/index.js] Failed to read index.html:', error);
    res.status(500).json({ error: 'Unable to load homepage' });
  }
};
