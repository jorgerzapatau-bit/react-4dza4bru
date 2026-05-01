import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { fmt, fmtDate, today, todayISO, parseDate, calcEdad } from "../utils/dateUtils";
import { getMembershipInfo, calcVence } from "../utils/membershipUtils";
import { diasParaVencer } from "../utils/dateUtils";
import { diasParaCumple } from "../utils/dateUtils";
import { DEFAULT_PLANES, DEFAULT_RECORDATORIO_TPL, CAT_ING, CAT_GAS, getCatIng, getCatGas, getCatIcon, getIsDojo } from "../utils/constants";
import { esMenorDeEdad, validarTutor } from "../utils/tutorUtils";
import TutorFields from "./TutorFields";

// Components
import Nav from "./Nav";
import { Badge, Btn, Inp, Modal } from "./UI";
import PhotoModal from "./PhotoModal";
import MemberDetailModal from "../modals/MemberDetailModal";
import EditTxModal from "../modals/EditTxModal";
import CalendarioEventos from "../modals/CalendarioEventos";
import NuevoMiembroWizard from "../modals/NuevoMiembroWizard";
import MensajesScreen from "../screens/MensajesScreen";
import TiendaScreen from "../screens/TiendaScreen";
// Al tope con los otros imports
import ClasesScreen from "../screens/ClasesScreen";
import InstructoresScreen from "../screens/InstructoresScreen";

// Screens
import DashboardScreen from "../screens/AdminDashboardScreen";
import FinanzasScreen from "../screens/FinanzasScreen";
import MiembrosScreen from "../screens/MiembrosScreen";
import EstadisticasScreen from "../screens/EstadisticasScreen";
import CajaScreen from "../screens/CajaScreen";
import ConfigScreen from "../screens/ConfigScreen";
import ScannerScreen from "../screens/ScannerScreen";
import MembresiasScreen from "../screens/MembresiasScreen";

// ── Inline Dashboard screen (kept here since it's tightly coupled to GymApp state) ──
// If you want to extract it later, follow the same pattern as the other screens.

export default function GymApp({ gymId: GYM_ID, currentUser, userRole = "admin", onLogout }) {

  // ── Role helpers ──
  const isOwner = userRole === "owner";

  // ── State ──
  const [screen, setScreen] = useState("dashboard");
  const [mensajesMiembro, setMensajesMiembro] = useState(null);
  const [modoMensajes, setModoMensajes] = useState(null);
  const WA_QUEUE_KEY = `gymfit_wa_queue_${GYM_ID}`;
  const [waQueue, setWaQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`gymfit_wa_queue_${GYM_ID}`) || "[]"); } catch(e) { return []; }
  });
  const [loading, setLoading] = useState(true);
  const [gymConfig, setGymConfig] = useState(null);
  const [configScreen, setConfigScreen] = useState(false);
  const [formCfg, setFormCfg] = useState({ nombre: "", slogan: "", telefono: "", direccion: "", planes: DEFAULT_PLANES, propietario_nombre: "", propietario_titulo: "", transferencia_clabe: "", transferencia_titular: "", transferencia_banco: "", recordatorio_tpl: DEFAULT_RECORDATORIO_TPL, tipo_negocio: "gimnasio", termino_miembros: "" });
  const [tab, setTab] = useState(0);
  const [miembros, setMiembros] = useState([]);
  const [txs, setTxs] = useState([]);
  const [planesMembresia, setPlanesMembresia] = useState([]);
  const [modal, setModal] = useState(null);
  const [selM, setSelM] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [viewMode, setViewMode] = useState("lista");
  const [busqueda, setBusqueda] = useState("");
  const [statsTab, setStatsTab] = useState(0);
  const [statsChartType, setStatsChartType] = useState("bar");
  const [ahora, setAhora] = useState(new Date());
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('gymfit-theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('gymfit-theme', darkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  const [fI, setFI] = useState({ cat: "Clases extras", desc: "", monto: "", fecha: todayISO() });
  const [fG, setFG] = useState({ cat: "Nómina", desc: "", monto: "", fecha: todayISO() });
  const [fM, setFM] = useState(() => ({
    nombre: "",
    tel: "",
    foto: null,
    sexo: "",
    fecha_nacimiento: "",
    fecha_incorporacion: "",
    notas: "",
    clasePrueba: false,
    fechaPrueba: todayISO(),
    // ── Tutor (Fase 1) ──
    tutor_nombre: "",
    tutor_telefono: "",
    tutor_parentesco: "",
  }));
  const [fMTutorErrores, setFMTutorErrores] = useState({});
  const [showFotoModal, setShowFotoModal] = useState(false);

  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 1000); return () => clearInterval(t); }, []);

  const [filtroDesde, setFiltroDesde] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; });
  const [filtroHasta, setFiltroHasta] = useState(todayISO);
  const [selMes, setSelMes] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const MESES_LABEL = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesLabel = `${MESES_LABEL[selMes.month]} ${selMes.year}`;
  const mesAnteriorLabel = (() => { const m = selMes.month === 0 ? 11 : selMes.month - 1; const y = selMes.month === 0 ? selMes.year - 1 : selMes.year; return `${MESES_LABEL[m]} ${y}`; })();

  const activePlanes = (gymConfig?.planes || DEFAULT_PLANES).filter(p => p.activo !== false);
  const PLANES_ACTIVOS = activePlanes.map(p => p.nombre);
  const PLAN_PRECIO_ACTIVO = Object.fromEntries(activePlanes.map(p => [p.nombre, p.precio]));

  // ── Modo Dojo ──
  const isDojo = getIsDojo(gymConfig);
  const CAT_ING_ACTIVO = getCatIng(gymConfig);
  const CAT_GAS_ACTIVO = getCatGas(gymConfig);
  const CAT_ICON_ACTIVO = getCatIcon(gymConfig);
  // Término singular configurable (Alumno / Miembro)
  const terminoSingular = (gymConfig?.termino_miembros || (isDojo ? "Alumnos" : "Miembros")).replace(/s$/, "");

  const nowForCurr = new Date();
  const isCurrentMonth = selMes.year === nowForCurr.getFullYear() && selMes.month === nowForCurr.getMonth();

  const navMes = (dir) => {
    const now = new Date();
    const cur = selMes;
    let m = cur.month + dir;
    let y = cur.year;
    if (m > 11) { m = 0; y += 1; }
    if (m < 0)  { m = 11; y -= 1; }
    if (y > now.getFullYear() + 1) return;
    setSelMes({ year: y, month: m });
  };

  const txsMes = useMemo(() => txs.filter(t => {
    const d = parseDate(t.fecha);
    if (!d) return false;
    return d.getFullYear() === selMes.year && d.getMonth() === selMes.month;
  }), [txs, selMes]);

  const txsPrevMes = useMemo(() => txs.filter(t => {
    const d = parseDate(t.fecha);
    if (!d) return false;
    const pm = selMes.month === 0 ? 11 : selMes.month - 1;
    const py = selMes.month === 0 ? selMes.year - 1 : selMes.year;
    return d.getFullYear() === py && d.getMonth() === pm;
  }), [txs, selMes]);

  // ── Load data from Supabase ──
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const gym = await supabase.getGym(GYM_ID);
        if (gym) {
          const lsKey = `gymfit_cfg_${GYM_ID}`;
          let lsData = {};
          try { lsData = JSON.parse(localStorage.getItem(lsKey) || "{}"); } catch(e) {}
          setGymConfig({ ...gym, ...lsData });
          setFormCfg({ nombre: gym.nombre || "", slogan: gym.slogan || "", telefono: gym.telefono || "", direccion: gym.direccion || "", zona_horaria: gym.zona_horaria || "America/Merida", logo: gym.logo || null, planes: gym.planes || DEFAULT_PLANES, propietario_nombre: gym.propietario_nombre || "", propietario_titulo: gym.propietario_titulo || "", transferencia_clabe: gym.transferencia_clabe || "", transferencia_titular: gym.transferencia_titular || "", transferencia_banco: gym.transferencia_banco || "", recordatorio_tpl: gym.recordatorio_tpl || DEFAULT_RECORDATORIO_TPL, tipo_negocio: gym.tipo_negocio || "gimnasio", termino_miembros: gym.termino_miembros || "" });
          // Si el gym no tiene nombre configurado todavía → mostrar pantalla de configuración
          if (!gym.nombre) {
            setLoading(false);
            setConfigScreen(true);
            return;
          }
        } else {
          setLoading(false);
          setConfigScreen(true);
          return;
        }
        const db = await supabase.from("miembros");
        const mData = await db.select(GYM_ID);
        const txDb = await supabase.from("transacciones");
        const txData = await txDb.select(GYM_ID);
        setTxs(txData.map(t => ({ id: t.id, tipo: t.tipo, categoria: t.categoria, desc: t.descripcion, monto: t.monto, fecha: t.fecha, miembroId: t.miembro_id || null })));
        setMiembros(mData.filter(m => !m.archivado).map(m => ({ id: m.id, nombre: m.nombre, tel: m.tel || "", foto: m.foto || null, fecha_incorporacion: m.fecha_incorporacion || null, sexo: m.sexo || null, fecha_nacimiento: m.fecha_nacimiento || null, notas: m.notas || "", congelado: m.congelado || false, fecha_descongelar: m.fecha_descongelar || null, dias_congelados: m.dias_congelados || 0, tutor_nombre: m.tutor_nombre || null, tutor_telefono: m.tutor_telefono || null, tutor_parentesco: m.tutor_parentesco || null, beca: m.beca || false,
          // ── DOJO ──
          grado_actual: m.grado_actual || null, fecha_ultimo_examen: m.fecha_ultimo_examen || null, proximo_objetivo: m.proximo_objetivo || null,
        })));
        try {
          const dbPM = await supabase.from("planes_membresia");
          const pmData = await dbPM.select(GYM_ID);
          if (pmData) setPlanesMembresia(pmData.filter(p => p.activo !== false));
        } catch(e) { /* tabla puede no existir aún */ }
      } catch(e) {
        console.error("Error loading data:", e);
      }
      setLoading(false);
    }
    loadData();
  }, [GYM_ID]);

  // ── Derived metrics ──
  const totalIng = useMemo(() => txsMes.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0), [txsMes]);
  const totalGas = useMemo(() => txsMes.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0), [txsMes]);
  const utilidad = totalIng - totalGas;
  const prevIng = useMemo(() => txsPrevMes.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0), [txsPrevMes]);
  const prevGas = useMemo(() => txsPrevMes.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0), [txsPrevMes]);
  const prevUtil = prevIng - prevGas;
  const crecIng = prevIng > 0 ? (((totalIng - prevIng) / prevIng) * 100).toFixed(1) : null;
  const crecGas = prevGas > 0 ? (((totalGas - prevGas) / prevGas) * 100).toFixed(1) : null;
  const crecUtil = prevUtil !== 0 ? (((utilidad - prevUtil) / Math.abs(prevUtil)) * 100).toFixed(1) : null;
  const mActivos = miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length;
  const mHombres = miembros.filter(m => m.sexo === "Masculino").length;
  const mMujeres = miembros.filter(m => m.sexo === "Femenino").length;
  const mSinSexo = miembros.filter(m => !m.sexo).length;

  const cumplesPróximos = useMemo(() => miembros.map(m => ({ ...m, diasCumple: diasParaCumple(m.fecha_nacimiento) })).filter(m => m.diasCumple !== null && m.diasCumple <= 7).sort((a, b) => a.diasCumple - b.diasCumple), [miembros]);

  const membresiasPorVencer = useMemo(() => miembros.map(m => {
    const info = getMembershipInfo(m.id, txs, m);
    if (info.estado !== "Activo") return null;
    const dias = diasParaVencer(info.vence);
    if (dias === null || dias > 5 || dias < 0) return null;
    return { ...m, diasVence: dias, vence: info.vence, plan: info.plan };
  }).filter(Boolean).sort((a, b) => a.diasVence - b.diasVence), [miembros, txs]);

  const miembrosSinSexo = useMemo(() => miembros.filter(m => !m.sexo), [miembros]);

  const totalRecordatorios = useMemo(() => {
    const hoyKeyLocal = new Date().toISOString().slice(0, 10);
    const enviados = (gymConfig?.wa_enviados || {})[hoyKeyLocal] || {};
    return membresiasPorVencer.filter(m => !enviados[m.id]).length;
  }, [membresiasPorVencer, gymConfig]);

  // ── Push Notifications ──
  const notifCheckDoneKey = `gymfit_notif_check_${GYM_ID}`;

  const solicitarPermisosNotif = async () => {
    if (!("Notification" in window) || !navigator.serviceWorker) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  };

  const dispararNotificacionVencimientos = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !gymConfig) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const lastCheck = localStorage.getItem(notifCheckDoneKey);
    if (lastCheck === hoy) return;
    localStorage.setItem(notifCheckDoneKey, hoy);
    const miembrosVencenManana = membresiasPorVencer.filter(m => m.diasVence === 1);
    if (miembrosVencenManana.length === 0) return;
    const permiso = await solicitarPermisosNotif();
    if (!permiso) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "CHECK_VENCIMIENTOS", miembrosVencenManana: miembrosVencenManana.map(m => ({ id: m.id, nombre: m.nombre })), gymNombre: gymConfig?.nombre || "Gym" });
  }, [membresiasPorVencer, gymConfig, notifCheckDoneKey]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (event) => { if (event.data?.type === "OPEN_MENSAJES") { setScreen("mensajes"); setModoMensajes("vencimientos"); } };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    if (!loading && miembros.length > 0 && gymConfig) dispararNotificacionVencimientos();
  }, [loading, miembros.length, gymConfig?.nombre]);

  // ── CRUD operations ──
  const addIng = async () => {
    if (!fI.desc || !fI.monto) return;
    const db = await supabase.from("transacciones");
    const saved = await db.insert({ gym_id: GYM_ID, tipo: "ingreso", categoria: fI.cat, descripcion: fI.desc, monto: Number(fI.monto), fecha: fmtDate(fI.fecha) || today() });
    if (saved) setTxs(p => [{ id: saved.id, tipo: "ingreso", categoria: fI.cat, descripcion: fI.desc, monto: Number(fI.monto), fecha: fmtDate(fI.fecha) || today() }, ...p]);
    setFI({ cat: "Clases extras", desc: "", monto: "", fecha: todayISO() }); setModal(null); setScreen("dashboard"); setTab(0);
  };

  const addGas = async () => {
    if (!fG.desc || !fG.monto) return;
    const db = await supabase.from("transacciones");
    const saved = await db.insert({ gym_id: GYM_ID, tipo: "gasto", categoria: fG.cat, descripcion: fG.desc, monto: Number(fG.monto), fecha: fmtDate(fG.fecha) || today() });
    if (saved) setTxs(p => [{ id: saved.id, tipo: "gasto", categoria: fG.cat, descripcion: fG.desc, monto: Number(fG.monto), fecha: fmtDate(fG.fecha) || today() }, ...p]);
    setFG({ cat: "Nómina", desc: "", monto: "", fecha: todayISO() }); setModal(null); setScreen("dashboard"); setTab(0);
  };

  const fMEsMenor = esMenorDeEdad(fM.fecha_nacimiento);

  const addM = async (wizardFM) => {
    // wizardFM viene del wizard; si no, usa el estado fM (legado)
    const data = wizardFM || fM;
    if (!data.nombre) return;

    const esMenor = esMenorDeEdad(data.fecha_nacimiento);

    // Validar tutor si el miembro es menor de edad
    if (esMenor && !wizardFM) {
      const { valido, errores } = validarTutor(data);
      if (!valido) {
        setFMTutorErrores(errores);
        return;
      }
    }
    setFMTutorErrores({});

    // ── Estado inicial: Pendiente si pago por transferencia ──
    const estadoInicial = data.estado || (data.pago_pendiente ? "Pendiente" : "Activo");
    const qrToken       = data.qr_token || null;

    const mDb = await supabase.from("miembros");
    const savedM = await mDb.insert({
      gym_id: GYM_ID,
      nombre: data.nombre,
      tel: data.tel || "",
      foto: data.foto || null,
      fecha_incorporacion: data.fecha_incorporacion || todayISO(),
      sexo: data.sexo || null,
      fecha_nacimiento: data.fecha_nacimiento || null,
      notas: data.notas || null,
      estado: estadoInicial,
      qr_token: qrToken,
      tutor_nombre:     esMenor ? (data.tutor_nombre || null)     : null,
      tutor_telefono:   esMenor ? (data.tutor_telefono || null)   : null,
      tutor_parentesco: esMenor ? (data.tutor_parentesco || null) : null,
    });
    if (savedM) {
      setMiembros(p => [{
        id: savedM.id,
        nombre: data.nombre,
        tel: data.tel || "",
        foto: data.foto || null,
        fecha_incorporacion: data.fecha_incorporacion || todayISO(),
        sexo: data.sexo || null,
        fecha_nacimiento: data.fecha_nacimiento || null,
        notas: data.notas || "",
        congelado: false,
        fecha_descongelar: null,
        dias_congelados: 0,
        beca: data.beca || false,
        estado: estadoInicial,
        qr_token: qrToken,
        tutor_nombre:     esMenor ? (data.tutor_nombre || null) : null,
        tutor_telefono:   esMenor ? (data.tutor_telefono || null) : null,
        tutor_parentesco: esMenor ? (data.tutor_parentesco || null) : null,
      }, ...p]);

      // ── Registrar membresía inicial si se eligió un plan y NO es pendiente ──
      if (data.plan && estadoInicial !== "Pendiente") {
        const fechaInicio = data.fecha_incorporacion || todayISO();
        const CICLO_MESES_GM = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
        const planObj3 = data.planData;
        let venceISO = null;
        if (planObj3) {
          const meses3 = planObj3.meses != null ? planObj3.meses : CICLO_MESES_GM[planObj3.ciclo_renovacion];
          if (meses3) {
            const [y3, mo3, d3] = fechaInicio.split("-").map(Number);
            const v3 = new Date(y3, mo3 - 1 + meses3, d3);
            venceISO = `${v3.getFullYear()}-${String(v3.getMonth()+1).padStart(2,"0")}-${String(v3.getDate()).padStart(2,"0")}`;
          }
        } else {
          try { venceISO = calcVence(fechaInicio, data.plan); } catch(e) {}
        }
        const monto = Number(data.monto) || 0;
        const formaPago = data.formaPago || "Efectivo";
        const descTx = `Renovación ${data.plan} - ${data.nombre} [${formaPago}]${venceISO ? ` (vence:${venceISO})` : ""}`;
        const tDb2 = await supabase.from("transacciones");
        const savedTx = await tDb2.insert({
          gym_id: GYM_ID, tipo: "ingreso", categoria: "Membresías",
          descripcion: descTx, monto, fecha: fechaInicio,
          miembro_id: savedM.id,
        });
        if (savedTx) setTxs(p => [{
          id: savedTx.id, tipo: "ingreso", categoria: "Membresías",
          desc: descTx, descripcion: descTx, monto,
          fecha: fechaInicio, miembroId: savedM.id,
        }, ...p]);
      }

      // ── Si es Pendiente: guardar los datos del plan para cuando confirmen ──
      // (la transacción se registrará al confirmar el pago desde el perfil)

      if (data.clasePrueba) {
        const tDb = await supabase.from("transacciones");
        const fechaPrueba = data.fechaPrueba || todayISO();
        const savedT = await tDb.insert({ gym_id: GYM_ID, tipo: "ingreso", categoria: "Otro", descripcion: `Clase prueba - ${data.nombre}`, monto: 0, fecha: fechaPrueba, miembro_id: savedM.id });
        if (savedT) setTxs(p => [{ id: savedT.id, tipo: "ingreso", categoria: "Otro", desc: `Clase prueba - ${data.nombre}`, descripcion: `Clase prueba - ${data.nombre}`, monto: 0, fecha: fechaPrueba, miembroId: savedM.id }, ...p]);
      }
    }
    setFM({
      nombre: "", tel: "", foto: null, sexo: "", fecha_nacimiento: "",
      fecha_incorporacion: "", notas: "", clasePrueba: false, fechaPrueba: todayISO(),
      tutor_nombre: "", tutor_telefono: "", tutor_parentesco: "",
    });
    setFMTutorErrores({});
    // Only open detalle if called from legacy flow (not from wizard)
    if (!wizardFM) {
      setModal(null);
      if (savedM) {
        setSelM({ id: savedM.id, nombre: data.nombre, tel: data.tel || "", foto: data.foto || null, fecha_incorporacion: data.fecha_incorporacion || todayISO(), sexo: data.sexo || null, fecha_nacimiento: data.fecha_nacimiento || null });
        setModal("detalle");
      }
    }
    // Devolver savedM para que el wizard pueda usar el qr_token real
    return savedM;
  };

  const archiveMiembro = async (id) => {
    const mDb = await supabase.from("miembros");
    await mDb.update(id, { archivado: true });
    setMiembros(p => p.filter(m => m.id !== id));
    setModal(null); setSelM(null);
  };

  const deleteMiembro = async (id) => {
    const txsMiembro = txs.filter(t => String(t.miembroId) === String(id) || String(t.miembro_id) === String(id));
    for (const t of txsMiembro) { const tDb = await supabase.from("transacciones"); await tDb.delete(t.id); }
    setTxs(p => p.filter(t => String(t.miembroId) !== String(id) && String(t.miembro_id) !== String(id)));
    const mDb = await supabase.from("miembros");
    await mDb.delete(id);
    setMiembros(p => p.filter(m => m.id !== id));
    setModal(null); setSelM(null);
  };

  const saveMiembro = async (updated) => {
    setMiembros(p => p.map(m => m.id === updated.id ? updated : m));
    setSelM(updated);
    const db = await supabase.from("miembros");
    await db.update(updated.id, { nombre: updated.nombre, tel: updated.tel, foto: updated.foto || null, fecha_incorporacion: updated.fecha_incorporacion, sexo: updated.sexo || null, fecha_nacimiento: updated.fecha_nacimiento || null, notas: updated.notas || null, congelado: updated.congelado || false, fecha_descongelar: updated.fecha_descongelar || null, dias_congelados: updated.dias_congelados || 0, tutor_nombre: updated.tutor_nombre || null, tutor_telefono: updated.tutor_telefono || null, tutor_parentesco: updated.tutor_parentesco || null, beca: updated.beca || false });
  };

  const saveExtraCfg = (patch) => {
    const lsKey = `gymfit_cfg_${GYM_ID}`;
    let lsData = {};
    try { lsData = JSON.parse(localStorage.getItem(lsKey) || "{}"); } catch(e) {}
    try { localStorage.setItem(lsKey, JSON.stringify({ ...lsData, ...patch })); } catch(e) {}
  };

  const updatePlantillas = async (nuevasPlantillas) => {
    const newCfg = { ...(gymConfig || {}), plantillas_wa: nuevasPlantillas };
    setGymConfig(newCfg);
    saveExtraCfg({ plantillas_wa: nuevasPlantillas });
  };

  const hoyKey = new Date().toISOString().slice(0, 10);
  const recordatoriosEnviados = (gymConfig?.wa_enviados || {})[hoyKey] || {};
  const marcarRecordatorio = (miembroId) => {
    const waEnviados = { ...(gymConfig?.wa_enviados || {}) };
    waEnviados[hoyKey] = { ...(waEnviados[hoyKey] || {}), [miembroId]: true };
    const newCfg = { ...(gymConfig || {}), wa_enviados: waEnviados };
    setGymConfig(newCfg);
    saveExtraCfg({ wa_enviados: waEnviados });
  };

  const saveEditTx = async (updated) => {
    setTxs(p => p.map(t => t.id === updated.id ? { ...t, ...updated } : t));
    setEditTx(null); setModal(null);
    const db = await supabase.from("transacciones");
    const descFinal = updated.desc || updated.descripcion || "-";
    await db.update(updated.id, { categoria: updated.categoria, descripcion: descFinal, monto: updated.monto, fecha: updated.fecha, ...(updated.vence_manual ? { vence_manual: updated.vence_manual } : {}) });
  };

  const deleteEditTx = async (id) => {
    setTxs(txs.filter(t => t.id !== id));
    setEditTx(null); setModal(null);
    const db = await supabase.from("transacciones");
    await db.delete(id);
  };

  const addPago = async (pagoData) => {
    const db = await supabase.from("transacciones");
    const descFinal = pagoData.desc || pagoData.descripcion || "-";
    const saved = await db.insert({ gym_id: GYM_ID, tipo: pagoData.tipo, categoria: pagoData.categoria, descripcion: descFinal, monto: pagoData.monto, fecha: pagoData.fecha, miembro_id: pagoData.miembroId || null });
    if (saved) setTxs(p => [...p, { id: saved.id, tipo: pagoData.tipo, categoria: pagoData.categoria, desc: descFinal, descripcion: descFinal, monto: pagoData.monto, fecha: pagoData.fecha, miembroId: pagoData.miembroId || null, miembro_id: pagoData.miembroId || null, vence_manual: pagoData.vence_manual || null }]);
  };

  const TABS = ["Dashboard", "Ingresos", "Gastos", "Historial"];

  // ── Render ──
  return (
    <div className="gym-root" data-theme={darkMode ? "dark" : "light"}>

      {/* ═══ SIDEBAR NAV ═══ */}
      {!configScreen && !loading && (
        <Nav
          screen={screen}
          setScreen={setScreen}
          tab={tab}
          setTab={setTab}
          setModal={setModal}
          totalRecordatorios={totalRecordatorios}
          gymConfig={gymConfig}
          setConfigScreen={setConfigScreen}
          onLogout={onLogout}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          isOwner={isOwner}
        />
      )}

      {/* ═══ CONTENIDO PRINCIPAL ═══ */}
      <div className="gym-content">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
          @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
          @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
          @keyframes slideRight{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
          .card{animation:fadeUp .35s ease both;}
          .card:nth-child(2){animation-delay:.07s}.card:nth-child(3){animation-delay:.14s}.card:nth-child(4){animation-delay:.21s}
          .rh:hover{background:rgba(255,255,255,.06)!important;transition:background .2s;}
          input::placeholder{color:#3d3d5c;}
          select option{background:#191928;}
          button:active{opacity:.75;}
          .wa-pulse{animation:pulse 2s infinite;}
        `}</style>

        {/* ═══ MENSAJES ═══ */}
        {!loading && !configScreen && screen === "mensajes" && (
          <MensajesScreen miembros={miembros} txs={txs} gymConfig={gymConfig} gymId={GYM_ID}
            onBack={() => { setMensajesMiembro(null); setModoMensajes(null); setScreen("dashboard"); }}
            onUpdatePlantillas={updatePlantillas} miembroInicial={mensajesMiembro} modoInicial={modoMensajes}
            recordatoriosEnviados={recordatoriosEnviados} onMarcarRecordatorio={marcarRecordatorio}
            waQueue={waQueue}
            onUpdateWaQueue={(newQueue) => {
              setWaQueue(newQueue);
              try { localStorage.setItem(WA_QUEUE_KEY, JSON.stringify(newQueue)); } catch(e) {}
            }}
          />
        )}

        {!loading && !configScreen && screen === "clases" && (
          <ClasesScreen
            gymId={GYM_ID}
            miembros={miembros}
            txs={txs}
            gymConfig={gymConfig}
            onAddTx={addPago}
            isOwner={isOwner}
            canManage={isOwner || userRole === "admin"}
          />
        )}

        {!loading && !configScreen && screen === "instructores" && (
          <InstructoresScreen
            gymId={GYM_ID}
            isOwner={isOwner}
          />
        )}

        {/* ═══ LOADING ═══ */}
        {loading && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ width: 60, height: 60, borderRadius: 20, background: isDojo ? "linear-gradient(135deg,#1e1b4b,#4c1d95)" : "linear-gradient(135deg,#6c63ff,#e040fb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: isDojo ? "0 8px 32px rgba(76,29,149,.5)" : "0 8px 32px rgba(108,99,255,.4)" }}>{isDojo ? "🥋" : "💪"}</div>
            <p style={{ color: "#a78bfa", fontSize: 14, fontWeight: 600 }}>{isDojo ? `Cargando ${gymConfig?.nombre || "Dojo"}...` : "Cargando GymFit Pro..."}</p>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#6c63ff,#e040fb)", animation: "slideRight 1s infinite", borderRadius: 2 }} />
            </div>
          </div>
        )}

        {/* ═══ CONFIG ═══ */}
        {!loading && configScreen && (
          <ConfigScreen
            gymConfig={gymConfig}
            gymConfigRef={GYM_ID}
            formCfg={formCfg}
            setFormCfg={setFormCfg}
            setGymConfig={setGymConfig}
            setConfigScreen={setConfigScreen}
          />
        )}

        {/* ═══ DASHBOARD (Admin) ═══ */}
        {!loading && !configScreen && screen === "dashboard" && <DashboardScreen
          gymConfig={gymConfig}
          ahora={ahora}
          miembros={miembros}
          txs={txs}
          setScreen={setScreen}
          setSelM={setSelM}
          setModal={setModal}
          setFiltroEstado={setFiltroEstado}
          gymId={GYM_ID}
          darkMode={darkMode}
        />}

        {/* ═══ FINANZAS (solo owner) ═══ */}
        {!loading && !configScreen && isOwner && screen === "finanzas" && <FinanzasScreen
          gymConfig={gymConfig}
          ahora={ahora}
          utilidad={utilidad}
          totalIng={totalIng}
          totalGas={totalGas}
          crecUtil={crecUtil}
          crecIng={crecIng}
          crecGas={crecGas}
          mesLabel={mesLabel}
          mesAnteriorLabel={mesAnteriorLabel}
          isCurrentMonth={isCurrentMonth}
          navMes={navMes}
          tab={tab}
          setTab={setTab}
          txsMes={txsMes}
          txs={txs}
          miembros={miembros}
          mActivos={mActivos}
          mHombres={mHombres}
          mMujeres={mMujeres}
          mSinSexo={mSinSexo}
          miembrosSinSexo={miembrosSinSexo}
          cumplesPróximos={cumplesPróximos}
          membresiasPorVencer={membresiasPorVencer}
          totalRecordatorios={totalRecordatorios}
          recordatoriosEnviados={recordatoriosEnviados}
          marcarRecordatorio={marcarRecordatorio}
          setScreen={setScreen}
          setModal={setModal}
          setSelM={setSelM}
          setFiltroEstado={setFiltroEstado}
          setConfigScreen={setConfigScreen}
          onLogout={onLogout}
          filtroDesde={filtroDesde}
          setFiltroDesde={setFiltroDesde}
          filtroHasta={filtroHasta}
          setFiltroHasta={setFiltroHasta}
          setEditTx={setEditTx}
          isOwner={isOwner}
        />}

        {/* ═══ MIEMBROS ═══ */}
        {/* ═══ MIEMBROS — lista ═══ */}
        {!loading && !configScreen && screen === "miembros" && !selM && (
          <MiembrosScreen
            miembros={miembros}
            txs={txs}
            filtroEstado={filtroEstado}
            setFiltroEstado={setFiltroEstado}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setSelM={setSelM}
            setModal={setModal}
            setScreen={setScreen}
            activePlanes={activePlanes}
            setFM={setFM}
            gymConfig={gymConfig}
          />
        )}

        {/* ═══ MIEMBROS — detalle (reemplaza la lista, sin overlay) ═══ */}
        {!loading && !configScreen && screen === "miembros" && selM && (
          <MemberDetailModal
            m={selM} txs={txs}
            onClose={() => { setSelM(null); setModal(null); }}
            onSave={saveMiembro} onToggleEstado={() => {}} onAddPago={addPago}
            onDone={() => { setSelM(null); setModal(null); }}
            planesActivos={PLANES_ACTIVOS}
            planPrecioActivo={PLAN_PRECIO_ACTIVO} gymConfig={gymConfig}
            onEditTx={tx => { setEditTx(tx); setModal("editTx"); }}
            onUpdatePlantillas={updatePlantillas}
            onDelete={deleteMiembro}
            onGoToMensajes={(m) => { setMensajesMiembro(m); setModoMensajes("mensajes"); setScreen("mensajes"); setSelM(null); setModal(null); }}
            gymId={GYM_ID}
            onMemberUpdate={(updated) => setMiembros(prev => prev.map(x => x.id === updated.id ? updated : x))}
            planesMembresia={planesMembresia}
            isDojo={isDojo}
          />
        )}

        {/* ═══ MEMBRESÍAS ═══ */}
        {!loading && !configScreen && screen === "membresias" && (
          <MembresiasScreen
            gymId={GYM_ID}
            gymConfig={gymConfig}
            miembros={miembros}
            txs={txs}
            isOwner={isOwner}
          />
        )}

        {/* ═══ ESTADÍSTICAS ═══ (solo owner) */}
        {!loading && !configScreen && isOwner && screen === "estadisticas" && (
          <EstadisticasScreen
            txs={txs}
            miembros={miembros}
            gymConfig={gymConfig}
            statsTab={statsTab}
            setStatsTab={setStatsTab}
            statsChartType={statsChartType}
            setStatsChartType={setStatsChartType}
            selMes={selMes}
            setSelMes={setSelMes}
            setScreen={setScreen}
            setModal={setModal}
            MESES_LABEL={MESES_LABEL}
          />
        )}

        {/* ═══ CAJA ═══ */}
        {!loading && !configScreen && screen === "caja" && (
          <CajaScreen txs={txs} miembros={miembros} gymConfig={gymConfig} onBack={() => setScreen("dashboard")} isOwner={isOwner} />
        )}

        {/* ═══ SCANNER / CONTROL DE ACCESO ═══ */}
        {!loading && !configScreen && screen === "scanner" && (
          <ScannerScreen
            gymId={GYM_ID}
            miembros={miembros}
            txs={txs}
            darkMode={darkMode}
          />
        )}

        {/* ═══ TIENDA & RESERVAS ═══ */}
        {!loading && !configScreen && screen === "tienda" && (
          <TiendaScreen
            gymId={GYM_ID}
            miembros={miembros}
            txs={txs}
            onBack={() => setScreen("dashboard")}
            onAddTx={async (pagoData) => {
              const db = await supabase.from("transacciones");
              const descFinal = pagoData.descripcion || pagoData.desc || "-";
              const saved = await db.insert({
                gym_id: GYM_ID, tipo: pagoData.tipo, categoria: pagoData.categoria,
                descripcion: descFinal, monto: pagoData.monto, fecha: pagoData.fecha,
                miembro_id: pagoData.miembroId || null,
              });
              if (saved) setTxs(p => [...p, {
                id: saved.id, tipo: pagoData.tipo, categoria: pagoData.categoria,
                desc: descFinal, descripcion: descFinal, monto: pagoData.monto,
                fecha: pagoData.fecha, miembroId: pagoData.miembroId || null,
              }]);
            }}
          />
        )}

        {/* ═══ MODAL CALENDARIO ═══ */}
        {modal === "calendario" && (
          <div style={{ position: "fixed", inset: 0, background: "#13131f", zIndex: 300, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px 0", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setModal(null)} style={{ background: "rgba(255,255,255,.08)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "#fff", fontSize: 18 }}>←</button>
              <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>📅 Calendario</h1>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 40px", minHeight: 0 }}>
              <CalendarioEventos miembros={miembros} txs={txs} getMembershipInfo={getMembershipInfo} onGoToMember={m => { setSelM(m); setModal("detalle"); }} />
            </div>
          </div>
        )}

        {/* ═══ MODALS ═══ */}
        {modal === "quickAdd" && <Modal title="¿Qué deseas agregar?" onClose={() => setModal(null)}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>{[{ label: "Ingreso", icon: "💰", color: "#22d3ee", action: () => setModal("ingreso") }, { label: "Gasto", icon: "💸", color: "#f43f5e", action: () => setModal("gasto") }, { label: "Miembro", icon: "👤", color: "#a78bfa", action: () => { const firstPlan = activePlanes[0] || DEFAULT_PLANES[0]; setFM({ nombre: "", tel: "", plan: firstPlan.nombre, monto: String(firstPlan.precio), foto: null }); setModal("miembro"); } }].map((opt, i) => <button key={i} onClick={opt.action} style={{ background: `${opt.color}15`, border: `1px solid ${opt.color}30`, borderRadius: 18, padding: "20px 0", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><span style={{ fontSize: 28 }}>{opt.icon}</span><span style={{ color: opt.color, fontSize: 13, fontWeight: 700 }}>{opt.label}</span></button>)}</div></Modal>}

        {modal === "ingreso" && <Modal title="💰 Nuevo Ingreso" onClose={() => setModal(null)}><Inp label="Categoría" value={fI.cat} onChange={v => setFI(p => ({ ...p, cat: v }))} options={CAT_ING_ACTIVO} /><Inp label="Descripción" value={fI.desc} onChange={v => setFI(p => ({ ...p, desc: v }))} placeholder="Ej: Clase extra, venta tienda, etc." /><Inp label="Monto ($)" type="number" value={fI.monto} onChange={v => setFI(p => ({ ...p, monto: v }))} placeholder="0.00" /><Inp label="Fecha" type="date" value={fI.fecha} onChange={v => setFI(p => ({ ...p, fecha: v }))} /><Btn full onClick={addIng} color="#22d3ee">Guardar ingreso ✓</Btn></Modal>}

        {modal === "gasto" && <Modal title="💸 Nuevo Gasto" onClose={() => setModal(null)}><Inp label="Categoría" value={fG.cat} onChange={v => setFG(p => ({ ...p, cat: v }))} options={CAT_GAS_ACTIVO} /><Inp label="Descripción" value={fG.desc} onChange={v => setFG(p => ({ ...p, desc: v }))} placeholder="Ej: Pago de nómina" /><Inp label="Monto ($)" type="number" value={fG.monto} onChange={v => setFG(p => ({ ...p, monto: v }))} placeholder="0.00" /><Inp label="Fecha" type="date" value={fG.fecha} onChange={v => setFG(p => ({ ...p, fecha: v }))} /><Btn full onClick={addGas} color="#f43f5e">Guardar gasto ✓</Btn></Modal>}

        {modal === "miembro" && (
          <NuevoMiembroWizard
            onClose={() => { setModal(null); setFM({ nombre: "", tel: "", foto: null, sexo: "", fecha_nacimiento: "", fecha_incorporacion: todayISO(), notas: "", tutor_nombre: "", tutor_telefono: "", tutor_parentesco: "", plan: null, monto: null, formaPago: null }); }}
            onAdd={async (wizardFM, receiptInfo) => {
              setFM(wizardFM);
              const savedM = await addM(wizardFM);
              // El wizard maneja su propio cierre (paso 4 o cierre directo en pendiente)
              // Solo agregar WA queue si pago fue confirmado (no pendiente)
              if (!wizardFM.pago_pendiente) {
                const gym_nombreQ = (gymConfig?.nombre || "el gym");
                const nombre1Q = (receiptInfo?.nombreMiembro || wizardFM.nombre || "").split(" ")[0];
                const isMenorQ = wizardFM.fecha_nacimiento && (() => {
                  const n = new Date(wizardFM.fecha_nacimiento + "T00:00:00");
                  const h = new Date();
                  let eq = h.getFullYear() - n.getFullYear();
                  if (h.getMonth() - n.getMonth() < 0 || (h.getMonth() - n.getMonth() === 0 && h.getDate() < n.getDate())) eq--;
                  return eq < 18;
                })();
                const telQ = (isMenorQ && wizardFM.tutor_telefono) ? wizardFM.tutor_telefono : (wizardFM.tel || "");
                if (receiptInfo?.waMsg && receiptInfo?.tel) {
                  const entry = {
                    id: Date.now().toString(),
                    fechaCreacion: new Date().toISOString(),
                    nombreMiembro: receiptInfo.nombreMiembro || wizardFM.nombre,
                    tel: receiptInfo.tel,
                    msg: receiptInfo.waMsg,
                    plan: receiptInfo.plan,
                    monto: receiptInfo.monto,
                    formaPago: receiptInfo.formaPago,
                    venceISO: receiptInfo.venceISO,
                    comprobantePNG: receiptInfo.comprobantePNG || null,
                    enviado: false,
                    tipo: "nuevo_miembro",
                  };
                  setWaQueue(prev => {
                    const next = [entry, ...prev];
                    try { localStorage.setItem(WA_QUEUE_KEY, JSON.stringify(next)); } catch(e) {}
                    return next;
                  });
                }
              }
              // Navegar al dashboard para mostrar el nuevo movimiento
              setTimeout(() => { setScreen("dashboard"); setTab(0); }, 200);
              return savedM;
            }}
            gymConfig={gymConfig}
            gymId={GYM_ID}
            activePlanes={activePlanes}
            planesMembresia={planesMembresia}
            PhotoModal={PhotoModal}
            isDojo={isDojo}
          />
        )}


                {modal === "editTx" && editTx && (
          <EditTxModal tx={editTx} miembros={miembros} onClose={() => { setEditTx(null); setModal(null); }} onSave={saveEditTx} onDelete={deleteEditTx} gymConfig={gymConfig} />
        )}
      </div>

    </div>
  );
}


