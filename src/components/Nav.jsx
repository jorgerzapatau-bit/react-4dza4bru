// Nav.jsx — Sidebar desktop / bottom nav mobile

const NAV_ITEMS = [
  { label: "Inicio",   icon: "⌂",  s: "dashboard" },
  { label: "Miembros", icon: "◎",  s: "miembros"  },
  { label: "Mensajes", icon: "💬", s: "mensajes",  hasBadge: true },
  { label: "Caja",     icon: "💵", s: "caja"      },
];

export default function Nav({ screen, setScreen, setTab, setModal, totalRecordatorios, gymConfig, setConfigScreen, onLogout }) {
  const gymNombre = gymConfig?.nombre || "GymFit Pro";
  const gymLogo   = gymConfig?.logo   || null;

  return (
    <nav className="gym-nav">

      {/* ══ DESKTOP ONLY content ══ */}

      {/* Cabecera gym */}
      <div className="gym-nav-gym">
        <div className="gym-nav-gym-logo">
          {gymLogo
            ? <img src={gymLogo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain" }} />
            : "💪"
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <span className="gym-nav-gym-name">{gymNombre}</span>
          <span className="gym-nav-gym-sub">Panel Admin</span>
        </div>
      </div>

      <span className="gym-nav-section">Menú</span>

      {/* ══ NAV ITEMS — visibles en desktop sidebar y mobile bottom bar ══ */}
      {NAV_ITEMS.map((item, i) => (
        <button
          key={i}
          className={"gym-nav-btn" + (screen === item.s ? " gym-nav-btn-active" : "")}
          onClick={() => { setScreen(item.s); if (item.s === "dashboard") setTab(0); }}
        >
          <span className={"gym-nav-icon" + (screen === item.s ? " active" : "")}>{item.icon}</span>
          <span className={"gym-nav-label" + (screen === item.s ? " active" : "")}>{item.label}</span>
          {item.hasBadge && totalRecordatorios > 0 && (
            <span className="wa-pulse" style={{ position: "absolute", top: 8, right: 12, width: 8, height: 8, background: "#f43f5e", borderRadius: "50%", border: "2px solid #0d1117" }} />
          )}
        </button>
      ))}

      {/* ⊕ Botón central mobile */}
      <button className="gym-nav-btn mobile-only" onClick={() => setModal("quickAdd")}>
        <div style={{
          width: 46, height: 46, borderRadius: 15, marginTop: -16,
          background: "linear-gradient(135deg,#6c63ff,#e040fb)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, boxShadow: "0 4px 18px rgba(108,99,255,.4)",
        }}>⊕</div>
      </button>

      {/* ══ DESKTOP ONLY: resto del sidebar ══ */}

      {/* Botón Agregar desktop */}
      <button
        className="gym-nav-btn desktop-only"
        onClick={() => setModal("quickAdd")}
        style={{ marginTop: 8, marginBottom: 8, padding: "6px 14px" }}
      >
        <div style={{
          width: "100%", height: 46, borderRadius: 14,
          background: "linear-gradient(135deg,#6c63ff,#e040fb)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: "0 4px 18px rgba(108,99,255,.4)",
        }}>⊕</div>
      </button>

      <div className="gym-nav-divider" />
      <span className="gym-nav-section">Herramientas</span>

      <button className={"gym-nav-btn desktop-only" + (screen === "estadisticas" ? " gym-nav-btn-active" : "")} onClick={() => setScreen("estadisticas")}>
        <span className={"gym-nav-icon" + (screen === "estadisticas" ? " active" : "")}>📊</span>
        <span className={"gym-nav-label" + (screen === "estadisticas" ? " active" : "")}>Estadísticas</span>
      </button>

      <div className="gym-nav-spacer" />

      <div className="gym-nav-divider" />

      <button className="gym-nav-btn desktop-only" onClick={() => setConfigScreen(true)}>
        <span className="gym-nav-icon">⚙️</span>
        <span className="gym-nav-label">Configuración</span>
      </button>

      <button className="gym-nav-btn desktop-only" onClick={onLogout}>
        <span className="gym-nav-icon" style={{ color: "#f43f5e" }}>🚪</span>
        <span className="gym-nav-label" style={{ color: "#f43f5e" }}>Cerrar sesión</span>
      </button>

    </nav>
  );
}
