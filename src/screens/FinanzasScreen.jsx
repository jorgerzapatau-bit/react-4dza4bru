import { useState, useMemo } from "react";
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

export default function FinanzasScreen({
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
  const TABS = ["Resumen", "Ingresos", "Gastos", "Historial", "📅 Calendario"];

  // ── Calendario: estado ──
  const hoyISO = todayISO();
  const [calMes, setCalMes] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [calDiaSelec, setCalDiaSelec] = useState(null);
  const [calDesde, setCalDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [calHasta, setCalHasta] = useState(() => todayISO());

  // Datos agrupados por día
  const datosPorDia = useMemo(() => {
    const map = {};
    (txs || []).forEach(t => {
      const iso = (() => {
        const f = t.fecha;
        if (!f) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
        const d = parseDate(f);
        if (!d) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      if (!iso) return;
      if (!map[iso]) map[iso] = { ingresos: [], gastos: [], totalIng: 0, totalGas: 0 };
      if (t.tipo === "ingreso") { map[iso].ingresos.push(t); map[iso].totalIng += Number(t.monto || 0); }
      else { map[iso].gastos.push(t); map[iso].totalGas += Number(t.monto || 0); }
    });
    return map;
  }, [txs]);

  // Sumar en rango seleccionado
  const calRangeData = useMemo(() => {
    const desde = calDesde ? new Date(calDesde + "T00:00:00") : null;
    const hasta  = calHasta ? new Date(calHasta  + "T23:59:59") : null;
    let totalIng = 0, totalGas = 0, ef = 0, tr = 0, ta = 0;
    Object.entries(datosPorDia).forEach(([iso, d]) => {
      const date = new Date(iso + "T00:00:00");
      if (desde && date < desde) return;
      if (hasta && date > hasta) return;
      totalIng += d.totalIng; totalGas += d.totalGas;
      d.ingresos.forEach(t => {
        const desc = t.desc || t.descripcion || "";
        const m = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
        const fp = m ? m[1] : null;
        if (fp === "Efectivo") ef += Number(t.monto || 0);
        else if (fp === "Transferencia") tr += Number(t.monto || 0);
        else if (fp === "Tarjeta") ta += Number(t.monto || 0);
      });
    });
    return { totalIng, totalGas, utilidad: totalIng - totalGas, efectivo: ef, transferencia: tr, tarjeta: ta };
  }, [datosPorDia, calDesde, calHasta]);

  // Datos del día seleccionado
  const diaData = useMemo(() => {
    if (!calDiaSelec) return null;
    const d = datosPorDia[calDiaSelec];
    if (!d) return { ingresos: [], gastos: [], totalIng: 0, totalGas: 0, efectivo: 0, transferencia: 0, tarjeta: 0 };
    let ef = 0, tr = 0, ta = 0;
    d.ingresos.forEach(t => {
      const desc = t.desc || t.descripcion || "";
      const m = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
      const fp = m ? m[1] : null;
      if (fp === "Efectivo") ef += Number(t.monto || 0);
      else if (fp === "Transferencia") tr += Number(t.monto || 0);
      else if (fp === "Tarjeta") ta += Number(t.monto || 0);
    });
    return { ...d, efectivo: ef, transferencia: tr, tarjeta: ta };
  }, [calDiaSelec, datosPorDia]);

  const limpiarDesc = (desc) => (desc || "")
    .replace(/\s*\[(?:Efectivo|Transferencia|Tarjeta)\]/g, "")
    .replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "")
    .trim();

  const extraerFP = (t) => {
    const desc = t.desc || t.descripcion || "";
    const m = desc.match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
    return m ? m[1] : null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Header sticky ── */}
      <div style={{ flexShrink: 0, padding: "16px 28px 0",  position: "sticky", top: 0, background: "var(--bg-base)", borderBottom: "1px solid var(--border)", zIndex: 50 }}>
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
                    const nuevosEsteMes = miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesHoy)).sort((a, b) => (b.fecha_incorporacion || "").localeCompare(a.fecha_incorporacion || ""));
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
                    {[...txsMes].sort((a, b) => { const da = parseDate(a.fecha); const db2 = parseDate(b.fecha); if (da && db2) return db2 - da; return (b.fecha || "").localeCompare(a.fecha || ""); }).slice(0, 5).map(t => (
                      <div key={t.id} className="rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {(() => {
                            const mFoto = t.tipo === "ingreso" && (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                            return (
                              <div style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 14, background: t.tipo === "ingreso" ? "var(--col-info-soft)" : "var(--col-danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto ? "2px solid rgba(34,211,238,.3)" : "none" }}>
                                {mFoto ? <img src={mFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                              </div>
                            );
                          })()}
                          <div>
                            <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 500, maxWidth: 200, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                            <p style={{ color: "var(--text-tertiary)", fontSize: 10 }}>{fmtDate(t.fecha)}</p>
                          </div>
                        </div>
                        <p style={{ color: t.tipo === "ingreso" ? "var(--col-info)" : "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}</p>
                      </div>
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

          {/* ════ TAB 4: CALENDARIO ════ */}
          {tab === 4 && (() => {
            const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
            const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
            const { y, m } = calMes;
            const primerDia = new Date(y, m, 1);
            const ultimoDia = new Date(y, m + 1, 0);
            // Lunes=0 … Domingo=6
            let startDow = primerDia.getDay() - 1;
            if (startDow < 0) startDow = 6;
            const totalCeldas = startDow + ultimoDia.getDate();
            const filas = Math.ceil(totalCeldas / 7);
            const celdas = Array.from({ length: filas * 7 }, (_, i) => {
              const dayNum = i - startDow + 1;
              if (dayNum < 1 || dayNum > ultimoDia.getDate()) return null;
              const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              return { dayNum, iso };
            });

            const fmtMoney = n => "$" + Number(n).toLocaleString("es-MX");

            return (
              <div>
                {/* Filtros de fecha + totales del rango */}
                <div style={{ background: "linear-gradient(135deg,var(--col-accent-soft),rgba(224,64,251,.1))", border: "1px solid var(--col-accent-border)", borderRadius: 20, padding: "16px 18px", marginBottom: 16 }}>
                  <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📆 Rango de fechas</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Desde</p>
                      <input type="date" value={calDesde} onChange={e => setCalDesde(e.target.value)}
                        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "9px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <p style={{ color: "var(--text-secondary)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Hasta</p>
                      <input type="date" value={calHasta} onChange={e => setCalHasta(e.target.value)}
                        style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 10, padding: "9px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  {/* Totales del rango */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[
                      { label: "Ingresos", val: calRangeData.totalIng, color: "var(--col-success)", bg: "rgba(74,222,128,.1)", border: "var(--col-success-border)" },
                      { label: "Gastos",   val: calRangeData.totalGas, color: "var(--col-danger)", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.2)" },
                      { label: "Utilidad", val: calRangeData.utilidad, color: calRangeData.utilidad >= 0 ? "var(--col-success)" : "var(--col-danger)", bg: calRangeData.utilidad >= 0 ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: calRangeData.utilidad >= 0 ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)" },
                    ].map(c => (
                      <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                        <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{c.label}</p>
                        <p style={{ color: c.color, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{c.label === "Utilidad" && c.val > 0 ? "+" : ""}{fmtMoney(Math.abs(c.val))}</p>
                      </div>
                    ))}
                  </div>
                  {/* Formas de pago en rango */}
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { label: "Efectivo", val: calRangeData.efectivo, icon: "💵", color: "var(--col-success)" },
                      { label: "Transfer.", val: calRangeData.transferencia, icon: "📲", color: "var(--col-info)" },
                      { label: "Tarjeta", val: calRangeData.tarjeta, icon: "💳", color: "var(--col-accent-text)" },
                    ].map(fp => (
                      <div key={fp.label} style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                        <p style={{ fontSize: 14, marginBottom: 2 }}>{fp.icon}</p>
                        <p style={{ color: fp.color, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmtMoney(fp.val)}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 9, marginTop: 1 }}>{fp.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calendario */}
                <div style={{ background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border)", padding: "14px", marginBottom: 16 }}>
                  {/* Navegación mes */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <button onClick={() => setCalMes(prev => {
                      const d = new Date(prev.y, prev.m - 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })} style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", color: "var(--text-primary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                    <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{MESES_ES[m]} {y}</p>
                    <button onClick={() => setCalMes(prev => {
                      const d = new Date(prev.y, prev.m + 1, 1);
                      return { y: d.getFullYear(), m: d.getMonth() };
                    })} style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", color: "var(--text-primary)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
                  </div>
                  {/* Días semana */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
                    {DIAS_SEMANA.map(d => (
                      <div key={d} style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 10, fontWeight: 700, padding: "4px 0" }}>{d}</div>
                    ))}
                  </div>
                  {/* Celdas */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                    {celdas.map((celda, idx) => {
                      if (!celda) return <div key={idx} />;
                      const { dayNum, iso } = celda;
                      const data = datosPorDia[iso];
                      const esHoy = iso === hoyISO;
                      const esSelec = iso === calDiaSelec;
                      const tieneIng = data && data.totalIng > 0;
                      const tieneGas = data && data.totalGas > 0;
                      const enRango = calDesde && calHasta && iso >= calDesde && iso <= calHasta;
                      return (
                        <div key={idx} onClick={() => setCalDiaSelec(prev => prev === iso ? null : iso)}
                          style={{ borderRadius: 10, padding: "6px 4px 5px", textAlign: "center", cursor: data ? "pointer" : "default", position: "relative", transition: "all .15s",
                            background: esSelec ? "linear-gradient(135deg,var(--col-accent),var(--col-accent))" : esHoy ? "var(--col-accent-border)" : enRango && data ? "var(--col-accent-soft)" : "transparent",
                            border: esSelec ? "1px solid rgba(108,99,255,.8)" : esHoy ? "1px solid rgba(108,99,255,.4)" : "1px solid transparent",
                            boxShadow: esSelec ? "0 2px 12px rgba(108,99,255,.4)" : "none",
                            opacity: data || esHoy ? 1 : 0.4 }}>
                          <p style={{ color: esSelec ? "#fff" : esHoy ? "var(--col-accent-text)" : "var(--text-primary)", fontSize: 12, fontWeight: esHoy || esSelec ? 700 : 400, marginBottom: 3 }}>{dayNum}</p>
                          {tieneIng && <div style={{ height: 3, borderRadius: 2, background: esSelec ? "rgba(255,255,255,.7)" : "var(--col-success)", marginBottom: 1 }} />}
                          {tieneGas && <div style={{ height: 3, borderRadius: 2, background: esSelec ? "rgba(255,255,255,.5)" : "var(--col-danger)" }} />}
                          {data && !tieneIng && !tieneGas && <div style={{ height: 3 }} />}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 10 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: "var(--col-success)", display: "inline-block" }} /> Ingresos</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 10 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: "var(--col-danger)", display: "inline-block" }} /> Gastos</span>
                  </div>
                </div>

                {/* Detalle del día seleccionado */}
                {calDiaSelec && diaData && (() => {
                  const util = diaData.totalIng - diaData.totalGas;
                  // Desglose categorías ingreso
                  const mapaCat = {};
                  diaData.ingresos.forEach(t => { const c = t.categoria || "Otro"; mapaCat[c] = (mapaCat[c] || 0) + Number(t.monto); });
                  const catArr = Object.entries(mapaCat).sort((a,b) => b[1]-a[1]);
                  // Desglose categorías gasto
                  const mapaGas = {};
                  diaData.gastos.forEach(t => { const c = t.categoria || "Otro"; mapaGas[c] = (mapaGas[c] || 0) + Number(t.monto); });
                  const gasArr = Object.entries(mapaGas).sort((a,b) => b[1]-a[1]);
                  // Formas de pago
                  const pagoArr = [
                    ["Efectivo", diaData.efectivo],
                    ["Transferencia", diaData.transferencia],
                    ["Tarjeta", diaData.tarjeta],
                  ].filter(([,v]) => v > 0);

                  // Texto para compartir
                  const gymNombre = gymConfig?.nombre || "GymFit Pro";
                  const fechaLabel = fmtDate(calDiaSelec);
                  const textoCorte = `🏋️ ${gymNombre} — CORTE DE CAJA\n📅 ${fechaLabel}\n\n💰 INGRESOS: ${fmtMoney(diaData.totalIng)}\n${catArr.map(([c,v]) => `  · ${CAT_ICON[c]||"📌"} ${c}: ${fmtMoney(v)}`).join("\n")}${pagoArr.length > 0 ? "\n\n💳 Por forma de pago:\n" + pagoArr.map(([fp,v]) => `  · ${fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : "💳"} ${fp}: ${fmtMoney(v)}`).join("\n") : ""}\n\n💸 GASTOS: ${fmtMoney(diaData.totalGas)}${gasArr.length > 0 ? "\n" + gasArr.map(([c,v]) => `  · ${CAT_ICON[c]||"📌"} ${c}: ${fmtMoney(v)}`).join("\n") : ""}\n\n📊 UTILIDAD NETA: ${util >= 0 ? "+" : ""}${fmtMoney(Math.abs(util))}\n📋 Movimientos: ${diaData.ingresos.length + diaData.gastos.length}`;

                  const descargarPDFDia = async () => {
                    const cargarScript = (src) => new Promise((res,rej) => {
                      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
                      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
                    });
                    try {
                      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
                      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
                      const { jsPDF } = window.jspdf;
                      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                      const W = 210; const margin = 14;
                      const fmt$ = n => "$" + Number(n).toLocaleString("es-MX");
                      const now = new Date();
                      const horaCorte = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
                      const fechaCorte = now.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
                      // Header
                      doc.setFillColor(108,99,255); doc.rect(0,0,W,26,"F");
                      doc.setTextColor(255,255,255); doc.setFontSize(17); doc.setFont("helvetica","bold");
                      doc.text(gymNombre, margin, 12);
                      doc.setFontSize(9); doc.setFont("helvetica","normal");
                      doc.text("Corte de Caja — " + fechaLabel, margin, 20);
                      doc.setFontSize(14); doc.setFont("helvetica","bold");
                      doc.text(horaCorte, W-margin, 13, { align: "right" });
                      doc.setFontSize(8); doc.setFont("helvetica","normal");
                      doc.text(fechaCorte, W-margin, 21, { align: "right" });
                      let y = 34;
                      // Tarjetas resumen
                      const cards = [
                        { label:"INGRESOS", value: fmt$(diaData.totalIng), r:22,g:163,b:74 },
                        { label:"GASTOS",   value: fmt$(diaData.totalGas), r:220,g:38,b:38 },
                        { label:"UTILIDAD NETA", value: (util>=0?"+":"")+fmt$(util), r:util>=0?22:220, g:util>=0?163:38, b:util>=0?74:38 },
                      ];
                      const cW = (W-margin*2-8)/3;
                      cards.forEach((c,i) => {
                        const x = margin + i*(cW+4);
                        doc.setFillColor(250,250,255); doc.setDrawColor(230,230,240); doc.setLineWidth(0.4);
                        doc.roundedRect(x,y,cW,22,3,3,"FD");
                        doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(120,120,140);
                        doc.text(c.label, x+cW/2, y+7, { align:"center" });
                        doc.setFontSize(14); doc.setFont("helvetica","bold"); doc.setTextColor(c.r,c.g,c.b);
                        doc.text(c.value, x+cW/2, y+17, { align:"center" });
                      });
                      y += 29;
                      // Forma de pago
                      if (pagoArr.length > 0) {
                        doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(80,60,180);
                        doc.text("RESUMEN POR FORMA DE PAGO", margin, y); y += 5;
                        doc.autoTable({ startY:y, head:[["Forma de pago","Total"]], body: pagoArr.map(([fp,v]) => [fp, fmt$(v)]),
                          theme:"grid", headStyles:{ fillColor:[108,99,255], fontSize:9, fontStyle:"bold", textColor:[255,255,255] },
                          bodyStyles:{ fontSize:11, fontStyle:"bold" }, columnStyles:{ 1:{ halign:"right", textColor:[80,60,180], fontStyle:"bold" }},
                          margin:{left:margin,right:margin}, styles:{ cellPadding:4 } });
                        y = doc.lastAutoTable.finalY + 8;
                      }
                      // Ingresos detalle
                      if (diaData.ingresos.length > 0) {
                        doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(22,163,74);
                        doc.text("INGRESOS — DETALLE", margin, y); y += 5;
                        doc.autoTable({ startY:y, head:[["Concepto / Miembro","Forma de pago","Monto"]],
                          body: diaData.ingresos.map(t => {
                            const mid = t.miembroId || t.miembro_id;
                            const mb = mid ? miembros.find(mb => String(mb.id) === String(mid)) : null;
                            return [`${t.categoria||"Ingreso"}
${mb?.nombre || limpiarDesc(t.desc||t.descripcion||"")||"—"}`, extraerFP(t)||"—", fmt$(t.monto)];
                          }),
                          theme:"striped", headStyles:{ fillColor:[22,163,74], fontSize:8, fontStyle:"bold", textColor:[255,255,255] },
                          bodyStyles:{ fontSize:8 }, columnStyles:{ 1:{cellWidth:26,halign:"center"}, 2:{cellWidth:28,halign:"right",fontStyle:"bold",textColor:[22,163,74]} },
                          foot:[[{ content:"SUBTOTAL", colSpan:2, styles:{halign:"right",fontStyle:"bold",fontSize:9,fillColor:[240,253,244],textColor:[22,163,74]} },{ content:fmt$(diaData.totalIng), styles:{halign:"right",fontStyle:"bold",fontSize:9,fillColor:[240,253,244],textColor:[22,163,74]} }]],
                          footStyles:{fillColor:[240,253,244]}, margin:{left:margin,right:margin}, styles:{cellPadding:3} });
                        y = doc.lastAutoTable.finalY + 8;
                      }
                      // Gastos detalle
                      if (diaData.gastos.length > 0) {
                        doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.setTextColor(220,38,38);
                        doc.text("GASTOS — DETALLE", margin, y); y += 5;
                        doc.autoTable({ startY:y, head:[["Descripción","Categoría","Monto"]],
                          body: diaData.gastos.map(t => [limpiarDesc(t.desc||t.descripcion||"")||"—", t.categoria||"—", fmt$(t.monto)]),
                          theme:"striped", headStyles:{ fillColor:[220,38,38], fontSize:8, fontStyle:"bold", textColor:[255,255,255] },
                          bodyStyles:{ fontSize:8 }, columnStyles:{ 2:{cellWidth:28,halign:"right",fontStyle:"bold",textColor:[220,38,38]} },
                          foot:[[{ content:"SUBTOTAL", colSpan:2, styles:{halign:"right",fontStyle:"bold",fontSize:9,fillColor:[255,241,242],textColor:[220,38,38]} },{ content:fmt$(diaData.totalGas), styles:{halign:"right",fontStyle:"bold",fontSize:9,fillColor:[255,241,242],textColor:[220,38,38]} }]],
                          footStyles:{fillColor:[255,241,242]}, margin:{left:margin,right:margin}, styles:{cellPadding:3} });
                        y = doc.lastAutoTable.finalY + 8;
                      }
                      // Utilidad final
                      doc.setFillColor(util>=0?240:255,util>=0?253:241,util>=0?244:242);
                      doc.setDrawColor(util>=0?22:220,util>=0?163:38,util>=0?74:38); doc.setLineWidth(0.5);
                      doc.roundedRect(margin,y,W-margin*2,16,3,3,"FD");
                      doc.setFontSize(10); doc.setFont("helvetica","bold");
                      doc.setTextColor(util>=0?22:220,util>=0?163:38,util>=0?74:38);
                      doc.text("UTILIDAD NETA DEL DÍA", margin+6, y+7);
                      doc.setFontSize(13);
                      doc.text((util>=0?"+":"")+fmt$(util), W-margin-4, y+10, { align:"right" });
                      // Footer
                      const pH = doc.internal.pageSize.height;
                      doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(156,163,175);
                      doc.text(`${gymNombre}  |  Corte del día ${fechaLabel}  |  Generado ${fechaCorte} ${horaCorte}`, W/2, pH-8, { align:"center" });
                      doc.save(`corte-${gymNombre.replace(/\s+/g,"-").toLowerCase()}-${calDiaSelec}.pdf`);
                    } catch(err) { console.error(err); alert("Error generando PDF"); }
                  };

                  return (
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--col-accent-border)", borderRadius: 20, padding: "18px", marginBottom: 16, animation: "fadeUp .25s ease" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        <p style={{ color: "var(--col-accent-text)", fontSize: 15, fontWeight: 700 }}>📅 {fmtDate(calDiaSelec)}</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 2 }}>Corte de caja del día · {diaData.ingresos.length + diaData.gastos.length} movimientos</p>
                      </div>
                      <button onClick={() => setCalDiaSelec(null)} style={{ background: "var(--bg-elevated)", border: "none", borderRadius: 10, width: 30, height: 30, cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>

                    {/* Tarjetas resumen */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        { label: "Ingresos", val: diaData.totalIng, color: "var(--col-success)", bg: "rgba(74,222,128,.1)", border: "var(--col-success-border)" },
                        { label: "Gastos",   val: diaData.totalGas, color: "var(--col-danger)", bg: "rgba(248,113,113,.1)", border: "rgba(248,113,113,.2)" },
                        { label: "Utilidad", val: util, color: util >= 0 ? "var(--col-success)" : "var(--col-danger)", bg: util >= 0 ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", border: util >= 0 ? "var(--col-success-soft)" : "rgba(248,113,113,.15)" },
                      ].map(c => (
                        <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                          <p style={{ color: "var(--text-secondary)", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{c.label}</p>
                          <p style={{ color: c.color, fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{c.label === "Utilidad" && c.val > 0 ? "+" : ""}{fmtMoney(Math.abs(c.val))}</p>
                        </div>
                      ))}
                    </div>

                    {/* Ingresos por concepto con barra % */}
                    {catArr.length > 0 && (
                      <div style={{ background: "rgba(74,222,128,.05)", border: "1px solid var(--col-success-soft)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
                        <p style={{ color: "var(--col-success)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>💰 Ingresos por concepto</p>
                        {catArr.map(([cat, val]) => {
                          const pct = diaData.totalIng > 0 ? (val / diaData.totalIng * 100) : 0;
                          return (
                            <div key={cat} style={{ marginBottom: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📌"}</span>
                                  <span style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{cat}</span>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ color: "var(--col-success)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{fmtMoney(val)}</span>
                                  <span style={{ color: "var(--text-secondary)", fontSize: 10, marginLeft: 6 }}>{pct.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div style={{ height: 4, borderRadius: 2, background: "var(--bg-elevated)" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,var(--col-success),var(--col-info))", borderRadius: 2, transition: "width .4s ease" }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Formas de pago con % */}
                    {pagoArr.length > 0 && (
                      <div style={{ background: "rgba(167,139,250,.05)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
                        <p style={{ color: "var(--col-accent-text)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>💳 Por forma de pago</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          {pagoArr.map(([fp, val]) => {
                            const icon = fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : fp === "Tarjeta" ? "💳" : "❓";
                            const pct = diaData.totalIng > 0 ? (val / diaData.totalIng * 100) : 0;
                            return (
                              <div key={fp} style={{ flex: 1, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                                <p style={{ fontSize: 20, marginBottom: 4 }}>{icon}</p>
                                <p style={{ color: "var(--col-accent-text)", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmtMoney(val)}</p>
                                <p style={{ color: "var(--text-secondary)", fontSize: 10, marginTop: 2 }}>{fp}</p>
                                <p style={{ color: "var(--text-secondary)", fontSize: 9, marginTop: 1 }}>{pct.toFixed(0)}%</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Gastos por categoría */}
                    {gasArr.length > 0 && (
                      <div style={{ background: "rgba(248,113,113,.05)", border: "1px solid rgba(248,113,113,.12)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
                        <p style={{ color: "var(--col-danger)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>💸 Gastos por categoría</p>
                        {gasArr.map(([cat, val]) => {
                          const pct = diaData.totalGas > 0 ? (val / diaData.totalGas * 100) : 0;
                          return (
                            <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 14 }}>{CAT_ICON[cat] || "📌"}</span>
                                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{cat}</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 50, height: 3, borderRadius: 2, background: "var(--bg-elevated)" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: "var(--col-danger)", borderRadius: 2 }} />
                                </div>
                                <span style={{ color: "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{fmtMoney(val)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Botones PDF / WhatsApp / Copiar */}
                    {(diaData.ingresos.length > 0 || diaData.gastos.length > 0) && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                        <button onClick={descargarPDFDia}
                          style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            background: "linear-gradient(135deg,var(--col-danger),var(--col-danger))", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            boxShadow: "0 3px 12px rgba(244,63,94,.35)" }}>
                          <span style={{ fontSize: 14 }}>📄</span> PDF
                        </button>
                        <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(textoCorte)}`, "_blank")}
                          style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            background: "linear-gradient(135deg,var(--col-wa),var(--col-wa-dark))", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            boxShadow: "0 3px 12px var(--col-success-border)" }}>
                          <span style={{ fontSize: 14 }}>💬</span> WhatsApp
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(textoCorte)}
                          style={{ flex: 1, padding: "11px", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            background: "var(--bg-elevated)", color: "var(--text-secondary)",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <span style={{ fontSize: 14 }}>📋</span> Copiar
                        </button>
                      </div>
                    )}

                    {/* Lista detallada de ingresos */}
                    {diaData.ingresos.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <p style={{ color: "var(--col-success)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💰 Ingresos del día</p>
                        {diaData.ingresos.map(t => {
                          const fp = extraerFP(t);
                          const fpIcon = fp === "Efectivo" ? "💵" : fp === "Transferencia" ? "📲" : fp === "Tarjeta" ? "💳" : null;
                          const mFoto = (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                          return (
                            <div key={t.id} onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, marginBottom: 6, background: "rgba(74,222,128,.05)", border: "1px solid var(--col-success-soft)", cursor: "pointer" }}>
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--col-success-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, overflow: "hidden", border: "1.5px solid rgba(74,222,128,.25)" }}>
                                {mFoto ? <img src={mFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "💰"}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{limpiarDesc(t.desc || t.descripcion) || t.categoria || "Ingreso"}</p>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <span style={{ background: "var(--col-success-soft)", color: "var(--col-success)", borderRadius: 6, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>{t.categoria}</span>
                                  {fp && <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>{fpIcon} {fp}</span>}
                                </div>
                              </div>
                              <p style={{ color: "var(--col-success)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>+{fmtMoney(t.monto)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Lista detallada de gastos */}
                    {diaData.gastos.length > 0 && (
                      <div>
                        <p style={{ color: "var(--col-danger)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💸 Gastos del día</p>
                        {diaData.gastos.map(t => (
                          <div key={t.id} onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 14, marginBottom: 6, background: "rgba(248,113,113,.05)", border: "1px solid rgba(248,113,113,.12)", cursor: "pointer" }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(248,113,113,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, border: "1.5px solid rgba(248,113,113,.25)" }}>
                              {CAT_ICON[t.categoria] || "💸"}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{limpiarDesc(t.desc || t.descripcion) || t.categoria || "Gasto"}</p>
                              <span style={{ background: "rgba(248,113,113,.12)", color: "var(--col-danger)", borderRadius: 6, padding: "1px 6px", fontSize: 9, fontWeight: 700 }}>{t.categoria}</span>
                            </div>
                            <p style={{ color: "var(--col-danger)", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>-{fmtMoney(t.monto)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {diaData.ingresos.length === 0 && diaData.gastos.length === 0 && (
                      <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <p style={{ fontSize: 28, marginBottom: 6 }}>📭</p>
                        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Sin movimientos este día</p>
                      </div>
                    )}
                  </div>
                  );
                })()}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
