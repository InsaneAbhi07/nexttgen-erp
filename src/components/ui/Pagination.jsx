import { ChevronLeft, ChevronRight } from 'lucide-react'

const range = (page, count) => {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const pages = new Set([1, count, page, page - 1, page + 1])
  const list = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const out = []
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

/** Pagination with optional page-size selector. */
export default function Pagination({ page, pageCount, onChange, pageSize, onPageSizeChange, sizes = [10, 25, 50, 100] }) {
  return (
    <div className="row row-wrap" style={{ gap: 10 }}>
      {onPageSizeChange && (
        <select className="select page-size" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} aria-label="Rows per page">
          {sizes.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>
      )}
      <nav className="pagination" aria-label="Pagination">
        <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={15} />
        </button>
        {range(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="page-btn" aria-hidden>
              …
            </span>
          ) : (
            <button key={p} type="button" className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)} aria-current={p === page ? 'page' : undefined}>
              {p}
            </button>
          ),
        )}
        <button type="button" className="page-btn" disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={15} />
        </button>
      </nav>
    </div>
  )
}
