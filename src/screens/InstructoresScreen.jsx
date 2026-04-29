// src/screens/InstructoresScreen.jsx
// ══════════════════════════════════════════════════════════════════
//  Gestión de Instructores — GymFit Pro
//  CRUD completo: listar, agregar, editar, archivar.
//
//  Tabla Supabase requerida: instructores
//  (ver SQL en la documentación adjunta)
//
//  Props:
//    gymId    string
//    isOwner  bool
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { todayISO } from "../utils/dateUtils";

// ── Helpers ───────────────────────────────────────────────────────
function iniciales(nombre) {
  if (!nombre) return "?";
  const p = nombre.trim().split(" ");
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : p[0].slice(0, 2).toUpperCase();
}

const FORM_INICIAL = {
  nombre: "",
  especialidad: "",
  telefono: "",
  email: "",
  notas: "",
  activo: true,
  foto: null,
};

const ESPECIALIDADES = [
  "", "Karate", "Taekwondo", "Jiu-Jitsu", "Boxeo", "Kickboxing",
  "Muay Thai", "Yoga", "Pilates", "Crossfit", "Funcional",
  "Natación", "Zumba", "Spinning", "Otro",
];

const S = {
  inp: {
    width: "100%",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 12, padding: "12px 14px",
    color: "var(--text-primary)",
    fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  },
  label: {
    color: "var(--text-tertiary)",
    fontSize: 11, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 5, display: "block",
  },
  field: { marginBottom: 14 },
};

// ══════════════════════════════════════════════════════════════════
//  Modal — Crear / Editar Instructor
// ══════════════════════════════════════════════════════════════════
function ModalInstructor({ instructor, gymId, onSave, onClose }) {
  const esEdicion = !!instructor;
  const [form, setForm] = useState(() =>
    instructor
      ? { ...FORM_INICIAL, ...instructor }
      : { ...FORM_INICIAL }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true); setError("");

    const payload = {
      gym_id:       gymId,
      nombre:       form.nombre.trim(),
      especialidad: form.especialidad || null,
      telefono:     form.telefono     || null,
      email:        form.email        || null,
      notas:        form.notas        || null,
      activo:       form.activo,
      foto:         form.foto         || null,
    };

    const db = await supabase.from("instructores");
    let saved;
    if (esEdicion) {
      await db.update(instructor.id, payload);
      saved = { ...instructor, ...payload };
    } else {
      saved = await db.insert(payload);
    }

    setSaving(false);
    if (saved) onSave(saved, esEdicion);
    else setError("Error al guardar. Intenta de nuevo.");
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(0,0,0,.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 500,
        maxHeight: "90vh",
        background: "var(--bg-card)",
        borderRadius: "22px 22px 0 0",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 -8px 40px rgba(0,0,0,.5)",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ color: "var(--text-primary)", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>👤</span>
              {esEdicion ? "Editar instructor" : "Nuevo instructor"}
            </h2>
            <button onClick={onClose} style={{
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 10, width: 32, height: 32, cursor: "pointer",
              color: "var(--text-primary)", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {error && (
            <div style={{
              background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.3)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 14,
              color: "#f87171", fontSize: 12,
            }}>{error}</div>
          )}

          {/* Nombre */}
          <div style={S.field}>
            <label style={S.label}>Nombre completo *</label>
            <input type="text" value={form.nombre} onChange={e => set("nombre", e.target.value)}
              placeholder="Ej. Carlos Ramírez" style={S.inp} />
          </div>

          {/* Especialidad */}
          <div style={S.field}>
            <label style={S.label}>Especialidad</label>
            <select value={form.especialidad || ""} onChange={e => set("especialidad", e.target.value)} style={S.inp}>
              {ESPECIALIDADES.map(e => (
                <option key={e} value={e}>{e || "— Sin especialidad —"}</option>
              ))}
            </select>
          </div>

          {/* Teléfono */}
          <div style={S.field}>
            <label style={S.label}>Teléfono WhatsApp</label>
            <input type="tel" value={form.telefono || ""} onChange={e => set("telefono", e.target.value)}
              placeholder="999 000 0000" style={S.inp} inputMode="numeric" />
          </div>

          {/* Email */}
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)}
              placeholder="instructor@gym.com" style={S.inp} />
          </div>

          {/* Notas */}
          <div style={S.field}>
            <label style={S.label}>Notas</label>
            <textarea value={form.notas || ""} onChange={e => set("notas", e.target.value)}
              placeholder="Certificaciones, horario disponible, etc."
              rows={3}
              style={{ ...S.inp, resize: "vertical", minHeight: 72 }}
            />
          </div>

          {/* Toggle activo — solo edición */}
          {esEdicion && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <button
                onClick={() => set("activo", !form.activo)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: form.activo
                    ? "linear-gradient(135deg,#6c63ff,#e040fb)"
                    : "var(--bg-elevated)",
                  position: "relative", transition: "background .2s", flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: form.activo ? 22 : 3,
                  width: 18, height: 18, borderRadius: "50%", background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.25)",
                }} />
              </button>
              <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Instructor {form.activo ? "activo" : "inactivo"}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 20px", flexShrink: 0, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: "0 0 auto", padding: "14px 18px",
              border: "1.5px solid var(--border-strong)", borderRadius: 14,
              background: "var(--bg-elevated)", color: "var(--text-primary)",
              fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Cancelar</button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              style={{
                flex: 1, padding: "14px",
                border: "none", borderRadius: 14,
                background: saving ? "rgba(108,99,255,.4)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
                boxShadow: saving ? "none" : "0 4px 18px rgba(108,99,255,.35)",
              }}
            >
              {saving ? "Guardando..." : esEdicion ? "✓ Actualizar" : "✓ Agregar instructor"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  Tarjeta de instructor
// ══════════════════════════════════════════════════════════════════
function InstructorCard({ instructor, clases, onEdit, onArchivar, isOwner }) {
  const clasesAsignadas = clases.filter(c =>
    String(c.instructor_id) === String(instructor.id) && c.activo
  );

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 18, padding: "16px",
      display: "flex", flexDirection: "column", gap: 12,
      opacity: instructor.activo ? 1 : 0.55,
      transition: "transform .15s, box-shadow .15s",
      position: "relative",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,.18)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {/* Badge inactivo */}
      {!instructor.activo && (
        <span style={{
          position: "absolute", top: 12, right: 12,
          background: "rgba(248,113,113,.15)", color: "#f87171",
          borderRadius: 8, padding: "2px 8px", fontSize: 10, fontWeight: 700,
        }}>Inactivo</span>
      )}

      {/* Avatar + nombre */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
          background: instructor.foto ? "transparent" : "linear-gradient(135deg,#6c63ff33,#e040fb33)",
          color: "#a78bfa", fontSize: 18, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          border: "2px solid rgba(108,99,255,.2)",
        }}>
          {instructor.foto
            ? <img src={instructor.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : iniciales(instructor.nombre)
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "var(--text-primary)", fontSize: 15, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {instructor.nombre}
          </p>
          {instructor.especialidad && (
            <p style={{ color: "#a78bfa", fontSize: 11, fontWeight: 600, marginTop: 2 }}>
              🥋 {instructor.especialidad}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {instructor.telefono && (
          <p style={{ color: "var(--text-secondary)", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span>📱</span> {instructor.telefono}
          </p>
        )}
        {instructor.email && (
          <p style={{ color: "var(--text-secondary)", fontSize: 12, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            <span>✉️</span> {instructor.email}
          </p>
        )}
        {instructor.notas && (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {instructor.notas}
          </p>
        )}
      </div>

      {/* Clases asignadas */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <p style={{ color: "var(--text-tertiary)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Clases asignadas ({clasesAsignadas.length})
        </p>
        {clasesAsignadas.length === 0 ? (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Sin clases asignadas</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {clasesAsignadas.map(c => (
              <span key={c.id} style={{
                background: `${c.color || "#6c63ff"}18`,
                color: c.color || "#6c63ff",
                border: `1px solid ${c.color || "#6c63ff"}30`,
                borderRadius: 7, padding: "2px 8px", fontSize: 11, fontWeight: 600,
              }}>
                {c.nombre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      {isOwner && (
        <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <button onClick={() => onEdit(instructor)} style={{
            flex: 1, padding: "8px", border: "1px solid var(--border-strong)",
            borderRadius: 10, background: "var(--bg-elevated)",
            color: "var(--text-secondary)", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          }}>
            ✏️ Editar
          </button>
          <button onClick={() => onArchivar(instructor)} style={{
            flex: 1, padding: "8px",
            border: "1px solid rgba(248,113,113,.25)", borderRadius: 10,
            background: "rgba(248,113,113,.08)",
            color: "#f87171", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 600,
          }}>
            {instructor.activo ? "🗄️ Archivar" : "♻️ Restaurar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════
export default function InstructoresScreen({ gymId, isOwner, clases = [] }) {
  const [instructores, setInstructores] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [busqueda, setBusqueda]         = useState("");
  const [filtro, setFiltro]             = useState("activos"); // "activos" | "todos"
  const [modal, setModal]               = useState(null);      // null | "nuevo" | instructor
  const [confirmArchivar, setConfirmArchivar] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const db   = await supabase.from("instructores");
      const data = await db.select(gymId);
      setInstructores(data || []);
    } catch (e) {
      console.error("Error cargando instructores:", e);
    }
    setLoading(false);
  }, [gymId]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = (saved, esEdicion) => {
    if (esEdicion) {
      setInstructores(p => p.map(i => i.id === saved.id ? saved : i));
    } else {
      setInstructores(p => [...p, saved]);
    }
    setModal(null);
  };

  const handleArchivar = async (instructor) => {
    const nuevoEstado = !instructor.activo;
    const db = await supabase.from("instructores");
    await db.update(instructor.id, { activo: nuevoEstado });
    setInstructores(p => p.map(i => i.id === instructor.id ? { ...i, activo: nuevoEstado } : i));
    setConfirmArchivar(null);
  };

  const lista = instructores
    .filter(i => filtro === "todos" || i.activo)
    .filter(i => {
      const q = busqueda.toLowerCase();
      return !q ||
        i.nombre.toLowerCase().includes(q) ||
        (i.especialidad || "").toLowerCase().includes(q) ||
        (i.telefono || "").includes(q);
    });

  const totalActivos = instructores.filter(i => i.activo).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#6c63ff,#e040fb)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>👥</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: "var(--text-primary)", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                <span style={{ background: "linear-gradient(90deg,#6c63ff,#e040fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Instructores</span>
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                {totalActivos} activo{totalActivos !== 1 ? "s" : ""}
              </p>
            </div>
            {isOwner && (
              <button onClick={() => setModal("nuevo")} style={{
                border: "none", borderRadius: 12, padding: "8px 16px",
                cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                boxShadow: "0 3px 14px rgba(108,99,255,.35)",
              }}>
                + Nuevo instructor
              </button>
            )}
          </div>

          {/* Filtros + búsqueda */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-tertiary)", pointerEvents: "none" }}>🔍</span>
              <input
                type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, especialidad..."
                style={{
                  width: "100%", background: "var(--bg-elevated)",
                  border: "1px solid var(--border)", borderRadius: 14,
                  padding: "10px 12px 10px 34px", color: "var(--text-primary)",
                  fontSize: 13, fontFamily: "inherit", outline: "none",
                }}
              />
              {busqueda && (
                <button onClick={() => setBusqueda("")} style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "var(--text-tertiary)",
                  cursor: "pointer", fontSize: 14,
                }}>✕</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[["activos", "Activos"], ["todos", "Todos"]].map(([val, lbl]) => (
                <button key={val} onClick={() => setFiltro(val)} style={{
                  padding: "8px 14px", border: "none", borderRadius: 12,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                  background: filtro === val ? "linear-gradient(135deg,#6c63ff,#e040fb)" : "var(--bg-elevated)",
                  color: filtro === val ? "#fff" : "var(--text-secondary)",
                }}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="gym-scroll-pad" style={{ flex: 1, padding: "4px 20px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: "3px solid rgba(108,99,255,.2)", borderTopColor: "#6c63ff",
                margin: "0 auto 14px", animation: "spin .8s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>Cargando instructores...</p>
            </div>
          ) : lista.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>👤</p>
              <p style={{ color: "var(--text-secondary)", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                {busqueda ? "Sin resultados" : "Aún no hay instructores"}
              </p>
              {isOwner && !busqueda && (
                <button onClick={() => setModal("nuevo")} style={{
                  marginTop: 12, border: "none", borderRadius: 12, padding: "10px 22px",
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  background: "linear-gradient(135deg,#6c63ff,#e040fb)", color: "#fff",
                }}>
                  + Agregar primer instructor
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14, paddingBottom: 24,
            }}>
              {lista.map(inst => (
                <InstructorCard
                  key={inst.id}
                  instructor={inst}
                  clases={clases}
                  onEdit={i => setModal(i)}
                  onArchivar={i => setConfirmArchivar(i)}
                  isOwner={isOwner}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <ModalInstructor
          instructor={modal === "nuevo" ? null : modal}
          gymId={gymId}
          onSave={handleGuardar}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirmación archivar */}
      {confirmArchivar && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
          zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: 20, padding: "28px 24px",
            maxWidth: 340, width: "100%", textAlign: "center",
          }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>
              {confirmArchivar.activo ? "🗄️" : "♻️"}
            </p>
            <h3 style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {confirmArchivar.activo ? "¿Archivar instructor?" : "¿Restaurar instructor?"}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
              {confirmArchivar.activo
                ? `${confirmArchivar.nombre} dejará de aparecer en los selectores de clases.`
                : `${confirmArchivar.nombre} volverá a estar disponible.`
              }
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmArchivar(null)} style={{
                flex: 1, padding: "11px", border: "1px solid var(--border)",
                borderRadius: 12, background: "transparent", color: "var(--text-secondary)",
                cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              }}>Cancelar</button>
              <button onClick={() => handleArchivar(confirmArchivar)} style={{
                flex: 1, padding: "11px", border: "none",
                borderRadius: 12,
                background: confirmArchivar.activo
                  ? "linear-gradient(135deg,#f43f5e,#e11d48)"
                  : "linear-gradient(135deg,#6c63ff,#e040fb)",
                color: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 700,
              }}>
                {confirmArchivar.activo ? "Archivar" : "Restaurar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
