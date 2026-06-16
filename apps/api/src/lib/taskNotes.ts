import { randomUUID } from "node:crypto";

export type TaskNoteEntry = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export function parseTaskNotes(raw: string | null | undefined): TaskNoteEntry[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is TaskNoteEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as TaskNoteEntry).id === "string" &&
        typeof (entry as TaskNoteEntry).text === "string" &&
        typeof (entry as TaskNoteEntry).authorId === "string" &&
        typeof (entry as TaskNoteEntry).authorName === "string" &&
        typeof (entry as TaskNoteEntry).createdAt === "string",
    );
  } catch {
    return [];
  }
}

export function appendTaskNote(
  raw: string | null | undefined,
  input: { text: string; authorId: string; authorName: string },
): string {
  const entries = parseTaskNotes(raw);
  entries.push({
    id: randomUUID(),
    text: input.text.trim(),
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: new Date().toISOString(),
  });
  return JSON.stringify(entries);
}

export function endOfTodayIso(): string {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

export function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}
