export type User = { id: string; created_at: string };

export type Note = {
  id: string;
  user_id: string;
  title?: string | null;
  content: string;
  tags?: string | null;
  remind_at?: string | null;
  created_at: string;
  updated_at: string;
};