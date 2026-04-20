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

      {/* ── Cabecera gym (solo desktop ≥1024px) ── */}
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

      {/* ── Items de navegación ── */}
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

      {/* ── Botón Agregar — destacado, solo desktop ── */}
      <button
        className="gym-nav-btn gym-nav-btn-accent"
        onClick={() => setModal("quickAdd")}
      >
        <div className="gym-nav-accent">⊕</div>
        <span className="gym-nav-label" style={{ color: "#a78bfa", fontWeight: 700 }}>Agregar</span>
      </button>

      {/* ── Acciones secundarias (solo desktop) ── */}
      <div className="gym-nav-divider" />
      <span className="gym-nav-section">Herramientas</span>

      <button className={"gym-nav-btn" + (screen === "estadisticas" ? " gym-nav-btn-active" : "")} onClick={() => setScreen("estadisticas")}>
        <span className={"gym-nav-icon" + (screen === "estadisticas" ? " active" : "")}>📊</span>
        <span className={"gym-nav-label" + (screen === "estadisticas" ? " active" : "")}>Estadísticas</span>
      </button>

      {/* ── Spacer para empujar config/logout al fondo ── */}
      <div style={{ flex: 1 }} className="gym-nav-spacer" />

      <div className="gym-nav-divider" />

      <button className="gym-nav-btn" onClick={() => setConfigScreen(true)}>
        <span className="gym-nav-icon">⚙️</span>
        <span className="gym-nav-label">Configuración</span>
      </button>

      <button className="gym-nav-btn" onClick={onLogout}>
        <span className="gym-nav-icon" style={{ color: "#f43f5e" }}>🚪</span>
        <span className="gym-nav-label" style={{ color: "#f43f5e" }}>Cerrar sesión</span>
      </button>

      {/* ── Bottom nav mobile: botón ⊕ central ── */}
      <button className="gym-nav-btn gym-nav-btn-accent mobile-only" onClick={() => setModal("quickAdd")}>
        <div className="gym-nav-accent">⊕</div>
      </button>

    </nav>
  );
}
