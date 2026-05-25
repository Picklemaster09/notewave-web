import { Router } from "express";
import { requireAuth, getAuth0UserId } from "../middleware/auth.js";
import { getUserByAuth0Id, getSettings, upsertSettings } from "../lib/supabase.js";

const router = Router();

// GET /api/settings
router.get("/", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const settings = await getSettings(user.id);
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

// PUT /api/settings
router.put("/", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const { language, theme, accent_color, action_button_action, custom_api_key } = req.body;

    const saved = await upsertSettings(user.id, {
      language: language ?? "en",
      theme: theme ?? "light",
      accent_color: accent_color ?? "blue",
      action_button_action: action_button_action ?? "record",
      // Store user's personal Gemini key server-side — never return it to other clients
      ...(custom_api_key !== undefined && { custom_api_key }),
    });

    res.json({ settings: saved });
  } catch (err: any) {
    res.status(500).json({ error: "SAVE_FAILED", message: err.message });
  }
});

export default router;
