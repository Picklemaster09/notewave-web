import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider, auth0Config } from "./auth";
import App from "./App.tsx";
import "./index.css";

// Auth0Provider throws if domain/clientId are missing (e.g. secrets not yet
// configured), which would white-screen the whole page. Only wrap when the
// config is present; otherwise render the UI so login can be wired up later.
const hasAuth0Config = Boolean(auth0Config.domain && auth0Config.clientId);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {hasAuth0Config ? (
      <Auth0Provider {...auth0Config}>
        <App />
      </Auth0Provider>
    ) : (
      <App />
    )}
  </StrictMode>
);
