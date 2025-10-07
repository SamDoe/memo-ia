import { requireAuth } from '../utils/auth.js';
import { toCSV } from '../utils/csv.js';
import { createNote, deleteNote, exportNotes, getNote, listNotes, purgeNotes, updateNote, } from '../services/notes.js';
import { z } from 'zod';
const createSchema = z.object({
    title: z.string().optional(),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    remind_at: z.string().datetime().optional(),
});
const listQuerySchema = z.object({
    query: z.string().trim().min(1).optional(),
    tag: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
});
const updateSchema = z.object({
    title: z.string().nullable().optional(),
    content: z.string().min(1).optional(),
    tags: z.array(z.string()).nullable().optional(),
    remind_at: z.string().datetime().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'no_fields_to_update',
});
const exportSchema = z.object({
    format: z.enum(['json', 'csv']).default('json'),
});
export default async function notesRoutes(f) {
    const ensureUser = (req, reply) => {
        try {
            return requireAuth(req);
        }
        catch {
            reply.code(401).send({ error: 'unauthorized' });
            return undefined;
        }
    };
    f.post('/v1/notes', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const body = createSchema.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        const note = createNote(userId, body.data);
        return reply.code(201).send({ note });
    });
    f.get('/v1/notes', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const query = listQuerySchema.safeParse(req.query ?? {});
        if (!query.success)
            return reply.code(400).send({ error: query.error.flatten() });
        const { query: search, tag, limit } = query.data;
        const notes = listNotes(userId, { query: search, tag, limit });
        return reply.send({ notes });
    });
    f.get('/v1/notes/:id', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const { id } = req.params;
        const note = getNote(userId, id);
        if (!note)
            return reply.code(404).send({ error: 'not_found' });
        return reply.send({ note });
    });
    f.patch('/v1/notes/:id', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const body = updateSchema.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        const { id } = req.params;
        const updated = updateNote(userId, id, body.data);
        if (!updated)
            return reply.code(404).send({ error: 'not_found' });
        return reply.send({ note: updated });
    });
    f.delete('/v1/notes/:id', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const { id } = req.params;
        const removed = deleteNote(userId, id);
        if (!removed)
            return reply.code(404).send({ error: 'not_found' });
        return reply.code(204).send();
    });
    f.post('/v1/export', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const body = exportSchema.safeParse(req.body ?? {});
        if (!body.success)
            return reply.code(400).send({ error: body.error.flatten() });
        const notes = exportNotes(userId);
        if (body.data.format === 'csv') {
            reply.header('Content-Type', 'text/csv; charset=utf-8');
            return reply.send(toCSV(notes.map(toExportRow)));
        }
        return reply.send({ notes });
    });
    f.post('/v1/purge', async (req, reply) => {
        const userId = ensureUser(req, reply);
        if (!userId)
            return;
        const purged = purgeNotes(userId);
        return reply.send({ purged });
    });
}
function toExportRow(note) {
    return {
        id: note.id,
        title: note.title ?? '',
        content: note.content,
        tags: note.tags.join(';'),
        remind_at: note.remind_at ?? '',
        created_at: note.created_at,
        updated_at: note.updated_at,
    };
}
