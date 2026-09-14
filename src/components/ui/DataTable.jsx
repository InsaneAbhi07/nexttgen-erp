import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, FileSpreadsheet, FileText, Printer, SearchX } from 'lucide-react'
import SearchBar from './SearchBar.jsx'
import Pagination from './Pagination.jsx'
import EmptyState from './EmptyState.jsx'
import { ActionMenu, Dropdown } from './Dropdown.jsx'
import Button from './Button.jsx'
import { exportCsv, printPage } from '../../utils/export.js'
import { useToast } from './Toast.jsx'

const getValue = (col, row) => {
  if (col.sortValue) return col.sortValue(row)
  if (col.accessor) return col.accessor(row)
  return row[col.key]
}

/**
 * DataTable — search, sort, pagination, row actions, export, empty & loading states.
 *
 * columns: [{
 *   key, header, render?(row), accessor?(row) (search/sort/export value), sortValue?(row),
 *   align?: 'right'|'center', width?, sortable? (default true), exportable? (default true), className?
 * }]
 * props: data, rowKey, pageSize, onRowClick, rowActions(row) → items, toolbar (right side node),
 *        filters (node shown after search), exportName, emptyTitle, emptyDescription, emptyAction,
 *        initialSort {key, dir}, footer (tfoot content), title, subtitle, searchable, compact, loading
 */
export default function DataTable({
  columns,
  data = [],
  rowKey = 'id',
  pageSize: initialPageSize = 10,
  onRowClick,
  rowActions,
  toolbar,
  filters,
  exportName,
  emptyTitle = 'No records found',
  emptyDescription = 'Try changing the search or filters.',
  emptyAction,
  emptyIcon,
  initialSort,
  footer,
  title,
  subtitle,
  searchable = true,
  searchPlaceholder = 'Search…',
  compact = false,
  loading: loadingProp,
  simulateLoading = true,
  className = '',
  hideToolbar = false,
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(initialSort || null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [booting, setBooting] = useState(simulateLoading)

  // Brief skeleton on first render so screens feel like they fetch data.
  useEffect(() => {
    if (!simulateLoading) return undefined
    const t = setTimeout(() => setBooting(false), 280)
    return () => clearTimeout(t)
  }, [simulateLoading])
  const loading = loadingProp ?? booting

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let rows = data
    if (q) {
      rows = rows.filter((row) =>
        columns.some((c) => {
          const v = c.accessor ? c.accessor(row) : row[c.key]
          return v !== null && v !== undefined && typeof v !== 'object' && String(v).toLowerCase().includes(q)
        }),
      )
    }
    if (sort?.key) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        rows = [...rows].sort((a, b) => {
          const va = getValue(col, a)
          const vb = getValue(col, b)
          if (va === vb) return 0
          if (va === undefined || va === null || va === '') return 1
          if (vb === undefined || vb === null || vb === '') return -1
          const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en-IN', { numeric: true })
          return sort.dir === 'desc' ? -cmp : cmp
        })
      }
    }
    return rows
  }, [data, query, sort, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [query, data.length])

  const toggleSort = (col) => {
    if (col.sortable === false) return
    setSort((s) => (s?.key !== col.key ? { key: col.key, dir: 'asc' } : s.dir === 'asc' ? { key: col.key, dir: 'desc' } : null))
  }

  const doExport = () => {
    const cols = columns.filter((c) => c.exportable !== false && c.header)
    exportCsv(
      exportName || 'export',
      cols.map((c) => ({ header: typeof c.header === 'string' ? c.header : c.key, value: (r) => (c.accessor ? c.accessor(r) : r[c.key]) })),
      filtered,
    )
    toast.success('Excel file downloaded', `${filtered.length} rows exported to ${exportName || 'export'}.csv`)
  }

  const hasActions = typeof rowActions === 'function'
  const colCount = columns.length + (hasActions ? 1 : 0)

  return (
    <section className={`card table-card ${className}`}>
      {title && (
        <header className="card-header">
          <div>
            <h3 className="card-title">{title}</h3>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </header>
      )}
      {!hideToolbar && (searchable || filters || toolbar || exportName) && (
        <div className="table-toolbar no-print">
          {searchable && <SearchBar value={query} onChange={setQuery} placeholder={searchPlaceholder} />}
          {filters}
          <div className="toolbar-right">
            {toolbar}
            {exportName && (
              <Dropdown
                width={190}
                items={[
                  { label: 'Export to Excel', icon: FileSpreadsheet, onClick: doExport },
                  { label: 'Export to PDF', icon: FileText, onClick: () => { toast.info('Preparing PDF', 'Choose "Save as PDF" in the print dialog.'); printPage() } },
                  { label: 'Print', icon: Printer, onClick: printPage },
                ]}
                trigger={({ toggle }) => (
                  <Button icon={Download} onClick={toggle}>
                    Export
                  </Button>
                )}
              />
            )}
          </div>
        </div>
      )}
      <div className="table-wrap print-area">
        <table className={`table ${compact ? 'compact' : ''}`}>
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = c.sortable !== false && c.header
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    className={`${sortable ? 'sortable' : ''} ${c.align ? `align-${c.align}` : ''} ${c.className || ''}`}
                    style={{ width: c.width }}
                    onClick={() => sortable && toggleSort(c)}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <span className="th-inner">
                      {c.header}
                      {sortable && (active ? sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />)}
                    </span>
                  </th>
                )
              })}
              {hasActions && <th className="col-actions no-print" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j}>
                      <span className="skeleton" style={{ width: `${45 + ((i * 7 + j * 13) % 45)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((row) => (
                <tr key={row[rowKey]} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key} className={`${c.align ? `align-${c.align}` : ''} ${c.className || ''}`}>
                      {c.render ? c.render(row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                  {hasActions && (
                    <td className="col-actions no-print" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu items={rowActions(row)} />
                    </td>
                  )}
                </tr>
              ))}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={colCount} style={{ padding: 0 }}>
                  <EmptyState
                    icon={emptyIcon || SearchX}
                    title={query ? `No results for “${query}”` : emptyTitle}
                    description={query ? 'Check the spelling or search by code, name or number.' : emptyDescription}
                    action={query ? <Button size="sm" onClick={() => setQuery('')}>Clear search</Button> : emptyAction}
                  />
                </td>
              </tr>
            )}
          </tbody>
          {footer && !loading && visible.length > 0 && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {!loading && filtered.length > 0 && (
        <div className="table-footer no-print">
          <span>
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <Pagination page={safePage} pageCount={pageCount} onChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} />
        </div>
      )}
    </section>
  )
}
