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
// Cada clase ya tiene su precio de membresía integrado.
// El precio real se resuelve igual que en ClasesScreen:
//   planVinculado?.precio_publico ?? clase?.costo ?? 0
// Seleccionar la clase = seleccionar la membresía.
function Step2({ fM, setFM, clases, horarios, planesMembresia }) {
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
  const gym  = gymConfig || {};
  const W = 400, PAD = 24;

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
