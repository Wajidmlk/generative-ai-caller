"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}>({ theme: "light", toggle: () => {}, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem("gai_theme") as Theme | null) || "light";
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
    setReady(true);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("gai_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  function toggle() {
    setTheme(theme === "light" ? "dark" : "light");
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: "var(--bg, #f4f6f8)" }} />;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
