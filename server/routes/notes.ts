import { Router } from "express";
import { requireAuth, getAuth0UserId } from "../middleware/auth.js";
import {
  getUserByAuth0Id,
  getNotesByUserId,
  upsertNote,
  deleteNote,
} from "../lib/supabase.js";

const router = Router();

// GET /api/notes — list all notes for the authenticated user
router.get("/", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const notes = await getNotesByUserId(user.id);
    res.json({ notes });
  } catch (err: any) {
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// POST /api/notes — create or upsert a note (supports batch upsert via array)
router.post("/", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const isPro = user.plan === "premium";

    // Accept single note or array for bulk sync
    const incoming: any[] = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const raw of incoming) {
      const note = {
        id: raw.id,
        user_id: user.id,
        title: raw.title ?? "",
        transcript: raw.transcript ?? "",
        idea_summary: raw.ideaSummary ?? raw.idea_summary ?? "",
        action_items: raw.actionItems ?? raw.action_items ?? "",
        category: raw.category ?? "ideas",
        idea_name: raw.ideaName ?? raw.idea_name ?? "",
        scheduled_date: raw.scheduledDate ?? raw.scheduled_date ?? "",
        project_start_date: raw.projectStartDate ?? raw.project_start_date ?? "",
        is_complex: raw.isComplex ?? raw.is_complex ?? false,
        sub_todos: raw.subTodos ?? raw.sub_todos ?? [],
        tags: Array.isArray(raw.tags) ? raw.tags : (raw.tags ? String(raw.tags).split(",").map((t: string) => t.trim()) : []),
        model_used: raw.modelUsed ?? raw.model_used ?? "",
        duration: raw.duration ?? 0,
        created_at: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
      };

      const saved = await upsertNote(note);
      results.push(saved);
    }

    res.json({ notes: results });
  } catch (err: any) {
    console.error("Note upsert error:", err);
    res.status(500).json({ error: "SAVE_FAILED", message: err.message });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    await deleteNote(req.params.id, user.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "DELETE_FAILED", message: err.message });
  }
});

export default router;
