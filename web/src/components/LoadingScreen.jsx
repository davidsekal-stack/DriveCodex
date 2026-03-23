import { DARK } from "../theme.js";

export default function LoadingScreen({ message }) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: DARK.bg,
        color: DARK.textFaint,
        fontFamily: "'IBM Plex Mono',monospace",
        fontSize: "0.85rem",
        letterSpacing: "0.1em",
      }}
    >
      {message}
    </div>
  );
}
