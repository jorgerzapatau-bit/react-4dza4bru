// src/modals/NuevoMiembroWizard.jsx
// ══════════════════════════════════════════════════════════════════
//  Wizard 3 pasos para dar de alta un nuevo miembro:
//  [1 Datos] → [2 Membresía] → [3 Pago]
//  Con barra de progreso, navegación ← / → y generación de comprobante.
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import TutorFields from "../components/TutorFields";
import { todayISO, calcEdad } from "../utils/dateUtils";
import { esMenorDeEdad } from "../utils/tutorUtils";
import { DEFAULT_PLANES, calcVence, GRADOS_KARATE } from "../utils/constants";

// ── Helpers ──────────────────────────────────────────────────────
function fmt$(n) {
  return "$" + Number(n || 0).toLocaleString("es-MX");
}

// eslint-disable-next-line no-unused-vars
function _fmtDateLong(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// eslint-disable-next-line no-unused-vars
function _fmtDateMed(isoStr) {
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
// eslint-disable-next-line no-unused-vars
function _cargarScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Genera el comprobante como PNG data-URL usando canvas ────────
// eslint-disable-next-line no-unused-vars
async function _generarComprobantePNGLegacy({ gymConfig, miembro, plan, monto, formaPago, venceISO }) {
  const gym = gymConfig || {};
  const nombre   = gym.nombre   || "GymFit Pro";
  const slogan   = gym.slogan   || "Fortaleza y Disciplina";
  const tel      = gym.telefono || "";
  const facebook = gym.facebook || "";
  const logo     = gym.logo     || null;
  const _titular  = gym.transferencia_titular || "—"; // eslint-disable-line no-unused-vars
  const propietario = gym.propietario_nombre || "";

  const hoyD = new Date();
  const DIAS_LONG = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES_LONG = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fechaHoy = `${DIAS_LONG[hoyD.getDay()]}, ${MESES_LONG[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO ? `${DIAS_LONG[new Date(venceISO+"T00:00:00").getDay()]}, ${MESES_LONG[new Date(venceISO+"T00:00:00").getMonth()]} ${new Date(venceISO+"T00:00:00").getDate()}, ${new Date(venceISO+"T00:00:00").getFullYear()}` : "—";

  const W = 520; // eslint-disable-line no-unused-vars
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
// Cada clase ya tiene su precio de membresía integrado.
// El precio real se resuelve igual que en ClasesScreen:
//   planVinculado?.precio_publico ?? clase?.costo ?? 0
// Seleccionar la clase = seleccionar la membresía.
function Step2({ fM, setFM, clases, horarios, planesMembresia, isDojo, activePlanes }) {
  const edad    = fM.fecha_nacimiento ? calcEdad(fM.fecha_nacimiento) : null;
  const esMenor = edad !== null && edad < 18;

  const CICLO_LABEL = { mensual: "mes", trimestral: "trimestre", semestral: "semestre", anual: "año" };
  const DIAS_SHORT  = { lun:"L", mar:"M", mie:"X", jue:"J", vie:"V", sab:"S", dom:"D" };
  const MESES_MAP   = { mensual:1, trimestral:3, semestral:6, anual:12 };

  const fmtHora = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? "p.m." : "a.m."}`;
  };

  // Resolver precio y ciclo para una clase — misma lógica que ClasesScreen
  // IMPORTANTE: planNombre siempre es el nombre de la CLASE (lo que el usuario eligió),
  // no el nombre del plan contable interno. El plan vinculado solo aporta precio y ciclo.
  const resolverPrecio = (c) => {
    const planVinculado = (planesMembresia || []).find(p =>
      (p.clases_vinculadas || []).map(String).includes(String(c.id))
    );
    const precio = Number(planVinculado?.precio_publico ?? c?.costo ?? 0);
    const ciclo  = planVinculado?.ciclo_renovacion || c?.ciclo_renovacion || "mensual";
    const meses  = planVinculado?.meses ?? MESES_MAP[ciclo] ?? 1;
    const planNombre = c.nombre; // siempre el nombre de la clase, no del plan contable
    return { precio, ciclo, meses, planNombre, planVinculado };
  };

  const clasesActivas = (clases || []).filter(c => c.activo !== false);

  const ageCheck = (c) => {
    if (edad === null) return { apto: true, warning: null };
    const min = c.edad_min ?? 0;
    const max = c.edad_max ?? 99;
    if (edad < min) return { apto: false, warning: `Mínimo ${min} años` };
    if (edad > max) return { apto: false, warning: `Máximo ${max} años` };
    return { apto: true, warning: null };
  };

  const horariosDeClase = (claseId) =>
    (horarios || []).filter(h => h.clase_id === claseId && h.activo !== false);

  // ── GIMNASIO: planes del gym + clases disponibles ──────────────
  if (!isDojo) {
    const gymPlanes   = (activePlanes || DEFAULT_PLANES).filter(p => p.activo !== false);
    const clasesGym   = (clases || []).filter(c => c.activo !== false);
    const CICLO_LBL   = { mensual:"mes", trimestral:"trimestre", semestral:"semestre", anual:"año" };
    const MESES_MAP_G = { mensual:1, trimestral:3, semestral:6, anual:12 };

    // Helpers de toggle para planesExtra (clases)
    const isExtraSelected = (claseId) =>
      (fM.planesExtra||[]).some(p => p.id === String(claseId));

    const toggleClase = (clase) => {
      const id = String(clase.id);
      const planVinc = (planesMembresia||[]).find(p =>
        (p.clases_vinculadas||[]).map(String).includes(id)
      );
      const precio = Number(planVinc?.precio_publico ?? clase?.costo ?? 0);
      const ciclo  = planVinc?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";
      const meses  = planVinc?.meses ?? MESES_MAP_G[ciclo] ?? 1;
      setFM(prev => {
        const ya = (prev.planesExtra||[]).some(p => p.id === id);
        const extras = ya
          ? (prev.planesExtra||[]).filter(p => p.id !== id)
          : [...(prev.planesExtra||[]), {
              id, nombre: clase.nombre, monto: prev.beca ? 0 : precio,
              planData: { id, nombre: clase.nombre, precio_publico: precio, ciclo_renovacion: ciclo, meses },
              tipo: "clase",
            }];
        return { ...prev, planesExtra: extras };
      });
    };

    const totalMonto = (() => {
      const base  = fM.plan ? Number(fM.monto||0) : 0;
      const extra = (fM.planesExtra||[]).reduce((s,p)=>s+Number(p.monto||0),0);
      return base + extra;
    })();

    const haySeleccion = !!(fM.plan) || (fM.planesExtra||[]).length > 0;

    return (
      <div>
        {/* ── Sección: Planes del Gimnasio ── */}
        {gymPlanes.length > 0 && (
          <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>
            🏋️ Membresía del Gimnasio
          </p>
        )}

        {/* Sin membresía */}
        <button
          onClick={() => setFM(p => ({ ...p, claseId:null, planId:null, plan:null, monto:null, planData:null }))}
          style={{
            width:"100%", padding:"12px 16px", marginBottom:8,
            border: !fM.plan ? "2px solid rgba(167,139,250,.5)" : "1.5px solid var(--border-strong,#2e2e42)",
            borderRadius:14, cursor:"pointer", fontFamily:"inherit",
            background: !fM.plan ? "rgba(167,139,250,.07)" : "var(--bg-elevated,#1e1e2e)",
            display:"flex", alignItems:"center", gap:12, transition:"all .2s", textAlign:"left",
          }}>
          <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
            background: !fM.plan ? "rgba(167,139,250,.18)" : "rgba(255,255,255,.05)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⏸️</div>
          <div style={{ flex:1 }}>
            <p style={{ color: !fM.plan ? "#c4b5fd" : "var(--text-secondary,#9999b3)", fontWeight: !fM.plan?700:500, fontSize:13 }}>
              Sin membresía del gym
            </p>
            <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:1 }}>Solo inscripción a clases</p>
          </div>
          {!fM.plan && <span style={{ color:"#a78bfa", fontSize:16 }}>✓</span>}
        </button>

        {/* Lista de planes del gym */}
        {gymPlanes.map(plan => {
          const isSel  = fM.plan === plan.nombre;
          const precio = Number(plan.precio||0);
          const ciclo  = plan.ciclo_renovacion || "mensual";
          const meses  = plan.meses ?? MESES_MAP_G[ciclo] ?? 1;
          return (
            <button key={plan.nombre}
              onClick={() => setFM(prev => ({
                ...prev, claseId:null, planId:plan.nombre, plan:plan.nombre,
                monto: prev.beca ? "0" : String(precio),
                planData: { id:plan.nombre, nombre:plan.nombre, precio_publico:precio, ciclo_renovacion:ciclo, meses },
              }))}
              style={{
                width:"100%", padding:"12px 16px", marginBottom:8,
                border: isSel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                background: isSel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                display:"flex", alignItems:"center", gap:12, transition:"all .2s", textAlign:"left",
              }}>
              <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
                background: isSel ? "rgba(108,99,255,.2)" : "rgba(255,255,255,.05)",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                {meses>=12?"🏆":meses>=6?"🔥":meses>=3?"⚡":"📅"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ color: isSel?"#a78bfa":"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:13 }}>{plan.nombre}</p>
                <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:1 }}>Vigencia: {meses} {meses===1?"mes":"meses"}</p>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {precio > 0 ? (
                  <>
                    <p style={{ background: isSel?"rgba(108,99,255,.2)":"rgba(255,255,255,.07)", color: isSel?"#a78bfa":"var(--text-secondary,#9999b3)", borderRadius:10, padding:"3px 10px", fontSize:13, fontWeight:700 }}>
                      {fM.beca&&isSel ? <span style={{ color:"#4ade80" }}>$0</span> : `$${precio.toLocaleString("es-MX")}`}
                    </p>
                    {!fM.beca && <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:10, marginTop:2 }}>/ {CICLO_LBL[ciclo]||ciclo}</p>}
                  </>
                ) : (
                  <p style={{ background:"rgba(74,222,128,.1)", color:"#4ade80", borderRadius:10, padding:"3px 10px", fontSize:12, fontWeight:700 }}>Gratuito</p>
                )}
              </div>
            </button>
          );
        })}

        {/* ── Sección: Clases disponibles ── */}
        {clasesGym.length > 0 && (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:8, margin:"14px 0 8px" }}>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,.07)" }} />
              <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, flexShrink:0 }}>
                🗓️ Clases (selección múltiple)
              </p>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,.07)" }} />
            </div>

            {clasesGym.map(clase => {
              const planVinc = (planesMembresia||[]).find(p =>
                (p.clases_vinculadas||[]).map(String).includes(String(clase.id))
              );
              const precio = Number(planVinc?.precio_publico ?? clase?.costo ?? 0);
              const ciclo  = planVinc?.ciclo_renovacion || clase?.ciclo_renovacion || "mensual";
              const horClase = (horarios||[]).filter(h => h.clase_id === clase.id && h.activo !== false);
              const DIAS_S = { lun:"L", mar:"M", mie:"X", jue:"J", vie:"V", sab:"S", dom:"D" };
              const diasStr = horClase.length > 0
                ? [...new Set(horClase.flatMap(h => h.dias_semana||[]))].map(d=>DIAS_S[d]||d).join(" ")
                : null;
              const horaStr = horClase.length > 0 && horClase[0].hora_inicio
                ? (() => { const [h,m]=horClase[0].hora_inicio.split(":"); const hr=parseInt(h); return `${hr%12||12}:${m} ${hr>=12?"p.m.":"a.m."}`; })()
                : null;
              const isSel = isExtraSelected(clase.id);

              return (
                <button key={clase.id} onClick={() => toggleClase(clase)}
                  style={{
                    width:"100%", padding:"12px 16px", marginBottom:8,
                    border: isSel ? "2px solid #22d3ee" : "1.5px solid var(--border-strong,#2e2e42)",
                    borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                    background: isSel ? "rgba(34,211,238,.1)" : "var(--bg-elevated,#1e1e2e)",
                    display:"flex", alignItems:"center", gap:12, transition:"all .2s", textAlign:"left",
                  }}>
                  {/* Checkbox visual */}
                  <div style={{ width:22, height:22, borderRadius:7, flexShrink:0,
                    border: isSel ? "none" : "2px solid rgba(255,255,255,.2)",
                    background: isSel ? "#22d3ee" : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>
                    {isSel && "✓"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ color: isSel?"#22d3ee":"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:13 }}>{clase.nombre}</p>
                    {(diasStr || horaStr) && (
                      <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:1 }}>
                        {horaStr && `🕐 ${horaStr}`}{diasStr && `  ${diasStr}`}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    {precio > 0 ? (
                      <>
                        <p style={{ background: isSel?"rgba(34,211,238,.2)":"rgba(255,255,255,.07)", color: isSel?"#22d3ee":"var(--text-secondary,#9999b3)", borderRadius:10, padding:"3px 10px", fontSize:13, fontWeight:700 }}>
                          {fM.beca ? <span style={{ color:"#4ade80" }}>$0</span> : `$${precio.toLocaleString("es-MX")}`}
                        </p>
                        {!fM.beca && <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:10, marginTop:2 }}>/ {CICLO_LBL[ciclo]||ciclo}</p>}
                      </>
                    ) : (
                      <p style={{ background:"rgba(74,222,128,.1)", color:"#4ade80", borderRadius:10, padding:"3px 10px", fontSize:12, fontWeight:700 }}>Incluida</p>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* Monto editable si hay plan principal y no es beca */}
        {fM.plan && !fM.beca && (
          <div style={{ marginTop:8, padding:"12px 14px", background:"rgba(108,99,255,.07)", border:"1px solid rgba(108,99,255,.2)", borderRadius:14 }}>
            <label style={{ color:"#a78bfa", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:6, display:"block" }}>
              💰 Monto membresía gym (editable)
            </label>
            <input type="number" value={fM.monto||""} min="0"
              onChange={e => setFM(p => ({ ...p, monto:e.target.value }))}
              placeholder="0" inputMode="numeric"
              style={{ width:"100%", background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border-strong,#2e2e42)", borderRadius:12, padding:"10px 14px", color:"var(--text-primary,#e8e8f0)", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
          </div>
        )}

        {/* Montos editables de clases seleccionadas */}
        {(fM.planesExtra||[]).length > 0 && !fM.beca && (
          <div style={{ marginTop:8, padding:"12px 14px", background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.25)", borderRadius:14 }}>
            <label style={{ color:"#22d3ee", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8, display:"block" }}>
              🗓️ Monto clases (editable)
            </label>
            {(fM.planesExtra||[]).map(pe => (
              <div key={pe.id} style={{ marginBottom:8 }}>
                <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginBottom:4 }}>{pe.nombre}</p>
                <input type="number" value={pe.monto||""} min="0"
                  onChange={e => setFM(p => ({
                    ...p,
                    planesExtra: (p.planesExtra||[]).map(x =>
                      x.id === pe.id ? { ...x, monto: e.target.value } : x
                    )
                  }))}
                  placeholder="0" inputMode="numeric"
                  style={{ width:"100%", background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border-strong,#2e2e42)", borderRadius:12, padding:"10px 14px", color:"var(--text-primary,#e8e8f0)", fontSize:14, fontFamily:"'DM Mono',monospace", fontWeight:700, outline:"none", boxSizing:"border-box" }} />
              </div>
            ))}
          </div>
        )}

        {/* Resumen de selección múltiple */}
        {haySeleccion && (fM.planesExtra||[]).length > 0 && !fM.beca && (
          <div style={{ marginTop:10, padding:"12px 14px", background:"rgba(34,211,238,.06)", border:"1px solid rgba(34,211,238,.2)", borderRadius:14 }}>
            <p style={{ color:"#8b949e", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Resumen de cobro</p>
            {fM.plan && (
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:"var(--text-secondary,#9999b3)", fontSize:12 }}>🏋️ {fM.plan}</span>
                <span style={{ color:"#a78bfa", fontSize:12, fontWeight:700 }}>${Number(fM.monto||0).toLocaleString("es-MX")}</span>
              </div>
            )}
            {(fM.planesExtra||[]).map(pe => (
              <div key={pe.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:"var(--text-secondary,#9999b3)", fontSize:12 }}>🗓️ {pe.nombre}</span>
                <span style={{ color:"#22d3ee", fontSize:12, fontWeight:700 }}>${Number(pe.monto||0).toLocaleString("es-MX")}</span>
              </div>
            ))}
            <div style={{ borderTop:"1px solid rgba(255,255,255,.08)", marginTop:8, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
              <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:13, fontWeight:700 }}>Total</span>
              <span style={{ color:"#4ade80", fontSize:14, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>${totalMonto.toLocaleString("es-MX")}</span>
            </div>
          </div>
        )}

        {/* Aviso beca */}
        {fM.beca && (
          <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(251,191,36,.08)", border:"1px solid rgba(251,191,36,.3)", borderRadius:12, display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:16 }}>🎓</span>
            <p style={{ color:"#fbbf24", fontSize:11 }}>Miembro becario — el cobro será <strong>$0</strong>. Se saltará el paso de pago.</p>
          </div>
        )}

        {!haySeleccion && gymPlanes.length > 0 && (
          <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, textAlign:"center", marginTop:14, lineHeight:1.5 }}>
            Si no seleccionas nada, el miembro se registrará{" "}
            <strong style={{ color:"var(--text-secondary,#9999b3)" }}>sin membresía</strong> y podrás asignarla después.
          </p>
        )}
      </div>
    );
  }


  // ── DOJO: comportamiento original con clases y horarios ─────────
  return (
    <div>
      {/* Banner menor de edad */}
      {esMenor && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", marginBottom: 14,
          background: "rgba(251,191,36,.09)", border: "1px solid rgba(251,191,36,.28)", borderRadius: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>👶</span>
          <p style={{ color: "#fbbf24", fontSize: 12, lineHeight: 1.4 }}>
            <strong>Menor de edad ({edad} años)</strong> — las clases incompatibles con su rango de edad aparecen deshabilitadas.
          </p>
        </div>
      )}

      {/* ── Opción: Sin clase / sin membresía ── */}
      <button
        onClick={() => setFM(p => ({
          ...p,
          claseId: null, planId: null,
          plan: null, monto: null, planData: null,
        }))}
        style={{
          width: "100%", padding: "14px 16px", marginBottom: 10,
          border: !fM.claseId
            ? "2px solid rgba(167,139,250,.5)"
            : "1.5px solid var(--border-strong,#2e2e42)",
          borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
          background: !fM.claseId ? "rgba(167,139,250,.07)" : "var(--bg-elevated,#1e1e2e)",
          display: "flex", alignItems: "center", gap: 12, transition: "all .2s", textAlign: "left",
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: !fM.claseId ? "rgba(167,139,250,.18)" : "rgba(255,255,255,.05)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>⏸️</div>
        <div style={{ flex: 1 }}>
          <p style={{
            color: !fM.claseId ? "#c4b5fd" : "var(--text-secondary,#9999b3)",
            fontWeight: !fM.claseId ? 700 : 500, fontSize: 14,
          }}>Sin clase por ahora</p>
          <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 2 }}>
            Se puede asignar después desde el perfil
          </p>
        </div>
        {!fM.claseId && <span style={{ color: "#a78bfa", fontSize: 18 }}>✓</span>}
      </button>

      {/* ── Lista de clases (= opciones de membresía) ── */}
      {clasesActivas.length === 0 ? (
        <div style={{
          padding: "16px", borderRadius: 14, marginTop: 8,
          background: "rgba(251,191,36,.06)", border: "1px solid rgba(251,191,36,.2)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <p style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>No hay clases activas</p>
            <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 12, marginTop: 4 }}>
              Ve a Gestión de Clases para crear clases antes de registrar alumnos.
            </p>
          </div>
        </div>
      ) : (
        clasesActivas.map(c => {
          const isSel    = fM.claseId === c.id;
          const { precio, ciclo, meses, planNombre } = resolverPrecio(c);
          const color    = c.color || "#6c63ff";
          const { apto, warning } = ageCheck(c);
          const horas    = horariosDeClase(c.id);

          return (
            <button
              key={c.id}
              onClick={() => {
                if (!apto) return;
                setFM(prev => ({
                  ...prev,
                  claseId:  c.id,
                  planId:   c.id,
                  plan:     planNombre,
                  monto:    prev.beca ? "0" : String(precio),
                  planData: {
                    id:               c.id,
                    nombre:           planNombre,
                    precio_publico:   precio,
                    ciclo_renovacion: ciclo,
                    meses,
                  },
                }));
              }}
              style={{
                width: "100%", padding: "14px 16px", marginBottom: 8,
                border: isSel
                  ? `2px solid ${color}`
                  : !apto
                  ? "1.5px solid rgba(248,113,113,.18)"
                  : "1.5px solid var(--border-strong,#2e2e42)",
                borderRadius: 14,
                cursor: apto ? "pointer" : "not-allowed",
                opacity: !apto ? 0.5 : 1,
                fontFamily: "inherit",
                background: isSel
                  ? `${color}18`
                  : !apto ? "rgba(248,113,113,.03)" : "var(--bg-elevated,#1e1e2e)",
                display: "flex", alignItems: "center", gap: 12,
                transition: "all .2s", textAlign: "left",
              }}
            >
              {/* Dot color de clase */}
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: isSel ? `${color}28` : "rgba(255,255,255,.05)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: color }} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  color: isSel ? color : "var(--text-primary,#e8e8f0)",
                  fontWeight: 700, fontSize: 14,
                }}>
                  {c.nombre}
                </p>

                {/* Horarios de esta clase */}
                {horas.length > 0 && (
                  <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, marginTop: 2 }}>
                    🕐 {fmtHora(horas[0].hora_inicio)} – {fmtHora(horas[0].hora_fin)}
                    {(horas[0].dias_semana || []).length > 0 && (
                      <span style={{ marginLeft: 4 }}>
                        · {horas[0].dias_semana.map(d => DIAS_SHORT[d] || d).join(" ")}
                      </span>
                    )}
                    {horas.length > 1 && (
                      <span style={{ marginLeft: 4, color: "#6b7280" }}>+{horas.length - 1} horarios</span>
                    )}
                  </p>
                )}

                {/* Rango de edad configurado */}
                {((c.edad_min ?? 0) > 0 || (c.edad_max ?? 99) < 99) && (
                  <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 10, marginTop: 2 }}>
                    👤 {c.edad_min ?? 0}–{c.edad_max ?? 99} años
                  </p>
                )}

                {/* Warning de edad incompatible */}
                {warning && (
                  <p style={{ color: "#f87171", fontSize: 11, marginTop: 3 }}>⚠️ {warning}</p>
                )}

                {/* Beca seleccionada */}
                {fM.beca && isSel && (
                  <p style={{ color: "#4ade80", fontSize: 11, marginTop: 3 }}>🎓 Beca — sin costo</p>
                )}
              </div>

              {/* Precio */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {precio > 0 ? (
                  <>
                    <p style={{
                      background: isSel ? `${color}28` : "rgba(255,255,255,.07)",
                      color: isSel ? color : "var(--text-secondary,#9999b3)",
                      borderRadius: 10, padding: "4px 12px",
                      fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                    }}>
                      {fM.beca && isSel
                        ? <span style={{ color: "#4ade80" }}>$0</span>
                        : `$${precio.toLocaleString("es-MX")}`}
                    </p>
                    {!fM.beca && (
                      <p style={{ color: "var(--text-tertiary,#6b6b8a)", fontSize: 10, marginTop: 3 }}>
                        / {CICLO_LABEL[ciclo] || ciclo}
                      </p>
                    )}
                  </>
                ) : (
                  <p style={{
                    background: "rgba(74,222,128,.1)", color: "#4ade80",
                    borderRadius: 10, padding: "4px 12px", fontSize: 12, fontWeight: 700,
                  }}>
                    Gratuita
                  </p>
                )}
              </div>
            </button>
          );
        })
      )}

      {/* Monto editable cuando hay clase/plan seleccionado y no es beca */}
      {fM.claseId && !fM.beca && (
        <div style={{
          marginTop: 8, padding: "14px",
          background: "rgba(108,99,255,.07)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14,
        }}>
          <label style={{
            color: "#a78bfa", fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: .5, marginBottom: 6, display: "block",
          }}>
            💰 Monto a cobrar (editable)
          </label>
          <input
            type="number" value={fM.monto || ""} min="0"
            onChange={e => setFM(p => ({ ...p, monto: e.target.value }))}
            placeholder="0" inputMode="numeric"
            style={{
              width: "100%", background: "var(--bg-elevated,#1e1e2e)",
              border: "1px solid var(--border-strong,#2e2e42)", borderRadius: 12,
              padding: "12px 14px", color: "var(--text-primary,#e8e8f0)",
              fontSize: 15, fontFamily: "'DM Mono',monospace",
              fontWeight: 700, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Aviso beca */}
      {fM.beca && (
        <div style={{
          marginTop: 10, padding: "10px 14px",
          background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 12,
          display: "flex", gap: 8, alignItems: "center",
        }}>
          <span style={{ fontSize: 16 }}>🎓</span>
          <p style={{ color: "#fbbf24", fontSize: 11 }}>
            Alumno becario — el cobro será <strong>$0</strong>. Se saltará el paso de pago.
          </p>
        </div>
      )}

      {/* Nota pie */}
      {!fM.claseId && clasesActivas.length > 0 && (
        <p style={{
          color: "var(--text-tertiary,#6b6b8a)", fontSize: 11, textAlign: "center",
          marginTop: 14, lineHeight: 1.5,
        }}>
          Si no seleccionas clase, el alumno se registrará <strong style={{ color: "var(--text-secondary,#9999b3)" }}>sin membresía</strong> y podrás asignarla después.
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── Generador 1: Identificación Digital (canvas) ─────────────────
// ══════════════════════════════════════════════════════════════════
async function generarIDDigitalPNG({ miembro, gymConfig, codigoAcceso }) {
  const gym  = gymConfig || {}; // eslint-disable-line no-unused-vars
  const W = 400, PAD = 24; // eslint-disable-line no-unused-vars

  // ── Cargar QR primero ──
  const qrText = `gymfit:member:${(miembro.nombre || "").replace(/\s+/g,"_")}:${codigoAcceso}`;
  let qrDataUrl = null;
  try { qrDataUrl = await generarQRPNG(qrText); } catch(e) {}

  const QR_SIZE = 260;
  const HEADER_H = 56;
  const QR_PAD   = 20;
  const FOOTER_H = 90;
  const H = HEADER_H + QR_PAD + QR_SIZE + QR_PAD + FOOTER_H;

  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo blanco
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header degradado suave morado
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, "#f3f0ff");
  grad.addColorStop(1, "#ede9fe");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);

  // Línea inferior del header
  ctx.fillStyle = "#c4b5fd";
  ctx.fillRect(0, HEADER_H - 2, W, 2);

  // Emoji dojo + texto header
  ctx.textAlign = "center";
  ctx.fillStyle = "#5b21b6";
  ctx.font = "bold 13px Arial";
  ctx.letterSpacing = "2px";
  ctx.fillText("🥋  IDENTIFICACIÓN DIGITAL", W / 2, HEADER_H / 2 + 5);

  // Área QR con borde redondeado (simulado)
  const qrX = (W - QR_SIZE) / 2;
  const qrY = HEADER_H + QR_PAD;
  ctx.fillStyle = "#f8f8f8";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(qrX - 10, qrY - 10, QR_SIZE + 20, QR_SIZE + 20, 14);
  ctx.fill(); ctx.stroke();

  // QR image
  if (qrDataUrl) {
    await new Promise(res => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, qrX, qrY, QR_SIZE, QR_SIZE); res(); };
      img.onerror = res;
      img.src = qrDataUrl;
    });
  } else {
    ctx.fillStyle = "#d1d5db";
    ctx.fillRect(qrX, qrY, QR_SIZE, QR_SIZE);
    ctx.fillStyle = "#6b7280"; ctx.font = "14px Arial"; ctx.textAlign = "center";
    ctx.fillText("QR no disponible", W/2, qrY + QR_SIZE/2);
  }

  // Footer: nombre, código acceso
  const footerY = qrY + QR_SIZE + QR_PAD + 14;
  ctx.fillStyle = "#111827";
  ctx.font = "bold 18px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(miembro.nombre || "—", W / 2, footerY);

  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px Arial";
  ctx.letterSpacing = "1.5px";
  ctx.fillText("CÓDIGO DE ACCESO", W / 2, footerY + 22);

  // Badge código
  const codigo = codigoAcceso || "—";
  ctx.fillStyle = "#10b981";
  ctx.font = "bold 16px 'Courier New', monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText("● " + codigo, W / 2, footerY + 46);

  return canvas.toDataURL("image/png");
}

// ══════════════════════════════════════════════════════════════════
// ── Generador 2: Comprobante de Pago (mejorado) ───────────────────
// ══════════════════════════════════════════════════════════════════
async function generarComprobantePagoPNG({ gymConfig, miembro, plan, monto, formaPago, venceISO, propietarioRecibio }) {
  const gym = gymConfig || {};
  const W = 560;

  const hoyD = new Date();
  const DIAS  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fechaHoy  = `${DIAS[hoyD.getDay()]}, ${MESES[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO
    ? (() => { const d = new Date(venceISO+"T00:00:00"); return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })()
    : "—";

  const planLabel = `Plan ${plan || "—"}`;
  const rows = [
    { label: "Fecha:",        value: fechaHoy,                    bold: true },
    { type: "alumno",         nombre: (miembro.nombre || "—").toUpperCase(), plan: planLabel },
    { label: "Modo de Pago:", value: (formaPago || "—").toUpperCase(), bold: true },
    { label: "Cantidad:",     value: "$" + Number(monto||0).toLocaleString("es-MX"), bold: true },
    { label: "Vencimiento:",  value: venceLong,                   bold: true },
    { label: "Recibió:",      value: propietarioRecibio || gym.propietario_nombre || "—", bold: false },
  ];

  const HEADER_H  = 140;
  const ROW_H     = 36;
  const CLABE_H   = gym.transferencia_clabe ? 90 : 0;
  const FOOTER_H  = 60;
  const STAMP_H   = 50;
  const H = HEADER_H + rows.length * ROW_H + CLABE_H + FOOTER_H + STAMP_H + 8;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  // Header bg
  ctx.fillStyle = "#f9fafb"; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke();

  // Logo
  const LOGO_SZ = 80, LX = 20, LY = 18;
  if (gym.logo) {
    await new Promise(res => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.save(); ctx.beginPath();
        ctx.roundRect(LX, LY, LOGO_SZ, LOGO_SZ, 10);
        ctx.clip(); ctx.drawImage(img, LX, LY, LOGO_SZ, LOGO_SZ); ctx.restore(); res();
      };
      img.onerror = res; img.src = gym.logo;
    });
  } else {
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath(); ctx.roundRect(LX, LY, LOGO_SZ, LOGO_SZ, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🥋", LX + LOGO_SZ/2, LY + LOGO_SZ/2);
    ctx.textBaseline = "alphabetic";
  }

  // Gym nombre / slogan / tel
  ctx.textAlign = "center";
  ctx.fillStyle = "#111827"; ctx.font = "bold 17px Georgia,serif";
  ctx.fillText((gym.nombre || "NOMBRE DEL GYM").toUpperCase(), W/2, 38);
  ctx.fillStyle = "#6b7280"; ctx.font = "13px Georgia,serif";
  ctx.fillText(gym.slogan || "Slogan del gimnasio", W/2, 58);
  if (gym.telefono) {
    ctx.fillStyle = "#374151"; ctx.font = "12px Arial";
    ctx.fillText(`WhatsApp: ${gym.telefono}`, W/2, 78);
  }
  if (gym.facebook) {
    ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial";
    ctx.fillText(`Facebook: ${gym.facebook}`, W/2, 96);
  }

  // Separator
  ctx.strokeStyle = "#d1d5db"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(20, 110); ctx.lineTo(W-20, 110); ctx.stroke();
  // "COMPROBANTE DE PAGO RECIBIDO" small stamp arriba derecha
  ctx.fillStyle = "#ef4444"; ctx.font = "bold 9px Arial";
  ctx.textAlign = "right"; ctx.letterSpacing = "0.5px";
  ctx.fillText("COMPROBANTE DE PAGO RECIBIDO", W - 16, 128);
  ctx.textAlign = "left";

  // Rows
  let y = HEADER_H + 2;
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
    ctx.fillStyle = bg; ctx.fillRect(0, y, W, ROW_H);
    ctx.strokeStyle = "#f3f4f6"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(W, y + ROW_H - 0.5); ctx.stroke();

    if (row.type === "alumno") {
      // Nombre alumno centrado grande
      ctx.fillStyle = "#111827"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center";
      ctx.fillText(row.nombre, W/2, y + 20);
      ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial";
      ctx.fillText(row.plan, W/2, y + ROW_H - 6);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#6b7280"; ctx.font = "12px Arial";
      ctx.fillText(row.label, 24, y + ROW_H - 12);
      ctx.fillStyle = "#111827"; ctx.font = row.bold ? "bold 13px Arial" : "13px Arial";
      ctx.textAlign = "right";
      ctx.fillText(row.value, W - 24, y + ROW_H - 12);
      ctx.textAlign = "left";
    }
    y += ROW_H;
  });

  // CLABE section
  if (gym.transferencia_clabe) {
    ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, y, W, CLABE_H);
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.fillStyle = "#111827"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
    ctx.fillText("PARA TRANSFERENCIAS:", 24, y + 22);
    ctx.font = "12px Arial"; ctx.fillStyle = "#374151";
    ctx.fillText(`CLABE:  ${gym.transferencia_clabe}`, 24, y + 42);
    ctx.fillText(`Beneficiario:  ${gym.transferencia_titular || "—"}`, 24, y + 60);
    if (gym.transferencia_banco) ctx.fillText(`Banco:  ${gym.transferencia_banco}`, 24, y + 78);
    y += CLABE_H;
  }

  // Footer instrucción
  ctx.fillStyle = "#f9fafb"; ctx.fillRect(0, y, W, FOOTER_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.fillStyle = "#6b7280"; ctx.font = "11px Arial"; ctx.textAlign = "center";
  ctx.fillText("Favor de enviar comprobante de transferencia al número de", W/2, y + 22);
  ctx.fillText("Whatsapp que aparece en la parte superior de este recibo.", W/2, y + 40);
  y += FOOTER_H;

  // STAMP grande al fondo
  ctx.fillStyle = "#111827"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center";
  ctx.fillText("COMPROBANTE DE PAGO RECIBIDO", W/2, y + 34);

  return canvas.toDataURL("image/png");
}

// ══════════════════════════════════════════════════════════════════
// ── Generador 3: Información para Transferencia (canvas) ──────────
// ══════════════════════════════════════════════════════════════════
async function generarInfoTransferenciaPNG({ gymConfig, miembro, plan, monto, venceISO }) {
  const gym = gymConfig || {};
  const W = 560;

  const hoyD = new Date();
  const DIAS  = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const fechaHoy  = `${DIAS[hoyD.getDay()]}, ${MESES[hoyD.getMonth()]} ${hoyD.getDate()}, ${hoyD.getFullYear()}`;
  const venceLong = venceISO
    ? (() => { const d = new Date(venceISO+"T00:00:00"); return `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; })()
    : "—";

  const tableRows = [
    ...(gym.facebook ? [{ label: "Facebook:", value: gym.facebook, span: true }] : []),
    { label: "Fecha:",        value: fechaHoy },
    { label: "ALUMNO",        value: (miembro.nombre || "—").toUpperCase(), bold: true },
    { label: "",              value: (MESES[hoyD.getMonth()]).toUpperCase() },
    { label: "Modo de Pago:", value: "TRANSFERENCIA" },
    { label: "Cantidad:",     value: "$" + Number(monto||0).toLocaleString("es-MX"), big: true },
    { label: "Vencimiento:",  value: venceLong, bold: true },
    { label: "Recibió:",      value: gym.propietario_nombre || gym.transferencia_titular || "—" },
  ];

  const HEADER_H  = 140;
  const ROW_H     = 36;
  const CLABE_H   = 100;
  const FOOTER_H  = 56;
  const H = HEADER_H + tableRows.length * ROW_H + CLABE_H + FOOTER_H + 8;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f9fafb"; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HEADER_H); ctx.lineTo(W, HEADER_H); ctx.stroke();

  // Logo
  const LOGO_SZ = 80, LX = 20, LY = 18;
  if (gym.logo) {
    await new Promise(res => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.save(); ctx.beginPath();
        ctx.roundRect(LX, LY, LOGO_SZ, LOGO_SZ, 10);
        ctx.clip(); ctx.drawImage(img, LX, LY, LOGO_SZ, LOGO_SZ); ctx.restore(); res();
      };
      img.onerror = res; img.src = gym.logo;
    });
  } else {
    ctx.fillStyle = "#1e1b4b"; ctx.beginPath(); ctx.roundRect(LX, LY, LOGO_SZ, LOGO_SZ, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🥋", LX + LOGO_SZ/2, LY + LOGO_SZ/2); ctx.textBaseline = "alphabetic";
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#111827"; ctx.font = "bold 17px Georgia,serif";
  ctx.fillText((gym.nombre || "NOMBRE DEL GYM").toUpperCase(), W/2, 38);
  ctx.fillStyle = "#6b7280"; ctx.font = "13px Georgia,serif";
  ctx.fillText(gym.slogan || "Slogan del gimnasio", W/2, 58);
  if (gym.telefono) {
    ctx.fillStyle = "#374151"; ctx.font = "12px Arial";
    ctx.fillText(`WhatsApp: ${gym.telefono}`, W/2, 78);
  }

  let y = HEADER_H + 2;
  tableRows.forEach((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f9fafb";
    ctx.fillStyle = bg; ctx.fillRect(0, y, W, ROW_H);
    ctx.strokeStyle = "#f3f4f6"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y + ROW_H - 0.5); ctx.lineTo(W, y + ROW_H - 0.5); ctx.stroke();

    if (row.span) {
      ctx.fillStyle = "#374151"; ctx.font = "12px Arial"; ctx.textAlign = "center";
      ctx.fillText(`${row.label}  ${row.value}`, W/2, y + ROW_H - 10); ctx.textAlign = "left";
    } else if (row.big) {
      ctx.fillStyle = "#6b7280"; ctx.font = "12px Arial"; ctx.textAlign = "left";
      ctx.fillText(row.label, 24, y + ROW_H - 10);
      ctx.fillStyle = "#111827"; ctx.font = "bold 16px Arial"; ctx.textAlign = "right";
      ctx.fillText(row.value, W - 24, y + ROW_H - 10); ctx.textAlign = "left";
    } else {
      ctx.fillStyle = "#6b7280"; ctx.font = row.bold ? "bold 12px Arial" : "12px Arial";
      ctx.fillText(row.label, 24, y + ROW_H - 10);
      ctx.fillStyle = "#111827"; ctx.font = row.bold ? "bold 13px Arial" : "13px Arial";
      ctx.textAlign = "right"; ctx.fillText(row.value, W - 24, y + ROW_H - 10);
      ctx.textAlign = "left";
    }
    y += ROW_H;
  });

  // CLABE section
  ctx.fillStyle = "#fff"; ctx.fillRect(0, y, W, CLABE_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  const CLABE = gym.transferencia_clabe || "—";
  const titular = gym.transferencia_titular || "—";
  const banco   = gym.transferencia_banco   || "";
  ctx.fillStyle = "#111827"; ctx.font = "bold 12px Arial"; ctx.textAlign = "left";
  ctx.fillText("PARA TRANSFERENCIAS:", 24, y + 22);
  ctx.font = "12px Arial"; ctx.fillStyle = "#374151";
  ctx.fillText(`CLABE:   ${CLABE}`, 24, y + 42);
  ctx.fillText(`Beneficiario:   ${titular}`, 24, y + 60);
  if (banco) ctx.fillText(`Banco:   ${banco}`, 24, y + 78);
  y += CLABE_H;

  // Footer
  ctx.fillStyle = "#f3f4f6"; ctx.fillRect(0, y, W, FOOTER_H);
  ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  ctx.fillStyle = "#374151"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
  ctx.fillText("Favor de enviar comprobante de transferencia al número de", W/2, y + 20);
  ctx.fillText("Whasthsapp que aparece en la parte superior de este recibo.", W/2, y + 38);

  return canvas.toDataURL("image/png");
}

// ── Copiar imagen PNG al portapapeles ──────────────────────────────
async function copiarImagenAlPortapapeles(dataUrl) {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob })
    ]);
    return true;
  } catch(e) {
    // Fallback: abrir en nueva pestaña para que el usuario copie manualmente
    const win = window.open();
    if (win) { win.document.write(`<img src="${dataUrl}" style="max-width:100%">`); }
    return false;
  }
}

// ── Genera QR PNG usando qrcodejs CDN ────────────────────────────
async function generarQRPNG(text) {
  return new Promise((resolve) => {
    try {
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

// ══════════════════════════════════════════════════════════════════
// ── PASO 3: Pago (bifurcado por forma de pago) ───────────────────
// ══════════════════════════════════════════════════════════════════
function Step3Pago({ fM, setFM, gymConfig, venceISO, hasPlan, montoTotal, comprobantePNG, setComprobantePNG, generandoComp, setGenerandoComp, infoBancoPNG, setInfoBancoPNG, generandoInfo, setGenerandoInfo }) {
  const gym     = gymConfig || {};
  const metodos = [
    { id: "Efectivo",      icon: "💵", label: "Efectivo" },
    { id: "Transferencia", icon: "🏦", label: "Transferencia" },
    { id: "Tarjeta",       icon: "💳", label: "Tarjeta" },
  ];
  const [copiado, setCopiado] = useState(null);

  const fechaInicio = fM.fecha_incorporacion || todayISO();
  const esPorTransferencia = fM.formaPago === "Transferencia";

  const _genComprobante = async () => { // eslint-disable-line no-unused-vars
    setGenerandoComp(true);
    try {
      const png = await generarComprobantePagoPNG({
        gymConfig, miembro: { nombre: fM.nombre },
        plan: fM.plan, monto: fM.monto,
        formaPago: fM.formaPago, venceISO,
      });
      setComprobantePNG(png);
    } catch(e) { alert("No se pudo generar el comprobante."); }
    finally { setGenerandoComp(false); }
  };

  const genInfoBanco = async () => {
    setGenerandoInfo(true);
    try {
      const png = await generarInfoTransferenciaPNG({
        gymConfig, miembro: { nombre: fM.nombre },
        plan: fM.plan, monto: fM.monto, venceISO,
      });
      setInfoBancoPNG(png);
    } catch(e) { alert("No se pudo generar la info de transferencia."); }
    finally { setGenerandoInfo(false); }
  };

  const descargar = (dataUrl, prefix) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${prefix}-${(fM.nombre||"alumno").replace(/\s+/g,"-").toLowerCase()}.png`;
    a.click();
  };

  const copiar = async (dataUrl, key) => {
    await copiarImagenAlPortapapeles(dataUrl);
    setCopiado(key); setTimeout(() => setCopiado(null), 2000);
  };

  const waMsg = fM.plan
    ? `¡Hola ${(fM.nombre||"").split(" ")[0]}! 🥋 Tu membresía *${fM.plan}* en *${gym.nombre||"el gym"}* ha sido registrada.\n\n📅 Inicio: ${fmtDateShort(fechaInicio)}\n📅 Vencimiento: ${fmtDateShort(venceISO)}\n💰 Monto: $${Number(fM.monto||0).toLocaleString("es-MX")}\n💳 Pago: ${fM.formaPago||"—"}\n\n¡Gracias por unirte! 💪`
    : null;

  // Mensaje con datos bancarios idéntico a lo que aparece en el recibo
  const waMsgBanco = fM.plan ? (
    `PARA TRANSFERENCIAS:\n` +
    `CLABE: ${gym.transferencia_clabe || "—"}\n` +
    `Beneficiario: ${gym.transferencia_titular || "—"}\n` +
    (gym.transferencia_banco ? `Banco: ${gym.transferencia_banco}\n` : "") +
    `\nALUMNO: ${(fM.nombre||"").toUpperCase()}\n` +
    `Plan: ${fM.plan}\n` +
    `Monto: $${Number(fM.monto||0).toLocaleString("es-MX")}\n` +
    `\nFavor de enviar comprobante de transferencia al número de WhatsApp que aparece en la parte superior de este recibo.`
  ) : null;

  const abrirWABanco = () => {
    // Usar teléfono del gym para abrir WhatsApp sin número pre-llenado
    // (el alumno abrirá el chat del gym desde su propio WhatsApp)
    const telGym = (gym.telefono || "").replace(/\D/g, "");
    const tel    = (fM.tel || fM.tutor_telefono || "").replace(/\D/g, "");
    // Preferir teléfono del alumno; si no hay, abrir wa.me sin número para que elija
    const phone  = tel ? (tel.startsWith("52") ? tel : "52" + tel) : (telGym ? (telGym.startsWith("52") ? telGym : "52" + telGym) : "");
    const url    = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waMsgBanco)}`
      : `https://wa.me/?text=${encodeURIComponent(waMsgBanco)}`;
    window.open(url, "_blank");
  };

  const BotonesAccion = ({ dataUrl, prefix, cKey }) => (
    <div style={{ display:"flex", gap:7, marginTop:9, flexWrap:"wrap" }}>
      <button onClick={() => descargar(dataUrl, prefix)}
        style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
          background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border-strong,#2e2e42)",
          color:"var(--text-secondary,#9999b3)", fontWeight:600, fontSize:12, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
        📥 Descargar
      </button>
      <button onClick={() => copiar(dataUrl, cKey)}
        style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
          background: copiado===cKey ? "rgba(74,222,128,.12)" : "var(--bg-elevated,#1e1e2e)",
          border: `1px solid ${copiado===cKey ? "rgba(74,222,128,.4)" : "var(--border-strong,#2e2e42)"}`,
          color: copiado===cKey ? "#4ade80" : "var(--text-secondary,#9999b3)",
          fontWeight:600, fontSize:12, cursor:"pointer", transition:"all .2s",
          display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
        {copiado===cKey ? "✓ Copiado" : "📋 Copiar"}
      </button>
      {waMsgBanco && (
        <button onClick={abrirWABanco}
          style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
            background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.3)",
            color:"#25d366", fontWeight:700, fontSize:12, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
          📲 WhatsApp
        </button>
      )}
    </div>
  );

  return (
    <div>
      {/* Resumen */}
      <div style={{ background:"rgba(108,99,255,.08)", border:"1px solid rgba(108,99,255,.2)", borderRadius:14, padding:"12px 16px", marginBottom:16 }}>
        <p style={{ color:"#a78bfa", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Resumen</p>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Alumno</span>
          <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>{fM.nombre||"—"}</span>
        </div>
        {fM.plan && (
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
            <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>🏋️ {fM.plan}</span>
            <span style={{ color:"#a78bfa", fontSize:11, fontWeight:600 }}>${Number(fM.monto||0).toLocaleString("es-MX")}</span>
          </div>
        )}
        {(fM.planesExtra||[]).map(pe => (
          <div key={pe.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
            <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>🗓️ {pe.nombre}</span>
            <span style={{ color:"#22d3ee", fontSize:11, fontWeight:600 }}>${Number(pe.monto||0).toLocaleString("es-MX")}</span>
          </div>
        ))}
        {((fM.planesExtra||[]).length > 0 || fM.plan) && (
          <div style={{ borderTop:"1px solid rgba(255,255,255,.08)", marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Total</span>
            <span style={{ color:"#4ade80", fontSize:12, fontWeight:700 }}>${montoTotal.toLocaleString("es-MX")}</span>
          </div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>Vence</span>
          <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600 }}>{fmtDateShort(venceISO)}</span>
        </div>
      </div>

      {/* Selector forma de pago */}
      {hasPlan && (
        <>
          <p style={{ ...S.label, marginBottom:8 }}>Forma de pago</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
            {metodos.map(m => {
              const sel = fM.formaPago === m.id;
              return (
                <button key={m.id}
                  onClick={() => { setFM(p => ({...p, formaPago:m.id})); setComprobantePNG(null); setInfoBancoPNG(null); }}
                  style={{ padding:"13px 6px", borderRadius:14, cursor:"pointer", fontFamily:"inherit",
                    border: sel ? "2px solid #6c63ff" : "1.5px solid var(--border-strong,#2e2e42)",
                    background: sel ? "rgba(108,99,255,.12)" : "var(--bg-elevated,#1e1e2e)",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:5, transition:"all .2s" }}>
                  <span style={{ fontSize:22 }}>{m.icon}</span>
                  <span style={{ color: sel ? "#c4b5fd" : "var(--text-primary,#e8e8f0)", fontSize:12, fontWeight: sel ? 700 : 500 }}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* ── Efectivo / Tarjeta → nota de que el comprobante se genera en paso 4 ── */}
      {hasPlan && !esPorTransferencia && fM.formaPago && (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"rgba(108,99,255,.07)", border:"1px solid rgba(108,99,255,.2)", borderRadius:12 }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🧾</span>
          <p style={{ color:"var(--text-secondary,#9999b3)", fontSize:12, lineHeight:1.4 }}>
            El <strong style={{ color:"var(--text-primary,#e8e8f0)" }}>comprobante de pago</strong> y la <strong style={{ color:"var(--text-primary,#e8e8f0)" }}>ID Digital</strong> se generarán automáticamente en el siguiente paso.
          </p>
        </div>
      )}

      {/* ── Transferencia → Info bancaria + aviso pendiente ── */}
      {hasPlan && esPorTransferencia && (
        <>
          {/* Banner estado pendiente */}
          <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", background:"rgba(251,191,36,.08)", border:"1px solid rgba(251,191,36,.28)", borderRadius:12, marginBottom:12 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>⏳</span>
            <div>
              <p style={{ color:"#fbbf24", fontWeight:700, fontSize:13 }}>Pago por confirmar</p>
              <p style={{ color:"rgba(251,191,36,.8)", fontSize:11, marginTop:3, lineHeight:1.4 }}>
                El alumno se registrará como <strong>Pendiente</strong> hasta que confirmes el pago desde su perfil. La Identificación Digital se activará en ese momento.
              </p>
            </div>
          </div>

          {/* Info para transferencia */}
          <div style={{ background:"var(--bg-elevated,#1e1e2e)", border:`1.5px solid ${infoBancoPNG ? "#0ea5e955" : "var(--border-strong,#2e2e42)"}`, borderRadius:16, padding:14, marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"rgba(14,165,233,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🏦</div>
                <p style={{ color:"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:13 }}>Info para Transferencia</p>
              </div>
              <button onClick={genInfoBanco} disabled={generandoInfo}
                style={{ padding:"8px 14px", borderRadius:10, border:"none", background: generandoInfo ? "rgba(14,165,233,.3)" : "#0ea5e9",
                  color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit",
                  display:"flex", alignItems:"center", gap:5 }}>
                {generandoInfo ? "⏳ Generando..." : infoBancoPNG ? "✨ Regenerar" : "✨ Generar"}
              </button>
            </div>
            {infoBancoPNG && (
              <>
                <img src={infoBancoPNG} alt="Info transferencia" style={{ width:"100%", borderRadius:10, border:"1px solid var(--border,#2a2a3e)", marginTop:12, boxShadow:"0 2px 12px rgba(0,0,0,.3)" }} />
                <BotonesAccion dataUrl={infoBancoPNG} prefix="transferencia" cKey="banco" waM={waMsg} />
              </>
            )}
          </div>

          {/* Datos bancarios rápidos (para ver sin generar imagen) */}
          {(gym.transferencia_clabe || gym.transferencia_titular) && (
            <div style={{ background:"rgba(14,165,233,.06)", border:"1px solid rgba(14,165,233,.2)", borderRadius:12, padding:"12px 14px" }}>
              <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, marginBottom:8 }}>📋 Datos bancarios rápidos</p>
              {[["CLABE", gym.transferencia_clabe||"—"], ["Titular", gym.transferencia_titular||"—"], ["Banco", gym.transferencia_banco||""]].filter(([,v])=>v).map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11 }}>{l}</span>
                  <span style={{ color:"var(--text-primary,#e8e8f0)", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sin plan → nota */}
      {!hasPlan && (
        <div style={{ padding:"14px 16px", background:"rgba(107,114,128,.07)", border:"1px solid rgba(107,114,128,.2)", borderRadius:12, textAlign:"center" }}>
          <p style={{ color:"var(--text-secondary,#9999b3)", fontSize:13 }}>Sin membresía seleccionada</p>
          <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:4 }}>El alumno se registrará sin plan activo. Podrás asignarle una membresía después.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ── PASO 4: ID Digital + Comprobante (auto-genera al entrar) ─────
// ══════════════════════════════════════════════════════════════════
function Step4ID({ fM, gymConfig, savedMiembro, comprobantePNG, venceISO }) {
  const [idPNG,     setIdPNG]     = useState(null);
  const [generando, setGenerando] = useState(false);
  const [copiadoID, setCopiadoID] = useState(false);
  const [copiadoCo, setCopiadoCo] = useState(false);

  const gym    = gymConfig || {};
  const codigo = savedMiembro?.qr_token ||
    ("DZ-" + Math.random().toString(36).toUpperCase().slice(2,6));

  // ── Auto-generar ID al entrar al paso 4 ──
  useEffect(() => {
    let mounted = true;
    const autoGen = async () => {
      setGenerando(true);
      try {
        const png = await generarIDDigitalPNG({
          miembro: { nombre: fM.nombre }, gymConfig, codigoAcceso: codigo,
        });
        if (mounted) setIdPNG(png);
      } catch(e) {}
      finally { if (mounted) setGenerando(false); }
    };
    autoGen();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const descargar = (dataUrl, nombre) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${nombre}-${(fM.nombre||"alumno").replace(/\s+/g,"-").toLowerCase()}.png`;
    a.click();
  };

  const copiar = async (dataUrl, setCop) => {
    await copiarImagenAlPortapapeles(dataUrl);
    setCop(true); setTimeout(() => setCop(false), 2000);
  };

  const enviarWA = (dataUrl, tipo) => {
    const tel = fM.tel || fM.tutor_telefono || "";
    if (!tel) return;
    const clean = tel.replace(/\D/g,"");
    const phone = clean.startsWith("52") ? clean : "52"+clean;
    const msg = tipo === "id"
      ? `🥋 ¡Bienvenido/a a *${gym.nombre||"el Dojo"}*, ${(fM.nombre||"").split(" ")[0]}!\n\nTe compartimos tu Identificación Digital de acceso.\nCódigo: *${codigo}*\n\nPresénta tu QR en recepción para registrar tu asistencia. 💪`
      : `🧾 Hola ${(fM.nombre||"").split(" ")[0]}, te compartimos tu comprobante de pago en *${gym.nombre||"el Dojo"}*.\n\nPlan: ${fM.plan||"—"} · $${Number(fM.monto||0).toLocaleString("es-MX")}\nVence: ${fmtDateShort(venceISO)}\n\n¡Gracias por tu pago! 💪`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const BotonesDoc = ({ dataUrl, onDescargar, onCopiar, copiado, showWA, waOnClick }) => (
    <div style={{ display:"flex", gap:7, marginTop:10, flexWrap:"wrap" }}>
      <button onClick={onDescargar}
        style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
          background:"var(--bg-card,#12121f)", border:"1px solid var(--border-strong,#2e2e42)",
          color:"var(--text-secondary,#9999b3)", fontWeight:600, fontSize:12, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
        📥 Descargar
      </button>
      <button onClick={onCopiar}
        style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
          background: copiado ? "rgba(74,222,128,.12)" : "var(--bg-card,#12121f)",
          border: `1px solid ${copiado ? "rgba(74,222,128,.4)" : "var(--border-strong,#2e2e42)"}`,
          color: copiado ? "#4ade80" : "var(--text-secondary,#9999b3)",
          fontWeight:600, fontSize:12, cursor:"pointer", transition:"all .2s",
          display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
        {copiado ? "✓ Copiado" : "📋 Copiar"}
      </button>
      {showWA && (
        <button onClick={waOnClick}
          style={{ flex:1, minWidth:80, padding:"10px 8px", borderRadius:12, fontFamily:"inherit",
            background:"rgba(37,211,102,.12)", border:"1px solid rgba(37,211,102,.3)",
            color:"#25d366", fontWeight:700, fontSize:12, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
          📲 WhatsApp
        </button>
      )}
    </div>
  );

  const hasTel = !!(fM.tel || fM.tutor_telefono);

  return (
    <div>
      {/* Celebración */}
      <div style={{ textAlign:"center", marginBottom:20 }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🎉</div>
        <h3 style={{ color:"var(--text-primary,#e8e8f0)", fontSize:18, fontWeight:700, marginBottom:4 }}>
          ¡{(fM.nombre||"").split(" ")[0]} ya es miembro!
        </h3>
        <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:12 }}>
          Registro completado · Pago confirmado
        </p>
      </div>

      {/* ── Card: ID Digital ── */}
      <div style={{ background:"var(--bg-elevated,#1e1e2e)", border:`1.5px solid ${idPNG ? "#8b5cf655" : "var(--border-strong,#2e2e42)"}`, borderRadius:18, padding:16, marginBottom:12, textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: idPNG ? 14 : 0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(139,92,246,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🪪</div>
            <div>
              <p style={{ color:"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:14 }}>Identificación Digital</p>
              <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, marginTop:1 }}>
                {generando ? "Generando..." : `Código: `}
                {!generando && <span style={{ color:"#10b981", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{codigo}</span>}
              </p>
            </div>
          </div>
          <button onClick={async () => {
            setGenerando(true);
            try { const png = await generarIDDigitalPNG({ miembro:{nombre:fM.nombre}, gymConfig, codigoAcceso:codigo }); setIdPNG(png); }
            catch(e) {} finally { setGenerando(false); }
          }} disabled={generando}
            style={{ padding:"8px 14px", borderRadius:11, border:"none",
              background: generando ? "rgba(139,92,246,.3)" : "rgba(139,92,246,.15)",
              color:"#c4b5fd", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:4 }}>
            {generando ? "⏳" : "↺"} {generando ? "Generando..." : "Regenerar"}
          </button>
        </div>
        {generando && !idPNG && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 0", gap:10 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", border:"2px solid #8b5cf6", borderTopColor:"transparent", animation:"spin .8s linear infinite" }} />
            <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:12 }}>Generando tu identificación...</p>
          </div>
        )}
        {idPNG && (
          <>
            <img src={idPNG} alt="ID Digital" style={{ width:"100%", borderRadius:12, border:"1px solid var(--border,#2a2a3e)", boxShadow:"0 4px 20px rgba(0,0,0,.4)" }} />
            <BotonesDoc
              dataUrl={idPNG}
              onDescargar={() => descargar(idPNG, "ID")}
              onCopiar={() => copiar(idPNG, setCopiadoID)}
              copiado={copiadoID}
              showWA={hasTel}
              waOnClick={() => enviarWA(idPNG, "id")}
            />
          </>
        )}
      </div>

      {/* ── Card: Comprobante de Pago ── */}
      {comprobantePNG && (
        <div style={{ background:"var(--bg-elevated,#1e1e2e)", border:"1.5px solid #6c63ff55", borderRadius:18, padding:16, marginBottom:12, textAlign:"left" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(108,99,255,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🧾</div>
            <p style={{ color:"var(--text-primary,#e8e8f0)", fontWeight:700, fontSize:14 }}>Comprobante de Pago</p>
          </div>
          <img src={comprobantePNG} alt="Comprobante" style={{ width:"100%", borderRadius:12, border:"1px solid var(--border,#2a2a3e)", boxShadow:"0 4px 20px rgba(0,0,0,.4)" }} />
          <BotonesDoc
            dataUrl={comprobantePNG}
            onDescargar={() => descargar(comprobantePNG, "comprobante")}
            onCopiar={() => copiar(comprobantePNG, setCopiadoCo)}
            copiado={copiadoCo}
            showWA={hasTel}
            waOnClick={() => enviarWA(comprobantePNG, "comp")}
          />
        </div>
      )}

      <p style={{ color:"var(--text-tertiary,#6b6b8a)", fontSize:11, lineHeight:1.5, textAlign:"center" }}>
        La ID Digital es el acceso oficial del alumno al dojo.<br/>Descárgala, cópiala o envíala por WhatsApp.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
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
  const [step,          setStep]          = useState(1);
  const [savedMiembro,  setSavedMiembro]  = useState(null); // miembro ya guardado en BD
  const [saving,        setSaving]        = useState(false);
  const [comprobantePNG, setComprobantePNG] = useState(null);
  const [generandoComp,  setGenerandoComp]  = useState(false);
  const [infoBancoPNG,   setInfoBancoPNG]   = useState(null);
  const [generandoInfo,  setGenerandoInfo]  = useState(false);
  const [showFotoModal,  setShowFotoModal]  = useState(false);

  const [fM, setFM] = useState({
    nombre:"", tel:"", foto:null,
    sexo:"", fecha_nacimiento:"",
    fecha_incorporacion: todayISO(),
    notas:"", beca:false,
    tutor_nombre:"", tutor_telefono:"", tutor_parentesco:"",
    plan:null, monto:null, claseId:null, planData:null, planId:null,
    planesExtra: [],
    formaPago:null,
    grado_actual:"", fecha_ultimo_examen:"", proximo_objetivo:"",
  });

  const planes = planesMembresia?.length > 0 ? planesMembresia : (activePlanes || DEFAULT_PLANES);
  const [clases,   setClases]   = useState([]);
  const [horarios, setHorarios] = useState([]);
  useEffect(() => {
    if (!gymId) return;
    Promise.all([supabase.from("clases"), supabase.from("horarios")])
      .then(([dbC, dbH]) => Promise.all([dbC.select(gymId), dbH.select(gymId)]))
      .then(([cData, hData]) => {
        setClases((cData||[]).filter(c => c.activo !== false));
        setHorarios(hData||[]);
      }).catch(()=>{});
  }, [gymId]);

  // ── Validaciones paso 1 ──
  const esMenorWizard = esMenorDeEdad(fM.fecha_nacimiento);
  const tutorValido   = !esMenorWizard || (!!(fM.tutor_nombre||"").trim() && !!(fM.tutor_telefono||"").trim());
  const canNext1      = !!fM.nombre.trim() && tutorValido;
  const tutorError    = esMenorWizard && !tutorValido && fM.nombre.trim();
  const hasPlan       = !!(fM.plan || fM.planId) || (fM.planesExtra||[]).length > 0;
  const montoTotal    = (() => {
    const base = fM.plan ? Number(fM.monto||0) : 0;
    const extra = (fM.planesExtra||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    return base + extra;
  })();
  const esPendiente   = fM.formaPago === "Transferencia";

  // ── Calcular vencimiento (compartido entre Step3 y Step4) ──
  const venceISO = (() => {
    if (!fM.plan) return null;
    const planObj = fM.planData;
    const CM = { mensual:1, trimestral:3, semestral:6, anual:12 };
    let meses = null;
    if (planObj) {
      meses = planObj.meses != null ? planObj.meses : CM[planObj.ciclo_renovacion];
    } else {
      try { return calcVence(fM.fecha_incorporacion||todayISO(), fM.plan); } catch(e) { return null; }
    }
    if (!meses) return null;
    const [y,mo,d] = (fM.fecha_incorporacion||todayISO()).split("-").map(Number);
    const v = new Date(y, mo-1+meses, d);
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  })();

  // ── Guardar alumno forzando pago confirmado (Transferencia recibida al instante) ──
  const handleAddConfirmado = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const formaPagoFinal = fM.formaPago || "Transferencia";
      const qrToken = "DZ-" + Math.random().toString(36).toUpperCase().slice(2,6) +
                      Math.random().toString(36).toUpperCase().slice(2,4);
      const esMenorLocal = fM.fecha_nacimiento ? (() => {
        const n = new Date(fM.fecha_nacimiento+"T00:00:00");
        const h = new Date();
        let e = h.getFullYear() - n.getFullYear();
        const mo = h.getMonth() - n.getMonth();
        if (mo < 0 || (mo===0 && h.getDate()<n.getDate())) e--;
        return e < 18;
      })() : false;
      const telDestino = esMenorLocal && fM.tutor_telefono ? fM.tutor_telefono : fM.tel;
      const waMsg = fM.plan
        ? `¡Hola ${(fM.nombre||"").split(" ")[0]}! 🥋 Tu membresía *${fM.plan}* en *${gymConfig?.nombre||"el gym"}* ha sido registrada.\n\n📅 Inicio: ${fmtDateShort(fM.fecha_incorporacion||todayISO())}\n📅 Vencimiento: ${fmtDateShort(venceISO)}\n💰 Monto: $${Number(fM.monto||0).toLocaleString("es-MX")}\n💳 Pago: ${formaPagoFinal}\n\n¡Gracias por unirte! 💪`
        : null;
      const wizardFMExtended = {
        ...fM,
        formaPago:      formaPagoFinal,
        estado:         "Activo",   // forzar Activo aunque sea Transferencia
        qr_token:       qrToken,
        pago_pendiente: false,
      };
      const result = await onAdd(wizardFMExtended, {
        comprobantePNG, waMsg, tel: telDestino,
        nombreMiembro: fM.nombre, venceISO,
        plan: fM.plan, formaPago: formaPagoFinal,
        monto: fM.monto, estadoInicial: "Activo", qrToken,
      });
      setSavedMiembro({ qr_token: qrToken, ...result });
      try {
        const png = await generarComprobantePagoPNG({
          gymConfig, miembro: { nombre: fM.nombre },
          plan: fM.plan, monto: fM.monto,
          formaPago: formaPagoFinal, venceISO,
        });
        setComprobantePNG(png);
      } catch(e) {}
      setStep(4);
    } finally {
      setSaving(false);
    }
  };

  // ── Guardar alumno en BD ──
  const handleAdd = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Forma de pago con fallback — nunca debe ser null al registrar
      const formaPagoFinal = fM.formaPago || "Efectivo";

      // Determinar estado según forma de pago
      const esPendienteLocal = formaPagoFinal === "Transferencia";
      const estadoInicial    = esPendienteLocal ? "Pendiente" : "Activo";

      // Generar qr_token solo si pago confirmado
      let qrToken = null;
      if (!esPendienteLocal) {
        qrToken = "DZ-" + Math.random().toString(36).toUpperCase().slice(2,6) +
                  Math.random().toString(36).toUpperCase().slice(2,4);
      }

      // Build receiptInfo para GymApp (WA queue etc.)
      const esMenorLocal = fM.fecha_nacimiento ? (() => {
        const n = new Date(fM.fecha_nacimiento+"T00:00:00");
        const h = new Date();
        let e = h.getFullYear() - n.getFullYear();
        const mo = h.getMonth() - n.getMonth();
        if (mo < 0 || (mo===0 && h.getDate()<n.getDate())) e--;
        return e < 18;
      })() : false;
      const telDestino = esMenorLocal && fM.tutor_telefono ? fM.tutor_telefono : fM.tel;

      const totalMonto2 = (() => {
        const base  = fM.plan ? Number(fM.monto||0) : 0;
        const extra = (fM.planesExtra||[]).reduce((s,p)=>s+Number(p.monto||0),0);
        return base + extra;
      })();
      const planesResumen = [
        ...(fM.plan ? [`🏋️ ${fM.plan}`] : []),
        ...(fM.planesExtra||[]).map(p => `🗓️ ${p.nombre}`),
      ].join("\n");

      let waMsg = null;
      if ((fM.plan || (fM.planesExtra||[]).length > 0) && !esPendienteLocal) {
        waMsg = `¡Hola ${(fM.nombre||"").split(" ")[0]}! 🥋 Tu inscripción en *${gymConfig?.nombre||"el gym"}* ha sido registrada.\n\n${planesResumen}\n\n📅 Inicio: ${fmtDateShort(fM.fecha_incorporacion||todayISO())}${venceISO ? `\n📅 Vencimiento: ${fmtDateShort(venceISO)}` : ""}\n💰 Total: $${totalMonto2.toLocaleString("es-MX")}\n💳 Pago: ${formaPagoFinal}\n\n¡Gracias por unirte! 💪`;
      }

      const wizardFMExtended = {
        ...fM,
        formaPago:     formaPagoFinal,
        estado:        estadoInicial,
        qr_token:      qrToken,
        pago_pendiente: esPendienteLocal,
        montoTotal:    totalMonto2,
      };

      const result = await onAdd(wizardFMExtended, {
        comprobantePNG,
        waMsg,
        tel: telDestino,
        nombreMiembro: fM.nombre,
        venceISO,
        plan: fM.plan,
        planesExtra: fM.planesExtra||[],
        formaPago: formaPagoFinal,
        monto: fM.monto,
        montoTotal: totalMonto2,
        estadoInicial,
        qrToken,
      });

      setSavedMiembro({ qr_token: qrToken, ...result });

      if (!esPendienteLocal) {
        try {
          const planLabel = fM.plan || (fM.planesExtra||[])[0]?.nombre || "Membresía";
          const png = await generarComprobantePagoPNG({
            gymConfig, miembro: { nombre: fM.nombre },
            plan: planLabel, monto: String(totalMonto2),
            formaPago: formaPagoFinal, venceISO,
          });
          setComprobantePNG(png);
        } catch(e) {}
        setStep(4);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Labels ──
  const TOTAL_STEPS = 4;
  const stepLabels  = ["Datos", "Membresía", "Pago", "ID Digital"];

  // ── Etiqueta del botón principal ──
  const nextLabel = (() => {
    if (step === 1) return "Siguiente →";
    if (step === 2 && !hasPlan) return "✓ Registrar sin membresía";
    if (step === 2 && hasPlan && fM.beca) return saving ? "Guardando..." : "🎓 Registrar (Beca — $0)";
    if (step === 3) {
      if (saving) return "Guardando...";
      if (esPendiente) return "⏳ Registrar — pago pendiente";
      return "✓ Registrar y confirmar pago";
    }
    return "Siguiente →";
  })();

  const goNext = () => {
    if (step === 1 && !canNext1) return;
    if (step === 2 && (!hasPlan || fM.beca)) { handleAdd(); return; }
    if (step === 3) {
      // Si hay plan y no eligieron forma de pago → poner Efectivo por defecto
      if (hasPlan && !fM.formaPago) {
        setFM(p => ({ ...p, formaPago: "Efectivo" }));
      }
      handleAdd();
      return;
    }
    setStep(s => Math.min(s+1, TOTAL_STEPS));
  };
  const goPrev = () => setStep(s => Math.max(s-1, 1));

  // Paso 4: botón es solo "Cerrar"
  const isStep4 = step === 4;

  return (
    <div style={S.overlay} onClick={e => { if (e.target===e.currentTarget && !isStep4) onClose(); }}>
      <div style={S.sheet}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h2 style={{ color:"var(--text-primary,#e8e8f0)", fontSize:17, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
              <span>{isStep4 ? "✅" : "👤"}</span>
              {isStep4 ? "Alumno Registrado" : `Nuevo ${gymConfig?.termino_miembros?.replace(/s$/,"") || "Miembro"}`}
            </h2>
            {!isStep4 && (
              <button onClick={onClose}
                style={{ background:"var(--bg-elevated,#1e1e2e)", border:"1px solid var(--border,#2a2a3e)", borderRadius:10, width:32, height:32, cursor:"pointer", color:"var(--text-primary,#e8e8f0)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            )}
          </div>
          <ProgressBar step={step} total={TOTAL_STEPS} labels={stepLabels} />
        </div>

        {/* Body */}
        <div style={S.body}>
          {step===1 && (
            <Step1 fM={fM} setFM={setFM} showFotoModal={showFotoModal} setShowFotoModal={setShowFotoModal} PhotoModal={PhotoModal} isDojo={isDojo} />
          )}
          {step===2 && (
            <Step2 fM={fM} setFM={setFM} clases={clases} horarios={horarios} planesMembresia={planes} isDojo={isDojo} activePlanes={activePlanes} />
          )}
          {step===3 && (
            <Step3Pago
              fM={fM} setFM={setFM} gymConfig={gymConfig} venceISO={venceISO}
              hasPlan={hasPlan} montoTotal={montoTotal}
              comprobantePNG={comprobantePNG} setComprobantePNG={setComprobantePNG}
              generandoComp={generandoComp} setGenerandoComp={setGenerandoComp}
              infoBancoPNG={infoBancoPNG} setInfoBancoPNG={setInfoBancoPNG}
              generandoInfo={generandoInfo} setGenerandoInfo={setGenerandoInfo}
            />
          )}
          {step===4 && (
            <Step4ID fM={fM} gymConfig={gymConfig} savedMiembro={savedMiembro} comprobantePNG={comprobantePNG} venceISO={venceISO} />
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          {step===1 && tutorError && (
            <div style={{ background:"rgba(251,191,36,.1)", border:"1px solid rgba(251,191,36,.3)", borderRadius:10, padding:"8px 12px", marginBottom:10 }}>
              <p style={{ color:"#fbbf24", fontSize:12, fontWeight:600 }}>⚠️ El miembro es menor de edad — completa los datos del tutor para continuar.</p>
            </div>
          )}

          {/* Aviso beca en paso 2 */}
          {step===2 && fM.beca && hasPlan && (
            <div style={{ background:"rgba(251,191,36,.08)", border:"1px solid rgba(251,191,36,.3)", borderRadius:10, padding:"8px 12px", marginBottom:10 }}>
              <p style={{ color:"#fbbf24", fontSize:12, fontWeight:600 }}>🎓 Becario — se registrará sin cobro y con membresía activa.</p>
            </div>
          )}

          <div style={{ display:"flex", gap:10 }}>
            {/* Botón izquierdo */}
            {isStep4 ? (
              <button onClick={onClose}
                style={{ ...S.btnSecondary, flex:"0 0 auto", padding:"14px 20px" }}>
                Cerrar
              </button>
            ) : step > 1 ? (
              <button onClick={goPrev}
                style={{ ...S.btnSecondary, flex:"0 0 auto", padding:"14px 20px" }}>
                ← Anterior
              </button>
            ) : (
              <button onClick={onClose}
                style={{ ...S.btnSecondary, flex:"0 0 auto", padding:"14px 16px" }}>
                Cancelar
              </button>
            )}

            {/* Botón principal + Confirmar pago (solo paso 3 Transferencia) */}
            {!isStep4 && (
              <div style={{ display:"flex", gap:8, flex:1 }}>
                {step === 3 && esPendiente && (
                  <button
                    onClick={handleAddConfirmado}
                    disabled={saving}
                    style={{
                      flex:1, padding:"14px 10px", borderRadius:14, border:"none", fontFamily:"inherit",
                      background: saving ? "rgba(16,185,129,.4)" : "linear-gradient(135deg,#10b981,#059669)",
                      color:"#fff", fontWeight:700, fontSize:13, cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.6 : 1,
                      display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                      boxShadow:"0 2px 12px rgba(16,185,129,.3)",
                    }}>
                    ✅ Pago recibido
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={(step===1 && !canNext1) || saving}
                  style={{
                    ...S.btnPrimary,
                    flex:1,
                    background: esPendiente && step===3
                      ? "linear-gradient(135deg,#f59e0b,#d97706)"
                      : S.btnPrimary.background,
                    opacity: ((step===1 && !canNext1) || saving) ? 0.5 : 1,
                    cursor:  ((step===1 && !canNext1) || saving) ? "not-allowed" : "pointer",
                  }}>
                  {nextLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
