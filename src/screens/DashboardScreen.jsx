import { fmt, fmtDate, todayISO, parseDate } from "../utils/dateUtils";
import { calcEdad } from "../utils/dateUtils";

const CAT_ICON = {
  "Membresías": "👥", "Clases extras": "🏋️", "Tienda": "🛍️", "Personal trainer": "💪",
  "Nómina": "👔", "Renta": "🏢", "Servicios": "⚡", "Mantenimiento": "🔧", "Insumos": "📦", "Otro": "📝"
};

function Badge({ val }) {
  const up = parseFloat(val) >= 0;
  return (
    <span style={{ background: up ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)", color: up ? "var(--col-success)" : "var(--col-danger)", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
      {up ? "▲" : "▼"} {Math.abs(val)}%
    </span>
  );
}

export default function DashboardScreen({
  gymConfig, ahora,
  utilidad, totalIng, totalGas,
  crecUtil, crecIng, crecGas,
  mesLabel, mesAnteriorLabel, isCurrentMonth,
  navMes, tab, setTab,
  txsMes, miembros,
  mActivos, mHombres, mMujeres, mSinSexo, miembrosSinSexo,
  cumplesPróximos, membresiasPorVencer,
  totalRecordatorios, recordatoriosEnviados,
  setScreen, setModal, setSelM, setFiltroEstado,
  setConfigScreen, onLogout,
  marcarRecordatorio,
  txs,
  filtroDesde, setFiltroDesde,
  filtroHasta, setFiltroHasta,
  setEditTx,
}) {
  const TABS = ["Dashboard", "Ingresos", "Gastos", "Historial"];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Header sticky ── */}
      <div style={{ flexShrink: 0, padding: "16px 28px 0", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-base)", borderBottom: "1px solid var(--border)", zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {/* Fecha + hora + acciones mobile */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            {/* Fecha y hora */}
            <div>
              {(() => {
                const tz = gymConfig?.zona_horaria || "America/Merida";
                const fechaStr = ahora.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "short", year: "numeric", timeZone: tz });
                const horaStr = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz });
                const fechaFmt = fechaStr.replace(/\b(\w)/g, c => c.toUpperCase());
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: .5, textTransform: "uppercase" }}>{fechaFmt}</p>
                    <span style={{ color: "rgba(167,139,250,.4)", fontSize: 10 }}>·</span>
                    <p style={{ color: "var(--col-accent-text)", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{horaStr}</p>
                  </div>
                );
              })()}
              {/* Nombre del gym — solo en mobile (en desktop lo muestra la sidebar) */}
              <div className="mobile-only" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                {gymConfig?.logo
                  ? <img src={gymConfig.logo} alt="logo" style={{ maxWidth: 36, maxHeight: 28, width: "auto", height: "auto", objectFit: "contain", borderRadius: 6, flexShrink: 0 }} />
                  : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💪</div>
                }
                <h1 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700 }}>{gymConfig?.nombre || "GymFit Pro"}</h1>
              </div>
            </div>

            {/* Botones acción — solo mobile (en desktop están en la sidebar) */}
            <div className="mobile-only" style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <button onClick={() => setScreen("mensajes")} style={{ position: "relative", width: 38, height: 38, borderRadius: 11, border: "none", cursor: "pointer", background: "rgba(255,255,255,.07)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>
                💬
                {totalRecordatorios > 0 && <span className="wa-pulse" style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, background: "var(--col-danger)", borderRadius: "50%", border: "2px solid var(--bg-base)" }} />}
              </button>
              <button onClick={() => setConfigScreen(true)} style={{ width: 38, height: 38, borderRadius: 11, border: "none", cursor: "pointer", background: "rgba(255,255,255,.07)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>⚙️</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 3, background: "var(--bg-card)", borderRadius: 12, padding: 4, border: "1px solid var(--border)" }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 9, cursor: "pointer", background: tab === i ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : "transparent", color: tab === i ? "#fff" : "var(--text-secondary)", fontSize: 12, fontWeight: tab === i ? 700 : 500, fontFamily: "inherit", boxShadow: tab === i ? "0 2px 10px rgba(108,99,255,.35)" : "none", transition: "all .2s" }}>{t}</button>
            ))}
          </div>

        </div>
      </div>

      {/* ── Scroll area ── */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "20px 28px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {/* ════ TAB 0: DASHBOARD ════ */}
          {tab === 0 && (
            <>
              {/* Utilidad neta — ancho completo */}
              <div className="card dash-col-full" style={{ background: "linear-gradient(135deg,#5c54e8 0%,#c336e0 100%)", borderRadius: 22, padding: "22px 26px", marginBottom: 16, boxShadow: "0 8px 32px rgba(108,99,255,.35)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, background: "rgba(255,255,255,.08)", borderRadius: "50%", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -30, right: 30, width: 100, height: 100, background: "rgba(255,255,255,.05)", borderRadius: "50%", pointerEvents: "none" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, position: "relative", zIndex: 1 }}>
                  <button onClick={() => navMes(-1)} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                  <p style={{ color: "rgba(255,255,255,.8)", fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>UTILIDAD NETA · {mesLabel.toUpperCase()}</p>
                  <button onClick={() => navMes(1)} style={{ background: isCurrentMonth ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.18)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: isCurrentMonth ? "default" : "pointer", color: isCurrentMonth ? "rgba(255,255,255,.2)" : "#fff", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                </div>
                <h2 style={{ color: "var(--text-primary)", fontSize: 38, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0 12px", position: "relative", zIndex: 1 }}>{fmt(utilidad)}</h2>
                <div style={{ position: "relative", zIndex: 1 }}>
                  {crecUtil !== null
                    ? <><Badge val={crecUtil} /><span style={{ color: "rgba(255,255,255,.5)", fontSize: 11, marginLeft: 8 }}>vs {mesAnteriorLabel}</span></>
                    : <span style={{ color: "rgba(255,255,255,.4)", fontSize: 11 }}>Sin datos del mes anterior</span>
                  }
                </div>
              </div>

              {/* 2-col grid en desktop */}
              <div className="dash-col-grid">

                {/* Columna izquierda */}
                <div>
                  {/* Ingresos + Gastos */}
                  <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[
                      { label: "Ingresos", val: totalIng, crec: crecIng, c: "var(--col-info)", bg: "rgba(34,211,238,.07)", bc: "rgba(34,211,238,.2)" },
                      { label: "Gastos",   val: totalGas, crec: crecGas, c: "var(--col-danger)", bg: "rgba(244,63,94,.07)",  bc: "var(--col-danger-border)"  },
                    ].map((k, i) => (
                      <div key={i} style={{ background: k.bg, borderRadius: 18, padding: "16px 18px", border: `1px solid ${k.bc}` }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: .6, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</p>
                        <p style={{ color: k.c, fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>{fmt(k.val)}</p>
                        {k.crec !== null ? <Badge val={k.crec} /> : <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>Sin mes anterior</span>}
                      </div>
                    ))}
                  </div>

                  {/* Miembros activos */}
                  {(() => {
                    const mesHoy = new Date().toISOString().slice(0, 7);
                    const nuevosEsteMes = miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesHoy));
                    return (
                      <div className="card" style={{ background: "var(--bg-card)", borderRadius: 18, padding: 18, border: "1px solid var(--border)", marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: nuevosEsteMes.length > 0 ? 12 : 0 }}>
                          <div>
                            <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: .6, textTransform: "uppercase" }}>Miembros activos</p>
                            <p style={{ color: "var(--text-primary)", fontSize: 32, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0" }}>{mActivos}</p>
                            <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>{miembros.filter(m => m.estado === "Vencido").length} vencidos · {miembros.length} total</p>
                          </div>
                          <button onClick={() => setScreen("miembros")} style={{ background: "linear-gradient(135deg,var(--col-accent),var(--col-accent))", border: "none", borderRadius: 12, padding: "10px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver todos →</button>
                        </div>
                        {nuevosEsteMes.length > 0 && (
                          <>
                            <div style={{ height: 1, background: "var(--border)", marginBottom: 10 }} />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                              <p style={{ color: "var(--col-info)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>🆕 Nuevos este mes</p>
                              <button onClick={() => { setFiltroEstado("Nuevo"); setScreen("miembros"); }} style={{ background: "rgba(56,189,248,.15)", border: "none", borderRadius: 8, padding: "2px 10px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ color: "var(--col-info)", fontSize: 11, fontWeight: 700 }}>{nuevosEsteMes.length}</span>
                                {nuevosEsteMes.length > 3 && <span style={{ color: "var(--col-info)", fontSize: 10 }}>Ver todos →</span>}
                              </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {nuevosEsteMes.slice(0, 3).map(m => (
                                <div key={m.id} onClick={() => { setSelM(m); setModal("detalle"); }} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 0" }}>
                                  <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,var(--col-info),var(--col-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                                    {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                                  </div>
                                  <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, flex: 1 }}>{m.nombre}</p>
                                  <p style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{fmtDate(m.fecha_incorporacion)}</p>
                                </div>
                              ))}
                              {nuevosEsteMes.length > 3 && (
                                <button onClick={() => { setFiltroEstado("Nuevo"); setScreen("miembros"); }} style={{ width: "100%", marginTop: 2, padding: "6px", border: "1px dashed rgba(56,189,248,.25)", borderRadius: 10, background: "transparent", cursor: "pointer", fontFamily: "inherit", color: "var(--col-info)", fontSize: 11, fontWeight: 600 }}>
                                  +{nuevosEsteMes.length - 3} más — ver todos
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Composición por sexo */}
                  <div className="card" style={{ background: "var(--bg-card)", borderRadius: 18, padding: "14px 18px", border: "1px solid var(--border)", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>👥 Composición</p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <span style={{ color: "var(--col-accent-text)", fontSize: 12, fontWeight: 700 }}>♂️ {mHombres} <span style={{ color: "var(--text-tertiary)", fontWeight: 400, fontSize: 10 }}>{miembros.length > 0 ? Math.round(mHombres / miembros.length * 100) : 0}%</span></span>
                        <span style={{ color: "#f472b6", fontSize: 12, fontWeight: 700 }}>♀️ {mMujeres} <span style={{ color: "var(--text-tertiary)", fontWeight: 400, fontSize: 10 }}>{miembros.length > 0 ? Math.round(mMujeres / miembros.length * 100) : 0}%</span></span>
                        {mSinSexo > 0 && <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700 }}>— {mSinSexo}</span>}
                      </div>
                    </div>
                    {miembros.length > 0 && (
                      <div style={{ height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden", display: "flex" }}>
                        <div style={{ height: "100%", width: `${Math.round(mHombres / miembros.length * 100)}%`, background: "linear-gradient(90deg,var(--col-accent-text),var(--col-accent))" }} />
                        <div style={{ height: "100%", width: `${Math.round(mMujeres / miembros.length * 100)}%`, background: "linear-gradient(90deg,var(--col-accent),#f472b6)" }} />
                      </div>
                    )}
                    {miembrosSinSexo.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                        {miembrosSinSexo.map(m => (
                          <div key={m.id} onClick={() => { setSelM(m); setModal("detalle"); }} style={{ background: "var(--col-warning-soft)", border: "1px solid var(--col-warning-border)", borderRadius: 12, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--col-warning-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                              {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ color: "var(--col-warning)", fontSize: 12, fontWeight: 600 }}>{m.nombre}</p>
                              <p style={{ color: "#92662a", fontSize: 10 }}>⚠️ Sin sexo registrado · Toca para completar</p>
                            </div>
                            <span style={{ color: "var(--col-warning)", fontSize: 16 }}>›</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Columna derecha */}
                <div>
                  {/* Membresías por vencer */}
                  {membresiasPorVencer.length > 0 && (
                    <div className="card" style={{ background: "rgba(239,68,68,.05)", borderRadius: 18, padding: 18, border: "1px solid rgba(239,68,68,.2)", marginBottom: 14 }}>
                      <p style={{ color: "var(--col-danger)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>⏰ Membresías por vencer</p>
                      {membresiasPorVencer.map(m => {
                        const yaEnviado = !!recordatoriosEnviados[m.id];
                        return (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(239,68,68,.1)", opacity: yaEnviado ? 0.5 : 1, transition: "opacity .3s" }}>
                            <div onClick={() => setScreen("mensajes")} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: m.diasVence === 0 ? "rgba(239,68,68,.25)" : m.diasVence <= 1 ? "rgba(239,68,68,.15)" : "var(--col-warning-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `2px solid ${m.diasVence === 0 ? "rgba(239,68,68,.6)" : m.diasVence <= 1 ? "rgba(239,68,68,.3)" : "var(--col-warning-border)"}` }}>
                                {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                              </div>
                              <div style={{ flex: 1 }}>
                                <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                                <p style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: 1 }}>
                                  {m.plan && <span style={{ color: "var(--text-secondary)" }}>{m.plan} · </span>}
                                  Vence: {fmtDate(m.vence)}
                                </p>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                <span style={{ background: m.diasVence === 0 ? "rgba(239,68,68,.25)" : m.diasVence <= 1 ? "rgba(239,68,68,.15)" : "var(--col-warning-soft)", color: m.diasVence === 0 ? "var(--col-danger)" : m.diasVence <= 1 ? "#fca5a5" : "var(--col-warning)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>
                                  {m.diasVence === 0 ? "HOY 🚨" : m.diasVence === 1 ? "MAÑANA" : `${m.diasVence}d`}
                                </span>
                                <span style={{ color: "var(--col-wa)", fontSize: 10, fontWeight: 600 }}>💬 WhatsApp</span>
                              </div>
                            </div>
                            <button onClick={() => marcarRecordatorio(m.id)} title={yaEnviado ? "Ya enviado hoy" : "Marcar como enviado"} style={{ width: 34, height: 34, border: `1px solid ${yaEnviado ? "var(--col-success-border)" : "var(--border-strong)"}`, borderRadius: 10, background: yaEnviado ? "var(--col-success-soft)" : "transparent", cursor: "pointer", color: yaEnviado ? "var(--col-success)" : "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                              {yaEnviado ? "✓" : "💬"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cumpleaños próximos */}
                  {cumplesPróximos.length > 0 && (
                    <div className="card" style={{ background: "rgba(250,204,21,.06)", borderRadius: 18, padding: 18, border: "1px solid rgba(250,204,21,.18)", marginBottom: 14 }}>
                      <p style={{ color: "var(--col-warning)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>🎂 Cumpleaños esta semana</p>
                      {cumplesPróximos.map(m => (
                        <div key={m.id} className="rh" onClick={() => { setSelM(m); setModal("detalle"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(250,204,21,.08)", cursor: "pointer" }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", background: m.diasCumple === 0 ? "linear-gradient(135deg,var(--col-warning),var(--col-warning))" : "rgba(250,204,21,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: m.diasCumple === 0 ? 20 : 16, overflow: "hidden", flexShrink: 0 }}>
                            {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.diasCumple === 0 ? "🎂" : "🎁")}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                            <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
                              {m.diasCumple === 0 ? "🎉 ¡Hoy!" : m.diasCumple === 1 ? "Mañana" : `En ${m.diasCumple} días`}
                              {calcEdad(m.fecha_nacimiento) !== null && ` · cumple ${calcEdad(m.fecha_nacimiento) + (m.diasCumple === 0 ? 0 : 1)} años`}
                            </p>
                          </div>
                          <span style={{ background: m.diasCumple === 0 ? "rgba(251,191,36,.2)" : "rgba(255,255,255,.06)", color: m.diasCumple === 0 ? "var(--col-warning)" : "var(--text-secondary)", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>
                            {m.diasCumple === 0 ? "HOY 🎂" : `${m.diasCumple}d`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Últimos movimientos */}
                  <div className="card" style={{ background: "var(--bg-card)", borderRadius: 18, padding: 18, border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700 }}>Últimos movimientos</p>
                      <button onClick={() => setTab(3)} style={{ background: "none", border: "none", color: "var(--col-accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                    </div>
                    {txsMes.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin movimientos este mes</p>}
                    {txsMes.slice(0, 5).map(t => (
                      {(() => {
                        const miembro = (t.miembroId || t.miembro_id) ? miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id)) : null;
                        const mFoto = miembro?.foto || null;
                        const mNombre = miembro?.nombre || null;
                        // Extract clean label: if membresía, show "Plan · Miembro"; else show desc
                        const desc = t.desc || t.descripcion || "";
                        const planMatch = desc.match(/Renovaci[oó]n (.+?) - /);
                        const fpagoMatch = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
                        const planLabel = planMatch ? planMatch[1] : (t.categoria || "");
                        const fpago = fpagoMatch ? fpagoMatch[1] : null;
                        const label1 = mNombre || planLabel;
                        const label2 = mNombre ? planLabel : t.categoria;
                        return (
                          <div key={t.id} className="rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 14, background: t.tipo === "ingreso" ? "var(--col-info-soft)" : "var(--col-danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto ? "2px solid rgba(34,211,238,.3)" : "none" }}>
                                {mFoto ? <img src={mFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mNombre ? <span style={{ color: t.tipo === "ingreso" ? "var(--col-info)" : "var(--col-danger)", fontWeight: 700, fontSize: 12 }}>{mNombre.charAt(0)}</span> : (CAT_ICON[t.categoria] || "📝")}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{label1}</p>
                                <p style={{ color: "var(--text-tertiary)", fontSize: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{label2}{fpago ? ` · ${fpago}` : ""} · {fmtDate(t.fecha)}</p>
                              </div>
                            </div>
                            <p style={{ color: t.tipo === "ingreso" ? "var(--col-info)" : "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}</p>
                          </div>
                        );
                      })()}
                    ))}
                  </div>

                </div>
              </div>{/* fin dash-col-grid */}
            </>
          )}

          {/* ════ TAB 1: INGRESOS ════ */}
          {tab === 1 && <>
            <div className="card" style={{ background: "rgba(34,211,238,.08)", borderRadius: 18, padding: 18, border: "1px solid rgba(34,211,238,.2)", marginBottom: 14 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>Total ingresos · {mesLabel}</p>
              <p style={{ color: "var(--col-info)", fontSize: 30, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0 8px" }}>{fmt(totalIng)}</p>
              <Badge val={crecIng} />
            </div>
            <button onClick={() => setModal("ingreso")} style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,var(--col-info),var(--col-info))", color: "#fff", marginBottom: 14 }}>+ Agregar ingreso</button>
            {txsMes.filter(t => t.tipo === "ingreso").map(t => (
              <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", borderRadius: 16, padding: "14px 16px", marginBottom: 10, border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {(() => {
                    const mFoto2 = (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                    return (
                      <div style={{ width: 42, height: 42, borderRadius: "50%", fontSize: 18, background: "var(--col-info-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto2 ? "2px solid rgba(34,211,238,.35)" : "none" }}>
                        {mFoto2 ? <img src={mFoto2} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                      </div>
                    );
                  })()}
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, maxWidth: 300, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 3 }}>{t.categoria} · 📅 {fmtDate(t.fecha)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <p style={{ color: "var(--col-info)", fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>+{fmt(t.monto)}</p>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>✏️</span>
                </div>
              </div>
            ))}
          </>}

          {/* ════ TAB 2: GASTOS ════ */}
          {tab === 2 && <>
            <div className="card" style={{ background: "var(--col-danger-soft)", borderRadius: 18, padding: 18, border: "1px solid var(--col-danger-border)", marginBottom: 14 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 12 }}>Total gastos · {mesLabel}</p>
              <p style={{ color: "var(--col-danger)", fontSize: 30, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0 8px" }}>{fmt(totalGas)}</p>
              <Badge val={crecGas} />
            </div>
            <button onClick={() => setModal("gasto")} style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,var(--col-danger),var(--col-danger))", color: "#fff", marginBottom: 14 }}>+ Agregar gasto</button>
            {txsMes.filter(t => t.tipo === "gasto").map(t => (
              <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", borderRadius: 16, padding: "14px 16px", marginBottom: 10, border: "1px solid var(--border)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 14, fontSize: 18, background: "var(--col-danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{CAT_ICON[t.categoria] || "📝"}</div>
                  <div>
                    <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, maxWidth: 300, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                    <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 3 }}>{t.categoria} · 📅 {fmtDate(t.fecha)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <p style={{ color: "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>-{fmt(t.monto)}</p>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>✏️</span>
                </div>
              </div>
            ))}
          </>}

          {/* ════ TAB 3: HISTORIAL ════ */}
          {tab === 3 && <>
            <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: "12px 14px", marginBottom: 14, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Filtrar por fecha</p>
                <div style={{ display: "flex", gap: 6 }}>
                  {[
                    { label: "Hoy",       get: () => { const t = todayISO(); return [t, t]; } },
                    { label: "Ayer",      get: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = d.toISOString().split("T")[0]; return [s, s]; } },
                    { label: "Mes actual",get: () => { const n = new Date(); const y = n.getFullYear(); const m = String(n.getMonth()+1).padStart(2,"0"); return [`${y}-${m}-01`, todayISO()]; } },
                  ].map(({ label, get }) => {
                    const [d, h] = get();
                    const active = filtroDesde === d && filtroHasta === h;
                    return (
                      <button key={label} onClick={() => { const [fd,fh] = get(); setFiltroDesde(fd); setFiltroHasta(fh); }} style={{ padding: "4px 10px", border: `1px solid ${active ? "rgba(167,139,250,.5)" : "rgba(167,139,250,.2)"}`, borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: active ? "rgba(167,139,250,.2)" : "transparent", color: active ? "var(--col-accent-text)" : "var(--text-secondary)", transition: "all .2s" }}>{label}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Desde</p>
                  <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Hasta</p>
                  <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                </div>
              </div>
            </div>
            {(() => {
              const desde = filtroDesde ? new Date(filtroDesde) : null;
              const hasta  = filtroHasta ? new Date(filtroHasta + "T23:59:59") : null;
              const filtered = txs.filter(t => {
                const td = parseDate(t.fecha);
                if (!td) return true;
                if (desde && td < desde) return false;
                if (hasta && td > hasta)  return false;
                return true;
              });
              const totalIngresos = filtered.filter(t => t.tipo === "ingreso").reduce((s,t) => s+Number(t.monto), 0);
              const totalGastos   = filtered.filter(t => t.tipo === "gasto").reduce((s,t) => s+Number(t.monto), 0);
              const utilidadPer   = totalIngresos - totalGastos;
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      { label: "Ingresos", value: totalIngresos, color: "var(--col-info)", bg: "rgba(34,211,238,.08)", border: "rgba(34,211,238,.15)" },
                      { label: "Gastos",   value: totalGastos,   color: "var(--col-danger)", bg: "var(--col-danger-soft)",  border: "var(--col-danger-soft)"  },
                      { label: "Utilidad", value: utilidadPer,   color: utilidadPer >= 0 ? "var(--col-success)" : "var(--col-danger)", bg: utilidadPer >= 0 ? "rgba(74,222,128,.08)" : "var(--col-danger-soft)", border: utilidadPer >= 0 ? "var(--col-success-soft)" : "var(--col-danger-soft)" },
                    ].map(card => (
                      <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{card.label}</p>
                        <p style={{ color: card.color, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{card.label === "Utilidad" && utilidadPer >= 0 ? "+" : ""}{fmt(card.value)}</p>
                      </div>
                    ))}
                  </div>
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "36px 0" }}>
                      <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Sin movimientos en este período</p>
                    </div>
                  ) : filtered.map(t => (
                    <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 16, marginBottom: 10, background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {(() => {
                          const mFoto3 = t.tipo === "ingreso" && (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                          return (
                            <div style={{ width: 38, height: 38, borderRadius: "50%", fontSize: 15, background: t.tipo === "ingreso" ? "var(--col-info-soft)" : "var(--col-danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto3 ? "2px solid rgba(34,211,238,.3)" : "none" }}>
                              {mFoto3 ? <img src={mFoto3} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                            </div>
                          );
                        })()}
                        <div>
                          <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, maxWidth: 280, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                          <p style={{ color: "var(--text-tertiary)", fontSize: 10, marginTop: 2 }}>{t.categoria} · {fmtDate(t.fecha)}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <p style={{ color: t.tipo === "ingreso" ? "var(--col-info)" : "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}</p>
                        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>✏️</span>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </>}

        </div>
      </div>
    </div>
  );
}
