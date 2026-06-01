import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Lazy initialize Supabase client to avoid crash on startup when credentials are absent
let supabaseClient: any = null;
function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.warn("Supabase variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing. Running in Guest / Local storage fallback mode.");
      return null;
    }
    supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

function getSupabaseForUser(accessToken?: string) {
  const supabase = getSupabase();
  if (!supabase || !accessToken) return supabase;
  
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

function getSupabaseClientFromRequest(req: express.Request) {
  const authHeader = req.headers["authorization"];
  let token: string | undefined = undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  return getSupabaseForUser(token);
}

// Enable JSON bodies with higher limits for audio uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Simple in-memory storage for rate limits
// Tracks free tier IP rate limits (5 requests per day)
interface RateLimit {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimit>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0]).trim();
  }
  return req.socket.remoteAddress || "anonymous_client";
}

// Check rate limit for free tier requests using default API key
function checkRateLimit(req: express.Request, limitCount = 3, windowMs = 24 * 60 * 60 * 1000): { allowed: boolean; remaining: number; resetTime: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  let status = rateLimitStore.get(ip);

  if (!status || now > status.resetAt) {
    status = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(ip, status);
  }

  if (status.count >= limitCount) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: status.resetAt,
    };
  }

  status.count += 1;
  rateLimitStore.set(ip, status);

  return {
    allowed: true,
    remaining: limitCount - status.count,
    resetTime: status.resetAt,
  };
}

// Helper to get system or custom Gemini instance
function getGeminiClient(customApiKey?: string) {
  const apiKey = customApiKey || process.env.NoteWave || process.env.NOTEWAVE || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Local mock databases for fully functional offline previews
interface MockUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  tier: "free" | "premium";
  passwordHash: string;
}
const mockUsersTable = new Map<string, MockUser>();
const mockNotesTable = new Map<string, any[]>();
const mockSettingsTable = new Map<string, any>();

const isUuidVal = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

async function getOrCreateUserInTable(supabase: any, authUserId: string, email: string, displayName: string) {
  const auth0Id = `supabase|${authUserId}`;
  const clientToUse = supabase || getSupabase();
  
  // Try to select existing user from table
  try {
    const { data: user } = await clientToUse
      .from("users")
      .select("*")
      .eq("auth0_id", auth0Id)
      .maybeSingle();

    if (user) {
      return user;
    }
  } catch (err) {
    console.warn("Select from users table failed, continuing to insert or fallback:", err);
  }

  // Insert otherwise
  try {
    const insertPayload: any = {
      auth0_id: auth0Id,
      email: email,
      plan: "free"
    };

    // If authUserId is a valid UUID, make sure we specify it as id to satisfy RLS (auth.uid() = id)
    if (isUuidVal(authUserId)) {
      insertPayload.id = authUserId;
    }

    const { data: newUser, error: insertError } = await clientToUse
      .from("users")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Supabase profile insert failed:", insertError);
      throw insertError;
    }

    // Create default settings row
    try {
      await clientToUse
        .from("user_settings")
        .insert({
          user_id: newUser.id,
          language: "en",
          theme: "light",
          accent_color: "blue",
          action_button_action: "record"
        })
        .maybeSingle();
    } catch (settErr) {
      console.warn("Could not insert default settings, continuing:", settErr);
    }

    return newUser;
  } catch (err: any) {
    console.error("Critical insert user profile failure (RLS or Schema issue). Falling back to safe mock-db profile:", err.message);
    
    // Return a fallback mock database-like user object to keep sandbox active and register it in mock tables
    const fallbackId = isUuidVal(authUserId) ? authUserId : `fb78d8a7-96a2-4db1-bb9a-${Date.now().toString().slice(-12)}`;
    const mockUser: MockUser = {
      id: fallbackId,
      uid: auth0Id,
      email: email,
      displayName: displayName || "Inventor User",
      tier: "free",
      passwordHash: "SandboxSecure123!"
    };
    mockUsersTable.set(email.toLowerCase(), mockUser);
    mockSettingsTable.set(fallbackId, {
      user_id: fallbackId,
      language: "en",
      theme: "light",
      accent_color: "blue",
      action_button_action: "record"
    });

    return {
      id: fallbackId,
      auth0_id: auth0Id,
      email: email,
      plan: "free"
    };
  }
}

// Helper: resolve DB UUID from Client auth0_id/uid
async function resolveUserId(supabase: any, uid: string): Promise<string> {
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");
  if (isMockOrSandbox) {
    const found = Array.from(mockUsersTable.values()).find(u => u.uid === uid || u.uid === `mock|${uid}`);
    if (found) return found.id;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", uid)
      .maybeSingle();

    if (data) {
      return data.id;
    }
  } catch (err) {
    console.warn("Direct select of users table failed in resolveUserId:", err);
  }

  // Active lookup fallback to mock table to avoid blocking sandbox users
  const foundInMock = Array.from(mockUsersTable.values()).find(
    u => u.uid === uid || 
         u.uid === `mock|${uid}` || 
         u.uid.replace("mock|", "") === uid.replace("supabase|", "") ||
         u.uid.replace("supabase|", "") === uid.replace("supabase|", "")
  );
  if (foundInMock) {
    return foundInMock.id;
  }

  // If still not found and it is a sandbox user, let's dynamically register them in mock memory
  if (uid.includes("sandbox")) {
    const mockId = `fb78d8a7-96a2-4db1-bb9a-${Date.now().toString().slice(-12)}`;
    const mockUser: MockUser = {
      id: mockId,
      uid: uid,
      email: uid.split("|")[1] || "sandbox@notewave.com",
      displayName: "Sandbox Explorer",
      tier: "free",
      passwordHash: "SandboxSecure123!"
    };
    mockUsersTable.set(mockUser.email.toLowerCase(), mockUser);
    return mockId;
  }

  throw new Error(`Profile match failed for user identifier: ${uid}`);
}

// Helper mappings: JS camelCase to Postgres snake_case
function mapNoteToDb(note: any, userId: string) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title || "",
    transcript: note.transcript || "",
    idea_summary: note.ideaSummary || "",
    action_items: note.actionItems || "",
    category: note.category || "ideas",
    idea_name: note.ideaName || "",
    scheduled_date: note.scheduledDate || "",
    project_start_date: note.projectStartDate || "",
    is_complex: !!note.isComplex,
    sub_todos: note.subTodos || [],
    tags: note.tags || [],
    model_used: note.modelUsed || "gemini",
    duration: Math.round(Number(note.duration || 0)),
    created_at: note.createdAt || new Date().toISOString()
  };
}

// Helper mappings: DB snake_case to Client camelCase Note
function mapNoteToClient(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    transcript: row.transcript,
    ideaSummary: row.idea_summary,
    actionItems: row.action_items,
    category: row.category,
    ideaName: row.idea_name,
    scheduledDate: row.scheduled_date,
    projectStartDate: row.project_start_date,
    isComplex: row.is_complex,
    subTodos: row.sub_todos || [],
    tags: row.tags || [],
    modelUsed: row.model_used,
    duration: row.duration || 0,
    createdAt: row.created_at
  };
}

// ---------------------------------------------
// Core API Routes & Auth0 OAuth Support
// ---------------------------------------------

// Dynamically construct redirect URI or read from APP_URL / request host
function getRedirectUri(req: express.Request): string {
  if (process.env.APP_URL) {
    const rawUrl = process.env.APP_URL.trim().replace(/\/$/, "");
    return `${rawUrl}/auth/callback`;
  }
  const host = req.get("host");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${host}/auth/callback`;
}

// 0. Auth0 URLs & Callback Integration
app.get("/api/auth/auth0-url", (req, res) => {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  if (!domain || !clientId) {
    return res.status(400).json({ 
      error: "Auth0 server-side environment variables (AUTH0_DOMAIN, AUTH0_CLIENT_ID) are not configured. Go to Secrets in AI Studio Settings and define them to authenticate." 
    });
  }

  const redirectUri = getRedirectUri(req);
  const state = Math.random().toString(36).substring(2);
  const params: Record<string, string> = {
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    state: state
  };

  if (req.query.connection) {
    params.connection = String(req.query.connection).trim();
  }

  const authUrl = `https://${domain.trim()}/authorize?` + new URLSearchParams(params).toString();

  res.json({ url: authUrl });
});

// OAuth Callback exchange route with trailing slash support
app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!code) {
    return res.send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 40px; background: #F2F2F7; color: #1C1C1E;">
          <h2 style="color: #FF3B30;">OAuth Refused</h2>
          <p>The authorization request code is missing or was declined by Auth0.</p>
          <p><button onclick="window.close()" style="padding: 10px 20px; border: none; background: #007AFF; color: white; border-radius: 8px; cursor: pointer; font-weight: bold;">Close Window</button></p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "OAUTH_AUTH_ERROR", error: "Authorization code declined or missing from Auth0." }, "*");
            }
            setTimeout(() => window.close(), 4000);
          </script>
        </body>
      </html>
    `);
  }

  if (!domain || !clientId || !clientSecret) {
    return res.send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 40px; background: #F2F2F7; color: #1C1C1E;">
          <h2 style="color: #FF3B30;">Auth0 Credentials Mismatch</h2>
          <p>Domain, Client ID, or Client Secret are missing in the server secrets configuration.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "OAUTH_AUTH_ERROR", error: "Auth0 settings are incomplete on the deployment side." }, "*");
            }
          </script>
        </body>
      </html>
    `);
  }

  try {
    const redirectUri = getRedirectUri(req);
    
    // Exchange Authorization Code for Token
    const tokenResponse = await fetch(`https://${domain.trim()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        code: code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "Authorization Code Exchange Failed");
    }

    // Access profile metadata
    const profileResponse = await fetch(`https://${domain.trim()}/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!profileResponse.ok) {
      throw new Error("Unable to read user details profile from the Auth0 userinfo credentials endpoint.");
    }

    const profile = await profileResponse.json();
    const email = profile.email || `${profile.nickname || "user"}@auth0.local`;
    const displayName = profile.name || profile.nickname || email.split("@")[0] || "Auth0 User";
    const auth0UserId = profile.sub; // e.g. "auth0|65fdf..."

    const supabase = getSupabase();
    let userObj: any = null;
    let settingsObj: any = null;

    if (supabase) {
      // Direct SQL Postgres persistence integration
      let { data: dbUser } = await supabase
        .from("users")
        .select("*")
        .eq("auth0_id", auth0UserId)
        .maybeSingle();

      if (!dbUser) {
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            auth0_id: auth0UserId,
            email: email,
            plan: "free"
          })
          .select()
          .single();

        if (insertError) throw insertError;
        dbUser = newUser;
      }

      // Fetch settings rows
      let { data: settings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", dbUser.id)
        .maybeSingle();

      if (!settings) {
        const { data: dSettings } = await supabase
          .from("user_settings")
          .insert({
            user_id: dbUser.id,
            language: "en",
            theme: "light",
            accent_color: "blue",
            action_button_action: "record"
          })
          .select()
          .single();
        settingsObj = dSettings;
      } else {
        settingsObj = settings;
      }

      userObj = {
        uid: dbUser.auth0_id,
        id: dbUser.id,
        email: dbUser.email,
        displayName: displayName,
        tier: dbUser.plan || "free"
      };
    } else {
      // Local Sandbox Fallback
      let mockUser = Array.from(mockUsersTable.values()).find(u => u.uid === auth0UserId);
      if (!mockUser) {
        const mockDbId = `fb78d8a7-${Date.now().toString().slice(-4)}-4db1-bb9a-${Date.now().toString().slice(-12)}`;
        mockUser = {
          id: mockDbId,
          uid: auth0UserId,
          email: email,
          displayName: displayName,
          tier: "free",
          passwordHash: ""
        };
        mockUsersTable.set(email.toLowerCase(), mockUser);
        mockSettingsTable.set(mockDbId, {
          language: "en",
          theme: "light",
          accent_color: "blue",
          action_button_action: "record"
        });
      }

      userObj = {
        uid: mockUser.uid,
        id: mockUser.id,
        email: mockUser.email,
        displayName: mockUser.displayName,
        tier: mockUser.tier
      };
      settingsObj = mockSettingsTable.get(mockUser.id);
    }

    res.send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 40px; background: #E5E5EA; color: #1C1C1E; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin:0;">
          <div style="background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 400px; width: 100%;">
            <div style="font-size: 40px; margin-bottom: 15px;">⚡</div>
            <h2 style="color: #34C759; margin: 0 0 10px 0; font-weight: 800; letter-spacing: -0.5px;">Authorization Success!</h2>
            <p style="color: #8E8E93; font-size: 13px; font-weight: 600; margin-bottom: 20px;">Your NoteWave Inventor Profile is fully linked.</p>
            <p style="color: #1C1C1E; font-size: 12px; font-weight: bold; background: #F2F2F7; padding: 10px; border-radius: 10px;">User: ${email}</p>
          </div>
          <script>
            try {
              localStorage.setItem("notewave_user_session", JSON.stringify(${JSON.stringify(userObj)}));
              const rawSettings = ${JSON.stringify(settingsObj)};
              if (rawSettings) {
                const clientSettings = {
                  customApiKey: rawSettings.custom_api_key || rawSettings.customApiKey || "",
                  tier: "${userObj.tier || "free"}",
                  actionButtonAction: rawSettings.action_button_action || rawSettings.actionButtonAction || "record",
                  language: rawSettings.language || "en",
                  theme: rawSettings.theme || "light",
                  accentColor: rawSettings.accent_color || rawSettings.accentColor || "blue"
                };
                localStorage.setItem("notewave_local_settings", JSON.stringify(clientSettings));
              }
            } catch (err) {
              console.error("Local storage sync error:", err);
            }

            if (window.opener) {
              window.opener.postMessage({ 
                type: "OAUTH_AUTH_SUCCESS", 
                user: ${JSON.stringify(userObj)},
                settings: ${JSON.stringify(settingsObj)}
              }, "*");
              setTimeout(() => window.close(), 1000);
            } else {
              setTimeout(() => {
                window.location.href = "/";
              }, 800);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Auth0 authorization token exchange error:", err);
    res.send(`
      <html>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 40px; background: #F2F2F7; color: #1C1C1E; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); max-width: 400px; width: 100%;">
            <h2 style="color: #FF3B30; margin-top: 0;">Authorization Failure</h2>
            <p style="color: #4A4A4A; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">${err?.message || "Internal transmission issue. Please verify your client configuration parameters or contact the system administrator."}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button onclick="if(window.opener){window.close();}else{window.location.href='/';}" style="padding: 10px 20px; border: none; background: #007AFF; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 13px;">Return home</button>
            </div>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: "OAUTH_AUTH_ERROR", error: ${JSON.stringify(err?.message || "Internal token exchange error")} }, "*");
            }
          </script>
        </body>
      </html>
    `);
  }
});

// Supabase Auth and Data Synchronization REST Endpoints

// 1. Auth Register Route
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing required registration parameters." });
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.log("Mock registration active for email:", email);
    const mockUid = `mock|${Date.now()}`;
    const mockDbId = `fb78d8a7-96a2-4db1-bb9a-${Date.now().toString().slice(-12)}`;
    const mockUser: MockUser = {
      id: mockDbId,
      uid: mockUid,
      email,
      displayName: displayName || "Inventor User",
      tier: "free",
      passwordHash: password
    };
    mockUsersTable.set(email.toLowerCase(), mockUser);
    mockSettingsTable.set(mockDbId, {
      user_id: mockDbId,
      language: "en",
      theme: "light",
      accent_color: "blue",
      action_button_action: "record"
    });
    return res.json({
      success: true,
      user: {
        uid: mockUid,
        id: mockDbId,
        email,
        displayName: mockUser.displayName,
        tier: "free"
      }
    });
  }

  try {
    let authUser = null;
    let fallbackToDbOnly = false;
    let authErrorMsg = "";
    let userClientToUse = supabase;
    let registeredAccessToken: string | undefined = undefined;

    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { displayName }
      });

      if (authError) {
        authErrorMsg = authError.message;
        // Check if this error is due to bearer token/admin privileges being absent
        if (authError.message.includes("Bearer token") || authError.message.includes("not allowed") || authError.message.includes("permissions") || email.includes("sandbox.explorer.")) {
          console.warn("Auth admin creation unavailable. Attempting standard public signUp fallback.");
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                displayName
              }
            }
          });

          if (signUpError) {
            console.error("Standard signUp fallback also failed:", signUpError.message);
            authErrorMsg = signUpError.message;
            fallbackToDbOnly = true;
          } else if (signUpData.user) {
            authUser = signUpData.user;
            if (signUpData.session?.access_token) {
              registeredAccessToken = signUpData.session.access_token;
              userClientToUse = getSupabaseForUser(signUpData.session.access_token);
            }
          } else {
            fallbackToDbOnly = true;
          }
        } else {
          return res.status(400).json({ error: authError.message });
        }
      } else {
        authUser = authData.user;
      }
    } catch (adminErr: any) {
      console.warn("Admin auth exception. Falling back to DB-only strategy:", adminErr.message);
      fallbackToDbOnly = true;
    }

    if (fallbackToDbOnly) {
      // Direct database-only profile fallback when administrative/signup tokens have restrictions
      const fakeAuthUserId = `sandbox-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const dbUser = await getOrCreateUserInTable(supabase, fakeAuthUserId, email, displayName || "Inventor User");
      
      return res.json({
        success: true,
        user: {
          uid: dbUser.auth0_id,
          id: dbUser.id,
          email: dbUser.email,
          displayName: displayName || "Inventor User",
          tier: dbUser.plan || "free"
        }
      });
    }

    if (!authUser) {
      return res.status(500).json({ error: authErrorMsg || "Auth user creation failed." });
    }

    const dbUser = await getOrCreateUserInTable(userClientToUse, authUser.id, email, displayName || "Inventor User");

    return res.json({
      success: true,
      user: {
        uid: dbUser.auth0_id,
        id: dbUser.id,
        email: dbUser.email,
        displayName: displayName || "Inventor User",
        tier: dbUser.plan || "free",
        accessToken: registeredAccessToken
      }
    });
  } catch (err: any) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed", message: err.message });
  }
});

// 2. Auth Login Route
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing login credentials." });
  }

  const supabase = getSupabase();
  if (!supabase) {
    const user = mockUsersTable.get(email.toLowerCase());
    if (user && user.passwordHash === password) {
      const settings = mockSettingsTable.get(user.id);
      return res.json({
        success: true,
        user: {
          uid: user.uid,
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          tier: user.tier
        },
        settings
      });
    }
    return res.status(401).json({ error: "Authentication failed. Invalid email or password." });
  }

  try {
    let authUser = null;
    let fallbackToDbOnly = false;
    let authErrorMsg = "";
    let loggedInAccessToken: string | undefined = undefined;

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (sessionError) {
        authErrorMsg = sessionError.message;
        fallbackToDbOnly = true;
      } else {
        authUser = sessionData.user;
        loggedInAccessToken = sessionData.session?.access_token;
      }
    } catch (signinErr: any) {
      authErrorMsg = signinErr.message;
      fallbackToDbOnly = true;
    }

    if (fallbackToDbOnly) {
      // Direct database-only login check (bypassing Supabase auth for sandbox/social users manually inserted into 'users')
      const { data: dbUser, error: lookupErr } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (dbUser) {
        console.log("Direct db-only profile exists, bypassing native Auth0/Supabase lookup for email:", email);
        
        let { data: settings } = await supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", dbUser.id)
          .maybeSingle();

        if (!settings) {
          const { data: dSettings } = await supabase
            .from("user_settings")
            .insert({
              user_id: dbUser.id,
              language: "en",
              theme: "light",
              accent_color: "blue",
              action_button_action: "record"
            })
            .select()
            .single();
          settings = dSettings;
        }

        return res.json({
          success: true,
          user: {
            uid: dbUser.auth0_id,
            id: dbUser.id,
            email: dbUser.email,
            displayName: dbUser.email.split("@")[0] || "Inventor User",
            tier: dbUser.plan || "free"
          },
          settings
        });
      }

      return res.status(401).json({ error: authErrorMsg || "Authentication failed. Invalid email or password." });
    }

    if (!authUser) {
      return res.status(401).json({ error: "User session unavailable." });
    }

    const userClientToUse = loggedInAccessToken ? getSupabaseForUser(loggedInAccessToken) : supabase;
    const dbUser = await getOrCreateUserInTable(userClientToUse, authUser.id, email, authUser.user_metadata?.displayName || "");

    // Fetch user settings
    let { data: settings } = await userClientToUse
      .from("user_settings")
      .select("*")
      .eq("user_id", dbUser.id)
      .maybeSingle();

    if (!settings) {
      const { data: dSettings } = await userClientToUse
        .from("user_settings")
        .insert({
          user_id: dbUser.id,
          language: "en",
          theme: "light",
          accent_color: "blue",
          action_button_action: "record"
        })
        .select()
        .single();
      settings = dSettings;
    }

    return res.json({
      success: true,
      user: {
        uid: dbUser.auth0_id,
        id: dbUser.id,
        email: dbUser.email,
        displayName: authUser.user_metadata?.displayName || dbUser.email?.split("@")[0] || "Inventor User",
        tier: dbUser.plan || "free",
        accessToken: loggedInAccessToken
      },
      settings
    });
  } catch (err: any) {
    console.error("Login verification error:", err);
    res.status(500).json({ error: "Authentication transaction failed.", message: err.message });
  }
});

// 3. Save Settings Route
app.post("/api/user-settings", async (req, res) => {
  const { uid, customApiKey, tier, language, theme, accentColor, actionButtonAction } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "Missing uid mapping session parameter." });
  }

  const supabase = getSupabaseClientFromRequest(req);
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");
  if (!supabase || isMockOrSandbox) {
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      const current = mockSettingsTable.get(mockId) || {};
      mockSettingsTable.set(mockId, {
        ...current,
        language,
        theme,
        accent_color: accentColor,
        action_button_action: actionButtonAction,
        custom_api_key: customApiKey
      });
      
      const foundUser = Array.from(mockUsersTable.values()).find(u => u.id === mockId);
      if (foundUser && tier) {
        foundUser.tier = tier;
      }
    }
    return res.json({ success: true });
  }

  try {
    const userId = await resolveUserId(supabase, uid);

    // Settings upsert
    const { error: upsertError } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        language: language || "en",
        theme: theme || "light",
        accent_color: accentColor || "blue",
        action_button_action: actionButtonAction || "record",
        custom_api_key: customApiKey || null,
        updated_at: new Date().toISOString()
      });

    if (upsertError) throw upsertError;

    // Sync tier/plan updates
    if (tier) {
      await supabase
        .from("users")
        .update({ plan: tier, updated_at: new Date().toISOString() })
        .eq("id", userId);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Settings backup failure, falling back to mock storage:", err);
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      const current = mockSettingsTable.get(mockId) || {};
      mockSettingsTable.set(mockId, {
        ...current,
        language,
        theme,
        accent_color: accentColor,
        action_button_action: actionButtonAction,
        custom_api_key: customApiKey
      });
      const foundUser = Array.from(mockUsersTable.values()).find(u => u.id === mockId);
      if (foundUser && tier) {
        foundUser.tier = tier;
      }
    }
    return res.json({ success: true });
  }
});

// 4. Fetch User Notes Route
app.get("/api/notes", async (req, res) => {
  const { uid } = req.query;
  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Missing uid parameter." });
  }

  const supabase = getSupabaseClientFromRequest(req);
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");

  if (!supabase || isMockOrSandbox) {
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    const notesList = mockId ? (mockNotesTable.get(mockId) || []) : [];
    return res.json({ success: true, notes: notesList });
  }

  try {
    const userId = await resolveUserId(supabase, uid);
    const { data: rows, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const notes = (rows || []).map(mapNoteToClient);
    return res.json({ success: true, notes });
  } catch (err: any) {
    console.error("Notes lookup failed, falling back to mock storage:", err);
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    const notesList = mockId ? (mockNotesTable.get(mockId) || []) : [];
    return res.json({ success: true, notes: notesList });
  }
});

// 5. Notes Sync Upsert Route
app.post("/api/notes/sync", async (req, res) => {
  const { uid, notes } = req.body;
  if (!uid || !Array.isArray(notes)) {
    return res.status(400).json({ error: "Missing uid or notes payloads." });
  }

  const supabase = getSupabaseClientFromRequest(req);
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");

  if (!supabase || isMockOrSandbox) {
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      mockNotesTable.set(mockId, notes);
    }
    return res.json({ success: true });
  }

  try {
    const userId = await resolveUserId(supabase, uid);

    // Map each note to DB structure
    const dbRows = notes.map(n => mapNoteToDb(n, userId));

    // Batch upsert to Supabase
    const { error } = await supabase
      .from("notes")
      .upsert(dbRows);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Critical notes backups sync failure, falling back to mock storage:", err);
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      mockNotesTable.set(mockId, notes);
    }
    return res.json({ success: true });
  }
});

// 6. Delete Note Route
app.delete("/api/notes/:id", async (req, res) => {
  const { id } = req.params;
  const { uid } = req.query;
  if (!id || !uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Missing note id or user uid." });
  }

  const supabase = getSupabaseClientFromRequest(req);
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");

  if (!supabase || isMockOrSandbox) {
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      const remaining = (mockNotesTable.get(mockId) || []).filter(n => n.id !== id);
      mockNotesTable.set(mockId, remaining);
    }
    return res.json({ success: true });
  }

  try {
    const userId = await resolveUserId(supabase, uid);
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Deletion transaction failed, falling back to mock storage:", err);
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      const remaining = (mockNotesTable.get(mockId) || []).filter(n => n.id !== id);
      mockNotesTable.set(mockId, remaining);
    }
    return res.json({ success: true });
  }
});

// 7. Wipe Database Route
app.delete("/api/notes/all", async (req, res) => {
  const { uid } = req.query;
  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Missing uid parameter." });
  }

  const supabase = getSupabaseClientFromRequest(req);
  const isMockOrSandbox = uid.startsWith("mock|") || uid.includes("sandbox");

  if (!supabase || isMockOrSandbox) {
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      mockNotesTable.set(mockId, []);
    }
    return res.json({ success: true });
  }

  try {
    const userId = await resolveUserId(supabase, uid);
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Purging database backup failed, falling back to mock storage:", err);
    const mockId = uid.startsWith("mock|") ? Array.from(mockUsersTable.values()).find(u => u.uid === uid)?.id : uid;
    if (mockId) {
      mockNotesTable.set(mockId, []);
    }
    return res.json({ success: true });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Rate limit usage info
app.get("/api/usage", (req, res) => {
  const reqTier = req.query.tier;
  const isPro = (reqTier === "premium" || reqTier === "pro");
  const limitCount = isPro ? 50 : 3;
  
  const ip = getClientIp(req);
  const status = rateLimitStore.get(ip);
  const now = Date.now();
  
  if (!status || now > status.resetAt) {
    res.json({
      limit: limitCount,
      remaining: limitCount,
      resetInHours: 24,
    });
  } else {
    res.json({
      limit: limitCount,
      remaining: Math.max(0, limitCount - status.count),
      resetInHours: Math.max(1, Math.ceil((status.resetAt - now) / (1000 * 60 * 60))),
    });
  }
});

// Transcription endpoint using Native Gemini Audio Input/Processing
app.post("/api/transcribe", async (req, res) => {
  try {
    const { audio, tier, customApiKey, filename, language } = req.body;

    if (!audio) {
      return res.status(400).json({ error: "Missing sound recording data" });
    }

    const currentTier = (tier === "premium" || tier === "pro") ? "premium" : "free";
    const langNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      cs: "Czech",
      sk: "Slovak",
      ja: "Japanese"
    };
    const targetLanguage = langNames[language] || language || "Auto-Detect";
    const limitCount = currentTier === "premium" ? 50 : 3;

    // Check rate limit dynamically based on user's active simulated plan
    const limitResult = checkRateLimit(req, limitCount);
    if (!limitResult.allowed) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: currentTier === "premium"
          ? `Pro plan daily limit reached (50 requests/day). Limit will reset eventually.`
          : `Free plan daily limit reached (3 requests/day). Toggle your plan to Pro/Premium in settings to increase your limit to 50 requests/day!`,
        resetAt: limitResult.resetTime,
      });
    }

    let ai;
    try {
      ai = getGeminiClient(customApiKey);
    } catch {
      return res.status(400).json({ 
        error: "INVALID_CREDENTIALS", 
        message: customApiKey
          ? "The custom API key you provided was rejected or is invalid. Please double-check it in Settings." 
          : "System Gemini API key is currently missing. Please verify server environment keys, or set your personal key in Settings."
      });
    }

    // Clean base64 input if standard data URI prefix is attached
    const base64Data = audio.includes(";base64,") ? audio.split(";base64,")[1] : audio;

    // We can infer standard mime type of recording, defaulting to webm or m4a/audio
    const mimeType = audio.match(/data:([^;]+);/)?.[1] || "audio/webm";

    const audioPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const promptText = `Analyze this audio note and generate transcription, summary, action items, tags, and custom categorization.
All text values generated (including the 'transcript', 'headlineTitle', 'summaryText', 'actionItems', 'ideaName', 'scheduledDate', 'projectStartDate', and the 'text' of each item in 'subTodos') MUST be generated in the same primary language that is spoken or detected in the audio recording (e.g. if the user speaks Slovak, output in Slovak; if English, output in English; if Spanish, output in Spanish; etc.).
Format your output EXACTLY as a complete, single, valid JSON object with these keys and values (do not place in markdown blocks, do not add stray characters):
{
  "transcript": "(A verbatim or cleanly polished text transcript of the entire audio in the spoken/detected language. Extract everything carefully. If there is no speech, say 'No clear spoken words detected'.)",
  "headlineTitle": "(For 'ideas', write a concise, summarizing brief title for the note or development idea, max 5-6 words in the spoken language. For 'reminders', the 'headlineTitle' MUST be the full, detailed, readable reminder text or chore task description exactly as parsed from the audio, keep it literal, complete and fully descriptive of the task in the header rather than a short conceptual title, in the spoken language.)",
  "summaryText": "(A conceptual, elegant 2-3 sentence overview or key takeaway of what was addressed in the spoken language. Highlight core ideas.)",
  "actionItems": "(A markdown checkbox list of tasks or next steps in the spoken language extracted from the speech, e.g., ' - [ ] Send invoice\\n - [ ] Draft email'. If there are no clear instructional tasks or actions spoken, write '- [ ] No explicit action items detected.' or leave it empty.)",
  "category": "('ideas' or 'reminders'. Assign 'ideas' if the audio addresses building an app, a tool, software, hardware, project initiatives, creative or design ideas, factual specs, or thoughts. Assign 'reminders' for routine errands, personal tasks, checklist reminders, or calendar-driven tasks.)",
  "ideaName": "(For 'ideas' category, determine whether this belongs to a creative concept/app project or a standard factual memo. Write EXACTLY 'Idea' if it describes building something, software, project designs, or creative plans. Write EXACTLY 'Note' if it describes general facts, hardware specifications, simple statements, thoughts, or daily logs. Never output custom fictional brand names.)",
  "scheduledDate": "(For 'reminders' or scheduled tasks, parse specified target days or clock times from the audio like 'tomorrow at noon', 'this Saturday at 10 AM', 'Monday morning' and write them cleanly in the spoken language. Leave empty if none specified.)",
  "projectStartDate": "(If any project start time is specified, e.g., 'start next week', 'kickoff on Monday', write it here in the spoken language. Leave empty if none.)",
  "isComplex": (true if the note represents a complex app, tool, or software/hardware creation project requiring modular work. Options: true or false),
  "subTodos": [
    {
      "id": "sub_1",
      "text": "Detailed actionable micro-task text in the spoken language",
      "completed": false
    }
  ],
  "tags": "comma, separated tags (generate MAXIMUM 2 or 3 highly relevant tags total for critical topics)"
}

Determine if a checklist checklist is truly helpful based on the speech. If the audio is just sharing facts or simple factual specs (like describing computer specifications or general info) with zero explicit action items, chores, build instructions, or tasks, you MUST set 'subTodos' to an empty array []. Only populate 'subTodos' if actual steps, projects, tasks, or actions are discussed or requested. If the project/task is COMPLEX ('isComplex' is true), generate an extensive, highly structured dividing roadmap (e.g. 5-8 sequential or modular sub-todos outlining dev modules, database setups, UI layouts, testing, etc.) describing how to implement that specific software/hardware/app in the spoken/detected language so the user has a full breakdown template to check off!`;

    let parsedResult;
    let modelToUse;

    if (currentTier === "premium") {
      modelToUse = "gemini-3.5-flash";
      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: { parts: [audioPart, { text: promptText }] },
        config: {
          responseMimeType: "application/json",
        },
      });

      const outputText = response.text || "{}";
      try {
        parsedResult = JSON.parse(outputText);
      } catch (parseError) {
        console.error("Gemini failed to generate strict JSON. Falling back to structured parsing.", outputText);
        const transcriptMatch = outputText.match(/"transcript"\s*:\s*"([^"]+)"/);
        const titleMatch = outputText.match(/"headlineTitle"\s*:\s*"([^"]+)"/);
        const summaryMatch = outputText.match(/"summaryText"\s*:\s*"([^"]+)"/);
        
        parsedResult = {
          transcript: transcriptMatch ? transcriptMatch[1] : "Transcription complete.",
          headlineTitle: titleMatch ? titleMatch[1] : "Voice Note Transcription",
          summaryText: summaryMatch ? summaryMatch[1] : "Summarization complete.",
          actionItems: "- [ ] Review voice transcription notes",
          category: "ideas",
          ideaName: "NoteWave Idea",
          scheduledDate: "",
          projectStartDate: "",
          isComplex: false,
          subTodos: [
            { id: `sub_fail_${Date.now()}`, text: "Review voice transcription checklist", completed: false }
          ],
          tags: "audio, voice"
        };
      }
    } else {
      // Free User: Two-phase routing optimization:
      // Step 1: gemini-3.5-flash for audio-to-text transcription purely (extremely high quality audio processing)
      const transcriptionPrompt = `Listen to this audio note and transcribe it verbatim and cleanly in the language spoken in the audio. Only return the final raw transcription text, absolutely nothing else. Do not add any conversational preamble or explanations. If there are no clear spoken words, respond 'No clear spoken words detected'.`;
      
      const transcriptionResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [audioPart, { text: transcriptionPrompt }] }
      });

      const rawTranscript = (transcriptionResponse.text || "No clear spoken words detected").trim();

      // Step 2: gemini-3.1-flash-lite for text-to-JSON structuring (extremely cost-saving, fast, cheap)
      modelToUse = "gemini-3.1-flash-lite";
      const flashLitePrompt = `You are a structured metadata analyzer for NoteWave.
Analyze the following transcript text and generate a structured outline, summary, action items checklist, tags, and classification in the language written in the transcript.
Transcript text:
"""
${rawTranscript}
"""

All text values generated (including 'headlineTitle', 'summaryText', 'actionItems', 'ideaName', 'scheduledDate', 'projectStartDate', and the 'text' of each item in 'subTodos') MUST be written in the same language as the transcript text (e.g. if the transcript is written in Slovak, output Slovak; if English, output English; etc.).

Format your output EXACTLY as a complete, single, valid JSON object with these keys and values (do not place in markdown blocks, do not add stray characters):
{
  "transcript": "${rawTranscript.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
  "headlineTitle": "(For 'ideas', write a concise, summarizing brief title for the note or development idea, max 5-6 words in the transcript language. For 'reminders', the 'headlineTitle' MUST be the full, detailed, readable reminder text or chore task description exactly as parsed from the text, keep it literal, complete and fully descriptive of the task in the header, written in the transcript language.)",
  "summaryText": "(A conceptual, elegant 2-3 sentence overview or key takeaway of what was addressed, written in the transcript language. Highlight core ideas.)",
  "actionItems": "(A markdown checkbox list of tasks or next steps in the transcript language, e.g., ' - [ ] Send invoice\\n - [ ] Draft email'. If there are no clear instructional tasks or actions spoken, write '- [ ] No explicit action items detected.' or leave it empty.)",
  "category": "('ideas' or 'reminders'. Assign 'ideas' if the text addresses building an app, a tool, software, hardware, project initiatives, creative or design ideas, factual specs, or thoughts. Assign 'reminders' for routine errands, personal tasks, checklist reminders, meeting schedules, or calendar-driven tasks.)",
  "ideaName": "(For 'ideas' category, determine whether this belongs to a creative concept/app project or a standard factual memo. Write EXACTLY 'Idea' if it describes building something, software, project designs, or creative plans. Write EXACTLY 'Note' if it describes general facts, hardware specifications, simple statements, thoughts, or daily logs. Never output custom fictional brand names.)",
  "scheduledDate": "(For 'reminders' or scheduled tasks, parse specified target days or clock times from the text like 'tomorrow at noon', 'this Saturday at 10 AM', 'Monday morning' and write them cleanly in the transcript language. Leave empty if none specified.)",
  "projectStartDate": "(If any project start time is specified, e.g., 'start next week', 'kickoff on Monday', write it here in the transcript language. Leave empty if none.)",
  "isComplex": (true if the note represents a complex app, tool, or software/hardware creation project requiring modular work. Options: true or false),
  "subTodos": [
    {
      "id": "sub_1",
      "text": "Detailed actionable micro-task text in the transcript language",
      "completed": false
    }
  ],
  "tags": "comma, separated tags (generate MAXIMUM 2 or 3 highly relevant tags total for critical topics)"
}

Determine if a checklist checklist is truly helpful based on the text. If the text is just sharing facts or simple factual specs (like describing computer specifications or general info) with zero explicit action items, chores, build instructions, or tasks, you MUST set 'subTodos' to an empty array []. Only populate 'subTodos' if actual steps, projects, tasks, or actions are discussed or requested. If the project/task is COMPLEX ('isComplex' is true), generate an extensive, highly structured dividing roadmap (e.g. 5-8 sequential or modular sub-todos outlining dev jalon, database setups, UI layouts, testing, etc.) describing how to implement that specific software/hardware/app in the transcript language so the user has a full breakdown template to check off!`;

      const responseLite = await ai.models.generateContent({
        model: modelToUse,
        contents: flashLitePrompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const outputText = responseLite.text || "{}";
      try {
        parsedResult = JSON.parse(outputText);
        parsedResult.transcript = rawTranscript;
      } catch (parseError) {
        console.error("Gemini Flash-Lite failed to generate JSON. Falling back.", outputText);
        parsedResult = {
          transcript: rawTranscript,
          headlineTitle: rawTranscript.length > 50 ? rawTranscript.slice(0, 47) + "..." : rawTranscript,
          summaryText: "Voice note transcribed successfully",
          actionItems: "- [ ] Review voice transcription notes",
          category: rawTranscript.toLowerCase().includes("remind") || rawTranscript.toLowerCase().includes("at 10") ? "reminders" : "ideas",
          ideaName: "NoteWave Idea",
          scheduledDate: "",
          projectStartDate: "",
          isComplex: false,
          subTodos: [
            { id: `sub_fail_${Date.now()}`, text: "Review voice checklist", completed: false }
          ],
          tags: "audio, voice"
        };
      }
    }

    // Ensure subTodos has clean unique IDs and matches schema
    if (parsedResult.subTodos && Array.isArray(parsedResult.subTodos)) {
      parsedResult.subTodos = parsedResult.subTodos.map((t: any, idx: number) => ({
        id: t.id || `sub_${Date.now()}_${idx}`,
        text: t.text || "Action point",
        completed: !!t.completed,
      }));
    } else {
      parsedResult.subTodos = [];
    }

    res.json({
      success: true,
      model: currentTier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite",
      tier: currentTier,
      data: parsedResult,
    });

  } catch (err: any) {
    console.error("Transcription execution error:", err);
    res.status(500).json({
      error: "TRANSCRIPTION_FAILED",
      message: err.message || "An unexpected error occurred during audio processing and Gemini analysis.",
    });
  }
});


// Text / Transcript analysis endpoint using Gemini Language Models
app.post("/api/analyze-text", async (req, res) => {
  try {
    const { text, tier, customApiKey, filename, language } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing document text or transcript content" });
    }

    const isUsingCustomKey = !!customApiKey;
    const currentTier = (tier === "premium" || tier === "pro") ? "premium" : "free";
    const langNames: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      cs: "Czech",
      sk: "Slovak",
      ja: "Japanese"
    };
    const targetLanguage = langNames[language] || language || "Auto-Detect";
    const limitCount = currentTier === "premium" ? 50 : 3;

    // Check rate limit dynamically based on user's active plan
    const limitResult = checkRateLimit(req, limitCount);
    if (!limitResult.allowed) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: currentTier === "premium"
          ? `Pro plan daily limit reached (50 requests/day). Limit will reset eventually.`
          : `Free plan daily limit reached (3 requests/day). Toggle your plan to Pro/Premium in settings to increase your limit to 50 requests/day!`,
        resetAt: limitResult.resetTime,
      });
    }

    const modelToUse = currentTier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite";

    let ai;
    try {
      ai = getGeminiClient(customApiKey);
    } catch {
      return res.status(400).json({ 
        error: "INVALID_CREDENTIALS", 
        message: isUsingCustomKey 
          ? "The custom API key you provided was rejected or is invalid. Please double-check it in Settings." 
          : "System Gemini API key is currently missing. Please verify server environment keys, or set your personal key in Settings."
      });
    }

    const promptText = `You are an expert transcriber and organizational analyzer for NoteWave.
Analyze the following text document/transcript and generate a structured outline, summary, action items checklist, tags, and classification.
Input text / transcript from other source (filename: "${filename || "unnamed_source"}"):
"""
${text}
"""

All text values generated (including the 'transcript', 'headlineTitle', 'summaryText', 'actionItems', 'ideaName', 'scheduledDate', 'projectStartDate', and the 'text' of each item in 'subTodos') MUST be written in the same language as the input text (e.g. if the input is Slovak, output Slovak; if English, output English; etc.).

Format your output EXACTLY as a complete, single, valid JSON object with these keys and values (do not place in markdown blocks, do not add stray characters):
{
  "transcript": "(A clean, well-formatted transcription or verbatim copy of the input text in the input text's language. Keep paragraphs clean and readable. Max 1000 words. Do not skip key details.)",
  "headlineTitle": "(For 'ideas', write a concise, summarizing brief title for the note or development idea, max 5-6 words in the input text's language. For 'reminders', the 'headlineTitle' MUST be the full, detailed, readable reminder text or chore task description exactly as parsed from the text, keep it literal, complete and fully descriptive of the task in the header, in the input text's language.)",
  "summaryText": "(A conceptual, elegant 2-3 sentence overview or key takeaway of what was addressed, written in the input text's language. Highlight core ideas.)",
  "actionItems": "(A markdown checkbox list of tasks or next steps in the input text's language extracted from the text, e.g., ' - [ ] Send invoice\\n - [ ] Draft email'. If there are no clear instructional tasks or actions spoken, write '- [ ] No explicit action items detected.' or leave it empty.)",
  "category": "('ideas' or 'reminders'. Assign 'ideas' if the text addresses building an app, a tool, software, hardware, project initiatives, creative or design ideas, factual specs, or thoughts. Assign 'reminders' for routine errands, personal tasks, checklist reminders, meeting schedules, or calendar-driven tasks.)",
  "ideaName": "(For 'ideas' category, determine whether this belongs to a creative concept/app project or a standard factual memo. Write EXACTLY 'Idea' if it describes building something, software, project designs, or creative plans. Write EXACTLY 'Note' if it describes general facts, hardware specifications, simple statements, thoughts, or daily logs. Never output custom fictional brand names.)",
  "scheduledDate": "(For 'reminders' or scheduled tasks, parse specified target days or clock times from the text like 'tomorrow at noon', 'this Saturday at 10 AM', 'Monday morning' and write them cleanly in the input text's language. Leave empty if none specified.)",
  "projectStartDate": "(If any jalon/project start time is specified, e.g., 'start next week', 'kickoff on Monday', write it here in the input text's language. Leave empty if none.)",
  "isComplex": (true if the note represents a complex app, tool, or software/hardware creation project requiring modular work. Options: true or false),
  "subTodos": [
    {
      "id": "sub_1",
      "text": "Detailed actionable micro-task text in the input text's language",
      "completed": false
    }
  ],
  "tags": "comma, separated tags (generate MAXIMUM 2 or 3 highly relevant tags total for critical topics)"
}

Determine if a checklist checklist is truly helpful based on the text. If the text is just sharing facts or simple factual specs (like describing computer specifications or general info) with zero explicit action items, chores, build instructions, or tasks, you MUST set 'subTodos' to an empty array []. Only populate 'subTodos' if actual steps, projects, tasks, or actions are discussed or requested. If the project/task is COMPLEX ('isComplex' is true), generate an extensive, highly structured dividing roadmap (e.g. 5-8 sequential or modular sub-todos outlining dev jalon, database setups, UI layouts, testing, etc.) describing how to implement that specific software/hardware/app in the input text's language so the user has a full breakdown template to check off!`;

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: promptText,
      config: {
        responseMimeType: "application/json",
      },
    });

    const outputText = response.text || "{}";
    let parsedResult;
    try {
      parsedResult = JSON.parse(outputText);
      if (parsedResult.subTodos && Array.isArray(parsedResult.subTodos)) {
        parsedResult.subTodos = parsedResult.subTodos.map((t: any, idx: number) => ({
          id: t.id || `sub_${Date.now()}_${idx}`,
          text: t.text || "Action point",
          completed: !!t.completed,
        }));
      } else {
        parsedResult.subTodos = [];
      }
    } catch (parseError) {
      console.error("Gemini failed to generate strict JSON for text analysis. Falling back.", outputText);
      const titleMatch = outputText.match(/"headlineTitle"\s*:\s*"([^"]+)"/);
      const summaryMatch = outputText.match(/"summaryText"\s*:\s*"([^"]+)"/);
      
      parsedResult = {
        transcript: text,
        headlineTitle: titleMatch ? titleMatch[1] : (filename ? `Indexed: ${filename}` : "Analyzed Text Document"),
        summaryText: summaryMatch ? summaryMatch[1] : "Text documents indexed successfully.",
        actionItems: "- [ ] Review analyzed document suggestions",
        category: "ideas",
        ideaName: "NoteWave Text Idea",
        scheduledDate: "",
        projectStartDate: "",
        isComplex: false,
        subTodos: [
          { id: `sub_fail_${Date.now()}`, text: "Configure checklist roadmap", completed: false }
        ],
        tags: "document, transcript, upload"
      };
    }

    res.json({
      success: true,
      model: modelToUse,
      tier: currentTier,
      data: parsedResult,
    });

  } catch (err: any) {
    console.error("Text analysis execution error:", err);
    res.status(500).json({
      error: "ANALYSIS_FAILED",
      message: err.message || "An unexpected error occurred during text processing and Gemini analysis.",
    });
  }
});


// RAG AI Agent chat and retrieval proxy endpoint
app.post("/api/ai-agent", async (req, res) => {
  try {
    const { messages, notes, tier, customApiKey, language } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing message history contents" });
    }

    const currentTier = (tier === "premium" || tier === "pro") ? "premium" : "free";
    const limitCount = currentTier === "premium" ? 50 : 3;

    // Unified rate limiting accounting: prompts match voice/text indexing unit costs
    const limitResult = checkRateLimit(req, limitCount);
    if (!limitResult.allowed) {
      return res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: currentTier === "premium"
          ? `Premium account prompt limit reached (50 requests/day). Limit will reset tomorrow.`
          : `Free account prompt limit reached (3 requests/day). Upgrade to Pro in Settings to increase your limit to 50 requests/day!`,
        resetAt: limitResult.resetTime,
      });
    }

    const modelToUse = currentTier === "premium" ? "gemini-3.5-flash" : "gemini-3.1-flash-lite";

    let ai;
    try {
      ai = getGeminiClient(customApiKey);
    } catch {
      return res.status(400).json({ 
        error: "INVALID_CREDENTIALS", 
        message: customApiKey
          ? "The custom API key you provided was rejected or is invalid. Please double-check it in Settings." 
          : "System Gemini API key is currently missing. Please verify server environment keys, or set your personal key in Settings."
      });
    }

    // Prepare system prompt containing all actual workspace task/note logs (RAG)
    const systemPrompt = `You are NoteWave's AI Workspace Assistant, an intelligent productivity companion.
You have secure access to the user's complete task and note base (given below in JSON format).
Your job is to answer the user's questions about their notes, ideas, roadmap tasks, and general workspace details by performing lookups, summarizations, semantic matches, and reports.

Complete Task & Note Base:
${JSON.stringify(notes || [], null, 2)}

Instructions:
1. When asked for search queries or lookups (e.g. "find the note about server configurations"), search through all titles, transcripts, summaryText, actionItems, and tags of the provided notes. Describe where you found the information, summarize it, and list any associated checklist roadmaps cleanly.
2. When asked for reports/summaries (e.g. "give me the summary of last week"), review the 'createdAt' fields and content. Provide a beautiful bullet-point synthesis of what the user has worked on, highlighting high-priority items and completed versus active chores.
3. Answer naturally and write in the same primary language as the user's prompt (e.g. if Slovak, respond Slovak; if English, respond English; etc.). Keep formatting elegant, using Markdown for headers, lists, bold text, or code snippets. Explain concepts clearly. Do NOT start with conversational filler like 'Sure!' or 'Of course!', get straight to answering the details with premium style.
4. If the user asks general questions unrelated to their task base, you can still help them as a general workspace assistant, but always try to tie context back to their task base where relevant.
5. If the note base is empty, let the user know they can dictate/record voice memos or upload text logs to build their active workspace.`;

    // Map message structures for @google/genai SDK
    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const replyText = response.text || "I was unable to retrieve a response from the workspace repository.";

    res.json({
      success: true,
      model: modelToUse,
      tier: currentTier,
      reply: replyText
    });

  } catch (err: any) {
    console.error("AI Agent execution error:", err);
    res.status(500).json({
      error: "AGENT_QUERY_FAILED",
      message: err.message || "An unexpected error occurred during AI Agent thinking cycle.",
    });
  }
});


// ---------------------------------------------
// Development & Production Serving
// ---------------------------------------------

async function initializeApp() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode is handled by Vite Server as Middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve built static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NoteWave full-stack server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch((e) => {
  console.error("Failed to initialize server:", e);
});
