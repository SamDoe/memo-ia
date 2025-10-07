import { FastifyInstance } from 'fastify';
export default async function healthRoutes(f: FastifyInstance) {
  f.get('/health', async () => ({ ok: true }));
}