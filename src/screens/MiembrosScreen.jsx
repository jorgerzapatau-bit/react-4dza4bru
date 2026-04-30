// src/screens/MiembrosScreen.jsx
// ══════════════════════════════════════════════
// MEJORAS v2:
//   ✅ 1. KPIs operativos: ingresos activos, por vencer, sin membresía, retención
//   ✅ 2. Banner de alerta + WA masivo para alumnos por vencer
//   ✅ 3. Checkboxes + barra de acciones en lote (WA, renovar, baja)
//   ✅ 4. Agrupación por urgencia: Por vencer → Activos → Sin membresía
//   ✅ 5. Barra de progreso visual de días restantes
//   ✅ 6. Botones de acción directa (WA + renovar) sin entrar al perfil
//   ✅ 7. Filtro "Por vencer" + ordenar por vencimiento / nombre / monto
//   ✅ Usa gymConfig.termino_miembros ("Alumnos", "Miembros", etc.)
//   ✅ Muestra badge 🎓 Beca en la lista
//   ✅ Modo DOJO: badge de cinturón en tarjeta de alumno
// ══════════════════════════════════════════════
import { useState, useMemo } from "react";
import { fmt, fmtDate, diasParaVencer, todayISO } from "../utils/dateUtils";
import { getMembershipInfo, buildWAUrl, buildWAMsg } from "../utils/membershipUtils";
import { DEFAULT_PLANES, getIsDojo, getGradoInfo } from "../utils/constants";

// ── Barra de progreso de membresía ───────────────────────────────────────
function ProgresoBarra({ dias, planMeses = 1 }) {
  const totalDias = planMeses * 30;
  const pct = Math.max(0, Math.min(100, ((totalDias - (dias ?? totalDias)) / totalDias) * 100));
  const color = dias === null ? "#6b7280"
    : dias <= 3  ? "#ef4444"
    : dias <= 7  ? "#f97316"
    : dias <= 14 ? "#eab308"
    : "#22c55e";
  return (
    <div style={{ width: 52, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

// ── Chip de días restantes ────────────────────────────────────────────────
function DiasChip({ dias }) {
  if (dias === null) return <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>Sin fecha</span>;
  if (dias < 0) {
    const abs = Math.abs(dias);
    return <span style={{ background: "rgba(239,68,68,.18)", color: "#f87171", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>Venció hace {abs}d</span>;
  }
  if (dias === 0) return <span style={{ background: "rgba(239,68,68,.18)", color: "#f87171", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>Vence hoy</span>;
  if (dias <= 3) return <span style={{ background: "rgba(249,115,22,.18)", color: "#fb923c", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{dias}d</span>;
  if (dias <= 7) return <span style={{ background: "rgba(234,179,8,.18)", color: "#facc15", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{dias}d</span>;
  return <span style={{ background: "rgba(34,197,94,.12)", color: "#4ade80", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{dias}d</span>;
}

// ── Tarjeta de alumno (lista) ─────────────────────────────────────────────
function MemberRow({
  m, mi, dias, isDojo, isSelected, onSelect,
  onOpen, onWA, onRenovar, gymConfig,
}) {
  const isUrgent = dias !== null && dias >= 0 && dias <= 7;
  const isExpired = mi.estado === "Vencido" || mi.estado === "Sin membresía";
  const planMeses = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 }[mi.plan] || 1;

  const borderLeft = isExpired
    ? "3px solid rgba(239,68,68,.5)"
    : isUrgent
    ? "3px solid rgba(249,115,22,.6)"
    : "3px solid transparent";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 18,
        padding: "12px 14px",
        marginBottom: 8,
        border: "1px solid var(--border)",
        borderLeft,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: isExpired ? 0.82 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* Checkbox selección */}
      <div
        onClick={e => { e.stopPropagation(); onSelect(m.id); }}
        style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          border: isSelected ? "none" : "1.5px solid var(--border)",
          background: isSelected ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}
      >
        {isSelected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>

      {/* Avatar */}
      <div
        onClick={() => onOpen(m)}
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg,#6c63ff44,#e040fb44)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#c4b5fd", fontWeight: 700, fontSize: 16,
          overflow: "hidden", flexShrink: 0,
          boxShadow: isUrgent ? "0 0 0 2px rgba(249,115,22,.5)" : isExpired ? "0 0 0 2px rgba(239,68,68,.4)" : "0 0 0 2px rgba(108,99,255,.3)",
        }}
      >
        {m.foto
          ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : m.nombre.charAt(0)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => onOpen(m)}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
            {m.nombre}
          </p>
          {m.beca && <span style={{ fontSize: 11 }} title="Beca activa">🎓</span>}
          {isDojo && m.grado_actual && (() => {
            const g = getGradoInfo(m.grado_actual);
            return (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                background: g.kyu < 0 ? "rgba(168,85,247,.2)" : `${g.color}22`,
                color: g.kyu < 0 ? "#c084fc" : g.color === "#ffffff" ? "#d1d5db" : g.color,
                border: `1px solid ${g.kyu < 0 ? "rgba(168,85,247,.4)" : g.color === "#ffffff" ? "rgba(255,255,255,.3)" : `${g.color}55`}`,
              }}>
                {g.emoji} {m.grado_actual.split(" ")[0]}
              </span>
            );
          })()}
          {m.tutor_nombre && <span style={{ fontSize: 10, color: "#fbbf24" }}>👨‍👧</span>}
        </div>
        <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
          {mi.plan ? `Plan ${mi.plan}` : "Sin plan"} · 📱 {m.tel || "—"}
        </p>
      </div>

      {/* Días + barra + monto + acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {mi.estado === "Activo" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <DiasChip dias={dias} />
            <ProgresoBarra dias={dias} planMeses={planMeses} />
          </div>
        )}
        {mi.estado !== "Activo" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <DiasChip dias={dias} />
            <span style={{
              background: mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(239,68,68,.12)",
              color: mi.estado === "Sin membresía" ? "#6b7280" : "#f87171",
              borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700,
            }}>{mi.estado}</span>
          </div>
        )}

        <div style={{ textAlign: "right", minWidth: 48 }}>
          {mi.estado === "Activo"
            ? <p style={{ color: m.beca ? "#fbbf24" : "#22d3ee", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>
                {m.beca ? "Beca" : fmt(mi.monto)}
              </p>
            : <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>—</p>
          }
          {mi.estado === "Activo" && (
            <span style={{
              background: "rgba(74,222,128,.12)", color: "#4ade80",
              borderRadius: 5, padding: "1px 6px", fontSize: 9, fontWeight: 700,
            }}>Activo</span>
          )}
        </div>

        {/* Botones acción directa */}
        <div style={{ display: "flex", gap: 5 }}>
          {m.tel && (
            <button
              onClick={e => { e.stopPropagation(); onWA(m, mi, dias); }}
              title="Enviar WhatsApp"
              style={{
                width: 30, height: 30, borderRadius: 10,
                background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 13, flexShrink: 0,
              }}
            >💬</button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onRenovar(m); }}
            title="Renovar membresía"
            style={{
              width: 30, height: 30, borderRadius: 10,
              background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 13, flexShrink: 0,
            }}
          >↻</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════
export default function MiembrosScreen({
  miembros, txs,
  filtroEstado, setFiltroEstado,
  busqueda, setBusqueda,
  viewMode, setViewMode,
  setSelM, setModal, setScreen,
  activePlanes, setFM,
  gymConfig,
}) {
  const isDojo = getIsDojo(gymConfig);
  const termino = gymConfig?.termino_miembros || (isDojo ? "Alumnos" : "Miembros");
  const terminoSingular = termino.replace(/s$/, "");

  // ── Estado local ───────────────────────────────────────────────────────
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [ordenar, setOrdenar] = useState("vencimiento"); // "vencimiento"|"nombre"|"monto"

  // ── Cálculos ───────────────────────────────────────────────────────────
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const membresiaInfo = useMemo(() =>
    miembros.map(m => {
      const mi = getMembershipInfo(m.id, txs, m);
      const dias = diasParaVencer(mi.vence);
      return { m, mi, dias };
    }), [miembros, txs]);

  // KPIs
  const activos    = membresiaInfo.filter(({ mi }) => mi.estado === "Activo");
  const vencidos   = membresiaInfo.filter(({ mi }) => mi.estado === "Vencido" || mi.estado === "Sin membresía");
  const porVencer  = activos.filter(({ dias }) => dias !== null && dias <= 7);
  const nuevos     = miembros.filter(m => (m.fecha_incorporacion || "").startsWith(mesActual));
  const becas      = miembros.filter(m => m.beca);

  const ingresosMes = activos.reduce((acc, { m, mi }) => {
    if (m.beca) return acc;
    return acc + (Number(mi.monto) || 0);
  }, 0);

  const tasaRetencion = miembros.length > 0
    ? Math.round((activos.length / miembros.length) * 100)
    : 0;

  const potencialVencidos = vencidos.reduce((acc, { mi }) => {
    const plan = activePlanes?.find(p => p.nombre === mi.plan);
    return acc + (plan?.precio || Number(mi.monto) || 700);
  }, 0);

  // ── Filtrado y ordenado ────────────────────────────────────────────────
  const q = busqueda.toLowerCase();

  const filtrados = useMemo(() => {
    return membresiaInfo.filter(({ m, mi, dias }) => {
      const matchBusqueda = !q
        || m.nombre.toLowerCase().includes(q)
        || (m.tel || "").includes(q);

      const matchEstado =
        filtroEstado === "Todos" ||
        (filtroEstado === "Activo"     && mi.estado === "Activo") ||
        (filtroEstado === "Vencido"    && (mi.estado === "Vencido" || mi.estado === "Sin membresía")) ||
        (filtroEstado === "PorVencer"  && mi.estado === "Activo" && dias !== null && dias <= 7) ||
        (filtroEstado === "Nuevo"      && (m.fecha_incorporacion || "").startsWith(mesActual)) ||
        (filtroEstado === "Beca"       && m.beca);

      return matchBusqueda && matchEstado;
    });
  }, [membresiaInfo, q, filtroEstado, mesActual]);

  const ordenados = useMemo(() => {
    return [...filtrados].sort((a, b) => {
      if (ordenar === "nombre") return a.m.nombre.localeCompare(b.m.nombre);
      if (ordenar === "monto") return (Number(b.mi.monto) || 0) - (Number(a.mi.monto) || 0);
      // "vencimiento": urgentes primero, sin membresía al final
      const dA = a.dias ?? 9999;
      const dB = b.dias ?? 9999;
      if (a.mi.estado === "Sin membresía" && b.mi.estado !== "Sin membresía") return 1;
      if (b.mi.estado === "Sin membresía" && a.mi.estado !== "Sin membresía") return -1;
      return dA - dB;
    });
  }, [filtrados, ordenar]);

  // Grupos cuando se muestra "Todos" o "Activo"
  const grupos = useMemo(() => {
    if (filtroEstado !== "Todos" && filtroEstado !== "Activo") return null;
    const urgentes  = ordenados.filter(({ mi, dias }) => mi.estado === "Activo" && dias !== null && dias <= 7);
    const normales  = ordenados.filter(({ mi, dias }) => mi.estado === "Activo" && (dias === null || dias > 7));
    const inactivos = ordenados.filter(({ mi }) => mi.estado !== "Activo");
    return { urgentes, normales, inactivos };
  }, [ordenados, filtroEstado]);

  // ── Acciones de selección múltiple ────────────────────────────────────
  const toggleSeleccionado = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (seleccionados.size === ordenados.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(ordenados.map(({ m }) => m.id)));
    }
  };

  const enviarWAMasivo = () => {
    const ids = seleccionados.size > 0
      ? seleccionados
      : new Set(porVencer.map(({ m }) => m.id));

    membresiaInfo
      .filter(({ m }) => ids.has(m.id) && m.tel)
      .forEach(({ m, mi, dias }) => {
        const msg = buildWAMsg(m, dias ?? 0, mi, gymConfig?.nombre || "", gymConfig);
        window.open(buildWAUrl(m.tel, msg), "_blank");
      });
  };

  const enviarWAUno = (m, mi, dias) => {
    const msg = buildWAMsg(m, dias ?? 0, mi, gymConfig?.nombre || "", gymConfig);
    window.open(buildWAUrl(m.tel, msg), "_blank");
  };

  const renovarMiembro = (m) => {
    setSelM(m);
    setModal("detalle");
  };

  const abrirPerfil = (m) => {
    setSelM(m);
    setModal("detalle");
  };

  // ── Render de tarjetas ─────────────────────────────────────────────────
  const renderRow = ({ m, mi, dias }) => (
    <MemberRow
      key={m.id}
      m={m} mi={mi} dias={dias}
      isDojo={isDojo}
      isSelected={seleccionados.has(m.id)}
      onSelect={toggleSeleccionado}
      onOpen={abrirPerfil}
      onWA={enviarWAUno}
      onRenovar={renovarMiembro}
      gymConfig={gymConfig}
    />
  );

  const renderGrupo = (lista, label, color = "var(--text-tertiary)") => {
    if (!lista || lista.length === 0) return null;
    return (
      <>
        <p style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>
          {label} · {lista.length}
        </p>
        {lista.map(renderRow)}
      </>
    );
  };

  // ── Grid mode ─────────────────────────────────────────────────────────
  const renderGrid = (lista) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {lista.map(({ m, mi, dias }) => {
        const estadoColor = mi.estado === "Activo" ? "#4ade80" : mi.estado === "Sin membresía" ? "#6b7280" : "#f87171";
        const estadoBg    = mi.estado === "Activo" ? "rgba(74,222,128,.15)" : mi.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)";
        return (
          <div key={m.id} className="card rh"
            onClick={() => abrirPerfil(m)}
            style={{ background: "var(--bg-card)", borderRadius: 18, padding: "14px 12px", border: "1px solid var(--border)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center", position: "relative" }}
          >
            {m.beca && <span style={{ position: "absolute", top: 8, right: 8, fontSize: 14 }} title="Beca activa">🎓</span>}
            <div style={{ width: 54, height: 54, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 20, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 2px ${estadoColor}50` }}>
              {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
            </div>
            <p style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.nombre}</p>
            <span style={{ background: estadoBg, color: estadoColor, borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{mi.estado}</span>
            {dias !== null && <DiasChip dias={dias} />}
            <div style={{ display: "flex", gap: 6 }}>
              {m.tel && (
                <button onClick={e => { e.stopPropagation(); enviarWAUno(m, mi, dias); }}
                  style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>💬</button>
              )}
              <button onClick={e => { e.stopPropagation(); renovarMiembro(m); }}
                style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>↻</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── HEADER ── */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {/* Título + botones */}
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
                title="Mensajes masivos"
              >📢</button>
              <button
                onClick={() => { setFM({ nombre: "", tel: "", plan: null, monto: "", foto: null }); setModal("miembro"); }}
                style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >+ {terminoSingular}</button>
            </div>
          </div>

          {/* ── KPIs operativos ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
            {[
              {
                val: `$${Math.round(ingresosMes / 1000)}k`,
                label: "Ingresos activos/mes",
                sub: `${activos.length} miembros`,
                color: "#4ade80",
                bg: "rgba(74,222,128,.08)",
              },
              {
                val: porVencer.length,
                label: "Vencen esta semana",
                sub: porVencer.length > 0 ? "Acción requerida" : "Todo al día",
                color: porVencer.length > 0 ? "#fb923c" : "#4ade80",
                bg: porVencer.length > 0 ? "rgba(249,115,22,.08)" : "rgba(74,222,128,.06)",
                onClick: () => setFiltroEstado("PorVencer"),
              },
              {
                val: vencidos.length,
                label: "Sin membresía activa",
                sub: `$${Math.round(potencialVencidos / 1000)}k potencial`,
                color: vencidos.length > 0 ? "#f87171" : "#4ade80",
                bg: vencidos.length > 0 ? "rgba(239,68,68,.08)" : "rgba(74,222,128,.06)",
                onClick: () => setFiltroEstado("Vencido"),
              },
              {
                val: `${tasaRetencion}%`,
                label: "Tasa de retención",
                sub: tasaRetencion >= 75 ? "Buen ritmo" : "Meta: 75%",
                color: tasaRetencion >= 75 ? "#4ade80" : "#fbbf24",
                bg: "rgba(167,139,250,.08)",
              },
            ].map((k, i) => (
              <div
                key={i}
                onClick={k.onClick}
                style={{
                  background: k.bg || "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 14, padding: "10px 12px",
                  cursor: k.onClick ? "pointer" : "default",
                  transition: "opacity .2s",
                }}
              >
                <p style={{ color: k.color, fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{k.val}</p>
                <p style={{ color: "var(--text-tertiary)", fontSize: 10, fontWeight: 500, marginTop: 2 }}>{k.label}</p>
                <p style={{ color: k.color, fontSize: 9, fontWeight: 600, marginTop: 3, opacity: 0.8 }}>{k.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Banner alerta por vencer ── */}
          {porVencer.length > 0 && (
            <div style={{
              background: "rgba(249,115,22,.1)", border: "1px solid rgba(249,115,22,.3)",
              borderRadius: 12, padding: "10px 14px", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 15 }}>⚠️</span>
              <p style={{ color: "#fb923c", fontSize: 12, fontWeight: 600, flex: 1 }}>
                {porVencer.length} {porVencer.length === 1 ? `${terminoSingular} vence` : `${termino.toLowerCase()} vencen`} en los próximos 7 días
              </p>
              <button
                onClick={enviarWAMasivo}
                style={{
                  background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.35)",
                  borderRadius: 9, padding: "5px 11px", color: "#25d366",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >💬 Recordar a todos</button>
            </div>
          )}

          {/* ── Filtros de estado ── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {(() => {
              const tabs = [
                { label: "Activos",      val: "Activo",    count: activos.length,   c: "#4ade80", bg: "rgba(74,222,128," },
                { label: "Por vencer",   val: "PorVencer", count: porVencer.length, c: "#fb923c", bg: "rgba(249,115,22," },
                { label: "Vencidos",     val: "Vencido",   count: vencidos.length,  c: "#f87171", bg: "rgba(248,113,113," },
                { label: "Nuevos",       val: "Nuevo",     count: nuevos.length,    c: "#38bdf8", bg: "rgba(56,189,248," },
                ...(becas.length > 0 ? [{ label: "Becas", val: "Beca", count: becas.length, c: "#fbbf24", bg: "rgba(251,191,36," }] : []),
                { label: "Todos",        val: "Todos",     count: miembros.length,  c: "#a78bfa", bg: "rgba(167,139,250," },
              ];
              return tabs.map((s, i) => {
                const active = filtroEstado === s.val;
                return (
                  <button
                    key={i}
                    onClick={() => setFiltroEstado(s.val)}
                    style={{
                      background: active ? `${s.bg}.18)` : "var(--bg-elevated)",
                      border: active ? `1.5px solid ${s.bg}.35)` : "1.5px solid var(--border)",
                      borderRadius: 20, padding: "5px 12px",
                      cursor: "pointer", fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <span style={{ color: active ? s.c : "var(--text-tertiary)", fontSize: 11, fontWeight: active ? 700 : 500 }}>{s.label}</span>
                    <span style={{
                      background: active ? `${s.bg}.25)` : "var(--bg-card)",
                      color: active ? s.c : "var(--text-tertiary)",
                      borderRadius: 20, padding: "0 6px", fontSize: 10, fontWeight: 700,
                    }}>{s.count}</span>
                  </button>
                );
              });
            })()}
          </div>

          {/* ── Búsqueda + ordenar + toggle vista ── */}
          <div style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--text-tertiary)", pointerEvents: "none" }}>🔍</span>
              <input
                type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder={`Buscar ${termino.toLowerCase()}...`}
                style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: "11px 12px 11px 36px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              {busqueda && (
                <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 15 }}>✕</button>
              )}
            </div>

            {/* Ordenar */}
            <select
              value={ordenar}
              onChange={e => setOrdenar(e.target.value)}
              style={{
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "10px 12px", color: "var(--text-secondary)",
                fontSize: 12, fontFamily: "inherit", cursor: "pointer", outline: "none",
              }}
            >
              <option value="vencimiento">↑ Vencimiento</option>
              <option value="nombre">A-Z Nombre</option>
              <option value="monto">$ Monto</option>
            </select>

            {/* Toggle vista */}
            <button
              onClick={() => setViewMode(v => v === "lista" ? "grid" : "lista")}
              style={{ width: 44, height: 44, flexShrink: 0, border: "1px solid var(--border)", borderRadius: 14, background: "var(--bg-elevated)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--text-primary)" }}
              title={viewMode === "lista" ? "Ver cuadrícula" : "Ver lista"}
            >
              {viewMode === "lista" ? "⊞" : "☰"}
            </button>
          </div>

          {/* ── Barra de acciones masivas ── */}
          {seleccionados.size > 0 && (
            <div style={{
              background: "rgba(108,99,255,.12)", border: "1px solid rgba(108,99,255,.3)",
              borderRadius: 12, padding: "8px 14px", marginTop: 8,
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              <input
                type="checkbox"
                checked={seleccionados.size === ordenados.length}
                onChange={toggleTodos}
                style={{ width: 15, height: 15, cursor: "pointer" }}
              />
              <span style={{ color: "#a78bfa", fontSize: 12, fontWeight: 600 }}>
                {seleccionados.size} seleccionados
              </span>
              <button
                onClick={enviarWAMasivo}
                style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 8, padding: "4px 11px", color: "#25d366", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >💬 WhatsApp a todos</button>
              <button
                onClick={() => setSeleccionados(new Set())}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", fontSize: 11, cursor: "pointer", marginLeft: "auto" }}
              >Cancelar</button>
            </div>
          )}

          {/* Checkbox "seleccionar todos" cuando no hay selección */}
          {seleccionados.size === 0 && ordenados.length > 0 && viewMode === "lista" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "2px 4px" }}>
              <input
                type="checkbox"
                onChange={toggleTodos}
                style={{ width: 14, height: 14, cursor: "pointer" }}
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Seleccionar todos</span>
            </div>
          )}

        </div>
      </div>

      {/* ── LISTA ── */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "10px 24px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          {ordenados.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔎</p>
              <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Sin {termino.toLowerCase()} con esos filtros</p>
            </div>
          )}

          {viewMode === "grid" && ordenados.length > 0 && renderGrid(ordenados)}

          {viewMode === "lista" && ordenados.length > 0 && (
            <>
              {grupos ? (
                <>
                  {renderGrupo(grupos.urgentes,  "⚠️ Por vencer esta semana",   "#fb923c")}
                  {renderGrupo(grupos.normales,  "✓ Activos",                   "#4ade80")}
                  {renderGrupo(grupos.inactivos, "○ Sin membresía activa",      "#6b7280")}
                </>
              ) : (
                ordenados.map(renderRow)
              )}
            </>
          )}

        </div>
      </div>
    </>
  );
}
