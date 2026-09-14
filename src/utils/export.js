/**
 * Export helpers — generate files entirely in the browser (no server).
 * "Excel" export produces a CSV that opens in Excel. "PDF" uses the browser print dialog.
 */

const escapeCsv = (value) => {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * @param {string} filename  without extension
 * @param {Array<{header:string, value:(row)=>any}>} columns
 * @param {Array<Object>} rows
 */
export const exportCsv = (filename, columns, rows) => {
  const header = columns.map((c) => escapeCsv(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCsv(c.value(r))).join(',')).join('\n')
  const blob = new Blob([`﻿${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens the browser print dialog. Elements with .print-area are printed (see documents.css). */
export const printPage = () => {
  setTimeout(() => window.print(), 50)
}
