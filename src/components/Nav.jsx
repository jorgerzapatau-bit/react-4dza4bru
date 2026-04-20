// ─────────────────────────────────────────────
//  components/Nav.jsx
//  Barra de navegación principal.
//  → En móvil  (<768px): bottom nav fijo.
//  → En tablet/desktop (≥768px): sidebar izquierdo.
//
//  Props:
//    screen              string   — pantalla activa
//    setScreen           fn       — cambia la pantalla
//    tab                 number   — tab activo del dashboard
//    setTab              fn       — cambia el tab
//    setModal            fn       — abre un modal (p.ej. "quickAdd")
//    totalRecordatorios  number   — badge rojo en el ícono Mensajes
//
//  Nota sobre pantallas:
//    "estadisticas" NO está en la nav; se accede desde un botón
//    📊 dentro del DashboardScreen. La nav cubre:
//    dashboard · miembros · (⊕ quickAdd) · mensajes · caja
//
//  Uso:
//    import Nav from "./components/Nav";
//    <Nav
//      screen={screen}
//      setScreen={setScreen}
//      tab={tab}
//      setTab={setTab}
//      setModal={setModal}
//      totalRecordatorios={totalRecordatorios}
//    />
// ─────────────────────────────────────────────

// Definición de los ítems de navegación.
// `accent: true`  → botón ⊕ central, abre el modal quickAdd.
// `badge`         → se resuelve dinámicamente desde la prop.
const NAV_ITEMS = [
  { label: "Inicio",    icon: "⌂",  s: "dashboard", t: null             },
  { label: "Miembros",  icon: "◎",  s: "miembros",  t: null             },
  { label: "",          icon: "⊕",  accent: true                        },
  { label: "Mensajes",  icon: "💬", s: "mensajes",  t: null, hasBadge: true },
  { label: "Caja",      icon: "💵", s: "caja",      t: null             },
];

export default function Nav({
  screen,
  setScreen,
  tab,       // eslint-disable-line no-unused-vars  — reservado para futuros tabs
  setTab,
  setModal,
  totalRecordatorios,
}) {
  const handleClick = (item) => {
    if (item.accent) {
      setModal("quickAdd");
      return;
    }
    setScreen(item.s);
    if (item.t !== null) setTab(item.t);
  };

  return (
    <nav className="gym-nav">
      {NAV_ITEMS.map((item, i) => (
        <button
          key={i}
          className="gym-nav-btn"
          onClick={() => handleClick(item)}
        >
          {item.accent ? (
            /* ── Botón ⊕ central ── */
            <div className="gym-nav-accent">{item.icon}</div>
          ) : (
            /* ── Ítem normal ── */
            <>
              <span className={"gym-nav-icon" + (screen === item.s ? " active" : "")}>
                {item.icon}
              </span>
              <span className={"gym-nav-label" + (screen === item.s ? " active" : "")}>
                {item.label}
              </span>

              {/* Badge de recordatorios WA pendientes */}
              {item.hasBadge && totalRecordatorios > 0 && (
                <span
                  className="wa-pulse"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: "18%",
                    width: 8,
                    height: 8,
                    background: "#f43f5e",
                    borderRadius: "50%",
                    border: "2px solid #13131f",
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
