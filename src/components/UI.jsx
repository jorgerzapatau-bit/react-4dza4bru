// ─────────────────────────────────────────────
//  components/UI.jsx
//  Átomos de UI reutilizables en toda la app:
//  Badge, Inp, Modal, Btn
//  Estos componentes NO tienen lógica de negocio.
// ─────────────────────────────────────────────

// ── Badge de porcentaje ──────────────────────
export function Badge({ val }) {
  const up = parseFloat(val) >= 0;
  return (
    <span style={{
      background: up ? "rgba(74,222,128,.18)" : "rgba(248,113,113,.18)",
      color: up ? "#4ade80" : "#f87171",
      borderRadius: 20,
      padding: "3px 10px",
      fontSize: 12,
      fontWeight: 700,
    }}>
      {up ? "▲" : "▼"} {Math.abs(val)}%
    </span>
  );
}

// ── Input / Select genérico ──────────────────
export function Inp({ label, value, onChange, type = "text", placeholder, options, readOnly }) {
  const s = {
    width: "100%",
    background: readOnly ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.07)",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: 12,
    padding: "12px 14px",
    color: readOnly ? "#6b7280" : "#fff",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    marginBottom: 12,
  };

  return (
    <div>
      {label && (
        <p style={{
          color: "#6b7280",
          fontSize: 12,
          fontWeight: 600,
          marginBottom: 5,
          textTransform: "uppercase",
          letterSpacing: .5,
        }}>
          {label}
        </p>
      )}
      {options
        ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            style={{ ...s, cursor: "pointer" }}
            disabled={readOnly}
          >
            {options.map(o => (
              <option key={o} value={o} style={{ background: "#1a1a2e" }}>{o}</option>
            ))}
          </select>
        )
        : (
          <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={s}
            readOnly={readOnly}
          />
        )
      }
    </div>
  );
}

// ── Modal sheet (bottom en móvil, centrado en desktop) ──
export function Modal({ title, onClose, children }) {
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,.72)",
      backdropFilter: "blur(8px)",
      zIndex: 100,
      display: "flex",
      alignItems: isDesktop ? "center" : "flex-end",
      justifyContent: isDesktop ? "center" : "flex-start",
      padding: isDesktop ? "20px" : 0,
    }}>
      <div style={{
        width: "100%",
        maxWidth: isDesktop ? 500 : "100%",
        background: "#191928",
        borderRadius: isDesktop ? "20px" : "28px 28px 0 0",
        padding: "24px 24px 44px",
        maxHeight: isDesktop ? "85vh" : "92%",
        overflowY: "auto",
        animation: isDesktop ? "fadeUp .25s ease" : "slideUp .3s ease",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "rgba(255,255,255,.1)",
              color: "#9ca3af",
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Botón primario / outline / small ────────
export function Btn({ children, onClick, color = "#6c63ff", full, outline, small, style: extraStyle }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? "100%" : "auto",
        padding: small ? "8px 14px" : "13px 20px",
        border: outline ? `1.5px solid ${color}` : "none",
        borderRadius: 14,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        background: outline ? "transparent" : `linear-gradient(135deg,${color},${color}bb)`,
        color: outline ? color : "#fff",
        boxShadow: outline ? "none" : `0 4px 18px ${color}44`,
        transition: "opacity .15s",
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}
