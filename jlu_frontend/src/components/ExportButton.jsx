import { useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import Modal from './Modal'

/**
 * ExportButton – Smart export with full IA/ESE column selection.
 *
 * Props:
 *   title, filenamePrefix, dataRows, courseInfo
 *   availableCols      – generic columns [{key, label}]
 *   iaComponents       – [{id, name, max_marks, weightage}] (optional, for Results tab)
 *   courseWeightage    – { int_weightage, ese_weightage, ese_max_marks } (optional)
 *
 * dataRows for Results export should contain keys:
 *   ia_{comp.id}          – raw mark per component
 *   ia_{comp.id}_scaled   – scaled mark per component
 *   ia_total_raw          – IA total (sum of scaled marks = int_total)
 *   ia_total_scaled       – IA weighted (int_total * int_weightage / 100)
 *   ese_total             – raw ESE marks
 *   ese_scaled            – ESE weighted (ese_marks * ese_weightage / 100)
 */
export default function ExportButton({
  title, filenamePrefix, dataRows, availableCols, courseInfo,
  iaComponents = [], courseWeightage = {}
}) {
  const [open, setOpen] = useState(false)
  const [format, setFormat] = useState('pdf')

  // Generic column selection
  const [selectedCols, setSelectedCols] = useState(() => new Set(availableCols.map(c => c.key)))

  // PDF option
  const [includeSig, setIncludeSig] = useState(true)

  // ── IA section state ──────────────────────────────────────────
  const hasIA = iaComponents.length > 0

  // Per-component raw marks checkboxes
  const [iaCompRaw, setIaCompRaw] = useState(() => new Set(iaComponents.map(c => c.id)))
  // Per-component scaled marks checkboxes
  const [iaCompScaled, setIaCompScaled] = useState(() => new Set())

  // IA totals
  const [iaInclTotalRaw, setIaInclTotalRaw]       = useState(true)
  const [iaInclTotalScaled, setIaInclTotalScaled] = useState(false)

  // ESE section
  const [eseInclTotal, setEseInclTotal]   = useState(true)
  const [eseInclScaled, setEseInclScaled] = useState(false)

  // ── Derived "all" states ──────────────────────────────────────
  const allCompRaw    = iaComponents.length > 0 && iaCompRaw.size    === iaComponents.length
  const allCompScaled = iaComponents.length > 0 && iaCompScaled.size === iaComponents.length

  function toggleAllRaw() {
    setIaCompRaw(allCompRaw ? new Set() : new Set(iaComponents.map(c => c.id)))
  }
  function toggleAllScaled() {
    setIaCompScaled(allCompScaled ? new Set() : new Set(iaComponents.map(c => c.id)))
  }

  function toggle(setter, id) {
    setter(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // ── Build final headers + rows ────────────────────────────────
  function buildExportData() {
    const cols  = availableCols.filter(c => selectedCols.has(c.key))
    const headers = cols.map(c => c.label)
    const exportData = dataRows.map(row => cols.map(c => row[c.key] ?? '—'))

    if (hasIA) {
      // Per-component raw
      iaComponents.forEach(comp => {
        if (iaCompRaw.has(comp.id)) {
          headers.push(`${comp.name} (/${comp.max_marks})`)
          exportData.forEach((row, i) => row.push(dataRows[i][`ia_${comp.id}`] ?? '—'))
        }
      })
      // Per-component scaled
      iaComponents.forEach(comp => {
        if (iaCompScaled.has(comp.id)) {
          headers.push(`${comp.name} Scaled (${comp.weightage}%)`)
          exportData.forEach((row, i) => row.push(dataRows[i][`ia_${comp.id}_scaled`] ?? '—'))
        }
      })
      // IA totals
      if (iaInclTotalRaw) {
        headers.push('IA Total')
        exportData.forEach((row, i) => row.push(dataRows[i].ia_total_raw ?? dataRows[i].ia ?? '—'))
      }
      if (iaInclTotalScaled) {
        headers.push(`IA Scaled (${courseWeightage.int_weightage ?? ''}%)`)
        exportData.forEach((row, i) => row.push(dataRows[i].ia_total_scaled ?? '—'))
      }
      // ESE
      if (eseInclTotal) {
        headers.push(`ESE (/${courseWeightage.ese_max_marks ?? 100})`)
        exportData.forEach((row, i) => row.push(dataRows[i].ese_total ?? dataRows[i].ese ?? '—'))
      }
      if (eseInclScaled) {
        headers.push(`ESE Scaled (${courseWeightage.ese_weightage ?? ''}%)`)
        exportData.forEach((row, i) => row.push(dataRows[i].ese_scaled ?? '—'))
      }
    }

    return { headers, exportData }
  }

  function handleExport() {
    const { headers, exportData } = buildExportData()
    const filename = `${filenamePrefix}_${new Date().toISOString().split('T')[0]}`

    if (format === 'csv') {
      const txt = [headers, ...exportData].map(r => r.map(c => `"${c ?? ''}"`).join(',')).join('\n')
      const blob = new Blob([txt], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${filename}.csv`
      link.click()
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } else if (format === 'pdf') {
      const doc = new jsPDF({ orientation: headers.length > 8 ? 'l' : 'p' })
      doc.setFontSize(14)
      doc.text(`${courseInfo.code} - ${courseInfo.name}`, 14, 15)
      doc.setFontSize(10)
      doc.text(title, 14, 22)

      autoTable(doc, {
        head: [headers],
        body: exportData,
        startY: 28,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [40, 40, 40] }
      })

      if (includeSig) {
        const finalY = doc.lastAutoTable.finalY || 28
        doc.text('Date: _________________', 14, finalY + 30)
        doc.text('Faculty Signature: _________________', 120, finalY + 30)
      }

      doc.save(`${filename}.pdf`)
    }
    setOpen(false)
  }

  const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }
  const smallCheckStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }
  const sectionLabelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, display: 'block' }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>↓ Export</button>

      {open && (
        <Modal title={`Export: ${title}`} onClose={() => setOpen(false)} width={500}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '10px 0' }}>

            {/* Format */}
            <div>
              <span style={sectionLabelStyle}>Format</span>
              <div style={{ display: 'flex', gap: 14 }}>
                {['pdf', 'xlsx', 'csv'].map(f => (
                  <label key={f} style={checkStyle}>
                    <input type="radio" value={f} checked={format === f} onChange={e => setFormat(e.target.value)} />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            {/* Generic columns */}
            <div>
              <span style={sectionLabelStyle}>Info Columns</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {availableCols.map(c => (
                  <label key={c.key} style={checkStyle}>
                    <input type="checkbox" checked={selectedCols.has(c.key)} onChange={e => {
                      const s = new Set(selectedCols)
                      e.target.checked ? s.add(c.key) : s.delete(c.key)
                      setSelectedCols(s)
                    }} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* IA Components Section */}
            {hasIA && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <span style={sectionLabelStyle}>IA Components</span>

                {/* Raw marks per component */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ ...checkStyle, marginBottom: 6, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allCompRaw}
                      ref={el => { if (el) el.indeterminate = iaCompRaw.size > 0 && !allCompRaw }}
                      onChange={toggleAllRaw}
                    />
                    Raw Marks — All Components
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, paddingLeft: 20 }}>
                    {iaComponents.map(comp => (
                      <label key={comp.id} style={smallCheckStyle}>
                        <input
                          type="checkbox"
                          checked={iaCompRaw.has(comp.id)}
                          onChange={() => toggle(setIaCompRaw, comp.id)}
                        />
                        {comp.name} <span style={{ color: 'var(--text3)', fontSize: 11 }}>/{comp.max_marks}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Scaled marks per component */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ ...checkStyle, marginBottom: 6, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={allCompScaled}
                      ref={el => { if (el) el.indeterminate = iaCompScaled.size > 0 && !allCompScaled }}
                      onChange={toggleAllScaled}
                    />
                    Scaled Marks — All Components
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, paddingLeft: 20 }}>
                    {iaComponents.map(comp => (
                      <label key={`s_${comp.id}`} style={smallCheckStyle}>
                        <input
                          type="checkbox"
                          checked={iaCompScaled.has(comp.id)}
                          onChange={() => toggle(setIaCompScaled, comp.id)}
                        />
                        {comp.name} <span style={{ color: 'var(--text3)', fontSize: 11 }}>{comp.weightage}%</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* IA Totals */}
                <div style={{ display: 'flex', gap: 16, paddingLeft: 0, flexWrap: 'wrap' }}>
                  <label style={smallCheckStyle}>
                    <input type="checkbox" checked={iaInclTotalRaw} onChange={e => setIaInclTotalRaw(e.target.checked)} />
                    IA Total (sum)
                  </label>
                  <label style={smallCheckStyle}>
                    <input type="checkbox" checked={iaInclTotalScaled} onChange={e => setIaInclTotalScaled(e.target.checked)} />
                    IA Total Weighted ({courseWeightage.int_weightage ?? '?'}%)
                  </label>
                </div>
              </div>
            )}

            {/* ESE Section */}
            {hasIA && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <span style={sectionLabelStyle}>ESE Marks</span>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <label style={smallCheckStyle}>
                    <input type="checkbox" checked={eseInclTotal} onChange={e => setEseInclTotal(e.target.checked)} />
                    ESE Marks (/{courseWeightage.ese_max_marks ?? 100})
                  </label>
                  <label style={smallCheckStyle}>
                    <input type="checkbox" checked={eseInclScaled} onChange={e => setEseInclScaled(e.target.checked)} />
                    ESE Weighted ({courseWeightage.ese_weightage ?? '?'}%)
                  </label>
                </div>
              </div>
            )}

            {/* Options */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <span style={sectionLabelStyle}>Options</span>
              <label style={checkStyle}>
                <input type="checkbox" checked={includeSig} onChange={e => setIncludeSig(e.target.checked)} disabled={format !== 'pdf'} />
                Include blank Date &amp; Signature line (PDF only)
              </label>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport} disabled={selectedCols.size === 0}>
                ↓ Download
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
