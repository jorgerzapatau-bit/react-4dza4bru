// ─────────────────────────────────────────────
//  screens/LoginScreen.jsx
//  Pantalla de inicio de sesión.
//  Soporta login normal y recuperación de contraseña.
//
//  Props:
//    gymConfig   object | null  — config del gym (logo, nombre)
//    gymId       string         — slug del gym (p.ej. "gymfit-merida")
//    onLogin     (user) => void — callback al autenticar con éxito
//
//  Uso:
//    import LoginScreen from "./screens/LoginScreen";
//    <LoginScreen gymConfig={gymConfigForLogin} gymId={gymIdForLogin} onLogin={handleLogin} />
// ─────────────────────────────────────────────

import { useState } from "react";
import { auth, getUserGymId } from "../supabase";

// ── Estilos base reutilizados ────────────────
const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 12,
  padding: "12px 14px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const btnPrimaryStyle = (loading) => ({
  width: "100%",
  padding: "13px 0",
  borderRadius: 14,
  border: "none",
  cursor: loading ? "not-allowed" : "pointer",
  background: "linear-gradient(135deg,#6c63ff,#e040fb)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: "inherit",
  boxShadow: "0 4px 18px rgba(108,99,255,.35)",
  opacity: loading ? 0.7 : 1,
  transition: "opacity .2s",
});

const btnGhostStyle = {
  width: "100%",
  marginTop: 12,
  padding: "10px 0",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  background: "transparent",
  color: "#4b4b6a",
  fontSize: 12,
  fontFamily: "inherit",
};

// ─────────────────────────────────────────────
export default function LoginScreen({ gymConfig, gymId, onLogin }) {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const logo   = gymConfig?.logo;
  const nombre = gymConfig?.nombre || gymId;

  // ── Login ────────────────────────────────────
  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!email || !password) { setError("Completá email y contraseña"); return; }
    setError("");
    setLoading(true);

    const { user, error: authErr } = await auth.signIn(email.trim(), password);
    if (authErr || !user) {
      setError(authErr || "Error al iniciar sesión");
      setLoading(false);
      return;
    }

    // Verificar que el usuario tenga acceso a este gym
    const userGymId = await getUserGymId(user.id);
    if (!userGymId || userGymId !== gymId) {
      await auth.signOut();
      setError("No tenés acceso a este gimnasio");
      setLoading(false);
      return;
    }

    setLoading(false);
    onLogin(user);
  };

  // ── Recuperar contraseña ─────────────────────
  const handleReset = async (e) => {
    e?.preventDefault();
    if (!email) { setError("Ingresá tu email"); return; }
    setError("");
    setLoading(true);
    const ok = await auth.resetPassword(email.trim());
    setLoading(false);
    if (ok) { setResetSent(true); }
    else    { setError("No se pudo enviar el email. Verificá la dirección."); }
  };

  const backToLogin = () => {
    setResetMode(false);
    setResetSent(false);
    setError("");
  };

  // ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a12",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "system-ui,sans-serif",
    }}>
      {/* ── Card principal ── */}
      <div style={{
        width: "100%",
        maxWidth: 360,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 24,
        padding: "32px 28px 28px",
        backdropFilter: "blur(20px)",
      }}>

        {/* ── Logo + nombre del gym ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
          {logo
            ? (
              <img
                src={logo}
                alt="logo"
                style={{
                  width: 72, height: 72,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(167,139,250,.4)",
                  marginBottom: 12,
                }}
              />
            ) : (
              <div style={{
                width: 72, height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#6c63ff,#e040fb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 32,
                marginBottom: 12,
                boxShadow: "0 4px 20px rgba(108,99,255,.4)",
              }}>
                💪
              </div>
            )
          }
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, textAlign: "center", margin: 0 }}>
            {nombre}
          </h1>
          <p style={{ color: "#4b4b6a", fontSize: 12, marginTop: 4 }}>
            Panel de administración
          </p>
        </div>

        {/* ── Modo recuperación ── */}
        {resetMode ? (
          <>
            <p style={{ color: "#a78bfa", fontSize: 13, textAlign: "center", marginBottom: 18, lineHeight: 1.5 }}>
              {resetSent
                ? "✅ Email enviado. Revisá tu bandeja."
                : "Ingresá tu email para recuperar la contraseña."
              }
            </p>

            {!resetSent && (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  style={{ ...inputStyle, marginBottom: 12 }}
                />
                {error && (
                  <p style={{ color: "#f43f5e", fontSize: 12, marginBottom: 10, textAlign: "center" }}>
                    {error}
                  </p>
                )}
                <button onClick={handleReset} disabled={loading} style={btnPrimaryStyle(loading)}>
                  {loading ? "Enviando..." : "Enviar email"}
                </button>
              </>
            )}

            <button onClick={backToLogin} style={btnGhostStyle}>
              ← Volver al login
            </button>
          </>
        ) : (
          /* ── Modo login normal ── */
          <>
            {/* Email */}
            <div style={{ marginBottom: 12 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={inputStyle}
              />
            </div>

            {/* Contraseña con toggle ver/ocultar */}
            <div style={{ marginBottom: 16, position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{ ...inputStyle, padding: "12px 44px 12px 14px" }}
              />
              <button
                onClick={() => setShowPass(p => !p)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#4b4b6a",
                  fontSize: 16,
                  padding: 0,
                }}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>

            {error && (
              <p style={{ color: "#f43f5e", fontSize: 12, marginBottom: 12, textAlign: "center" }}>
                {error}
              </p>
            )}

            <button onClick={handleLogin} disabled={loading} style={btnPrimaryStyle(loading)}>
              {loading ? "Ingresando..." : "Ingresar"}
            </button>

            <button onClick={() => { setResetMode(true); setError(""); }} style={btnGhostStyle}>
              Olvidé mi contraseña
            </button>
          </>
        )}
      </div>
    </div>
  );
}
