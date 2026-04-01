import { useTheme } from "../contexts/ThemeContext.jsx";

export default function GlobalStyles() {
  const { t, darkMode } = useTheme();
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Rajdhani:wght@400;600;700&display=swap');
      html { font-size: 17px; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { width: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.accent}; border-radius: 3px; }
      @keyframes fadeIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .fade-in   { animation: fadeIn 0.35s ease forwards; }
      .case-item { transition: background 0.12s; }
      .case-item:hover { background: ${darkMode ? "#0c1e24" : "#d8eef0"} !important; }
      input:focus, textarea:focus, select:focus { border-color: ${t.accent} !important; }
    `}</style>
  );
}
