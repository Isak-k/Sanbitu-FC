import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/ThemeProvider";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import "./utils/env-check";
import { registerSW } from 'virtual:pwa-register';

// Register the service worker
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem
    disableTransitionOnChange
  >
    <App />
  </ThemeProvider>
);
