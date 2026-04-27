// src/components/Nav.jsx

import { useState, useEffect } from "react";

const IC = {
  home:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  members: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87"/></svg>,
  chat:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  cash:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  stats:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gear:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  logout:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  plus:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  sun:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  moon:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  store: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  qr: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/>
      <rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/>
      <path d="M14 14h3v3h-3zM17 14h3M17 17v3M14 17v3"/>
    </svg>
  ),
  // Hamburger icon
  hamburger: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

const BASE_NAV_ITEMS = [
  { label: "Inicio",   icon: IC.home,    s: "dashboard" },
  { label: "Miembros", icon: IC.members, s: "miembros"  },
  { label: "Mensajes", icon: IC.chat,    s: "mensajes",  hasBadge: true },
  { label: "Caja",     icon: IC.cash,    s: "caja"      },
  { label: "Tienda",   icon: IC.store,   s: "tienda"    },
  // Agregar en BASE_NAV_ITEMS (o OWNER_EXTRA_ITEMS si es solo para dueños)
  { label: "Horarios", icon: IC.calendar, s: "horarios" }
];

const OWNER_EXTRA_ITEMS = [
  {
    label: "Finanzas",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
    s: "finanzas",
  },
];

// ── NavBtn: soporta modo colapsado (solo icono con tooltip) ──
function NavBtn({ label, icon, active, onClick, badge, totalRecordatorios, darkMode, accentColor, collapsed }) {
  const activeBg = accentColor || "#2563eb";
  const hoverBg  = darkMode ? "#161b22" : "#f0f0f5";
  return (
    <button
      title={collapsed ? label : undefined}
      style={{
        width: "100%", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center",
        gap: collapsed ? 0 : 12,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "10px" : "10px 12px",
        borderRadius: 10,
        background: active ? activeBg : "transparent",
        transition: "background .15s, padding .2s", position: "relative",
        fontFamily: "inherit",
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ color: active ? "#fff" : (darkMode ? "#6e7681" : "#6b7280"), display: "flex", flexShrink: 0 }}>{icon}</span>
      {!collapsed && (
        <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "#fff" : (darkMode ? "#8b949e" : "#374151"), flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>{label}</span>
      )}
      {badge && totalRecordatorios > 0 && (
        <span className="wa-pulse" style={{ position: collapsed ? "absolute" : "static", top: collapsed ? 6 : "auto", right: collapsed ? 6 : "auto", width: 7, height: 7, background: "#f43f5e", borderRadius: "50%", flexShrink: 0 }} />
      )}
    </button>
  );
}

function ThemeToggle({ darkMode, setDarkMode, collapsed }) {
  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      title={collapsed ? (darkMode ? "Modo claro" : "Modo oscuro") : undefined}
      style={{
        display: "flex", alignItems: "center",
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? "center" : "flex-start",
        width: "100%", border: "none", borderRadius: 10,
        padding: collapsed ? "10px" : "10px 12px",
        cursor: "pointer", fontFamily: "inherit",
        background: "transparent", transition: "background .15s, padding .2s",
        color: darkMode ? "#8b949e" : "#6b7280",
      }}
      onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#161b22" : "#f0f0f5"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ display: "flex", flexShrink: 0 }}>{darkMode ? IC.sun : IC.moon}</span>
      {!collapsed && (
        <>
          <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap" }}>
            {darkMode ? "Modo claro" : "Modo oscuro"}
          </span>
          <span style={{
            marginLeft: "auto", width: 36, height: 20, borderRadius: 10,
            background: darkMode ? "#334155" : "#d1d5db",
            position: "relative", flexShrink: 0, transition: "background .2s",
          }}>
            <span style={{
              position: "absolute", top: 2,
              left: darkMode ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%",
              background: darkMode ? "#a78bfa" : "#fff",
              transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)",
            }} />
          </span>
        </>
      )}
    </button>
  );
}

export default function Nav({ screen, setScreen, setTab, setModal, totalRecordatorios, gymConfig, setConfigScreen, onLogout, darkMode, setDarkMode, isOwner = false }) {
  const gymNombre = gymConfig?.nombre || "GymFit Pro";
  const gymLogo   = gymConfig?.logo   || null;

  // ── Estado del sidebar ──
  const [collapsed, setCollapsed] = useState(false);       // desktop: colapsado a iconos
  const [mobileOpen, setMobileOpen] = useState(false);     // mobile: drawer abierto

  // Cerrar drawer mobile al cambiar de pantalla
  useEffect(() => { setMobileOpen(false); }, [screen]);

  // Cerrar drawer al hacer resize a desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const dividerStyle = { height: 1, background: darkMode ? "#21262d" : "#e5e7eb", margin: "10px 0" };

  // ── Sidebar content (shared between desktop and mobile drawer) ──
  const sidebarContent = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    const sectionStyle = {
      fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
      textTransform: "uppercase", color: darkMode ? "#6e7681" : "#9ca3af",
      padding: "16px 12px 6px", display: isCollapsed ? "none" : "block",
    };
    return (
      <>
        {/* ── Header: hamburguesa + logo ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: isCollapsed ? 0 : 10,
          justifyContent: isCollapsed ? "center" : "flex-start",
          padding: isCollapsed ? "4px 0 18px" : "4px 4px 18px",
          borderBottom: `1px solid ${darkMode ? "#21262d" : "#e5e7eb"}`,
          marginBottom: 8,
        }}>
          {/* Hamburger */}
          <button
            onClick={() => isMobileDrawer ? setMobileOpen(false) : setCollapsed(c => !c)}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: darkMode ? "#8b949e" : "#6b7280",
              padding: 4, borderRadius: 8, flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#161b22" : "#f0f0f5"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            {IC.hamburger}
          </button>

          {/* Logo + nombre (ocultos cuando colapsado) */}
          {!isCollapsed && (
            <>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: "linear-gradient(135deg,#6c63ff,#e040fb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, overflow: "hidden",
              }}>
                {gymLogo
                  ? <img src={gymLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  : "💪"
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: darkMode ? "#e2e8f0" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {gymNombre}
                </div>
                <div style={{ fontSize: 9, color: darkMode ? "#64748b" : "#9ca3af", textTransform: "uppercase", letterSpacing: ".8px", marginTop: 1 }}>
                  {isOwner ? "👑 Dueño" : "🛡️ Administrador"}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Menú principal ── */}
        {!isCollapsed && <span style={sectionStyle}>Menú</span>}

        {[...BASE_NAV_ITEMS, ...(isOwner ? OWNER_EXTRA_ITEMS : [])].map((item, i) => (
          <NavBtn
            key={i}
            label={item.label}
            icon={item.icon}
            active={screen === item.s}
            badge={item.hasBadge}
            totalRecordatorios={totalRecordatorios}
            darkMode={darkMode}
            collapsed={isCollapsed}
            onClick={() => { setScreen(item.s); if (item.s === "dashboard") setTab(0); }}
          />
        ))}

        {/* Botón Agregar */}
        <button
          onClick={() => setModal("quickAdd")}
          title={isCollapsed ? "Agregar" : undefined}
          style={{
            width: "100%", marginTop: 10,
            padding: isCollapsed ? "10px" : "10px 16px",
            border: "none", borderRadius: 10, cursor: "pointer",
            background: "linear-gradient(135deg,#6c63ff,#e040fb)",
            display: "flex", alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? 0 : 10,
            fontFamily: "inherit", boxShadow: "0 4px 18px rgba(108,99,255,.3)",
            transition: "padding .2s",
          }}
        >
          <span style={{ color: "#fff", display: "flex" }}>{IC.plus}</span>
          {!isCollapsed && <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Agregar</span>}
        </button>

        {/* ── Herramientas ── */}
        <div style={dividerStyle} />
        {!isCollapsed && <span style={sectionStyle}>Herramientas</span>}

        {isOwner && <NavBtn label="Estadísticas" icon={IC.stats} active={screen === "estadisticas"} darkMode={darkMode} collapsed={isCollapsed} onClick={() => setScreen("estadisticas")} />}
        <NavBtn label="Control de Acceso" icon={IC.qr} active={screen === "scanner"} darkMode={darkMode} accentColor="#059669" collapsed={isCollapsed} onClick={() => setScreen("scanner")} />

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 16 }} />
        <div style={dividerStyle} />

        <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} collapsed={isCollapsed} />

        {isOwner && <NavBtn label="Configuración" icon={IC.gear} active={false} darkMode={darkMode} collapsed={isCollapsed} onClick={() => setConfigScreen(true)} />}

        <button
          onClick={onLogout}
          title={isCollapsed ? "Cerrar sesión" : undefined}
          style={{
            width: "100%", border: "none", cursor: "pointer", marginTop: 2,
            display: "flex", alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? 0 : 12,
            padding: isCollapsed ? "10px" : "10px 12px",
            borderRadius: 10, background: "transparent",
            transition: "background .15s, padding .2s", fontFamily: "inherit",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,.08)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <span style={{ color: "#f43f5e", display: "flex" }}>{IC.logout}</span>
          {!isCollapsed && <span style={{ fontSize: 14, fontWeight: 500, color: "#f43f5e" }}>Cerrar sesión</span>}
        </button>
      </>
    );
  };

  return (
    <>
      {/* ══ DESKTOP SIDEBAR ══ */}
      <nav
        className="gym-nav desktop-nav"
        style={{
          width: collapsed ? 68 : 240,
          minWidth: collapsed ? 68 : 240,
          padding: "20px 8px 16px",
        }}
      >
        {sidebarContent(false)}
      </nav>

      {/* ══ MOBILE: top bar con hamburguesa ══ */}
      <div className="mobile-topbar" style={{
        display: "none",
        position: "fixed", top: 0, left: 0, right: 0, height: 52,
        background: darkMode ? "var(--bg-nav)" : "var(--bg-nav)",
        borderBottom: `1px solid ${darkMode ? "#21262d" : "#e5e7eb"}`,
        zIndex: 201, alignItems: "center", gap: 10, padding: "0 16px",
        backdropFilter: "blur(20px)",
      }}>
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: darkMode ? "#8b949e" : "#6b7280", padding: 6, borderRadius: 8,
          }}
        >
          {IC.hamburger}
        </button>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg,#6c63ff,#e040fb)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, overflow: "hidden", flexShrink: 0,
        }}>
          {gymLogo ? <img src={gymLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : "💪"}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: darkMode ? "#e2e8f0" : "#111827" }}>{gymNombre}</span>
      </div>

      {/* ══ MOBILE DRAWER backdrop ══ */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            zIndex: 299, backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ══ MOBILE DRAWER ══ */}
      <div
        className="mobile-drawer"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: 280,
          background: darkMode ? "var(--bg-nav)" : "var(--bg-nav)",
          borderRight: `1px solid ${darkMode ? "#21262d" : "#e5e7eb"}`,
          zIndex: 300,
          display: "flex", flexDirection: "column",
          padding: "20px 8px 16px",
          gap: 2,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .25s cubic-bezier(.4,0,.2,1)",
          overflowY: "auto",
        }}
      >
        {sidebarContent(true)}
      </div>

      {/* ══ MOBILE BOTTOM NAV ══ */}
      <nav className="gym-nav mobile-bottom-nav">
        {[...BASE_NAV_ITEMS, ...(isOwner ? OWNER_EXTRA_ITEMS : [])].map((item, i) => (
          <button
            key={"m"+i}
            className="gym-nav-btn mobile-only"
            onClick={() => { setScreen(item.s); if (item.s === "dashboard") setTab(0); }}
          >
            <span style={{ color: screen === item.s ? "#a78bfa" : "#6e7681", display: "flex" }}>{item.icon}</span>
            <span className={"gym-nav-label" + (screen === item.s ? " active" : "")}>{item.label}</span>
            {item.hasBadge && totalRecordatorios > 0 && (
              <span className="wa-pulse" style={{ position: "absolute", top: 4, right: "50%", marginRight: -18, width: 7, height: 7, background: "#f43f5e", borderRadius: "50%", border: "2px solid #0d1117" }} />
            )}
          </button>
        ))}
        <button className="gym-nav-btn mobile-only" onClick={() => setScreen("scanner")}>
          <span style={{ color: screen === "scanner" ? "#22c55e" : "#6e7681", display: "flex" }}>{IC.qr}</span>
          <span className={"gym-nav-label" + (screen === "scanner" ? " active" : "")} style={{ color: screen === "scanner" ? "#22c55e" : undefined }}>Acceso</span>
        </button>
        <button className="gym-nav-btn mobile-only" onClick={() => setModal("quickAdd")}>
          <div style={{
            width: 46, height: 46, borderRadius: 15, marginTop: -16,
            background: "linear-gradient(135deg,#6c63ff,#e040fb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 18px rgba(108,99,255,.4)",
          }}>{IC.plus}</div>
        </button>
      </nav>
    </>
  );
}
