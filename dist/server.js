import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
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
app.get('/openapi.yaml', async (_req, reply) => {
    const file = await readFile(path.resolve('openapi.yaml'), 'utf8');
    reply.type('application/yaml').send(file);
});
app.get('/app.json', async (_req, reply) => {
    const file = await readFile(path.resolve('src/app.json'), 'utf8');
    reply.type('application/json').send(JSON.parse(file));
});
app.listen({ port: config.port, host: config.host })
    .then(() => app.log.info(`Memo-IA API listening on :${config.port}`))
    .catch((err) => { app.log.error(err); process.exit(1); });
