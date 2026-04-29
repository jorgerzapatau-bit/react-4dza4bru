// src/components/InstructorSelect.jsx
// ══════════════════════════════════════════════════════════════════
//  Dropdown custom para seleccionar instructor.
//  Muestra avatar, nombre y especialidad.
//  Reemplaza el <select> nativo que se desborda en móvil.
//
//  Props:
//    instructores   array   — lista de instructores de la tabla
//    value          string  — instructor_id seleccionado
//    onChange       fn(id, nombre) — callback al seleccionar
//    placeholder    string  — texto cuando no hay selección
// ══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from "react";

function iniciales(nombre) {
  if (!nombre) return "?";
  const p = nombre.trim().split(" ");
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : p[0].slice(0, 2).toUpperCase();
}

export default function InstructorSelect({
  instructores = [],
  value = "",
  onChange,
  placeholder = "— Sin instructor —",
  color = "#6c63ff",
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const ref                   = useRef(null);
  const inputRef              = useRef(null);

  const selected = instructores.find(i => String(i.id) === String(value)) || null;

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  // Foco en input al abrir
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtrados = instructores.filter(i =>
    !query || i.nombre.toLowerCase().includes(query.toLowerCase()) ||
    (i.especialidad || "").toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (inst) => {
    onChange(inst ? String(inst.id) : "", inst ? inst.nombre : "");
    setOpen(false);
    setQuery("");
  };

  const triggerStyle = {
    width: "100%",
    background: "var(--bg-elevated, #1e1e2e)",
    border: open
      ? `1.5px solid ${color}`
      : "1px solid var(--border-strong, #2e2e42)",
    borderRadius: open ? "12px 12px 0 0" : 12,
    padding: "11px 14px",
    color: "var(--text-primary, #e8e8f0)",
    fontSize: 13, fontFamily: "inherit",
    cursor: "pointer",
    display: "flex", alignItems: "center", gap: 10,
    transition: "border .15s",
    boxSizing: "border-box",
    outline: "none",
  };

  const dropdownStyle = {
    position: "absolute",
    top: "100%", left: 0, right: 0,
    background: "var(--bg-elevated, #1e1e2e)",
    border: `1.5px solid ${color}`,
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    zIndex: 9999,
    boxShadow: "0 12px 32px rgba(0,0,0,.5)",
    overflow: "hidden",
    maxHeight: 280,
    display: "flex", flexDirection: "column",
  };

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 14 }}>

      {/* Trigger */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
        style={triggerStyle}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); }
          if (e.key === "Escape") { setOpen(false); setQuery(""); }
        }}
      >
        {selected ? (
          <>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: selected.foto ? "transparent" : `${color}22`,
              color, fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
            }}>
              {selected.foto
                ? <img src={selected.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : iniciales(selected.nombre)
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "var(--text-primary, #e8e8f0)", fontSize: 13, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {selected.nombre}
              </p>
              {selected.especialidad && (
                <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {selected.especialidad}
                </p>
              )}
            </div>
          </>
        ) : (
          <span style={{ color: "var(--text-tertiary, #6b6b8a)", flex: 1 }}>{placeholder}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0, transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          <path fill="var(--text-tertiary, #6b6b8a)" d="M6 8L1 3h10z" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={dropdownStyle}>
          {/* Búsqueda */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border, #2a2a3e)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar instructor..."
              style={{
                width: "100%", background: "var(--bg-card, #12121f)",
                border: "1px solid var(--border, #2a2a3e)", borderRadius: 8,
                padding: "8px 10px", color: "var(--text-primary, #e8e8f0)",
                fontSize: 12, fontFamily: "inherit", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Lista */}
          <div style={{ overflowY: "auto", flex: 1 }} role="listbox">
            {/* Opción vacía */}
            <button
              role="option"
              aria-selected={!value}
              style={{
                width: "100%", padding: "10px 14px", border: "none",
                background: !value ? `${color}15` : "transparent",
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 10,
                textAlign: "left", borderBottom: "1px solid var(--border, #2a2a3e)",
              }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = "var(--bg-card, #12121f)"; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = "transparent"; }}
              onMouseDown={e => { e.preventDefault(); handleSelect(null); }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "var(--border, #2a2a3e)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>🚫</div>
              <span style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12 }}>Sin instructor</span>
            </button>

            {filtrados.length === 0 && (
              <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
                Sin resultados
              </p>
            )}

            {filtrados.map(inst => {
              const isSel = String(inst.id) === String(value);
              return (
                <button
                  key={inst.id}
                  role="option"
                  aria-selected={isSel}
                  style={{
                    width: "100%", padding: "10px 14px", border: "none",
                    background: isSel ? `${color}18` : "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 10,
                    textAlign: "left", borderBottom: "1px solid var(--border, #2a2a3e)",
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--bg-card, #12121f)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                  onMouseDown={e => { e.preventDefault(); handleSelect(inst); }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: inst.foto ? "transparent" : `${color}22`,
                    color, fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                    boxShadow: isSel ? `0 0 0 2px ${color}` : "none",
                  }}>
                    {inst.foto
                      ? <img src={inst.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : iniciales(inst.nombre)
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      color: isSel ? color : "var(--text-primary, #e8e8f0)",
                      fontSize: 13, fontWeight: isSel ? 700 : 500,
                      overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>
                      {inst.nombre}
                    </p>
                    {inst.especialidad && (
                      <p style={{ color: "var(--text-tertiary, #6b6b8a)", fontSize: 11, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {inst.especialidad}
                      </p>
                    )}
                  </div>
                  {isSel && (
                    <span style={{ color, fontSize: 14, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
