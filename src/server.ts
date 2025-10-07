import Fastify from 'fastify';
import { config } from './config.js';
import healthRoutes from './routes/health.js';
import notesRoutes from './routes/notes.js';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });
await app.register(cors, { origin: false });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
await app.register(healthRoutes);
await app.register(notesRoutes);
app.listen({ port: config.port, host: '0.0.0.0' })
  .then(() => app.log.info(`Memo-IA API listening on :${config.port}`))
  .catch((err) => { app.log.error(err); process.exit(1); });