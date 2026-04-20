// src/modals/CalendarioEventos.jsx
import { useState } from "react";
import { getMembershipInfo } from "../utils/membershipUtils";

const MESES_FULL  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS        = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

const FILTROS = [
  { key: "todos",   label: "Todos" },
  { key: "cumple",  label: "🎂 Cumpleaños" },
  { key: "vence",   label: "⏰ Vence" },
  { key: "vencido", label: "🔴 Vencidos" },
  { key: "nuevo",   label: "✨ Nuevos" },
];

/**
 * Parsea un string de vencimiento con formato "DD Mes YYYY" o "YYYY-MM-DD"
 * hacia un objeto Date. Función local para no depender de dateUtils aquí.
 */
function parseVence(str) {
  if (!str) return null;
  if (str.includes("-")) {
    const [y, mo, d] = str.split("-").map(Number);
    return new Date(y, mo - 1, d);
  }
  const MESES_N = {
    Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5,
    Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11,
  };
  const parts = str.split(" ");
  if (parts.length === 3)
    return new Date(Number(parts[2]), MESES_N[parts[1]] || 0, Number(parts[0]));
  return null;
}

/**
 * Calendario mensual con eventos de cumpleaños, vencimientos y nuevos miembros.
 *
 * Props:
 *   miembros        — array de objetos miembro
 *   txs             — array global de transacciones
 *   getMembershipInfo — función importada de membershipUtils (se pasa como prop
 *                       para mantener compatibilidad con GymApp que la pasa así)
 *   onGoToMember    — callback(miembro) al tocar un evento de la lista
 */
export default function CalendarioEventos({ miembros, txs, onGoToMember }) {
  const hoy = new Date();
  const [mesVer,  setMesVer]  = useState(hoy.getMonth());
  const [anioVer, setAnioVer] = useState(hoy.getFullYear());
  const [filtro,  setFiltro]  = useState("todos");

  /* ── Calcular todos los eventos del mes visible ── */
  const eventosDelMes = (() => {
    const mapa = {};
    const push = (dia, ev) => {
      if (!mapa[dia]) mapa[dia] = [];
      mapa[dia].push(ev);
    };

    miembros.forEach((m) => {
      // Cumpleaños
      if (m.fecha_nacimiento) {
        const fn = new Date(m.fecha_nacimiento + "T00:00:00");
        if (fn.getMonth() === mesVer) {
          push(fn.getDate(), {
            tipo: "cumple", nombre: m.nombre, foto: m.foto, miembro: m, color: "#f59e0b",
          });
        }
      }

      // Vencimientos
      const mem = getMembershipInfo(m.id, txs, m);
      if (mem.vence && mem.estado !== "Sin membresía") {
        const vp = parseVence(mem.vence);
        if (vp && vp.getMonth() === mesVer && vp.getFullYear() === anioVer) {
          push(vp.getDate(), {
            tipo: "vence", nombre: m.nombre, foto: m.foto, miembro: m,
            color: mem.estado === "Vencido" ? "#f43f5e" : "#22d3ee",
            vencido: mem.estado === "Vencido",
          });
        }
      }

      // Nuevos miembros (primera tx del mes)
      const txsM = txs.filter((t) => t.miembro_id === m.id);
      if (txsM.length > 0) {
        const primera = [...txsM].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""))[0];
        if (primera.fecha) {
          const fp = new Date(primera.fecha + "T00:00:00");
          if (fp.getMonth() === mesVer && fp.getFullYear() === anioVer) {
            push(fp.getDate(), {
              tipo: "nuevo", nombre: m.nombre, foto: m.foto, miembro: m, color: "#a78bfa",
            });
          }
        }
      }
    });

    return mapa;
  })();

  /* ── Stats ── */
  const todosEventos   = Object.values(eventosDelMes).flat();
  const totalCumples   = todosEventos.filter((e) => e.tipo === "cumple").length;
  const totalNuevos    = todosEventos.filter((e) => e.tipo === "nuevo").length;
  const totalVence     = todosEventos.filter((e) => e.tipo === "vence" && !e.vencido).length;
  const totalVencidos  = todosEventos.filter((e) => e.tipo === "vence" && e.vencido).length;

  /* ── Grilla del mes ── */
  const primerDia  = new Date(anioVer, mesVer, 1).getDay();
  const ajuste     = primerDia === 0 ? 6 : primerDia - 1;
  const diasEnMes  = new Date(anioVer, mesVer + 1, 0).getDate();
  const celdas     = Array(ajuste)
    .fill(null)
    .concat(Array.from({ length: diasEnMes }, (_, i) => i + 1));
  while (celdas.length % 7 !== 0) celdas.push(null);

  const esMesActual = mesVer === hoy.getMonth() && anioVer === hoy.getFullYear();

  /* ── Lista filtrada ── */
  const listaEventos = Object.entries(eventosDelMes)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .flatMap(([dia, evs]) => evs.map((ev) => ({ dia: Number(dia), ...ev })))
    .filter((ev) => {
      if (filtro === "todos")    return true;
      if (filtro === "cumple")   return ev.tipo === "cumple";
      if (filtro === "vence")    return ev.tipo === "vence" && !ev.vencido;
      if (filtro === "vencido")  return ev.tipo === "vence" && ev.vencido;
      if (filtro === "nuevo")    return ev.tipo === "nuevo";
      return true;
    });

  const navMes = (dir) => {
    let nm = mesVer + dir, ny = anioVer;
    if (nm < 0)  { nm = 11; ny--; }
    if (nm > 11) { nm = 0;  ny++; }
    setMesVer(nm);
    setAnioVer(ny);
  };

  /* ── RENDER ── */
  return (
    <div style={{ marginTop: 8 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>📅 Calendario</p>
          <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>Cumpleaños y vencimientos</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => navMes(-1)}
            style={{ border: "none", background: "rgba(255,255,255,.08)", color: "#9ca3af", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >‹</button>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, minWidth: 90, textAlign: "center" }}>
            {MESES_FULL[mesVer]} {anioVer}
          </span>
          <button
            onClick={() => navMes(1)}
            style={{ border: "none", background: "rgba(255,255,255,.08)", color: "#9ca3af", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >›</button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { count: totalCumples,  icon: "🎂", color: "#f59e0b", bg: "rgba(245,158,11,.08)",  border: "rgba(245,158,11,.2)",  label: "Cumpleaños" },
          { count: totalNuevos,   icon: "✨", color: "#a78bfa", bg: "rgba(167,139,250,.08)", border: "rgba(167,139,250,.2)", label: "Nuevos" },
          { count: totalVence,    icon: "⏰", color: "#22d3ee", bg: "rgba(34,211,238,.08)",  border: "rgba(34,211,238,.2)",  label: "Vencen este mes" },
          { count: totalVencidos, icon: "🔴", color: "#f43f5e", bg: "rgba(244,63,94,.08)",   border: "rgba(244,63,94,.2)",   label: "Ya vencidos" },
        ].map(({ count, icon, color, bg, border, label }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: bg.replace(".08", ".15"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {icon}
            </div>
            <div>
              <p style={{ color, fontSize: 20, fontWeight: 800, lineHeight: 1 }}>{count}</p>
              <p style={{ color: "#6b7280", fontSize: 10, marginTop: 2 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Días semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {DIAS.map((d) => (
          <p key={d} style={{ color: "#4b4b6a", fontSize: 9, fontWeight: 700, textAlign: "center", padding: "2px 0" }}>{d}</p>
        ))}
      </div>

      {/* Grilla */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 14 }}>
        {celdas.map((dia, idx) => {
          if (!dia) return <div key={idx} />;
          const evs        = eventosDelMes[dia] || [];
          const esHoy      = esMesActual && dia === hoy.getDate();
          const tieneCumple   = evs.some((e) => e.tipo === "cumple");
          const tieneVence    = evs.some((e) => e.tipo === "vence" && !e.vencido);
          const tieneVencido  = evs.some((e) => e.tipo === "vence" && e.vencido);
          const tieneNuevo    = evs.some((e) => e.tipo === "nuevo");
          return (
            <div
              key={idx}
              style={{
                borderRadius: 8, padding: "4px 2px", textAlign: "center",
                position: "relative", minHeight: 38,
                background: esHoy
                  ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                  : evs.length > 0 ? "rgba(255,255,255,.07)" : "transparent",
                border: evs.length > 0 && !esHoy
                  ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent",
              }}
            >
              <p style={{ color: esHoy ? "#fff" : evs.length > 0 ? "#e2e8f0" : "#4b4b6a", fontSize: 11, fontWeight: esHoy || evs.length > 0 ? 700 : 400 }}>
                {dia}
              </p>
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 2, marginTop: 2 }}>
                {tieneCumple  && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />}
                {tieneVence   && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22d3ee" }} />}
                {tieneVencido && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f43f5e" }} />}
                {tieneNuevo   && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#a78bfa" }} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {[
          { color: "#f59e0b", label: "Cumpleaños" },
          { color: "#22d3ee", label: "Vence membresía" },
          { color: "#f43f5e", label: "Ya vencido" },
          { color: "#a78bfa", label: "Nuevo miembro" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ color: "#6b7280", fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              border: "none", borderRadius: 20, padding: "5px 12px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              transition: "all .15s",
              background: filtro === f.key ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.07)",
              color: filtro === f.key ? "#fff" : "#9ca3af",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista de eventos */}
      {listaEventos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ color: "#4b4b6a", fontSize: 12 }}>Sin eventos este mes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {listaEventos.map((ev, i) => (
            <div
              key={i}
              onClick={() => onGoToMember && ev.miembro && onGoToMember(ev.miembro)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,.04)", borderRadius: 14, padding: "10px 12px",
                borderLeft: `3px solid ${ev.color}`,
                cursor: onGoToMember ? "pointer" : "default",
                transition: "background .15s",
              }}
            >
              <div
                style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: `${ev.color}22`, display: "flex", alignItems: "center",
                  justifyContent: "center", color: ev.color, fontWeight: 700, fontSize: 15,
                  overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 2px ${ev.color}40`,
                }}
              >
                {ev.foto
                  ? <img src={ev.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : ev.nombre.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ev.nombre}
                </p>
                <p style={{ color: "#4b4b6a", fontSize: 10 }}>
                  {ev.tipo === "cumple"
                    ? "🎂 Cumpleaños"
                    : ev.tipo === "nuevo"
                    ? "✨ Nuevo miembro"
                    : ev.vencido
                    ? "🔴 Ya vencido"
                    : "⏰ Vence membresía"}
                </p>
              </div>
              <span style={{ color: ev.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {String(ev.dia).padStart(2, "0")} {MESES_SHORT[mesVer]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
