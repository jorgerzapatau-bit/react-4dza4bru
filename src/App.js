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
// ── Calcula membresía activa desde transacciones ──
function getMembershipInfo(miembroId, txs) {
  const memTxs = txs
    .filter(t => t.categoria === "Membresías" && (String(t.miembroId) === String(miembroId) || String(t.miembro_id) === String(miembroId)))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  if (memTxs.length === 0) return { estado: "Sin membresía", vence: null, inicio: null, plan: null, monto: null };
  const ultima = memTxs[0];
  const descStr = ultima.desc || ultima.descripcion || "";
  const planMatch = descStr.match(/Renovación (\w+)/) || descStr.match(/(Mensual|Trimestral|Semestral|Anual)/);
  const plan = planMatch ? planMatch[1] : "Mensual";
  const mesesPlan = { "Mensual": 1, "Trimestral": 3, "Semestral": 6, "Anual": 12 };
  const meses = mesesPlan[plan] || 1;
  const fechaTx = parseDate(ultima.fecha);
  let vence = null;
  if (fechaTx) {
    const v = new Date(fechaTx);
    v.setMonth(v.getMonth() + meses);
    const MESES_N = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    vence = `${String(v.getDate()).padStart(2,"0")} ${MESES_N[v.getMonth()]} ${v.getFullYear()}`;
  }
  const dias = vence ? diasParaVencer(vence) : null;
  const estado = dias !== null && dias >= 0 ? "Activo" : "Vencido";
  return { estado, vence, inicio: ultima.fecha, plan, monto: ultima.monto };
}

// Build WhatsApp message
function buildWAMsg(miembro, diasReales) {
  const nombre = miembro.nombre.split(" ")[0];
  if (diasReales === 0) return `u00a1Hola ${nombre}! ud83dudea8 Tu membresu00eda *${miembro.plan}* en *GymFit Pro* vence *HOY*. Renueva ahora para no perder tu acceso ud83dudcaa u2014 *GymFit Pro*`;
  if (diasReales === 1) return `u00a1Hola ${nombre}! ud83dudea8 Tu membresu00eda vence *mau00f1ana* (${miembro.vence}). Renueva hoy para no perder ni un du00eda de entrenamiento ud83dudcaa u2014 *GymFit Pro*`;
  if (diasReales <= 3) return `u00a1Hola ${nombre}! u23f0 Tu membresu00eda *${miembro.plan}* vence en *${diasReales} du00edas* (${miembro.vence}). No pierdas tu acceso al gym. Renueva ahora y sigue entrenando ud83dudd25`;
  return `u00a1Hola ${nombre}! ud83dudc4b Te recordamos que tu membresu00eda *${miembro.plan}* en *GymFit Pro* vence en *${diasReales} du00edas* (${miembro.vence}). u00bfDeseas renovarla? ud83dudcaa`;
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
  const d = new Date(inicioISO);
  d.setMonth(d.getMonth() + (PLAN_MESES[plan] || 1));
  return d.toISOString().split("T")[0];
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
function RecordatoriosScreen({ miembros, onBack }) {
  const [enviados, setEnviados] = useState({});
  const [filtro, setFiltro] = useState("todos");

  const alertas = useMemo(() => {
    const result = [];
    miembros.filter(m => getMembershipInfo(m.id, txs).estado === "Activo").forEach(m => {
      const diasReales = diasParaVencer(getMembershipInfo(m.id, txs).vence);
      if (diasReales === null || diasReales < 0 || diasReales > 5) return;
      // Tier for colors: 1=urgent(0-1d), 3=soon(2-3d), 5=notice(4-5d)
      const tier = diasReales <= 1 ? 1 : diasReales <= 3 ? 3 : 5;
      result.push({ miembro: m, dias: tier, diasReales });
    });
    result.sort((a, b) => a.diasReales - b.diasReales);
    return result;
  }, [miembros]);

  const filtered = filtro === "todos" ? alertas : alertas.filter(a => a.dias === parseInt(filtro));

  const urgencyConfig = {
    1: { color: "#f43f5e", bg: "rgba(244,63,94,.12)", border: "rgba(244,63,94,.25)", label: "🚨 Vence mañana", badge: "URGENTE" },
    3: { color: "#f59e0b", bg: "rgba(245,158,11,.12)", border: "rgba(245,158,11,.25)", label: "⏰ 3 días", badge: "PRÓXIMO" },
    5: { color: "#22d3ee", bg: "rgba(34,211,238,.12)", border: "rgba(34,211,238,.25)", label: "📅 5 días", badge: "AVISO" },
  };

  const handleEnviar = (miembro, diasReales) => {
    const msg = buildWAMsg(miembro, diasReales);
    const url = buildWAUrl(miembro.tel, msg);
    window.open(url, "_blank");
    setEnviados(prev => ({ ...prev, [miembro.id]: true }));
  };

  const handleEnviarTodos = () => {
    filtered.forEach(({ miembro, diasReales }) => {
      const key = miembro.id;
      if (!enviados[key]) {
        const msg = buildWAMsg(miembro, diasReales);
        const url = buildWAUrl(miembro.tel, msg);
        window.open(url, "_blank");
        setEnviados(prev => ({ ...prev, [key]: true }));
      }
    });
  };

  const pendientes = filtered.filter(({ miembro }) => !enviados[miembro.id]).length;

  return (
    <>
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
          <div>
            <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Recordatorios</h1>
            <p style={{ color: "#4b4b6a", fontSize: 11 }}>WhatsApp · Vencimientos próximos</p>
          </div>
          {pendientes > 0 && (
            <div style={{ marginLeft: "auto", background: "linear-gradient(135deg,#25d366,#128c7e)", borderRadius: 10, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 14 }}>💬</span>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{pendientes}</span>
            </div>
          )}
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[
            { dias: 1, icon: "🚨", color: "#f43f5e", label: "Mañana" },
            { dias: 3, icon: "⏰", color: "#f59e0b", label: "3 días" },
            { dias: 5, icon: "📅", color: "#22d3ee", label: "5 días" },
          ].map(({ dias, icon, color, label }) => {
            const count = alertas.filter(a => a.dias === dias).length;
            const active = filtro === String(dias);
            return (
              <button key={dias} onClick={() => setFiltro(active ? "todos" : String(dias))}
                style={{ background: active ? `${color}20` : "rgba(255,255,255,.04)", border: active ? `1.5px solid ${color}50` : "1.5px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "10px 6px", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                <p style={{ fontSize: 18, marginBottom: 2 }}>{icon}</p>
                <p style={{ color: active ? color : "#fff", fontSize: 18, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{count}</p>
                <p style={{ color: active ? color : "#4b4b6a", fontSize: 10, fontWeight: 600, marginTop: 2 }}>{label}</p>
              </button>
            );
          })}
        </div>

        {pendientes > 0 && (
          <button onClick={handleEnviarTodos} style={{
            width: "100%", padding: "13px", border: "none", borderRadius: 14, cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            background: "linear-gradient(135deg,#25d366,#128c7e)",
            color: "#fff", boxShadow: "0 4px 18px rgba(37,211,102,.35)", marginBottom: 14,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8
          }}>
            <span style={{ fontSize: 18 }}>💬</span>
            Enviar todos los pendientes ({pendientes})
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 90px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 0" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🎉</p>
            <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700 }}>¡Sin recordatorios pendientes!</p>
            <p style={{ color: "#4b4b6a", fontSize: 12, marginTop: 6 }}>Todos los miembros tienen su membresía al día</p>
          </div>
        ) : (
          filtered.map(({ miembro, dias, diasReales }) => {
            const cfg = urgencyConfig[dias];
            const key = miembro.id;
            const enviado = !!enviados[key];
            const msg = buildWAMsg(miembro, diasReales);

            return (
              <div key={key} className="card" style={{
                background: enviado ? "rgba(255,255,255,.03)" : cfg.bg,
                borderRadius: 18, padding: "14px 16px", marginBottom: 12,
                border: `1px solid ${enviado ? "rgba(255,255,255,.06)" : cfg.border}`,
                opacity: enviado ? 0.6 : 1, transition: "all .3s"
              }}>
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: enviado ? "rgba(255,255,255,.08)" : `linear-gradient(135deg,${cfg.color}44,${cfg.color}22)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: cfg.color, fontWeight: 700, fontSize: 18, overflow: "hidden",
                      boxShadow: miembro.foto ? `0 0 0 2px ${cfg.color}60` : "none"
                    }}>{miembro.foto ? <img src={miembro.foto} alt={miembro.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : miembro.nombre.charAt(0)}</div>
                    <div>
                      <p style={{ color: enviado ? "#4b4b6a" : "#fff", fontSize: 14, fontWeight: 700 }}>{miembro.nombre}</p>
                      <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 2 }}>Plan {miembro.plan} · 📱 {miembro.tel || "—"}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      background: enviado ? "rgba(74,222,128,.15)" : `${cfg.color}25`,
                      color: enviado ? "#4ade80" : cfg.color,
                      borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 700, display: "block", marginBottom: 4
                    }}>{enviado ? "✓ ENVIADO" : cfg.badge}</span>
                    <p style={{ color: enviado ? "#4b4b6a" : cfg.color, fontSize: 11, fontWeight: 600 }}>
                      {diasReales === 0 ? "Vence hoy" : diasReales === 1 ? "Vence mañana" : `${diasReales} días`}
                    </p>
                  </div>
                </div>

                {/* Vence info */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)", marginBottom: 10 }}>
                  <p style={{ color: "#4b4b6a", fontSize: 11 }}>📅 Vence: <span style={{ color: "#fff", fontWeight: 600 }}>{miembro.vence}</span></p>
                  <p style={{ color: "#22d3ee", fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700 }}>{fmt(miembro.monto)}</p>
                </div>

                {/* Preview del mensaje */}
                <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 10px", marginBottom: 10, borderLeft: `3px solid ${cfg.color}60` }}>
                  <p style={{ color: "#4b4b6a", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Mensaje</p>
                  <p style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.5 }}>{msg}</p>
                </div>

                {/* Action button */}
                <button
                  onClick={() => handleEnviar(miembro, diasReales)}
                  style={{
                    width: "100%", padding: "11px", border: "none", borderRadius: 12, cursor: enviado ? "default" : "pointer",
                    fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    background: enviado ? "rgba(74,222,128,.12)" : "linear-gradient(135deg,#25d366,#128c7e)",
                    color: enviado ? "#4ade80" : "#fff",
                    boxShadow: enviado ? "none" : "0 4px 14px rgba(37,211,102,.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    transition: "all .2s"
                  }}
                >
                  <span style={{ fontSize: 16 }}>{enviado ? "✓" : "💬"}</span>
                  {enviado ? "Mensaje enviado" : "Enviar por WhatsApp"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
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

  const takePhoto = () => {
    const vid = document.getElementById("gymfit-video");
    if (!vid) return;
    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 320;
    canvas.height = vid.videoHeight || 320;
    canvas.getContext("2d").drawImage(vid, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setPreview(dataUrl);
    setMode("preview");
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPreview(ev.target.result); setMode("preview"); };
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

/* ─── MEMBER DETAIL MODAL ─── */
function MemberDetailModal({ m, txs, onClose, onSave, onToggleEstado, onAddPago, onDone, planesActivos, planPrecioActivo, onEditTx }) {
  const [detTab, setDetTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const memInfo = getMembershipInfo(m.id, txs);
  const [form, setForm] = useState({ nombre: m.nombre, tel: m.tel || "", fecha_incorporacion: m.fecha_incorporacion || "" });
  const [pagoModal, setPagoModal] = useState(false);
  useEffect(() => {
    const handler = e => { if (e.detail === m.id) { setDetTab("historial"); setPagoModal(true); } };
    document.addEventListener("openPagoModal", handler);
    return () => document.removeEventListener("openPagoModal", handler);
  }, [m.id]);
  const [photoModal, setPhotoModal] = useState(false);
  const [renovarModal, setRenovarModal] = useState(false);
  const [mensajeWA, setMensajeWA] = useState("");
  const defaultPlan = memInfo.plan || (planesActivos && planesActivos[0]) || "Mensual";
  const defaultMonto = memInfo.monto || (planPrecioActivo && planPrecioActivo[defaultPlan]) || (PLAN_PRECIO && PLAN_PRECIO[defaultPlan]) || "";
  const [renovar, setRenovar] = useState({ plan: defaultPlan, monto: String(defaultMonto), inicio: todayISO(), vence: calcVence(todayISO(), defaultPlan) });
  const [pago, setPago] = useState({ monto: String(defaultMonto), desc: "", fecha: todayISO() });

  const historial = txs.filter(t => String(t.miembroId) === String(m.id) || String(t.miembro_id) === String(m.id)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const hasChanges = form.nombre !== m.nombre || form.tel !== (m.tel || "") || form.fecha_incorporacion !== (m.fecha_incorporacion || "");
  const handleSave = () => {
    if (!hasChanges) return;
    onSave({ ...m, nombre: form.nombre, tel: form.tel, fecha_incorporacion: form.fecha_incorporacion });
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
    if (!renovar.monto || !renovar.inicio) return;
    const descText = `Renovación ${renovar.plan} - ${m.nombre}`;
    await onAddPago({ id: uid(), tipo: "ingreso", categoria: "Membresías",
      desc: descText, descripcion: descText,
      monto: Number(renovar.monto), fecha: today(), miembroId: m.id });
    setRenovarModal(false);
    onDone();
  };

  // WA quick send from profile
  const diasRestantes = diasParaVencer(memInfo.vence);
  const waUmbral = diasRestantes !== null && diasRestantes <= 5 && diasRestantes >= 0
    ? (diasRestantes <= 1 ? 1 : diasRestantes <= 3 ? 3 : 5)
    : null;

  return (
    <Modal title="Perfil del miembro" onClose={onClose}>
      {photoModal && <PhotoModal onClose={() => setPhotoModal(false)} onCapture={handlePhoto} />}

      {renovarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ width: "100%", background: "#1a1a2e", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", animation: "slideUp .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>🔄 Renovar membresía</h2>
              <button onClick={() => setRenovarModal(false)} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 18 }}>
              {(() => {
                const dias = diasParaVencer(m.vence);
                return dias !== null && dias > 0
                  ? `¡Le quedan ${dias} día${dias !== 1 ? "s" : ""} a la membresía actual! El inicio sugerido es desde su fecha de vencimiento para no perder días.`
                  : "La membresía está vencida. El inicio sugerido es hoy.";
              })()}
            </p>
            <Inp label="Plan" value={renovar.plan} onChange={v => setRenovar(p => ({ ...p, plan: v, monto: String((planPrecioActivo || PLAN_PRECIO_ACTIVO || {})[v] || PLAN_PRECIO[v] || p.monto), vence: calcVence(p.inicio, v) }))} options={planesActivos || PLANES_ACTIVOS} />
            <Inp label="Monto ($)" type="number" value={renovar.monto} onChange={v => setRenovar(p => ({ ...p, monto: v }))} placeholder="0.00" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Inicio</p>
                <input type="date" value={renovar.inicio} min={todayISO()}
                  onChange={e => {
                    const v = e.target.value;
                    if (v < todayISO()) return;
                    setRenovar(p => ({ ...p, inicio: v, vence: calcVence(v, p.plan) }));
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12 }} />
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: .5 }}>Vencimiento</p>
                <input type="date" value={renovar.vence} min={renovar.inicio || todayISO()}
                  onChange={e => {
                    const v = e.target.value;
                    if (v < (renovar.inicio || todayISO())) return;
                    setRenovar(p => ({ ...p, vence: v }));
                  }}
                  style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 10px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12 }} />
              </div>
            </div>
            <div style={{ background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 14, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#4b4b6a", fontSize: 12 }}>Duración</span>
              <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 700 }}>
                {(() => {
                  if (!renovar.inicio || !renovar.vence) return "—";
                  const diff = Math.round((new Date(renovar.vence) - new Date(renovar.inicio)) / (1000*60*60*24));
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
              <span style={{ fontSize: 18 }}>🔄</span> Confirmar renovación
            </button>
          </div>
        </div>
      )}

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
          <span style={{ background: memInfo.estado === "Activo" ? "rgba(74,222,128,.15)" : memInfo.estado === "Sin membresía" ? "rgba(107,114,128,.15)" : "rgba(248,113,113,.15)", color: memInfo.estado === "Activo" ? "#4ade80" : memInfo.estado === "Sin membresía" ? "#6b7280" : "#f87171", borderRadius: 10, padding: "4px 14px", fontSize: 12, fontWeight: 700 }}>{memInfo.estado}</span>
          <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 500 }}>
            {memInfo.estado === "Activo" ? `Activo hasta ${memInfo.vence}` : memInfo.estado === "Sin membresía" ? "Sin membresía registrada" : `Vencido desde ${memInfo.vence}`}
          </span>
        </div>

        {/* WA quick reminder badge */}
        {waUmbral !== null && m.tel && (
          <button
            onClick={() => {
              const msg = buildWAMsg(m, diasRestantes);
              window.open(buildWAUrl(m.tel, msg), "_blank");
            }}
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
        {[{ k: "perfil", label: "📋 Perfil" }, { k: "historial", label: "💳 Historial" }, { k: "mensaje", label: "💬 Mensaje" }].map(t => (
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
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <Btn full outline color="#6b7280" onClick={() => setEditing(false)}>Cancelar</Btn>
                <Btn full onClick={handleSave}>Guardar ✓</Btn>
              </div>
            </>
          ) : (
            <>
              {/* ── Sección: Datos personales ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Datos personales</p>
              <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {[
                  { label: "📱 Teléfono", val: m.tel || "—" },
                  { label: "📆 Incorporación", val: m.fecha_incorporacion || "—" },
                ].map((row, i, arr) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                    <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                    <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{row.val}</span>
                  </div>
                ))}
              </div>

              {/* ── Sección: Membresía actual ── */}
              <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Membresía actual</p>
              <div style={{ background: memInfo.estado === "Activo" ? "rgba(34,211,238,.05)" : "rgba(248,113,113,.05)", border: `1px solid ${memInfo.estado === "Activo" ? "rgba(34,211,238,.15)" : "rgba(248,113,113,.15)"}`, borderRadius: 14, padding: "0 14px", marginBottom: 16 }}>
                {memInfo.estado === "Activo" ? (
                  [
                    { label: "📋 Plan", val: memInfo.plan || "—" },
                    { label: "📅 Inicio", val: memInfo.inicio || "—" },
                    { label: "⏰ Vence", val: memInfo.vence || "—" },
                    { label: "💰 Último pago", val: memInfo.monto ? `$${Number(memInfo.monto).toLocaleString("es-MX")}` : "—" },
                  ].map((row, i, arr) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none" }}>
                      <span style={{ color: "#4b4b6a", fontSize: 13 }}>{row.label}</span>
                      <span style={{ color: "#22d3ee", fontSize: 13, fontWeight: 600 }}>{row.val}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "18px 0", textAlign: "center" }}>
                    <p style={{ fontSize: 24, marginBottom: 6 }}>📋</p>
                    <p style={{ color: memInfo.estado === "Sin membresía" ? "#6b7280" : "#f87171", fontSize: 13, fontWeight: 600 }}>
                      {memInfo.estado === "Sin membresía" ? "Sin membresía registrada" : `Venció el ${memInfo.vence}`}
                    </p>
                    <p style={{ color: "#4b4b6a", fontSize: 11, marginTop: 4 }}>Usa Renovar para registrar un nuevo pago</p>
                  </div>
                )}
              </div>

              {/* ── Resumen financiero ── */}
              {(() => {
                const totalPagado = historial.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
                return (
                  <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={{ flex: 1, background: "rgba(34,211,238,.08)", border: "1px solid rgba(34,211,238,.15)", borderRadius: 14, padding: "12px 14px" }}>
                      <p style={{ color: "#4b4b6a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Total pagado</p>
                      <p style={{ color: "#22d3ee", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>${totalPagado.toLocaleString("es-MX")}</p>
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
              <Btn full outline color="#22d3ee" onClick={() => setPagoModal(true)}>💳 Registrar pago</Btn>
            </>
          )}
        </>
      )}

      {detTab === "mensaje" && (
        <div>
          <p style={{ color: "#4b4b6a", fontSize: 12, marginBottom: 14 }}>Escribe un mensaje personalizado para enviarle a {m.nombre.split(" ")[0]} por WhatsApp.</p>
          <textarea
            value={mensajeWA}
            onChange={e => setMensajeWA(e.target.value)}
            placeholder={`Ej: Hola ${m.nombre.split(" ")[0]}, te informamos que la clase de hoy fue cancelada. Nos vemos el lunes 💪`}
            rows={5}
            style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 12 }}
          />
          <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "right", marginBottom: 14 }}>{mensajeWA.length} caracteres</p>
          {/* Quick message templates */}
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Sugerencias rápidas</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {[
              { icon: "🚫", label: "Clase cancelada", msg: `Hola ${m.nombre.split(" ")[0]}, te informamos que la clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏 — GymFit Pro` },
              { icon: "⏰", label: "Cambio de horario", msg: `Hola ${m.nombre.split(" ")[0]}, te avisamos que hubo un cambio de horario para la clase de hoy. El nuevo horario es a las 7:00pm — GymFit Pro` },
              { icon: "🏋️", label: "Evento especial", msg: `Hola ${m.nombre.split(" ")[0]}! 🔥 Te invitamos a nuestro evento especial este sábado. ¡Esperamos verte! — GymFit Pro` },
              { icon: "📢", label: "Aviso general", msg: `Hola ${m.nombre.split(" ")[0]}, te enviamos un comunicado importante del gym. Por favor contáctanos si tienes dudas — GymFit Pro` },
            ].map((tpl, i) => (
              <button key={i} onClick={() => setMensajeWA(tpl.msg)} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                <span style={{ color: "#9ca3af", fontSize: 12, fontWeight: 600 }}>{tpl.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!mensajeWA.trim() || !m.tel) return;
              window.open(buildWAUrl(m.tel, mensajeWA.trim()), "_blank");
            }}
            disabled={!mensajeWA.trim() || !m.tel}
            style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: mensajeWA.trim() && m.tel ? "pointer" : "not-allowed",
              fontFamily: "inherit", fontSize: 14, fontWeight: 700,
              background: mensajeWA.trim() && m.tel ? "linear-gradient(135deg,#25d366,#128c7e)" : "rgba(255,255,255,.06)",
              color: mensajeWA.trim() && m.tel ? "#fff" : "#4b4b6a",
              boxShadow: mensajeWA.trim() && m.tel ? "0 4px 18px rgba(37,211,102,.35)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s"
            }}>
            <span style={{ fontSize: 18 }}>💬</span>
            {!m.tel ? "Sin número registrado" : !mensajeWA.trim() ? "Escribe un mensaje" : `Enviar a ${m.nombre.split(" ")[0]} por WhatsApp`}
          </button>
        </div>
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
                            <div style={{ width: 42, height: 42, borderRadius: 13, fontSize: 18, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {CAT_ICON[t.categoria] || (isIngreso ? "💰" : "💸")}
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
  const cats = isGasto ? CAT_GAS : CAT_ING;
  const color = isGasto ? "#f43f5e" : "#22d3ee";
  const desc = tx.desc || tx.descripcion || "";

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    cat: tx.categoria,
    desc,
    monto: String(tx.monto),
    fecha: displayToISO(tx.fecha),
  });
  const [confirmDel, setConfirmDel] = useState(false);

  const handleSave = () => {
    if (!form.desc || !form.monto) return;
    onSave({ ...tx, categoria: form.cat, desc: form.desc, monto: Number(form.monto), fecha: fmtDate(form.fecha) || form.fecha });
  };

  // ── View row helper ──
  const Row = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
      <span style={{ color: "#4b4b6a", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>{label}</span>
      <span style={{ color: accent || "#fff", fontSize: 14, fontWeight: accent ? 700 : 500, fontFamily: accent ? "'DM Mono',monospace" : "inherit" }}>{value}</span>
    </div>
  );

  return (
    <Modal title={editing ? (isGasto ? "✏️ Editar Gasto" : "✏️ Editar Ingreso") : (isGasto ? "💸 Detalle Gasto" : "💰 Detalle Ingreso")} onClose={onClose}>

      {!editing ? (
        // ── VIEW MODE ──
        <>
          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ background: isGasto ? "rgba(244,63,94,.12)" : "rgba(34,211,238,.12)", color, borderRadius: 20, padding: "6px 20px", fontSize: 13, fontWeight: 700, border: `1px solid ${isGasto ? "rgba(244,63,94,.25)" : "rgba(34,211,238,.25)"}` }}>
              {isGasto ? "💸 Gasto" : "💰 Ingreso"}
            </span>
          </div>
          {/* Amount hero */}
          <div style={{ textAlign: "center", marginBottom: 20, background: isGasto ? "rgba(244,63,94,.07)" : "rgba(34,211,238,.07)", borderRadius: 18, padding: "16px 0", border: `1px solid ${isGasto ? "rgba(244,63,94,.15)" : "rgba(34,211,238,.15)"}` }}>
            <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>Monto</p>
            <p style={{ color, fontSize: 32, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>${Number(tx.monto).toLocaleString("es-MX")}</p>
          </div>
          {/* Details */}
          <div style={{ background: "rgba(255,255,255,.03)", borderRadius: 16, padding: "0 14px" }}>
            <Row label="Categoría" value={tx.categoria} />
            <Row label="Descripción" value={desc} />
            <Row label="Fecha" value={tx.fecha} />
          </div>
          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <Btn full outline color="#6b7280" onClick={onClose}>Cerrar</Btn>
            <Btn full color={color} onClick={() => setEditing(true)}>✏️ Editar</Btn>
          </div>
        </>
      ) : (
        // ── EDIT MODE ──
        <>
          {tx.categoria === "Membresías"
            ? <div style={{ marginBottom: 14 }}><p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>CATEGORÍA</p><div style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, padding: "12px 14px", color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>🏋️ Membresías</div></div>
            : <Inp label="Categoría" value={form.cat} onChange={v => setForm(p => ({ ...p, cat: v }))} options={cats} />
          }
          <Inp label="Descripción" value={form.desc} onChange={v => setForm(p => ({ ...p, desc: v }))} placeholder="Descripción" />
          <Inp label="Monto ($)" type="number" value={form.monto} onChange={v => setForm(p => ({ ...p, monto: v }))} placeholder="0.00" />
          <Inp label="Fecha" type="date" value={form.fecha} onChange={v => setForm(p => ({ ...p, fecha: v }))} />
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn full outline color="#6b7280" onClick={() => { setEditing(false); setConfirmDel(false); }}>← Volver</Btn>
            <Btn full color={color} onClick={handleSave}>Guardar ✓</Btn>
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
  const [busqueda, setBusqueda] = useState("");
  const [broadcastModal, setBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastStep, setBroadcastStep] = useState(1); // 1=compose, 2=copy
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedNums, setCopiedNums] = useState(false);
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
        setMiembros(mData.map(m => ({
          id: m.id, nombre: m.nombre, tel: m.tel || "", foto: m.foto || null, fecha_incorporacion: m.fecha_incorporacion || null,
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
  const [fM, setFM] = useState(() => { const ini = todayISO(); return { nombre: "", tel: "", plan: "Mensual", monto: "", inicio: ini, vence: calcVence(ini, "Mensual"), foto: null }; });

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
  const mActivos = miembros.filter(m => getMembershipInfo(m.id, txs).estado === "Activo").length;

  // Count total WA reminders pending
  const totalRecordatorios = useMemo(() => {
    let count = 0;
    miembros.filter(m => getMembershipInfo(m.id, txs).estado === "Activo").forEach(m => {
      const dias = diasParaVencer(m.vence);
      if (dias !== null && dias <= 5 && dias >= 0) count++;
    });
    return count;
  }, [miembros]);

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
    const savedM = await mDb.insert({ gym_id: GYM_ID, nombre: fM.nombre, tel: fM.tel || "", foto: fM.foto || null, fecha_incorporacion: todayISO() });
    if (savedM) {
      setMiembros(p => [{ id: savedM.id, nombre: fM.nombre, tel: fM.tel || "", foto: null, fecha_incorporacion: todayISO() }, ...p]);
      if (fM.plan && fM.monto) {
        const tDb = await supabase.from("transacciones");
        const savedT = await tDb.insert({ gym_id: GYM_ID, tipo: "ingreso", categoria: "Membresías", descripcion: `Membresía ${fM.plan} - ${fM.nombre}`, monto: Number(fM.monto), fecha: today(), miembro_id: savedM.id });
        if (savedT) setTxs(p => [{ id: savedT.id, tipo: "ingreso", categoria: "Membresías", descripcion: `Membresía ${fM.plan} - ${fM.nombre}`, monto: Number(fM.monto), fecha: today(), miembroId: savedM.id, miembro_id: savedM.id }, ...p]);
      }
    }
    setFM({ nombre: "", tel: "", foto: null }); setModal(null); setScreen("dashboard"); setTab(0);
  };

  const saveMiembro = async (updated) => {
    setMiembros(p => p.map(m => m.id === updated.id ? updated : m));
    setSelM(updated);
    const db = await supabase.from("miembros");
    await db.update(updated.id, { nombre: updated.nombre, tel: updated.tel, foto: updated.foto || null, fecha_incorporacion: updated.fecha_incorporacion });
  };
  const saveEditTx = async (updated) => {
    setTxs(p => p.map(t => t.id === updated.id ? updated : t));
    setEditTx(null); setModal(null);
    const db = await supabase.from("transacciones");
    await db.update(updated.id, { categoria: updated.categoria, descripcion: updated.desc || updated.descripcion || "-", monto: updated.monto, fecha: updated.fecha });
  };
  const deleteEditTx = async (id) => {
    // Find the tx before deleting to check if it's a membership
    const deletedTx = txs.find(t => t.id === id);

    const newTxs = txs.filter(t => t.id !== id);
    setTxs(newTxs);
    setEditTx(null); setModal(null);

    // Delete from Supabase
    const db = await supabase.from("transacciones");
    await db.delete(id);

    // If it was a membership payment, check if the member still has any
    const mId = deletedTx?.miembroId || deletedTx?.miembro_id;
    if (deletedTx?.categoria === "Membresías" && mId) {
      const remainingMemberships = newTxs.filter(
        t => t.categoria === "Membresías" && (String(t.miembroId) === String(mId) || String(t.miembro_id) === String(mId))
      );
      if (remainingMemberships.length === 0) {
        // No memberships left — mark as Vencido with today as vence date
        const miembro = miembros.find(m => m.id === deletedTx.miembroId);
        if (miembro) {
          const updated = { ...miembro, estado: "Vencido", vence: today() };
          setMiembros(p => p.map(m => m.id === updated.id ? updated : m));
          const mDb = await supabase.from("miembros");
          await mDb.update(updated.id, { estado: "Vencido", vence: today() });
        }
      } else {
        // Has other memberships — just mark as Vencido
        const miembro = miembros.find(m => m.id === mId);
        if (miembro && miembro.estado === "Activo") {
          const updated = { ...miembro, estado: "Vencido" };
          setMiembros(p => p.map(m => m.id === updated.id ? updated : m));
          const mDb = await supabase.from("miembros");
          await mDb.update(updated.id, { estado: "Vencido" });
        }
      }
    }
  };
  const toggleEstado = () => {
    const updated = { ...selM, estado: selM.estado === "Activo" ? "Vencido" : "Activo" };
    setMiembros(p => p.map(m => m.id === selM.id ? updated : m)); setSelM(updated);
  };
  const addPago = async (pagoData) => {
    const db = await supabase.from("transacciones");
    const saved = await db.insert({ gym_id: GYM_ID, tipo: pagoData.tipo, categoria: pagoData.categoria, descripcion: pagoData.desc || pagoData.descripcion || "-", monto: pagoData.monto, fecha: pagoData.fecha, miembro_id: pagoData.miembroId || null });
    if (saved) {
      setTxs(p => [...p, { 
        id: saved.id, tipo: pagoData.tipo, categoria: pagoData.categoria,
        desc: pagoData.desc, descripcion: pagoData.desc,
        monto: pagoData.monto, fecha: pagoData.fecha,
        miembroId: pagoData.miembroId || null,
        miembro_id: pagoData.miembroId || null,
      }]);
    }
  };
  const TABS = ["Dashboard", "Ingresos", "Gastos", "Historial"];

  return (
    <div style={{ background: "#090912", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 0", fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
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

      <div style={{ width: 390, height: 844, background: "#13131f", borderRadius: 44, overflow: "hidden", position: "relative", boxShadow: "0 40px 100px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.07)", display: "flex", flexDirection: "column" }}>


        {/* ═══ RECORDATORIOS SCREEN ═══ */}
        {!loading && !configScreen && screen === "recordatorios" && (
          <RecordatoriosScreen miembros={miembros} onBack={() => setScreen("dashboard")} />
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
                <button onClick={() => setScreen("recordatorios")} style={{ position: "relative", width: 40, height: 40, borderRadius: 14, border: "none", cursor: "pointer", background: totalRecordatorios > 0 ? "rgba(37,211,102,.15)" : "rgba(255,255,255,.07)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            {totalRecordatorios > 0 && (
              <button onClick={() => setScreen("recordatorios")} style={{
                width: "100%", marginTop: 12, padding: "10px 14px", border: "1px solid rgba(37,211,102,.3)",
                borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                background: "rgba(37,211,102,.08)", display: "flex", alignItems: "center", gap: 10
              }}>
                <span style={{ fontSize: 20 }}>💬</span>
                <div style={{ textAlign: "left", flex: 1 }}>
                  <p style={{ color: "#25d366", fontSize: 12, fontWeight: 700 }}>
                    {totalRecordatorios} membresía{totalRecordatorios > 1 ? "s" : ""} por vencer
                  </p>
                  <p style={{ color: "#4b4b6a", fontSize: 10 }}>Toca para enviar recordatorios por WhatsApp</p>
                </div>
                <span style={{ color: "#25d366", fontSize: 14 }}>→</span>
              </button>
            )}

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
              <div className="card" style={{ background: "rgba(255,255,255,.04)", borderRadius: 20, padding: 16, border: "1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Últimos movimientos</p>
                  <button onClick={() => setTab(3)} style={{ background: "none", border: "none", color: "#6c63ff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Ver todos</button>
                </div>
                {txsMes.slice(-4).reverse().map(t => (
                  <div key={t.id} className="rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.05)", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 11, fontSize: 14, background: t.tipo === "ingreso" ? "rgba(34,211,238,.12)" : "rgba(244,63,94,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>{CAT_ICON[t.categoria] || "📝"}</div>
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
                    <div style={{ width: 42, height: 42, borderRadius: 14, fontSize: 18, background: "rgba(34,211,238,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{CAT_ICON[t.categoria] || "📝"}</div>
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
              <div style={{ background: "rgba(255,255,255,.04)", borderRadius: 16, padding: "12px 14px", marginBottom: 14, border: "1px solid rgba(255,255,255,.07)" }}>
                <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 10 }}>Filtrar por fecha</p>
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
              {(() => {
                const desde = filtroDesde ? new Date(filtroDesde) : null;
                const hasta = filtroHasta ? new Date(filtroHasta + "T23:59:59") : null;
                const filtered = txs.filter(t => {
                  const meses = { "Ene": 0, "Feb": 1, "Mar": 2, "Abr": 3, "May": 4, "Jun": 5, "Jul": 6, "Ago": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dic": 11 };
                  const parts = t.fecha.split(" ");
                  if (parts.length < 3) return true;
                  const td = new Date(Number(parts[2]), meses[parts[1]] || 0, Number(parts[0]));
                  if (desde && td < desde) return false;
                  if (hasta && td > hasta) return false;
                  return true;
                });
                if (filtered.length === 0) return (
                  <div style={{ textAlign: "center", padding: "36px 0" }}>
                    <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
                    <p style={{ color: "#4b4b6a", fontSize: 13 }}>Sin movimientos en este período</p>
                  </div>
                );
                return filtered.map(t => (
                  <div key={t.id} className="card rh" onClick={() => { setEditTx(t); setModal("editTx"); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 16, marginBottom: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, fontSize: 15, background: t.tipo === "ingreso" ? "rgba(34,211,238,.12)" : "rgba(244,63,94,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>{CAT_ICON[t.categoria] || "📝"}</div>
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
                ));
              })()}
            </>}
          </div>
        </>}

        {/* ═══ MIEMBROS ═══ */}
        {broadcastModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(10px)", zIndex: 200, display: "flex", alignItems: "flex-end", fontFamily: "'DM Sans',sans-serif" }}>
            <div style={{ width: "100%", background: "#191928", borderRadius: "28px 28px 0 0", padding: "24px 24px 44px", maxHeight: "90%", overflowY: "auto", animation: "slideUp .3s ease" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>📢 Mensaje masivo</h2>
                <button onClick={() => { setBroadcastModal(false); setBroadcastStep(1); setCopiedMsg(false); setCopiedNums(false); }} style={{ border: "none", background: "rgba(255,255,255,.1)", color: "#9ca3af", width: 34, height: 34, borderRadius: 10, cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>

              {/* Step indicator */}
              <div style={{ display: "flex", gap: 6, marginBottom: 18, marginTop: 10 }}>
                {[{ n: 1, label: "Redactar" }, { n: 2, label: "Enviar" }].map(s => (
                  <div key={s.n} onClick={() => broadcastStep >= s.n && setBroadcastStep(s.n)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 10, textAlign: "center", cursor: broadcastStep >= s.n ? "pointer" : "default",
                      background: broadcastStep === s.n ? "linear-gradient(135deg,#25d366,#128c7e)" : broadcastStep > s.n ? "rgba(37,211,102,.2)" : "rgba(255,255,255,.05)",
                      border: broadcastStep > s.n ? "1px solid rgba(37,211,102,.3)" : "1px solid transparent" }}>
                    <p style={{ color: broadcastStep >= s.n ? "#fff" : "#4b4b6a", fontSize: 11, fontWeight: 700 }}>{broadcastStep > s.n ? "✓ " : ""}{s.label}</p>
                  </div>
                ))}
              </div>

              {/* ── STEP 1: Compose ── */}
              {broadcastStep === 1 && (
                <>
                  <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
                    placeholder="🚫 Ej: La clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏 — GymFit Pro"
                    rows={4} style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, padding: "14px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.6, marginBottom: 6 }}/>
                  <p style={{ color: "#4b4b6a", fontSize: 11, textAlign: "right", marginBottom: 14 }}>{broadcastMsg.length} caracteres</p>

                  <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Sugerencias rápidas</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                    {[
                      { icon: "🚫", label: "Clase cancelada", msg: "La clase de hoy ha sido cancelada. Disculpa los inconvenientes 🙏 — GymFit Pro" },
                      { icon: "⏰", label: "Cambio de horario", msg: "Aviso: hubo un cambio de horario para hoy. El nuevo horario es a las 7:00pm — GymFit Pro" },
                      { icon: "🏋️", label: "Evento especial", msg: "🔥 Te invitamos a nuestro evento especial este sábado. ¡Esperamos verte! — GymFit Pro" },
                      { icon: "🛑", label: "Cierre temporal", msg: "El gym estará cerrado mañana por mantenimiento. Nos vemos el lunes — GymFit Pro" },
                    ].map((tpl, i) => (
                      <button key={i} onClick={() => setBroadcastMsg(tpl.msg)} style={{ background: broadcastMsg === tpl.msg ? "rgba(37,211,102,.1)" : "rgba(255,255,255,.04)", border: broadcastMsg === tpl.msg ? "1px solid rgba(37,211,102,.3)" : "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
                        <span style={{ fontSize: 18 }}>{tpl.icon}</span>
                        <span style={{ color: broadcastMsg === tpl.msg ? "#4ade80" : "#9ca3af", fontSize: 12, fontWeight: 600 }}>{tpl.label}</span>
                        {broadcastMsg === tpl.msg && <span style={{ marginLeft: "auto", color: "#4ade80", fontSize: 14 }}>✓</span>}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => { if (broadcastMsg.trim()) setBroadcastStep(2); }}
                    disabled={!broadcastMsg.trim()}
                    style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: broadcastMsg.trim() ? "pointer" : "not-allowed",
                      fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                      background: broadcastMsg.trim() ? "linear-gradient(135deg,#25d366,#128c7e)" : "rgba(255,255,255,.06)",
                      color: broadcastMsg.trim() ? "#fff" : "#4b4b6a",
                      boxShadow: broadcastMsg.trim() ? "0 4px 18px rgba(37,211,102,.35)" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    Continuar →
                  </button>
                </>
              )}

              {/* ── STEP 2: Copy & Send via Lista de Difusión ── */}
              {broadcastStep === 2 && (() => {
                const dest = miembros.filter(mb => mb.estado === "Activo" && mb.tel);
                const numeros = dest.map(mb => mb.tel.replace(/\D/g, "")).join("\n");
                return (
                  <>
                    {/* Destinatarios */}
                    <div style={{ background: "rgba(37,211,102,.07)", border: "1px solid rgba(37,211,102,.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
                      <p style={{ color: "#4b4b6a", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Destinatarios ({dest.length})</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {dest.map(mb => (
                          <div key={mb.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", borderRadius: 20, padding: "4px 10px 4px 4px" }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                              {mb.foto ? <img src={mb.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : mb.nombre.charAt(0)}
                            </div>
                            <span style={{ color: "#9ca3af", fontSize: 11 }}>{mb.nombre.split(" ")[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Step 1: Copy message */}
                    <div style={{ background: "rgba(255,255,255,.04)", border: copiedMsg ? "1px solid rgba(37,211,102,.4)" : "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px", marginBottom: 10, transition: "border .3s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: copiedMsg ? "rgba(37,211,102,.2)" : "rgba(255,255,255,.1)", color: copiedMsg ? "#4ade80" : "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{copiedMsg ? "✓" : "1"}</span>
                          <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Copia el mensaje</p>
                        </div>
                        <button onClick={() => { copyToClipboard(broadcastMsg); setCopiedMsg(true); }}
                          style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            background: copiedMsg ? "rgba(37,211,102,.2)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
                            color: copiedMsg ? "#4ade80" : "#fff" }}>
                          {copiedMsg ? "✓ Copiado" : "📋 Copiar"}
                        </button>
                      </div>
                      <p style={{ color: "#4b4b6a", fontSize: 11, lineHeight: 1.5, fontStyle: "italic" }}>"{broadcastMsg}"</p>
                    </div>

                    {/* Step 2: Copy numbers */}
                    <div style={{ background: "rgba(255,255,255,.04)", border: copiedNums ? "1px solid rgba(37,211,102,.4)" : "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px", marginBottom: 10, transition: "border .3s" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: copiedNums ? "rgba(37,211,102,.2)" : "rgba(255,255,255,.1)", color: copiedNums ? "#4ade80" : "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{copiedNums ? "✓" : "2"}</span>
                          <div>
                            <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Copia los números</p>
                            <p style={{ color: "#4b4b6a", fontSize: 10, marginTop: 2 }}>{dest.length} contactos para tu lista de difusión</p>
                          </div>
                        </div>
                        <button onClick={() => { copyToClipboard(numeros); setCopiedNums(true); }}
                          style={{ padding: "6px 14px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                            background: copiedNums ? "rgba(37,211,102,.2)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
                            color: copiedNums ? "#4ade80" : "#fff" }}>
                          {copiedNums ? "✓ Copiados" : "📋 Copiar"}
                        </button>
                      </div>
                    </div>

                    {/* Step 3: Instructions */}
                    <div style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px", marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <span style={{ background: "rgba(255,255,255,.1)", color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>3</span>
                        <p style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>Envía por WhatsApp</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { icon: "📡", title: "Lista de difusión (recomendado)", desc: "Abre WhatsApp → Nueva lista de difusión → Pega los números → Pega el mensaje. Llega como mensaje privado a cada uno." },
                          { icon: "👥", title: "Grupo del gym", desc: "Si ya tienes un grupo, solo pega el mensaje ahí." },
                        ].map((opt, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10 }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{opt.icon}</span>
                            <div>
                              <p style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{opt.title}</p>
                              <p style={{ color: "#4b4b6a", fontSize: 11, lineHeight: 1.5 }}>{opt.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Open WhatsApp button */}
                    <button onClick={() => window.open("https://wa.me", "_blank")}
                      style={{ width: "100%", padding: "14px", border: "none", borderRadius: 14, cursor: "pointer",
                        fontFamily: "inherit", fontSize: 14, fontWeight: 700,
                        background: "linear-gradient(135deg,#25d366,#128c7e)",
                        color: "#fff", boxShadow: "0 4px 18px rgba(37,211,102,.35)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>💬</span> Abrir WhatsApp
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {!loading && !configScreen && screen === "miembros" && <>
          <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button onClick={() => setScreen("dashboard")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
              <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>Miembros</h1>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={() => { setBroadcastMsg(""); setBroadcastModal(true); }} style={{ background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)", borderRadius: 12, padding: "8px 12px", color: "#25d366", fontSize: 18, cursor: "pointer" }}>📢</button>
                <button onClick={() => { const ini = todayISO(); const firstPlan = activePlanes[0] || DEFAULT_PLANES[0]; setFM({ nombre: "", tel: "", plan: firstPlan.nombre, monto: String(firstPlan.precio), foto: null }); setModal("miembro"); }} style={{ background: "linear-gradient(135deg,#6c63ff,#e040fb)", border: "none", borderRadius: 12, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Nuevo</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {[{ label: "Activos", val: "Activo", count: miembros.filter(m => getMembershipInfo(m.id, txs).estado === "Activo").length, c: "#4ade80", bg: "rgba(74,222,128," }, { label: "Vencidos", val: "Vencido", count: miembros.filter(m => { const s = getMembershipInfo(m.id, txs).estado; return s === "Vencido" || s === "Sin membresía"; }).length, c: "#f87171", bg: "rgba(248,113,113," }, { label: "Todos", val: "Todos", count: miembros.length, c: "#a78bfa", bg: "rgba(167,139,250," }].map((s, i) => {
                const active = filtroEstado === s.val;
                return <button key={i} onClick={() => setFiltroEstado(s.val)} style={{ flex: 1, background: active ? `${s.bg}.18)` : "rgba(255,255,255,.05)", border: active ? `1.5px solid ${s.bg}.35)` : "1.5px solid transparent", borderRadius: 14, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                  <p style={{ color: active ? s.c : "#6b7280", fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{s.count}</p>
                  <p style={{ color: active ? s.c : "#4b4b6a", fontSize: 11, fontWeight: active ? 700 : 500, marginTop: 2 }}>{s.label}</p>
                </button>;
              })}
            </div>
            <div style={{ position: "relative", marginBottom: 4 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#4b4b6a", pointerEvents: "none" }}>🔍</span>
              <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 14, padding: "11px 14px 11px 40px", color: "#fff", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              {busqueda && <button onClick={() => setBusqueda("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4b4b6a", cursor: "pointer", fontSize: 16 }}>✕</button>}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px 90px" }}>
            {(() => {
              const q = busqueda.toLowerCase();
              const lista = miembros.filter(m => { const est = getMembershipInfo(m.id, txs).estado; const matchEstado = filtroEstado === "Todos" || (filtroEstado === "Activo" && est === "Activo") || (filtroEstado === "Vencido" && (est === "Vencido" || est === "Sin membresía")); return matchEstado; }).filter(m => !q || m.nombre.toLowerCase().includes(q) || (m.tel || "").includes(q));
              if (lista.length === 0) return <div style={{ textAlign: "center", padding: "40px 0" }}><p style={{ fontSize: 32, marginBottom: 12 }}>🔎</p><p style={{ color: "#4b4b6a", fontSize: 14 }}>Sin resultados</p></div>;
              return lista.map(m => {
                const mi = getMembershipInfo(m.id, txs);
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
            <>
              <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <button onClick={() => setScreen("dashboard")} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
                  <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>📊 Estadísticas</h1>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 90px" }}>
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
            </>
          );
        })()}

        {/* ═══ BOTTOM NAV ═══ */}
        {!configScreen && <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(10,10,18,.96)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,.07)", padding: "10px 8px 26px", display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {[
            { label: "Inicio", icon: "⌂", s: "dashboard", t: null },
            { label: "Miembros", icon: "◎", s: "miembros", t: null },
            { label: "", icon: "⊕", accent: true },
            { label: "Recordar", icon: "💬", s: "recordatorios", t: null, badge: totalRecordatorios },
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
                  <input type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={e => {
                    const file = e.target.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setFM(p => ({ ...p, foto: ev.target.result }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>
              <p style={{ color: "#4b4b6a", fontSize: 11 }}>Toca 📷 para agregar foto</p>
            </div>
            <Inp label="Nombre completo" value={fM.nombre} onChange={v => setFM(p => ({ ...p, nombre: v }))} placeholder="Ej: Juan Pérez" />
            <Inp label="Teléfono" type="tel" value={fM.tel || ""} onChange={v => setFM(p => ({ ...p, tel: v }))} placeholder="999 000 0000" />
            <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Membresía inicial (opcional)</p>
            <Inp label="Plan" value={fM.plan || ""} onChange={v => setFM(p => ({ ...p, plan: v, monto: (PLAN_PRECIO_ACTIVO[v] || PLAN_PRECIO[v] || p.monto || "").toString() }))} options={["", ...PLANES_ACTIVOS]} />
            {fM.plan && <Inp label="Monto ($)" type="number" value={fM.monto || ""} onChange={v => setFM(p => ({ ...p, monto: v }))} placeholder="0.00" />}
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
            onDone={() => { setModal(null); setScreen("dashboard"); setTab(0); }}
            planesActivos={PLANES_ACTIVOS}
            planPrecioActivo={PLAN_PRECIO_ACTIVO}
            onEditTx={t => { setEditTx(t); setModal("editTx"); }}
          />
        )}

        {modal === "editTx" && editTx && <EditTxModal tx={editTx} onClose={() => { setModal(null); setEditTx(null); }} onSave={saveEditTx} onDelete={deleteEditTx} />}

      </div>
    </div>
  );
}
