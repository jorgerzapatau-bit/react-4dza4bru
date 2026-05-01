// src/screens/MiembrosScreen.jsx
// ══════════════════════════════════════════════
// CAMBIOS:
//   ✅ Usa gymConfig.termino_miembros ("Alumnos", "Miembros", etc.)
//   ✅ Muestra badge 🎓 Beca en la lista
//   ✅ Nuevo botón usa el término configurable
//   ✅ Modo DOJO: badge de cinturón en tarjeta de alumno
// ══════════════════════════════════════════════
import { fmt, fmtDate, diasParaVencer, todayISO } from "../utils/dateUtils";
import { getMembershipInfo } from "../utils/membershipUtils";
import { DEFAULT_PLANES, getIsDojo, getGradoInfo } from "../utils/constants";

export default function MiembrosScreen({
  miembros,
  txs,
  filtroEstado,
  setFiltroEstado,
  busqueda,
  setBusqueda,
  viewMode,
  setViewMode,
  setSelM,
  setModal,
  setScreen,
  activePlanes,
  setFM,
  gymConfig,
}) {
  const isDojo = getIsDojo(gymConfig);
  // Término configurable: "Miembros", "Alumnos", "Clientes", etc.
  const termino = gymConfig?.termino_miembros || (isDojo ? "Alumnos" : "Miembros");
  const terminoSingular = termino.replace(/s$/, ""); // "Alumnos" → "Alumno"

  return (
    <>
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <button
              className="mobile-only"
              onClick={() => setScreen("dashboard")}
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--text-primary)", fontSize: 18 }}
            >←</button>
            <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>{termino}</h1>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => setScreen("mensajes")}
                style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, padding: "8px 12px", color: "#25d366", fontSize: 18, cursor: "pointer" }}
              >📢</button>
              <button
                onClick={() => {
                  setFM({
                    nombre: "", tel: "", plan: null,
                    monto: "", foto: null,
                  });
                  setModal("miembro");
                }}
                style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >+ {terminoSingular}</button>
            </div>
          </div>

          {/* Filtros de estado */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(() => {
              const hoyD = new Date();
              const mesActual = `${hoyD.getFullYear()}-${String(hoyD.getMonth() + 1).padStart(2, "0")}`;
              const nuevosCount = miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesActual)).length;
              const becasCount = miembros.filter(m => m.beca).length;
              const pendienteCount = miembros.filter(m => m.estado === "Pendiente").length;
              return [
                { label: "Activos", val: "Activo", count: miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo" && m.estado !== "Pendiente").length, c: "#4ade80", bg: "rgba(74,222,128," },
                { label: "Vencidos", val: "Vencido", count: miembros.filter(m => { const s = getMembershipInfo(m.id, txs, m).estado; return (s === "Vencido" || s === "Sin membresía") && m.estado !== "Pendiente"; }).length, c: "#f87171", bg: "rgba(248,113,113," },
                { label: "Nuevos", val: "Nuevo", count: nuevosCount, c: "#38bdf8", bg: "rgba(56,189,248," },
                ...(pendienteCount > 0 ? [{ label: "Pendientes", val: "Pendiente", count: pendienteCount, c: "#fbbf24", bg: "rgba(251,191,36," }] : []),
                ...(becasCount > 0 ? [{ label: "Becas", val: "Beca", count: becasCount, c: "#a78bfa", bg: "rgba(167,139,250," }] : []),
                { label: "Todos", val: "Todos", count: miembros.length, c: "#a78bfa", bg: "rgba(167,139,250," },
              ];
            })().map((s, i) => {
              const active = filtroEstado === s.val;
              return (
                <button key={i} onClick={() => setFiltroEstado(s.val)} style={{ flex: 1, background: active ? `${s.bg}.18)` : "var(--bg-elevated)", border: active ? `1.5px solid ${s.bg}.35)` : "1.5px solid var(--border)", borderRadius: 14, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                  <p style={{ color: active ? s.c : "var(--text-tertiary)", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{s.count}</p>
                  <p style={{ color: active ? s.c : "var(--text-tertiary)", fontSize: 11, fontWeight: active ? 700 : 500, marginTop: 2 }}>{s.label}</p>
                </button>
              );
            })}
          </div>

          {/* Búsqueda + toggle vista */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-tertiary)", pointerEvents: "none" }}>🔍</span>
              <input
                type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder={`Buscar ${termino.toLowerCase()}...`}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "11px 12px 11px 36px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 15 }}>✕</button>}
            </div>
            <button
              onClick={() => setViewMode(v => v === "lista" ? "grid" : "lista")}
              style={{ width: 44, height: 44, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elevated)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--text-primary)" }}
              title={viewMode === "lista" ? "Ver cuadrícula" : "Ver lista"}
            >
              {viewMode === "lista" ? "⊞" : "☰"}
            </button>
          </div>
        </div>
      </div>

      <div className="gym-scroll-pad" style={{ flex: 1, padding: "12px 24px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {(() => {
            const q = busqueda.toLowerCase();
            const hoyD2 = new Date();
            const mesActual2 = `${hoyD2.getFullYear()}-${String(hoyD2.getMonth() + 1).padStart(2, "0")}`;
            const lista = miembros.filter(m => {
              const est = getMembershipInfo(m.id, txs, m).estado;
              const isPendiente = m.estado === "Pendiente";
              const matchEstado =
                filtroEstado === "Todos" ||
                (filtroEstado === "Activo" && est === "Activo" && !isPendiente) ||
                (filtroEstado === "Vencido" && (est === "Vencido" || est === "Sin membresía") && !isPendiente) ||
                (filtroEstado === "Nuevo" && (m.fecha_incorporacion || "").startsWith(mesActual2)) ||
                (filtroEstado === "Pendiente" && isPendiente) ||
                (filtroEstado === "Beca" && m.beca);
              return matchEstado;
            }).filter(m => !q || m.nombre.toLowerCase().includes(q) || (m.tel || "").includes(q));

            if (lista.length === 0) return (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🔎</p>
                <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Sin {termino.toLowerCase()} con esos filtros</p>
              </div>
            );

            if (viewMode === "grid") {
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {lista.map(m => {
                    const mi = getMembershipInfo(m.id, txs, m);
                    const estadoColor = mi.estado === "Activo" ? "#4ade80" : mi.estado === "Sin membresía" ? "#6b7280" : "#f87171";
                    const estadoBg = mi.estado === "Activo" ? "rgba(74,222,128,.15)" : mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)";
                    return (
                      <div key={m.id} className="card rh" onClick={() => { setSelM(m); setModal("detalle"); }} style={{ background: "var(--bg-card)", borderRadius: 18, padding: "14px 12px", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", position: "relative" }}>
                        {m.beca && (
                          <span style={{ position: "absolute", top: 8, right: 8, fontSize: 14 }} title="Beca activa">🎓</span>
                        )}
                        <div style={{ width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 22, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 2px ${estadoColor}50` }}>
                          {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                        </div>
                        <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.nombre}</p>
                        <span style={{ background: estadoBg, color: estadoColor, borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{mi.estado}</span>
                        {mi.vence && <p style={{ color: "var(--text-tertiary)", fontSize: 10 }}>Vence {fmtDate(mi.vence)}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            }

            return lista.map(m => {
              const mi = getMembershipInfo(m.id, txs, m);
              const dias = diasParaVencer(mi.vence);
              const showWA = mi.estado === "Activo" && dias !== null && dias <= 5 && dias >= 0;
              return (
                <div key={m.id} className="card rh" onClick={() => { setSelM(m); setModal("detalle"); }} style={{ background: "var(--bg-card)", borderRadius: 18, padding: "14px 16px", marginBottom: 10, border: m.estado === "Pendiente" ? "1px solid rgba(251,191,36,.35)" : showWA ? "1px solid rgba(37,211,102,.25)" : "1px solid var(--border)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 18, overflow: "hidden", flexShrink: 0, boxShadow: m.estado === "Pendiente" ? "0 0 0 2px rgba(251,191,36,.5)" : "0 0 0 2px rgba(108,99,255,.3)" }}>
                        {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}>{m.nombre}</p>
                          {m.beca && <span style={{ fontSize: 13 }} title="Beca activa">🎓</span>}
                          {isDojo && m.grado_actual && (() => {
                            const g = getGradoInfo(m.grado_actual);
                            return (
                              <span title={m.grado_actual} style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 6, background: g.kyu < 0 ? "rgba(168,85,247,.2)" : `${g.color}22`, color: g.kyu < 0 ? "#c084fc" : g.color === "#ffffff" ? "#d1d5db" : g.color, border: `1px solid ${g.kyu < 0 ? "rgba(168,85,247,.4)" : g.color === "#ffffff" ? "rgba(255,255,255,.3)" : `${g.color}55`}` }}>
                                {g.emoji} {m.grado_actual.split(" ")[0]}
                              </span>
                            );
                          })()}
                        </div>
                        <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
                          {mi.plan ? `Plan ${mi.plan}` : "Sin plan"} · 📱 {m.tel || "—"}
                          {m.tutor_nombre && <span style={{ color: "#fbbf24" }}> · 👨‍👧 Menor</span>}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {m.estado === "Pendiente" ? (
                        <span style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>⏳ Pendiente</span>
                      ) : (
                        <span style={{ background: mi.estado === "Activo" ? "rgba(74,222,128,.15)" : mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)", color: mi.estado === "Activo" ? "#4ade80" : mi.estado === "Sin membresía" ? "#6b7280" : "#f87171", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{mi.estado}</span>
                      )}
                      {m.estado === "Pendiente"
                        ? <p style={{ color: "#fbbf24", fontSize: 11, fontWeight: 600, marginTop: 6 }}>Pago por confirmar</p>
                        : mi.estado === "Activo"
                        ? <p style={{ color: m.beca ? "#fbbf24" : "#22d3ee", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{m.beca ? "🎓 Beca" : fmt(mi.monto)}</p>
                        : <p style={{ color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600, marginTop: 6 }}>—</p>
                      }
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", alignItems: "center" }}>
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
                      {m.estado === "Pendiente" ? "⏳ En espera de confirmación de transferencia" : `Vence: ${fmtDate(mi.vence) || "Por definir"}`}
                    </p>
                    {showWA && m.estado !== "Pendiente" && <span style={{ background: "rgba(37,211,102,.15)", color: "#25d366", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>💬 {dias === 0 ? "hoy" : dias === 1 ? "mañana" : `${dias}d`}</span>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </>
  );
}
