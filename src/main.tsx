import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { appConfig } from "./lib/config.ts";

if (appConfig.application === 'CALENDAR') {
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (link) link.href = '/favicon-calendar.svg';
  document.title = 'Twake Calendar Admin';
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
