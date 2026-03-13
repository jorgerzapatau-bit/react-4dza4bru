import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase, getGymId } from "./supabase";

function fmt(n) { return "$" + Number(n).toLocaleString("es-MX"); }
function today() {
  const d = new Date();
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${String(d.getDate()).padStart(2,"0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}
function uid() { return Math.random().toString(36).slice(2, 9); }
function copyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;background:transparent;opacity:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand("copy"); } catch(e) { console.warn("copy failed", e); }
  document.body.removeChild(ta);
}

const M_IDS = [uid(), uid(), uid(), uid()];

// Helper: parse "DD Mes YYYY" or ISO to Date
function parseDate(str) {
  if (!str || str === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T00:00:00");
  const meses = { "Ene": 0, "Feb": 1, "Mar": 2, "Abr": 3, "May": 4, "Jun": 5, "Jul": 6, "Ago": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dic": 11 };
  const parts = str.trim().split(" ");
  if (parts.length < 3) return null;
  const day = parseInt(parts[0]);
  const mon = meses[parts[1]];
  const year = parseInt(parts[2]);
  if (isNaN(day) || mon === undefined || isNaN(year)) return null;
  return new Date(year, mon, day);
}

// Days until next birthday
function diasParaCumple(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const nac = new Date(fechaNac + "T00:00:00");
  if (isNaN(nac)) return null;
  const cumple = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (cumple < hoy) cumple.setFullYear(hoy.getFullYear() + 1);
  return Math.round((cumple - hoy) / (1000 * 60 * 60 * 24));
}

function calcEdad(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac + "T00:00:00");
  if (isNaN(nac)) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

// Days until expiration (negative = already expired)
function diasParaVencer(venceStr) {
  const vence = parseDate(venceStr);
  if (!vence) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  vence.setHours(0, 0, 0, 0);
  return Math.round((vence - hoy) / (1000 * 60 * 60 * 24));
}

// ── Calcula membresía activa desde transacciones ──
function getMembershipInfo(miembroId, txs, miembro) {
  const memTxs = txs
    .filter(t => t.categoria === "Membresías" && (String(t.miembroId) === String(miembroId) || String(t.miembro_id) === String(miembroId)))
    .sort((a, b) => {
      // Usar parseDate para manejar tanto "10 Mar 2026" como "2026-03-10"
      const da = parseDate(a.fecha);
      const db2 = parseDate(b.fecha);
      if (da && db2) return db2 - da;
      return (b.fecha || "").localeCompare(a.fecha || "");
    });
  if (memTxs.length === 0) return { estado: "Sin membresía", vence: null, inicio: null, plan: null, monto: null, esGratis: false, congelado: false };
  const ultima = memTxs[0];
  const descStr = ultima.desc || ultima.descripcion || "";
  const esGratis = descStr.includes("Cortesía") || Number(ultima.monto) === 0;
  const planMatch = descStr.match(/Renovación (\w+)/) || descStr.match(/(Mensual|Trimestral|Semestral|Anual)/);
  const plan = planMatch ? planMatch[1] : "Mensual";
  const MESES_N = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const diasCongelados = miembro?.dias_congelados || 0;

  let vence = null;

  // 1. Prioridad: vencimiento manual guardado en la transacción
  const venceManualISO = ultima.vence_manual || (() => {
    // Extraer del campo desc si fue guardado como "(vence:YYYY-MM-DD)"
    const m = descStr.match(/\(vence:(\d{4}-\d{2}-\d{2})\)/);
    return m ? m[1] : null;
  })();

  if (venceManualISO) {
    // Usar fecha manual + días congelados
    const [vy, vm, vd] = venceManualISO.split("-").map(Number);
    const v = new Date(vy, vm - 1, vd);
    if (diasCongelados > 0) v.setDate(v.getDate() + diasCongelados);
    vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
  } else {
    // 2. Fallback: calcular desde fecha de tx + meses del plan
    // parseDate soporta tanto "2026-03-10" como "10 Mar 2026"
    const v = parseDate(ultima.fecha);
    if (v) {
      const mesesPlan = { "Mensual": 1, "Trimestral": 3, "Semestral": 6, "Anual": 12 };
      v.setMonth(v.getMonth() + (mesesPlan[plan] || 1));
      if (diasCongelados > 0) v.setDate(v.getDate() + diasCongelados);
      vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
    }
  }

  const congelado = !!(miembro?.congelado);
  const fechaDescongelar = miembro?.fecha_descongelar || null;
  const hoyISO = new Date().toISOString().split("T")[0];
  const sigueCongelado = congelado && (!fechaDescongelar || fechaDescongelar > hoyISO);
  const dias = sigueCongelado ? 999 : (vence ? diasParaVencer(vence) : null);
  const estado = sigueCongelado ? "Congelado" : (dias !== null && dias >= 0 ? "Activo" : "Vencido");
  // Extraer forma de pago embebida en la descripción ej: "[Efectivo]"
  const fpMatch = (ultima.desc || ultima.descripcion || "").match(/\[(Efectivo|Transferencia|Tarjeta)\]/);
  const formaPago = fpMatch ? fpMatch[1] : null;
  return { estado, vence, inicio: ultima.fecha, plan, monto: ultima.monto, esGratis, congelado: sigueCongelado, fechaDescongelar, formaPago };
}

// Build WhatsApp message
function buildWAMsg(miembro, diasReales, memInfo, gymNombre) {
  const nombre = miembro.nombre.split(" ")[0];
  const plan = memInfo?.plan || "";
  const vence = memInfo?.vence || "";
  const gym = gymNombre || "el gimnasio";
  const planStr = plan ? ` *${plan}*` : "";
  if (diasReales === 0) return `¡Hola ${nombre}! 🚨 Tu membresía${planStr} en *${gym}* vence *HOY*. Renueva ahora para no perder tu acceso 💪`;
  if (diasReales === 1) return `¡Hola ${nombre}! 🚨 Tu membresía${planStr} vence *mañana* (${vence}). Renueva hoy para no perder ni un día 💪`;
  if (diasReales <= 3) return `¡Hola ${nombre}! ⏰ Tu membresía${planStr} vence en *${diasReales} días* (${vence}). No pierdas tu acceso al gym 🔥`;
  return `¡Hola ${nombre}! 👋 Te recordamos que tu membresía${planStr} en *${gym}* vence en *${diasReales} días* (${vence}). ¿Deseas renovarla? 💪`;
}

function buildWAUrl(tel, msg) {
  const clean = (tel || "").replace(/\D/g, "");
  const phone = clean.startsWith("52") ? clean : `52${clean}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// Data is loaded from Supabase — no demo data
const INIT_MIEMBROS = [];
const INIT_TX = [];

const PREV = { totalIngresos: 71200, totalGastos: 51800 };
// Default plans — overridden by gymConfig.planes from Supabase
const DEFAULT_PLANES = [
  { nombre: "Mensual", meses: 1, precio: 850, activo: true },
  { nombre: "Trimestral", meses: 3, precio: 2200, activo: false },
  { nombre: "Semestral", meses: 6, precio: 3900, activo: false },
  { nombre: "Anual", meses: 12, precio: 7500, activo: false },
];
const PLANES = DEFAULT_PLANES.map(p => p.nombre);
const PLAN_PRECIO = Object.fromEntries(DEFAULT_PLANES.map(p => [p.nombre, p.precio]));
const PLAN_MESES = Object.fromEntries(DEFAULT_PLANES.map(p => [p.nombre, p.meses]));
// Note: in components, use gymConfig?.planes to get live prices

function todayISO() {
  const d = new Date();
  // Use local date (not UTC) to avoid timezone off-by-one-day bug
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function calcVence(inicioISO, plan) {
  if (!inicioISO) return "";
  // Parse local date to avoid timezone off-by-one
  const [y, mo, day] = inicioISO.split("-").map(Number);
  const d = new Date(y, mo - 1, day);
  d.setMonth(d.getMonth() + (PLAN_MESES[plan] || 1));
  const yr = d.getFullYear();
  const m2 = String(d.getMonth() + 1).padStart(2, "0");
  const d2 = String(d.getDate()).padStart(2, "0");
  return `${yr}-${m2}-${d2}`;
}
// Convert display date "9 Mar 2026" or "06 Mar 2026" -> "2026-03-09" for date inputs
function displayToISO(str) {
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str; // already ISO
  const MMAP = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12,
    Ene:1,Feb:2,Mar:3,Abr:4,May:5,Jun:6,Jul:7,Ago:8,Sep:9,Oct:10,Nov:11,Dic:12 };
  const m = str.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})/);
  if (!m) return "";
  const y = m[3], mo = String(MMAP[m[2]] || 1).padStart(2,"0"), d = String(m[1]).padStart(2,"0");
  return `${y}-${mo}-${d}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, day] = iso.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(day)} ${meses[parseInt(m) - 1]} ${y}`;
}

const CAT_ING = ["Membresías", "Clases extras", "Tienda", "Personal trainer", "Otro"];
const CAT_GAS = ["Nómina", "Renta", "Servicios", "Mantenimiento", "Insumos", "Otro"];
const CAT_ICON = {
  "Membresías": "👥", "Clases extras": "🏋️", "Tienda": "🛍️", "Personal trainer": "💪",
  "Nómina": "👔", "Renta": "🏢", "Servicios": "⚡", "Mantenimiento": "🔧", "Insumos": "📦", "Otro": "📝"
};

/* ─── UI Atoms ─── */
function Badge({ val }) {
  const up = parseFloat(val) >= 0;
  return (
    <span style={{ background: up ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)", color: up ? "#4ade80" : "#f87171", borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
      {up ? "▲" : "▼"} {Math.abs(val)}%
    </span>
  );
}

function Inp({ label, value, onChange, type = "text", placeholder, options, readOnly }) {
  const s = {
    width: "100%", background: readOnly ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px",
    color: readOnly ? "#6b7280" : "#fff", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 12,
  };
  return (
    <div>
      {label && <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>{label}</p>}
      {options
        ? <select value={value} onChange={e => onChange(e.target.value)} style={{ ...s, cursor: "pointer" }} disabled={readOnly}>
          {options.map(o => <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>)}
        </select>
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} readOnly={readOnly} />
      }
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.72)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "#191928", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", maxHeight: "92%", overflowY: "auto", animation: "slideUp .3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, color = "#6c63ff", full, outline, small, style: extraStyle }) {
  return (
    <button onClick={onClick} style={{
      width: full ? "100%" : "auto", padding: small ? "8px 14px" : "13px 20px",
      border: outline ? `1.5px solid ${color}` : "none", borderRadius: 14, cursor: "pointer",
      fontFamily: "inherit", fontSize: small ? 12 : 14, fontWeight: 700,
      background: outline ? "transparent" : `linear-gradient(135deg,${color},${color}bb)`,
      color: outline ? color : "#fff",
      boxShadow: outline ? "none" : `0 4px 18px ${color}44`, transition: "opacity .15s",
      ...extraStyle,
    }}>{children}</button>
  );
}

/* ─── WHATSAPP REMINDERS SCREEN ─── */
function MensajesScreen({ miembros, txs, gymConfig, onBack, onUpdatePlantillas, miembroInicial, modoInicial, recordatoriosEnviados = {}, onMarcarRecordatorio }) {
  // modo: "vencimientos" | "individual" | "masivo"
  const [modo, setModo] = useState(modoInicial || (miembroInicial ? "individual" : "vencimientos"));
  const [enviados, setEnviados] = useState({});
  // Para modo individual
  const [selMiembro, setSelMiembro] = useState(miembroInicial || null);
  const [busqueda, setBusqueda] = useState("");
  // Mensaje compartido editable para todos los modos
  const [msgTexto, setMsgTexto] = useState("");
  const [msgOrigen, setMsgOrigen] = useState(null);
  // Para masivo
  const [copiadoMsg, setCopiadoMsg] = useState(false);
  const [copiadoNums, setCopiadoNums] = useState(false);

  const gymNom = gymConfig?.nombre || "GymFit Pro";
  const tplsCustom = gymConfig?.plantillas_wa || [
    { icon: "⭐", label: "", msg: "" },
    { icon: "⭐", label: "", msg: "" },
    { icon: "⭐", label: "", msg: "" },
  ];
  const tplsFijas = [
    { icon: "🚫", label: "Clase cancelada", msg: `La clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏 — ${gymNom}` },
    { icon: "⏰", label: "Cambio de horario", msg: `Aviso: hubo un cambio de horario. El nuevo horario es a las 7:00pm — ${gymNom}` },
    { icon: "🏋️", label: "Evento especial", msg: `🔥 Te invitamos a nuestro evento especial este sábado. ¡Esperamos verte! — ${gymNom}` },
    { icon: "🛑", label: "Cierre temporal", msg: `El gym estará cerrado mañana por mantenimiento — ${gymNom}` },
  ];

  const alertas = useMemo(() => {
    const result = [];
    miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").forEach(m => {
      const info = getMembershipInfo(m.id, txs, m);
      const diasReales = diasParaVencer(info.vence);
      if (diasReales === null || diasReales < 0 || diasReales > 5) return;
      result.push({ miembro: m, diasReales, memInfo: info });
    });
    result.sort((a, b) => a.diasReales - b.diasReales);
    return result;
  }, [miembros, txs]);

  const pendientes = alertas.filter(({ miembro }) => !enviados[miembro.id]).length;

  const urgColor = (d) => d <= 1 ? "#f43f5e" : d <= 3 ? "#f59e0b" : "#22d3ee";
  const urgLabel = (d) => d === 0 ? "HOY 🚨" : d === 1 ? "MAÑANA" : `${d}d`;

  const enviarWA = (tel, msg, miembroId) => {
    window.open(buildWAUrl(tel, msg), "_blank");
    if (miembroId) {
      setEnviados(p => ({ ...p, [miembroId]: true }));
      if (onMarcarRecordatorio) onMarcarRecordatorio(miembroId);
    }
  };
  // When sending from individual mode, also mark as recordatorio
  const enviarWAIndividual = (tel, msg, miembroId) => {
    window.open(buildWAUrl(tel, msg), "_blank");
    if (miembroId && onMarcarRecordatorio) onMarcarRecordatorio(miembroId);
  };

  const selNombre1 = selMiembro?.nombre?.split(" ")[0] || "";
  const destMasivo = miembros.filter(mb => getMembershipInfo(mb.id, txs, mb).estado === "Activo" && mb.tel);

  // Plantilla personalizada por miembro (reemplaza {nombre})
  const tplParaMiembro = (msg) => selMiembro ? msg.replace(/\{nombre\}/gi, selNombre1) : msg;

  const modos = [
    { k: "vencimientos", icon: "⏰", label: "Vencimientos" },
    { k: "individual",   icon: "👤", label: "Individual" },
    { k: "masivo",       icon: "📢", label: "Masivo" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
      {/* ── Header fijo ── */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18, flexShrink: 0 }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: "#fff", fontSize: 19, fontWeight: 700 }}>💬 Mensajes</h1>
            <p style={{ color: "#4b4b6a", fontSize: 11 }}>WhatsApp · vencimientos, individual o masivo</p>
          </div>
          {pendientes > 0 && (
            <span style={{ background: "#f43f5e", color: "#fff", borderRadius: 10, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{pendientes}</span>
          )}
        </div>

        {/* Selector de modo */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4, marginBottom: 14 }}>
          {modos.map(m => (
            <button key={m.k} onClick={() => { setModo(m.k); setMsgTexto(""); setMsgOrigen(null); setCopiadoMsg(false); setCopiadoNums(false); }}
              style={{ flex: 1, padding: "9px 4px", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                background: modo === m.k ? "linear-gradient(135deg,#25d366,#128c7e)" : "transparent",
                color: modo === m.k ? "#fff" : "#4b4b6a", fontSize: 11, fontWeight: modo === m.k ? 700 : 500,
                boxShadow: modo === m.k ? "0 2px 12px rgba(37,211,102,.3)" : "none", transition: "all .2s" }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido scrollable ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 90px" }}>

        {/* ════ MODO: VENCIMIENTOS ════ */}
        {modo === "vencimientos" && (
          <>
            {alertas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0" }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🎉</p>
                <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700 }}>¡Sin vencimientos próximos!</p>
                <p style={{ color: "#4b4b6a", fontSize: 12, marginTop: 6 }}>Todos los miembros tienen su membresía al día</p>
              </div>
            ) : alertas.map(({ miembro, diasReales, memInfo }) => {
              const col = urgColor(diasReales);
              const enviado = !!enviados[miembro.id];
              const msg = buildWAMsg(miembro, diasReales, memInfo, gymNom);
              return (
                <div key={miembro.id} style={{ background: enviado ? "rgba(255,255,255,.03)" : `${col}10`, border: `1px solid ${enviado ? "rgba(255,255,255,.06)" : col + "35"}`, borderRadius: 18, padding: 14, marginBottom: 12, opacity: enviado ? 0.65 : 1, transition: "all .3s" }}>
                  {/* Miembro + badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: `${col}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, color: col, border: `2px solid ${col}50` }}>
                      {miembro.foto ? <img src={miembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : miembro.nombre.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{miembro.nombre}</p>
                      <p style={{ color: "#4b4b6a", fontSize: 11 }}>{memInfo.plan} · {miembro.tel || "Sin número"}</p>
                    </div>
                    <span style={{ background: enviado ? "rgba(74,222,128,.15)" : `${col}25`, color: enviado ? "#4ade80" : col, borderRadius: 8, padding: "4px 9px", fontSize: 11, fontWeight: 700 }}>
                      {enviado ? "✓" : urgLabel(diasReales)}
                    </span>
                  </div>
                  {/* Mensaje editable */}
                  <textarea
                    value={enviado ? msg : (enviados["msg_" + miembro.id] ?? msg)}
                    onChange={e => setEnviados(p => ({ ...p, ["msg_" + miembro.id]: e.target.value }))}
                    rows={3}
                    style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px", color: "#d1d5db", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5, marginBottom: 8 }}
                  />
                  <button
                    onClick={() => enviarWA(miembro.tel, enviados["msg_" + miembro.id] ?? msg, miembro.id)}
                    disabled={!miembro.tel}
                    style={{ width: "100%", padding: "11px", border: "none", borderRadius: 12, cursor: miembro.tel ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                      background: enviado ? "rgba(74,222,128,.12)" : miembro.tel ? "linear-gradient(135deg,#25d366,#128c7e)" : "rgba(255,255,255,.06)",
                      color: enviado ? "#4ade80" : miembro.tel ? "#fff" : "#4b4b6a",
                      boxShadow: !enviado && miembro.tel ? "0 4px 14px rgba(37,211,102,.3)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    {enviado ? "✓ Enviado" : miembro.tel ? "💬 Enviar por WhatsApp" : "Sin número registrado"}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ════ MODO: INDIVIDUAL ════ */}
        {modo === "individual" && (
          <>
            {/* Vista: selección de miembro (cuando no hay nadie seleccionado) */}
            {!selMiembro && (
              <>
                {/* Buscador */}
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#4b4b6a", pointerEvents: "none" }}>🔍</span>
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar miembro..."
                    style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px 10px 36px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  />
                  {busqueda && (
                    <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b4b6a", fontSize: 16, cursor: "pointer", padding: 2 }}>✕</button>
                  )}
                </div>
                {/* Lista filtrada */}
                {(() => {
                  const conTel = miembros.filter(m => m.tel);
                  const filtrados = busqueda.trim()
                    ? conTel.filter(m => m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || m.tel.includes(busqueda))
                    : conTel;
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {filtrados.length === 0 && (
                        <p style={{ color: "#4b4b6a", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No se encontró "{busqueda}"</p>
                      )}
                      {filtrados.map(m => (
                        <button key={m.id} onClick={() => { setSelMiembro(m); setMsgTexto(""); setMsgOrigen(null); setBusqueda(""); }}
                          style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                            {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                          </div>
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                            <p style={{ color: "#4b4b6a", fontSize: 11 }}>📱 {m.tel}</p>
                          </div>
                          <span style={{ color: "#4b4b6a", fontSize: 14 }}>›</span>
                        </button>
                      ))}
                      {miembros.filter(m => !m.tel).length > 0 && !busqueda && (
                        <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "center", padding: "6px 0" }}>
                          {miembros.filter(m => !m.tel).length} miembro{miembros.filter(m=>!m.tel).length>1?"s":""} sin número no aparecen
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Vista: composición de mensaje (cuando hay miembro seleccionado) */}
            {selMiembro && (
              <>
                {/* Header compacto del destinatario */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(108,99,255,.1)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                    {selMiembro.foto ? <img src={selMiembro.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : selMiembro.nombre.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>{selMiembro.nombre}</p>
                    <p style={{ color: "#4b4b6a", fontSize: 11 }}>📱 {selMiembro.tel}</p>
                  </div>
                  <button onClick={() => { setSelMiembro(null); setMsgTexto(""); setMsgOrigen(null); }}
                    style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", color: "#9ca3af", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                    Cambiar ✕
                  </button>
                </div>

                {/* Área de mensaje */}
                <textarea
                  value={msgTexto}
                  onChange={e => setMsgTexto(e.target.value)}
                  placeholder={`Hola ${selNombre1}, escribe o elige una plantilla abajo...`}
                  rows={4}
                  autoFocus
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 4 }}
                />
                <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "right", marginBottom: 10 }}>{msgTexto.length} caracteres</p>

                {/* Botón enviar — visible sin scroll */}
                <button onClick={() => enviarWAIndividual(selMiembro.tel, msgTexto.trim(), selMiembro.id)}
                  disabled={!msgTexto.trim()}
                  style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: msgTexto.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                    background: msgTexto.trim() ? "linear-gradient(135deg,#25d366,#128c7e)" : "rgba(255,255,255,.06)",
                    color: msgTexto.trim() ? "#fff" : "#4b4b6a",
                    boxShadow: msgTexto.trim() ? "0 4px 18px rgba(37,211,102,.35)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
                  <span style={{ fontSize: 18 }}>💬</span>
                  {msgTexto.trim() ? `Enviar a ${selNombre1} por WhatsApp` : "Escribe o elige un mensaje"}
                </button>

                {/* ── Mis mensajes guardados (4 slots) ── */}
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>💾 Mis mensajes guardados</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                  {[0,1,2,3].map(i => {
                    const slot = tplsCustom[i] || { icon: "⭐", label: "", msg: "" };
                    return (
                      <PlantillaCustom
                        key={i}
                        index={i}
                        tpl={slot}
                        nombreMiembro={selNombre1}
                        gymNom={gymNom}
                        onUsar={(msg) => setMsgTexto(msg)}
                        onGuardar={async (nueva) => {
                          const nuevas = [...tplsCustom];
                          while (nuevas.length <= i) nuevas.push({ icon: "⭐", label: "", msg: "" });
                          nuevas[i] = nueva;
                          await onUpdatePlantillas(nuevas);
                        }}
                      />
                    );
                  })}
                </div>

                {/* ── Plantillas rápidas (colapsable) ── */}
                <details style={{ marginBottom: 14 }}>
                  <summary style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                    <span>⚡ Plantillas rápidas</span>
                    <span style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 400, marginLeft: "auto" }}>toca para ver ›</span>
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {tplsFijas.map((tpl, i) => {
                      const msgPersonal = `Hola ${selNombre1}! ` + tpl.msg;
                      return (
                        <button key={i} onClick={() => setMsgTexto(msgPersonal)}
                          style={{ background: msgTexto === msgPersonal ? "rgba(37,211,102,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${msgTexto === msgPersonal ? "rgba(37,211,102,.3)" : "rgba(255,255,255,.08)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all .2s" }}>
                          <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                          <span style={{ color: msgTexto === msgPersonal ? "#4ade80" : "#9ca3af", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.label}</span>
                          {msgTexto === msgPersonal && <span style={{ color: "#4ade80" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </details>
              </>
            )}
          </>
        )}

        {/* ════ MODO: MASIVO ════ */}
        {modo === "masivo" && (
          <>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Mensaje para todos</p>
            <textarea
              value={msgTexto}
              onChange={e => setMsgTexto(e.target.value)}
              placeholder={`Ej: Hola, la clase de hoy fue cancelada. Disculpen 🙏 — ${gymNom}`}
              rows={5}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 6 }}
            />
            <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "right", marginBottom: 12 }}>{msgTexto.length} caracteres</p>

            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Plantillas rápidas</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {tplsFijas.map((tpl, i) => (
                <button key={i} onClick={() => setMsgTexto(tpl.msg)}
                  style={{ background: msgTexto === tpl.msg ? "rgba(37,211,102,.1)" : "rgba(255,255,255,.04)", border: `1px solid ${msgTexto === tpl.msg ? "rgba(37,211,102,.3)" : "rgba(255,255,255,.08)"}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all .2s" }}>
                  <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                  <span style={{ color: msgTexto === tpl.msg ? "#4ade80" : "#9ca3af", fontSize: 12, fontWeight: 600, flex: 1 }}>{tpl.label}</span>
                  {msgTexto === tpl.msg && <span style={{ color: "#4ade80" }}>✓</span>}
                </button>
              ))}
            </div>

            {msgTexto.trim() && (
              <>
                {/* Destinatarios */}
                <div style={{ background: "rgba(37,211,102,.06)", border: "1px solid rgba(37,211,102,.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                  <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Destinatarios ({destMasivo.length})</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {destMasivo.map(mb => (
                      <div key={mb.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", borderRadius: 20, padding: "4px 10px 4px 4px" }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                          {mb.foto ? <img src={mb.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mb.nombre.charAt(0)}
                        </div>
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>{mb.nombre.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copiar mensaje */}
                <div style={{ background: "rgba(255,255,255,.04)", border: copiadoMsg ? "1px solid rgba(37,211,102,.4)" : "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 14, marginBottom: 8, transition: "border .3s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: copiadoMsg ? "rgba(37,211,102,.2)" : "rgba(255,255,255,.1)", color: copiadoMsg ? "#4ade80" : "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{copiadoMsg ? "✓" : "1"}</span>
                      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Copia el mensaje</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(msgTexto); setCopiadoMsg(true); }}
                      style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: copiadoMsg ? "rgba(37,211,102,.2)" : "linear-gradient(135deg,#6c63ff,#e040fb)", color: copiadoMsg ? "#4ade80" : "#fff" }}>
                      {copiadoMsg ? "✓ Copiado" : "📋 Copiar"}
                    </button>
                  </div>
                </div>

                {/* Copiar números */}
                <div style={{ background: "rgba(255,255,255,.04)", border: copiadoNums ? "1px solid rgba(37,211,102,.4)" : "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: 14, marginBottom: 8, transition: "border .3s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: copiadoNums ? "rgba(37,211,102,.2)" : "rgba(255,255,255,.1)", color: copiadoNums ? "#4ade80" : "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{copiadoNums ? "✓" : "2"}</span>
                      <div>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Copia los números</p>
                        <p style={{ color: "#4b4b6a", fontSize: 10, marginTop: 2 }}>{destMasivo.length} contactos</p>
                      </div>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(destMasivo.map(mb => mb.tel.replace(/\D/g,"")).join("\n")); setCopiadoNums(true); }}
                      style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: copiadoNums ? "rgba(37,211,102,.2)" : "linear-gradient(135deg,#6c63ff,#e040fb)", color: copiadoNums ? "#4ade80" : "#fff" }}>
                      {copiadoNums ? "✓ Copiados" : "📋 Copiar"}
                    </button>
                  </div>
                </div>

                {/* Instrucción */}
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                  <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>3️⃣ Abre WhatsApp</p>
                  <p style={{ color: "#4b4b6a", fontSize: 11, lineHeight: 1.5 }}>Nueva lista de difusión → pega los números → pega el mensaje. Llega como mensaje privado a cada uno.</p>
                </div>

                <button onClick={() => window.open("https://wa.me", "_blank")}
                  style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff", boxShadow: "0 4px 18px rgba(37,211,102,.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>💬</span> Abrir WhatsApp
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Redimensiona y comprime imagen a máx 300x300 ──
function resizeImage(dataUrl, maxSize = 300, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
      else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

/* ─── PHOTO CAPTURE MODAL ─── */
function PhotoModal({ onClose, onCapture }) {
  const [mode, setMode] = useState(null); // null | "camera" | "preview"
  const [preview, setPreview] = useState(null);
  const videoRef = { current: null };
  const streamRef = { current: null };

  const startCamera = async () => {
    setMode("camera");
    setTimeout(async () => {
      try {
        const vid = document.getElementById("gymfit-video");
        if (!vid) return;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        streamRef.current = stream;
        vid.srcObject = stream;
        vid.play();
      } catch (e) {
        alert("No se pudo acceder a la cámara. Verifica los permisos.");
        setMode(null);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = async () => {
    const vid = document.getElementById("gymfit-video");
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 320;
    canvas.height = vid.videoHeight || 320;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    const raw = canvas.toDataURL("image/jpeg", 1.0);
    const dataUrl = await resizeImage(raw, 300, 0.75);
    stopCamera();
    setPreview(dataUrl);
    setMode("preview");
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const resized = await resizeImage(ev.target.result, 300, 0.75);
      setPreview(resized);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = () => { stopCamera(); onCapture(preview); onClose(); };
  const handleClose = () => { stopCamera(); onClose(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(12px)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", background: "#191928", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>📸 Foto del miembro</h2>
          <button onClick={handleClose} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Initial choice */}
        {mode === null && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={startCamera} style={{ background: "rgba(108,99,255,.15)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 18, padding: "24px 0", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 32 }}>📷</span>
              <span style={{ color: "#a78bfa", fontSize: 13, fontWeight: 700 }}>Tomar foto</span>
              <span style={{ color: "#4b4b6a", fontSize: 10 }}>Usar cámara</span>
            </button>
            <label style={{ background: "rgba(34,211,238,.1)", border: "1px solid rgba(34,211,238,.25)", borderRadius: 18, padding: "24px 0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <input type="file" accept="image/*" onChange={handleFileInput} style={{ display: "none" }} />
              <span style={{ fontSize: 32 }}>🖼️</span>
              <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 700 }}>Galería</span>
              <span style={{ color: "#4b4b6a", fontSize: 10 }}>Elegir imagen</span>
            </label>
          </div>
        )}

        {/* Camera view */}
        {mode === "camera" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 260, height: 260, borderRadius: 20, overflow: "hidden", border: "2px solid rgba(108,99,255,.4)", background: "#000", position: "relative" }}>
              <video id="gymfit-video" autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, border: "3px solid rgba(108,99,255,.5)", borderRadius: 18, pointerEvents: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => { stopCamera(); setMode(null); }} style={{ padding: "11px 20px", border: "1.5px solid #6b7280", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#6b7280", fontSize: 13, fontWeight: 700 }}>Cancelar</button>
              <button onClick={takePhoto} style={{ padding: "11px 28px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(108,99,255,.4)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>⊙</span> Capturar
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {mode === "preview" && preview && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden", border: "3px solid rgba(108,99,255,.5)", boxShadow: "0 0 0 6px rgba(108,99,255,.12)" }}>
              <img src={preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <p style={{ color: "#4b4b6a", fontSize: 12 }}>¿Se ve bien la foto?</p>
            <div style={{ display: "flex", gap: 12, width: "100%" }}>
              <button onClick={() => { setPreview(null); setMode(null); }} style={{ flex: 1, padding: "12px", border: "1.5px solid #6b7280", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#6b7280", fontSize: 13, fontWeight: 700 }}>Repetir</button>
              <button onClick={handleConfirm} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff", fontSize: 13, fontWeight: 700, boxShadow: "0 4px 16px rgba(108,99,255,.4)" }}>Guardar ✓</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── NOTAS INTERNAS ─── */
function NotasSection({ m, onSave }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(m.notas || "");
  const guardar = () => { onSave({ ...m, notas: texto }); setEditando(false); };
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>📝 Notas internas</p>
        {!editando
          ? <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Editar</button>
          : <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setTexto(m.notas || ""); setEditando(false); }} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={guardar} style={{ background: "rgba(167,139,250,.2)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 8, color: "#a78bfa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "3px 10px" }}>Guardar</button>
            </div>
        }
      </div>
      {editando ? (
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} placeholder={"Ej: Tiene lesión de rodilla. Paga los viernes. Familiar del dueño."} style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(167,139,250,.25)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6 }} />
      ) : m.notas ? (
        <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 14px" }}>
          <p style={{ color: "#d1d5db", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.notas}</p>
        </div>
      ) : (
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px dashed rgba(255,255,255,.08)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
          <p style={{ color: "#4b4b6a", fontSize: 12 }}>Sin notas — toca "+ Editar" para agregar</p>
        </div>
      )}
    </div>
  );
}

/* ─── MODAL CONGELAMIENTO ─── */
function CongelarModal({ m, onClose, onConfirm }) {
  const [modo, setModo] = useState("manual"); // "manual" | "fecha"
  const [fechaDesc, setFechaDesc] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#1a1a2e", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, border: "1px solid rgba(96,165,250,.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>🧊</p>
          <h3 style={{ color: "#60a5fa", fontSize: 16, fontWeight: 700 }}>Congelar membresía</h3>
          <p style={{ color: "#4b4b6a", fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>Los días congelados se suman automáticamente al vencimiento cuando se descongele.</p>
        </div>
        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>¿Cómo se descongela?</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ val: "manual", label: "✋ Manualmente", desc: "Tú la descongelas cuando quieras" }, { val: "fecha", label: "📅 Con fecha", desc: "Se descongela automáticamente" }].map(op => (
            <button key={op.val} onClick={() => setModo(op.val)} style={{ flex: 1, padding: "10px 8px", border: modo === op.val ? "2px solid #60a5fa" : "1.5px solid rgba(255,255,255,.08)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: modo === op.val ? "rgba(96,165,250,.1)" : "rgba(255,255,255,.04)", textAlign: "center" }}>
              <p style={{ color: modo === op.val ? "#60a5fa" : "#6b7280", fontSize: 11, fontWeight: 700 }}>{op.label}</p>
              <p style={{ color: "#4b4b6a", fontSize: 9, marginTop: 3, lineHeight: 1.4 }}>{op.desc}</p>
            </button>
          ))}
        </div>
        {modo === "fecha" && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Fecha de regreso</p>
            <input type="date" value={fechaDesc} min={new Date().toISOString().split("T")[0]} onChange={e => setFechaDesc(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 12, padding: "12px 14px", color: fechaDesc ? "#fff" : "#3d3d5c", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn full outline color="#6b7280" onClick={onClose}>Cancelar</Btn>
          <Btn full color="#60a5fa" onClick={() => onConfirm(modo === "fecha" ? fechaDesc : null)}>🧊 Congelar</Btn>
        </div>
      </div>
    </div>
  );
}

/* ─── CONFIRM DELETE INPUT ─── */
function ConfirmDeleteInput({ nombre, onConfirm, onCancel }) {
  const [val, setVal] = useState("");
  const ok = val.trim().toUpperCase() === "ELIMINAR";
  return (
    <div>
      <input value={val} onChange={e => setVal(e.target.value)}
        placeholder="Escribe ELIMINAR"
        style={{ width: "100%", background: "rgba(255,255,255,.07)", border: `1px solid ${ok ? "rgba(244,63,94,.6)" : "rgba(255,255,255,.1)"}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#6b7280" }}>
          Cancelar
        </button>
        <button onClick={onConfirm} disabled={!ok}
          style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: ok ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
            background: ok ? "#f43f5e" : "rgba(244,63,94,.15)", color: ok ? "#fff" : "rgba(244,63,94,.4)" }}>
          🗑️ Eliminar definitivamente
        </button>
      </div>
    </div>
  );
}

/* ─── GUARDAR EN SLOT ─── */
function GuardarEnSlot({ tpl, tplsCustom, onGuardar }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(p => !p)}
        title="Guardar en mis mensajes"
        style={{ width: 36, height: 36, border: "1px solid rgba(108,99,255,.3)", borderRadius: 10, background: open ? "rgba(108,99,255,.2)" : "transparent", cursor: "pointer", color: "#a78bfa", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        💾
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, zIndex: 50, background: "#1e1e30", border: "1px solid rgba(108,99,255,.3)", borderRadius: 14, padding: 10, width: 220, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
          <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4, marginBottom: 8 }}>Guardar en...</p>
          {tplsCustom.map((slot, i) => {
            const ocupado = slot.label.trim() || slot.msg.trim();
            return (
              <button key={i} onClick={() => { onGuardar(i); setOpen(false); }}
                style={{ width: "100%", padding: "9px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: "transparent", display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{ocupado ? "⭐" : "○"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: ocupado ? "#fff" : "#4b4b6a", fontSize: 12, fontWeight: ocupado ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {ocupado ? slot.label || `Mensaje ${i+1}` : `Slot ${i+1} — vacío`}
                  </p>
                  {ocupado && <p style={{ color: "#f59e0b", fontSize: 10, marginTop: 1 }}>⚠️ se sobreescribirá</p>}
                </div>
              </button>
            );
          })}
          <button onClick={() => setOpen(false)} style={{ width: "100%", padding: "7px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "rgba(255,255,255,.05)", color: "#6b7280", marginTop: 4 }}>Cancelar</button>
        </div>
      )}
    </div>
  );
}

/* ─── PLANTILLA PERSONALIZADA WA ─── */
function PlantillaCustom({ index, tpl, nombreMiembro, gymNom, onUsar, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ label: tpl.label, msg: tpl.msg });
  const [guardando, setGuardando] = useState(false);

  const tieneContenido = tpl.label.trim() || tpl.msg.trim();
  const msgFinal = (form.msg || "").replace(/\{nombre\}/g, nombreMiembro);

  const handleGuardar = async () => {
    setGuardando(true);
    await onGuardar({ icon: "⭐", label: form.label, msg: form.msg });
    setGuardando(false);
    setEditando(false);
  };

  if (editando) {
    return (
      <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.3)", borderRadius: 14, padding: 14 }}>
        <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Mensaje {index + 1}</p>
        <input
          value={form.label}
          onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
          placeholder="Nombre del mensaje (ej: Promoción diciembre)"
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 8 }}
        />
        <textarea
          value={form.msg}
          onChange={e => setForm(p => ({ ...p, msg: e.target.value }))}
          placeholder={`Escribe el mensaje. Usa {nombre} para incluir el nombre del miembro. Ej: Hola {nombre}, tenemos una promoción especial para ti 🎁 — ${gymNom}`}
          rows={4}
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 8 }}
        />
        {form.msg.trim() && (
          <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
            <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>Vista previa</p>
            <p style={{ color: "#9ca3af", fontSize: 12, lineHeight: 1.5 }}>{msgFinal}</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setEditando(false); setForm({ label: tpl.label, msg: tpl.msg }); }}
            style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#6b7280" }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!form.label.trim() || !form.msg.trim() || guardando}
            style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: form.label.trim() && form.msg.trim() ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.06)",
              color: form.label.trim() && form.msg.trim() ? "#fff" : "#4b4b6a" }}>
            {guardando ? "Guardando…" : "💾 Guardar"}
          </button>
        </div>
      </div>
    );
  }

  if (tieneContenido) {
    return (
      <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>⭐</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{tpl.label}</p>
          <p style={{ color: "#4b4b6a", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.msg}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => onUsar(tpl.msg.replace(/\{nombre\}/g, nombreMiembro), tpl.label)}
            style={{ padding: "6px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#25d366,#128c7e)", color: "#fff" }}>
            Usar
          </button>
          <button onClick={() => { setForm({ label: tpl.label, msg: tpl.msg }); setEditando(true); }}
            style={{ padding: "6px 10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 11, background: "transparent", color: "#6b7280" }}>
            ✏️
          </button>
        </div>
      </div>
    );
  }

  // Slot vacío
  return (
    <button onClick={() => { setForm({ label: "", msg: "" }); setEditando(true); }}
      style={{ width: "100%", padding: "12px 14px", border: "1px dashed rgba(108,99,255,.3)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: "transparent", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 16, color: "#6c63ff" }}>＋</span>
      <span style={{ color: "#4b4b6a", fontSize: 12 }}>Mensaje guardado {index + 1} — toca para crear</span>
    </button>
  );
}

/* ─── MEMBER DETAIL MODAL ─── */
function MemberDetailModal({ m, txs, onClose, onSave, onToggleEstado, onAddPago, onDone, planesActivos, planPrecioActivo, onEditTx, gymConfig, onUpdatePlantillas, onDelete, onGoToMensajes }) {
  const [detTab, setDetTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const memInfo = getMembershipInfo(m.id, txs, m);
  const [form, setForm] = useState({ nombre: m.nombre, tel: m.tel || "", fecha_incorporacion: m.fecha_incorporacion || "", sexo: m.sexo || "", fecha_nacimiento: m.fecha_nacimiento || "" });
  const [pagoModal, setPagoModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false); // paso 1: pedir confirmación
  const [confirmDelete2, setConfirmDelete2] = useState(false); // paso 2: confirmación final
  useEffect(() => {
    const handler = e => { if (e.detail === m.id) { setDetTab("historial"); setPagoModal(true); } };
    document.addEventListener("openPagoModal", handler);
    return () => document.removeEventListener("openPagoModal", handler);
  }, [m.id]);
  const [photoModal, setPhotoModal] = useState(false);
  const [renovarModal, setRenovarModal] = useState(false);
  const [congelarModal, setCongelarModal] = useState(false);
  const [cobrarModal, setCobrarModal] = useState(false);
  const [cobro, setCobro] = useState({ tipo: "", desc: "", monto: "", fecha: todayISO(), formaPago: "Efectivo" });
  const [mensajeOrigen, setMensajeOrigen] = useState(null); // { label, msgBase } de la plantilla cargada
  const defaultPlan = memInfo.plan || (planesActivos && planesActivos[0]) || "Mensual";
  const defaultMonto = memInfo.monto || (planPrecioActivo && planPrecioActivo[defaultPlan]) || (PLAN_PRECIO && PLAN_PRECIO[defaultPlan]) || "";
  const [renovar, setRenovar] = useState({ plan: defaultPlan, monto: String(defaultMonto), inicio: todayISO(), vence: calcVence(todayISO(), defaultPlan), venceManual: false, formaPago: "Efectivo" });
  const [pago, setPago] = useState({ monto: String(defaultMonto), desc: "", fecha: todayISO() });

  const historial = txs.filter(t => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const diasCumple = diasParaCumple(m.fecha_nacimiento);
  const edad = calcEdad(m.fecha_nacimiento);

  const hasChanges = form.nombre !== m.nombre || form.tel !== (m.tel || "") || form.fecha_incorporacion !== (m.fecha_incorporacion || "") || form.sexo !== (m.sexo || "") || form.fecha_nacimiento !== (m.fecha_nacimiento || "");
  const handleSave = () => {
    if (!hasChanges) return;
    onSave({ ...m, nombre: form.nombre, tel: form.tel, fecha_incorporacion: form.fecha_incorporacion, sexo: form.sexo, fecha_nacimiento: form.fecha_nacimiento });
    setEditing(false);
  };

  const handleAddPago = () => {
    if (!pago.desc.trim()) { alert("Agrega una descripción"); return; }
    if (!pago.monto || Number(pago.monto) <= 0) { alert("El monto debe ser mayor a 0"); return; }
    const descText = pago.desc.trim();
    const fechaPago = fmtDate(pago.fecha) || today();
    onAddPago({ id: uid(), tipo: "ingreso", categoria: "Membresías", desc: descText, descripcion: descText, monto: Number(pago.monto), fecha: fechaPago, miembroId: m.id });
    setPagoModal(false);
    setPago({ monto: String(defaultMonto), desc: "", fecha: todayISO() });
  };

  const handlePhoto = (dataUrl) => {
    onSave({ ...m, foto: dataUrl });
  };

  const handleRenovar = async () => {
    if (!renovar.inicio) return;
    const montoPagado = Number(renovar.monto) || 0;
    // Guardar fecha en formato ISO para que getMembershipInfo pueda parsearla correctamente
    const fechaISO = renovar.inicio; // ya es ISO: "2026-03-10"
    const venceISO = renovar.vence;  // también ISO: "2026-04-10"
    const descText = `Renovación ${renovar.plan} - ${m.nombre} [${renovar.formaPago || "Efectivo"}]${venceISO ? ` (vence:${venceISO})` : ""}`;
    await onAddPago({ id: uid(), tipo: "ingreso", categoria: "Membresías",
      desc: descText, descripcion: descText,
      monto: montoPagado, fecha: fechaISO, miembroId: m.id,
      vence_manual: venceISO || null });
    setRenovarModal(false);
    // Quedarse en el perfil en lugar de ir al dashboard
    setRenovarModal(false);
  };

  // WA quick send from profile
  const diasRestantes = diasParaVencer(memInfo.vence);
  const waUmbral = diasRestantes !== null && diasRestantes <= 5 && diasRestantes >= 0
    ? (diasRestantes <= 1 ? 1 : diasRestantes <= 3 ? 3 : 5)
    : null;

  return (
    <Modal title="Perfil del miembro" onClose={onClose}>
      {photoModal && <PhotoModal onClose={() => setPhotoModal(false)} onCapture={handlePhoto} />}
      {congelarModal && <CongelarModal m={m} onClose={() => setCongelarModal(false)} onConfirm={(fechaDesc) => {
        const now = new Date();
        const hoyISO = now.toISOString().split("T")[0];
        // Calculate days already frozen (if was previously frozen)
        const diasPrevios = m.dias_congelados || 0;
        const today_ = new Date().toISOString().split("T")[0];
        const updated = { ...m, congelado: true, fecha_descongelar: fechaDesc || null, dias_congelados: diasPrevios, fecha_congelado: today_ };
        onSave(updated);
        setCongelarModal(false);
      }} />}

      {cobrarModal && (() => {
        const TIPOS_COBRO = [
          { val: "clase",    icon: "🏋️", label: "Clase suelta",    cat: "Clases extras",  placeholder: "Drop-in, clase especial..." },
          { val: "producto", icon: "🛍️", label: "Producto",        cat: "Otro",           placeholder: "Suplemento, botella, ropa..." },
          { val: "servicio", icon: "⭐", label: "Servicio extra",  cat: "Clases extras",  placeholder: "Clase personal, nutrición..." },
          { val: "libre",    icon: "✏️", label: "Personalizado",   cat: "Otro",           placeholder: "Describe el cobro..." },
        ];
        const tipoInfo = TIPOS_COBRO.find(t => t.val === cobro.tipo);
        const handleCobrar = async () => {
          if (!cobro.monto || !cobro.tipo) return;
          const desc = cobro.desc.trim() || (tipoInfo?.label + " - " + m.nombre);
          const cat = tipoInfo?.cat || "Otro";
          await onAddPago({ id: uid(), tipo: "ingreso", categoria: cat, desc, descripcion: desc, monto: Number(cobro.monto), fecha: cobro.fecha, miembroId: m.id });
          setCobrarModal(false);
        };
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", background: "#1a1a2e", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease", maxHeight: "90%", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>💰 Cobrar a {m.nombre.split(" ")[0]}</h2>
                <button onClick={() => setCobrarModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>

              {/* Tipo de cobro */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Tipo de cobro</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {TIPOS_COBRO.map(t => (
                  <button key={t.val} onClick={() => setCobro(p => ({ ...p, tipo: t.val, desc: "" }))}
                    style={{ padding: "12px 10px", border: cobro.tipo === t.val ? "2px solid #4ade80" : "1.5px solid rgba(255,255,255,.08)", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: cobro.tipo === t.val ? "rgba(74,222,128,.1)" : "rgba(255,255,255,.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "all .2s" }}>
                    <span style={{ fontSize: 22 }}>{t.icon}</span>
                    <span style={{ color: cobro.tipo === t.val ? "#4ade80" : "#9ca3af", fontSize: 11, fontWeight: 700, textAlign: "center" }}>{t.label}</span>
                  </button>
                ))}
              </div>

              {cobro.tipo && (<>
                {/* Descripción */}
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Descripción <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>(opcional)</span></p>
                <input value={cobro.desc} onChange={e => setCobro(p => ({ ...p, desc: e.target.value }))}
                  placeholder={tipoInfo?.placeholder}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14 }} />

                {/* Monto */}
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Monto ($)</p>
                <input type="number" value={cobro.monto} onChange={e => setCobro(p => ({ ...p, monto: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 16, fontFamily: "inherit", outline: "none", marginBottom: 14 }} />

                {/* Fecha */}
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>Fecha</p>
                <input type="date" value={cobro.fecha} onChange={e => setCobro(p => ({ ...p, fecha: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 14 }} />

                {/* Forma de pago */}
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Forma de pago</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {[{ val: "Efectivo", icon: "💵" }, { val: "Transferencia", icon: "📲" }, { val: "Tarjeta", icon: "💳" }].map(op => (
                    <button key={op.val} onClick={() => setCobro(p => ({ ...p, formaPago: op.val }))}
                      style={{ flex: 1, padding: "10px 4px", border: cobro.formaPago === op.val ? "2px solid #a78bfa" : "1.5px solid rgba(255,255,255,.08)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: cobro.formaPago === op.val ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.04)", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 18 }}>{op.icon}</span>
                      <span style={{ color: cobro.formaPago === op.val ? "#a78bfa" : "#6b7280", fontSize: 10, fontWeight: 700 }}>{op.val}</span>
                    </button>
                  ))}
                </div>

                <button onClick={handleCobrar} disabled={!cobro.monto}
                  style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: cobro.monto ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 14, fontWeight: 700, background: cobro.monto ? "linear-gradient(135deg,#4ade80,#22c55e)" : "rgba(255,255,255,.06)", color: cobro.monto ? "#000" : "#4b4b6a", boxShadow: cobro.monto ? "0 4px 18px rgba(74,222,128,.35)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}>
                  <span style={{ fontSize: 18 }}>💰</span> Registrar cobro
                </button>
              </>)}
            </div>
          </div>
        );
      })()}

      {renovarModal && (() => {
        const esPrimeraMembresía = !txs.some(t => t.categoria === "Membresías" && (String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)));
        const esMesPasado = renovar.inicio && renovar.inicio < todayISO().slice(0, 7);
        return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: "#1a1a2e", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>🔄 {esPrimeraMembresía ? "Registrar membresía" : "Renovar membresía"}</h2>
              <button onClick={() => setRenovarModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 12 }}>
              {esPrimeraMembresía
                ? "Primera membresía — puedes registrar una fecha de inicio pasada para reflejar el historial real del miembro."
                : (() => {
                    const dias = diasParaVencer(m.vence);
                    return dias !== null && dias > 0
                      ? `¡Le quedan ${dias} día${dias !== 1 ? "s" : ""} a la membresía actual! El inicio sugerido es desde su fecha de vencimiento.`
                      : "La membresía está vencida. El inicio sugerido es hoy.";
                  })()
              }
            </p>
            {esPrimeraMembresía && (
              <div style={{ background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>💡</span>
                <p style={{ color: "#a78bfa", fontSize: 11 }}>El pago quedará registrado en el mes de la fecha de inicio que elijas.</p>
              </div>
            )}
            {esMesPasado && (
              <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 16 }}>📅</span>
                <p style={{ color: "#f59e0b", fontSize: 11 }}>Estás registrando en un <strong>mes pasado</strong> — el movimiento aparecerá en el historial de {new Date(renovar.inicio + "T00:00:00").toLocaleString("es-MX", { month: "long", year: "numeric" })}.</p>
              </div>
            )}
            <Inp label="Plan" value={renovar.plan} onChange={v => setRenovar(p => ({ ...p, plan: v, monto: String((planPrecioActivo || PLAN_PRECIO_ACTIVO || {})[v] || PLAN_PRECIO[v] || p.monto), vence: p.venceManual ? p.vence : calcVence(p.inicio, v) }))} options={planesActivos || PLANES_ACTIVOS} />
            <Inp label="Monto ($)" type="number" value={renovar.monto} onChange={v => setRenovar(p => ({ ...p, monto: v }))} placeholder="0.00" />

            {/* Forma de pago */}
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Forma de pago</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { val: "Efectivo", icon: "💵" },
                { val: "Transferencia", icon: "📲" },
                { val: "Tarjeta", icon: "💳" },
              ].map(op => (
                <button key={op.val} onClick={() => setRenovar(p => ({ ...p, formaPago: op.val }))}
                  style={{ flex: 1, padding: "10px 4px", border: renovar.formaPago === op.val ? "2px solid #a78bfa" : "1.5px solid rgba(255,255,255,.08)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: renovar.formaPago === op.val ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.04)", transition: "all .2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 18 }}>{op.icon}</span>
                  <span style={{ color: renovar.formaPago === op.val ? "#a78bfa" : "#6b7280", fontSize: 10, fontWeight: 700 }}>{op.val}</span>
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Inicio</p>
                <input type="date" value={renovar.inicio}
                  onChange={e => {
                    const v = e.target.value;
                    // Primera membresía: permite pasado. Renovación: solo hoy o futuro
                    if (!esPrimeraMembresía && v < todayISO()) return;
                    setRenovar(p => ({ ...p, inicio: v, vence: p.venceManual ? p.vence : calcVence(v, p.plan) }));
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: `1px solid ${esMesPasado ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.15)"}`, borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12 }} />
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Vencimiento</p>
                <input type="date" value={renovar.vence} min={renovar.inicio}
                  onChange={e => {
                    const v = e.target.value;
                    if (v < renovar.inicio) return;
                    setRenovar(p => ({ ...p, vence: v, venceManual: true }));
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12 }} />
              </div>
            </div>
            <div style={{ background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 14, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#4b4b6a", fontSize: 12 }}>Duración</span>
              <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 700 }}>
                {(() => {
                  if (!renovar.inicio || !renovar.vence) return "—";
                  // Parse local dates to avoid timezone bug
                  const [vy,vm,vd] = renovar.vence.split("-").map(Number);
                  const [iy,im,id2] = renovar.inicio.split("-").map(Number);
                  const dv = new Date(vy, vm-1, vd);
                  const di = new Date(iy, im-1, id2);
                  const diff = Math.round((dv - di) / (1000*60*60*24));
                  return diff > 0 ? `${diff} días` : "Fecha inválida";
                })()}
              </span>
            </div>
            <button onClick={handleRenovar} style={{
              width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: "linear-gradient(135deg,#22d3ee,#06b6d4)",
              color: "#fff", boxShadow: "0 4px 18px rgba(34,211,238,.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}>
              <span style={{ fontSize: 18 }}>🔄</span> {esPrimeraMembresía ? "Registrar membresía" : "Confirmar renovación"}
            </button>
          </div>
        </div>
        );
      })()}

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        {/* Avatar with photo or initials */}
        <div style={{ position: "relative", width: 96, margin: "0 auto 12px" }}>
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: m.estado === "Activo" ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "linear-gradient(135deg,#f43f5e,#fb923c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34, color: "#fff", fontWeight: 700, overflow: "hidden",
            boxShadow: m.foto ? "0 0 0 3px rgba(108,99,255,.5)" : "none"
          }}>
            {m.foto
              ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : m.nombre.charAt(0)
            }
          </div>
          {/* Camera button overlay */}
          <button
            onClick={() => setPhotoModal(true)}
            style={{
              position: "absolute", bottom: -4, right: -4,
              width: 30, height: 30, borderRadius: 10,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)",
              border: "2px solid #191928",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, boxShadow: "0 2px 8px rgba(108,99,255,.5)"
            }}>
            📷
          </button>
        </div>

        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{m.nombre}</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginTop: 8 }}>
          <span style={{ background: memInfo.estado === "Activo" ? "rgba(74,222,128,.15)" : memInfo.estado === "Congelado" ? "rgba(96,165,250,.15)" : memInfo.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)", color: memInfo.estado === "Activo" ? "#4ade80" : memInfo.estado === "Congelado" ? "#60a5fa" : memInfo.estado === "Sin membresía" ? "#6b7280" : "#f87171", borderRadius: 10, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>{memInfo.estado === "Congelado" ? "🧊 Congelado" : memInfo.estado}</span>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 500 }}>
            {memInfo.estado === "Congelado" ? `🧊 Congelado — vence ${memInfo.vence}` : memInfo.estado === "Activo" ? `Activo hasta ${memInfo.vence}` : memInfo.estado === "Sin membresía" ? "Sin membresía registrada" : `Vencido desde ${memInfo.vence}`}
          </span>
        </div>

        {/* Botón WhatsApp siempre visible si tiene tel */}
        {m.tel && onGoToMensajes && (
          <button
            onClick={() => onGoToMensajes(m)}
            style={{
              marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 20, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg,#25d366,#128c7e)",
              color: "#fff", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 3px 12px rgba(37,211,102,.35)"
            }}>
            <span>💬</span> Enviar mensaje WA
          </button>
        )}
        {/* WA quick reminder badge — abre pantalla mensajes */}
        {waUmbral !== null && m.tel && onGoToMensajes && (
          <button
            onClick={() => onGoToMensajes(m)}
            style={{
              marginTop: 10, padding: "8px 16px", border: "none", borderRadius: 20, cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: "linear-gradient(135deg,#25d366,#128c7e)",
              color: "#fff", display: "inline-flex", alignItems: "center", gap: 6,
              boxShadow: "0 3px 12px rgba(37,211,102,.35)"
            }}>
            <span>💬</span>
            Enviar recordatorio WA ({diasRestantes === 0 ? "hoy" : diasRestantes === 1 ? "mañana" : `${diasRestantes} días`})
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4, marginBottom: 18 }}>
        {[{ k: "perfil", label: "📋 Perfil" }, { k: "historial", label: "💳 Historial" }].map(t => (
          <button key={t.k} onClick={() => setDetTab(t.k)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", background: detTab === t.k ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "transparent", color: detTab === t.k ? "#fff" : "#4b4b6a", fontSize: 12, fontWeight: detTab === t.k ? 700 : 500, boxShadow: detTab === t.k ? "0 2px 12px rgba(108,99,255,.4)" : "none", transition: "all .2s" }}>{t.label}</button>
        ))}
      </div>

      {detTab === "perfil" && (
        <>
          {editing ? (
            <>
              {/* ── Sección: Datos personales ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Datos personales</p>
              <Inp label="Nombre" value={form.nombre} onChange={v => setForm(p => ({ ...p, nombre: v }))} placeholder="Nombre completo" />
              <Inp label="Teléfono" value={form.tel} onChange={v => setForm(p => ({ ...p, tel: v }))} placeholder="999 000 0000" type="tel" />
              {/* Fecha de incorporación */}
              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>Fecha de incorporación</p>
              <input type="date" value={form.fecha_incorporacion} onChange={e => setForm(p => ({ ...p, fecha_incorporacion: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,.07)", border: `1px solid ${form.fecha_incorporacion ? "rgba(255,255,255,.1)" : "rgba(245,158,11,.4)"}`, borderRadius: 12, padding: "12px 14px", color: form.fecha_incorporacion ? "#fff" : "#3d3d5c", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: form.fecha_incorporacion ? 12 : 6 }} />
              {!form.fecha_incorporacion && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>⚠️ Sin fecha de incorporación — agrégala para no confundir con otras fechas</p>
              )}
              {/* Sexo selector */}
              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Sexo</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[{ val: "Masculino", icon: "♂️", color: "#60a5fa" }, { val: "Femenino", icon: "♀️", color: "#f472b6" }, { val: "", icon: "—", color: "#6b7280" }].map(op => (
                  <button key={op.val} onClick={() => setForm(p => ({ ...p, sexo: op.val }))}
                    style={{ flex: 1, padding: "10px 0", border: form.sexo === op.val ? `2px solid ${op.color}` : "1.5px solid rgba(255,255,255,.08)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: form.sexo === op.val ? `${op.color}20` : "rgba(255,255,255,.04)", color: form.sexo === op.val ? op.color : "#4b4b6a", fontSize: 12, fontWeight: 700, transition: "all .2s" }}>
                    <div style={{ fontSize: 16, marginBottom: 2 }}>{op.icon}</div>
                    {op.val || "N/E"}
                  </button>
                ))}
              </div>
              {/* Fecha de nacimiento */}
              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>Fecha de nacimiento</p>
              <input type="date" value={form.fecha_nacimiento} onChange={e => setForm(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,.07)", border: `1px solid ${form.fecha_nacimiento ? "rgba(255,255,255,.1)" : "rgba(245,158,11,.4)"}`, borderRadius: 12, padding: "12px 14px", color: form.fecha_nacimiento ? "#fff" : "#3d3d5c", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: form.fecha_nacimiento ? 12 : 6 }} />
              {!form.fecha_nacimiento && (
                <p style={{ color: "#f59e0b", fontSize: 11, marginBottom: 12 }}>⚠️ Sin fecha de nacimiento — agrégala para ver cumpleaños</p>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Btn full outline color="#6b7280" onClick={() => setEditing(false)}>Cancelar</Btn>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges}
                  style={{
                    flex: 1, padding: "13px 20px", border: "none", borderRadius: 14, cursor: hasChanges ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                    background: hasChanges ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.06)",
                    color: hasChanges ? "#fff" : "#4b4b6a",
                    boxShadow: hasChanges ? "0 4px 18px rgba(108,99,255,.4)" : "none",
                    transition: "all .3s"
                  }}>
                  {hasChanges ? "Guardar ✓" : "Sin cambios"}
                </button>
              </div>

              {/* ── Eliminar miembro (solo visible en modo editar) ── */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)}
                    style={{ width: "100%", padding: "10px", border: "1px solid rgba(244,63,94,.2)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "rgba(244,63,94,.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    🗑️ Eliminar miembro
                  </button>
                ) : !confirmDelete2 ? (
                  <div style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 14, padding: 14 }}>
                    <p style={{ color: "#f43f5e", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>⚠️ ¿Eliminar a {m.nombre}?</p>
                    <p style={{ color: "#6b7280", fontSize: 11, marginBottom: 12 }}>Se borrarán también todas sus transacciones ({txs.filter(t => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length} movimiento{txs.filter(t => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).length !== 1 ? "s" : ""}). Esta acción no se puede deshacer.</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmDelete(false)}
                        style={{ flex: 1, padding: "10px", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: "transparent", color: "#6b7280" }}>Cancelar</button>
                      <button onClick={() => setConfirmDelete2(true)}
                        style={{ flex: 2, padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: "rgba(244,63,94,.2)", color: "#f43f5e" }}>Sí, eliminar todo</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(244,63,94,.12)", border: "2px solid rgba(244,63,94,.5)", borderRadius: 14, padding: 14 }}>
                    <p style={{ color: "#f43f5e", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🚨 Confirmación final</p>
                    <p style={{ color: "#9ca3af", fontSize: 11, marginBottom: 12 }}>Escribe <strong style={{color:"#f43f5e"}}>ELIMINAR</strong> para confirmar</p>
                    <ConfirmDeleteInput
                      nombre={m.nombre}
                      onConfirm={() => onDelete && onDelete(m.id)}
                      onCancel={() => { setConfirmDelete(false); setConfirmDelete2(false); }}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ── Banner cumpleaños ── */}
              {diasCumple !== null && diasCumple <= 7 && (
                <div style={{ background: diasCumple === 0 ? "linear-gradient(135deg,rgba(250,204,21,.2),rgba(234,179,8,.1))" : "rgba(250,204,21,.08)", border: `1px solid ${diasCumple === 0 ? "rgba(250,204,21,.5)" : "rgba(250,204,21,.2)"}`, borderRadius: 16, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>{diasCumple === 0 ? "🎂" : "🎁"}</span>
                  <div>
                    <p style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>
                      {diasCumple === 0 ? `¡Hoy es el cumpleaños de ${m.nombre.split(" ")[0]}! 🎉` : diasCumple === 1 ? `Mañana es el cumpleaños de ${m.nombre.split(" ")[0]}` : `Cumpleaños en ${diasCumple} días`}
                    </p>
                    {edad !== null && <p style={{ color: "#92400e", fontSize: 11, marginTop: 2 }}>{diasCumple === 0 ? `¡Cumple ${edad} años hoy!` : `Cumplirá ${edad + (diasCumple === 0 ? 0 : 1)} años`}</p>}
                  </div>
                </div>
              )}

              {/* ── Sección: Datos personales ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Datos personales</p>
              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {[
                  { label: "📱 Teléfono", val: m.tel || "—" },
                  {
                    label: "📆 Incorporación",
                    val: m.fecha_incorporacion || null,
                    custom: !m.fecha_incorporacion ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{fmtDate(m.fecha_incorporacion) || m.fecha_incorporacion}</span>
                    )
                  },
                  {
                    label: "⚧ Sexo",
                    val: m.sexo || null,
                    custom: !m.sexo ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: m.sexo === "Masculino" ? "#60a5fa" : "#f472b6", fontWeight: 700, fontSize: 13 }}>
                        {m.sexo === "Masculino" ? "♂️" : "♀️"} {m.sexo}
                      </span>
                    )
                  },
                  {
                    label: "🎂 Nacimiento",
                    val: m.fecha_nacimiento || null,
                    custom: !m.fecha_nacimiento ? (
                      <span style={{ background: "rgba(245,158,11,.15)", color: "#f59e0b", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>⚠️ Sin registrar</span>
                    ) : (
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
                        {fmtDate(m.fecha_nacimiento)}{edad !== null ? ` · ${edad} años` : ""}
                        {diasCumple !== null && diasCumple <= 30 && <span style={{ color: "#fbbf24", marginLeft: 6, fontSize: 11 }}>🎂 en {diasCumple}d</span>}
                      </span>
                    )
                  },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                    <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                    {row.custom || <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{row.val || "—"}</span>}
                  </div>
                ))}
              </div>

              {/* ── Sección: Membresía actual ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Membresía actual</p>

              {/* Banner congelado */}
              {memInfo.congelado && (
                <div style={{ background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 14, padding: "12px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🧊</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700 }}>Membresía congelada</p>
                    <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>
                      {memInfo.fechaDescongelar ? `Se descongela el ${fmtDate(memInfo.fechaDescongelar)}` : "Se descongela manualmente"}
                    </p>
                  </div>
                  <button onClick={() => {
                    // Calculate days frozen to add to membership
                    const inicioCongelado = m.fecha_congelado ? new Date(m.fecha_congelado + "T00:00:00") : null;
                    const hoy = new Date(); hoy.setHours(0,0,0,0);
                    const diasNuevos = inicioCongelado ? Math.round((hoy - inicioCongelado) / (1000*60*60*24)) : 0;
                    const updated = { ...m, congelado: false, fecha_descongelar: null, fecha_congelado: null, dias_congelados: (m.dias_congelados || 0) + diasNuevos };
                    onSave(updated);
                  }} style={{ background: "rgba(96,165,250,.2)", border: "1px solid rgba(96,165,250,.4)", borderRadius: 10, padding: "6px 12px", color: "#60a5fa", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Descongelar
                  </button>
                </div>
              )}


              {/* Banner cortesía */}
              {memInfo.esGratis && memInfo.estado !== "Sin membresía" && (
                <div style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 14, padding: "10px 16px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🎁</span>
                  <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700 }}>Membresía en cortesía (sin costo)</p>
                </div>
              )}

              <div style={{ background: memInfo.estado === "Activo" || memInfo.congelado ? "rgba(34,211,238,.05)" : "rgba(248,113,113,.05)", border: `1px solid ${memInfo.estado === "Activo" || memInfo.congelado ? "rgba(34,211,238,.15)" : "rgba(248,113,113,.15)"}`, borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {memInfo.estado !== "Sin membresía" ? (
                  [
                    { label: "📋 Plan", val: memInfo.plan || "—" },
                    { label: "📅 Inicio", val: memInfo.inicio || "—" },
                    { label: "⏰ Vence", val: memInfo.congelado ? `${memInfo.vence} (+congelado)` : memInfo.vence || "—" },
                    { label: "💰 Último pago", val: memInfo.esGratis ? "Cortesía 🎁" : (memInfo.monto ? `$${Number(memInfo.monto).toLocaleString("es-MX")}` : "—") },
                    ...(memInfo.formaPago ? [{ label: "💳 Forma de pago", val: memInfo.formaPago === "Efectivo" ? "💵 Efectivo" : memInfo.formaPago === "Transferencia" ? "📲 Transferencia" : "💳 Tarjeta" }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                      <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                      <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 600 }}>{row.val}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "18px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, marginBottom: 6 }}>📋</p>
                    <p style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>Sin membresía registrada</p>
                    <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 4 }}>Usa Renovar para registrar un nuevo pago</p>
                  </div>
                )}
              </div>

              {/* ── Notas internas ── */}
              <NotasSection m={m} onSave={onSave} />

              {/* ── Resumen financiero del mes activo ── */}
              {(() => {
                // Filtrar solo movimientos del mes de la membresía activa
                const inicioDate = memInfo.inicio ? parseDate(memInfo.inicio) : null;
                const mesActivo = inicioDate
                  ? historial.filter(t => {
                      const d = parseDate(t.fecha);
                      return d && d.getFullYear() === inicioDate.getFullYear() && d.getMonth() === inicioDate.getMonth();
                    })
                  : historial;
                const totalMes = mesActivo.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
                const mesLabel = inicioDate
                  ? `${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][inicioDate.getMonth()]} ${inicioDate.getFullYear()}`
                  : "Este mes";
                return (
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.15)", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Pagado {mesLabel}</p>
                      <p style={{ color: "#22d3ee", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>${totalMes.toLocaleString("es-MX")}</p>
                    </div>
                    <div style={{ flex: 1, background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.15)", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Movimientos</p>
                      <p style={{ color: "#a78bfa", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>{historial.length}</p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Botones de acción ── */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Btn full outline color="#a78bfa" onClick={() => setEditing(true)}>✏️ Editar</Btn>
                <Btn full onClick={() => {
                  const dias = diasParaVencer(memInfo.vence);
                  const venceISO = (() => {
                    const v = parseDate(memInfo.vence);
                    if (!v) return todayISO();
                    const d = v; d.setHours(0,0,0,0);
                    return d.toISOString().split("T")[0];
                  })();
                  const sugerido = (dias !== null && dias > 0) ? venceISO : todayISO();
                  setRenovar({ plan: memInfo.plan || defaultPlan, monto: String(memInfo.monto || (planPrecioActivo && planPrecioActivo[memInfo.plan || defaultPlan]) || defaultMonto || ""), inicio: sugerido, vence: calcVence(sugerido, memInfo.plan || defaultPlan) });
                  setRenovarModal(true);
                }} color="#22d3ee">🔄 Renovar</Btn>
              </div>
              <Btn full outline color="#4ade80" onClick={() => { setCobro({ tipo: "", desc: "", monto: "", fecha: todayISO(), formaPago: "Efectivo" }); setCobrarModal(true); }}>💰 + Cobrar</Btn>
              {/* Congelar: solo si hay membresía activa */}
              {memInfo.estado === "Activo" && !memInfo.congelado && (
                <Btn full outline color="#60a5fa" onClick={() => setCongelarModal(true)} style={{ marginTop: 8 }}>🧊 Congelar membresía</Btn>
              )}



            </>
          )}
        </>
      )}


            {detTab === "historial" && (
        <>
          {historial.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>💳</p>
              <p style={{ color: "#4b4b6a", fontSize: 13 }}>Sin movimientos registrados</p>
            </div>
          ) : (
            <div>
              {/* Movimientos agrupados por mes */}
              {(() => {
                const grupos = {};
                historial.forEach(t => {
                  const d = parseDate(t.fecha);
                  const key = d ? `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}` : "sin-fecha";
                  const label = d ? `${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][d.getMonth()]} ${d.getFullYear()}` : "Sin fecha";
                  if (!grupos[key]) grupos[key] = { label, txs: [] };
                  grupos[key].txs.push(t);
                });
                return Object.keys(grupos).sort((a,b) => b.localeCompare(a)).map(key => {
                  const g = grupos[key];
                  const totalMes = g.txs.filter(t => t.tipo === "ingreso").reduce((s,t) => s + Number(t.monto), 0);
                  return (
                    <div key={key} style={{ marginBottom: 20 }}>
                      {/* Header mes */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6 }}>{g.label}</p>
                        <p style={{ color: "#22d3ee", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>${totalMes.toLocaleString("es-MX")}</p>
                      </div>
                      {g.txs.map(t => {
                        const desc = t.desc || t.descripcion || "—";
                        const isIngreso = t.tipo === "ingreso";
                        const color = isIngreso ? "#22d3ee" : "#f43f5e";
                        const bgColor = isIngreso ? "rgba(34,211,238,.10)" : "rgba(244,63,94,.10)";
                        return (
                          <div key={t.id} className="rh" onClick={() => onEditTx && onEditTx(t)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 16, marginBottom: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                            <div style={{ width: 42, height: 42, borderRadius: "50%", fontSize: 18, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: `2px solid ${color}30` }}>
                              {isIngreso && m.foto
                                ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : CAT_ICON[t.categoria] || (isIngreso ? "💰" : "💸")}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{desc}</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                                <span style={{ background: bgColor, color, borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{t.categoria}</span>
                                <span style={{ color: "#4b4b6a", fontSize: 10 }}>· {t.fecha}</span>
                              </div>
                            </div>
                            <p style={{ color, fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                              {isIngreso ? "+" : "-"}{fmt(t.monto)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {pagoModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", background: "#1e1e30", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>💳 Registrar pago</h2>
                  <button onClick={() => setPagoModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <Inp label="Descripción" value={pago.desc} onChange={v => setPago(p => ({ ...p, desc: v }))} placeholder="Ej: Membresía mensual" />
                <Inp label="Monto ($)" type="number" value={pago.monto} onChange={v => setPago(p => ({ ...p, monto: v }))} placeholder="0.00" />
                <Inp label="Fecha" type="date" value={pago.fecha} onChange={v => setPago(p => ({ ...p, fecha: v }))} />
                <Btn full onClick={handleAddPago} color="#22d3ee">Guardar pago ✓</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ─── EDIT TRANSACTION MODAL ─── */
function EditTxModal({ tx, onClose, onSave, onDelete }) {
  const isGasto = tx.tipo === "gasto";
  const isMembresía = tx.categoria === "Membresías";
  const cats = isGasto ? CAT_GAS : CAT_ING;
  const color = isGasto ? "#f43f5e" : "#22d3ee";
  const desc = tx.desc || tx.descripcion || "";

  // Extraer vencimiento manual guardado en la descripción
  const venceManualDelDesc = (() => {
    // 1. Buscar patrón embebido en descripción
    const m = desc.match(/\(vence:(\d{4}-\d{2}-\d{2})\)/);
    if (m) return m[1];
    // 2. Campo vence_manual en la tx
    if (tx.vence_manual) return tx.vence_manual;
    // 3. Calcular desde fecha + plan si es membresía
    if (tx.categoria === "Membresías" && tx.fecha) {
      const fechaD = parseDate(tx.fecha);
      if (fechaD) {
        const planMatch = desc.match(/(Mensual|Trimestral|Semestral|Anual)/);
        const plan = planMatch ? planMatch[1] : "Mensual";
        const MESES_PLAN = { Mensual: 1, Trimestral: 3, Semestral: 6, Anual: 12 };
        const v = new Date(fechaD);
        v.setMonth(v.getMonth() + (MESES_PLAN[plan] || 1));
        return v.toISOString().split("T")[0];
      }
    }
    return "";
  })();

  const txDate = parseDate(tx.fecha);
  const hoy = new Date();

  const [editing, setEditing] = useState(false);
  const [confirmMesPasado, setConfirmMesPasado] = useState(false);
  const [form, setForm] = useState({
    cat: tx.categoria,
    desc: desc.replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "").trim(), // limpiar del display
    monto: String(tx.monto),
    fecha: displayToISO(tx.fecha),
    vence: venceManualDelDesc,
  });
  const [confirmDel, setConfirmDel] = useState(false);

  // Detectar si la fecha ACTUAL del form es mes pasado
  const formDate = form.fecha ? new Date(form.fecha + "T12:00:00") : txDate;
  const esMesPasado = formDate && (formDate.getFullYear() < hoy.getFullYear() || (formDate.getFullYear() === hoy.getFullYear() && formDate.getMonth() < hoy.getMonth()));
  const mesNombre = formDate ? formDate.toLocaleString("es-MX", { month: "long", year: "numeric" }) : "";

  // Duración calculada entre inicio y vence
  const duracionDias = (() => {
    if (!form.fecha || !form.vence) return null;
    const [vy,vm,vd] = form.vence.split("-").map(Number);
    const [iy,im,id2] = form.fecha.split("-").map(Number);
    const diff = Math.round((new Date(vy,vm-1,vd) - new Date(iy,im-1,id2)) / 86400000);
    return diff > 0 ? diff : null;
  })();

  const handleSave = () => {
    if (!form.monto) return;
    // Reempacar vencimiento en la descripción base (sin el viejo vence:)
    const baseDesc = form.desc.trim() || desc.replace(/\s*\(vence:\d{4}-\d{2}-\d{2}\)/, "").trim();
    const newDesc = form.vence ? `${baseDesc} (vence:${form.vence})` : baseDesc;
    onSave({ ...tx, categoria: form.cat, desc: newDesc, descripcion: newDesc, monto: Number(form.monto), fecha: fmtDate(form.fecha) || form.fecha, vence_manual: form.vence || null });
  };

  const handleEditClick = () => {
    if (esMesPasado) setConfirmMesPasado(true);
    else setEditing(true);
  };

  const Row = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <span style={{ color: "#4b4b6a", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>{label}</span>
      <span style={{ color: accent || "#fff", fontSize: 14, fontWeight: accent ? 700 : 500, fontFamily: accent ? "'DM Mono',monospace" : "inherit" }}>{value}</span>
    </div>
  );

  const titleEditing = isMembresía ? "✏️ Editar Membresía" : (isGasto ? "✏️ Editar Gasto" : "✏️ Editar Ingreso");
  const titleView = isMembresía ? "🏋️ Detalle Membresía" : (isGasto ? "💸 Detalle Gasto" : "💰 Detalle Ingreso");

  return (
    <Modal title={editing ? titleEditing : titleView} onClose={onClose}>

      {/* ── Confirmación mes pasado ── */}
      {confirmMesPasado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(8px)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#1e1e30", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, border: "1px solid rgba(245,158,11,.3)" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>⚠️</p>
              <h3 style={{ color: "#fbbf24", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Modificando mes pasado</h3>
              <p style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.6 }}>
                Estás por editar un movimiento de <strong style={{ color: "#fff" }}>{mesNombre}</strong>. Esto afectará los totales y estadísticas de ese mes.
              </p>
            </div>
            <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 18 }}>
              <p style={{ color: "#f59e0b", fontSize: 11, lineHeight: 1.6 }}>💡 Si es un error de captura, edítalo. Si es información nueva, considera un movimiento nuevo.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn full outline color="#6b7280" onClick={() => setConfirmMesPasado(false)}>Cancelar</Btn>
              <Btn full color="#f59e0b" onClick={() => { setConfirmMesPasado(false); setEditing(true); }}>Sí, editar</Btn>
            </div>
          </div>
        </div>
      )}

      {!editing ? (
        // ── VIEW MODE ──
        <>
          {esMesPasado && (
            <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "8px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14 }}>📅</span>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>Movimiento de {mesNombre}</p>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ background: isMembresía ? "rgba(167,139,250,.12)" : isGasto ? "rgba(244,63,94,.12)" : "rgba(34,211,238,.12)", color: isMembresía ? "#a78bfa" : color, borderRadius: 20, padding: "6px 20px", fontSize: 13, fontWeight: 700, border: `1px solid ${isMembresía ? "rgba(167,139,250,.25)" : isGasto ? "rgba(244,63,94,.25)" : "rgba(34,211,238,.25)"}` }}>
              {isMembresía ? "🏋️ Membresía" : isGasto ? "💸 Gasto" : "💰 Ingreso"}
            </span>
          </div>
          <div style={{ textAlign: "center", marginBottom: 20, background: isMembresía ? "rgba(167,139,250,.07)" : isGasto ? "rgba(244,63,94,.07)" : "rgba(34,211,238,.07)", borderRadius: 18, padding: "16px 0", border: `1px solid ${isMembresía ? "rgba(167,139,250,.15)" : isGasto ? "rgba(244,63,94,.15)" : "rgba(34,211,238,.15)"}` }}>
            <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Monto</p>
            <p style={{ color: isMembresía ? "#a78bfa" : color, fontSize: 32, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>${Number(tx.monto).toLocaleString("es-MX")}</p>
          </div>
          <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 16, padding: "0 14px" }}>
            <Row label="Categoría" value={tx.categoria} />
            <Row label="Inicio" value={tx.fecha} />
            {venceManualDelDesc && <Row label="Vencimiento" value={fmtDate(venceManualDelDesc)} accent="#22d3ee" />}
            {duracionDias && <Row label="Duración" value={`${duracionDias} días`} />}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn full outline color="#6b7280" onClick={onClose}>Cerrar</Btn>
            <Btn full color={isMembresía ? "#a78bfa" : color} onClick={handleEditClick}>✏️ Editar</Btn>
          </div>
        </>
      ) : (
        // ── EDIT MODE ──
        <>
          {esMesPasado && (
            <div style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
              <span>⚠️</span>
              <p style={{ color: "#f59e0b", fontSize: 11 }}>Editando movimiento de <strong>{mesNombre}</strong> — los cambios afectarán ese mes.</p>
            </div>
          )}

          {/* Monto siempre editable */}
          <Inp label="Monto ($)" type="number" value={form.monto} onChange={v => setForm(p => ({ ...p, monto: v }))} placeholder="0.00" />

          {/* Fechas de membresía: inicio + vencimiento en grid */}
          {isMembresía ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Inicio</p>
                  <input type="date" value={form.fecha}
                    onChange={e => {
                      const v = e.target.value;
                      const d = new Date(v + "T12:00:00");
                      const nuevoEsMesPasado = d.getFullYear() < hoy.getFullYear() || (d.getFullYear() === hoy.getFullYear() && d.getMonth() < hoy.getMonth());
                      setForm(p => ({ ...p, fecha: v }));
                      // Avisar si cambia a mes pasado
                      if (nuevoEsMesPasado && !esMesPasado) setConfirmMesPasado(true);
                    }}
                    style={{ width: "100%", background: "rgba(255,255,255,.07)", border: `1px solid ${esMesPasado ? "rgba(245,158,11,.4)" : "rgba(255,255,255,.15)"}`, borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Vencimiento</p>
                  <input type="date" value={form.vence} min={form.fecha}
                    onChange={e => setForm(p => ({ ...p, vence: e.target.value }))}
                    style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(34,211,238,.3)", borderRadius: 12, padding: "12px 10px", color: "#22d3ee", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
              </div>
              {duracionDias && (
                <div style={{ textAlign: "right", marginBottom: 12 }}>
                  <span style={{ color: "#22d3ee", fontSize: 12, fontWeight: 700 }}>{duracionDias} días</span>
                </div>
              )}
            </>
          ) : (
            <Inp label="Fecha" type="date" value={form.fecha} onChange={v => setForm(p => ({ ...p, fecha: v }))} />
          )}

          {!isMembresía && (
            <Inp label="Categoría" value={form.cat} onChange={v => setForm(p => ({ ...p, cat: v }))} options={cats} />
          )}
          <Inp label="Descripción" value={form.desc} onChange={v => setForm(p => ({ ...p, desc: v }))} placeholder="Descripción" />

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn full outline color="#6b7280" onClick={() => { setEditing(false); setConfirmDel(false); }}>← Volver</Btn>
            <Btn full color={isMembresía ? "#a78bfa" : color} onClick={handleSave}>Guardar ✓</Btn>
          </div>
          <div style={{ marginTop: 12 }}>
            {!confirmDel ? (
              <Btn full outline color="#f43f5e" onClick={() => setConfirmDel(true)}>🗑 Eliminar movimiento</Btn>
            ) : (
              <div style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 14, padding: 14, textAlign: "center" }}>
                <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>¿Eliminar este movimiento?</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn full outline color="#6b7280" onClick={() => setConfirmDel(false)}>Cancelar</Btn>
                  <Btn full color="#f43f5e" onClick={() => onDelete(tx.id)}>Sí, eliminar</Btn>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ─── REPORTE PDF ─── */
function CalendarioEventos({ miembros, txs, getMembershipInfo }) {
  const hoy = new Date();
  const [mesVer, setMesVer] = useState(hoy.getMonth());
  const [anioVer, setAnioVer] = useState(hoy.getFullYear());
  const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DIAS = ["Lu","Ma","Mi","Ju","Vi","Sa","Do"];

  // Calcular todos los eventos del mes visible
  const eventosDelMes = (() => {
    const mapa = {}; // día → [{tipo, nombre, color}]
    const agregarEvento = (dia, ev) => {
      if (!mapa[dia]) mapa[dia] = [];
      mapa[dia].push(ev);
    };

    miembros.forEach(m => {
      // Cumpleaños
      if (m.fecha_nacimiento) {
        const fn = new Date(m.fecha_nacimiento + "T00:00:00");
        if (fn.getMonth() === mesVer) {
          agregarEvento(fn.getDate(), { tipo: "cumple", nombre: m.nombre.split(" ")[0], color: "#f59e0b" });
        }
      }
      // Vencimientos
      const mem = getMembershipInfo(m.id, txs, m);
      if (mem.vence && mem.estado !== "Sin membresía") {
        const vp = (() => {
          const MESES_N = { "Ene":0,"Feb":1,"Mar":2,"Abr":3,"May":4,"Jun":5,"Jul":6,"Ago":7,"Sep":8,"Oct":9,"Nov":10,"Dic":11 };
          const parts = mem.vence.split(" ");
          if (parts.length === 3) return new Date(Number(parts[2]), MESES_N[parts[1]] || 0, Number(parts[0]));
          if (mem.vence.includes("-")) { const [y,mo,d] = mem.vence.split("-").map(Number); return new Date(y, mo-1, d); }
          return null;
        })();
        if (vp && vp.getMonth() === mesVer && vp.getFullYear() === anioVer) {
          agregarEvento(vp.getDate(), { tipo: "vence", nombre: m.nombre.split(" ")[0], color: mem.estado === "Vencido" ? "#f43f5e" : "#22d3ee" });
        }
      }
    });
    return mapa;
  })();

  // Construir grilla del mes
  const primerDia = new Date(anioVer, mesVer, 1).getDay(); // 0=dom
  const ajuste = primerDia === 0 ? 6 : primerDia - 1; // lun=0
  const diasEnMes = new Date(anioVer, mesVer + 1, 0).getDate();
  const celdas = Array(ajuste).fill(null).concat(Array.from({ length: diasEnMes }, (_, i) => i + 1));
  while (celdas.length % 7 !== 0) celdas.push(null);

  const esMesActual = mesVer === hoy.getMonth() && anioVer === hoy.getFullYear();

  // Lista de eventos del mes ordenada
  const listaEventos = Object.entries(eventosDelMes)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .flatMap(([dia, evs]) => evs.map(ev => ({ dia: Number(dia), ...ev })));

  const navMes = (dir) => {
    let nm = mesVer + dir, ny = anioVer;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setMesVer(nm); setAnioVer(ny);
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>📅 Calendario</p>
          <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>Cumpleaños y vencimientos</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => navMes(-1)} style={{ border: "none", background: "rgba(255,255,255,.08)", color: "#9ca3af", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, minWidth: 90, textAlign: "center" }}>{MESES_FULL[mesVer]} {anioVer}</span>
          <button onClick={() => navMes(1)} style={{ border: "none", background: "rgba(255,255,255,.08)", color: "#9ca3af", width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>›</button>
        </div>
      </div>

      {/* Días semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
        {DIAS.map(d => <p key={d} style={{ color: "#4b4b6a", fontSize: 9, fontWeight: 700, textAlign: "center", padding: "2px 0" }}>{d}</p>)}
      </div>

      {/* Grilla */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 14 }}>
        {celdas.map((dia, idx) => {
          if (!dia) return <div key={idx} />;
          const evs = eventosDelMes[dia] || [];
          const esHoy = esMesActual && dia === hoy.getDate();
          const tieneCumple = evs.some(e => e.tipo === "cumple");
          const tieneVence = evs.some(e => e.tipo === "vence");
          return (
            <div key={idx} style={{
              borderRadius: 8, padding: "4px 2px", textAlign: "center", position: "relative", minHeight: 36,
              background: esHoy ? "linear-gradient(135deg,#6c63ff,#e040fb)" : evs.length > 0 ? "rgba(255,255,255,.07)" : "transparent",
              border: evs.length > 0 && !esHoy ? "1px solid rgba(255,255,255,.08)" : "1px solid transparent",
            }}>
              <p style={{ color: esHoy ? "#fff" : evs.length > 0 ? "#e2e8f0" : "#4b4b6a", fontSize: 11, fontWeight: esHoy || evs.length > 0 ? 700 : 400 }}>{dia}</p>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2 }}>
                {tieneCumple && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b" }} />}
                {tieneVence && <div style={{ width: 5, height: 5, borderRadius: "50%", background: tieneVence && evs.find(e=>e.tipo==="vence")?.color || "#22d3ee" }} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>Cumpleaños</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>Vence membresía</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e" }} />
          <span style={{ color: "#6b7280", fontSize: 10 }}>Ya vencido</span>
        </div>
      </div>

      {/* Lista de eventos del mes */}
      {listaEventos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px 0" }}>
          <p style={{ color: "#4b4b6a", fontSize: 12 }}>Sin eventos este mes</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {listaEventos.map((ev, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${ev.color}` }}>
              <span style={{ fontSize: 14 }}>{ev.tipo === "cumple" ? "🎂" : "⏰"}</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{ev.nombre}</p>
                <p style={{ color: "#4b4b6a", fontSize: 10 }}>{ev.tipo === "cumple" ? "Cumpleaños" : "Vence membresía"}</p>
              </div>
              <span style={{ color: ev.color, fontSize: 12, fontWeight: 700 }}>{String(ev.dia).padStart(2,"0")} {["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mesVer]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportePDF({ txs, miembros, gymConfig, getMembershipInfo, MESES_LABEL }) {
  const now2 = new Date();
  const mesesOpts = Array.from({ length: 13 }, (_, i) => {
    let mo = now2.getMonth() - (12 - i);
    let yr = now2.getFullYear();
    while (mo < 0) { mo += 12; yr--; }
    while (mo > 11) { mo -= 12; yr++; }
    return { label: `${MESES_LABEL[mo]} ${yr}`, value: `${yr}-${String(mo+1).padStart(2,"0")}` };
  });
  const [pdfMes, setPdfMes] = useState(mesesOpts[mesesOpts.length - 1].value);

  const [generando, setGenerando] = useState(false);

  const cargarScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const generarPDF = async () => {
    setGenerando(true);
    try {
      // Cargar jsPDF + autoTable desde CDN
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210; // ancho A4
      const margin = 14;
      const [yr, mo] = pdfMes.split("-").map(Number);
      const monthIdx = mo - 1;
      const mesNombre = `${MESES_LABEL[monthIdx]} ${yr}`;
      const txsMesPDF = txs.filter(t => {
        const d = parseDate(t.fecha);
        return d && d.getFullYear() === yr && d.getMonth() === monthIdx;
      });
      const ing = txsMesPDF.filter(t => t.tipo === "ingreso").reduce((s,t) => s + Number(t.monto), 0);
      const gas = txsMesPDF.filter(t => t.tipo === "gasto").reduce((s,t) => s + Number(t.monto), 0);
      const util = ing - gas;
      const mActPDF = miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length;
      const gymNombre = gymConfig?.nombre || "GymFit Pro";
      const fmt$ = n => "$" + Number(n).toLocaleString("es-MX");

      // ── HEADER ──
      doc.setFillColor(108, 99, 255);
      doc.rect(0, 0, W, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(gymNombre, margin, 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("Reporte mensual", margin, 16);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(mesNombre, W - margin, 12, { align: "right" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }), W - margin, 18, { align: "right" });

      let y = 30;

      // ── TARJETAS RESUMEN ──
      const cards = [
        { label: "Ingresos", value: fmt$(ing), r: 34, g: 197, b: 94 },
        { label: "Gastos", value: fmt$(gas), r: 244, g: 63, b: 94 },
        { label: "Utilidad neta", value: (util >= 0 ? "+" : "") + fmt$(Math.abs(util)), r: util >= 0 ? 34 : 244, g: util >= 0 ? 197 : 63, b: util >= 0 ? 94 : 94 },
      ];
      const cardW = (W - margin * 2 - 8) / 3;
      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 4);
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
        doc.setFillColor(248, 248, 255);
        doc.roundedRect(x, y, cardW, 18, 3, 3, "FD");
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 114, 128);
        doc.text(c.label.toUpperCase(), x + cardW / 2, y + 5.5, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.setTextColor(c.r, c.g, c.b);
        doc.text(c.value, x + cardW / 2, y + 13, { align: "center" });
      });
      y += 24;

      // ── MIEMBROS ──
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(108, 99, 255);
      doc.text("RESUMEN DE MIEMBROS", margin, y); y += 5;
      doc.autoTable({
        startY: y,
        head: [["Total", "Activos", "Vencidos / Sin membresía"]],
        body: [[miembros.length, mActPDF, miembros.length - mActPDF]],
        theme: "grid",
        headStyles: { fillColor: [108, 99, 255], fontSize: 8, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 11, fontStyle: "bold", halign: "center" },
        margin: { left: margin, right: margin },
        styles: { cellPadding: 4 },
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── MOVIMIENTOS ──
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(108, 99, 255);
      doc.text(`MOVIMIENTOS DEL MES (${txsMesPDF.length})`, margin, y); y += 5;

      const rows = txsMesPDF
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
        .map(t => [
          t.fecha || "—",
          t.tipo === "ingreso" ? "Ingreso" : "Gasto",
          t.categoria || "—",
          t.desc || t.descripcion || "—",
          (t.tipo === "ingreso" ? "+" : "-") + fmt$(t.monto),
        ]);

      doc.autoTable({
        startY: y,
        head: [["Fecha", "Tipo", "Categoría", "Descripción", "Monto"]],
        body: rows.length > 0 ? rows : [["—", "—", "—", "Sin movimientos este mes", "—"]],
        theme: "striped",
        headStyles: { fillColor: [248, 247, 255], textColor: [107, 114, 128], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 28 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            const v = String(data.cell.raw);
            data.cell.styles.textColor = v.startsWith("+") ? [22, 163, 74] : [225, 29, 72];
          }
          if (data.section === "body" && data.column.index === 1) {
            const v = String(data.cell.raw);
            data.cell.styles.textColor = v.includes("Ingreso") ? [22, 163, 74] : [225, 29, 72];
          }
        },
        margin: { left: margin, right: margin },
      });

      // ── FOOTER ──
      const pageH = doc.internal.pageSize.height;
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      doc.text(`${gymNombre} · Generado automáticamente`, W / 2, pageH - 8, { align: "center" });

      // ── DESCARGAR ──
      doc.save(`reporte-${gymNombre.replace(/\s+/g, "-").toLowerCase()}-${pdfMes}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <select value={pdfMes} onChange={e => setPdfMes(e.target.value)}
          style={{ flex: 1, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }}>
          {mesesOpts.map(o => <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>{o.label}</option>)}
        </select>
      </div>
      <button onClick={generarPDF} disabled={generando}
        style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14,
          cursor: generando ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          background: generando ? "rgba(108,99,255,.4)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
          color: "#fff", boxShadow: generando ? "none" : "0 4px 18px rgba(108,99,255,.35)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s" }}>
        <span style={{ fontSize: 18 }}>{generando ? "⏳" : "📥"}</span>
        {generando ? "Generando PDF..." : "Descargar PDF"}
      </button>
      <p style={{ color: "#4b4b6a", fontSize: 10, textAlign: "center", marginTop: 8, marginBottom: 8 }}>El archivo .pdf se descarga directamente en tu dispositivo.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function App() {
  const GYM_ID = getGymId();

  // No gym param — show error screen
  if (!GYM_ID) return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "system-ui,sans-serif" }}>
      <div style={{ width: 72, height: 72, borderRadius: 24, background: "rgba(244,63,94,.15)", border: "1px solid rgba(244,63,94,.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>🔒</div>
      <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>Acceso no válido</h1>
      <p style={{ color: "#4b4b6a", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>Esta aplicación requiere un enlace específico de tu gimnasio.</p>
      <p style={{ color: "#4b4b6a", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280, marginTop: 8 }}>Contacta a tu administrador para obtener el link correcto.</p>
      <div style={{ marginTop: 24, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 18px" }}>
        <p style={{ color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>tudominio.com/?gym=nombre-del-gym</p>
      </div>
    </div>
  );

  const [screen, setScreen] = useState("dashboard");
  const [mensajesMiembro, setMensajesMiembro] = useState(null); // miembro preseleccionado al abrir mensajes
  const [modoMensajes, setModoMensajes] = useState(null); // tab inicial al abrir mensajes
  const [loading, setLoading] = useState(true);
  const [gymConfig, setGymConfig] = useState(null);
  const [configScreen, setConfigScreen] = useState(false);
  const [formCfg, setFormCfg] = useState({ nombre: "", slogan: "", telefono: "", direccion: "", planes: DEFAULT_PLANES });
  const [tab, setTab] = useState(0);
  const [miembros, setMiembros] = useState([]);
  const [txs, setTxs] = useState([]);
  const [modal, setModal] = useState(null);
  const [selM, setSelM] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [viewMode, setViewMode] = useState("lista"); // "lista" | "grid"
  const [busqueda, setBusqueda] = useState("");
  // Broadcast moved to MensajesScreen
  const [statsTab, setStatsTab] = useState(0);
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 1000); return () => clearInterval(t); }, []); // 0=utilidad, 1=ingresos, 2=gastos
  const [filtroDesde, setFiltroDesde] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
  const [filtroHasta, setFiltroHasta] = useState(todayISO);
  // Month navigator: {year, month} where month is 0-indexed
  const [selMes, setSelMes] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesLabel = `${MESES_LABEL[selMes.month]} ${selMes.year}`;
  const mesAnteriorLabel = (() => { const m = selMes.month === 0 ? 11 : selMes.month - 1; const y = selMes.month === 0 ? selMes.year - 1 : selMes.year; return `${MESES_LABEL[m]} ${y}`; })();
  // Derived — updates whenever selMes changes (triggers re-render)
  // Derive active plans from gymConfig (fallback to DEFAULT_PLANES)
  const activePlanes = (gymConfig?.planes || DEFAULT_PLANES).filter(p => p.activo !== false);
  const PLANES_ACTIVOS = activePlanes.map(p => p.nombre);
  const PLAN_PRECIO_ACTIVO = Object.fromEntries(activePlanes.map(p => [p.nombre, p.precio]));
  const PLAN_MESES_ACTIVO = Object.fromEntries(activePlanes.map(p => [p.nombre, p.meses]));
  const nowForCurr = new Date();
  const isCurrentMonth = selMes.year === nowForCurr.getFullYear() && selMes.month === nowForCurr.getMonth();
  const navMes = (dir) => {
    const now = new Date();
    const cur = selMes; // read current value directly, no closure issue
    let m = cur.month + dir;
    let y = cur.year;
    if (m > 11) { m = 0; y += 1; }
    if (m < 0)  { m = 11; y -= 1; }
    console.log("navMes", dir, "->", y, m, "now:", now.getFullYear(), now.getMonth());
    // Allow up to 1 year into the future (memberships can start next month)
    if (y > now.getFullYear() + 1) return;
    setSelMes({ year: y, month: m });
  };
  // Filter txs to selected month
  const txsMes = useMemo(() => txs.filter(t => {
    const d = parseDate(t.fecha);
    if (!d) return false;
    return d.getFullYear() === selMes.year && d.getMonth() === selMes.month;
  }), [txs, selMes]);
  // Previous month txs for comparison
  const txsPrevMes = useMemo(() => txs.filter(t => {
    const d = parseDate(t.fecha);
    if (!d) return false;
    const pm = selMes.month === 0 ? 11 : selMes.month - 1;
    const py = selMes.month === 0 ? selMes.year - 1 : selMes.year;
    return d.getFullYear() === py && d.getMonth() === pm;
  }), [txs, selMes]);

  // ── Load data from Supabase on mount ──
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Load gym config
        const gym = await supabase.getGym(GYM_ID);
        if (gym) {
          setGymConfig(gym);
          setFormCfg({ nombre: gym.nombre || "", slogan: gym.slogan || "", telefono: gym.telefono || "", direccion: gym.direccion || "", zona_horaria: gym.zona_horaria || "America/Merida", logo: gym.logo || null, planes: gym.planes || DEFAULT_PLANES });
        } else {
          // First time — show config screen
          setLoading(false);
          setConfigScreen(true);
          return;
        }
        // Load miembros
        const db = await supabase.from("miembros");
        const mData = await db.select(GYM_ID);
        // Load transacciones
        const txDb = await supabase.from("transacciones");
        const txData = await txDb.select(GYM_ID);
        setTxs(txData.map(t => ({
          id: t.id, tipo: t.tipo, categoria: t.categoria,
          desc: t.descripcion, monto: t.monto, fecha: t.fecha,
          miembroId: t.miembro_id || null,
        })));
        setMiembros(mData.filter(m => !m.archivado).map(m => ({
          id: m.id, nombre: m.nombre, tel: m.tel || "", foto: m.foto || null,
          fecha_incorporacion: m.fecha_incorporacion || null,
          sexo: m.sexo || null, fecha_nacimiento: m.fecha_nacimiento || null,
          notas: m.notas || "",
          congelado: m.congelado || false,
          fecha_descongelar: m.fecha_descongelar || null,
          dias_congelados: m.dias_congelados || 0,
        })));
      } catch(e) {
        console.error("Error loading data:", e);
      }
      setLoading(false);
    }
    loadData();
  }, [GYM_ID]);

  const [fI, setFI] = useState({ cat: "Clases extras", desc: "", monto: "", fecha: todayISO() });
  const [fG, setFG] = useState({ cat: "Nómina", desc: "", monto: "", fecha: todayISO() });
  const [fM, setFM] = useState(() => { const ini = todayISO(); return { nombre: "", tel: "", foto: null, sexo: "", fecha_nacimiento: "", fecha_incorporacion: "", clasePrueba: false, fechaPrueba: todayISO() }; });

  const totalIng = useMemo(() => txsMes.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0), [txsMes]);
  const totalGas = useMemo(() => txsMes.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0), [txsMes]);
  const utilidad = totalIng - totalGas;
  // Compare vs previous month
  const prevIng = useMemo(() => txsPrevMes.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0), [txsPrevMes]);
  const prevGas = useMemo(() => txsPrevMes.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0), [txsPrevMes]);
  const prevUtil = prevIng - prevGas;
  const crecIng = prevIng > 0 ? (((totalIng - prevIng) / prevIng) * 100).toFixed(1) : null;
  const crecGas = prevGas > 0 ? (((totalGas - prevGas) / prevGas) * 100).toFixed(1) : null;
  const crecUtil = prevUtil !== 0 ? (((utilidad - prevUtil) / Math.abs(prevUtil)) * 100).toFixed(1) : null;
  const mActivos = miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length;
  const mHombres = miembros.filter(m => m.sexo === "Masculino").length;
  const mMujeres = miembros.filter(m => m.sexo === "Femenino").length;
  const mSinSexo = miembros.filter(m => !m.sexo).length;

  // Cumpleaños próximos (7 días)
  const cumplesPróximos = useMemo(() => {
    return miembros
      .map(m => ({ ...m, diasCumple: diasParaCumple(m.fecha_nacimiento) }))
      .filter(m => m.diasCumple !== null && m.diasCumple <= 7)
      .sort((a, b) => a.diasCumple - b.diasCumple);
  }, [miembros]);

  // Membresías por vencer en los próximos 5 días
  const membresiasPorVencer = useMemo(() => {
    return miembros
      .map(m => {
        const info = getMembershipInfo(m.id, txs, m);
        if (info.estado !== "Activo") return null;
        const dias = diasParaVencer(info.vence);
        if (dias === null || dias > 5 || dias < 0) return null;
        return { ...m, diasVence: dias, vence: info.vence, plan: info.plan };
      })
      .filter(Boolean)
      .sort((a, b) => a.diasVence - b.diasVence);
  }, [miembros, txs]);

  // Miembros sin sexo con sus datos completos
  const miembrosSinSexo = useMemo(() => miembros.filter(m => !m.sexo), [miembros]);

  // Count total WA reminders pending
  const totalRecordatorios = useMemo(() => {
    const hoyKeyLocal = new Date().toISOString().slice(0, 10);
    const enviados = (gymConfig?.wa_enviados || {})[hoyKeyLocal] || {};
    return membresiasPorVencer.filter(m => !enviados[m.id]).length;
  }, [membresiasPorVencer, gymConfig]);

  const addIng = async () => {
    if (!fI.desc || !fI.monto) return;
    const db = await supabase.from("transacciones");
    const saved = await db.insert({ gym_id: GYM_ID, tipo: "ingreso", categoria: fI.cat, descripcion: fI.desc, monto: Number(fI.monto), fecha: fmtDate(fI.fecha) || today() });
    if (saved) setTxs(p => [{ id: saved.id, tipo: "ingreso", categoria: fI.cat, descripcion: fI.desc, monto: Number(fI.monto), fecha: fmtDate(fI.fecha) || today() }, ...p]);
    setFI({ cat: "Clases extras", desc: "", monto: "", fecha: todayISO() }); setModal(null); setScreen("dashboard"); setTab(0);
  };
  const addGas = async () => {
    if (!fG.desc || !fG.monto) return;
    const db = await supabase.from("transacciones");
    const saved = await db.insert({ gym_id: GYM_ID, tipo: "gasto", categoria: fG.cat, descripcion: fG.desc, monto: Number(fG.monto), fecha: fmtDate(fG.fecha) || today() });
    if (saved) setTxs(p => [{ id: saved.id, tipo: "gasto", categoria: fG.cat, descripcion: fG.desc, monto: Number(fG.monto), fecha: fmtDate(fG.fecha) || today() }, ...p]);
    setFG({ cat: "Nómina", desc: "", monto: "", fecha: todayISO() }); setModal(null); setScreen("dashboard"); setTab(0);
  };
  const addM = async () => {
    if (!fM.nombre) return;
    const mDb = await supabase.from("miembros");
    const savedM = await mDb.insert({ gym_id: GYM_ID, nombre: fM.nombre, tel: fM.tel || "", foto: fM.foto || null, fecha_incorporacion: fM.fecha_incorporacion || todayISO(), sexo: fM.sexo || null, fecha_nacimiento: fM.fecha_nacimiento || null });
    if (savedM) {
      setMiembros(p => [{ id: savedM.id, nombre: fM.nombre, tel: fM.tel || "", foto: fM.foto || null, fecha_incorporacion: fM.fecha_incorporacion || todayISO(), sexo: fM.sexo || null, fecha_nacimiento: fM.fecha_nacimiento || null }, ...p]);
      // Clase prueba: registrar como nota en transacciones (sin costo, categoría especial)
      if (fM.clasePrueba) {
        const tDb = await supabase.from("transacciones");
        const fechaPrueba = fM.fechaPrueba || todayISO();
        const savedT = await tDb.insert({ gym_id: GYM_ID, tipo: "ingreso", categoria: "Otro", descripcion: `Clase prueba - ${fM.nombre}`, monto: 0, fecha: fechaPrueba, miembro_id: savedM.id });
        if (savedT) setTxs(p => [{ id: savedT.id, tipo: "ingreso", categoria: "Otro", desc: `Clase prueba - ${fM.nombre}`, descripcion: `Clase prueba - ${fM.nombre}`, monto: 0, fecha: fechaPrueba, miembroId: savedM.id, miembro_id: savedM.id }, ...p]);
      }
    }
    setFM({ nombre: "", tel: "", foto: null, sexo: "", fecha_nacimiento: "", fecha_incorporacion: "", clasePrueba: false, fechaPrueba: todayISO() });
    setModal(null);
    // Abrir perfil del nuevo miembro para agregar membresía
    if (savedM) { setSelM({ id: savedM.id, nombre: fM.nombre, tel: fM.tel || "", foto: fM.foto || null, fecha_incorporacion: fM.fecha_incorporacion || todayISO(), sexo: fM.sexo || null, fecha_nacimiento: fM.fecha_nacimiento || null }); setModal("detalle"); }
  };

  const archiveMiembro = async (id) => {
    // Marcar como archivado en Supabase (columna archivado=true)
    const mDb = await supabase.from("miembros");
    await mDb.update(id, { archivado: true });
    // Ocultar de la lista local
    setMiembros(p => p.filter(m => m.id !== id));
    setModal(null);
    setSelM(null);
  };

  const deleteMiembro = async (id) => {
    // Borrar todas las transacciones del miembro
    const txsMiembro = txs.filter(t => String(t.miembroId) === String(id) || String(t.miembro_id) === String(id));
    for (const t of txsMiembro) {
      const tDb = await supabase.from("transacciones");
      await tDb.delete(t.id);
    }
    setTxs(p => p.filter(t => String(t.miembroId) !== String(id) && String(t.miembro_id) !== String(id)));
    // Borrar al miembro
    const mDb = await supabase.from("miembros");
    await mDb.delete(id);
    setMiembros(p => p.filter(m => m.id !== id));
    setModal(null);
    setSelM(null);
  };

  const saveMiembro = async (updated) => {
    setMiembros(p => p.map(m => m.id === updated.id ? updated : m));
    setSelM(updated);
    const db = await supabase.from("miembros");
    await db.update(updated.id, {
      nombre: updated.nombre, tel: updated.tel, foto: updated.foto || null,
      fecha_incorporacion: updated.fecha_incorporacion,
      sexo: updated.sexo || null, fecha_nacimiento: updated.fecha_nacimiento || null,
      notas: updated.notas || null,
      congelado: updated.congelado || false,
      fecha_descongelar: updated.fecha_descongelar || null,
      dias_congelados: updated.dias_congelados || 0,
    });
  };
  const updatePlantillas = async (nuevasPlantillas) => {
    const newCfg = { ...(gymConfig || {}), plantillas_wa: nuevasPlantillas };
    setGymConfig(newCfg);
    const url = `${supabase.url}/rest/v1/gimnasios`;
    await fetch(url, {
      method: "POST",
      headers: { "apikey": supabase.key, "Authorization": `Bearer ${supabase.key}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ ...newCfg, id: GYM_ID })
    });
  };

  // Recordatorios WA enviados — persiste en Supabase dentro de gymConfig
  const hoyKey = new Date().toISOString().slice(0, 10);
  const recordatoriosEnviados = (gymConfig?.wa_enviados || {})[hoyKey] || {};
  const marcarRecordatorio = async (miembroId) => {
    const waEnviados = { ...(gymConfig?.wa_enviados || {}) };
    waEnviados[hoyKey] = { ...(waEnviados[hoyKey] || {}), [miembroId]: true };
    const newCfg = { ...(gymConfig || {}), wa_enviados: waEnviados };
    setGymConfig(newCfg);
    const url = `${supabase.url}/rest/v1/gimnasios`;
    await fetch(url, {
      method: "POST",
      headers: { "apikey": supabase.key, "Authorization": `Bearer ${supabase.key}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ ...newCfg, id: GYM_ID })
    });
  };

  const saveEditTx = async (updated) => {
    setTxs(p => p.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setEditTx(null); setModal(null);
    const db = await supabase.from("transacciones");
    const descFinal = updated.desc || updated.descripcion || "-";
    // Bug fix: include vence_manual so membership expiration date is preserved
    await db.update(updated.id, {
      categoria: updated.categoria,
      descripcion: descFinal,
      monto: updated.monto,
      fecha: updated.fecha,
      ...(updated.vence_manual ? { vence_manual: updated.vence_manual } : {}),
    });
  };
  const deleteEditTx = async (id) => {
    // Find the tx before deleting
    const deletedTx = txs.find(t => t.id === id);
    const newTxs = txs.filter(t => t.id !== id);
    setTxs(newTxs);
    setEditTx(null); setModal(null);
    // Delete from Supabase
    const db = await supabase.from("transacciones");
    await db.delete(id);
    // NOTE: estado/vence are calculated dynamically from transactions (getMembershipInfo)
    // No need to update miembros table — UI will recalculate automatically
  };
  const toggleEstado = () => {
    // Estado is calculated dynamically from transactions via getMembershipInfo.
    // No local override needed — the UI reflects real data automatically.
  };
  const addPago = async (pagoData) => {
    const db = await supabase.from("transacciones");
    // vence_manual se embebe en la descripción para persistir sin columna extra
    const descFinal = pagoData.desc || pagoData.descripcion || "-";
    const saved = await db.insert({ gym_id: GYM_ID, tipo: pagoData.tipo, categoria: pagoData.categoria, descripcion: descFinal, monto: pagoData.monto, fecha: pagoData.fecha, miembro_id: pagoData.miembroId || null });
    if (saved) {
      setTxs(p => [...p, { 
        id: saved.id, tipo: pagoData.tipo, categoria: pagoData.categoria,
        desc: descFinal, descripcion: descFinal,
        monto: pagoData.monto, fecha: pagoData.fecha,
        miembroId: pagoData.miembroId || null,
        miembro_id: pagoData.miembroId || null,
        vence_manual: pagoData.vence_manual || null,
      }]);
    }
  };
  const TABS = ["Dashboard", "Ingresos", "Gastos", "Historial"];

  return (
    <div style={{ width: "100%", height: "100%", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{width:100%;height:100%;background:#13131f;overflow:hidden;}
        #root{width:100%;height:100%;display:flex;align-items:stretch;}
        ::-webkit-scrollbar{width:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
        .card{animation:fadeUp .35s ease both;}
        .card:nth-child(2){animation-delay:.07s}.card:nth-child(3){animation-delay:.14s}.card:nth-child(4){animation-delay:.21s}
        .rh:hover{background:rgba(255,255,255,.06)!important;transition:background .2s;}
        input::placeholder{color:#3d3d5c;}
        select option{background:#191928;}
        button:active{opacity:.75;}
        .wa-pulse{animation:pulse 2s infinite;}
      `}</style>
      <div style={{
          background: "#13131f",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          width: "100%",
          height: "100%",
          flex: 1,
        }}>


        {/* ═══ MENSAJES SCREEN ═══ */}
        {!loading && !configScreen && screen === "mensajes" && (
          <MensajesScreen miembros={miembros} txs={txs} gymConfig={gymConfig} onBack={() => { setMensajesMiembro(null); setModoMensajes(null); setScreen("dashboard"); }} onUpdatePlantillas={updatePlantillas} miembroInicial={mensajesMiembro} modoInicial={modoMensajes} recordatoriosEnviados={recordatoriosEnviados} onMarcarRecordatorio={marcarRecordatorio} />
        )}

        {/* ═══ LOADING ═══ */}
        {loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 8px 32px rgba(108,99,255,.4)" }}>💪</div>
            <p style={{ color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>Cargando GymFit Pro...</p>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#6c63ff,#e040fb)", animation: "slideRight 1s infinite", borderRadius: 2 }} />
            </div>
          </div>
        )}

        {/* ═══ CONFIG / SETUP ═══ */}
        {!loading && configScreen && (() => {
          const handleSaveCfg = async () => {
            if (!formCfg.nombre) return;
            const url = `${supabase.url}/rest/v1/gimnasios`;
            await fetch(url, { method: "POST", headers: { "apikey": supabase.key, "Authorization": `Bearer ${supabase.key}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" }, body: JSON.stringify({ ...formCfg, id: GYM_ID }) });
            setGymConfig(formCfg); setConfigScreen(false);
          };
          return (
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 60px" }}>
              {gymConfig && <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><button onClick={() => setConfigScreen(false)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button><h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>⚙️ Configuración</h2></div>}
              {!gymConfig && <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 8px 32px rgba(108,99,255,.4)" }}>💪</div><h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Configura tu Gimnasio</h1><p style={{ color: "#4b4b6a", fontSize: 13, marginTop: 6 }}>Esta información aparecerá en tu app</p></div>}
              {/* Logo upload */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
                <div style={{ position: "relative", width: 80, height: 80, marginBottom: 8 }}>
                  {formCfg.logo
                    ? <img src={formCfg.logo} alt="logo" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(167,139,250,.4)" }} />
                    : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>💪</div>
                  }
                  <label style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,46,.95)", border: "2px solid rgba(167,139,250,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>
                    📷
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => setFormCfg(p => ({ ...p, logo: ev.target.result }));
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
                <p style={{ color: "#4b4b6a", fontSize: 11 }}>Logo del gimnasio</p>
              </div>
              <Inp label="Nombre del gimnasio" value={formCfg.nombre} onChange={v => setFormCfg(p => ({ ...p, nombre: v }))} placeholder="Ej: GymFit Pro Mérida" />
              <Inp label="Slogan (opcional)" value={formCfg.slogan || ""} onChange={v => setFormCfg(p => ({ ...p, slogan: v }))} placeholder="Ej: Tu mejor versión empieza aquí" />
              <Inp label="Teléfono" value={formCfg.telefono || ""} onChange={v => setFormCfg(p => ({ ...p, telefono: v }))} placeholder="999 000 0000" type="tel" />
              <Inp label="Dirección" value={formCfg.direccion || ""} onChange={v => setFormCfg(p => ({ ...p, direccion: v }))} placeholder="Ej: Calle 60 #123, Mérida" />
              <Inp label="Zona horaria" value={formCfg.zona_horaria || "America/Merida"} onChange={v => setFormCfg(p => ({ ...p, zona_horaria: v }))} options={["America/Merida","America/Mexico_City","America/Cancun","America/Monterrey","America/Tijuana","America/New_York","America/Chicago","America/Los_Angeles","Europe/Madrid","America/Bogota","America/Lima","America/Santiago","America/Buenos_Aires","America/Caracas"]} />
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Planes y precios</p>
              {(formCfg.planes || DEFAULT_PLANES).map((plan, i) => {
                const isActive = plan.activo !== false;
                return (
                  <div key={i} style={{ background: isActive ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.02)", border: `1px solid ${isActive ? "rgba(167,139,250,.2)" : "rgba(255,255,255,.06)"}`, borderRadius: 14, padding: "10px 14px", marginBottom: 8, opacity: isActive ? 1 : 0.5 }}>
                    {/* Toggle row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isActive ? 10 : 0 }}>
                      <span style={{ color: isActive ? "#fff" : "#4b4b6a", fontSize: 13, fontWeight: 600 }}>{plan.nombre}</span>
                      <div onClick={() => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], activo: !isActive }; return { ...p, planes: pl }; })}
                        style={{ width: 44, height: 24, borderRadius: 12, background: isActive ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.1)", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                        <div style={{ position: "absolute", top: 3, left: isActive ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
                      </div>
                    </div>
                    {/* Fields only when active */}
                    {isActive && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Inp label="Nombre" value={plan.nombre} onChange={v => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], nombre: v }; return { ...p, planes: pl }; })} />
                        <Inp label="Precio ($)" type="number" value={String(plan.precio)} onChange={v => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], precio: Number(v) }; return { ...p, planes: pl }; })} />
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ height: 16 }} />
              <Btn full onClick={handleSaveCfg}>{gymConfig ? "Guardar cambios ✓" : "Guardar y comenzar ✓"}</Btn>
            </div>
          );
        })()}

        {/* ═══ DASHBOARD ═══ */}
        {!loading && !configScreen && screen === "dashboard" && <>
          <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {(() => {
                  const tz = gymConfig?.zona_horaria || "America/Merida";
                  const fechaStr = ahora.toLocaleDateString("es-MX", { weekday:"long", day:"2-digit", month:"short", year:"numeric", timeZone: tz });
                  const horaStr = ahora.toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: false, timeZone: tz });
                  const fechaFmt = fechaStr.replace(/\b(\w)/g, c => c.toUpperCase());
                  return (
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <p style={{ color:"#4b4b6a", fontSize:11, fontWeight:600, letterSpacing:.5, textTransform:"uppercase" }}>{fechaFmt}</p>
                      <span style={{ color:"rgba(167,139,250,.4)", fontSize:10 }}>·</span>
                      <p style={{ color:"#a78bfa", fontSize:12, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{horaStr}</p>
                    </div>
                  );
                })()}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  {gymConfig?.logo
                    ? <img src={gymConfig.logo} alt="logo" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(167,139,250,.4)", flexShrink: 0 }} />
                    : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, boxShadow: "0 2px 12px rgba(108,99,255,.4)" }}>💪</div>
                  }
                  <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{gymConfig?.nombre || "GymFit Pro"}</h1>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* WA Reminders bell */}
                <button onClick={() => setScreen("mensajes")} style={{ position: "relative", width: 40, height: 40, borderRadius: 14, border: "none", cursor: "pointer", background: totalRecordatorios > 0 ? "rgba(37,211,102,.15)" : "rgba(255,255,255,.07)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  💬
                  {totalRecordatorios > 0 && (
                    <span className="wa-pulse" style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "#f43f5e", borderRadius: "50%", border: "2px solid #13131f" }} />
                  )}
                </button>
                <button onClick={() => setConfigScreen(true)} style={{ width: 40, height: 40, borderRadius: 14, border: "none", cursor: "pointer", background: "rgba(255,255,255,.07)", fontSize: 18 }}>⚙️</button>
                <button onClick={() => setModal("quickAdd")} style={{ width: 40, height: 40, borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#6c63ff,#e040fb)", fontSize: 22, boxShadow: "0 4px 16px rgba(108,99,255,.5)" }}>⊕</button>
              </div>
            </div>

            {/* WA Reminder alert banner */}


            <div style={{ display: "flex", gap: 3, marginTop: 14, background: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4 }}>
              {TABS.map((t, i) => (
                <button key={i} onClick={() => setTab(i)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 11, cursor: "pointer", background: tab === i ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "transparent", color: tab === i ? "#fff" : "#4b4b6a", fontSize: 11, fontWeight: tab === i ? 700 : 500, fontFamily: "inherit", boxShadow: tab === i ? "0 2px 12px rgba(108,99,255,.4)" : "none", transition: "all .2s" }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px 90px" }}>
            {tab === 0 && <>
              <div className="card" style={{ background: "linear-gradient(135deg,#6c63ff 0%,#e040fb 100%)", borderRadius: 24, padding: 22, marginBottom: 14, boxShadow: "0 8px 32px rgba(108,99,255,.4)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "rgba(255,255,255,.1)", borderRadius: "50%", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: -25, right: 20, width: 90, height: 90, background: "rgba(255,255,255,.07)", borderRadius: "50%", pointerEvents: "none" }} />
                {/* Month navigator */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, position: "relative", zIndex: 1 }}>
                  <button onClick={() => navMes(-1)} style={{ background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>‹</button>
                  <p style={{ color: "rgba(255,255,255,.85)", fontSize: 12, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase" }}>UTILIDAD NETA · {mesLabel.toUpperCase()}</p>
                  <button
                    onClick={() => navMes(1)}
                    style={{
                      background: isCurrentMonth ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.15)",
                      border: "none", borderRadius: 8, width: 28, height: 28,
                      cursor: isCurrentMonth ? "default" : "pointer",
                      color: isCurrentMonth ? "rgba(255,255,255,.2)" : "#fff",
                      fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center"
                    }}>›</button>
                </div>
                <h2 style={{ color: "#fff", fontSize: 34, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "2px 0 10px" }}>{fmt(utilidad)}</h2>
                {crecUtil !== null
                  ? <><Badge val={crecUtil} /><span style={{ color: "rgba(255,255,255,.55)", fontSize: 11, marginLeft: 8 }}>vs {mesAnteriorLabel}</span></>
                  : <span style={{ color: "rgba(255,255,255,.45)", fontSize: 11 }}>Sin datos del mes anterior</span>
                }
              </div>
              <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[{ label: "Ingresos", val: totalIng, crec: crecIng, c: "#22d3ee", bg: "rgba(34,211,238,.08)", bc: "rgba(34,211,238,.2)" }, { label: "Gastos", val: totalGas, crec: crecGas, c: "#f43f5e", bg: "rgba(244,63,94,.08)", bc: "rgba(244,63,94,.2)" }].map((k, i) => (
                  <div key={i} style={{ background: k.bg, borderRadius: 20, padding: 16, border: `1px solid ${k.bc}` }}>
                    <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, letterSpacing: .6, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</p>
                    <p style={{ color: k.c, fontSize: 19, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt(k.val)}</p>
                    <div style={{ marginTop: 8 }}>
                      {k.crec !== null ? <Badge val={k.crec} /> : <span style={{ color: "#4b4b6a", fontSize: 10 }}>Sin mes anterior</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="card" style={{ background: "rgba(255,255,255,.04)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,.07)", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, letterSpacing: .6, textTransform: "uppercase" }}>Miembros activos</p>
                  <p style={{ color: "#fff", fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0" }}>{mActivos}</p>
                  <p style={{ color: "#4b4b6a", fontSize: 11 }}>{miembros.filter(m => m.estado === "Vencido").length} vencidos</p>
                </div>
                <button onClick={() => setScreen("miembros")} style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 14, padding: "10px 16px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ver todos →</button>
              </div>

              {/* ── Distribución por sexo — compacta ── */}
              <div className="card" style={{ background: "rgba(255,255,255,.04)", borderRadius: 20, padding: "12px 16px", border: "1px solid rgba(255,255,255,.07)", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>👥 Composición</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>♂️ {mHombres} <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>{miembros.length > 0 ? Math.round(mHombres/miembros.length*100) : 0}%</span></span>
                    <span style={{ color: "#f472b6", fontSize: 12, fontWeight: 700 }}>♀️ {mMujeres} <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>{miembros.length > 0 ? Math.round(mMujeres/miembros.length*100) : 0}%</span></span>
                    {mSinSexo > 0 && <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>— {mSinSexo}</span>}
                  </div>
                </div>
                {miembros.length > 0 && (
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden", display: "flex" }}>
                    <div style={{ height: "100%", width: `${Math.round(mHombres/miembros.length*100)}%`, background: "linear-gradient(90deg,#60a5fa,#3b82f6)" }} />
                    <div style={{ height: "100%", width: `${Math.round(mMujeres/miembros.length*100)}%`, background: "linear-gradient(90deg,#e040fb,#f472b6)" }} />
                  </div>
                )}
                {/* Alertas: miembros sin sexo — clickeables al perfil */}
                {miembrosSinSexo.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {miembrosSinSexo.map(m => (
                      <div key={m.id} onClick={() => { setSelM(m); setModal("detalle"); }}
                        style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(245,158,11,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                          {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>{m.nombre}</p>
                          <p style={{ color: "#92662a", fontSize: 10 }}>⚠️ Sin sexo registrado · Toca para completar</p>
                        </div>
                        <span style={{ color: "#f59e0b", fontSize: 16 }}>›</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Alertas: membresías por vencer ── */}
              {membresiasPorVencer.length > 0 && (
                <div className="card" style={{ background: "rgba(239,68,68,.05)", borderRadius: 20, padding: 16, border: "1px solid rgba(239,68,68,.2)", marginBottom: 14 }}>
                  <p style={{ color: "#f87171", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>⏰ Membresías por vencer</p>
                  {membresiasPorVencer.map(m => {
                    const yaEnviado = !!recordatoriosEnviados[m.id];
                    return (
                      <div key={m.id}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(239,68,68,.1)", opacity: yaEnviado ? 0.5 : 1, transition: "opacity .3s" }}>
                        <div onClick={() => { setMensajesMiembro(null); setModoMensajes("vencimientos"); setScreen("mensajes"); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: m.diasVence === 0 ? "rgba(239,68,68,.25)" : m.diasVence <= 1 ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: `2px solid ${m.diasVence === 0 ? "rgba(239,68,68,.6)" : m.diasVence <= 1 ? "rgba(239,68,68,.3)" : "rgba(245,158,11,.3)"}` }}>
                            {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                            <p style={{ color: "#4b4b6a", fontSize: 10, marginTop: 1 }}>
                              {m.plan && <span style={{ color: "#6b7280" }}>{m.plan} · </span>}
                              Vence: {m.vence}
                            </p>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                            <span style={{ background: m.diasVence === 0 ? "rgba(239,68,68,.25)" : m.diasVence <= 1 ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)", color: m.diasVence === 0 ? "#f87171" : m.diasVence <= 1 ? "#fca5a5" : "#fbbf24", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>
                              {m.diasVence === 0 ? "HOY 🚨" : m.diasVence === 1 ? "MAÑANA" : `${m.diasVence}d`}
                            </span>
                            <span style={{ color: "#25d366", fontSize: 10, fontWeight: 600 }}>💬 WhatsApp</span>
                          </div>
                        </div>
                        {/* Botón marcar enviado */}
                        <button
                          onClick={() => marcarRecordatorio(m.id)}
                          title={yaEnviado ? "Ya enviado hoy" : "Marcar como enviado"}
                          style={{ width: 34, height: 34, border: `1px solid ${yaEnviado ? "rgba(74,222,128,.4)" : "rgba(255,255,255,.12)"}`, borderRadius: 10, background: yaEnviado ? "rgba(74,222,128,.12)" : "transparent", cursor: "pointer", color: yaEnviado ? "#4ade80" : "#4b4b6a", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                          {yaEnviado ? "✓" : "💬"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Cumpleaños próximos ── */}
              {cumplesPróximos.length > 0 && (
                <div className="card" style={{ background: "rgba(250,204,21,.06)", borderRadius: 20, padding: 16, border: "1px solid rgba(250,204,21,.18)", marginBottom: 14 }}>
                  <p style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 12 }}>🎂 Cumpleaños esta semana</p>
                  {cumplesPróximos.map(m => (
                    <div key={m.id} className="rh" onClick={() => { setSelM(m); setModal("detalle"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(250,204,21,.08)", cursor: "pointer" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: m.diasCumple === 0 ? "linear-gradient(135deg,#fbbf24,#f59e0b)" : "rgba(250,204,21,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: m.diasCumple === 0 ? 20 : 16, overflow: "hidden", flexShrink: 0 }}>
                        {m.foto ? <img src={m.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.diasCumple === 0 ? "🎂" : "🎁")}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{m.nombre}</p>
                        <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>
                          {m.diasCumple === 0 ? "🎉 ¡Hoy!" : m.diasCumple === 1 ? "Mañana" : `En ${m.diasCumple} días`}
                          {calcEdad(m.fecha_nacimiento) !== null && ` · cumple ${calcEdad(m.fecha_nacimiento) + (m.diasCumple === 0 ? 0 : 1)} años`}
                        </p>
                      </div>
                      <span style={{ background: m.diasCumple === 0 ? "rgba(251,191,36,.2)" : "rgba(255,255,255,.06)", color: m.diasCumple === 0 ? "#fbbf24" : "#6b7280", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700 }}>
                        {m.diasCumple === 0 ? "HOY 🎂" : `${m.diasCumple}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ background: "rgba(255,255,255,.04)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Últimos movimientos</p>
                  <button onClick={() => setTab(3)} style={{ background: "none", border: "none", color: "#6c63ff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                </div>
                {txsMes.slice(-4).reverse().map(t => (
                  <div key={t.id} className="rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {(() => {
                        const mFoto = t.tipo === "ingreso" && (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                        return (
                          <div style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 14, background: t.tipo === "ingreso" ? "rgba(34,211,238,.12)" : "rgba(244,63,94,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto ? "2px solid rgba(34,211,238,.3)" : "none" }}>
                            {mFoto ? <img src={mFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                          </div>
                        );
                      })()}
                      <div>
                        <p style={{ color: "#fff", fontSize: 12, fontWeight: 500, maxWidth: 170, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                        <p style={{ color: "#4b4b6a", fontSize: 10 }}>{t.fecha}</p>
                      </div>
                    </div>
                    <p style={{ color: t.tipo === "ingreso" ? "#22d3ee" : "#f43f5e", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>{t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}</p>
                  </div>
                ))}
              </div>
            </>}

            {tab === 1 && <>
              <div className="card" style={{ background: "rgba(34,211,238,.08)", borderRadius: 20, padding: 18, border: "1px solid rgba(34,211,238,.2)", marginBottom: 14 }}>
                <p style={{ color: "#4b4b6a", fontSize: 12 }}>Total ingresos · {mesLabel}</p>
                <p style={{ color: "#22d3ee", fontSize: 30, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0 8px" }}>{fmt(totalIng)}</p>
                <Badge val={crecIng} />
              </div>
              <Btn full onClick={() => setModal("ingreso")} color="#22d3ee">+ Agregar ingreso</Btn>
              <div style={{ height: 12 }} />
              {txsMes.filter(t => t.tipo === "ingreso").map((t) => (
                <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", borderRadius: 16, padding: "14px 16px", marginBottom: 10, border: "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {(() => {
                      const mFoto2 = (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                      return (
                        <div style={{ width: 42, height: 42, borderRadius: "50%", fontSize: 18, background: "rgba(34,211,238,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto2 ? "2px solid rgba(34,211,238,.35)" : "none" }}>
                          {mFoto2 ? <img src={mFoto2} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                        </div>
                      );
                    })()}
                    <div>
                      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, maxWidth: 170, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                      <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 3 }}>{t.categoria} · 📅 {t.fecha}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <p style={{ color: "#22d3ee", fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>+{fmt(t.monto)}</p>
                    <span style={{ color: "#4b4b6a", fontSize: 13 }}>✏️</span>
                  </div>
                </div>
              ))}
            </>}

            {tab === 2 && <>
              <div className="card" style={{ background: "rgba(244,63,94,.08)", borderRadius: 20, padding: 18, border: "1px solid rgba(244,63,94,.2)", marginBottom: 14 }}>
                <p style={{ color: "#4b4b6a", fontSize: 12 }}>Total gastos · {mesLabel}</p>
                <p style={{ color: "#f43f5e", fontSize: 30, fontWeight: 700, fontFamily: "'DM Mono',monospace", margin: "4px 0 8px" }}>{fmt(totalGas)}</p>
                <Badge val={crecGas} />
              </div>
              <Btn full onClick={() => setModal("gasto")} color="#f43f5e">+ Agregar gasto</Btn>
              <div style={{ height: 12 }} />
              {txsMes.filter(t => t.tipo === "gasto").map((t) => (
                <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", borderRadius: 16, padding: "14px 16px", marginBottom: 10, border: "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, fontSize: 18, background: "rgba(244,63,94,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{CAT_ICON[t.categoria] || "📝"}</div>
                    <div>
                      <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, maxWidth: 170, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                      <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 3 }}>{t.categoria} · 📅 {t.fecha}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <p style={{ color: "#f43f5e", fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700 }}>-{fmt(t.monto)}</p>
                    <span style={{ color: "#4b4b6a", fontSize: 13 }}>✏️</span>
                  </div>
                </div>
              ))}
            </>}

            {tab === 3 && <>
              {/* ── Filtros ── */}
              <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 16, padding: "12px 14px", marginBottom: 14, border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Filtrar por fecha</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[
                      { label: "Hoy", get: () => { const t = todayISO(); return [t, t]; } },
                      { label: "Ayer", get: () => { const d = new Date(); d.setDate(d.getDate()-1); const s = d.toISOString().split("T")[0]; return [s, s]; } },
                      { label: "Mes actual", get: () => { const n = new Date(); const y = n.getFullYear(); const m = String(n.getMonth()+1).padStart(2,"0"); return [`${y}-${m}-01`, todayISO()]; } },
                    ].map(({ label, get }) => {
                      const [d, h] = get();
                      const active = filtroDesde === d && filtroHasta === h;
                      return (
                        <button key={label} onClick={() => { const [fd, fh] = get(); setFiltroDesde(fd); setFiltroHasta(fh); }}
                          style={{ padding: "4px 10px", border: `1px solid ${active ? "rgba(167,139,250,.5)" : "rgba(167,139,250,.2)"}`, borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: active ? "rgba(167,139,250,.2)" : "transparent", color: active ? "#a78bfa" : "#6b7280", transition: "all .2s" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Desde</p>
                    <input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Hasta</p>
                    <input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 10px", color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  </div>
                </div>
              </div>

              {/* ── Resumen del período ── */}
              {(() => {
                const desde = filtroDesde ? new Date(filtroDesde) : null;
                const hasta = filtroHasta ? new Date(filtroHasta + "T23:59:59") : null;
                const filtered = txs.filter(t => {
                  const td = parseDate(t.fecha);
                  if (!td) return true;
                  if (desde && td < desde) return false;
                  if (hasta && td > hasta) return false;
                  return true;
                });
                const totalIngresos = filtered.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
                const totalGastos = filtered.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0);
                const utilidad = totalIngresos - totalGastos;
                return (
                  <>
                    {/* Cards resumen */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {[
                        { label: "Ingresos", value: totalIngresos, color: "#22d3ee", bg: "rgba(34,211,238,.08)", border: "rgba(34,211,238,.15)" },
                        { label: "Gastos", value: totalGastos, color: "#f43f5e", bg: "rgba(244,63,94,.08)", border: "rgba(244,63,94,.15)" },
                        { label: "Utilidad", value: utilidad, color: utilidad >= 0 ? "#4ade80" : "#f43f5e", bg: utilidad >= 0 ? "rgba(74,222,128,.08)" : "rgba(244,63,94,.08)", border: utilidad >= 0 ? "rgba(74,222,128,.15)" : "rgba(244,63,94,.15)" },
                      ].map(card => (
                        <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                          <p style={{ color: "#6b7280", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{card.label}</p>
                          <p style={{ color: card.color, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{card.label === "Utilidad" && utilidad >= 0 ? "+" : ""}{fmt(card.value)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Lista */}
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "36px 0" }}>
                        <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
                        <p style={{ color: "#4b4b6a", fontSize: 13 }}>Sin movimientos en este período</p>
                      </div>
                    ) : filtered.map(t => (
                      <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 16, marginBottom: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {(() => {
                        const mFoto3 = t.tipo === "ingreso" && (t.miembroId || t.miembro_id) ? (miembros.find(mb => String(mb.id) === String(t.miembroId || t.miembro_id))?.foto || null) : null;
                        return (
                          <div style={{ width: 38, height: 38, borderRadius: "50%", fontSize: 15, background: t.tipo === "ingreso" ? "rgba(34,211,238,.12)" : "rgba(244,63,94,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: mFoto3 ? "2px solid rgba(34,211,238,.3)" : "none" }}>
                            {mFoto3 ? <img src={mFoto3} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : CAT_ICON[t.categoria] || "📝"}
                          </div>
                        );
                      })()}
                          <div>
                            <p style={{ color: "#fff", fontSize: 12, fontWeight: 500, maxWidth: 175, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{t.desc}</p>
                            <p style={{ color: "#4b4b6a", fontSize: 10, marginTop: 2 }}>{t.categoria} · {t.fecha}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ color: t.tipo === "ingreso" ? "#22d3ee" : "#f43f5e", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700 }}>{t.tipo === "ingreso" ? "+" : "-"}{fmt(t.monto)}</p>
                          <span style={{ color: "#4b4b6a", fontSize: 14 }}>✏️</span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </>}
          </div>
        </>}

        {/* ═══ MIEMBROS ═══ */}


        {!loading && !configScreen && screen === "miembros" && <>
          <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button onClick={() => setScreen("dashboard")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
              <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Miembros</h1>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => setScreen("mensajes")} style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, padding: "8px 12px", color: "#25d366", fontSize: 18, cursor: "pointer" }}>📢</button>
                <button onClick={() => { const ini = todayISO(); const firstPlan = activePlanes[0] || DEFAULT_PLANES[0]; setFM({ nombre: "", tel: "", plan: firstPlan.nombre, monto: String(firstPlan.precio), foto: null }); setModal("miembro"); }} style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Nuevo</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[{ label: "Activos", val: "Activo", count: miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length, c: "#4ade80", bg: "rgba(74,222,128," }, { label: "Vencidos", val: "Vencido", count: miembros.filter(m => { const s = getMembershipInfo(m.id, txs, m).estado; return s === "Vencido" || s === "Sin membresía"; }).length, c: "#f87171", bg: "rgba(248,113,113," }, { label: "Todos", val: "Todos", count: miembros.length, c: "#a78bfa", bg: "rgba(167,139,250," }].map((s, i) => {
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
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 90px" }}>
            {(() => {
              const q = busqueda.toLowerCase();
              const lista = miembros.filter(m => { const est = getMembershipInfo(m.id, txs, m).estado; const matchEstado = filtroEstado === "Todos" || (filtroEstado === "Activo" && est === "Activo") || (filtroEstado === "Vencido" && (est === "Vencido" || est === "Sin membresía")); return matchEstado; }).filter(m => !q || m.nombre.toLowerCase().includes(q) || (m.tel || "").includes(q));
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
                          {/* Foto */}
                          <div style={{ width: 58, height: 58, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff44,#e040fb44)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4b5fd", fontWeight: 700, fontSize: 22, overflow: "hidden", flexShrink: 0, boxShadow: `0 0 0 2px ${estadoColor}50` }}>
                            {m.foto ? <img src={m.foto} alt={m.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : m.nombre.charAt(0)}
                          </div>
                          {/* Nombre */}
                          <p style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.nombre}</p>
                          {/* Estado */}
                          <span style={{ background: estadoBg, color: estadoColor, borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{mi.estado}</span>
                          {/* Vence */}
                          {mi.vence && <p style={{ color: "#4b4b6a", fontSize: 10 }}>Vence {mi.vence}</p>}
                          {/* Pago rápido */}
                          <button onClick={e => { e.stopPropagation(); setSelM(m); setModal("detalle"); setTimeout(() => document.dispatchEvent(new CustomEvent("openPagoModal", { detail: m.id })), 100); }}
                            style={{ width: "100%", border: "1px solid rgba(34,211,238,.25)", background: "rgba(34,211,238,.07)", color: "#22d3ee", borderRadius: 10, padding: "6px 0", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: "auto" }}>+ Pago</button>
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
                        <p style={{ color: "#4b4b6a", fontSize: 11 }}>Vence: {mi.vence || "Por definir"}</p>
                        {showWA && <span style={{ background: "rgba(37,211,102,.15)", color: "#25d366", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>💬 {dias === 0 ? "hoy" : dias === 1 ? "mañana" : `${dias}d`}</span>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); setSelM(m); setModal("detalle"); setTimeout(() => document.dispatchEvent(new CustomEvent("openPagoModal", { detail: m.id })), 100); }} style={{ border: "1px solid rgba(34,211,238,.3)", background: "rgba(34,211,238,.08)", color: "#22d3ee", borderRadius: 10, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Pago</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </>}

        {/* ═══ ESTADÍSTICAS ═══ */}
        {!loading && !configScreen && screen === "estadisticas" && (() => {
          const now = new Date();
          // Build last 12 months of data
          const mesesData = Array.from({ length: 12 }, (_, i) => {
            let m = now.getMonth() - (11 - i);
            let y = now.getFullYear();
            while (m < 0) { m += 12; y--; }
            const label = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m];
            const ing = txs.filter(t => { const d = parseDate(t.fecha); return d && d.getFullYear() === y && d.getMonth() === m && t.tipo === "ingreso"; }).reduce((s, t) => s + Number(t.monto), 0);
            const gas = txs.filter(t => { const d = parseDate(t.fecha); return d && d.getFullYear() === y && d.getMonth() === m && t.tipo === "gasto"; }).reduce((s, t) => s + Number(t.monto), 0);
            const util = ing - gas;
            const isCurrent = y === now.getFullYear() && m === now.getMonth();
            return { label, year: y, month: m, ing, gas, util, isCurrent };
          });
          const maxVal = Math.max(...mesesData.map(d => Math.max(d.ing, d.gas, 1)));
          const totalIngYear = mesesData.reduce((s, d) => s + d.ing, 0);
          const totalGasYear = mesesData.reduce((s, d) => s + d.gas, 0);
          const totalUtilYear = totalIngYear - totalGasYear;
          const mejorMes = mesesData.reduce((a, b) => b.util > a.util ? b : a, mesesData[0]);
          const BAR_H = 120;
          return (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <button onClick={() => setScreen("dashboard")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
                  <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>📊 Estadísticas</h1>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 100px", minHeight: 0, height: 0 }}>
                {/* Annual summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                  {[
                    { label: "Ingresos anuales", val: totalIngYear, c: "#22d3ee", bg: "rgba(34,211,238,.08)", bc: "rgba(34,211,238,.18)" },
                    { label: "Gastos anuales", val: totalGasYear, c: "#f43f5e", bg: "rgba(244,63,94,.08)", bc: "rgba(244,63,94,.18)" },
                    { label: "Utilidad anual", val: totalUtilYear, c: totalUtilYear >= 0 ? "#4ade80" : "#f87171", bg: totalUtilYear >= 0 ? "rgba(74,222,128,.08)" : "rgba(248,113,113,.08)", bc: totalUtilYear >= 0 ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)" },
                  ].map((k, i) => (
                    <div key={i} style={{ background: k.bg, border: `1px solid ${k.bc}`, borderRadius: 16, padding: "12px 10px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginBottom: 4 }}>{k.label}</p>
                      <p style={{ color: k.c, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt(k.val)}</p>
                    </div>
                  ))}
                </div>
                {/* Mejor mes */}
                <div style={{ background: "linear-gradient(135deg,rgba(108,99,255,.15),rgba(224,64,251,.1))", border: "1px solid rgba(108,99,255,.25)", borderRadius: 16, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "#a78bfa", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, marginBottom: 3 }}>🏆 Mejor mes</p>
                    <p style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{mejorMes.label} {mejorMes.year}</p>
                  </div>
                  <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{fmt(mejorMes.util)}</p>
                </div>
                {/* Tab selector */}
                <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
                  {["Utilidad", "Ingresos", "Gastos"].map((label, i) => (
                    <button key={i} onClick={() => setStatsTab(i)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                      background: statsTab === i ? (i === 0 ? "linear-gradient(135deg,#6c63ff,#e040fb)" : i === 1 ? "linear-gradient(135deg,#22d3ee,#06b6d4)" : "linear-gradient(135deg,#f43f5e,#fb923c)") : "transparent",
                      color: statsTab === i ? "#fff" : "#4b4b6a", fontSize: 12, fontWeight: statsTab === i ? 700 : 500,
                      boxShadow: statsTab === i ? "0 2px 12px rgba(108,99,255,.3)" : "none", transition: "all .2s" }}>{label}</button>
                  ))}
                </div>
                {/* Bar chart */}
                <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, padding: "20px 16px 12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: BAR_H + 24, justifyContent: "space-between" }}>
                    {mesesData.map((d, i) => {
                      const val = statsTab === 0 ? d.util : statsTab === 1 ? d.ing : d.gas;
                      const color = statsTab === 0 ? (val >= 0 ? "#4ade80" : "#f87171") : statsTab === 1 ? "#22d3ee" : "#f43f5e";
                      const barH = maxVal > 0 ? Math.abs(val) / maxVal * BAR_H : 0;
                      const isActive = d.year === selMes.year && d.month === selMes.month;
                      return (
                        <div key={i} onClick={() => { setSelMes({ year: d.year, month: d.month }); setScreen("dashboard"); }}
                          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 4 }}>
                          <div style={{ width: "100%", height: BAR_H, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                            <div style={{ width: "80%", height: Math.max(barH, 3), borderRadius: "4px 4px 0 0",
                              background: isActive ? "#fff" : (d.isCurrent ? color : `${color}99`),
                              boxShadow: isActive ? "0 0 12px rgba(255,255,255,.4)" : "none",
                              transition: "height .3s ease" }} />
                          </div>
                          <p style={{ color: isActive ? "#fff" : "#4b4b6a", fontSize: 9, fontWeight: isActive ? 700 : 500 }}>{d.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Month detail list */}
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Detalle por mes</p>
                  {[...mesesData].reverse().map((d, i) => (
                    <div key={i} onClick={() => { setSelMes({ year: d.year, month: d.month }); setScreen("dashboard"); }}
                      style={{ background: d.isCurrent ? "rgba(108,99,255,.12)" : "rgba(255,255,255,.03)", border: d.isCurrent ? "1px solid rgba(108,99,255,.3)" : "1px solid rgba(255,255,255,.06)", borderRadius: 16, padding: "12px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{d.label} {d.year} {d.isCurrent ? <span style={{ color: "#a78bfa", fontSize: 10, marginLeft: 6 }}>· Actual</span> : ""}</p>
                        <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                          <span style={{ color: "#22d3ee", fontSize: 11 }}>↑ {fmt(d.ing)}</span>
                          <span style={{ color: "#f43f5e", fontSize: 11 }}>↓ {fmt(d.gas)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ color: d.util >= 0 ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{d.util >= 0 ? "+" : ""}{fmt(d.util)}</p>
                        <p style={{ color: "#4b4b6a", fontSize: 10, marginTop: 2 }}>utilidad</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Calendario ── */}
              {(() => {
                // Contar eventos del mes actual para mostrar badge
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
                    style={{ width: "100%", marginTop: 4, marginBottom: 4, padding: "14px 16px", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, cursor: "pointer", fontFamily: "inherit", background: "rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,rgba(108,99,255,.3),rgba(224,64,251,.3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📅</div>
                      <div style={{ textAlign: "left" }}>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Calendario</p>
                        <p style={{ color: "#4b4b6a", fontSize: 11 }}>Cumpleaños y vencimientos</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {evCount > 0 && <span style={{ background: "rgba(167,139,250,.2)", color: "#a78bfa", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{evCount} este mes</span>}
                      <span style={{ color: "#4b4b6a", fontSize: 16 }}>›</span>
                    </div>
                  </button>
                );
              })()}

              {/* ── Reporte PDF ── */}
              <div style={{ marginTop: 20, marginBottom: 20, background: "rgba(255,255,255,.04)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,.07)" }}>
                <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📄 Descargar reporte mensual</p>
                <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 14 }}>Genera un PDF con el resumen financiero y lista de miembros del mes seleccionado.</p>
                <ReportePDF txs={txs} miembros={miembros} gymConfig={gymConfig} getMembershipInfo={getMembershipInfo} MESES_LABEL={MESES_LABEL} />
              </div>
            </div>
          );
        })()}

        {/* ═══ MODAL CALENDARIO ═══ */}
        {modal === "calendario" && (
          <div style={{ position: "absolute", inset: 0, background: "#13131f", zIndex: 150, display: "flex", flexDirection: "column", borderRadius: "inherit" }}>
            <div style={{ padding: "16px 20px 0", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setModal(null)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
              <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>📅 Calendario</h1>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px", minHeight: 0 }}>
              <CalendarioEventos miembros={miembros} txs={txs} getMembershipInfo={getMembershipInfo} />
            </div>
          </div>
        )}

        {/* ═══ BOTTOM NAV ═══ */}
        {!configScreen && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(10,10,18,.96)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.07)", padding: "10px 8px 26px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {[
            { label: "Inicio", icon: "⌂", s: "dashboard", t: null },
            { label: "Miembros", icon: "◎", s: "miembros", t: null },
            { label: "", icon: "⊕", accent: true },
            { label: "Mensajes", icon: "💬", s: "mensajes", t: null, badge: totalRecordatorios },
            { label: "Stats", icon: "📊", s: "estadisticas", t: null }
          ].map((n, i) => (
            <button key={i} onClick={() => { if (n.accent) { setModal("quickAdd"); return; } setScreen(n.s); if (n.t !== null) setTab(n.t); }} style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1, position: "relative" }}>
              {n.accent ? (
                <div style={{ width: 50, height: 50, borderRadius: 17, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 4px 20px rgba(108,99,255,.55)", marginTop: -22 }}>{n.icon}</div>
              ) : (
                <>
                  <span style={{ fontSize: 20, color: screen === n.s ? "#a78bfa" : "#4b4b6a", transition: "color .2s" }}>{n.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "inherit", color: screen === n.s ? "#a78bfa" : "#4b4b6a", transition: "color .2s" }}>{n.label}</span>
                  {n.badge > 0 && <span className="wa-pulse" style={{ position: "absolute", top: 0, right: "18%", width: 8, height: 8, background: "#f43f5e", borderRadius: "50%", border: "2px solid #13131f" }} />}
                </>
              )}
            </button>
          ))}
        </div>}

        {/* ═══ MODALS ═══ */}
        {modal === "quickAdd" && <Modal title="¿Qué deseas agregar?" onClose={() => setModal(null)}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{[{ label: "Ingreso", icon: "💰", color: "#22d3ee", action: () => setModal("ingreso") }, { label: "Gasto", icon: "💸", color: "#f43f5e", action: () => setModal("gasto") }, { label: "Miembro", icon: "👤", color: "#a78bfa", action: () => { const ini = todayISO(); const firstPlan = activePlanes[0] || DEFAULT_PLANES[0]; setFM({ nombre: "", tel: "", plan: firstPlan.nombre, monto: String(firstPlan.precio), foto: null }); setModal("miembro"); } }].map((opt, i) => <button key={i} onClick={opt.action} style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30`, borderRadius: 18, padding: "20px 0", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 28 }}>{opt.icon}</span><span style={{ color: opt.color, fontSize: 13, fontWeight: 700 }}>{opt.label}</span></button>)}</div></Modal>}

        {modal === "ingreso" && <Modal title="💰 Nuevo Ingreso" onClose={() => setModal(null)}><Inp label="Categoría" value={fI.cat} onChange={v => setFI(p => ({ ...p, cat: v }))} options={CAT_ING} /><Inp label="Descripción" value={fI.desc} onChange={v => setFI(p => ({ ...p, desc: v }))} placeholder="Ej: Membresía mensual" /><Inp label="Monto ($)" type="number" value={fI.monto} onChange={v => setFI(p => ({ ...p, monto: v }))} placeholder="0.00" /><Inp label="Fecha" type="date" value={fI.fecha} onChange={v => setFI(p => ({ ...p, fecha: v }))} /><Btn full onClick={addIng} color="#22d3ee">Guardar ingreso ✓</Btn></Modal>}

        {modal === "gasto" && <Modal title="💸 Nuevo Gasto" onClose={() => setModal(null)}><Inp label="Categoría" value={fG.cat} onChange={v => setFG(p => ({ ...p, cat: v }))} options={CAT_GAS} /><Inp label="Descripción" value={fG.desc} onChange={v => setFG(p => ({ ...p, desc: v }))} placeholder="Ej: Pago de nómina" /><Inp label="Monto ($)" type="number" value={fG.monto} onChange={v => setFG(p => ({ ...p, monto: v }))} placeholder="0.00" /><Inp label="Fecha" type="date" value={fG.fecha} onChange={v => setFG(p => ({ ...p, fecha: v }))} /><Btn full onClick={addGas} color="#f43f5e">Guardar gasto ✓</Btn></Modal>}

        {modal === "miembro" && (
          <Modal title="👤 Nuevo Miembro" onClose={() => setModal(null)}>
            {/* Avatar + foto */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
              <div style={{ position: "relative", width: 72, height: 72, marginBottom: 8 }}>
                {fM.foto
                  ? <img src={fM.foto} alt="" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(167,139,250,.4)" }} />
                  : <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: 700 }}>👤</div>
                }
                <label style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: "rgba(30,30,46,.95)", border: "2px solid rgba(167,139,250,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer" }}>
                  📷
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async ev => {
                      const resized = await resizeImage(ev.target.result, 300, 0.75);
                      setFM(p => ({ ...p, foto: resized }));
                    };
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>
              <p style={{ color: "#4b4b6a", fontSize: 11 }}>Toca 📷 para agregar foto</p>
            </div>
            <Inp label="Nombre completo" value={fM.nombre} onChange={v => setFM(p => ({ ...p, nombre: v }))} placeholder="Ej: Juan Pérez" />
            <Inp label="Teléfono" type="tel" value={fM.tel || ""} onChange={v => setFM(p => ({ ...p, tel: v }))} placeholder="999 000 0000" />

            {/* Fecha de incorporación */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>Fecha de incorporación <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>(opcional)</span></p>
              <button onClick={() => setFM(p => ({ ...p, fecha_incorporacion: todayISO() }))}
                style={{ padding: "3px 10px", border: `1px solid ${fM.fecha_incorporacion === todayISO() ? "rgba(167,139,250,.5)" : "rgba(167,139,250,.25)"}`, borderRadius: 20, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700, background: fM.fecha_incorporacion === todayISO() ? "rgba(167,139,250,.2)" : "transparent", color: fM.fecha_incorporacion === todayISO() ? "#a78bfa" : "#6b7280", transition: "all .2s" }}>
                Hoy
              </button>
            </div>
            <input type="date" value={fM.fecha_incorporacion || ""} onChange={e => setFM(p => ({ ...p, fecha_incorporacion: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: fM.fecha_incorporacion ? "#fff" : "#3d3d5c", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 14 }} />

            {/* Sexo */}
            <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: .5 }}>Sexo</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[{ val: "Masculino", icon: "♂️", color: "#60a5fa" }, { val: "Femenino", icon: "♀️", color: "#f472b6" }, { val: "", icon: "—", color: "#6b7280" }].map(op => (
                <button key={op.val} onClick={() => setFM(p => ({ ...p, sexo: op.val }))}
                  style={{ flex: 1, padding: "10px 0", border: (fM.sexo || "") === op.val ? `2px solid ${op.color}` : "1.5px solid rgba(255,255,255,.08)", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", background: (fM.sexo || "") === op.val ? `${op.color}20` : "rgba(255,255,255,.04)", color: (fM.sexo || "") === op.val ? op.color : "#4b4b6a", fontSize: 12, fontWeight: 700, transition: "all .2s" }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{op.icon}</div>
                  {op.val || "N/E"}
                </button>
              ))}
            </div>

            {/* Fecha de nacimiento */}
            <p style={{ color: "#6b7280", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>Fecha de nacimiento <span style={{ color: "#4b4b6a", fontWeight: 400, fontSize: 10 }}>(opcional)</span></p>
            <input type="date" value={fM.fecha_nacimiento || ""} onChange={e => setFM(p => ({ ...p, fecha_nacimiento: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "12px 14px", color: fM.fecha_nacimiento ? "#fff" : "#3d3d5c", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 16 }} />

            {/* Clase prueba */}
            <button onClick={() => setFM(p => ({ ...p, clasePrueba: !p.clasePrueba }))}
              style={{ width: "100%", padding: "14px 16px", border: fM.clasePrueba ? "2px solid rgba(245,158,11,.5)" : "1.5px solid rgba(255,255,255,.08)", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", background: fM.clasePrueba ? "rgba(245,158,11,.08)" : "rgba(255,255,255,.04)", display: "flex", alignItems: "center", gap: 12, marginBottom: fM.clasePrueba ? 10 : 16, transition: "all .2s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: fM.clasePrueba ? "2px solid #f59e0b" : "2px solid rgba(255,255,255,.15)", background: fM.clasePrueba ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .2s" }}>
                {fM.clasePrueba && <span style={{ color: "#000", fontSize: 13, fontWeight: 900 }}>✓</span>}
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ color: fM.clasePrueba ? "#f59e0b" : "#9ca3af", fontSize: 13, fontWeight: 700 }}>🏋️ Clase prueba</p>
                <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 1 }}>Sin membresía — registra la visita inicial</p>
              </div>
            </button>

            {fM.clasePrueba && (
              <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: .5 }}>Fecha de la clase prueba</p>
                <input type="date" value={fM.fechaPrueba || todayISO()} onChange={e => setFM(p => ({ ...p, fechaPrueba: e.target.value }))}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
              </div>
            )}

            <Btn full onClick={addM}>Registrar miembro ✓</Btn>
          </Modal>
        )}

        {modal === "detalle" && selM && (
          <MemberDetailModal
            m={selM} txs={txs}
            onClose={() => setModal(null)}
            onSave={saveMiembro}
            onToggleEstado={toggleEstado}
            onAddPago={addPago}
            onDone={() => { /* quedarse en el perfil */ }}
            planesActivos={PLANES_ACTIVOS}
            planPrecioActivo={PLAN_PRECIO_ACTIVO}
            onEditTx={t => { setEditTx(t); setModal("editTx"); }}
            gymConfig={gymConfig}
            onUpdatePlantillas={updatePlantillas}
            onDelete={deleteMiembro}
            onGoToMensajes={(miembro) => { setMensajesMiembro(miembro); setModal(null); setScreen("mensajes"); }}
          />
        )}

        {modal === "editTx" && editTx && <EditTxModal tx={editTx} onClose={() => { setModal(null); setEditTx(null); }} onSave={saveEditTx} onDelete={deleteEditTx} />}

      </div>
    </div>
  );
}
