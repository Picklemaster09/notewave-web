import { auth } from "express-oauth2-jwt-bearer";
import type { Request, Response, NextFunction } from "express";

// Lazily initialise the JWT verifier so the server boots even without AUTH0_*
// env vars (useful for local dev with placeholder .env values).
let _verifier: ReturnType<typeof auth> | null = null;

function getVerifier() {
  if (_verifier) return _verifier;

  const audience = process.env.AUTH0_AUDIENCE;
  const domain = process.env.AUTH0_DOMAIN;

  if (!audience || !domain || audience.startsWith("https://api.placeholder")) {
    // Auth0 not configured — warn once and return null (dev passthrough)
    console.warn(
      "[auth] AUTH0_DOMAIN / AUTH0_AUDIENCE not set. All /api routes are UNPROTECTED. Set them before deploying."
    );
    return null;
  }

  _verifier = auth({
    audience,
    issuerBaseURL: `https://${domain}`,
    tokenSigningAlg: "RS256",
  });
  return _verifier;
}

// Drop-in Express middleware. In dev (no Auth0 config), passes through.
// In production (AUTH0_* set), validates the JWT and rejects on 401.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const verifier = getVerifier();
  if (!verifier) return next();
  return verifier(req, res, next);
}

export function getAuth0UserId(req: Request): string {
  const payload = (req as any).auth?.payload;
  if (!payload?.sub) {
    // Dev passthrough: derive a stable fake user ID from the IP
    const ip = req.headers["x-forwarded-for"] as string ?? req.socket.remoteAddress ?? "dev";
    return `dev|${ip.replace(/[^a-z0-9]/gi, "_")}`;
  }
  return payload.sub as string;
}

export function getAuth0Email(req: Request): string | undefined {
  return (req as any).auth?.payload?.[`${process.env.AUTH0_AUDIENCE}/email`]
    || (req as any).auth?.payload?.email;
}

export function handleAuthError(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err.status === 401 || err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Unauthorized", message: err.message });
  }
  next(err);
}
