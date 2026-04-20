// ─────────────────────────────────────────────
//  components/Nav.jsx
//  Barra de navegación principal.
//  → Mobile  (<768px):        bottom nav fijo
//  → Tablet  (768–1023px):    sidebar iconos
//  → Desktop (≥1024px):       sidebar completa con logo + nombre
// ─────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Inicio",   icon: "⌂",  s: "dashboard", t: null             },
  { label: "Miembros", icon: "◎",  s: "miembros",  t: null             },
  { label: "",         icon: "⊕",  accent: true                        },
  { label: "Mensajes", icon: "💬", s: "mensajes",  t: null, hasBadge: true },
  { label: "Caja",     icon: "💵", s: "caja",      t: null             },
];

export default function Nav({
  screen,
  setScreen,
  tab,
  setTab,
  setModal,
  totalRecordatorios,
  gymConfig,
}) {
  const handleClick = (item) => {
    if (item.accent) { setModal("quickAdd"); return; }
    setScreen(item.s);
    if (item.t !== null) setTab(item.t);
  };

  const gymNombre = gymConfig?.nombre || "GymFit Pro";
  const gymLogo   = gymConfig?.logo   || null;

  return (
    <nav className="gym-nav">

      {/* ── Cabecera gym (solo desktop) ── */}
      <div className="gym-nav-gym">
        <div className="gym-nav-gym-logo">
          {gymLogo
            ? <img src={gymLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : "💪"
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <span className="gym-nav-gym-name">{gymNombre}</span>
          <span className="gym-nav-gym-sub">Panel Admin</span>
        </div>
      </div>

      {/* ── Sección navegación (solo desktop) ── */}
      <span className="gym-nav-section">Menú</span>

      {/* ── Items ── */}
      {NAV_ITEMS.map((item, i) => (
        <button
          key={i}
          className={"gym-nav-btn" + (item.accent ? " gym-nav-btn-accent" : "")}
          onClick={() => handleClick(item)}
          style={
            !item.accent && screen === item.s
              ? { background: "rgba(167,139,250,.12)" }
              : {}
          }
        >
          {item.accent ? (
            <div className="gym-nav-accent">{item.icon}</div>
          ) : (
            <>
              <span className={"gym-nav-icon" + (screen === item.s ? " active" : "")}>
                {item.icon}
              </span>
              <span className={"gym-nav-label" + (screen === item.s ? " active" : "")}>
                {item.label}
              </span>
              {item.hasBadge && totalRecordatorios > 0 && (
                <span
                  className="wa-pulse"
                  style={{
                    position: "absolute",
                    top: 8, right: 12,
                    width: 8, height: 8,
                    background: "#f43f5e",
                    borderRadius: "50%",
                    border: "2px solid #08081c",
                  }}
                />
              )}
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
