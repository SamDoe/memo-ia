import { randomUUID } from 'node:crypto';
import db from '../db.js';

export type NoteRow = {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  tags: string | null;
  remind_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotePayload = {
  id: string;
  title: string | null;
  content: string;
  tags: string[];
  remind_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateNoteInput = {
  title?: string;
  content: string;
  tags?: string[];
  remind_at?: string;
};

export type UpdateNoteInput = {
  title?: string | null;
  content?: string;
  tags?: string[] | null;
  remind_at?: string | null;
};

export type ListNotesInput = {
  query?: string;
  tag?: string;
  limit?: number;
};

export type ExportFormat = 'json' | 'csv';

export function ensureUser(userId: string) {
  db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}

export function createNote(userId: string, data: CreateNoteInput): NotePayload {
  ensureUser(userId);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO notes (id,user_id,title,content,tags,remind_at)
     VALUES (@id,@user_id,@title,@content,@tags,@remind_at)`
  ).run({
    id,
    user_id: userId,
    title: data.title ?? null,
    content: data.content,
    tags: data.tags ? JSON.stringify(data.tags) : null,
    remind_at: data.remind_at ?? null,
  });
  const created = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId) as NoteRow;
  return mapNote(created);
}

export function listNotes(userId: string, filters: ListNotesInput = {}): NotePayload[] {
  ensureUser(userId);
  const conditions = ['user_id = @user_id'];
  const params: Record<string, unknown> = { user_id: userId, limit: filters.limit ?? 50 };
  if (filters.query) {
    conditions.push(`(LOWER(IFNULL(title, '')) LIKE @search OR LOWER(content) LIKE @search)`);
    params.search = `%${filters.query.toLowerCase()}%`;
  }
  if (filters.tag) {
    conditions.push(`tags IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = @tag)`);
    params.tag = filters.tag;
  }
  const rows = db.prepare(
    `SELECT * FROM notes WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT @limit`
  ).all(params) as NoteRow[];
  return rows.map(mapNote);
}

export function getNote(userId: string, noteId: string): NotePayload | null {
  const row = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId) as NoteRow | undefined;
  return row ? mapNote(row) : null;
}

export function updateNote(userId: string, noteId: string, data: UpdateNoteInput): NotePayload | null {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id: noteId, user_id: userId };
  if (Object.prototype.hasOwnProperty.call(data, 'title')) {
    fields.push('title = @title');
    params.title = data.title ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'content')) {
    fields.push('content = @content');
    params.content = data.content;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'tags')) {
    fields.push('tags = @tags');
    params.tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : null;
  }
  if (Object.prototype.hasOwnProperty.call(data, 'remind_at')) {
    fields.push('remind_at = @remind_at');
    params.remind_at = data.remind_at ?? null;
  }
  if (fields.length === 0) return getNote(userId, noteId);
  fields.push(`updated_at = datetime('now')`);
  const result = db
    .prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`)
    .run(params);
  if (result.changes === 0) return null;
  return getNote(userId, noteId);
}

export function deleteNote(userId: string, noteId: string): boolean {
  const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(noteId, userId);
  return result.changes > 0;
}

export function purgeNotes(userId: string): number {
  const result = db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
  return result.changes ?? 0;
}

export function exportNotes(userId: string): NotePayload[] {
  const rows = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as NoteRow[];
  return rows.map(mapNote);
}

export function mapNote(row: NoteRow): NotePayload {
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

export function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
