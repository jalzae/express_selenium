const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.FRONTEND_PORT || 3102;
const API_PORT = process.env.API_PORT || 3103;

// Proxy API requests to backend
app.use('/api', (req, res, next) => {
  const options = {
    hostname: 'localhost',
    port: API_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${API_PORT}` }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  });

  req.pipe(proxyReq);
});

app.use(express.static(path.join(__dirname, 'dashboard', 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend serving on http://localhost:${PORT}`);
});
