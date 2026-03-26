import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { DARK, LIGHT } from "../theme.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, forceTheme }) {
  const [darkMode, setDarkMode] = useState(false);
  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), []);
  const t = forceTheme ?? (darkMode ? DARK : LIGHT);

  const value = useMemo(
    () => ({ t, darkMode, toggleDarkMode }),
    [t, darkMode, toggleDarkMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
