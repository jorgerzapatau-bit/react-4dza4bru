// src/components/Nav.jsx — con botón de Control de Acceso (Scanner)
// ─────────────────────────────────────────────────────────────────────────────
// CAMBIOS respecto al original:
//   • Nuevo ícono IC.qr (código QR)
//   • Nuevo NAV_ITEM "Scanner" que navega a la pantalla "scanner"
//   • Estilo especial: resalta en verde cuando está activo (tema de acceso)
// ─────────────────────────────────────────────────────────────────────────────

const IC = {
  home:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  members: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87"/></svg>,
  chat:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  cash:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  stats:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gear:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  logout:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  plus:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  sun:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  // ── NEW: QR / Scanner icon ──────────────────────────────────────────────────
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
};

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: "Inicio",   icon: IC.home,    s: "dashboard" },
  { label: "Miembros", icon: IC.members, s: "miembros"  },
  { label: "Mensajes", icon: IC.chat,    s: "mensajes",  hasBadge: true },
  { label: "Caja",     icon: IC.cash,    s: "caja"      },
];

function NavBtn({ label, icon, active, onClick, badge, totalRecordatorios, darkMode, accentColor }) {
  const activeBg = accentColor || "#2563eb";
  const hoverBg  = darkMode ? "#161b22" : "#f0f0f5";
  return (
    <button
      style={{
        width: "100%", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 10,
        background: active ? activeBg : "transparent",
        transition: "background .15s", position: "relative",
        fontFamily: "inherit",
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ color: active ? "#fff" : (darkMode ? "#6e7681" : "#6b7280"), display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: active ? 600 : 500, color: active ? "#fff" : (darkMode ? "#8b949e" : "#374151"), flex: 1, textAlign: "left" }}>{label}</span>
      {badge && totalRecordatorios > 0 && (
        <span className="wa-pulse" style={{ width: 8, height: 8, background: "#f43f5e", borderRadius: "50%", flexShrink: 0 }} />
      )}
      {active && <span style={{ color: "#fff", display: "flex", opacity: 0.7 }}>{IC.chevron}</span>}
    </button>
  );
}

function ThemeToggle({ darkMode, setDarkMode }) {
  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", border: "none", borderRadius: 10,
        padding: "10px 12px", cursor: "pointer", fontFamily: "inherit",
        background: "transparent", transition: "background .15s",
        color: darkMode ? "#8b949e" : "#6b7280",
      }}
      onMouseEnter={e => e.currentTarget.style.background = darkMode ? "#161b22" : "#f0f0f5"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ display: "flex", flexShrink: 0 }}>
        {darkMode ? IC.sun : IC.moon}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>
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
          transition: "left .2s",
          boxShadow: "0 1px 3px rgba(0,0,0,.3)",
        }} />
      </span>
    </button>
  );
}

export default function Nav({ screen, setScreen, setTab, setModal, totalRecordatorios, gymConfig, setConfigScreen, onLogout, darkMode, setDarkMode }) {
  const gymNombre = gymConfig?.nombre || "GymFit Pro";
  const gymLogo   = gymConfig?.logo   || null;

  const sectionStyle = {
    fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", color: darkMode ? "#6e7681" : "#9ca3af",
    padding: "16px 12px 6px", display: "block",
  };
  const dividerStyle = { height: 1, background: darkMode ? "#21262d" : "#e5e7eb", margin: "10px 0" };

  return (
    <nav className="gym-nav">

      {/* ── Cabecera gym ── */}
      <div className="gym-nav-gym">
        <div className="gym-nav-gym-logo">
          {gymLogo
            ? <img src={gymLogo} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            : "💪"
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <span className="gym-nav-gym-name">{gymNombre}</span>
          <span className="gym-nav-gym-sub">Panel Admin</span>
        </div>
      </div>

      {/* ── Sección Menú ── */}
      <span className="gym-nav-section" style={sectionStyle}>Menú</span>

      {NAV_ITEMS.map((item, i) => (
        <NavBtn
          key={i}
          label={item.label}
          icon={item.icon}
          active={screen === item.s}
          badge={item.hasBadge}
          totalRecordatorios={totalRecordatorios}
          darkMode={darkMode}
          onClick={() => { setScreen(item.s); if (item.s === "dashboard") setTab(0); }}
        />
      ))}

      {/* Botón Agregar desktop */}
      <button
        className="desktop-only"
        onClick={() => setModal("quickAdd")}
        style={{
          width: "100%", marginTop: 10, padding: "11px 16px",
          border: "none", borderRadius: 10, cursor: "pointer",
          background: "linear-gradient(135deg,#6c63ff,#e040fb)",
          display: "flex", alignItems: "center", gap: 10,
          fontFamily: "inherit", boxShadow: "0 4px 18px rgba(108,99,255,.3)",
        }}
      >
        <span style={{ color: "#fff", display: "flex" }}>{IC.plus}</span>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Agregar</span>
      </button>

      {/* ── Sección Herramientas ── */}
      <div className="gym-nav-divider" style={dividerStyle} />
      <span className="gym-nav-section" style={sectionStyle}>Herramientas</span>

      <NavBtn
        label="Estadísticas"
        icon={IC.stats}
        active={screen === "estadisticas"}
        darkMode={darkMode}
        onClick={() => setScreen("estadisticas")}
      />

      {/* ── NUEVO: Control de Acceso / Scanner ─────────────────────────────── */}
      <NavBtn
        label="Control de Acceso"
        icon={IC.qr}
        active={screen === "scanner"}
        darkMode={darkMode}
        accentColor="#059669"   /* Verde — indica que es acceso físico */
        onClick={() => setScreen("scanner")}
      />
      {/* ── /NUEVO ──────────────────────────────────────────────────────────── */}

      <div className="gym-nav-spacer" />
      <div className="gym-nav-divider" style={dividerStyle} />

      {/* Toggle dark/light */}
      <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />

      <NavBtn
        label="Configuración"
        icon={IC.gear}
        active={false}
        darkMode={darkMode}
        onClick={() => setConfigScreen(true)}
      />

      <button
        className="desktop-only"
        onClick={onLogout}
        style={{
          width: "100%", border: "none", cursor: "pointer", marginTop: 2,
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px", borderRadius: 10,
          background: "transparent", transition: "background .15s", fontFamily: "inherit",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,.08)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ color: "#f43f5e", display: "flex" }}>{IC.logout}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "#f43f5e" }}>Cerrar sesión</span>
      </button>

      {/* ══ MOBILE bottom bar ══ */}
      {NAV_ITEMS.map((item, i) => (
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

      {/* Scanner en mobile nav (icono QR) */}
      <button
        className="gym-nav-btn mobile-only"
        onClick={() => setScreen("scanner")}
      >
        <span style={{ color: screen === "scanner" ? "#22c55e" : "#6e7681", display: "flex" }}>{IC.qr}</span>
        <span className={"gym-nav-label" + (screen === "scanner" ? " active" : "")}
          style={{ color: screen === "scanner" ? "#22c55e" : undefined }}>
          Acceso
        </span>
      </button>

      {/* ⊕ central mobile */}
      <button className="gym-nav-btn mobile-only" onClick={() => setModal("quickAdd")}>
        <div style={{
          width: 46, height: 46, borderRadius: 15, marginTop: -16,
          background: "linear-gradient(135deg,#6c63ff,#e040fb)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 18px rgba(108,99,255,.4)",
        }}>{IC.plus}</div>
      </button>

    </nav>
  );
}
