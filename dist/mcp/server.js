import Fastify from 'fastify';
import { Tools } from './tools.js';
const app = Fastify({ logger: true });
app.post('/mcp/:tool', async (req, reply) => {
    const { tool } = req.params;
    const body = req.body || {};
    if (!(tool in Tools))
        return reply.code(404).send({ error: 'tool_not_found' });
    try {
        if (!body.user_id)
            throw new Error('missing user_id');
        const result = await Tools[tool](body);
        return { ok: true, result };
    }
    catch (e) {
        return reply.code(400).send({ ok: false, error: e.message });
    }
});
app.listen({ port: 9090, host: '0.0.0.0' })
    .then(() => app.log.info('MCP stub listening on :9090'))
    .catch((err) => { app.log.error(err); process.exit(1); });
