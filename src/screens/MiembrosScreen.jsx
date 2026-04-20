import { fmt, fmtDate, diasParaVencer, todayISO } from "../utils/dateUtils";
import { getMembershipInfo } from "../utils/membershipUtils";
import { DEFAULT_PLANES } from "../utils/constants";

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
}) {
  return (
    <>
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button className="mobile-only" onClick={() => setScreen("dashboard")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Miembros</h1>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => setScreen("mensajes")} style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, padding: "8px 12px", color: "#25d366", fontSize: 18, cursor: "pointer" }}>📢</button>
            <button onClick={() => { const firstPlan = activePlanes[0] || DEFAULT_PLANES[0]; setFM({ nombre: "", tel: "", plan: firstPlan.nombre, monto: String(firstPlan.precio), foto: null }); setModal("miembro"); }} style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Nuevo</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {(() => {
            const hoyD = new Date(); const mesActual = `${hoyD.getFullYear()}-${String(hoyD.getMonth()+1).padStart(2,"0")}`;
            const nuevosCount = miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesActual)).length;
            return [{ label: "Activos", val: "Activo", count: miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length, c: "#4ade80", bg: "rgba(74,222,128," }, { label: "Vencidos", val: "Vencido", count: miembros.filter(m => { const s = getMembershipInfo(m.id, txs, m).estado; return s === "Vencido" || s === "Sin membresía"; }).length, c: "#f87171", bg: "rgba(248,113,113," }, { label: "Nuevos", val: "Nuevo", count: nuevosCount, c: "#38bdf8", bg: "rgba(56,189,248," }, { label: "Todos", val: "Todos", count: miembros.length, c: "#a78bfa", bg: "rgba(167,139,250," }];
          })().map((s, i) => {
            const active = filtroEstado === s.val;
            return <button key={i} onClick={() => setFiltroEstado(s.val)} style={{ flex: 1, background: active ? `${s.bg}.18)` : "rgba(255,255,255,.05)", border: active ? `1.5px solid ${s.bg}.35)` : "1.5px solid transparent", borderRadius: 14, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
              <p style={{ color: active ? s.c : "#6b7280", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{s.count}</p>
              <p style={{ color: active ? s.c : "#4b4b6a", fontSize: 11, fontWeight: active ? 700 : 500, marginTop: 2 }}>{s.label}</p>
            </button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#4b4b6a", pointerEvents: "none" }}>🔍</span>
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14, padding: "11px 12px 11px 36px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b4b6a", cursor: "pointer", fontSize: 15 }}>✕</button>}
          </div>
          <button onClick={() => setViewMode(v => v === "lista" ? "grid" : "lista")}
            style={{ width: 44, height: 44, flexShrink: 0, border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, background: "rgba(255,255,255,.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all .2s" }}
            title={viewMode === "lista" ? "Ver cuadrícula" : "Ver lista"}>
            {viewMode === "lista" ? "⊞" : "☰"}
          </button>
        </div>
      </div>
      <div className="gym-scroll-pad" style={{ flex: 1, overflowY: "auto", padding: "12px 24px 0" }}>
        {(() => {
          const q = busqueda.toLowerCase();
          const hoyD2 = new Date(); const mesActual2 = `${hoyD2.getFullYear()}-${String(hoyD2.getMonth()+1).padStart(2,"0")}`;
          const lista = miembros.filter(m => { const est = getMembershipInfo(m.id, txs, m).estado; const matchEstado = filtroEstado === "Todos" || (filtroEstado === "Activo" && est === "Activo") || (filtroEstado === "Vencido" && (est === "Vencido" || est === "Sin membresía")) || (filtroEstado === "Nuevo" && (m.fecha_incorporacion || "").startsWith(mesActual2)); return matchEstado; }).filter(m => !q || m.nombre.toLowerCase().includes(q) || (m.tel || "").includes(q));
          if (lista.length === 0) return <div style={{ textAlign: "center", padding: "40px 0" }}><p style={{ fontSize: 32, marginBottom: 12 }}>🔎</p><p style={{ color: "#4b4b6a", fontSize: 14 }}>Sin resultados</p></div>;
          if (viewMode === "grid") {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {lista.map(m => {
                  const mi = getMembershipInfo(m.id, txs, m);
                  const estadoColor = mi.estado === "Activo" ? "#4ade80" : mi.estado === "Sin membresía" ? "#6b7280" : "#f87171";
                  const estadoBg = mi.estado === "Activo" ? "rgba(74,222,128,.15)" : mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)";
                  return (
                    <div key={m.id} className="card rh" onClick={() => { setSelM(m); setModal("detalle"); }}
                      style={{ background: "rgba(255,255,255,.04)", borderRadius: 18, padding: "14px 12px", border: "1px solid rgba(255,255,255,.07)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                      <div style={{ width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 22, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 2px ${estadoColor}50` }}>
                        {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                      </div>
                      <p style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.nombre}</p>
                      <span style={{ background: estadoBg, color: estadoColor, borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{mi.estado}</span>
                      {mi.vence && <p style={{ color: "#4b4b6a", fontSize: 10 }}>Vence {fmtDate(mi.vence)}</p>}
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
              <div key={m.id} className="card rh" onClick={() => { setSelM(m); setModal("detalle"); }} style={{ background: "rgba(255,255,255,.04)", borderRadius: 18, padding: "14px 16px", marginBottom: 10, border: showWA ? "1px solid rgba(37,211,102,.25)" : "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 18, overflow: "hidden", flexShrink: 0, boxShadow: "0 0 0 2px rgba(108,99,255,.3)" }}>
                      {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                    </div>
                    <div>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{m.nombre}</p>
                      <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>{mi.plan ? `Plan ${mi.plan}` : "Sin plan"} · 📱 {m.tel || "—"}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ background: mi.estado === "Activo" ? "rgba(74,222,128,.15)" : mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)", color: mi.estado === "Activo" ? "#4ade80" : mi.estado === "Sin membresía" ? "#6b7280" : "#f87171", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{mi.estado}</span>
                    {mi.estado === "Activo" ? <p style={{ color: "#22d3ee", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{fmt(mi.monto)}</p> : <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginTop: 6 }}>—</p>}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.06)", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ color: "#4b4b6a", fontSize: 11 }}>Vence: {fmtDate(mi.vence) || "Por definir"}</p>
                    {showWA && <span style={{ background: "rgba(37,211,102,.15)", color: "#25d366", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>💬 {dias === 0 ? "hoy" : dias === 1 ? "mañana" : `${dias}d`}</span>}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>
    </>
  );
}
