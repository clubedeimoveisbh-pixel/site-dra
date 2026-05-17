const express = require('express');
const path    = require('path');
const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html',
}));

// SPA fallback — redireciona qualquer rota desconhecida para index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Marina Trabalhista — preview na porta ${PORT}`));
