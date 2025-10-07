import { z } from 'zod';
import {
  createNote,
  deleteNote,
  exportNotes,
  getNote,
  listNotes,
  purgeNotes,
  updateNote,
  type NotePayload,
} from '../services/notes.js';
import { toCSV } from '../utils/csv.js';

type ToolContent = { type: 'text'; text: string };

type HandlerResult = { content: ToolContent[]; data?: any };

export type McpTool = {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  handler: (input: any) => Promise<HandlerResult>;
};

const noteSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string', nullable: true },
    content: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    remind_at: { type: 'string', nullable: true },
    created_at: { type: 'string' },
    updated_at: { type: 'string' },
  },
};

export const tools: McpTool[] = [
  {
    name: 'create_note',
    description: 'Create a memo (title optional) for a given ChatGPT user.',
    schema: z.object({
      user_id: z.string().min(1),
      title: z.string().optional(),
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
      remind_at: z.string().datetime().optional(),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id', 'content'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        remind_at: { type: 'string', format: 'date-time' },
      },
    },
    handler: async (input) => {
      const { user_id, ...payload } = input;
      const note = createNote(user_id, payload);
      return replyWithNote('Note created.', note);
    },
  },
  {
    name: 'list_notes',
    description: 'List memos with optional full-text search or tag filter.',
    schema: z.object({
      user_id: z.string().min(1),
      query: z.string().optional(),
      tag: z.string().optional(),
      limit: z.number().int().positive().max(200).optional(),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        query: { type: 'string' },
        tag: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200 },
      },
    },
    handler: async (input) => {
      const { user_id, ...rest } = input;
      const notes = listNotes(user_id, rest);
      return {
        content: [
          { type: 'text', text: notes.length ? `Found ${notes.length} notes.` : 'No notes found.' },
        ],
        data: { notes },
      };
    },
  },
  {
    name: 'get_note',
    description: 'Fetch a memo by its identifier.',
    schema: z.object({
      user_id: z.string().min(1),
      note_id: z.string().min(1),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id', 'note_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        note_id: { type: 'string' },
      },
    },
    handler: async (input) => {
      const note = getNote(input.user_id, input.note_id);
      if (!note) {
        return {
          content: [{ type: 'text', text: 'Note not found.' }],
          data: null,
        };
      }
      return replyWithNote('Note fetched.', note);
    },
  },
  {
    name: 'update_note',
    description: 'Partially update a memo.',
    schema: z.object({
      user_id: z.string().min(1),
      note_id: z.string().min(1),
      title: z.string().nullable().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).nullable().optional(),
      remind_at: z.string().datetime().nullable().optional(),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id', 'note_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        note_id: { type: 'string' },
        title: { type: ['string', 'null'] },
        content: { type: 'string' },
        tags: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'null' },
          ],
        },
        remind_at: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
      },
    },
    handler: async (input) => {
      const { user_id, note_id, ...changes } = input;
      const updated = updateNote(user_id, note_id, changes);
      if (!updated) {
        return {
          content: [{ type: 'text', text: 'Note not found.' }],
          data: null,
        };
      }
      return replyWithNote('Note updated.', updated);
    },
  },
  {
    name: 'delete_note',
    description: 'Delete a memo.',
    schema: z.object({
      user_id: z.string().min(1),
      note_id: z.string().min(1),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id', 'note_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        note_id: { type: 'string' },
      },
    },
    handler: async (input) => {
      const removed = deleteNote(input.user_id, input.note_id);
      return {
        content: [
          {
            type: 'text',
            text: removed ? 'Note deleted.' : 'Note not found.',
          },
        ],
        data: { deleted: removed },
      };
    },
  },
  {
    name: 'export_notes',
    description: 'Export memos in JSON or CSV format.',
    schema: z.object({
      user_id: z.string().min(1),
      format: z.enum(['json', 'csv']).default('json').optional(),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
        format: { type: 'string', enum: ['json', 'csv'] },
      },
    },
    handler: async (input) => {
      const { user_id, format = 'json' } = input;
      const notes = exportNotes(user_id);
      if (format === 'csv') {
        return {
          content: [
            {
              type: 'text',
              text: notes.length ? `CSV export with ${notes.length} notes.` : 'CSV export empty.',
            },
          ],
          data: {
            format: 'csv',
            content: toCSV(notes.map(noteToExportRow)),
          },
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: notes.length ? `JSON export with ${notes.length} notes.` : 'JSON export empty.',
          },
        ],
        data: { notes },
      };
    },
  },
  {
    name: 'purge_notes',
    description: 'Delete all memos for the specified user.',
    schema: z.object({
      user_id: z.string().min(1),
    }),
    jsonSchema: {
      type: 'object',
      required: ['user_id'],
      additionalProperties: false,
      properties: {
        user_id: { type: 'string' },
      },
    },
    handler: async (input) => {
      const purged = purgeNotes(input.user_id);
      return {
        content: [{ type: 'text', text: `Purged ${purged} notes.` }],
        data: { purged },
      };
    },
  },
];

function replyWithNote(message: string, note: NotePayload): HandlerResult {
  return {
    content: [{ type: 'text', text: `${message} (id=${note.id}).` }],
    data: { note },
  };
}

function noteToExportRow(note: NotePayload) {
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
