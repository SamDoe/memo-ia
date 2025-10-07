import db from '../db.js';
import { randomUUID } from 'node:crypto';
export const Tools = {
  async create_note({ user_id, title, content, tags, remind_at }: any) {
    const id = randomUUID();
    db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)').run(user_id);
    db.prepare(`INSERT INTO notes (id,user_id,title,content,tags,remind_at) VALUES (@id,@user_id,@title,@content,@tags,@remind_at)`).run({ id,user_id,title: title ?? null,content,tags: tags ? JSON.stringify(tags) : null,remind_at: remind_at ?? null });
    const html = `<div class='memo-card'><strong>${title ?? 'Note'}</strong><p>${content.slice(0,160)}</p></div>`;
    return { id, title, remind_at, html };
  }
};