import { useState, useEffect } from "react";
import { supabase, getGymId, auth, getUserGymId } from "./supabase";
import GymApp from "./components/GymApp";
import LoginScreen from "./screens/LoginScreen";

export default function App() {
  const [authState, setAuthState] = useState("checking"); // "checking" | "login" | "app"
  const [currentUser, setCurrentUser] = useState(null);
  const [gymIdForLogin, setGymIdForLogin] = useState(null);
  const [gymConfigForLogin, setGymConfigForLogin] = useState(null);
  const [gymIdNoExiste, setGymIdNoExiste] = useState(false);
  const GYM_ID_URL = getGymId();

  useEffect(() => {
    async function checkSession() {
      if (!GYM_ID_URL) {
        setAuthState("login");
        return;
      }
      const gymData = await supabase.getGym(GYM_ID_URL);
      if (!gymData) {
        setGymIdNoExiste(true);
        setAuthState("login");
        return;
      }
      setGymConfigForLogin(gymData);
      setGymIdForLogin(GYM_ID_URL);

      const session = await auth.getSession();
      if (session?.user) {
        const userGymId = await getUserGymId(session.user.id);
        if (userGymId === GYM_ID_URL) {
          setCurrentUser(session.user);
          setAuthState("app");
          return;
        }
        await auth.signOut();
      }
      setAuthState("login");
    }
    checkSession();
  }, []); // eslint-disable-line

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthState("app");
  };

  const handleLogout = async () => {
    await auth.signOut();
    setCurrentUser(null);
    setAuthState("login");
  };

  // ── Verificando sesión ──
  if (authState === "checking") return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(108,99,255,.3)", borderTopColor: "#6c63ff", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "#4b4b6a", fontSize: 13 }}>Verificando sesión...</p>
      </div>
    </div>
  );

  // ── Sin parámetro ?gym= en la URL ──
  if (authState === "login" && !GYM_ID_URL) return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: "rgba(244,63,94,.15)", border: "1px solid rgba(244,63,94,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>🔒</div>
      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Acceso no válido</h1>
      <p style={{ color: "#4b4b6a", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>Esta aplicación requiere un enlace específico de tu gimnasio.</p>
      <div style={{ marginTop: 24, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 18px" }}>
        <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>tudominio.com/?gym=nombre-del-gym</p>
      </div>
    </div>
  );

  // ── Gym no existe en Supabase ──
  if (authState === "login" && gymIdNoExiste) return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: "rgba(244,63,94,.15)", border: "1px solid rgba(244,63,94,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>❌</div>
      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Gimnasio no encontrado</h1>
      <p style={{ color: "#4b4b6a", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
        El enlace <span style={{ color: "#a78bfa", fontFamily: "monospace" }}>?gym={GYM_ID_URL}</span> no corresponde a ningún gimnasio registrado.
      </p>
    </div>
  );

  // ── Login ──
  if (authState === "login") return (
    <LoginScreen gymConfig={gymConfigForLogin} gymId={gymIdForLogin} onLogin={handleLogin} />
  );

  // ── App principal ──
  const GYM_ID = gymIdForLogin || GYM_ID_URL;
  return <GymApp gymId={GYM_ID} currentUser={currentUser} onLogout={handleLogout} />;
}
