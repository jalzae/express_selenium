const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.FRONTEND_PORT || 3102;

app.use(express.static(path.join(__dirname, 'dashboard', 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend serving on http://localhost:${PORT}`);
});
