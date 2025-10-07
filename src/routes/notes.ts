import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import db from '../db.js';
import { requireAuth } from '../utils/auth.js';
import { toCSV } from '../utils/csv.js';
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

export default async function notesRoutes(f: FastifyInstance) {
  const ensureUser = (req: FastifyRequest, reply: FastifyReply): string | undefined => {
    try {
      return requireAuth(req);
    } catch {
      reply.code(401).send({ error: 'unauthorized' });
      return undefined;
    }
  };

  f.post('/v1/notes', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const body = createSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const id = randomUUID();
    const { title, content, tags, remind_at } = body.data;
    db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
    db.prepare(`INSERT INTO notes (id,user_id,title,content,tags,remind_at) VALUES (@id,@user_id,@title,@content,@tags,@remind_at)`).run({
      id, user_id: userId, title: title ?? null, content,
      tags: tags ? JSON.stringify(tags) : null, remind_at: remind_at ?? null
    });
    const created = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
    return reply.code(201).send({ note: mapNote(created) });
  });

  f.get('/v1/notes', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const query = listQuerySchema.safeParse(req.query ?? {});
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() });
    const { query: search, tag, limit } = query.data;
    const conditions = ['user_id = @user_id'];
    const params: Record<string, unknown> = { user_id: userId, limit: limit ?? 50 };
    if (search) {
      conditions.push(`(LOWER(IFNULL(title, '')) LIKE @search OR LOWER(content) LIKE @search)`);
      params.search = `%${search.toLowerCase()}%`;
    }
    if (tag) {
      conditions.push(`tags IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = @tag)`);
      params.tag = tag;
    }
    const rows = db.prepare(
      `SELECT * FROM notes WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT @limit`
    ).all(params);
    return reply.send({ notes: rows.map(mapNote) });
  });

  f.get('/v1/notes/:id', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };
    const note = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
    if (!note) return reply.code(404).send({ error: 'not_found' });
    return reply.send({ note: mapNote(note) });
  });

  f.patch('/v1/notes/:id', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const body = updateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const { id } = req.params as { id: string };
    const fields: string[] = [];
    const params: Record<string, unknown> = { id, user_id: userId };
    if ('title' in body.data) {
      fields.push('title = @title');
      params.title = body.data.title ?? null;
    }
    if ('content' in body.data) {
      fields.push('content = @content');
      params.content = body.data.content;
    }
    if ('tags' in body.data) {
      fields.push('tags = @tags');
      params.tags = Array.isArray(body.data.tags)
        ? JSON.stringify(body.data.tags)
        : null;
    }
    if ('remind_at' in body.data) {
      fields.push('remind_at = @remind_at');
      params.remind_at = body.data.remind_at ?? null;
    }
    if (fields.length === 0) return reply.code(400).send({ error: 'no_fields_to_update' });
    fields.push(`updated_at = datetime('now')`);
    const result = db.prepare(
      `UPDATE notes SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`
    ).run(params);
    if (result.changes === 0) return reply.code(404).send({ error: 'not_found' });
    const updated = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
    return reply.send({ note: mapNote(updated) });
  });

  f.delete('/v1/notes/:id', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const { id } = req.params as { id: string };
    const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return reply.code(404).send({ error: 'not_found' });
    return reply.code(204).send();
  });

  f.post('/v1/export', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const body = exportSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const rows = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    const notes = rows.map(mapNote);
    if (body.data.format === 'csv') {
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      return reply.send(toCSV(notes.map(toExportRow)));
    }
    return reply.send({ notes });
  });

  f.post('/v1/purge', async (req, reply) => {
    const userId = ensureUser(req, reply);
    if (!userId) return;
    const result = db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
    return reply.send({ purged: result.changes });
  });
}

function mapNote(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title ?? null,
    content: row.content,
    tags: parseTags(row.tags),
    remind_at: row.remind_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function toExportRow(note: ReturnType<typeof mapNote>) {
  return {
    id: note?.id ?? '',
    title: note?.title ?? '',
    content: note?.content ?? '',
    tags: (note?.tags ?? []).join(';'),
    remind_at: note?.remind_at ?? '',
    created_at: note?.created_at ?? '',
    updated_at: note?.updated_at ?? '',
  };
}
