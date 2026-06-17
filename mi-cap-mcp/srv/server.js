const cds = require('@sap/cds');


cds.on('bootstrap', (app) => {
  const allowed = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowed.length === 0 || allowed.includes(origin))) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Credentials', 'true');
    }
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,X-Requested-With,X-CSRF-Token');
    res.set('Access-Control-Expose-Headers', 'X-CSRF-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
});

/** Despliegue del schema + seed a la SQLite en memoria al arrancar en producción. */
cds.on('served', async () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('[bootstrap] desplegando schema y CSV a SQLite en memoria...');
    await cds.deploy('*').to('db');
    console.log('[bootstrap] listo.');
  }
});
