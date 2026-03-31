import { useState } from 'react'
import { motion } from 'framer-motion'
import type { RouteRow, ComunaConflict, SummaryRow } from '../../types/auditoria'
import { C, T, R, SP } from '../../ui/DS'

interface Props {
  routeData:          RouteRow[]
  conflicts:          ComunaConflict[]
  summaryRows:        SummaryRow[]
  resolvedConflicts:  Set<string>
  flaggedConflicts:   Set<string>
}

function escHtml(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getW() {
  const W = (window as any).XLSX
  if (!W) { alert('XLSX no disponible — asegúrate de cargarlo en index.html'); return null }
  return W
}

function ts() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`
}

// ── Animated counter ──────────────────────────────────────────
function StatCard({ label, value, color, icon, delay = 0 }: {
  label: string; value: number | string; color: string; icon: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: [0.23, 1, 0.32, 1] }}
      style={{
        padding: '14px 16px',
        borderRadius: R.xl,
        border: `1px solid rgba(255,255,255,0.08)`,
        background: 'rgba(255,255,255,0.035)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
        borderRadius: `${R.xl} ${R.xl} 0 0`,
      }} />
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontSize: 24, fontWeight: 900, color, fontFamily: T.fontMono,
        lineHeight: 1, letterSpacing: '-0.03em',
      }}>{value}</span>
      <span style={{ fontSize: T.xs, color: C.textFaint, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </motion.div>
  )
}

// ── Stylized export button ─────────────────────────────────────
function ExportBtn({ label, onClick, disabled, variant = 'default' }: {
  label: string; onClick: () => void; disabled?: boolean
  variant?: 'primary' | 'success' | 'default'
}) {
  const [hover, setHover] = useState(false)
  const [active, setActive] = useState(false)

  const colors = {
    primary: { bg: 'rgba(56,139,253,0.18)', hoverBg: 'rgba(56,139,253,0.28)', border: 'rgba(56,139,253,0.45)', color: '#58a6ff' },
    success: { bg: 'rgba(63,185,80,0.14)', hoverBg: 'rgba(63,185,80,0.22)', border: 'rgba(63,185,80,0.4)', color: '#3fb950' },
    default: { bg: 'rgba(255,255,255,0.05)', hoverBg: 'rgba(255,255,255,0.09)', border: 'rgba(255,255,255,0.12)', color: C.textSub },
  }
  const col = colors[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 14px', borderRadius: R.lg, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: T.fontFamily, fontSize: T.base, fontWeight: 700,
        background: hover && !disabled ? col.hoverBg : col.bg,
        color: col.color,
        border: `1px solid ${col.border}`,
        opacity: disabled ? 0.38 : 1,
        transition: 'all 0.14s',
        transform: active && !disabled ? 'scale(0.95)' : 'scale(1)',
        whiteSpace: 'nowrap',
        boxShadow: hover && !disabled ? `0 0 14px ${col.border}` : 'none',
        letterSpacing: '-0.01em',
      }}
    >{label}</button>
  )
}

// ── Export card ───────────────────────────────────────────────
function ExportCard({ icon, title, desc, actions, disabled, highlight, index }: {
  icon: string; title: string; desc: string
  actions: { label: string; fn: () => void; variant: 'primary' | 'success' | 'default' }[]
  disabled?: boolean; highlight?: boolean; index: number
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: 0.08 + index * 0.055, ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px',
        borderRadius: R.xl,
        border: `1px solid ${
          highlight && !disabled
            ? hovered ? 'rgba(56,139,253,0.5)' : 'rgba(56,139,253,0.28)'
            : hovered && !disabled ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)'
        }`,
        background: highlight && !disabled
          ? hovered ? 'rgba(56,139,253,0.1)' : 'rgba(56,139,253,0.06)'
          : hovered && !disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: hovered && !disabled
          ? `0 6px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.09)`
          : '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
        opacity: disabled ? 0.42 : 1,
        transition: 'all 0.18s',
        cursor: disabled ? 'not-allowed' : 'default',
      }}
    >
      {/* Icon */}
      <motion.span
        animate={{ scale: hovered && !disabled ? 1.12 : 1 }}
        transition={{ duration: 0.2, type: 'spring', stiffness: 400 }}
        style={{ fontSize: 28, flexShrink: 0, lineHeight: 1, filter: disabled ? 'grayscale(0.7)' : 'none' }}
      >{icon}</motion.span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: T.md, fontWeight: 700, color: disabled ? C.textFaint : C.text,
          marginBottom: 2, letterSpacing: '-0.01em',
        }}>{title}</div>
        <div style={{ fontSize: T.base, color: C.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {desc}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {actions.map(a => (
          <ExportBtn
            key={a.label}
            label={a.label}
            onClick={a.fn}
            disabled={disabled}
            variant={a.variant}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ── Section header ─────────────────────────────────────────────
function SectionHeader({ icon, title, delay = 0 }: { icon: string; title: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 0 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 2,
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: T.xs, fontWeight: 700, color: C.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {title}
      </span>
    </motion.div>
  )
}

export default function TabExport({
  routeData, conflicts, summaryRows,
  resolvedConflicts, flaggedConflicts,
}: Props) {

  // ── JSON Session Snapshot ──────────────────────────────────────
  function exportSession() {
    if (!routeData.length) { alert('No hay plan cargado.'); return }
    const snapshot = {
      meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedAtLocal: new Date().toLocaleString('es-CL'),
        totalISOs: routeData.length,
        totalConflicts: conflicts.length,
        totalVehicles: new Set(routeData.map(r => r.veh)).size,
      },
      routeData, conflicts,
      resolvedConflicts: [...resolvedConflicts],
      flaggedConflicts:  [...flaggedConflicts],
      summaryRows,
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `sesion_auditoria_${ts()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── PDF via print ──────────────────────────────────────────────
  function exportPDF() {
    if (!summaryRows.length) { alert('Ejecuta los análisis primero.'); return }
    const rows = summaryRows
    const now  = new Date().toLocaleString('es-CL')
    const nPend  = rows.filter(r => r.status === 'pendiente').length
    const nAlert = rows.filter(r => r.status === 'alerta').length
    const nRes   = rows.filter(r => r.status === 'revisado' || r.status === 'aprobado').length

    const rowsHtml = rows.map((r, i) => {
      const estado = r.status === 'revisado' ? 'Revisado' : r.status === 'aprobado' ? 'Aprobado' : r.status === 'alerta' ? 'Alerta' : 'Pendiente'
      const color  = r.status === 'revisado' || r.status === 'aprobado' ? '#1a6a2a' : r.status === 'alerta' ? '#8b0000' : '#7a5000'
      const obs    = 'C. Incorrecta'
      return `<tr style="background:${i%2===0?'#fff':'#f8f9fa'}">
        <td style="padding:5px 8px;font-weight:700;font-family:monospace;color:#0051BA">${escHtml(r.iso)}</td>
        <td style="padding:5px 8px;color:#333">${escHtml(r.veh)}</td>
        <td style="padding:5px 8px;color:#555;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(r.dir||'—')}</td>
        <td style="padding:5px 8px;color:#555">${obs}</td>
        <td style="padding:5px 8px;font-weight:700;color:${color}">${estado}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Auditoría Rutas — ${now}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1a1a1a}
        h1{font-size:18px;color:#0051BA;margin:0 0 4px}
        .sub{color:#555;font-size:11px;margin:0 0 16px}
        .stats{display:flex;gap:20px;margin-bottom:16px}
        .stat{background:#f0f4ff;border-radius:8px;padding:10px 18px;text-align:center}
        .stat-n{font-size:22px;font-weight:800;line-height:1}
        .stat-l{font-size:10px;color:#555;margin-top:2px}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{background:#0051BA;color:#FFDA1A;padding:6px 8px;text-align:left;font-weight:700}
        tr{page-break-inside:avoid}
        @media print{body{margin:0;font-size:10px}.noprint{display:none}}
      </style>
    </head><body>
      <h1>📊 Resumen de Auditoría de Rutas</h1>
      <p class="sub">Generado el ${now} · ${rows.length} alertas</p>
      <div class="stats">
        <div class="stat"><div class="stat-n" style="color:#c0392b">${nAlert}</div><div class="stat-l">Alerta</div></div>
        <div class="stat"><div class="stat-n" style="color:#e67e22">${nPend}</div><div class="stat-l">Pendiente</div></div>
        <div class="stat"><div class="stat-n" style="color:#27ae60">${nRes}</div><div class="stat-l">Resuelto</div></div>
        <div class="stat"><div class="stat-n" style="color:#2980b9">${rows.length}</div><div class="stat-l">Total</div></div>
      </div>
      <table>
        <thead><tr><th>ISO</th><th>Vehículo</th><th>Dirección</th><th>Tipo</th><th>Estado</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <button class="noprint" onclick="window.print()" style="margin-top:20px;padding:8px 20px;background:#0051BA;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">🖨️ Imprimir / Guardar PDF</button>
    </body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('Permite ventanas emergentes para exportar PDF.'); return }
    win.document.write(html); win.document.close()
    setTimeout(() => win.print(), 500)
  }

  // ── XLSX exports ───────────────────────────────────────────────
  function exportSummary() {
    if (!summaryRows.length) { alert('Ejecuta los análisis primero.'); return }
    const W = getW(); if (!W) return
    const wb = W.utils.book_new()
    const wsData = [['ISO','Vehículo','Dirección','Observación','Detalle','Estado']]
    for (const r of summaryRows) {
      wsData.push([r.iso, r.veh, r.dir||'', r.obs||'', r.detalle||'',
        r.status==='revisado'?'Revisado':r.status==='aprobado'?'Aprobado':r.status==='alerta'?'Alerta':'Pendiente'])
    }
    const ws = W.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:20},{wch:55},{wch:14}]
    W.utils.book_append_sheet(wb, ws, 'Alertas')
    W.writeFile(wb, `resumen_alertas_${ts()}.xlsx`)
  }

  function exportConflicts() {
    if (!conflicts.length) { alert('No hay conflictos geográficos.'); return }
    const W = getW(); if (!W) return
    const wb = W.utils.book_new()
    const wsData = [['ISO','Vehículo','Dirección','Comuna Dirección','Comuna Real','Lat','Lng','Estado']]
    for (const c of conflicts) {
      wsData.push([c.iso, c.veh, c.dir, c.comunaDireccion, c.comunaReal,
        c.lat?.toString()||'', c.lng?.toString()||'', c.status])
    }
    const ws = W.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:22},{wch:22},{wch:10},{wch:10},{wch:12}]
    W.utils.book_append_sheet(wb, ws, 'Conflictos')
    W.writeFile(wb, `conflictos_geo_${ts()}.xlsx`)
  }

  function exportFullPlan() {
    if (!routeData.length) { alert('No hay plan cargado.'); return }
    const W = getW(); if (!W) return
    const wb = W.utils.book_new()
    const wsData = [['ISO','Vehículo','Dirección','Comuna','Provincia','Lat','Lng','Parada']]
    for (const r of routeData) {
      wsData.push([r.iso, r.veh, r.dir, r.comuna, r.provincia||'',
        r.lat?.toString()||'', r.lng?.toString()||'', r.parada?.toString()||''])
    }
    const ws = W.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{wch:14},{wch:20},{wch:45},{wch:22},{wch:18},{wch:10},{wch:10},{wch:8}]
    W.utils.book_append_sheet(wb, ws, 'Plan Rutas')
    W.writeFile(wb, `plan_rutas_${ts()}.xlsx`)
  }

  function copySummary() {
    if (!summaryRows.length) return
    const hS = 'border:1px solid #000;padding:6px 10px;font-weight:bold;background:#0051BA;color:#FFDA1A;font-family:Arial,sans-serif;font-size:11px;'
    const tS = 'border:1px solid #000;padding:5px 10px;background:#fff;color:#000;font-family:Arial,sans-serif;font-size:11px;'
    let rich = `<table style="border-collapse:collapse"><tr><th style="${hS}">ISO</th><th style="${hS}">Vehículo</th><th style="${hS}">Dirección</th><th style="${hS}">Observación</th><th style="${hS}">Detalle</th><th style="${hS}">Estado</th></tr>`
    let plain = 'ISO\tVehículo\tDirección\tObservación\tDetalle\tEstado\n'
    for (const r of summaryRows) {
      const e = r.status==='revisado'?'Revisado':r.status==='aprobado'?'Aprobado':r.status==='alerta'?'Alerta':'Pendiente'
      rich += `<tr><td style="${tS}font-weight:700">${escHtml(r.iso)}</td><td style="${tS}">${escHtml(r.veh)}</td><td style="${tS}">${escHtml(r.dir||'')}</td><td style="${tS}">${escHtml(r.obs||'')}</td><td style="${tS}">${escHtml(r.detalle||'')}</td><td style="${tS}">${e}</td></tr>`
      plain += `${r.iso}\t${r.veh}\t${r.dir||''}\t${r.obs||''}\t${r.detalle||''}\t${e}\n`
    }
    rich += '</table>'
    try {
      navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([rich], { type:'text/html' }), 'text/plain': new Blob([plain], { type:'text/plain' }) })])
    } catch { navigator.clipboard.writeText(plain) }
  }

  // ── Data groups ────────────────────────────────────────────────
  const sessionGroup = [
    {
      icon: '💾', title: 'Sesión Completa (JSON)',
      desc: 'Guarda el estado completo: ISOs, análisis y progreso de revisión',
      actions: [{ label: '⬇ Descargar JSON', fn: exportSession, variant: 'primary' as const }],
      disabled: !routeData.length,
      highlight: true,
    },
  ]

  const reportGroup = [
    {
      icon: '🖨️', title: 'Reporte PDF',
      desc: `${summaryRows.length} alertas — resumen ejecutivo imprimible`,
      actions: [{ label: '📄 Exportar PDF', fn: exportPDF, variant: 'default' as const }],
      disabled: !summaryRows.length,
    },
    {
      icon: '📊', title: 'Resumen de Alertas',
      desc: `${summaryRows.length} alertas · ${summaryRows.filter(r=>r.status==='pendiente').length} pendientes`,
      actions: [
        { label: '⬇ Excel',  fn: exportSummary, variant: 'success' as const },
        { label: '📋 Copiar', fn: copySummary,   variant: 'default' as const },
      ],
      disabled: !summaryRows.length,
    },
  ]

  const dataGroup = [
    {
      icon: '📋', title: 'Plan Rutas Completo',
      desc: `${routeData.length} ISOs · ${new Set(routeData.map(r=>r.veh)).size} vehículos`,
      actions: [{ label: '⬇ Excel', fn: exportFullPlan, variant: 'success' as const }],
      disabled: !routeData.length,
    },
    {
      icon: '📍', title: 'Conflictos Geográficos',
      desc: `${conflicts.length} conflictos de comuna`,
      actions: [{ label: '⬇ Excel', fn: exportConflicts, variant: 'success' as const }],
      disabled: !conflicts.length,
    },
  ]

  const statsData = [
    { label: 'ISOs',          value: routeData.length,                            color: '#58a6ff', icon: '📦' },
    { label: 'Con coords',    value: routeData.filter(r=>r.lat!==null).length,    color: '#3fb950', icon: '📍' },
    { label: 'Conflictos',    value: conflicts.length,                             color: '#f85149', icon: '⚠️' },
    { label: 'Resueltos',     value: resolvedConflicts.size,                       color: '#79c0ff', icon: '✅' },
  ]

  let cardIdx = 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
      background: C.bg, color: C.text, fontFamily: T.fontFamily,
    }}>
      {/* ── Top header bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          padding: `${SP[3]}px ${SP[5]}px`,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 22 }}>📤</span>
        <div>
          <div style={{ fontSize: T.lg, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
            Exportar Resultados
          </div>
          <div style={{ fontSize: T.base, color: C.textFaint, marginTop: 1 }}>
            JSON · PDF · Excel — elige el formato que necesitas
          </div>
        </div>
      </motion.div>

      {/* ── Scrollable content ── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: `${SP[4]}px ${SP[5]}px ${SP[6]}px`,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.1) transparent',
      }}>
        <div style={{ maxWidth: 680, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: SP[5] }}>

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {statsData.map((s, i) => (
              <StatCard key={s.label} {...s} delay={i * 0.06} />
            ))}
          </div>

          {/* Session */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionHeader icon="💾" title="Sesión" delay={0.15} />
            {sessionGroup.map(card => (
              <ExportCard key={card.title} {...card} index={cardIdx++} />
            ))}
          </div>

          {/* Reports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionHeader icon="📄" title="Reportes" delay={0.2} />
            {reportGroup.map(card => (
              <ExportCard key={card.title} {...card} index={cardIdx++} />
            ))}
          </div>

          {/* Raw data */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionHeader icon="📊" title="Datos Raw" delay={0.25} />
            {dataGroup.map(card => (
              <ExportCard key={card.title} {...card} index={cardIdx++} />
            ))}
          </div>

          {/* Footer note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7 }}
            style={{
              fontSize: T.xs, color: C.textDisabled, textAlign: 'center',
              padding: `${SP[2]}px 0`,
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            Los archivos se generan localmente — ningún dato se envía a servidores externos.
          </motion.div>

        </div>
      </div>
    </div>
  )
}
