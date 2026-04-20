import { useState } from "react";
import { parseDate } from "../utils/dateUtils";

export default function ReportePDF({ txs, miembros, gymConfig, getMembershipInfo, MESES_LABEL }) {
  const now2 = new Date();
  const mesesOpts = Array.from({ length: 13 }, (_, i) => {
    let mo = now2.getMonth() - (12 - i);
    let yr = now2.getFullYear();
    while (mo < 0) { mo += 12; yr--; }
    while (mo > 11) { mo -= 12; yr++; }
    return { label: `${MESES_LABEL[mo]} ${yr}`, value: `${yr}-${String(mo + 1).padStart(2, "0")}` };
  });
  const [pdfMes, setPdfMes] = useState(mesesOpts[mesesOpts.length - 1].value);
  const [generando, setGenerando] = useState(false);

  const cargarScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  const generarPDF = async () => {
    setGenerando(true);
    try {
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
      await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 14;
      const [yr, mo] = pdfMes.split("-").map(Number);
      const monthIdx = mo - 1;
      const mesNombre = `${MESES_LABEL[monthIdx]} ${yr}`;
      const txsMesPDF = txs.filter(t => {
        const d = parseDate(t.fecha);
        return d && d.getFullYear() === yr && d.getMonth() === monthIdx;
      });
      const ing = txsMesPDF.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
      const gas = txsMesPDF.filter(t => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0);
      const util = ing - gas;
      const mActPDF = miembros.filter(m => getMembershipInfo(m.id, txs, m).estado === "Activo").length;
      const gymNombre = gymConfig?.nombre || "GymFit Pro";
      const fmt$ = n => "$" + Number(n).toLocaleString("es-MX");

      // ── HEADER ──
      doc.setFillColor(108, 99, 255);
      doc.rect(0, 0, W, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text(gymNombre, margin, 10);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text("Reporte mensual", margin, 16);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(mesNombre, W - margin, 12, { align: "right" });
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }), W - margin, 18, { align: "right" });

      let y = 30;

      // ── TARJETAS RESUMEN ──
      const cards = [
        { label: "Ingresos", value: fmt$(ing), r: 34, g: 197, b: 94 },
        { label: "Gastos", value: fmt$(gas), r: 244, g: 63, b: 94 },
        { label: "Utilidad neta", value: (util >= 0 ? "+" : "") + fmt$(Math.abs(util)), r: util >= 0 ? 34 : 244, g: util >= 0 ? 197 : 63, b: util >= 0 ? 94 : 94 },
      ];
      const cardW = (W - margin * 2 - 8) / 3;
      cards.forEach((c, i) => {
        const x = margin + i * (cardW + 4);
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.3);
        doc.setFillColor(248, 248, 255);
        doc.roundedRect(x, y, cardW, 18, 3, 3, "FD");
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(107, 114, 128);
        doc.text(c.label.toUpperCase(), x + cardW / 2, y + 5.5, { align: "center" });
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.setTextColor(c.r, c.g, c.b);
        doc.text(c.value, x + cardW / 2, y + 13, { align: "center" });
      });
      y += 24;

      // ── MIEMBROS ──
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(108, 99, 255);
      doc.text("RESUMEN DE MIEMBROS", margin, y); y += 5;
      doc.autoTable({
        startY: y,
        head: [["Total", "Activos", "Vencidos / Sin membresía"]],
        body: [[miembros.length, mActPDF, miembros.length - mActPDF]],
        theme: "grid",
        headStyles: { fillColor: [108, 99, 255], fontSize: 8, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 11, fontStyle: "bold", halign: "center" },
        margin: { left: margin, right: margin },
        styles: { cellPadding: 4 },
      });
      y = doc.lastAutoTable.finalY + 8;

      // ── MOVIMIENTOS ──
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(108, 99, 255);
      doc.text(`MOVIMIENTOS DEL MES (${txsMesPDF.length})`, margin, y); y += 5;

      const rows = txsMesPDF
        .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
        .map(t => [
          t.fecha || "—",
          t.tipo === "ingreso" ? "Ingreso" : "Gasto",
          t.categoria || "—",
          t.desc || t.descripcion || "—",
          (t.tipo === "ingreso" ? "+" : "-") + fmt$(t.monto),
        ]);

      doc.autoTable({
        startY: y,
        head: [["Fecha", "Tipo", "Categoría", "Descripción", "Monto"]],
        body: rows.length > 0 ? rows : [["—", "—", "—", "Sin movimientos este mes", "—"]],
        theme: "striped",
        headStyles: { fillColor: [248, 247, 255], textColor: [107, 114, 128], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 28 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            const v = String(data.cell.raw);
            data.cell.styles.textColor = v.startsWith("+") ? [22, 163, 74] : [225, 29, 72];
          }
          if (data.section === "body" && data.column.index === 1) {
            const v = String(data.cell.raw);
            data.cell.styles.textColor = v.includes("Ingreso") ? [22, 163, 74] : [225, 29, 72];
          }
        },
        margin: { left: margin, right: margin },
      });

      // ── FOOTER ──
      const pageH = doc.internal.pageSize.height;
      doc.setFontSize(7); doc.setFont("helvetica", "normal");
      doc.setTextColor(156, 163, 175);
      doc.text(`${gymNombre} · Generado automáticamente`, W / 2, pageH - 8, { align: "center" });

      // ── DESCARGAR ──
      doc.save(`reporte-${gymNombre.replace(/\s+/g, "-").toLowerCase()}-${pdfMes}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <select
          value={pdfMes}
          onChange={e => setPdfMes(e.target.value)}
          style={{ flex: 1, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        >
          {mesesOpts.map(o => (
            <option key={o.value} value={o.value} style={{ background: "#1a1a2e" }}>{o.label}</option>
          ))}
        </select>
      </div>
      <button
        onClick={generarPDF}
        disabled={generando}
        style={{
          width: "100%", padding: "14px", border: "none", borderRadius: 14,
          cursor: generando ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          background: generando ? "rgba(108,99,255,.4)" : "linear-gradient(135deg,#6c63ff,#e040fb)",
          color: "#fff", boxShadow: generando ? "none" : "0 4px 18px rgba(108,99,255,.35)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .2s",
        }}
      >
        <span style={{ fontSize: 18 }}>{generando ? "⏳" : "📥"}</span>
        {generando ? "Generando PDF..." : "Descargar PDF"}
      </button>
      <p style={{ color: "#4b4b6a", fontSize: 10, textAlign: "center", marginTop: 8, marginBottom: 8 }}>
        El archivo .pdf se descarga directamente en tu dispositivo.
      </p>
    </div>
  );
}
