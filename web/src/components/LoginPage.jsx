import { useState } from "react";
import { signIn, signUp, signInWithGoogle } from "../lib/supabase.js";
import { LIGHT } from "../theme.js";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext.jsx";
import { useI18n } from "../i18n/index.jsx";
import useIsMobile from "../hooks/useIsMobile.js";
import TosModal from "./TosModal.jsx";

const LANGS = [
  { code: "cs", label: "CS" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

export default function LoginPage({ onAuth }) {
  return (
    <ThemeProvider forceTheme={LIGHT}>
      <LoginPageInner onAuth={onAuth} />
    </ThemeProvider>
  );
}

function LoginPageInner({ onAuth }) {
  const { t } = useTheme();
  const { tr, lang, changeLang } = useI18n();
  const mobile = useIsMobile();
  const [mode, setMode]       = useState("login"); // "login" | "register" | "verify"
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTos, setShowTos] = useState(false);

  const doRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await signUp(email, password);
      if (data.user && !data.session) {
        setMode("verify");
      } else {
        onAuth(data.session);
      }
    } catch (err) {
      setError(err.message === "User already registered"
        ? tr('login.alreadyRegistered')
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (mode === "register") {
      setShowTos(true);
      return;
    }
    setLoading(true);
    try {
      const data = await signIn(email, password);
      onAuth(data.session);
    } catch (err) {
      setError(err.message === "Invalid login credentials"
        ? tr('login.invalidCredentials')
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: t.bg, fontFamily: "'Exo 2',sans-serif", padding: mobile ? 12 : 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(10% 0%,90% 0%,100% 10%,100% 90%,90% 100%,10% 100%,0% 90%,0% 10%)" }}>
            <span style={{ fontSize: "18px" }}>🔧</span>
          </div>
          <div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: mobile ? "1.4rem" : "1.8rem", fontWeight: 800, color: t.text, letterSpacing: "0.05em" }}>
              GEAR<span style={{ color: t.accent }}>Brain</span>
            </div>
            <div style={{ fontSize: "0.6rem", color: t.textFaint, letterSpacing: "0.12em" }}>{tr('login.subtitle')}</div>
          </div>
        </div>

        {/* Language switcher */}
        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 20 }}>
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => changeLang(l.code)}
              style={{ background: lang === l.code ? t.accent : "transparent", color: lang === l.code ? "#fff" : t.textFaint, border: `1px solid ${lang === l.code ? t.accent : t.border}`, padding: "4px 10px", fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderRadius: 2, letterSpacing: "0.04em" }}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Verify email screen */}
        {mode === "verify" && (
          <div style={{ background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 4, padding: mobile ? 18 : 28, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 16 }}>📧</div>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: "1.2rem", fontWeight: 700, color: t.doneStatusColor, marginBottom: 12 }}>
              {tr('login.verifyTitle')}
            </div>
            <div style={{ fontSize: "0.85rem", color: t.textMuted, lineHeight: 1.7, marginBottom: 20 }}>
              {tr('login.verifyMsg', { email: `</strong>${email}<strong>` }).split(email).map((part, i, arr) =>
                i < arr.length - 1
                  ? <span key={i}>{part}<strong style={{ color: t.text }}>{email}</strong></span>
                  : <span key={i}>{part}</span>
              )}
            </div>
            <button onClick={() => { setMode("login"); setError(null); }}
              style={{ background: t.accent, color: "#fff", border: "none", padding: "10px 24px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
              {tr('login.backToLogin')}
            </button>
          </div>
        )}

        {/* Login / Register form */}
        {mode !== "verify" && (
          <div style={{ background: t.bgModal, border: `1px solid ${t.border}`, borderRadius: 4, padding: mobile ? 18 : 28 }}>
            <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: "1.3rem", fontWeight: 700, color: t.text, marginBottom: 20, letterSpacing: "0.05em", textAlign: "center" }}>
              {mode === "login" ? tr('login.loginTitle') : tr('login.registerTitle')}
            </div>

            {/* Google */}
            <button onClick={handleGoogle}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", color: "#333", border: `1px solid ${t.border}`, padding: "11px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", borderRadius: 2, marginBottom: 16 }}>
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              {tr('login.google')}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 1, background: t.border }} />
              <span style={{ fontSize: "0.68rem", color: t.textVeryFaint, letterSpacing: "0.08em" }}>{tr('login.or')}</span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr('login.email')}</div>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr('login.emailPlaceholder')} autoComplete="email"
                  style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.85rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.68rem", color: t.textFaint, letterSpacing: "0.1em", marginBottom: 6 }}>{tr('login.password')}</div>
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={tr('login.passwordPlaceholder')} autoComplete={mode === "login" ? "current-password" : "new-password"}
                  style={{ width: "100%", background: t.bgInput, border: `1px solid ${t.borderInput}`, color: t.text, padding: "10px 12px", fontSize: "0.85rem", fontFamily: "inherit", borderRadius: 2, outline: "none" }} />
              </div>

              {error && (
                <div style={{ marginBottom: 14, padding: "10px 13px", background: "rgba(220,38,38,0.08)", border: "1px solid #dc2626", color: "#dc2626", fontSize: "0.82rem", borderRadius: 2 }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{ width: "100%", background: t.accent, color: "#fff", border: "none", padding: "11px", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.08em", cursor: loading ? "wait" : "pointer", fontFamily: "inherit", borderRadius: 2, opacity: loading ? 0.6 : 1 }}>
                {loading ? tr('login.processing') : mode === "login" ? tr('login.loginBtn') : tr('login.registerBtn')}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.78rem", color: t.textFaint }}>
              {mode === "login" ? (
                <>{tr('login.noAccount')} <button onClick={() => { setMode("register"); setError(null); }} style={{ background: "none", border: "none", color: t.accentText, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>{tr('login.register')}</button></>
              ) : (
                <>{tr('login.hasAccount')} <button onClick={() => { setMode("login"); setError(null); }} style={{ background: "none", border: "none", color: t.accentText, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>{tr('login.login')}</button></>
              )}
            </div>
          </div>
        )}
      </div>

      {showTos && (
        <TosModal
          tr={tr}
          onAccept={() => { setShowTos(false); doRegister(); }}
          onDecline={() => setShowTos(false)}
        />
      )}
    </div>
  );
}
