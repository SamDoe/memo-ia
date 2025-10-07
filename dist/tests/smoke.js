import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import healthRoutes from '../routes/health.js';
import notesRoutes from '../routes/notes.js';
import { config } from '../config.js';
const baseHeaders = {
    authorization: `Bearer ${config.appToken}`,
    'x-chatgpt-user': 'user_demo',
};
const jsonHeaders = {
    ...baseHeaders,
    'content-type': 'application/json',
};
async function run() {
    const app = Fastify({ logger: false });
    await app.register(cors, { origin: false });
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
    await app.register(healthRoutes);
    await app.register(notesRoutes);
    const results = [];
    const create = await app.inject({
        method: 'POST',
        url: '/v1/notes',
        headers: jsonHeaders,
        payload: {
            title: 'Badge Parking',
            content: 'Q-3 niveau -2',
            tags: ['boulot', 'parking'],
            remind_at: '2025-10-08T09:00:00Z',
        },
    });
    const createBody = parseJson(create.body);
    results.push(['POST /v1/notes', create.statusCode, createBody]);
    const noteId = createBody?.note?.id;
    const list = await app.inject({
        method: 'GET',
        url: '/v1/notes?query=parking&tag=boulot&limit=5',
        headers: baseHeaders,
    });
    results.push(['GET /v1/notes', list.statusCode, parseJson(list.body)]);
    if (noteId) {
        const get = await app.inject({
            method: 'GET',
            url: `/v1/notes/${noteId}`,
            headers: baseHeaders,
        });
        results.push([`GET /v1/notes/${noteId}`, get.statusCode, parseJson(get.body)]);
        const patch = await app.inject({
            method: 'PATCH',
            url: `/v1/notes/${noteId}`,
            headers: jsonHeaders,
            payload: {
                title: 'Badge Parking (MAJ)',
                tags: ['parking'],
            },
        });
        results.push([`PATCH /v1/notes/${noteId}`, patch.statusCode, parseJson(patch.body)]);
        const del = await app.inject({
            method: 'DELETE',
            url: `/v1/notes/${noteId}`,
            headers: baseHeaders,
        });
        results.push([`DELETE /v1/notes/${noteId}`, del.statusCode, del.body ? parseJson(del.body) : null]);
    }
    const exportJson = await app.inject({
        method: 'POST',
        url: '/v1/export',
        headers: jsonHeaders,
        payload: { format: 'json' },
    });
    results.push(['POST /v1/export (json)', exportJson.statusCode, parseJson(exportJson.body)]);
    const exportCsv = await app.inject({
        method: 'POST',
        url: '/v1/export',
        headers: jsonHeaders,
        payload: { format: 'csv' },
    });
    results.push(['POST /v1/export (csv)', exportCsv.statusCode, exportCsv.body]);
    const purge = await app.inject({
        method: 'POST',
        url: '/v1/purge',
        headers: baseHeaders,
    });
    results.push(['POST /v1/purge', purge.statusCode, parseJson(purge.body)]);
    await app.close();
    for (const [label, status, body] of results) {
        console.log(`\n${label}`);
        console.log(`  status: ${status}`);
        console.log(`  body:`, body);
    }
}
function parseJson(value) {
    try {
        return value ? JSON.parse(value) : null;
    }
    catch {
        return value;
    }
}
run().catch((err) => {
    console.error('Smoke test failed:', err);
    process.exit(1);
});
