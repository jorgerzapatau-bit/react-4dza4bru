// ─────────────────────────────────────────────
//  screens/ConfigScreen.jsx  — con pestañas
// ─────────────────────────────────────────────

import { useState, useEffect } from "react";
import { DEFAULT_PLANES } from "../utils/constants";
import { Btn, Inp } from "../components/UI";
import { supabase } from "../supabase";

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

const TABS = [
  { id: "general",    label: "General",    icon: "🏢" },
  { id: "pagos",      label: "Pagos",      icon: "💳" },
  { id: "planes",     label: "Planes",     icon: "📋" },
  { id: "politicas",  label: "Políticas",  icon: "⚠️" },
  { id: "apariencia", label: "Apariencia", icon: "🎨" },
];

function TabGeneral({ formCfg, setFormCfg }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 80, height: 80, marginBottom: 8 }}>
          {formCfg.logo
            ? <img src={formCfg.logo} alt="logo" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(167,139,250,.4)" }} />
            : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>💪</div>
          }
          <label style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "rgba(30,30,46,.95)", border: "2px solid rgba(167,139,250,.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}>
            📷
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
              const file = e.target.files[0]; if (!file) return;
              const compressed = await compressImage(file);
              setFormCfg(p => ({ ...p, logo: compressed }));
            }} />
          </label>
        </div>
        <p style={{ color: "#8b949e", fontSize: 11 }}>Logo del gimnasio</p>
      </div>

      <Inp label="Nombre del gimnasio" value={formCfg.nombre} onChange={v => setFormCfg(p => ({ ...p, nombre: v }))} placeholder="Ej: GymFit Pro Mérida" />
      <Inp label="Slogan (opcional)" value={formCfg.slogan || ""} onChange={v => setFormCfg(p => ({ ...p, slogan: v }))} placeholder="Ej: Tu mejor versión empieza aquí" />
      <Inp label="Teléfono" value={formCfg.telefono || ""} onChange={v => setFormCfg(p => ({ ...p, telefono: v }))} placeholder="999 000 0000" type="tel" />
      <Inp label="Dirección" value={formCfg.direccion || ""} onChange={v => setFormCfg(p => ({ ...p, direccion: v }))} placeholder="Ej: Calle 60 #123, Mérida" />
      <Inp label="Zona horaria" value={formCfg.zona_horaria || "America/Merida"} onChange={v => setFormCfg(p => ({ ...p, zona_horaria: v }))} options={["America/Merida","America/Mexico_City","America/Cancun","America/Monterrey","America/Tijuana","America/New_York","America/Chicago","America/Los_Angeles","Europe/Madrid","America/Bogota","America/Lima","America/Santiago","America/Buenos_Aires","America/Caracas"]} />

      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 8px" }}>Tipo de establecimiento</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[
          { val: "gimnasio", label: "💪 Gimnasio", desc: "Miembros, membresías, clases" },
          { val: "dojo",     label: "🥋 Dojo / Karate", desc: "Alumnos, cinturones, exámenes" },
        ].map(op => {
          const active = (formCfg.tipo_negocio || "gimnasio") === op.val;
          return (
            <button key={op.val} onClick={() => setFormCfg(p => ({ ...p, tipo_negocio: op.val }))} style={{
              flex: 1, padding: "12px 8px", borderRadius: 14, cursor: "pointer",
              fontFamily: "inherit", textAlign: "center", transition: "all .2s",
              border: active ? "2px solid #6c63ff" : "1.5px solid rgba(255,255,255,.08)",
              background: active ? "rgba(108,99,255,.15)" : "var(--bg-elevated)",
            }}>
              <p style={{ color: active ? "#a78bfa" : "#8b949e", fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{op.label}</p>
              <p style={{ color: active ? "#c4b5fd" : "#6b7280", fontSize: 10, lineHeight: 1.4 }}>{op.desc}</p>
            </button>
          );
        })}
      </div>
      {(formCfg.tipo_negocio || "gimnasio") === "dojo" && (
        <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(168,85,247,.08)", border: "1px solid rgba(168,85,247,.25)", borderRadius: 10 }}>
          <p style={{ color: "#c084fc", fontSize: 11, lineHeight: 1.6 }}>🥋 <strong>Modo Dojo activo</strong> — vocabulario de karate: Alumnos, Mensualidades, Exámenes de cinturón.</p>
        </div>
      )}

      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 8px" }}>
        Término para "{formCfg.termino_miembros || "Miembros"}"
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {["Miembros", "Alumnos", "Clientes", "Socios", "Atletas", "Estudiantes"].map(t => {
          const active = (formCfg.termino_miembros || "Miembros") === t;
          return (
            <button key={t} onClick={() => setFormCfg(p => ({ ...p, termino_miembros: t }))} style={{
              padding: "6px 14px", borderRadius: 20,
              border: `1.5px solid ${active ? "#6c63ff" : "rgba(255,255,255,.1)"}`,
              background: active ? "rgba(108,99,255,.2)" : "var(--bg-elevated)",
              color: active ? "#a78bfa" : "#8b949e",
              fontSize: 12, fontWeight: active ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
            }}>{t}</button>
          );
        })}
      </div>
      <Inp label="O escribe uno personalizado" value={formCfg.termino_miembros || ""} onChange={v => setFormCfg(p => ({ ...p, termino_miembros: v }))} placeholder="Ej: Participantes, Pacientes..." />
      <p style={{ color: "#4b4b6a", fontSize: 11, marginBottom: 8, paddingLeft: 2 }}>
        💡 Vista previa: "Nuevo {formCfg.termino_miembros || "Miembro"}", "Lista de {formCfg.termino_miembros || "Miembros"}"
      </p>

      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 8px" }}>Propietario / Firmante</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Inp label="Título (Ej: Lic., Dr.)" value={formCfg.propietario_titulo || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_titulo: v }))} placeholder="Ej: Lic." />
        <Inp label="Nombre completo" value={formCfg.propietario_nombre || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_nombre: v }))} placeholder="Ej: Ana García" />
      </div>
    </div>
  );
}

function TabPagos({ formCfg, setFormCfg }) {
  return (
    <div>
      <div style={{ padding: "12px 14px", background: "rgba(34,211,238,.06)", border: "1px solid rgba(34,211,238,.2)", borderRadius: 12, marginBottom: 16 }}>
        <p style={{ color: "#22d3ee", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>🏦 Datos para Transferencia</p>
        <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>Esta información se muestra a los miembros cuando pagan por transferencia.</p>
      </div>
      <Inp label="CLABE Interbancaria" value={formCfg.transferencia_clabe || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_clabe: v }))} placeholder="18 dígitos" type="tel" />
      <Inp label="Nombre completo del titular" value={formCfg.transferencia_titular || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_titular: v }))} placeholder="Ej: Ana García López" />
      <Inp label="Nombre del banco" value={formCfg.transferencia_banco || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_banco: v }))} placeholder="Ej: BBVA, Banamex, HSBC" />
      <div style={{ padding: "12px 14px", background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 12, marginTop: 16 }}>
        <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>💬 Mensajes automáticos</p>
        <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>
          Los mensajes de recordatorio, bienvenida y automatizaciones se configuran en
          <strong style={{ color: "#a78bfa" }}> Módulo Mensajes → Mensajes del sistema</strong>.
        </p>
      </div>
    </div>
  );
}

function TabPlanes({ formCfg, setFormCfg }) {
  return (
    <div>
      <div style={{ padding: "10px 14px", background: "rgba(167,139,250,.06)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, marginBottom: 14 }}>
        <p style={{ color: "#a78bfa", fontSize: 11, lineHeight: 1.5 }}>
          Activa o desactiva los planes según lo que ofrece tu gimnasio. Solo los planes activos aparecerán al registrar miembros.
        </p>
      </div>
      {(formCfg.planes || DEFAULT_PLANES).map((plan, i) => {
        const isActive = plan.activo !== false;
        return (
          <div key={i} style={{
            background: isActive ? "var(--bg-card)" : "var(--bg-elevated)",
            border: `1px solid ${isActive ? "rgba(167,139,250,.2)" : "var(--border)"}`,
            borderRadius: 14, padding: "10px 14px", marginBottom: 8, opacity: isActive ? 1 : 0.5,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isActive ? 10 : 0 }}>
              <span style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)", fontSize: 13, fontWeight: 600 }}>{plan.nombre}</span>
              <div onClick={() => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], activo: !isActive }; return { ...p, planes: pl }; })}
                style={{ width: 44, height: 24, borderRadius: 12, background: isActive ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "rgba(255,255,255,.1)", cursor: "pointer", position: "relative", transition: "background .2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: isActive ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
              </div>
            </div>
            {isActive && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Inp label="Nombre" value={plan.nombre} onChange={v => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], nombre: v }; return { ...p, planes: pl }; })} />
                <Inp label="Precio ($)" type="number" value={String(plan.precio)} onChange={v => setFormCfg(p => { const pl = [...p.planes]; pl[i] = { ...pl[i], precio: Number(v) }; return { ...p, planes: pl }; })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TabPoliticas({ formCfg, setFormCfg }) {
  const moraActual = formCfg.mora_tipo || "ninguna";
  return (
    <div>
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "0 0 8px" }}>Días de gracia</p>
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "14px", marginBottom: 20 }}>
        <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
          Tolerancia después del vencimiento antes de marcar la membresía como vencida.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="number" min={0} max={30} value={formCfg.dias_gracia ?? 5}
            onChange={e => setFormCfg(p => ({ ...p, dias_gracia: Number(e.target.value) }))}
            style={{ flex: 1, background: "var(--bg-elevated)", border: "1.5px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 14px", color: "var(--text-primary)", fontSize: 15, fontFamily: "inherit", outline: "none" }}
          />
          <span style={{ color: "#8b949e", fontSize: 13, whiteSpace: "nowrap" }}>días</span>
        </div>
      </div>

      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "0 0 6px" }}>Penalidad por mora</p>
      <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
        Cargo adicional cuando un miembro renueva su membresía con atraso.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {[
          { value: "ninguna",    label: "Sin penalidad",  desc: "No se cobra nada por atraso" },
          { value: "fijo",       label: "Monto fijo",     desc: "Se suma un cargo fijo al renovar" },
          { value: "porcentaje", label: "Porcentaje",     desc: "% del precio de la membresía" },
        ].map(t => {
          const sel = moraActual === t.value;
          return (
            <button key={t.value} onClick={() => setFormCfg(p => ({ ...p, mora_tipo: t.value }))} style={{
              padding: "12px 14px",
              border: sel ? "2px solid #6c63ff" : "1.5px solid rgba(255,255,255,.08)",
              borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
              background: sel ? "rgba(108,99,255,.1)" : "var(--bg-elevated)",
              display: "flex", alignItems: "center", gap: 12,
              transition: "all .15s", textAlign: "left",
            }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `2px solid ${sel ? "#6c63ff" : "rgba(255,255,255,.2)"}`, background: sel ? "#6c63ff" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sel && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div>
                <p style={{ color: sel ? "#c4b5fd" : "var(--text-primary)", fontSize: 13, fontWeight: sel ? 700 : 500 }}>{t.label}</p>
                <p style={{ color: "#6b6b8a", fontSize: 11, marginTop: 1 }}>{t.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {moraActual !== "ninguna" && (
        <div>
          <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 6 }}>
            {moraActual === "fijo" ? "Monto de penalidad ($)" : "Porcentaje de penalidad (%)"}
          </p>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9999b3", fontSize: 15, fontWeight: 700, pointerEvents: "none" }}>
              {moraActual === "fijo" ? "$" : "%"}
            </span>
            <input type="number" min={0} value={formCfg.mora_monto || ""}
              onChange={e => setFormCfg(p => ({ ...p, mora_monto: e.target.value }))}
              placeholder="0"
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-elevated)", border: "1.5px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "10px 14px 10px 28px", color: "var(--text-primary)", fontSize: 15, fontFamily: "inherit", outline: "none" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  TabApariencia — selector de paleta y fuente
// ─────────────────────────────────────────────
const PALETTES = [
  {
    id: "blue", label: "Azul Océano", desc: "Profesional y confiable",
    swatch: ["#3b82f6","#1d4ed8","#60a5fa"],
    dark:  { bg: "#0a0f1a", card: "#111827", accent: "#3b82f6", text: "#e8f0fe" },
    light: { bg: "#f0f4ff", card: "#ffffff", accent: "#2563eb", text: "#0f1f3d" },
  },
  {
    id: "violet", label: "Violeta Cosmos", desc: "Creativo y enérgico",
    swatch: ["#8b5cf6","#e040fb","#c4b5fd"],
    dark:  { bg: "#0d0d1a", card: "#12121f", accent: "#8b5cf6", text: "#ede9fe" },
    light: { bg: "#f5f3ff", card: "#ffffff", accent: "#7c3aed", text: "#1e0a4a" },
  },
  {
    id: "emerald", label: "Esmeralda Viva", desc: "Natural y vibrante",
    swatch: ["#10b981","#047857","#6ee7b7"],
    dark:  { bg: "#071410", card: "#0d1f19", accent: "#10b981", text: "#d1fae5" },
    light: { bg: "#f0fdf9", card: "#ffffff", accent: "#059669", text: "#063a28" },
  },
  {
    id: "amber", label: "Ámbar Solar", desc: "Cálido y motivador",
    swatch: ["#f59e0b","#d97706","#fcd34d"],
    dark:  { bg: "#130e00", card: "#1c1500", accent: "#f59e0b", text: "#fef3c7" },
    light: { bg: "#fffbeb", card: "#ffffff", accent: "#d97706", text: "#3d1c00" },
  },
];

function PaletteCard({ palette, isActive, isDark, onSelect }) {
  const preview = isDark ? palette.dark : palette.light;
  return (
    <button
      onClick={() => onSelect(palette.id)}
      style={{
        background: preview.bg,
        border: isActive
          ? `2px solid ${preview.accent}`
          : `1.5px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`,
        borderRadius: 16, padding: 16, cursor: "pointer",
        fontFamily: "inherit", textAlign: "left",
        transition: "all .2s",
        boxShadow: isActive ? `0 0 0 4px ${preview.accent}30, 0 8px 24px ${preview.accent}20` : "none",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Mini UI preview */}
      <div style={{ marginBottom: 12 }}>
        {/* Fake sidebar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 28, borderRadius: 6, background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)", padding: "6px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 4, borderRadius: 2, background: i === 1 ? preview.accent : (isDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)") }} />
            ))}
          </div>
          {/* Fake content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ height: 22, borderRadius: 6, background: preview.card, border: `1px solid ${isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`, display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: preview.accent }} />
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: isDark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.15)" }} />
            </div>
            <div style={{ height: 14, borderRadius: 4, background: preview.card, border: `1px solid ${isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }} />
            <div style={{ height: 10, borderRadius: 4, background: `${preview.accent}20` }} />
          </div>
        </div>
        {/* Fake button */}
        <div style={{ height: 16, borderRadius: 6, background: preview.accent, opacity: .9 }} />
      </div>

      {/* Swatches */}
      <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
        {palette.swatch.map((c, i) => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${isDark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.1)"}` }} />
        ))}
      </div>

      {/* Labels */}
      <p style={{ color: preview.text, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{palette.label}</p>
      <p style={{ color: `${preview.text}80`, fontSize: 10 }}>{palette.desc}</p>

      {/* Check mark */}
      {isActive && (
        <div style={{ position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: "50%", background: preview.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>✓</div>
      )}
    </button>
  );
}

function TabApariencia({ darkMode, setDarkMode }) {
  const [palette, setPalette]       = useState(() => localStorage.getItem("gymfit-palette") || "blue");

  useEffect(() => {
    localStorage.setItem("gymfit-palette", palette);
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  const s = {
    section: { marginBottom: 28 },
    label:   { color: "var(--text-tertiary)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .8, marginBottom: 12 },
    modeBtn: (active) => ({
      flex: 1, padding: "14px 12px",
      border: active ? "2px solid var(--col-accent)" : "1.5px solid var(--border)",
      borderRadius: 14, cursor: "pointer", fontFamily: "inherit",
      background: active ? "var(--col-accent-soft)" : "var(--bg-elevated)",
      transition: "all .2s",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      boxShadow: active ? "var(--shadow-accent)" : "none",
    }),
  };

  return (
    <div style={{ padding: "4px 0" }}>

      {/* ── Modo claro / oscuro ── */}
      <div style={s.section}>
        <p style={s.label}>🌓 Modo de pantalla</p>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { id: false, icon: "☀️", label: "Modo claro" },
            { id: true,  icon: "🌙", label: "Modo oscuro" },
          ].map(m => (
            <button key={String(m.id)} onClick={() => setDarkMode(m.id)} style={s.modeBtn(darkMode === m.id)}>
              <span style={{ fontSize: 24 }}>{m.icon}</span>
              <span style={{ color: darkMode === m.id ? "var(--col-accent-text)" : "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
                {m.label}
              </span>
              {darkMode === m.id && (
                <span style={{ fontSize: 10, color: "var(--col-accent-text)", fontWeight: 700 }}>● Activo</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Paleta de color ── */}
      <div style={s.section}>
        <p style={s.label}>🎨 Paleta de color</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PALETTES.map(p => (
            <PaletteCard
              key={p.id}
              palette={p}
              isActive={palette === p.id}
              isDark={darkMode}
              onSelect={setPalette}
            />
          ))}
        </div>
      </div>

      {/* ── Tipografía ── */}
      <div style={s.section}>
        <p style={s.label}>✍️ Tipografía</p>
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <p style={{ color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
            Plus Jakarta Sans
          </p>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 10 }}>
            La fuente principal de toda la aplicación
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {["Regular 400", "Medium 500", "Semi Bold 600", "Bold 700", "Extra Bold 800"].map(w => (
              <span key={w} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "var(--text-tertiary)" }}>{w}</span>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-card)", borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--col-accent-text)" }}>
            01 { } // JetBrains Mono — código y datos
          </div>
        </div>
      </div>

      {/* ── Vista previa ── */}
      <div style={s.section}>
        <p style={s.label}>👁 Vista previa de colores</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { label: "Acento principal",  bg: "var(--col-accent)",        text: "#fff" },
            { label: "Acento suave",      bg: "var(--col-accent-soft)",   text: "var(--col-accent-text)" },
            { label: "Éxito",             bg: "var(--col-success-soft)",  text: "var(--col-success)" },
            { label: "Error / Peligro",   bg: "var(--col-danger-soft)",   text: "var(--col-danger)" },
            { label: "Advertencia",       bg: "var(--col-warning-soft)",  text: "var(--col-warning)" },
            { label: "WhatsApp",          bg: "var(--col-wa-gradient)",   text: "#fff" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: row.bg, border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <span style={{ color: row.text, fontSize: 12, fontWeight: 600 }}>{row.label}</span>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: row.bg, border: "2px solid rgba(255,255,255,.3)" }} />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default function ConfigScreen({ gymConfig, gymConfigRef: GYM_ID, formCfg, setFormCfg, setGymConfig, setConfigScreen, darkMode, setDarkMode }) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const handleSaveCfg = async () => {
    if (!formCfg.nombre) return;
    setSaving(true); setSaveError(null); setSaveOk(false);

    // Separar campos de política de los datos del gimnasio
    const { dias_gracia, mora_tipo, mora_monto, ...gymData } = formCfg;
    const payload = { ...gymData, id: GYM_ID };

    // 1. Guardar datos del gimnasio (sin campos de política)
    // saveGym ya maneja PATCH + fallback a POST (upsert) internamente.
    // No hacer un segundo POST aquí — usaría la apikey pública y violaría RLS.
    const ok = await supabase.saveGym(payload);
    if (!ok) {
      setSaving(false);
      setSaveError("No se pudo guardar el gimnasio. Verifica tu conexión e intenta de nuevo.");
      return;
    }

    // 2. Guardar políticas en politicas_membresia (upsert por gym_id, sin plan_id = política global)
    try {
      const polPayload = {
        gym_id:         GYM_ID,
        dias_gracia:    Number(dias_gracia ?? 5),
        tipo_penalidad: mora_tipo || "ninguna",
        penalidad_mora: Number(mora_monto || 0),
      };

      // Buscar si ya existe una política global (sin plan_id) para este gym
      const dbPol = await supabase.from("politicas_membresia");
      const existentes = await dbPol.select(GYM_ID, "&plan_id=is.null");
      const polExistente = Array.isArray(existentes) ? existentes[0] : null;

      if (polExistente?.id) {
        await dbPol.update(polExistente.id, polPayload);
      } else {
        await dbPol.insert(polPayload);
      }
    } catch (e) {
      console.error("❌ Error guardando política global:", e);
      // No bloquear el guardado del gimnasio si falla la política
    }

    setSaving(false);
    setGymConfig({ ...formCfg, id: GYM_ID });
    setSaveOk(true);
    setTimeout(() => { setSaveOk(false); setConfigScreen(false); }, 1200);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

      {/* ── Header con título y tabs ── */}
      <div style={{ padding: "20px 28px 0", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {!gymConfig ? (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 10px", boxShadow: "0 8px 32px rgba(108,99,255,.4)" }}>💪</div>
            <h1 style={{ color: "var(--text-primary)", fontSize: 20, fontWeight: 700 }}>Configura tu Gimnasio</h1>
            <p style={{ color: "#8b949e", fontSize: 12, marginTop: 4 }}>Esta información aparecerá en tu app</p>
          </div>
        ) : (
          <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>⚙️ Configuración</h2>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: "10px 18px",
                border: "none",
                borderBottom: active ? "2px solid #6c63ff" : "2px solid transparent",
                background: "transparent", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? "#a78bfa" : "#8b949e",
                whiteSpace: "nowrap", transition: "all .15s",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contenido scrollable ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 16px", minHeight: 0 }}>
        {activeTab === "general"    && <TabGeneral    formCfg={formCfg} setFormCfg={setFormCfg} />}
        {activeTab === "pagos"      && <TabPagos      formCfg={formCfg} setFormCfg={setFormCfg} />}
        {activeTab === "planes"     && <TabPlanes     formCfg={formCfg} setFormCfg={setFormCfg} />}
        {activeTab === "politicas"  && <TabPoliticas  formCfg={formCfg} setFormCfg={setFormCfg} />}
        {activeTab === "apariencia" && <TabApariencia darkMode={darkMode} setDarkMode={setDarkMode} />}

        {saveError && (
          <div style={{ background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.35)", borderRadius: 12, padding: "12px 16px", marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#f87171", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>Error al guardar</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>{saveError}</p>
            </div>
            <button onClick={() => setSaveError(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
          </div>
        )}
        {saveOk && (
          <div style={{ background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.3)", borderRadius: 12, padding: "12px 16px", marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 700, margin: 0 }}>¡Configuración guardada!</p>
          </div>
        )}
      </div>

      {/* ── Pie fijo ── */}
      <div style={{ padding: "14px 28px", borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--bg-main)" }}>
        <Btn full onClick={handleSaveCfg} disabled={saving}>
          {saving ? "Guardando..." : saveOk ? "¡Guardado! ✓" : gymConfig ? "Guardar cambios ✓" : "Guardar y comenzar ✓"}
        </Btn>
      </div>
    </div>
  );
}
