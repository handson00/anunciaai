import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica tema salvo antes do render para evitar flash
(() => {
  try {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  } catch {}
})();

createRoot(document.getElementById("root")!).render(<App />);
