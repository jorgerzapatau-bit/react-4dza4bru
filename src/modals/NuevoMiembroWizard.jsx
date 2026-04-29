// src/modals/NuevoMiembroWizard.jsx
// ══════════════════════════════════════════════════════════════════
//  Wizard 3 pasos para dar de alta un nuevo miembro:
//  [1 Datos] → [2 Membresía] → [3 Pago]
//  Con barra de progreso, navegación ← / → y generación de comprobante.
// ══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../supabase";
import TutorFields from "../components/TutorFields";
import { todayISO, calcEdad, fmtDate } from "../utils/dateUtils";
import { esMenorDeEdad, validarTutor } from "../utils/tutorUtils";
import { DEFAULT_PLANES, calcVence, GRADOS_KARATE, GRADOS_NOMBRES } from "../utils/constants";

// ── Helpers ──────────────────────────────────────────────────────
function fmt$(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX");
}

function fmtDateLong(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function fmtDateMed(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  const DIAS = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtDateShort(isoStr) {
  if (!isoStr) return "—";
  const [y, m, day] = isoStr.split("-");
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${parseInt(day)} ${MESES[parseInt(m)-1]} ${y}`;
}

// ── Carga jsPDF dinámicamente ──────────────────────────────────
function cargarScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Genera el comprobante como PNG data-URL usando canvas ────────
async function generarComprobantePNG({ gymConfig, miembro, plan, monto, formaPago, venceISO }) {
  const gym = gymConfig || {};
  const nombre   = gym.nombre   || "GymFit Pro";
  const slogan   = gym.slogan   || "Fortaleza y Disciplina";
  const tel      = gym.telefono || "";
  const facebook = gym.facebook || "";
  const logo     = gym.logo     || null;
  const titular  = gym.transferencia_titular || "—";
  const propietario = gym.propietario_nombre || "";

  const hoyD = new Date();
  const DIAS_LONG = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES_LONG = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fechaHoy = `${DIAS_LONG[hoyD.getDay()]}, ${MESES_LONG[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO ? `${DIAS_LONG[new Date(venceISO+"T00:00:00").getDay()]}, ${MESES_LONG[new Date(venceISO+"T00:00:00").getMonth()]} ${new Date(venceISO+"T00:00:00").getDate()}, ${new Date(venceISO+"T00:00:00").getFullYear()}` : "—";

  const W = 520, LINE = 28;
  const canvas = document.createElement("canvas");
  canvas.width = W;

  // Pre-calc height
  const rows = [
    { label: "Fecha:", value: fechaHoy, bold: true },
    { label: "ALUMNO", value: miembro.nombre.toUpperCase(), big: true },
    { label: "", value: plan ? `Plan ${plan}` : "—", sub: true },
    { label: "Modo de Pago:", value: formaPago || "—", bold: true },
    { label: "Cantidad:", value: fmt$(monto), bold: true },
    { label: "Vencimiento:", value: venceLong, bold: true },
    { label: "Recibió:", value: propietario || "—", bold: false },
  ];
  const HEADER_H = 130;
  const ROW_H = 32;
  const CLABE_H = gym.transferencia_clabe ? 80 : 0;
  const FOOTER_H = 52;
  const H = HEADER_H + rows.length * ROW_H + CLABE_H + FOOTER_H + 10;
  canvas.height = H;

  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  // Header background
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, W, HEADER_H);

  // Header border bottom
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, HEADER_H, W, 1);

  // Logo circle (left)
  const LOGO_SIZE = 70;
  const logoX = 20, logoY = 15;
  if (logo) {
    try {
      await new Promise((res) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoX + LOGO_SIZE/2, logoY + LOGO_SIZE/2, LOGO_SIZE/2, 0, Math.PI*2);
          ctx.clip();
          ctx.drawImage(img, logoX, logoY, LOGO_SIZE, LOGO_SIZE);
          ctx.restore();
          res();
        };
        img.onerror = res;
        img.src = logo;
      });
    } catch {}
  } else {
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(logoX + LOGO_SIZE/2, logoY + LOGO_SIZE/2, LOGO_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥋", logoX + LOGO_SIZE/2, logoY + LOGO_SIZE/2);
    ctx.textBaseline = "alphabetic";
  }

  // Gym name
  ctx.fillStyle = "#111";
  ctx.font = "bold 17px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(nombre.toUpperCase(), W/2, 32);

  // Slogan
  ctx.fillStyle = "#e53935";
  ctx.font = "bold 13px Georgia, serif";
  ctx.fillText(slogan, W/2, 52);

  // Tel
  if (tel) {
    ctx.fillStyle = "#333";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText(`Whatsapp ${tel}`, W/2, 70);
  }

  // Facebook
  if (facebook) {
    ctx.fillStyle = "#555";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillText(`Facebook: ${facebook}`, W/2, 90);
  }

  // Separator
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 100); ctx.lineTo(W-20, 100);
  ctx.stroke();

  // Right logo (fitzone/fi.t)
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.roundRect(W-90, 18, 70, 35, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("FI.TZONE", W-55, 40);

  // Rows
  ctx.textAlign = "left";
  let y = HEADER_H + 8;
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#fafafa";
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, W, ROW_H);
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(W, y + ROW_H - 0.5);
    ctx.stroke();

    if (row.sub) {
      ctx.fillStyle = "#666";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(row.value, W/2, y + ROW_H - 10);
      ctx.textAlign = "left";
    } else if (row.big) {
      ctx.fillStyle = "#111";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(row.value, W/2, y + ROW_H - 8);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#555";
      ctx.font = "12px Arial";
      ctx.fillText(row.label, 20, y + ROW_H - 10);
      ctx.fillStyle = "#111";
      ctx.font = row.bold ? "bold 13px Arial" : "13px Arial";
      ctx.textAlign = "right";
      ctx.fillText(row.value, W - 20, y + ROW_H - 10);
      ctx.textAlign = "left";
    }
    y += ROW_H;
  });

  // CLABE section
  if (gym.transferencia_clabe) {
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, y, W, CLABE_H);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.font = "bold 12px Arial";
    ctx.fillText("PARA TRANSFERENCIAS:", 20, y + 18);
    ctx.font = "12px Arial";
    ctx.fillStyle = "#333";
    ctx.fillText(`CLABE:  ${gym.transferencia_clabe}`, 20, y + 36);
    ctx.fillText(`Beneficiario:  ${gym.transferencia_titular || "—"}`, 20, y + 52);
    if (gym.transferencia_banco) {
      ctx.fillText(`Banco:  ${gym.transferencia_banco}`, 20, y + 68);
    }
    y += CLABE_H;
  }

  // Footer
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, y, W, FOOTER_H);
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  ctx.fillStyle = "#333";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  const footerText = "Favor de enviar comprobante de transferencia al número de";
  const footerText2 = "Whatsapp que aparece en la parte superior de este recibo.";
  ctx.fillText(footerText, W/2, y + 20);
  ctx.fillText(footerText2, W/2, y + 36);

  return canvas.toDataURL("image/png");
}

// ── Estilos base del wizard ────────────────────────────────────
const S = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,.72)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: 520,
    maxHeight: "96vh",
    background: "var(--bg-card, #12121f)",
    borderRadius: "22px 22px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 -8px 40px rgba(0,0,0,.5)",
  },
  header: {
    padding: "18px 20px 0",
    flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: "auto", padding: "16px 20px",
  },
  footer: {
    padding: "12px 20px 20px",
    flexShrink: 0,
    borderTop: "1px solid var(--border, #2a2a3e)",
  },
  inp: {
    width: "100%",
    background: "var(--bg-elevated, #1e1e2e)",
    border: "1px solid var(--border-strong, #2e2e42)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  label: {
    color: "var(--text-tertiary, #6b6b8a)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
    display: "block",
  },
  field: { marginBottom: 14 },
  btnPrimary: {
    flex: 1,
    padding: "14px",
    border: "none", borderRadius: 14,
    background: "linear-gradient(135deg,#6c63ff,#e040fb)",
    color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 4px 18px rgba(108,99,255,.35)",
    transition: "all .2s",
  },
  btnSecondary: {
    flex: 1,
    padding: "14px",
    border: "1.5px solid var(--border-strong, #2e2e42)",
    borderRadius: 14,
    background: "var(--bg-elevated, #1e1e2e)",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
    transition: "all .2s",
  },
};

// ── Barra de Progreso ────────────────────────────────────────
function ProgressBar({ step, total = 3, labels }) {
  return (
    <div style={{ padding: "0 0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
        {Array.from({ length: total }, (_, i) => {
          const idx = i + 1;
          const done = step > idx;
          const active = step === idx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 12,
                background: done ? "#4ade80" : active ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated,#1e1e2e)",
                color: done || active ? "#fff" : "var(--text-tertiary,#6b6b8a)",
                border: active ? "none" : done ? "none" : "1.5px solid var(--border-strong,#2e2e42)",
                boxShadow: active ? "0 0 0 3px rgba(108,99,255,.25)" : "none",
                transition: "all .3s",
              }}>
                {done ? "✓" : idx}
              </div>
              {i < total - 1 && (
                <div style={{
                  flex: 1, height: 2,
                  background: done ? "#4ade80" : "var(--border-strong,#2e2e42)",
                  margin: "0 2px",
                  transition: "background .3s",
                }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {labels.map((l, i) => (
          <p key={i} style={{
            flex: 1, textAlign: i === 0 ? "left" : i === labels.length-1 ? "right" : "center",
            fontSize: 10, fontWeight: step === i+1 ? 700 : 400,
            color: step === i+1 ? "var(--text-primary,#e8e8f0)" : "var(--text-tertiary,#6b6b8a)",
            transition: "color .3s",
          }}>{l}</p>
        ))}
      </div>
    </div>
  );
}

// ── PASO 1: Datos personales ─────────────────────────────────
function Step1({ fM, setFM, onPhoto, showFotoModal, setShowFotoModal, PhotoModal, isDojo }) {
  const esMenor = esMenorDeEdad(fM.fecha_nacimiento);
  const edad = fM.fecha_nacimiento ? calcEdad(fM.fecha_nacimiento) : null;

  const inp = (label, field, type = "text", placeholder = "") => (
    <div style={S.field}>
      <label style={S.label}>{label}</label>
      <input
        type={type}
        value={fM[field] || ""}
        onChange={e => setFM(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        style={S.inp}
        inputMode={type === "tel" ? "numeric" : undefined}
      />
    </div>
  );

  return (
    <div>
      {/* Foto */}
      {showFotoModal && PhotoModal && (
        <PhotoModal
          onClose={() => setShowFotoModal(false)}
          onCapture={dataUrl => { setFM(p => ({ ...p, foto: dataUrl })); setShowFotoModal(false); }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
        <div
          onClick={() => setShowFotoModal(true)}
          style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "linear-gradient(135deg,#6c63ff33,#e040fb33)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", overflow: "hidden", marginBottom: 6,
            border: fM.foto ? "2.5px solid #6c63ff" : "2px dashed rgba(167,139,250,.4)",
            transition: "border .2s",
          }}
        >
          {fM.foto
            ? <img src={fM.foto} alt="foto" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 30 }}>📷</span>
          }
        </div>
        <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11 }}>
          {fM.foto ? "Toca para cambiar foto" : "Toca para agregar foto"}
        </p>
      </div>

      {inp("Nombre completo *", "nombre", "text", "Ej: María García")}
      {inp("Teléfono WhatsApp", "tel", "tel", "999 000 0000")}
      {/* Sexo — pill buttons, sin <select> nativo */}
      <div style={S.field}>
        <label style={S.label}>Sexo</label>
        <div style={{ display: "flex", gap: 8 }}>
          {["", "Masculino", "Femenino"].map(op => {
            const sel = (fM.sexo || "") === op;
            const icons = { "": "—", "Masculino": "♂", "Femenino": "♀" };
            return (
              <button
                key={op}
                onClick={() => setFM(p => ({ ...p, sexo: op }))}
                style={{
                  flex: 1, padding: "11px 8px",
                  border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                  borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                  background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                  color: sel ? "#c4b5fd" : "var(--text-secondary,#9999b3)",
                  fontSize: 13, fontWeight: sel ? 700 : 400,
                  transition: "all .15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                }}
              >
                <span style={{ fontSize: 16 }}>{icons[op]}</span>
                <span style={{ fontSize: 11 }}>{op || "Sin especificar"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>Fecha de nacimiento</label>
        <input
          type="date"
          value={fM.fecha_nacimiento || ""}
          onChange={e => setFM(p => ({ ...p, fecha_nacimiento: e.target.value }))}
          style={S.inp}
        />
        {edad !== null && (
          <p style={{ fontSize: 11, marginTop: 4, color: esMenor ? "#fbbf24" : "var(--text-tertiary,#6b6b8a)" }}>
            {esMenor ? `⚠️ ${edad} años — menor de edad` : `${edad} años`}
          </p>
        )}
      </div>

      {esMenor && (
        <TutorFields
          tutor={{ tutor_nombre: fM.tutor_nombre || "", tutor_telefono: fM.tutor_telefono || "", tutor_parentesco: fM.tutor_parentesco || "" }}
          onChange={(campo, valor) => setFM(p => ({ ...p, [campo]: valor }))}
          errores={{}}
          compact
        />
      )}

      <div style={S.field}>
        <label style={S.label}>Fecha de incorporación</label>
        <input
          type="date"
          value={fM.fecha_incorporacion || todayISO()}
          onChange={e => setFM(p => ({ ...p, fecha_incorporacion: e.target.value }))}
          style={S.inp}
        />
      </div>

      <div style={S.field}>
        <label style={S.label}>Notas</label>
        <textarea
          value={fM.notas || ""}
          onChange={e => setFM(p => ({ ...p, notas: e.target.value }))}
          placeholder="Ej: lesión de rodilla, objetivo: perder peso"
          rows={3}
          style={{ ...S.inp, resize: "vertical", minHeight: 72 }}
        />
      </div>

      {/* ── DOJO: Grado inicial (solo si es dojo) ── */}
      {isDojo && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: "#8b949e", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            🥋 Cinturón inicial
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {GRADOS_KARATE.map(g => {
              const active = fM.grado_actual === g.nombre;
              return (
                <button
                  key={g.nombre}
                  onClick={() => setFM(p => ({ ...p, grado_actual: active ? "" : g.nombre }))}
                  style={{
                    padding: "8px 4px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                    border: active ? `2px solid ${g.kyu < 0 ? "#a78bfa" : g.color}` : "1.5px solid rgba(255,255,255,.08)",
                    background: active ? `${g.color}22` : "var(--bg-elevated)",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{g.emoji}</span>
                  <span style={{ fontSize: 9, color: active ? "#e5e7eb" : "#6b7280", fontWeight: active ? 700 : 400, textAlign: "center", lineHeight: 1.3 }}>
                    {g.nombre.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          {!fM.grado_actual && (
            <p style={{ color: "#6b7280", fontSize: 10, marginTop: 6 }}>Opcional — puedes asignarlo después desde el perfil</p>
          )}
        </div>
      )}

      {/* Toggle Becario */}
      <button
        onClick={() => setFM(p => ({ ...p, beca: !p.beca }))}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          width: "100%", padding: "13px 14px", marginBottom: 6,
          background: fM.beca ? "rgba(251,191,36,.08)" : "rgba(255,255,255,.04)",
          border: `1.5px solid ${fM.beca ? "rgba(251,191,36,.4)" : "rgba(255,255,255,.08)"}`,
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
          transition: "all .2s", textAlign: "left",
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          border: `2px solid ${fM.beca ? "#fbbf24" : "rgba(255,255,255,.2)"}`,
          background: fM.beca ? "#fbbf24" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {fM.beca && <span style={{ color: "#1a1a2e", fontSize: 13, fontWeight: 700 }}>✓</span>}
        </div>
        <div>
          <p style={{ color: fM.beca ? "#fbbf24" : "#d1d5db", fontSize: 13, fontWeight: 600 }}>🎓 Becario — Membresía sin costo</p>
          <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 2 }}>El pago se registrará como $0 y se saltará el paso de cobro</p>
        </div>
      </button>
    </div>
  );
}

// ── PASO 2: Membresía ─────────────────────────────────────────
function Step2({ fM, setFM, planes, clases, horarios }) {
  const edad = fM.fecha_nacimiento ? calcEdad(fM.fecha_nacimiento) : null;

  const planesInfo = planes.map(p => {
    let warning = null;
    // Age compatibility check (example: kids plan for adults or vice versa)
    const nombreLow = (p.nombre || "").toLowerCase();
    if (edad !== null) {
      if (nombreLow.includes("niño") || nombreLow.includes("infantil") || nombreLow.includes("junior")) {
        if (edad > 14) warning = `⚠️ Plan infantil — el miembro tiene ${edad} años`;
      } else if (nombreLow.includes("adulto") || nombreLow.includes("senior")) {
        if (edad < 18) warning = `⚠️ Plan adulto — el miembro tiene ${edad} años`;
      }
    }
    return { ...p, warning };
  });

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 12 }}>
          Selecciona un plan de membresía o continúa sin asignar uno todavía.
        </p>
      </div>

      {/* Sin membresía */}
      <button
        onClick={() => setFM(p => ({ ...p, plan: null, monto: null }))}
        style={{
          width: "100%", padding: "14px 16px", marginBottom: 8,
          border: !fM.plan ? "2px solid rgba(255,255,255,.3)" : "1.5px solid var(--border-strong,#2e2e42)",
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
          background: !fM.plan ? "rgba(255,255,255,.05)" : "var(--bg-elevated,#1e1e2e)",
          display: "flex", alignItems: "center", gap: 12,
          transition: "all .2s",
        }}
      >
        <span style={{ fontSize: 22 }}>⏸️</span>
        <div style={{ textAlign: "left", flex: 1 }}>
          <p style={{ color: !fM.plan ? "var(--text-primary,#e8e8f0)" : "var(--text-tertiary,#6b6b8a)", fontWeight: !fM.plan ? 700 : 400, fontSize: 13 }}>
            Sin membresía por ahora
          </p>
          <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 2 }}>
            Se puede asignar después desde el perfil
          </p>
        </div>
        {!fM.plan && (
          <span style={{ background: "rgba(255,255,255,.12)", color: "var(--text-primary,#e8e8f0)", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
            ✓ Seleccionado
          </span>
        )}
      </button>

      {/* Planes */}
      {planesInfo.map((p) => {
        const precio = p.precio_publico !== undefined ? p.precio_publico : p.precio;
        const isSelected = fM.plan === p.nombre;
        // ciclo_renovacion puede ser "mensual","trimestral","semestral","anual" o un número via .meses
        const CICLO_LABEL = { mensual: "Mensual", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual", ilimitado: "Sin vencimiento" };
        const CICLO_MESES = { mensual: 1, trimestral: 3, semestral: 6, anual: 12, ilimitado: null };
        const mesesNum = p.meses != null ? p.meses : CICLO_MESES[p.ciclo_renovacion];
        const cicloLabel = p.ciclo_renovacion ? (CICLO_LABEL[p.ciclo_renovacion] || p.ciclo_renovacion) : (mesesNum === 1 ? "Mensual" : mesesNum === 3 ? "Trimestral" : mesesNum === 6 ? "Semestral" : mesesNum === 12 ? "Anual" : "");
        const mesesLabel = mesesNum == null ? "Sin vencimiento" : mesesNum === 1 ? "Renovación mensual" : `Renovación cada ${mesesNum} meses`;
        const clasesLabel = p.limite_clases ? `· Máx. ${p.limite_clases} clases` : "";

        return (
          <button
            key={p.nombre}
            onClick={() => setFM(prev => ({ ...prev, plan: p.nombre, monto: prev.beca ? "0" : String(precio || ""), planData: p }))}
            style={{
              width: "100%", padding: "14px 16px", marginBottom: 8,
              border: isSelected ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
              borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
              background: isSelected ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
              display: "flex", alignItems: "center", gap: 12,
              transition: "all .2s", textAlign: "left",
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: isSelected ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>
              🏷️
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: isSelected ? "#c4b5fd" : "var(--text-primary,#e8e8f0)", fontWeight: 700, fontSize: 14 }}>
                {p.nombre}
              </p>
              <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 2 }}>
                {mesesLabel}{clasesLabel}
              </p>
              {/* Clases y horarios vinculados */}
              {(() => {
                const vinculadas = (clases || []).filter(c =>
                  (p.clases_vinculadas || []).map(String).includes(String(c.id))
                );
                if (vinculadas.length === 0) return null;
                const DIAS_SHORT = { lun:"L", mar:"M", mie:"X", jue:"J", vie:"V", sab:"S", dom:"D" };
                return (
                  <div style={{ marginTop: 5 }}>
                    {vinculadas.map(c => {
                      const hClase = (horarios || []).filter(h => h.clase_id === c.id && h.activo !== false);
                      return (
                        <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 3 }}>
                          <span style={{ fontSize: 10, marginTop: 1 }}>📅</span>
                          <div>
                            <span style={{ color: c.color || "#6c63ff", fontSize: 11, fontWeight: 700 }}>{c.nombre}</span>
                            {hClase.map((h, hi) => (
                              <span key={hi} style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 10, marginLeft: 4 }}>
                                {(h.dias_semana || []).map(d => DIAS_SHORT[d] || d).join("-")} {h.hora_inicio ? h.hora_inicio.slice(0,5) : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {p.warning && (
                <p style={{ color: "#fbbf24", fontSize: 11, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  {p.warning}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{
                background: isSelected ? "rgba(108,99,255,.25)" : "rgba(255,255,255,.07)",
                color: isSelected ? "#c4b5fd" : "var(--text-secondary,#9999b3)",
                borderRadius: 10, padding: "4px 12px",
                fontSize: 13, fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
              }}>
                {fM.beca ? <span style={{ color: "#4ade80" }}>$0</span> : fmt$(precio)}
              </p>
              {fM.beca && (
                <p style={{ color: "#fbbf24", fontSize: 9, fontWeight: 700, marginTop: 2, textDecoration: "line-through", opacity: 0.5 }}>
                  {fmt$(precio)}
                </p>
              )}
            </div>
          </button>
        );
      })}

      {/* Aviso beca */}
      {fM.beca && (
        <div style={{ marginTop: 8, padding: "10px 14px", background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 16 }}>🎓</span>
          <p style={{ color: "#fbbf24", fontSize: 11 }}>
            Miembro becario — el cobro será <strong>$0</strong>. Se saltará el paso de pago al confirmar.
          </p>
        </div>
      )}

      {/* Monto personalizado — oculto si es becario */}
      {fM.plan && !fM.beca && (
        <div style={{ marginTop: 12, padding: "14px", background: "rgba(108,99,255,.07)", borderRadius: 14, border: "1px solid rgba(108,99,255,.2)" }}>
          <label style={{ ...S.label, color: "#a78bfa" }}>Monto a cobrar (editable)</label>
          <input
            type="number"
            value={fM.monto || ""}
            onChange={e => setFM(p => ({ ...p, monto: e.target.value }))}
            placeholder="0"
            min="0"
            style={{ ...S.inp }}
            inputMode="numeric"
          />
        </div>
      )}
    </div>
  );
}

// ── PASO 3: Pago ──────────────────────────────────────────────
function Step3({ fM, setFM, gymConfig, comprobantePNG, setComprobantePNG, generandoComp, setGenerandoComp }) {
  const metodos = [
    { id: "Efectivo", icon: "💵", label: "Efectivo" },
    { id: "Transferencia", icon: "🏦", label: "Transferencia" },
    { id: "Tarjeta", icon: "💳", label: "Tarjeta" },
  ];

  const gym = gymConfig || {};
  const fechaInicio = fM.fecha_incorporacion || todayISO();
  // Calcular vencimiento: soporta tanto planes DEFAULT (nombre→meses) como planesMembresia (ciclo_renovacion)
  const venceISO = (() => {
    if (!fM.plan) return null;
    // fM.planData contiene el objeto completo del plan si fue seleccionado del wizard
    const planObj = fM.planData;
    const CICLO_MESES = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
    let meses = null;
    if (planObj) {
      meses = planObj.meses != null ? planObj.meses : CICLO_MESES[planObj.ciclo_renovacion];
    } else {
      // fallback calcVence por nombre
      try { return calcVence(fechaInicio, fM.plan); } catch(e) { return null; }
    }
    if (!meses) return null; // ilimitado
    const [y, mo, d] = fechaInicio.split("-").map(Number);
    const v = new Date(y, mo - 1 + meses, d);
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  })();

  const generar = async () => {
    setGenerandoComp(true);
    try {
      const png = await generarComprobantePNG({
        gymConfig,
        miembro: { nombre: fM.nombre || "—" },
        plan: fM.plan,
        monto: fM.monto,
        formaPago: fM.formaPago,
        venceISO,
      });
      setComprobantePNG(png);
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el comprobante.");
    } finally {
      setGenerandoComp(false);
    }
  };

  const descargar = () => {
    if (!comprobantePNG) return;
    const a = document.createElement("a");
    a.href = comprobantePNG;
    a.download = `comprobante-${(fM.nombre || "miembro").replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
  };

  const compartirWhatsApp = () => {
    const tel = fM.tel || "";
    const gym_nombre = gym.nombre || "el gym";
    const msg = `¡Hola ${fM.nombre?.split(" ")[0] || ""}! 🥋 Tu membresía *${fM.plan}* en *${gym_nombre}* ha sido registrada.\n\n` +
      `📅 Inicio: ${fmtDateShort(fechaInicio)}\n` +
      `📅 Vencimiento: ${fmtDateShort(venceISO)}\n` +
      `💰 Monto: ${fmt$(fM.monto)}\n` +
      `💳 Forma de pago: ${fM.formaPago || "—"}\n\n` +
      `¡Gracias por unirte! Cualquier duda estamos a tus órdenes. 💪`;
    const clean = tel.replace(/\D/g, "");
    const phone = clean.startsWith("52") ? clean : `52${clean}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div>
      {/* Resumen */}
      <div style={{ background: "rgba(108,99,255,.08)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 18 }}>
        <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Resumen de membresía</p>
        {[
          ["Miembro", fM.nombre || "—"],
          ["Plan", fM.plan || "—"],
          ["Monto", fmt$(fM.monto)],
          ["Inicio", fmtDateShort(fechaInicio)],
          ["Vencimiento", fmtDateShort(venceISO)],
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 12 }}>{l}</span>
            <span style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 12, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Métodos de pago */}
      <p style={{ ...S.label, marginBottom: 10 }}>Forma de pago</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
        {metodos.map(m => {
          const sel = fM.formaPago === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { setFM(p => ({ ...p, formaPago: m.id })); setComprobantePNG(null); }}
              style={{
                padding: "14px 8px",
                border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
                background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                transition: "all .2s",
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <span style={{ color: sel ? "#c4b5fd" : "var(--text-primary,#e8e8f0)", fontSize: 12, fontWeight: sel ? 700 : 500 }}>
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Efectivo / Tarjeta → Generar comprobante */}
      {(fM.formaPago === "Efectivo" || fM.formaPago === "Tarjeta") && (
        <div>
          <button
            onClick={generar}
            disabled={generandoComp}
            style={{
              ...S.btnPrimary,
              width: "100%", marginBottom: 10,
              background: generandoComp ? "rgba(108,99,255,.4)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
              boxShadow: generandoComp ? "none" : "0 4px 18px rgba(108,99,255,.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{generandoComp ? "⏳" : "🧾"}</span>
            {generandoComp ? "Generando..." : "Generar comprobante"}
          </button>

          {comprobantePNG && (
            <div style={{ animation: "fadeIn .3s ease" }}>
              <img
                src={comprobantePNG}
                alt="Comprobante"
                style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border,#2a2a3e)", marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={descargar} style={{ ...S.btnSecondary, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <span>📥</span> Descargar
                </button>
                {fM.tel && (
                  <button onClick={compartirWhatsApp} style={{
                    flex: 1, padding: "12px", border: "none", borderRadius: 14,
                    background: "rgba(37,211,102,.15)", border: "1px solid rgba(37,211,102,.3)",
                    color: "#25d366", cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13,
                  }}>
                    <span style={{ fontSize: 18 }}>📲</span> WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transferencia → datos bancarios */}
      {fM.formaPago === "Transferencia" && (
        <div style={{ background: "rgba(56,189,248,.07)", border: "1px solid rgba(56,189,248,.2)", borderRadius: 14, padding: "14px 16px" }}>
          <p style={{ color: "#38bdf8", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>📋 Datos bancarios del gym</p>
          {[
            ["CLABE", gym.transferencia_clabe || "—"],
            ["Titular", gym.transferencia_titular || "—"],
            ["Banco", gym.transferencia_banco || "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 12 }}>{l}</span>
              <span style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 12, fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.2)", borderRadius: 10 }}>
            <p style={{ color: "#fbbf24", fontSize: 11 }}>
              ⏳ El comprobante se generará después desde el historial del miembro, una vez que se confirme la transferencia.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Genera QR PNG usando qrcodejs CDN ────────────────────────────
async function generarQRPNG(text) {
  return new Promise((resolve) => {
    try {
      // Load qrcodejs if needed
      const cargar = () => new Promise((res) => {
        if (window.QRCode) { res(); return; }
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
      cargar().then(() => {
        if (!window.QRCode) { resolve(null); return; }
        const div = document.createElement("div");
        div.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:200px;height:200px;";
        document.body.appendChild(div);
        new window.QRCode(div, {
          text, width: 200, height: 200,
          colorDark: "#1a1a2e", colorLight: "#ffffff",
          correctLevel: window.QRCode.CorrectLevel.H,
        });
        setTimeout(() => {
          const canvas = div.querySelector("canvas");
          const png = canvas ? canvas.toDataURL("image/png") : null;
          document.body.removeChild(div);
          resolve(png);
        }, 300);
      });
    } catch(e) { resolve(null); }
  });
}

// ── Componente principal ────────────────────────────────────────
export default function NuevoMiembroWizard({
  onClose,
  onAdd,
  gymConfig,
  gymId,
  activePlanes,
  planesMembresia,
  PhotoModal,
  isDojo,
}) {
  const [step, setStep] = useState(1);
  const [fM, setFM] = useState({
    nombre: "", tel: "", foto: null,
    sexo: "", fecha_nacimiento: "",
    fecha_incorporacion: todayISO(),
    notas: "",
    beca: false,
    tutor_nombre: "", tutor_telefono: "", tutor_parentesco: "",
    plan: null, monto: null,
    formaPago: null,
    // ── DOJO ──
    grado_actual: "",
    fecha_ultimo_examen: "",
    proximo_objetivo: "",
  });
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [comprobantePNG, setComprobantePNG] = useState(null);
  const [generandoComp, setGenerandoComp] = useState(false);
  const [saving, setSaving] = useState(false);

  const planes = planesMembresia?.length > 0 ? planesMembresia : (activePlanes || DEFAULT_PLANES);
  const [clases, setClases] = useState([]);
  const [horarios, setHorarios] = useState([]);
  useEffect(() => {
    if (!gymId) return;
    Promise.all([supabase.from("clases"), supabase.from("horarios")]).then(([dbC, dbH]) =>
      Promise.all([dbC.select(gymId), dbH.select(gymId)])
    ).then(([cData, hData]) => {
      setClases((cData || []).filter(c => c.activo !== false));
      setHorarios(hData || []);
    }).catch(() => {});
  }, [gymId]);

  const esMenorWizard = esMenorDeEdad(fM.fecha_nacimiento);
  const tutorValido = !esMenorWizard || (
    !!(fM.tutor_nombre || "").trim() &&
    !!(fM.tutor_telefono || "").trim()
  );
  const canNext1 = !!fM.nombre.trim() && tutorValido;
  const tutorError = esMenorWizard && !tutorValido && fM.nombre.trim();
  const hasPlan = !!fM.plan;
  // Step 3 only if plan was chosen
  const totalSteps = hasPlan || step === 2 ? 3 : 3; // always 3 but step 3 is optional

  const goNext = () => {
    if (step === 1 && !canNext1) return;
    if (step === 2 && !hasPlan) {
      // skip pago — sin membresía
      handleAdd();
      return;
    }
    if (step === 2 && hasPlan && fM.beca) {
      // skip pago — becario no paga
      handleAdd();
      return;
    }
    setStep(s => Math.min(s + 1, 3));
  };

  const goPrev = () => setStep(s => Math.max(s - 1, 1));

  const handleAdd = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Build WA message for the queue
      const gym = gymConfig || {};
      const nombre1 = (fM.nombre || "").split(" ")[0];
      const gymNombre = gym.nombre || "el gym";
      const fechaInicioPago = fM.fecha_incorporacion || todayISO();
      // compute vence again here for the message
      const CICLO_MESES_ADD = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
      const planObj2 = fM.planData;
      let meses2 = null;
      if (planObj2) meses2 = planObj2.meses != null ? planObj2.meses : CICLO_MESES_ADD[planObj2.ciclo_renovacion];
      let venceISOAdd = null;
      if (fM.plan && meses2) {
        const [y2, mo2, d2] = fechaInicioPago.split("-").map(Number);
        const v2 = new Date(y2, mo2 - 1 + meses2, d2);
        venceISOAdd = `${v2.getFullYear()}-${String(v2.getMonth()+1).padStart(2,"0")}-${String(v2.getDate()).padStart(2,"0")}`;
      } else if (fM.plan && !planObj2) {
        try { venceISOAdd = calcVence(fechaInicioPago, fM.plan); } catch(e) {}
      }
      const fmtShortLocal = (iso) => {
        if (!iso) return "—";
        const [y,m,d] = iso.split("-");
        const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        return `${parseInt(d)} ${MESES[parseInt(m)-1]} ${y}`;
      };
      // Determine recipient phone: tutor if minor, else member
      const esMenorLocal = fM.fecha_nacimiento ? (() => {
        const n = new Date(fM.fecha_nacimiento + "T00:00:00");
        const h = new Date();
        let e = h.getFullYear() - n.getFullYear();
        const mo = h.getMonth() - n.getMonth();
        if (mo < 0 || (mo === 0 && h.getDate() < n.getDate())) e--;
        return e < 18;
      })() : false;
      const telDestino = esMenorLocal && fM.tutor_telefono ? fM.tutor_telefono : fM.tel;

      let waMsg = null;
      if (fM.plan) {
        waMsg = `¡Hola ${nombre1}! 🥋 Tu membresía *${fM.plan}* en *${gymNombre}* ha sido registrada.

` +
          `📅 Inicio: ${fmtShortLocal(fechaInicioPago)}
` +
          (venceISOAdd ? `📅 Vencimiento: ${fmtShortLocal(venceISOAdd)}
` : "") +
          `💰 Monto: $${Number(fM.monto || 0).toLocaleString("es-MX")}
` +
          `💳 Forma de pago: ${fM.formaPago || "Efectivo"}

` +
          `¡Gracias por unirte! Cualquier duda estamos a tus órdenes. 💪`;
      }

      // Generate QR PNG for the welcome message
      let qrPNG = null;
      try {
        const qrText = `gymfit:member:${(fM.nombre || "").replace(/\s+/g, "_")}:${Date.now()}`;
        qrPNG = await generarQRPNG(qrText);
      } catch(e) {}

      await onAdd(fM, {
        comprobantePNG,
        qrPNG,
        waMsg,
        tel: telDestino,
        nombreMiembro: fM.nombre,
        venceISO: venceISOAdd,
        plan: fM.plan,
        formaPago: fM.formaPago,
        monto: fM.monto,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = ["Datos", "Membresía", "Pago"];

  // Determine if step 2 "next" should say "Sin membresía", "Beca" or "Siguiente"
  const nextLabel = step === 2 && !hasPlan
    ? "✓ Agregar sin membresía"
    : step === 2 && hasPlan && fM.beca
      ? saving ? "Guardando..." : "🎓 Agregar (Beca — $0)"
      : step === 3
        ? saving ? "Guardando..." : "✓ Agregar miembro"
        : "Siguiente →";

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.sheet}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ color: "var(--text-primary,#e8e8f0)", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span>👤</span>
              Nuevo {gymConfig?.termino_miembros?.replace(/s$/, "") || "Miembro"}
            </h2>
            <button
              onClick={onClose}
              style={{ background: "var(--bg-elevated,#1e1e2e)", border: "1px solid var(--border,#2a2a3e)", borderRadius: 10, width: 32, height: 32, cursor: "pointer", color: "var(--text-primary,#e8e8f0)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
            >✕</button>
          </div>
          <ProgressBar step={step} total={3} labels={stepLabels} />
        </div>

        {/* Body */}
        <div style={S.body}>
          {step === 1 && (
            <Step1
              fM={fM} setFM={setFM}
              showFotoModal={showFotoModal}
              setShowFotoModal={setShowFotoModal}
              PhotoModal={PhotoModal}
              isDojo={isDojo}
            />
          )}
          {step === 2 && (
            <Step2 fM={fM} setFM={setFM} planes={planes} clases={clases} horarios={horarios} />
          )}
          {step === 3 && (
            <Step3
              fM={fM} setFM={setFM}
              gymConfig={gymConfig}
              comprobantePNG={comprobantePNG}
              setComprobantePNG={setComprobantePNG}
              generandoComp={generandoComp}
              setGenerandoComp={setGenerandoComp}
            />
          )}
        </div>

        {/* Footer nav */}
        <div style={S.footer}>
          {step === 1 && tutorError && (
            <div style={{ background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
              <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600 }}>⚠️ El miembro es menor de edad — debes completar los datos del tutor para continuar.</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 ? (
              <button onClick={goPrev} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 20px" }}>
                ← Anterior
              </button>
            ) : (
              <button onClick={onClose} style={{ ...S.btnSecondary, flex: "0 0 auto", padding: "14px 16px" }}>
                Cancelar
              </button>
            )}
            <button
              onClick={step === 3 ? handleAdd : goNext}
              disabled={(step === 1 && !canNext1) || saving}
              style={{
                ...S.btnPrimary,
                opacity: (step === 1 && !canNext1) || saving ? 0.5 : 1,
                cursor: (step === 1 && !canNext1) || saving ? "not-allowed" : "pointer",
              }}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
