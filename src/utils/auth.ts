import { FastifyRequest } from 'fastify';
import { config } from '../config.js';

export function requireAuth(req: FastifyRequest): string {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== config.appToken) throw new Error('Unauthorized');
  const user = req.headers['x-chatgpt-user'];
  if (!user || Array.isArray(user)) throw new Error('Missing X-ChatGPT-User');
  return user;
}