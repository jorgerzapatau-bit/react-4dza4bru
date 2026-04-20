import { DEFAULT_PLANES, DEFAULT_RECORDATORIO_TPL } from "../utils";
import Inp from "../components/Inp";
import Btn from "../components/Btn";
import { supabase } from "../supabase";

export default function ConfigScreen({
  gymConfig,
  gymConfigRef: GYM_ID,
  formCfg,
  setFormCfg,
  setGymConfig,
  setConfigScreen,
}) {
  const handleSaveCfg = async () => {
    if (!formCfg.nombre) return;
    const url = `${supabase.url}/rest/v1/gimnasios`;
    await fetch(url, {
      method: "POST",
      headers: {
        "apikey": supabase.key,
        "Authorization": `Bearer ${supabase.key}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ ...formCfg, id: GYM_ID }),
    });
    setGymConfig(formCfg);
    setConfigScreen(false);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 60px" }}>
      {gymConfig && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => setConfigScreen(false)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>⚙️ Configuración</h2>
        </div>
      )}
      {!gymConfig && (
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px", boxShadow: "0 8px 32px rgba(108,99,255,.4)" }}>💪</div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>Configura tu Gimnasio</h1>
          <p style={{ color: "#4b4b6a", fontSize: 13, marginTop: 6 }}>Esta información aparecerá en tu app</p>
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

      {/* Propietario */}
      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Propietario / Firmante</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Inp label="Título (Ej: Lic., Dr.)" value={formCfg.propietario_titulo || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_titulo: v }))} placeholder="Ej: Lic." />
        <Inp label="Nombre completo" value={formCfg.propietario_nombre || ""} onChange={v => setFormCfg(p => ({ ...p, propietario_nombre: v }))} placeholder="Ej: Ana García" />
      </div>

      {/* Datos de transferencia */}
      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Datos para Transferencia</p>
      <Inp label="CLABE Interbancaria" value={formCfg.transferencia_clabe || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_clabe: v }))} placeholder="18 dígitos" type="tel" />
      <Inp label="Nombre completo del titular" value={formCfg.transferencia_titular || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_titular: v }))} placeholder="Ej: Ana García López" />
      <Inp label="Nombre del banco" value={formCfg.transferencia_banco || ""} onChange={v => setFormCfg(p => ({ ...p, transferencia_banco: v }))} placeholder="Ej: BBVA, Banamex, HSBC" />

      {/* Mensaje de recordatorio */}
      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 6px" }}>Mensaje de Recordatorio (1 día antes)</p>
      <p style={{ color: "#4b4b6a", fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>
        Variables disponibles: <span style={{ color: "#a78bfa" }}>{"{nombre}"}</span> · <span style={{ color: "#a78bfa" }}>{"{fecha}"}</span> · <span style={{ color: "#a78bfa" }}>{"{clabe}"}</span> · <span style={{ color: "#a78bfa" }}>{"{titular}"}</span> · <span style={{ color: "#a78bfa" }}>{"{banco}"}</span> · <span style={{ color: "#a78bfa" }}>{"{propietario}"}</span> · <span style={{ color: "#a78bfa" }}>{"{propietario_titulo}"}</span>
      </p>
      <textarea
        value={formCfg.recordatorio_tpl || DEFAULT_RECORDATORIO_TPL}
        onChange={e => setFormCfg(p => ({ ...p, recordatorio_tpl: e.target.value }))}
        rows={10}
        style={{ width: "100%", background: "rgba(255,255,255,.06)", border: "1px solid rgba(167,139,250,.25)", borderRadius: 14, padding: "12px 14px", color: "#d1d5db", fontSize: 12, fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6, marginBottom: 8, boxSizing: "border-box" }}
      />
      <button
        onClick={() => setFormCfg(p => ({ ...p, recordatorio_tpl: DEFAULT_RECORDATORIO_TPL }))}
        style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "6px 14px", color: "#6b7280", fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginBottom: 4 }}>
        ↺ Restaurar mensaje predeterminado
      </button>

      {/* Planes y precios */}
      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "16px 0 10px" }}>Planes y precios</p>
      {(formCfg.planes || DEFAULT_PLANES).map((plan, i) => {
        const isActive = plan.activo !== false;
        return (
          <div key={i} style={{ background: isActive ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.02)", border: `1px solid ${isActive ? "rgba(167,139,250,.2)" : "rgba(255,255,255,.06)"}`, borderRadius: 14, padding: "10px 14px", marginBottom: 8, opacity: isActive ? 1 : 0.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isActive ? 10 : 0 }}>
              <span style={{ color: isActive ? "#fff" : "#4b4b6a", fontSize: 13, fontWeight: 600 }}>{plan.nombre}</span>
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

      <div style={{ height: 16 }} />

      {/* Notificaciones push */}
      <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5, margin: "0 0 10px" }}>Recordatorios automáticos</p>
      <div style={{ background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 14, padding: "12px 14px", marginBottom: 16 }}>
        <p style={{ color: "#d1d5db", fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
          🔔 Activa las notificaciones para recibir un aviso automático <strong style={{ color: "#a78bfa" }}>1 día antes</strong> del vencimiento de cada membresía.
        </p>
        <button onClick={async () => {
            if (!("Notification" in window)) { alert("Tu navegador no soporta notificaciones."); return; }
            const result = await Notification.requestPermission();
            if (result === "granted") {
              alert("✅ ¡Notificaciones activadas! Recibirás un aviso 1 día antes de cada vencimiento.");
            } else {
              alert("❌ Permiso denegado. Actívalas manualmente en Configuración → Privacidad → Notificaciones de tu navegador.");
            }
          }}
          style={{ width: "100%", padding: "10px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#7c3aed,#a78bfa)", color: "#fff" }}>
          🔔 Activar notificaciones
        </button>
      </div>

      <Btn full onClick={handleSaveCfg}>{gymConfig ? "Guardar cambios ✓" : "Guardar y comenzar ✓"}</Btn>
    </div>
  );
}
