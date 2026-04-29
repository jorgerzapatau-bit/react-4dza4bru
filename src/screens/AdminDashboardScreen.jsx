// src/screens/AdminDashboardScreen.jsx
// Dashboard operativo para Administrador (y Dueño)

import { useMemo, useState, useEffect } from "react";
import { getMembershipInfo } from "../utils/membershipUtils";
import { diasParaVencer, diasParaCumple } from "../utils/dateUtils";
import { supabase } from "../supabase";

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ─── StatCard ────────────────────────────────────────────────── */
function StatCard({ emoji, title, value, sub, accent = "#6c63ff", onClick, badge, badgeColor = "#f43f5e", children, darkMode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${hovered && onClick ? accent + "55" : "var(--border)"}`,
        borderRadius: 20,
        padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .2s, box-shadow .2s",
        boxShadow: hovered && onClick ? `0 4px 24px ${accent}22` : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent strip */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accent, borderRadius: "20px 0 0 20px" }} />

      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          background: badgeColor, color: "#fff", borderRadius: 20,
          padding: "2px 8px", fontSize: 11, fontWeight: 700,
        }}>{badge}</span>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingLeft: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: accent + "22", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 20,
        }}>{emoji}</div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase", marginBottom: 3 }}>{title}</p>
          <p style={{ color: "var(--text-primary)", fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 4 }}>{sub}</p>}
        </div>
      </div>

      {children && <div style={{ marginTop: 14, paddingLeft: 10 }}>{children}</div>}
    </div>
  );
}

/* ─── MemberRow ───────────────────────────────────────────────── */
function MemberRow({ m, right, onClick, darkMode }) {
  return (
    <div
      onClick={onClick}
      className="rh"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 6px", borderRadius: 10, cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
        background: "linear-gradient(135deg,#6c63ff44,#e040fb44)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>
        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
      </div>
      <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 500, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nombre}</span>
      {right}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────── */
export default function AdminDashboardScreen({
  gymConfig, ahora,
  miembros, txs,
  setScreen, setSelM, setModal, setFiltroEstado,
  gymId,
  darkMode,
}) {
  const [asistenciaHoy, setAsistenciaHoy] = useState(null);

  /* Load today's attendance from supabase */
  useEffect(() => {
    async function load() {
      try {
        const tb = await supabase.from("accesos");
        const all = await tb.select(gymId);
        const hoy = todayISO();
        const hoyAccesos = (all || []).filter(a => (a.created_at || a.fecha || "").startsWith(hoy));
        setAsistenciaHoy(hoyAccesos.length);
      } catch {
        setAsistenciaHoy(0);
      }
    }
    if (gymId) load();
  }, [gymId]);

  /* ── Derived data ── */
  const hoy = todayISO();
  const mesHoy = hoy.slice(0, 7);

  // Miembros activos
  const miembrosActivos = useMemo(
    () => miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo"),
    [miembros, txs]
  );

  // Nuevos del mes
  const nuevosEsteMes = useMemo(
    () => miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesHoy)),
    [miembros, mesHoy]
  );

  // Vencimientos esta semana (1-7 días)
  const vencimientosSemana = useMemo(() => {
    return miembros.map(m => {
      const info = getMembershipInfo(m.id, txs, m);
      if (info.estado !== "Activo") return null;
      const dias = diasParaVencer(info.vence);
      if (dias === null || dias > 7 || dias < 0) return null;
      return { ...m, diasVence: dias, vence: info.vence, plan: info.plan };
    }).filter(Boolean).sort((a, b) => a.diasVence - b.diasVence);
  }, [miembros, txs]);

  // Ingresos de hoy
  const ingresosHoy = useMemo(() => {
    return txs
      .filter(t => t.tipo === "ingreso" && (t.fecha || "").startsWith(hoy))
      .reduce((s, t) => s + Number(t.monto), 0);
  }, [txs, hoy]);

  // Membresías vencidas (estado vencida/sin membresía con actividad previa)
  const membresiasVencidas = useMemo(() => {
    return miembros.filter(m => {
      const info = getMembershipInfo(m.id, txs, m);
      return info.estado === "Vencido" || info.estado === "vencida";
    });
  }, [miembros, txs]);

  // Cumpleaños esta semana
  const cumplesSemana = useMemo(() => {
    return miembros
      .map(m => ({ ...m, diasCumple: diasParaCumple(m.fecha_nacimiento) }))
      .filter(m => m.diasCumple !== null && m.diasCumple <= 7)
      .sort((a, b) => a.diasCumple - b.diasCumple);
  }, [miembros]);

  /* ── Productos bajos en stock (from localStorage cache or props) ── */
  const [productosBajos, setProductosBajos] = useState([]);
  useEffect(() => {
    async function loadProductos() {
      try {
        const res = await fetch(
          `https://gymbkefexmcivhzetcgy.supabase.co/rest/v1/products?gym_id=eq.${gymId}&is_active=eq.true`,
          {
            headers: {
              apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bWJrZWZleG1jaXZoemV0Y2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNzE4MDMsImV4cCI6MjA2MDk0NzgwM30.q6KxKC7pXCMZeGqzXnLQjMh3tLLqLBrplr07IIMKK2o",
              Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bWJrZWZleG1jaXZoemV0Y2d5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzNzE4MDMsImV4cCI6MjA2MDk0NzgwM30.q6KxKC7pXCMZeGqzXnLQjMh3tLLqLBrplr07IIMKK2o",
            },
          }
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          const bajos = data.filter(p => {
            const limit = p.stock_alert_limit;
            const stock = p.stock_initial;
            if (limit == null || stock == null) return false;
            return Number(stock) <= Number(limit);
          });
          setProductosBajos(bajos);
        }
      } catch {
        setProductosBajos([]);
      }
    }
    if (gymId) loadProductos();
  }, [gymId]);

  /* ── Render ── */
  const tz = gymConfig?.zona_horaria || "America/Merida";
  const fechaStr = ahora.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: tz });
  const horaStr = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz });

  const DIVIDER = <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Header sticky ── */}
      <div style={{
        flexShrink: 0, padding: "16px 28px 16px",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "var(--bg-base)", zIndex: 50,
      }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase" }}>
                {fechaStr.replace(/\b(\w)/g, c => c.toUpperCase())}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>
                  {gymConfig?.nombre || "GymFit Pro"}
                </h1>
                <span style={{ color: "#a78bfa", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{horaStr}</span>
              </div>
            </div>
            {/* Mobile: mensaje icon */}
            <button
              className="mobile-only"
              onClick={() => setScreen("mensajes")}
              style={{ width: 38, height: 38, borderRadius: 11, border: "none", cursor: "pointer", background: "rgba(255,255,255,.07)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}
            >💬</button>
          </div>
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "20px 28px 40px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}>

            {/* 👥 Miembros Activos */}
            <StatCard
              emoji="👥"
              title="Miembros Activos"
              value={miembrosActivos.length}
              sub={`${miembros.length} total registrados`}
              accent="#6c63ff"
              onClick={() => { setFiltroEstado("Activo"); setScreen("miembros"); }}
              badge={nuevosEsteMes.length}
              badgeColor="#22c55e"
              darkMode={darkMode}
            >
              {nuevosEsteMes.length > 0 && (
                <div style={{ background: "rgba(34,197,94,.08)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(34,197,94,.2)" }}>
                  <p style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>✨ {nuevosEsteMes.length} nuevo{nuevosEsteMes.length > 1 ? "s" : ""} este mes</p>
                  {nuevosEsteMes.slice(0, 3).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                      </div>
                      <span style={{ color: "var(--text-secondary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.nombre}</span>
                    </div>
                  ))}
                  {nuevosEsteMes.length > 3 && <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>+{nuevosEsteMes.length - 3} más</p>}
                </div>
              )}
            </StatCard>

            {/* ⏰ Vencimientos esta semana */}
            <StatCard
              emoji="⏰"
              title="Vencimientos esta semana"
              value={vencimientosSemana.length}
              sub="Membresías próximas a vencer"
              accent="#f59e0b"
              badge={vencimientosSemana.filter(m => m.diasVence <= 2).length}
              badgeColor="#f43f5e"
              onClick={() => setScreen("mensajes")}
              darkMode={darkMode}
            >
              {vencimientosSemana.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {vencimientosSemana.slice(0, 4).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#f59e0b44,#f43f5e44)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                      </div>
                      <span style={{ color: "var(--text-primary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nombre}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: m.diasVence === 0 ? "rgba(244,63,94,.2)" : m.diasVence <= 2 ? "rgba(245,158,11,.2)" : "rgba(167,139,250,.15)",
                        color: m.diasVence === 0 ? "#f43f5e" : m.diasVence <= 2 ? "#f59e0b" : "#a78bfa",
                        flexShrink: 0,
                      }}>
                        {m.diasVence === 0 ? "Hoy" : m.diasVence === 1 ? "Mañana" : `${m.diasVence}d`}
                      </span>
                    </div>
                  ))}
                  {vencimientosSemana.length > 4 && (
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>+{vencimientosSemana.length - 4} más</p>
                  )}
                </div>
              )}
            </StatCard>

            {/* 💰 Ingresos de Hoy */}
            <StatCard
              emoji="💰"
              title="Ingresos de Hoy"
              value={fmt(ingresosHoy)}
              sub={`${txs.filter(t => t.tipo === "ingreso" && (t.fecha || "").startsWith(hoy)).length} transacciones hoy`}
              accent="#22d3ee"
              onClick={() => setScreen("caja")}
              darkMode={darkMode}
            >
              {txs.filter(t => t.tipo === "ingreso" && (t.fecha || "").startsWith(hoy)).length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {txs
                    .filter(t => t.tipo === "ingreso" && (t.fecha || "").startsWith(hoy))
                    .slice(0, 3)
                    .map((t, i) => {
                      const mid = t.miembroId || t.miembro_id;
                      const miembro = mid ? miembros.find(m => m.id === mid) : null;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#22d3ee44,#6c63ff44)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                            {miembro?.foto ? <img src={miembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "💰"}
                          </div>
                          <span style={{ color: "var(--text-secondary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{t.desc || t.descripcion || t.categoria}</span>
                          <span style={{ color: "#22d3ee", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginLeft: 8 }}>{fmt(t.monto)}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </StatCard>

            {/* 📦 Productos bajos en stock */}
            <StatCard
              emoji="📦"
              title="Productos bajos en stock"
              value={productosBajos.length}
              sub="Tienda — debajo del límite crítico"
              accent="#f43f5e"
              badge={productosBajos.length}
              badgeColor="#f43f5e"
              onClick={() => setScreen("tienda")}
              darkMode={darkMode}
            >
              {productosBajos.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {productosBajos.slice(0, 4).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-primary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#f43f5e", marginLeft: 8 }}>Stock: {p.stock_initial ?? "—"}</span>
                    </div>
                  ))}
                  {productosBajos.length > 4 && <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>+{productosBajos.length - 4} más</p>}
                </div>
              ) : (
                <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>✅ Todos los productos con stock suficiente</p>
              )}
            </StatCard>

            {/* 🎂 Cumpleaños esta semana */}
            <StatCard
              emoji="🎂"
              title="Cumpleaños esta semana"
              value={cumplesSemana.length}
              sub="Próximos 7 días"
              accent="#e040fb"
              darkMode={darkMode}
            >
              {cumplesSemana.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {cumplesSemana.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: "linear-gradient(135deg,#e040fb44,#f43f5e44)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.diasCumple === 0 ? "🎉" : "🎂")}
                      </div>
                      <span style={{ color: "var(--text-primary)", fontSize: 12, flex: 1 }}>{m.nombre}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: m.diasCumple === 0 ? "rgba(224,64,251,.25)" : "rgba(224,64,251,.1)",
                        color: "#e040fb",
                      }}>
                        {m.diasCumple === 0 ? "¡Hoy!" : `en ${m.diasCumple}d`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Sin cumpleaños en los próximos 7 días</p>
              )}
            </StatCard>

            {/* 🆕 Nuevos miembros del mes */}
            <StatCard
              emoji="🆕"
              title="Nuevos miembros del mes"
              value={nuevosEsteMes.length}
              sub={new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              accent="#4ade80"
              onClick={() => { setFiltroEstado("Todos"); setScreen("miembros"); }}
              darkMode={darkMode}
            >
              {nuevosEsteMes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {nuevosEsteMes.slice(0, 4).map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                        background: "linear-gradient(135deg,#6c63ff44,#e040fb44)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                      }}>
                        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                      </div>
                      <span style={{ color: "var(--text-primary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.nombre}</span>
                      <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                        {m.fecha_incorporacion ? new Date(m.fecha_incorporacion + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : ""}
                      </span>
                    </div>
                  ))}
                  {nuevosEsteMes.length > 4 && <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>+{nuevosEsteMes.length - 4} más</p>}
                </div>
              ) : (
                <p style={{ color: "var(--text-tertiary)", fontSize: 12 }}>Sin nuevos ingresos este mes</p>
              )}
            </StatCard>

            {/* 🔴 Membresías vencidas */}
            <StatCard
              emoji="🔴"
              title="Membresías vencidas"
              value={membresiasVencidas.length}
              sub="Pendientes de cobro o renovación"
              accent="#f43f5e"
              badge={membresiasVencidas.length}
              badgeColor="#f43f5e"
              onClick={() => { setFiltroEstado("Vencido"); setScreen("miembros"); }}
              darkMode={darkMode}
            >
              {membresiasVencidas.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {membresiasVencidas.slice(0, 4).map(m => {
                    const info = getMembershipInfo(m.id, txs, m);
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                          background: "rgba(244,63,94,.15)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                        }}>
                          {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                        </div>
                        <span style={{ color: "var(--text-primary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.nombre}</span>
                        {info.vence && (
                          <span style={{ color: "#f43f5e", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                            {new Date(info.vence + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {membresiasVencidas.length > 4 && (
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>+{membresiasVencidas.length - 4} más → Ver todos</p>
                  )}
                </div>
              ) : (
                <p style={{ color: "#4ade80", fontSize: 12 }}>✅ No hay membresías vencidas</p>
              )}
            </StatCard>

            {/* 📊 Asistencia de hoy */}
            <StatCard
              emoji="📊"
              title="Asistencia de hoy"
              value={asistenciaHoy === null ? "..." : asistenciaHoy}
              sub="Accesos registrados — Control de Acceso"
              accent="#22c55e"
              onClick={() => setScreen("scanner")}
              darkMode={darkMode}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(34,197,94,.08)", borderRadius: 10, padding: "8px 12px", border: "1px solid rgba(34,197,94,.2)", textAlign: "center" }}>
                  <p style={{ color: "#4ade80", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{asistenciaHoy ?? "—"}</p>
                  <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Entradas hoy</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setScreen("scanner"); }}
                  style={{
                    flex: 1, background: "linear-gradient(135deg,#059669,#22c55e)",
                    border: "none", borderRadius: 10, color: "#fff", fontSize: 12,
                    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    padding: "8px 0",
                  }}
                >
                  Ir al Scanner →
                </button>
              </div>
            </StatCard>

          </div>
        </div>
      </div>
    </div>
  );
}
