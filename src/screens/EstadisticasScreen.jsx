import { fmt, fmtDate } from "../utils/dateUtils";
import { parseDate } from "../utils/dateUtils";
import { getMembershipInfo } from "../utils/membershipUtils";
import ReportePDF from "../components/ReportePDF";

export default function EstadisticasScreen({
  txs,
  miembros,
  gymConfig,
  statsTab,
  setStatsTab,
  statsChartType,
  setStatsChartType,
  selMes,
  setSelMes,
  setScreen,
  setModal,
  MESES_LABEL,
}) {
  const now = new Date();

  const mesesData = Array.from({ length: 12 }, (_, i) => {
    let m = now.getMonth() - (11 - i);
    let y = now.getFullYear();
    while (m < 0) { m += 12; y--; }
    const label = MESES_LABEL[m];
    const ing = txs.filter(t => { const d = parseDate(t.fecha); return d && d.getFullYear() === y && d.getMonth() === m && t.tipo === "ingreso"; }).reduce((s, t) => s + Number(t.monto), 0);
    const gas = txs.filter(t => { const d = parseDate(t.fecha); return d && d.getFullYear() === y && d.getMonth() === m && t.tipo === "gasto"; }).reduce((s, t) => s + Number(t.monto), 0);
    const util = ing - gas;
    const isCurrent = y === now.getFullYear() && m === now.getMonth();
    return { label, year: y, month: m, ing, gas, util, isCurrent };
  });

  const totalIngYear = mesesData.reduce((s, d) => s + d.ing, 0);
  const totalGasYear = mesesData.reduce((s, d) => s + d.gas, 0);
  const totalUtilYear = totalIngYear - totalGasYear;
  const mejorMes = mesesData.reduce((a, b) => b.util > a.util ? b : a, mesesData[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button className="mobile-only" onClick={() => setScreen("dashboard")} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--text-primary)", fontSize: 18 }}>←</button>
          <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>📊 Estadísticas</h1>
        </div>
        </div>
      </div>
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "0 24px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        {/* Annual summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Ingresos anuales", val: totalIngYear, c: "#22d3ee", bg: "rgba(34,211,238,.08)", bc: "rgba(34,211,238,.18)" },
            { label: "Gastos anuales", val: totalGasYear, c: "#f43f5e", bg: "rgba(244,63,94,.08)", bc: "rgba(244,63,94,.18)" },
            { label: "Utilidad anual", val: totalUtilYear, c: totalUtilYear >= 0 ? "#4ade80" : "#f87171", bg: totalUtilYear >= 0 ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", bc: totalUtilYear >= 0 ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)" },
          ].map((k, i) => (
            <div key={i} style={{ background: k.bg, border: `1px solid ${k.bc}`, borderRadius: 16, padding: "12px 10px" }}>
              <p style={{ color: "#8b949e", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{k.label}</p>
              <p style={{ color: k.c, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt(k.val)}</p>
            </div>
          ))}
        </div>

        {/* Mejor mes */}
        <div style={{ background: "linear-gradient(135deg,rgba(108,99,255,.15),rgba(224,64,251,.1))", border: "1px solid rgba(108,99,255,.25)", borderRadius: 16, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 3 }}>🏆 Mejor mes</p>
            <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700 }}>{mejorMes.label} {mejorMes.year}</p>
          </div>
          <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt(mejorMes.util)}</p>
        </div>

        {/* Controls: filter tabs + chart type toggle */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", gap: 3, background: "var(--bg-elevated)", borderRadius: 12, padding: 3 }}>
            {[["Todo","#a78bfa"], ["Ingresos","#22d3ee"], ["Gastos","#f43f5e"], ["Utilidad","#4ade80"]].map(([label, clr], i) => (
              <button key={i} onClick={() => setStatsTab(i)}
                style={{ flex: 1, padding: "7px 0", border: "none", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                  background: statsTab === i ? `${clr}25` : "transparent",
                  color: statsTab === i ? clr : "#8b949e",
                  fontSize: 10, fontWeight: statsTab === i ? 700 : 500,
                  borderBottom: statsTab === i ? `2px solid ${clr}` : "2px solid transparent",
                  transition: "all .2s" }}>{label}</button>
            ))}
          </div>
          <button onClick={() => setStatsChartType(t => t === "bar" ? "line" : "bar")}
            style={{ flexShrink: 0, padding: "7px 12px", border: "1px solid var(--border-strong)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }}>
            {statsChartType === "bar" ? "〜 Curva" : "▌Barras"}
          </button>
        </div>

        {/* Chart */}
        {(() => {
          const CHART_H = 140;
          const SERIES = [
            { key: "ing", color: "#22d3ee", label: "Ing" },
            { key: "gas", color: "#f43f5e", label: "Gas" },
            { key: "util", color: "#4ade80", negColor: "#f87171", label: "Util" },
          ];
          const activeSeries = statsTab === 0 ? SERIES : statsTab === 1 ? [SERIES[0]] : statsTab === 2 ? [SERIES[1]] : [SERIES[2]];
          const allVals = mesesData.flatMap(d => activeSeries.map(s => Math.abs(d[s.key])));
          const maxV = Math.max(...allVals, 1);

          if (statsChartType === "bar") {
            return (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "16px 12px 10px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: CHART_H + 20, justifyContent: "space-between" }}>
                  {mesesData.map((d, i) => {
                    const isActive = d.year === selMes.year && d.month === selMes.month;
                    return (
                      <div key={i} onClick={() => { setSelMes({ year: d.year, month: d.month }); setScreen("dashboard"); }}
                        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 2 }}>
                        <div style={{ width: "100%", height: CHART_H, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 1 }}>
                          {activeSeries.map(s => {
                            const val = d[s.key];
                            const barH = Math.max(Math.abs(val) / maxV * CHART_H, 2);
                            const clr = s.negColor && val < 0 ? s.negColor : s.color;
                            return <div key={s.key} style={{ flex: 1, height: barH, borderRadius: "3px 3px 0 0", background: d.isCurrent ? clr : `${clr}${isActive ? "ff" : "70"}`, boxShadow: isActive ? `0 0 8px ${clr}80` : "none", transition: "height .3s ease" }} />;
                          })}
                        </div>
                        <p style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)", fontSize: 8, fontWeight: isActive ? 700 : 400 }}>{d.label}</p>
                      </div>
                    );
                  })}
                </div>
                {statsTab === 0 && <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
                  {SERIES.map(s => <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} /><span style={{ color: "#8b949e", fontSize: 9 }}>{s.label}</span></div>)}
                </div>}
              </div>
            );
          }

          // Line chart (SVG)
          const W = 340; const H = CHART_H;
          const pts = (serie) => mesesData.map((d, i) => {
            const x = (i / (mesesData.length - 1)) * W;
            const y = H - (Math.abs(d[serie.key]) / maxV) * H * 0.9 - 8;
            return [x, y];
          });
          const pathD = (points) => points.map((p, i) => {
            if (i === 0) return `M${p[0]},${p[1]}`;
            const cp1x = (points[i-1][0] + p[0]) / 2; const cp1y = points[i-1][1];
            const cp2x = (points[i-1][0] + p[0]) / 2; const cp2y = p[1];
            return `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p[0]},${p[1]}`;
          }).join(" ");
          return (
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "16px 12px 10px", marginBottom: 16 }}>
              <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: H + 20, overflow: "visible" }}>
                {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={0} y1={H - f * H * 0.9 - 8} x2={W} y2={H - f * H * 0.9 - 8} stroke="#21262d" strokeWidth="1" />)}
                {activeSeries.map(s => {
                  const points = pts(s);
                  const d = pathD(points);
                  const areaD = d + ` L${points[points.length-1][0]},${H} L${points[0][0]},${H} Z`;
                  const clr = s.color;
                  return (
                    <g key={s.key}>
                      <defs><linearGradient id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={clr} stopOpacity="0.25"/><stop offset="100%" stopColor={clr} stopOpacity="0"/></linearGradient></defs>
                      <path d={areaD} fill={`url(#grad-${s.key})`} />
                      <path d={d} fill="none" stroke={clr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map(([x,y], i) => <circle key={i} cx={x} cy={y} r={mesesData[i].isCurrent ? 4 : 2.5} fill={clr} stroke="#13131f" strokeWidth="1.5" />)}
                    </g>
                  );
                })}
                {mesesData.map((d, i) => <text key={i} x={(i / (mesesData.length-1)) * W} y={H + 16} textAnchor="middle" fill={d.isCurrent ? "var(--text-primary)" : "#8b949e"} fontSize="8" fontWeight={d.isCurrent ? "700" : "400"}>{d.label}</text>)}
              </svg>
              {statsTab === 0 && <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 4 }}>
                {SERIES.map(s => <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 16, height: 2, background: s.color, borderRadius: 2 }} /><span style={{ color: "#8b949e", fontSize: 9 }}>{s.label}</span></div>)}
              </div>}
            </div>
          );
        })()}

        {/* Month detail list */}
        <div style={{ marginTop: 16 }}>
          <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Detalle por mes</p>
          {[...mesesData].reverse().map((d, i) => (
            <div key={i} onClick={() => { setSelMes({ year: d.year, month: d.month }); setScreen("dashboard"); }}
              style={{ background: d.isCurrent ? "rgba(108,99,255,.12)" : "var(--bg-card)", border: d.isCurrent ? "1px solid rgba(108,99,255,.3)" : "1px solid var(--border)", borderRadius: 16, padding: "12px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600 }}>{d.label} {d.year} {d.isCurrent ? <span style={{ color: "#a78bfa", fontSize: 10, marginLeft: 6 }}>· Actual</span> : ""}</p>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <span style={{ color: "#22d3ee", fontSize: 11 }}>↑ {fmt(d.ing)}</span>
                  <span style={{ color: "#f43f5e", fontSize: 11 }}>↓ {fmt(d.gas)}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ color: d.util >= 0 ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{d.util >= 0 ? "+" : ""}{fmt(d.util)}</p>
                <p style={{ color: "#8b949e", fontSize: 10, marginTop: 2 }}>utilidad</p>
              </div>
            </div>
          ))}
        </div>

        {/* Calendario */}
        {(() => {
          const hoyC = new Date();
          const evCount = miembros.reduce((acc, m) => {
            if (m.fecha_nacimiento) { const fn = new Date(m.fecha_nacimiento + "T00:00:00"); if (fn.getMonth() === hoyC.getMonth()) acc++; }
            const mem = getMembershipInfo(m.id, txs, m);
            if (mem.vence && mem.estado !== "Sin membresía") {
              const MESES_N2 = {"Ene":0,"Feb":1,"Mar":2,"Abr":3,"May":4,"Jun":5,"Jul":6,"Ago":7,"Sep":8,"Oct":9,"Nov":10,"Dic":11};
              const parts = mem.vence.split(" ");
              if (parts.length === 3 && Number(MESES_N2[parts[1]]) === hoyC.getMonth()) acc++;
            }
            return acc;
          }, 0);
          return (
            <button onClick={() => setModal("calendario")}
              style={{ width: "100%", marginTop: 4, marginBottom: 4, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,rgba(108,99,255,.3),rgba(224,64,251,.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📅</div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 700 }}>Calendario</p>
                  <p style={{ color: "#8b949e", fontSize: 11 }}>Cumpleaños y vencimientos</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {evCount > 0 && <span style={{ background: "rgba(167,139,250,.2)", color: "#a78bfa", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{evCount} este mes</span>}
                <span style={{ color: "#8b949e", fontSize: 16 }}>›</span>
              </div>
            </button>
          );
        })()}

        {/* Reporte PDF */}
        <div style={{ marginTop: 20, marginBottom: 20, background: "var(--bg-card)", borderRadius: 20, padding: 16, border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📄 Descargar reporte mensual</p>
          <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 14 }}>Genera un PDF con el resumen financiero y lista de miembros del mes seleccionado.</p>
          <ReportePDF txs={txs} miembros={miembros} gymConfig={gymConfig} getMembershipInfo={getMembershipInfo} MESES_LABEL={MESES_LABEL} />
        </div>
        </div>
      </div>
    </div>
  );
}
