import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider, auth0Config } from "./auth";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider {...auth0Config}>
      <App />
    </Auth0Provider>
  </StrictMode>
);
