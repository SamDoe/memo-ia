import { randomUUID } from 'node:crypto';
import db from '../db.js';
export function ensureUser(userId) {
    db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(userId);
}
export function createNote(userId, data) {
    ensureUser(userId);
    const id = randomUUID();
    db.prepare(`INSERT INTO notes (id,user_id,title,content,tags,remind_at)
     VALUES (@id,@user_id,@title,@content,@tags,@remind_at)`).run({
        id,
        user_id: userId,
        title: data.title ?? null,
        content: data.content,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        remind_at: data.remind_at ?? null,
    });
    const created = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(id, userId);
    return mapNote(created);
}
export function listNotes(userId, filters = {}) {
    ensureUser(userId);
    const conditions = ['user_id = @user_id'];
    const params = { user_id: userId, limit: filters.limit ?? 50 };
    if (filters.query) {
        conditions.push(`(LOWER(IFNULL(title, '')) LIKE @search OR LOWER(content) LIKE @search)`);
        params.search = `%${filters.query.toLowerCase()}%`;
    }
    if (filters.tag) {
        conditions.push(`tags IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = @tag)`);
        params.tag = filters.tag;
    }
    const rows = db.prepare(`SELECT * FROM notes WHERE ${conditions.join(' AND ')} ORDER BY updated_at DESC LIMIT @limit`).all(params);
    return rows.map(mapNote);
}
export function getNote(userId, noteId) {
    const row = db.prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?').get(noteId, userId);
    return row ? mapNote(row) : null;
}
export function updateNote(userId, noteId, data) {
    const fields = [];
    const params = { id: noteId, user_id: userId };
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
    if (fields.length === 0)
        return getNote(userId, noteId);
    fields.push(`updated_at = datetime('now')`);
    const result = db
        .prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`)
        .run(params);
    if (result.changes === 0)
        return null;
    return getNote(userId, noteId);
}
export function deleteNote(userId, noteId) {
    const result = db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(noteId, userId);
    return result.changes > 0;
}
export function purgeNotes(userId) {
    const result = db.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
    return result.changes ?? 0;
}
export function exportNotes(userId) {
    const rows = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    return rows.map(mapNote);
}
export function mapNote(row) {
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
export function parseTags(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    }
    catch {
        return [];
    }
}
