// Nav.jsx — Sidebar desktop / bottom nav mobile

const IC = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  members: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  cash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0"/><path d="M6 12h.01M18 12h.01"/></svg>,
  stats: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gear: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  chevron: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

const NAV_ITEMS = [
  { label: "Inicio",   icon: IC.home,    s: "dashboard" },
  { label: "Miembros", icon: IC.members, s: "miembros"  },
  { label: "Mensajes", icon: IC.chat,    s: "mensajes", hasBadge: true },
  { label: "Caja",     icon: IC.cash,    s: "caja"      },
];

const s = {
  section: {
    fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
    textTransform: "uppercase", color: "#6e7681",
    padding: "20px 12px 6px", display: "block",
  },
  btn: {
    width: "100%", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 10,
    background: "transparent", transition: "background .15s",
    position: "relative", fontFamily: "inherit",
  },
  btnActive: {
    background: "#2563eb",
  },
  label: {
    fontSize: 14, fontWeight: 500, color: "#8b949e",
    flex: 1, textAlign: "left",
  },
  labelActive: {
    color: "#ffffff", fontWeight: 600,
  },
  icon: { color: "#6e7681", display: "flex", flexShrink: 0 },
  iconActive: { color: "#ffffff" },
  divider: { height: 1, background: "#21262d", margin: "12px 0" },
};

function NavBtn({ label, icon, active, onClick, badge, totalRecordatorios }) {
  return (
    <button
      style={{ ...s.btn, ...(active ? s.btnActive : {}) }}
      onClick={onClick}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#161b22"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ ...s.icon, ...(active ? s.iconActive : {}) }}>{icon}</span>
      <span style={{ ...s.label, ...(active ? s.labelActive : {}) }}>{label}</span>
      {badge && totalRecordatorios > 0 && (
        <span className="wa-pulse" style={{ width: 8, height: 8, background: "#f43f5e", borderRadius: "50%", flexShrink: 0 }} />
      )}
      {active && <span style={{ color: "#fff", display: "flex", opacity: 0.7 }}>{IC.chevron}</span>}
    </button>
  );
}

export default function Nav({ screen, setScreen, setTab, setModal, totalRecordatorios, gymConfig, setConfigScreen, onLogout }) {
  const gymNombre = gymConfig?.nombre || "GymFit Pro";
  const gymLogo   = gymConfig?.logo   || null;

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

      {/* ── DESKTOP: secciones completas ── */}
      <span className="gym-nav-section" style={{ paddingTop: 8 }}>Menú</span>

      {NAV_ITEMS.map((item, i) => (
        <NavBtn
          key={i}
          label={item.label}
          icon={item.icon}
          active={screen === item.s}
          badge={item.hasBadge}
          totalRecordatorios={totalRecordatorios}
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
          fontFamily: "inherit", boxShadow: "0 4px 18px rgba(108,99,255,.35)",
        }}
      >
        <span style={{ color: "#fff", display: "flex" }}>{IC.plus}</span>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Agregar</span>
      </button>

      <div className="gym-nav-divider" />
      <span className="gym-nav-section">Herramientas</span>

      <NavBtn
        label="Estadísticas"
        icon={IC.stats}
        active={screen === "estadisticas"}
        onClick={() => setScreen("estadisticas")}
      />

      <div className="gym-nav-spacer" />
      <div className="gym-nav-divider" />

      <NavBtn
        label="Configuración"
        icon={IC.gear}
        active={false}
        onClick={() => setConfigScreen(true)}
      />

      <button
        className="desktop-only"
        onClick={onLogout}
        style={{ ...s.btn, marginTop: 2 }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,.08)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ color: "#f43f5e", display: "flex" }}>{IC.logout}</span>
        <span style={{ ...s.label, color: "#f43f5e" }}>Cerrar sesión</span>
      </button>

      {/* ── MOBILE: bottom bar ── */}
      {NAV_ITEMS.map((item, i) => (
        <button
          key={"m"+i}
          className="gym-nav-btn mobile-only"
          onClick={() => { setScreen(item.s); if (item.s === "dashboard") setTab(0); }}
        >
          <span style={{ ...s.icon, ...(screen === item.s ? { color: "#a78bfa" } : {}) }}>{item.icon}</span>
          <span className={"gym-nav-label" + (screen === item.s ? " active" : "")}>{item.label}</span>
          {item.hasBadge && totalRecordatorios > 0 && (
            <span className="wa-pulse" style={{ position: "absolute", top: 4, right: "50%", marginRight: -18, width: 7, height: 7, background: "#f43f5e", borderRadius: "50%", border: "2px solid #0d1117" }} />
          )}
        </button>
      ))}

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
