import { api } from "./client";
import type { RecordingNote } from "../types";

interface DbNote {
  id: string;
  title: string;
  transcript: string;
  idea_summary: string;
  action_items: string;
  category: "ideas" | "reminders";
  idea_name: string;
  scheduled_date: string;
  project_start_date: string;
  is_complex: boolean;
  sub_todos: { id: string; text: string; completed: boolean }[];
  tags: string[];
  model_used: string;
  duration: number;
  created_at: string;
}

// Map Postgres snake_case row → frontend camelCase RecordingNote
function fromDb(row: DbNote): RecordingNote {
  return {
    id: row.id,
    title: row.title,
    transcript: row.transcript,
    ideaSummary: row.idea_summary,
    actionItems: row.action_items,
    category: row.category,
    ideaName: row.idea_name,
    scheduledDate: row.scheduled_date,
    projectStartDate: row.project_start_date,
    isComplex: row.is_complex,
    subTodos: row.sub_todos ?? [],
    tags: row.tags ?? [],
    modelUsed: row.model_used,
    duration: row.duration,
    createdAt: row.created_at,
  };
}

export async function fetchNotes(): Promise<RecordingNote[]> {
  const res = await api.get<{ notes: DbNote[] }>("/api/notes");
  return res.notes.map(fromDb);
}

export async function saveNote(note: RecordingNote): Promise<RecordingNote> {
  const res = await api.post<{ notes: DbNote[] }>("/api/notes", note);
  return fromDb(res.notes[0]);
}

export async function saveNotesBatch(notes: RecordingNote[]): Promise<RecordingNote[]> {
  const res = await api.post<{ notes: DbNote[] }>("/api/notes", notes);
  return res.notes.map(fromDb);
}

export async function removeNote(id: string): Promise<void> {
  await api.delete(`/api/notes/${id}`);
}
