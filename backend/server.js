const env = require('./config/env');
const app = require('./app');
const { run: migrate } = require('./scripts/migrate');

migrate()
  .then(() => {
    const server = app.listen(env.port, '0.0.0.0', () => {
      console.log(`HCS DERMA API listening on port ${env.port} (${env.nodeEnv})`);
      if (env.nodeEnv !== 'production') {
        console.log(`MySQL target: ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}`);
      }
    });
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  })
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  });
