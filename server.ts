// Local development entry point only.
// Production uses lambda.ts (AWS Lambda) or a process manager pointing at server-app.ts.
import dotenv from "dotenv";
dotenv.config();

import { createServer as createViteServer } from "vite";
import { app } from "./server-app.js";

const PORT = Number(process.env.PORT) || 3000;

async function startDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NoteWave dev server running on http://localhost:${PORT}`);
  });
}

startDevServer().catch((e) => {
  console.error("Failed to start dev server:", e);
  process.exit(1);
});
