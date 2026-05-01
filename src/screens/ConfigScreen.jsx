// ─────────────────────────────────────────────
//  screens/ConfigScreen.jsx
//
//  CAMBIOS:
//    ✅ Nuevo campo "Término para Miembros" (termino_miembros)
//       Permite personalizar cómo se llaman los miembros:
//       Miembro, Alumno, Cliente, Socio, Atleta, etc.
// ─────────────────────────────────────────────

import { useState } from "react";
import { DEFAULT_PLANES } from "../utils/constants";
import { Btn, Inp, Badge } from "../components/UI";
import { supabase } from "../supabase";

const chipStyle = (active, color = "#6c63ff") => ({
  flex: 1, padding: "12px 8px", borderRadius: 14, cursor: "pointer",
  fontFamily: "inherit", textAlign: "center", transition: "all .2s",
  border: active ? `2px solid ${color}` : "1.5px solid rgba(255,255,255,.08)",
  background: active ? `rgba(108,99,255,.15)` : "var(--bg-elevated)",
});

/** Redimensiona y comprime una imagen a base64 (máx 200×200, calidad 0.7) */
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

export default function ConfigScreen({
  gymConfig,
  gymConfigRef: GYM_ID,
  formCfg,
  setFormCfg,
  setGymConfig,
  setConfigScreen,
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);

  const handleSaveCfg = async () => {
    if (!formCfg.nombre) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    const payload = { ...formCfg, id: GYM_ID };
    const ok = await supabase.saveGym(payload);
    if (ok) {
      setGymConfig({ ...formCfg, id: GYM_ID });
      setSaving(false);
      setSaveOk(true);
      setTimeout(() => { setSaveOk(false); setConfigScreen(false); }, 1200);
      return;
    }
    // Fallback: fetch directo
    const url = `${supabase.url}/rest/v1/gimnasios`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "apikey": supabase.key,
        "Authorization": `Bearer ${supabase.key}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (r.ok) {
      setGymConfig({ ...formCfg, id: GYM_ID });
      setSaveOk(true);
      setTimeout(() => { setSaveOk(false); setConfigScreen(false); }, 1200);
    } else {
      let detail = "";
      try { const j = await r.json(); detail = j?.message || j?.error || ""; } catch {}
      setSaveError(detail || "Error al guardar. Verifica tu conexión e intenta de nuevo.");
    }
  };

  return (
    <div style={{ flex: 1, padding: "24px 24px 60px" }}>
      {gymConfig && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setConfigScreen(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--text-primary)", fontSize: 18 }}>←</button>
          <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 700 }}>⚙️ Configuración</h2>
        </div>
      )}

      {!gymConfig && (
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 8px 32px rgba(108,99,255,.4)" }}>💪</div>
          <h1 style={{ color: "var(--text-primary)", fontSize: 22, fontWeight: 700 }}>Configura tu Gimnasio</h1>
          <p style={{ color: "#8b949e", fontSize: 13, marginTop: 6 }}>Esta información aparecerá en tu app</p>
        </div>
      )}

      {/* Logo upload */}
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

      {/* ── Datos básicos ── */}
      <Inp label="Nombre del gimnasio" value={formCfg.nombre} onChange={v => setFormCfg(p => ({ ...p, nombre: v }))} placeholder="Ej: GymFit Pro Mérida" />
      <Inp label="Slogan (opcional)" value={formCfg.slogan || ""} onChange={v => setFormCfg(p => ({ ...p, slogan: v }))} placeholder="Ej: Tu mejor versión empieza aquí" />
      <Inp label="Teléfono" value={formCfg.telefono || ""} onChange={v => setFormCfg(p => ({ ...p, telefono: v }))} placeholder="999 000 0000" type="tel" />
      <Inp label="Dirección" value={formCfg.direccion || ""} onChange={v => setFormCfg(p => ({ ...p, direccion: v }))} placeholder="Ej: Calle 60 #123, Mérida" />
      <Inp label="Zona horaria" value={formCfg.zona_horaria || "America/Merida"} onChange={v => setFormCfg(p => ({ ...p, zona_horaria: v }))} options={["America/Merida","America/Mexico_City","America/Cancun","America/Monterrey","America/Tijuana","America/New_York","America/Chicago","America/Los_Angeles","Europe/Madrid","America/Bogota","America/Lima","America/Santiago","America/Buenos_Aires","America/Caracas"]} />

      {/* ── Parámetros generales ── */}
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 6px" }}>
        Parámetros generales
      </p>

      {/* ── Tipo de negocio ── */}
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "14px", marginBottom: 12 }}>
        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          🏢 Tipo de establecimiento
        </p>
        <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
          Adapta el sistema al vocabulario y flujo de tu negocio.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { val: "gimnasio", label: "💪 Gimnasio", desc: "Miembros, membresías, clases" },
            { val: "dojo",     label: "🥋 Dojo / Karate", desc: "Alumnos, cinturones, exámenes" },
          ].map(op => {
            const active = (formCfg.tipo_negocio || "gimnasio") === op.val;
            return (
              <button
                key={op.val}
                onClick={() => setFormCfg(p => ({ ...p, tipo_negocio: op.val }))}
                style={chipStyle(active)}
              >
                <p style={{ color: active ? "#a78bfa" : "#8b949e", fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{op.label}</p>
                <p style={{ color: active ? "#c4b5fd" : "#6b7280", fontSize: 10, lineHeight: 1.4 }}>{op.desc}</p>
              </button>
            );
          })}
        </div>
        {(formCfg.tipo_negocio || "gimnasio") === "dojo" && (
          <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(168,85,247,.08)", border: "1px solid rgba(168,85,247,.25)", borderRadius: 10 }}>
            <p style={{ color: "#c084fc", fontSize: 11, lineHeight: 1.6 }}>
              🥋 <strong>Modo Dojo activo</strong> — El sistema usará vocabulario de karate: Alumnos, Mensualidades,
              Exámenes de cinturón, y mostrará campos de grado (Kyu/Dan) en cada perfil.
            </p>
          </div>
        )}
      </div>
      <div style={{ background: "var(--bg-card)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "14px", marginBottom: 4 }}>
        <p style={{ color: "var(--text-primary)", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          👥 Término para "{formCfg.termino_miembros || "Miembros"}"
        </p>
        <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>
          ¿Cómo se llaman las personas inscritas en tu establecimiento?
          Este término aparecerá en toda la aplicación.
        </p>
        {/* Quick-select chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {["Miembros", "Alumnos", "Clientes", "Socios", "Atletas", "Estudiantes"].map(t => {
            const active = (formCfg.termino_miembros || "Miembros") === t;
            return (
              <button
                key={t}
                onClick={() => setFormCfg(p => ({ ...p, termino_miembros: t }))}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#6c63ff" : "rgba(255,255,255,.1)"}`,
                  background: active ? "rgba(108,99,255,.2)" : "var(--bg-elevated)",
                  color: active ? "#a78bfa" : "#8b949e",
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
        <Inp
          label="O escribe uno personalizado"
          value={formCfg.termino_miembros || ""}
          onChange={v => setFormCfg(p => ({ ...p, termino_miembros: v }))}
          placeholder="Ej: Participantes, Pacientes, Deportistas..."
        />
      </div>
      <p style={{ color: "#4b4b6a", fontSize: 11, marginBottom: 16, paddingLeft: 2 }}>
        💡 Vista previa: "Nuevo {formCfg.termino_miembros || "Miembro"}", "Lista de {formCfg.termino_miembros || "Miembros"}"
      </p>

      {/* ── Propietario ── */}
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Propietario / Firmante</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Inp label="Título (Ej: Lic., Dr.)" value={formCfg.propietario_titulo || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_titulo: v }))} placeholder="Ej: Lic." />
        <Inp label="Nombre completo" value={formCfg.propietario_nombre || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_nombre: v }))} placeholder="Ej: Ana García" />
      </div>

      {/* ── Datos de transferencia ── */}
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Datos para Transferencia</p>
      <Inp label="CLABE Interbancaria" value={formCfg.transferencia_clabe || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_clabe: v }))} placeholder="18 dígitos" type="tel" />
      <Inp label="Nombre completo del titular" value={formCfg.transferencia_titular || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_titular: v }))} placeholder="Ej: Ana García López" />
      <Inp label="Nombre del banco" value={formCfg.transferencia_banco || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_banco: v }))} placeholder="Ej: BBVA, Banamex, HSBC" />

      {/* ── Planes y precios ── */}
      <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Planes y precios</p>
      {(formCfg.planes || DEFAULT_PLANES).map((plan, i) => {
        const isActive = plan.activo !== false;
        return (
          <div key={i} style={{ background: isActive ? "var(--bg-card)" : "var(--bg-elevated)", border: `1px solid ${isActive ? "rgba(167,139,250,.2)" : "var(--border)"}`, borderRadius: 14, padding: "10px 14px", marginBottom: 8, opacity: isActive ? 1 : 0.5 }}>
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

      {/* ── Aviso: mensajes en módulo Mensajes ── */}
      <div style={{ background: "rgba(108,99,255,.06)", border: "1px solid rgba(108,99,255,.2)", borderRadius: 14, padding: "12px 14px", margin: "16px 0" }}>
        <p style={{ color: "#a78bfa", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>💬 Mensajes automáticos</p>
        <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>
          Los mensajes de recordatorio, bienvenida y automatizaciones se configuran en
          <strong style={{ color: "#a78bfa" }}> Módulo Mensajes → Mensajes del sistema</strong>.
        </p>
      </div>

      {/* Toast de error */}
      {saveError && (
        <div style={{
          background: "rgba(244,63,94,.12)", border: "1px solid rgba(244,63,94,.35)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 12,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#f87171", fontSize: 13, fontWeight: 700, margin: "0 0 2px" }}>Error al guardar</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 12, margin: 0 }}>{saveError}</p>
          </div>
          <button onClick={() => setSaveError(null)} style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
        </div>
      )}

      {/* Toast de éxito */}
      {saveOk && (
        <div style={{
          background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.3)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 700, margin: 0 }}>¡Configuración guardada!</p>
        </div>
      )}

      <div style={{ height: 8 }} />
      <Btn full onClick={handleSaveCfg} disabled={saving}>
        {saving ? "Guardando..." : saveOk ? "¡Guardado! ✓" : gymConfig ? "Guardar cambios ✓" : "Guardar y comenzar ✓"}
      </Btn>
    </div>
  );
}
