import { useState, useEffect } from "react";
import { supabase, getGymId, auth, getUserGymId, getUserRole } from "./supabase";
import GymApp from "./components/GymApp";
import LoginScreen from "./screens/LoginScreen";

export default function App() {
  const [authState, setAuthState] = useState("checking"); // "checking" | "login" | "app"
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [gymIdForLogin, setGymIdForLogin] = useState(null);
  const [gymConfigForLogin, setGymConfigForLogin] = useState(null);
  const [gymIdNoExiste, setGymIdNoExiste] = useState(false);
  const GYM_ID_URL = getGymId();

  useEffect(() => {
    // Timeout de seguridad: si checkSession tarda más de 8 segundos, ir al login
    const safetyTimer = setTimeout(() => {
      setAuthState(prev => prev === "checking" ? "login" : prev);
    }, 8000);

    async function checkSession() {
      try {
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
          const userGymId = await getUserGymId(session.user.id, GYM_ID_URL);
          if (userGymId === GYM_ID_URL) {
            setCurrentUser(session.user);
            const role = await getUserRole(session.user.id, GYM_ID_URL);
            setUserRole(role || "admin");
            setAuthState("app");
            return;
          }
          await auth.signOut();
        }
        setAuthState("login");
      } catch (err) {
        // Si algo falla inesperadamente, ir al login en lugar de quedarse en pantalla negra
        console.error("[GymFit] Error al verificar sesión:", err);
        setAuthState("login");
      }
    }

    checkSession().finally(() => clearTimeout(safetyTimer));
  }, []); // eslint-disable-line

  // ── Auto-refresh: renueva el token cada 50 min mientras la pestaña esté abierta ──
  // Se activa solo cuando el usuario está logueado (authState === "app")
  useEffect(() => {
    if (authState !== "app") return;

    const INTERVAL_MS = 50 * 60 * 1000; // 50 minutos

    const interval = setInterval(async () => {
      try {
        const raw = localStorage.getItem("gymfit_session");
        if (!raw) return;
        const session = JSON.parse(raw);
        if (!session?.refresh_token) return;

        const refreshed = await auth.refreshSession(session.refresh_token);
        if (!refreshed) {
          // Refresh falló (token revocado o expirado) → forzar login
          console.warn("[GymFit] Auto-refresh falló — sesión expirada, cerrando sesión.");
          setCurrentUser(null);
          setUserRole(null);
          setAuthState("login");
        }
      } catch (e) {
        console.error("[GymFit] Error en auto-refresh:", e);
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval); // limpia al desloguear o desmontar
  }, [authState]);

  const handleLogin = (user, role) => {
    setCurrentUser(user);
    setUserRole(role || "admin");
    setAuthState("app");
  };

  const handleLogout = async () => {
    await auth.signOut();
    setCurrentUser(null);
    setUserRole(null);
    setAuthState("login");
  };

  // ── Verificando sesión ──
  if (authState === "checking") return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid var(--col-accent-border)", borderTopColor: "var(--col-accent)", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Verificando sesión...</p>
      </div>
    </div>
  );

  // ── Sin parámetro ?gym= en la URL ──
  if (authState === "login" && !GYM_ID_URL) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>🔒</div>
      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Acceso no válido</h1>
      <p style={{ color: "var(--text-tertiary)", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>Esta aplicación requiere un enlace específico de tu gimnasio.</p>
      <div style={{ marginTop: 24, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 18px" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 11, fontFamily: "monospace" }}>tudominio.com/?gym=nombre-del-gym</p>
      </div>
    </div>
  );

  // ── Gym no existe en Supabase ──
  if (authState === "login" && gymIdNoExiste) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: "var(--col-danger-soft)", border: "1px solid var(--col-danger-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>❌</div>
      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Gimnasio no encontrado</h1>
      <p style={{ color: "var(--text-tertiary)", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
        El enlace <span style={{ color: "var(--col-accent-text)", fontFamily: "monospace" }}>?gym={GYM_ID_URL}</span> no corresponde a ningún gimnasio registrado.
      </p>
    </div>
  );

  // ── Login ──
  if (authState === "login") return (
    <LoginScreen gymConfig={gymConfigForLogin} gymId={gymIdForLogin} onLogin={handleLogin} />
  );

  // ── App principal ──
  const GYM_ID = gymIdForLogin || GYM_ID_URL;
  return <GymApp gymId={GYM_ID} currentUser={currentUser} userRole={userRole} onLogout={handleLogout} />;
}
