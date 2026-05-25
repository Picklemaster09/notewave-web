import { Router } from "express";
import { requireAuth, getAuth0UserId, getAuth0Email } from "../middleware/auth.js";
import { upsertUser, getUserByAuth0Id } from "../lib/supabase.js";

const router = Router();

// POST /api/users/sync
// Called after login to ensure the Auth0 user exists in our Postgres users table.
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const email = getAuth0Email(req) ?? req.body.email;
    const user = await upsertUser(auth0Id, email);
    res.json({ user });
  } catch (err: any) {
    console.error("User sync error:", err);
    res.status(500).json({ error: "USER_SYNC_FAILED", message: err.message });
  }
});

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const auth0Id = getAuth0UserId(req);
    const user = await getUserByAuth0Id(auth0Id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: "FETCH_FAILED", message: err.message });
  }
});

export default router;
