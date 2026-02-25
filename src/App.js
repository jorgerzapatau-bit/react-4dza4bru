import { useState, useMemo } from "react";

function fmt(n) { return "$" + Number(n).toLocaleString("es-MX"); }
function today() {
  const d = new Date();
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}
function uid() { return Math.random().toString(36).slice(2, 9); }

const M_IDS = [uid(), uid(), uid(), uid()];

const INIT_MIEMBROS = [
  { id: M_IDS[0], nombre: "Ana Torres",  plan: "Mensual",    monto: 850,  inicio: "01 Feb 2025", vence: "01 Mar 2025", estado: "Activo",  tel: "9991234567" },
  { id: M_IDS[1], nombre: "Carlos Ruiz", plan: "Trimestral", monto: 2200, inicio: "15 Ene 2025", vence: "15 Abr 2025", estado: "Activo",  tel: "9997654321" },
  { id: M_IDS[2], nombre: "María López", plan: "Anual",       monto: 7500, inicio: "10 Ene 2025", vence: "10 Ene 2026", estado: "Activo",  tel: "9998765432" },
  { id: M_IDS[3], nombre: "Luis Méndez", plan: "Mensual",    monto: 850,  inicio: "05 Ene 2025", vence: "05 Feb 2025", estado: "Vencido", tel: "9994567890" },
];

const INIT_TX = [
  { id: uid(), tipo: "ingreso", categoria: "Membresías",       desc: "Membresía - Ana Torres",  monto: 850,  fecha: "24 Feb 2025", miembroId: M_IDS[0] },
  { id: uid(), tipo: "ingreso", categoria: "Membresías",       desc: "Membresía - Ana Torres",  monto: 850,  fecha: "01 Ene 2025", miembroId: M_IDS[0] },
  { id: uid(), tipo: "ingreso", categoria: "Membresías",       desc: "Membresía - Carlos Ruiz", monto: 2200, fecha: "15 Ene 2025", miembroId: M_IDS[1] },
  { id: uid(), tipo: "ingreso", categoria: "Membresías",       desc: "Membresía - María López", monto: 7500, fecha: "10 Ene 2025", miembroId: M_IDS[2] },
  { id: uid(), tipo: "ingreso", categoria: "Membresías",       desc: "Membresía - Luis Méndez", monto: 850,  fecha: "05 Ene 2025", miembroId: M_IDS[3] },
  { id: uid(), tipo: "ingreso", categoria: "Clases extras",    desc: "Clase spinning x8",        monto: 1600, fecha: "23 Feb 2025" },
  { id: uid(), tipo: "gasto",   categoria: "Servicios",        desc: "Pago CFE",                 monto: 1200, fecha: "22 Feb 2025" },
  { id: uid(), tipo: "ingreso", categoria: "Tienda",           desc: "Venta proteína",            monto: 420,  fecha: "22 Feb 2025" },
  { id: uid(), tipo: "gasto",   categoria: "Mantenimiento",    desc: "Reparación caminadora",    monto: 1800, fecha: "21 Feb 2025" },
  { id: uid(), tipo: "ingreso", categoria: "Personal trainer", desc: "PT - Carlos Ruiz",          monto: 750,  fecha: "20 Feb 2025", miembroId: M_IDS[1] },
  { id: uid(), tipo: "gasto",   categoria: "Insumos",          desc: "Toallas y artículos",       monto: 680,  fecha: "19 Feb 2025" },
];

const PREV       = { totalIngresos: 71200, totalGastos: 51800 };
const PLANES     = ["Mensual", "Trimestral", "Semestral", "Anual"];
const PLAN_PRECIO = { Mensual: 850, Trimestral: 2200, Semestral: 3900, Anual: 7500 };
const PLAN_MESES  = { Mensual: 1,   Trimestral: 3,    Semestral: 6,    Anual: 12 };

function todayISO() { return new Date().toISOString().split("T")[0]; }
function calcVence(inicioISO, plan) {
  if (!inicioISO) return "";
  const d = new Date(inicioISO);
  d.setMonth(d.getMonth() + (PLAN_MESES[plan] || 1));
  return d.toISOString().split("T")[0];
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, day] = iso.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${parseInt(day)} ${meses[parseInt(m)-1]} ${y}`;
}

const CAT_ING  = ["Clases extras","Tienda","Personal trainer","Otro"];
const CAT_GAS  = ["Nómina","Renta","Servicios","Mantenimiento","Insumos","Otro"];
const CAT_ICON = {
  "Membresías":"👥","Clases extras":"🏋️","Tienda":"🛍️","Personal trainer":"💪",
  "Nómina":"👔","Renta":"🏢","Servicios":"⚡","Mantenimiento":"🔧","Insumos":"📦","Otro":"📝"
};

/* ─── UI Atoms ─── */
function Badge({ val }) {
  const up = parseFloat(val) >= 0;
  return (
    <span style={{background:up?"rgba(74,222,128,.18)":"rgba(248,113,113,.18)",color:up?"#4ade80":"#f87171",borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:700}}>
      {up?"▲":"▼"} {Math.abs(val)}%
    </span>
  );
}

function Inp({ label, value, onChange, type="text", placeholder, options, readOnly }) {
  const s = {
    width:"100%", background:readOnly?"rgba(255,255,255,.03)":"rgba(255,255,255,.07)",
    border:"1px solid rgba(255,255,255,.1)", borderRadius:12, padding:"12px 14px",
    color:readOnly?"#6b7280":"#fff", fontSize:14, fontFamily:"inherit", outline:"none", marginBottom:12,
  };
  return (
    <div>
      {label && <p style={{color:"#6b7280",fontSize:12,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>{label}</p>}
      {options
        ? <select value={value} onChange={e=>onChange(e.target.value)} style={{...s,cursor:"pointer"}} disabled={readOnly}>
            {options.map(o=><option key={o} value={o} style={{background:"#1a1a2e"}}>{o}</option>)}
          </select>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s} readOnly={readOnly}/>
      }
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.72)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"flex-end"}}>
      <div style={{width:"100%",background:"#191928",borderRadius:"28px 28px 0 0",padding:"24px 24px 44px",maxHeight:"92%",overflowY:"auto",animation:"slideUp .3s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{color:"#fff",fontSize:18,fontWeight:700}}>{title}</h2>
          <button onClick={onClose} style={{border:"none",background:"rgba(255,255,255,.1)",color:"#9ca3af",width:34,height:34,borderRadius:10,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Btn({ children, onClick, color="#6c63ff", full, outline, small }) {
  return (
    <button onClick={onClick} style={{
      width:full?"100%":"auto", padding:small?"8px 14px":"13px 20px",
      border:outline?`1.5px solid ${color}`:"none", borderRadius:14, cursor:"pointer",
      fontFamily:"inherit", fontSize:small?12:14, fontWeight:700,
      background:outline?"transparent":`linear-gradient(135deg,${color},${color}bb)`,
      color:outline?color:"#fff",
      boxShadow:outline?"none":`0 4px 18px ${color}44`, transition:"opacity .15s",
    }}>{children}</button>
  );
}

/* ─── MEMBER DETAIL MODAL ─── */
function MemberDetailModal({ m, txs, onClose, onSave, onToggleEstado, onAddPago }) {
  const [detTab, setDetTab] = useState("perfil");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    nombre: m.nombre, tel: m.tel||"", plan: m.plan,
    monto: String(m.monto), inicio: m.inicio, vence: m.vence,
  });
  const [pagoModal, setPagoModal] = useState(false);
  const [pago, setPago] = useState({ monto: String(m.monto), desc: `Membresía - ${m.nombre}`, desde: todayISO(), hasta: todayISO() });

  const historial = txs.filter(t=>t.miembroId===m.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const totalPagado = historial.filter(t=>t.tipo==="ingreso").reduce((s,t)=>s+Number(t.monto),0);

  const handleSave = () => {
    onSave({ ...m, ...form, monto: Number(form.monto) });
    setEditing(false);
  };

  const handleAddPago = () => {
    if (!pago.monto || !pago.desc) return;
    const periodoLabel = pago.desde && pago.hasta ? ` (${fmtDate(pago.desde)} – ${fmtDate(pago.hasta)})` : "";
    onAddPago({ id:uid(), tipo:"ingreso", categoria:"Membresías", desc:pago.desc + periodoLabel, monto:Number(pago.monto), fecha:fmtDate(pago.desde)||today(), miembroId:m.id });
    setPagoModal(false);
    setPago({ monto:String(m.monto), desc:`Membresía - ${m.nombre}`, desde:todayISO(), hasta:todayISO() });
  };

  return (
    <Modal title="Perfil del miembro" onClose={onClose}>
      {/* Avatar */}
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:72,height:72,borderRadius:22,margin:"0 auto 12px",background:m.estado==="Activo"?"linear-gradient(135deg,#6c63ff,#e040fb)":"linear-gradient(135deg,#f43f5e,#fb923c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,color:"#fff",fontWeight:700}}>
          {m.nombre.charAt(0)}
        </div>
        <h2 style={{color:"#fff",fontSize:20,fontWeight:700}}>{m.nombre}</h2>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,marginTop:8}}>
          <span style={{background:m.estado==="Activo"?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",color:m.estado==="Activo"?"#4ade80":"#f87171",borderRadius:10,padding:"4px 14px",fontSize:12,fontWeight:700}}>{m.estado}</span>
          <span style={{color:"#6b7280",fontSize:11,fontWeight:500}}>
            {m.estado==="Activo" ? `Activo hasta ${m.vence}` : `Vencido desde ${m.vence}`}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.05)",borderRadius:14,padding:4,marginBottom:18}}>
        {[{k:"perfil",label:"📋 Perfil"},{k:"historial",label:"💳 Historial"}].map(t=>(
          <button key={t.k} onClick={()=>setDetTab(t.k)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:11,cursor:"pointer",fontFamily:"inherit",background:detTab===t.k?"linear-gradient(135deg,#6c63ff,#e040fb)":"transparent",color:detTab===t.k?"#fff":"#4b4b6a",fontSize:12,fontWeight:detTab===t.k?700:500,boxShadow:detTab===t.k?"0 2px 12px rgba(108,99,255,.4)":"none",transition:"all .2s"}}>{t.label}</button>
        ))}
      </div>

      {/* ── PERFIL TAB ── */}
      {detTab==="perfil" && (
        <>
          {editing ? (
            <>
              <Inp label="Nombre" value={form.nombre} onChange={v=>setForm(p=>({...p,nombre:v}))} placeholder="Nombre completo"/>
              <Inp label="Teléfono" value={form.tel} onChange={v=>setForm(p=>({...p,tel:v}))} placeholder="999 000 0000" type="tel"/>
              <Inp label="Plan" value={form.plan} onChange={v=>setForm(p=>({...p,plan:v}))} options={PLANES}/>
              <Inp label="Inicio" value={form.inicio} onChange={v=>setForm(p=>({...p,inicio:v}))} placeholder="Ej: 01 Feb 2025"/>
              <Inp label="Vence"  value={form.vence}  onChange={v=>setForm(p=>({...p,vence:v}))}  placeholder="Ej: 01 Mar 2025"/>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <Btn full outline color="#6b7280" onClick={()=>setEditing(false)}>Cancelar</Btn>
                <Btn full onClick={handleSave}>Guardar ✓</Btn>
              </div>
            </>
          ) : (
            <>
              {[
                {label:"📋 Plan",  val:m.plan},
                {label:"📅 Inicio",val:m.inicio},
                {label:"⏰ Vence", val:m.vence},
                {label:"📱 Tel",   val:m.tel||"—"},
              ].map((row,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                  <span style={{color:"#4b4b6a",fontSize:13}}>{row.label}</span>
                  <span style={{color:"#fff",fontSize:13,fontWeight:600}}>{row.val}</span>
                </div>
              ))}
              <div style={{height:16}}/>
              <div style={{display:"flex",gap:10}}>
                <Btn full outline color="#a78bfa" onClick={()=>setEditing(true)}>✏️ Editar</Btn>
                <Btn full outline color={m.estado==="Activo"?"#f43f5e":"#4ade80"} onClick={onToggleEstado}>
                  {m.estado==="Activo"?"Marcar vencido":"Reactivar"}
                </Btn>
              </div>
            </>
          )}
        </>
      )}

      {/* ── HISTORIAL TAB ── */}
      {detTab==="historial" && (
        <>
          <Btn full onClick={()=>setPagoModal(true)} color="#22d3ee">+ Registrar pago</Btn>
          <div style={{height:14}}/>

          {historial.length===0 ? (
            <div style={{textAlign:"center",padding:"30px 0"}}>
              <p style={{fontSize:28,marginBottom:8}}>💳</p>
              <p style={{color:"#4b4b6a",fontSize:13}}>Sin pagos registrados</p>
            </div>
          ) : historial.map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",borderRadius:16,marginBottom:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:13,fontSize:16,background:t.tipo==="ingreso"?"rgba(34,211,238,.12)":"rgba(244,63,94,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {CAT_ICON[t.categoria]||"📝"}
                </div>
                <div>
                  <p style={{color:"#fff",fontSize:12,fontWeight:500,maxWidth:155,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.desc}</p>
                  <p style={{color:"#4b4b6a",fontSize:10,marginTop:2}}>{t.categoria} · {t.fecha}</p>
                </div>
              </div>
              <p style={{color:t.tipo==="ingreso"?"#22d3ee":"#f43f5e",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700}}>
                {t.tipo==="ingreso"?"+":"-"}{fmt(t.monto)}
              </p>
            </div>
          ))}

          {/* Pago sub-modal */}
          {pagoModal && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
              <div style={{width:"100%",background:"#1e1e30",borderRadius:"28px 28px 0 0",padding:"24px 24px 44px",animation:"slideUp .3s ease"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <h2 style={{color:"#fff",fontSize:17,fontWeight:700}}>💳 Registrar pago</h2>
                  <button onClick={()=>setPagoModal(false)} style={{border:"none",background:"rgba(255,255,255,.1)",color:"#9ca3af",width:34,height:34,borderRadius:10,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
                <Inp label="Descripción" value={pago.desc} onChange={v=>setPago(p=>({...p,desc:v}))} placeholder="Ej: Membresía mensual"/>
                <Inp label="Monto ($)" type="number" value={pago.monto} onChange={v=>setPago(p=>({...p,monto:v}))} placeholder="0.00"/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <Inp label="Desde" type="date" value={pago.desde} onChange={v=>setPago(p=>({...p,desde:v}))}/>
                  <Inp label="Hasta" type="date" value={pago.hasta} onChange={v=>setPago(p=>({...p,hasta:v}))}/>
                </div>
                <Btn full onClick={handleAddPago} color="#22d3ee">Guardar pago ✓</Btn>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ─── EDIT TRANSACTION MODAL ─── */
function EditTxModal({ tx, onClose, onSave, onDelete }) {
  const isGasto = tx.tipo === "gasto";
  const cats    = isGasto ? CAT_GAS : CAT_ING;
  const [form, setForm] = useState({
    cat:   tx.categoria,
    desc:  tx.desc,
    monto: String(tx.monto),
    fecha: tx.fecha, // stored as "DD Mes YYYY", editable as text
  });
  const [confirmDel, setConfirmDel] = useState(false);

  const handleSave = () => {
    if (!form.desc || !form.monto) return;
    onSave({ ...tx, categoria: form.cat, desc: form.desc, monto: Number(form.monto), fecha: form.fecha });
  };

  return (
    <Modal title={isGasto ? "✏️ Editar Gasto" : "✏️ Editar Ingreso"} onClose={onClose}>
      {/* tipo badge */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
        <span style={{background:isGasto?"rgba(244,63,94,.15)":"rgba(34,211,238,.15)",color:isGasto?"#f43f5e":"#22d3ee",borderRadius:20,padding:"5px 16px",fontSize:12,fontWeight:700}}>
          {isGasto?"💸 Gasto":"💰 Ingreso"}
        </span>
      </div>

      <Inp label="Categoría" value={form.cat} onChange={v=>setForm(p=>({...p,cat:v}))} options={cats}/>
      <Inp label="Descripción" value={form.desc} onChange={v=>setForm(p=>({...p,desc:v}))} placeholder="Descripción"/>
      <Inp label="Monto ($)" type="number" value={form.monto} onChange={v=>setForm(p=>({...p,monto:v}))} placeholder="0.00"/>
      <Inp label="Fecha" value={form.fecha} onChange={v=>setForm(p=>({...p,fecha:v}))} placeholder="Ej: 24 Feb 2025"/>

      <div style={{display:"flex",gap:10,marginTop:4}}>
        <Btn full onClick={handleSave} color={isGasto?"#f43f5e":"#22d3ee"}>Guardar cambios ✓</Btn>
      </div>

      <div style={{marginTop:12}}>
        {!confirmDel ? (
          <Btn full outline color="#f43f5e" onClick={()=>setConfirmDel(true)}>🗑 Eliminar</Btn>
        ) : (
          <div style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.3)",borderRadius:14,padding:14,textAlign:"center"}}>
            <p style={{color:"#f87171",fontSize:13,marginBottom:12}}>¿Eliminar este movimiento?</p>
            <div style={{display:"flex",gap:8}}>
              <Btn full outline color="#6b7280" onClick={()=>setConfirmDel(false)}>Cancelar</Btn>
              <Btn full color="#f43f5e" onClick={()=>onDelete(tx.id)}>Sí, eliminar</Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen]     = useState("dashboard");
  const [tab, setTab]           = useState(0);
  const [miembros, setMiembros] = useState(INIT_MIEMBROS);
  const [txs, setTxs]           = useState(INIT_TX);
  const [modal, setModal]       = useState(null);
  const [selM, setSelM]         = useState(null);
  const [editTx, setEditTx]     = useState(null); // tx being edited
  const [filtroEstado, setFiltroEstado] = useState("Todos");
  const [busqueda, setBusqueda] = useState("");
  const [filtroDesde, setFiltroDesde] = useState(()=>{ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; });
  const [filtroHasta, setFiltroHasta] = useState(todayISO);

  const [fI, setFI] = useState({ cat:"Clases extras", desc:"", monto:"", fecha:todayISO() });
  const [fG, setFG] = useState({ cat:"Nómina", desc:"", monto:"", fecha:todayISO() });
  const [fM, setFM] = useState(()=>{ const ini=todayISO(); return {nombre:"",tel:"",plan:"Mensual",monto:"850",inicio:ini,vence:calcVence(ini,"Mensual")}; });

  const totalIng = useMemo(()=>txs.filter(t=>t.tipo==="ingreso").reduce((s,t)=>s+Number(t.monto),0),[txs]);
  const totalGas = useMemo(()=>txs.filter(t=>t.tipo==="gasto").reduce((s,t)=>s+Number(t.monto),0),[txs]);
  const utilidad  = totalIng - totalGas;
  const crecIng   = (((totalIng-PREV.totalIngresos)/PREV.totalIngresos)*100).toFixed(1);
  const crecGas   = (((totalGas-PREV.totalGastos)/PREV.totalGastos)*100).toFixed(1);
  const prevUtil  = PREV.totalIngresos-PREV.totalGastos;
  const crecUtil  = (((utilidad-prevUtil)/Math.abs(prevUtil))*100).toFixed(1);
  const mActivos  = miembros.filter(m=>m.estado==="Activo").length;

  const bycat = tipo => {
    const map={};
    txs.filter(t=>t.tipo===tipo).forEach(t=>{map[t.categoria]=(map[t.categoria]||0)+Number(t.monto);});
    return Object.entries(map).map(([categoria,monto])=>({categoria,monto,icono:CAT_ICON[categoria]||"📝"})).sort((a,b)=>b.monto-a.monto);
  };

  const addIng = ()=>{ if(!fI.desc||!fI.monto)return; setTxs(p=>[{id:uid(),tipo:"ingreso",categoria:fI.cat,desc:fI.desc,monto:Number(fI.monto),fecha:fmtDate(fI.fecha)||today()},...p]); setFI({cat:"Clases extras",desc:"",monto:"",fecha:todayISO()}); setModal(null); };
  const addGas = ()=>{ if(!fG.desc||!fG.monto)return; setTxs(p=>[{id:uid(),tipo:"gasto",categoria:fG.cat,desc:fG.desc,monto:Number(fG.monto),fecha:fmtDate(fG.fecha)||today()},...p]); setFG({cat:"Nómina",desc:"",monto:"",fecha:todayISO()}); setModal(null); };
  const addM   = ()=>{
    if(!fM.nombre||!fM.monto)return;
    const newId=uid();
    setMiembros(p=>[{id:newId,nombre:fM.nombre,plan:fM.plan,monto:Number(fM.monto),inicio:fmtDate(fM.inicio),vence:fmtDate(fM.vence),estado:"Activo",tel:fM.tel},...p]);
    setTxs(p=>[{id:uid(),tipo:"ingreso",categoria:"Membresías",desc:`Membresía - ${fM.nombre}`,monto:Number(fM.monto),fecha:fmtDate(fM.inicio),miembroId:newId},...p]);
    const ini=todayISO(); setFM({nombre:"",tel:"",plan:"Mensual",monto:"850",inicio:ini,vence:calcVence(ini,"Mensual")}); setModal(null);
  };

  const saveMiembro = updated => { setMiembros(p=>p.map(m=>m.id===updated.id?updated:m)); setSelM(updated); };
  const saveEditTx  = updated => { setTxs(p=>p.map(t=>t.id===updated.id?updated:t)); setEditTx(null); setModal(null); };
  const deleteEditTx= id      => { setTxs(p=>p.filter(t=>t.id!==id)); setEditTx(null); setModal(null); };
  const toggleEstado = () => {
    const updated={...selM,estado:selM.estado==="Activo"?"Vencido":"Activo"};
    setMiembros(p=>p.map(m=>m.id===selM.id?updated:m)); setSelM(updated);
  };
  const addPago = tx => setTxs(p=>[tx,...p]);

  const TABS = ["Dashboard","Ingresos","Gastos","Historial"];

  return (
    <div style={{background:"#090912",minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px 0",fontFamily:"'DM Sans','Helvetica Neue',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .card{animation:fadeUp .35s ease both;}
        .card:nth-child(2){animation-delay:.07s}.card:nth-child(3){animation-delay:.14s}.card:nth-child(4){animation-delay:.21s}
        .rh:hover{background:rgba(255,255,255,.06)!important;transition:background .2s;}
        input::placeholder{color:#3d3d5c;}
        select option{background:#191928;}
        button:active{opacity:.75;}
      `}</style>

      <div style={{width:390,height:844,background:"#13131f",borderRadius:44,overflow:"hidden",position:"relative",boxShadow:"0 40px 100px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.07)",display:"flex",flexDirection:"column"}}>

        {/* Status bar */}
        <div style={{padding:"14px 28px 0",display:"flex",justifyContent:"space-between",flexShrink:0}}>
          <span style={{color:"#fff",fontSize:13,fontWeight:600}}>9:41</span>
          <div style={{width:120,height:28,background:"#000",borderRadius:20,position:"absolute",top:10,left:"50%",transform:"translateX(-50%)"}}/>
          <div style={{display:"flex",gap:5,color:"#fff",fontSize:11}}>▲▲▲ ● 🔋</div>
        </div>

        {/* ═══ DASHBOARD ═══ */}
        {screen==="dashboard" && <>
          <div style={{padding:"16px 24px 0",flexShrink:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <p style={{color:"#4b4b6a",fontSize:11,fontWeight:600,letterSpacing:1.2,textTransform:"uppercase"}}>Finanzas · Feb 2025</p>
                <h1 style={{color:"#fff",fontSize:22,fontWeight:700}}>GymFit Pro 💪</h1>
              </div>
              <button onClick={()=>setModal("quickAdd")} style={{width:40,height:40,borderRadius:14,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#6c63ff,#e040fb)",fontSize:22,boxShadow:"0 4px 16px rgba(108,99,255,.5)"}}>⊕</button>
            </div>
            <div style={{display:"flex",gap:3,marginTop:16,background:"rgba(255,255,255,.05)",borderRadius:14,padding:4}}>
              {TABS.map((t,i)=>(
                <button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:"8px 0",border:"none",borderRadius:11,cursor:"pointer",background:tab===i?"linear-gradient(135deg,#6c63ff,#e040fb)":"transparent",color:tab===i?"#fff":"#4b4b6a",fontSize:11,fontWeight:tab===i?700:500,fontFamily:"inherit",boxShadow:tab===i?"0 2px 12px rgba(108,99,255,.4)":"none",transition:"all .2s"}}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"14px 24px 90px"}}>
            {tab===0 && <>
              <div className="card" style={{background:"linear-gradient(135deg,#6c63ff 0%,#e040fb 100%)",borderRadius:24,padding:22,marginBottom:14,boxShadow:"0 8px 32px rgba(108,99,255,.4)",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,background:"rgba(255,255,255,.1)",borderRadius:"50%"}}/>
                <div style={{position:"absolute",bottom:-25,right:20,width:90,height:90,background:"rgba(255,255,255,.07)",borderRadius:"50%"}}/>
                <p style={{color:"rgba(255,255,255,.75)",fontSize:11,fontWeight:600,letterSpacing:.8}}>UTILIDAD NETA · FEB 2025</p>
                <h2 style={{color:"#fff",fontSize:34,fontWeight:700,fontFamily:"'DM Mono',monospace",margin:"6px 0 10px"}}>{fmt(utilidad)}</h2>
                <Badge val={crecUtil}/><span style={{color:"rgba(255,255,255,.55)",fontSize:11,marginLeft:8}}>vs Enero</span>
              </div>
              <div className="card" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[{label:"Ingresos",val:totalIng,crec:crecIng,c:"#22d3ee",bg:"rgba(34,211,238,.08)",bc:"rgba(34,211,238,.2)"},{label:"Gastos",val:totalGas,crec:crecGas,c:"#f43f5e",bg:"rgba(244,63,94,.08)",bc:"rgba(244,63,94,.2)"}].map((k,i)=>(
                  <div key={i} style={{background:k.bg,borderRadius:20,padding:16,border:`1px solid ${k.bc}`}}>
                    <p style={{color:"#4b4b6a",fontSize:11,fontWeight:600,letterSpacing:.6,textTransform:"uppercase",marginBottom:6}}>{k.label}</p>
                    <p style={{color:k.c,fontSize:19,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{fmt(k.val)}</p>
                    <div style={{marginTop:8}}><Badge val={k.crec}/></div>
                  </div>
                ))}
              </div>
              <div className="card" style={{background:"rgba(255,255,255,.04)",borderRadius:20,padding:16,border:"1px solid rgba(255,255,255,.07)",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <p style={{color:"#4b4b6a",fontSize:11,fontWeight:600,letterSpacing:.6,textTransform:"uppercase"}}>Miembros activos</p>
                  <p style={{color:"#fff",fontSize:28,fontWeight:700,fontFamily:"'DM Mono',monospace",margin:"4px 0"}}>{mActivos}</p>
                  <p style={{color:"#4b4b6a",fontSize:11}}>{miembros.filter(m=>m.estado==="Vencido").length} vencidos</p>
                </div>
                <button onClick={()=>setScreen("miembros")} style={{background:"linear-gradient(135deg,#6c63ff,#e040fb)",border:"none",borderRadius:14,padding:"10px 16px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver todos →</button>
              </div>
              <div className="card" style={{background:"rgba(255,255,255,.04)",borderRadius:20,padding:16,border:"1px solid rgba(255,255,255,.07)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <p style={{color:"#fff",fontSize:14,fontWeight:700}}>Últimos movimientos</p>
                  <button onClick={()=>setTab(3)} style={{background:"none",border:"none",color:"#6c63ff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Ver todos</button>
                </div>
                {txs.slice(0,4).map(t=>(
                  <div key={t.id} className="rh" onClick={()=>{setEditTx(t);setModal("editTx");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:34,height:34,borderRadius:11,fontSize:14,background:t.tipo==="ingreso"?"rgba(34,211,238,.12)":"rgba(244,63,94,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>{CAT_ICON[t.categoria]||"📝"}</div>
                      <div>
                        <p style={{color:"#fff",fontSize:12,fontWeight:500,maxWidth:170,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.desc}</p>
                        <p style={{color:"#4b4b6a",fontSize:10}}>{t.fecha}</p>
                      </div>
                    </div>
                    <p style={{color:t.tipo==="ingreso"?"#22d3ee":"#f43f5e",fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700}}>{t.tipo==="ingreso"?"+":"-"}{fmt(t.monto)}</p>
                  </div>
                ))}
              </div>
            </>}

            {tab===1 && <>
              <div className="card" style={{background:"rgba(34,211,238,.08)",borderRadius:20,padding:18,border:"1px solid rgba(34,211,238,.2)",marginBottom:14}}>
                <p style={{color:"#4b4b6a",fontSize:12}}>Total ingresos</p>
                <p style={{color:"#22d3ee",fontSize:30,fontWeight:700,fontFamily:"'DM Mono',monospace",margin:"4px 0 8px"}}>{fmt(totalIng)}</p>
                <Badge val={crecIng}/>
              </div>
              <Btn full onClick={()=>setModal("ingreso")} color="#22d3ee">+ Agregar ingreso</Btn>
              <div style={{height:12}}/>
              {txs.filter(t=>t.tipo==="ingreso").map((t,i)=>(
                <div key={t.id} className="card rh" onClick={()=>{setEditTx(t);setModal("editTx");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.04)",borderRadius:16,padding:"14px 16px",marginBottom:10,border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:42,height:42,borderRadius:14,fontSize:18,background:"rgba(34,211,238,.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{CAT_ICON[t.categoria]||"📝"}</div>
                    <div>
                      <p style={{color:"#fff",fontSize:13,fontWeight:600,maxWidth:170,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.desc}</p>
                      <p style={{color:"#4b4b6a",fontSize:11,marginTop:3}}>{t.categoria} · 📅 {t.fecha}</p>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <p style={{color:"#22d3ee",fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>+{fmt(t.monto)}</p>
                    <span style={{color:"#4b4b6a",fontSize:13}}>✏️</span>
                  </div>
                </div>
              ))}
            </>}

            {tab===2 && <>
              <div className="card" style={{background:"rgba(244,63,94,.08)",borderRadius:20,padding:18,border:"1px solid rgba(244,63,94,.2)",marginBottom:14}}>
                <p style={{color:"#4b4b6a",fontSize:12}}>Total gastos</p>
                <p style={{color:"#f43f5e",fontSize:30,fontWeight:700,fontFamily:"'DM Mono',monospace",margin:"4px 0 8px"}}>{fmt(totalGas)}</p>
                <Badge val={crecGas}/>
              </div>
              <Btn full onClick={()=>setModal("gasto")} color="#f43f5e">+ Agregar gasto</Btn>
              <div style={{height:12}}/>
              {txs.filter(t=>t.tipo==="gasto").map((t,i)=>(
                <div key={t.id} className="card rh" onClick={()=>{setEditTx(t);setModal("editTx");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.04)",borderRadius:16,padding:"14px 16px",marginBottom:10,border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:42,height:42,borderRadius:14,fontSize:18,background:"rgba(244,63,94,.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{CAT_ICON[t.categoria]||"📝"}</div>
                    <div>
                      <p style={{color:"#fff",fontSize:13,fontWeight:600,maxWidth:170,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.desc}</p>
                      <p style={{color:"#4b4b6a",fontSize:11,marginTop:3}}>{t.categoria} · 📅 {t.fecha}</p>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                    <p style={{color:"#f43f5e",fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700}}>-{fmt(t.monto)}</p>
                    <span style={{color:"#4b4b6a",fontSize:13}}>✏️</span>
                  </div>
                </div>
              ))}
            </>}

            {tab===3 && <>
              {/* Filtro de fechas */}
              <div style={{background:"rgba(255,255,255,.04)",borderRadius:16,padding:"12px 14px",marginBottom:14,border:"1px solid rgba(255,255,255,.07)"}}>
                <p style={{color:"#6b7280",fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Filtrar por fecha</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <p style={{color:"#6b7280",fontSize:11,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Desde</p>
                    <input type="date" value={filtroDesde} onChange={e=>setFiltroDesde(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"9px 10px",color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  </div>
                  <div>
                    <p style={{color:"#6b7280",fontSize:11,fontWeight:600,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Hasta</p>
                    <input type="date" value={filtroHasta} onChange={e=>setFiltroHasta(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"9px 10px",color:"#fff",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  </div>
                </div>
              </div>
              {(()=>{
                const desde = filtroDesde ? new Date(filtroDesde) : null;
                const hasta = filtroHasta ? new Date(filtroHasta + "T23:59:59") : null;
                const filtered = txs.filter(t=>{
                  const meses={"Ene":0,"Feb":1,"Mar":2,"Abr":3,"May":4,"Jun":5,"Jul":6,"Ago":7,"Sep":8,"Oct":9,"Nov":10,"Dic":11};
                  const parts = t.fecha.split(" ");
                  if(parts.length<3) return true;
                  const td = new Date(Number(parts[2]), meses[parts[1]]||0, Number(parts[0]));
                  if(desde && td < desde) return false;
                  if(hasta && td > hasta) return false;
                  return true;
                });
                if(filtered.length===0) return (
                  <div style={{textAlign:"center",padding:"36px 0"}}>
                    <p style={{fontSize:28,marginBottom:8}}>📭</p>
                    <p style={{color:"#4b4b6a",fontSize:13}}>Sin movimientos en este período</p>
                  </div>
                );
                return filtered.map(t=>(
                  <div key={t.id} className="card rh" onClick={()=>{setEditTx(t);setModal("editTx");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:16,marginBottom:10,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:38,height:38,borderRadius:12,fontSize:15,background:t.tipo==="ingreso"?"rgba(34,211,238,.12)":"rgba(244,63,94,.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>{CAT_ICON[t.categoria]||"📝"}</div>
                      <div>
                        <p style={{color:"#fff",fontSize:12,fontWeight:500,maxWidth:175,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{t.desc}</p>
                        <p style={{color:"#4b4b6a",fontSize:10,marginTop:2}}>{t.categoria} · {t.fecha}</p>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <p style={{color:t.tipo==="ingreso"?"#22d3ee":"#f43f5e",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700}}>{t.tipo==="ingreso"?"+":"-"}{fmt(t.monto)}</p>
                      <span style={{color:"#4b4b6a",fontSize:14}}>✏️</span>
                    </div>
                  </div>
                ));
              })()}
            </>}
          </div>
        </>}

        {/* ═══ MIEMBROS ═══ */}
        {screen==="miembros" && <>
          <div style={{padding:"16px 24px 0",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <button onClick={()=>setScreen("dashboard")} style={{background:"rgba(255,255,255,.08)",border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",color:"#fff",fontSize:18}}>←</button>
              <h1 style={{color:"#fff",fontSize:20,fontWeight:700}}>Miembros</h1>
              <button onClick={()=>setModal("miembro")} style={{marginLeft:"auto",background:"linear-gradient(135deg,#6c63ff,#e040fb)",border:"none",borderRadius:12,padding:"8px 14px",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Nuevo</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {[{label:"Activos",val:"Activo",count:miembros.filter(m=>m.estado==="Activo").length,c:"#4ade80",bg:"rgba(74,222,128,"},{label:"Vencidos",val:"Vencido",count:miembros.filter(m=>m.estado==="Vencido").length,c:"#f87171",bg:"rgba(248,113,113,"},{label:"Todos",val:"Todos",count:miembros.length,c:"#a78bfa",bg:"rgba(167,139,250,"}].map((s,i)=>{
                const active=filtroEstado===s.val;
                return <button key={i} onClick={()=>setFiltroEstado(s.val)} style={{flex:1,background:active?`${s.bg}.18)`:"rgba(255,255,255,.05)",border:active?`1.5px solid ${s.bg}.35)`:"1.5px solid transparent",borderRadius:14,padding:"10px 8px",cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  <p style={{color:active?s.c:"#6b7280",fontSize:20,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{s.count}</p>
                  <p style={{color:active?s.c:"#4b4b6a",fontSize:11,fontWeight:active?700:500,marginTop:2}}>{s.label}</p>
                </button>;
              })}
            </div>
            <div style={{position:"relative",marginBottom:4}}>
              <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#4b4b6a",pointerEvents:"none"}}>🔍</span>
              <input type="text" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.09)",borderRadius:14,padding:"11px 14px 11px 40px",color:"#fff",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
              {busqueda&&<button onClick={()=>setBusqueda("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#4b4b6a",cursor:"pointer",fontSize:16}}>✕</button>}
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"12px 24px 90px"}}>
            {(()=>{
              const q=busqueda.toLowerCase();
              const lista=miembros.filter(m=>filtroEstado==="Todos"||m.estado===filtroEstado).filter(m=>!q||m.nombre.toLowerCase().includes(q)||(m.tel||"").includes(q));
              if(lista.length===0) return <div style={{textAlign:"center",padding:"40px 0"}}><p style={{fontSize:32,marginBottom:12}}>🔎</p><p style={{color:"#4b4b6a",fontSize:14}}>Sin resultados</p></div>;
              return lista.map(m=>(
                <div key={m.id} className="card rh" onClick={()=>{setSelM(m);setModal("detalle");}} style={{background:"rgba(255,255,255,.04)",borderRadius:18,padding:"14px 16px",marginBottom:10,border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#6c63ff44,#e040fb44)",display:"flex",alignItems:"center",justifyContent:"center",color:"#c4b5fd",fontWeight:700,fontSize:18}}>{m.nombre.charAt(0)}</div>
                      <div>
                        <p style={{color:"#fff",fontSize:14,fontWeight:600}}>{m.nombre}</p>
                        <p style={{color:"#4b4b6a",fontSize:11,marginTop:2}}>Plan {m.plan} · 📱 {m.tel||"—"}</p>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{background:m.estado==="Activo"?"rgba(74,222,128,.15)":"rgba(248,113,113,.15)",color:m.estado==="Activo"?"#4ade80":"#f87171",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>{m.estado}</span>
                      <p style={{color:"#22d3ee",fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,marginTop:6}}>{fmt(m.monto)}</p>
                    </div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.06)"}}>
                    <p style={{color:"#4b4b6a",fontSize:11}}>📅 Inicio: {m.inicio}</p>
                    <p style={{color:"#4b4b6a",fontSize:11}}>Vence: {m.vence}</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </>}

        {/* ═══ BOTTOM NAV ═══ */}
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(10,10,18,.96)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.07)",padding:"10px 8px 26px",display:"flex",justifyContent:"space-around",alignItems:"center"}}>
          {[{label:"Inicio",icon:"⌂",s:"dashboard",t:null},{label:"Miembros",icon:"◎",s:"miembros",t:null},{label:"",icon:"⊕",accent:true},{label:"Ingresos",icon:"↑",s:"dashboard",t:1},{label:"Gastos",icon:"↓",s:"dashboard",t:2}].map((n,i)=>(
            <button key={i} onClick={()=>{if(n.accent){setModal("quickAdd");return;}setScreen(n.s);if(n.t!==null)setTab(n.t);}} style={{border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1}}>
              {n.accent?(
                <div style={{width:50,height:50,borderRadius:17,background:"linear-gradient(135deg,#6c63ff,#e040fb)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:"0 4px 20px rgba(108,99,255,.55)",marginTop:-22}}>{n.icon}</div>
              ):(
                <><span style={{fontSize:20,color:screen===n.s?"#a78bfa":"#4b4b6a",transition:"color .2s"}}>{n.icon}</span><span style={{fontSize:10,fontWeight:600,fontFamily:"inherit",color:screen===n.s?"#a78bfa":"#4b4b6a",transition:"color .2s"}}>{n.label}</span></>
              )}
            </button>
          ))}
        </div>

        {/* ═══ MODALS ═══ */}
        {modal==="quickAdd"&&<Modal title="¿Qué deseas agregar?" onClose={()=>setModal(null)}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>{[{label:"Ingreso",icon:"💰",color:"#22d3ee",action:()=>setModal("ingreso")},{label:"Gasto",icon:"💸",color:"#f43f5e",action:()=>setModal("gasto")},{label:"Miembro",icon:"👤",color:"#a78bfa",action:()=>setModal("miembro")}].map((opt,i)=><button key={i} onClick={opt.action} style={{background:`${opt.color}15`,border:`1px solid ${opt.color}30`,borderRadius:18,padding:"20px 0",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><span style={{fontSize:28}}>{opt.icon}</span><span style={{color:opt.color,fontSize:13,fontWeight:700}}>{opt.label}</span></button>)}</div></Modal>}

        {modal==="ingreso"&&<Modal title="💰 Nuevo Ingreso" onClose={()=>setModal(null)}><Inp label="Categoría" value={fI.cat} onChange={v=>setFI(p=>({...p,cat:v}))} options={CAT_ING}/><Inp label="Descripción" value={fI.desc} onChange={v=>setFI(p=>({...p,desc:v}))} placeholder="Ej: Membresía mensual"/><Inp label="Monto ($)" type="number" value={fI.monto} onChange={v=>setFI(p=>({...p,monto:v}))} placeholder="0.00"/><Inp label="Fecha" type="date" value={fI.fecha} onChange={v=>setFI(p=>({...p,fecha:v}))}/><Btn full onClick={addIng} color="#22d3ee">Guardar ingreso ✓</Btn></Modal>}

        {modal==="gasto"&&<Modal title="💸 Nuevo Gasto" onClose={()=>setModal(null)}><Inp label="Categoría" value={fG.cat} onChange={v=>setFG(p=>({...p,cat:v}))} options={CAT_GAS}/><Inp label="Descripción" value={fG.desc} onChange={v=>setFG(p=>({...p,desc:v}))} placeholder="Ej: Pago de nómina"/><Inp label="Monto ($)" type="number" value={fG.monto} onChange={v=>setFG(p=>({...p,monto:v}))} placeholder="0.00"/><Inp label="Fecha" type="date" value={fG.fecha} onChange={v=>setFG(p=>({...p,fecha:v}))}/><Btn full onClick={addGas} color="#f43f5e">Guardar gasto ✓</Btn></Modal>}

        {modal==="miembro"&&<Modal title="👤 Nuevo Miembro" onClose={()=>setModal(null)}><Inp label="Nombre completo" value={fM.nombre} onChange={v=>setFM(p=>({...p,nombre:v}))} placeholder="Ej: Juan Pérez"/><Inp label="Teléfono" type="tel" value={fM.tel} onChange={v=>setFM(p=>({...p,tel:v}))} placeholder="999 000 0000"/><Inp label="Plan" value={fM.plan} onChange={v=>setFM(p=>({...p,plan:v,monto:PLAN_PRECIO[v]?.toString()||p.monto,vence:calcVence(p.inicio,v)}))} options={PLANES}/><Inp label="Monto ($)" type="number" value={fM.monto} onChange={v=>setFM(p=>({...p,monto:v}))} placeholder="0.00"/><Inp label="Fecha de inicio" type="date" value={fM.inicio} onChange={v=>setFM(p=>({...p,inicio:v,vence:calcVence(v,p.plan)}))}/><Inp label="Fecha de vencimiento" type="date" value={fM.vence} onChange={v=>setFM(p=>({...p,vence:v}))}/><Btn full onClick={addM}>Registrar miembro ✓</Btn></Modal>}

        {modal==="detalle"&&selM&&(
          <MemberDetailModal
            m={selM} txs={txs}
            onClose={()=>setModal(null)}
            onSave={saveMiembro}
            onToggleEstado={toggleEstado}
            onAddPago={addPago}
          />
        )}

        {modal==="editTx"&&editTx&&<EditTxModal tx={editTx} onClose={()=>{setModal(null);setEditTx(null);}} onSave={saveEditTx} onDelete={deleteEditTx}/>}

      </div>
    </div>
  );
}
