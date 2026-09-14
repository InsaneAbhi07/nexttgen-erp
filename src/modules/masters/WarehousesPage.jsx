/**
 * Warehouse / godown master — frontend-only demo.
 */
import { useMemo } from 'react'
import { Boxes, MapPin, Warehouse } from 'lucide-react'
import CrudPage from '../../components/common/CrudPage.jsx'
import { Button, StatusBadge } from '../../components/ui/index.js'
import { useErp } from '../../store/ErpStore.jsx'
import { stockSummary } from '../../store/selectors.js'
import { inr, inrCompact, num } from '../../utils/format.js'
import { mastersCrumbs, MiniTable, SectionTitle, formatMobile, validMobile } from './shared.jsx'

function warehouseStats(state) {
  const map = {}
  stockSummary(state).forEach((r) => {
    if (!map[r.warehouseId]) map[r.warehouseId] = { items: 0, value: 0, rows: [] }
    if (r.balance > 0) {
      map[r.warehouseId].items += 1
      map[r.warehouseId].value += r.value
      map[r.warehouseId].rows.push(r)
    }
  })
  return map
}

export default function WarehousesPage() {
  const { state } = useErp()
  const stats = useMemo(() => warehouseStats(state), [state])

  return (
    <CrudPage
      collection="warehouses"
      singular="Warehouse"
      title="Warehouses"
      subtitle="Godowns, stores and depots where stock is held."
      breadcrumbs={mastersCrumbs('Warehouses')}
      fields={[
        { name: 'name', label: 'Warehouse name', required: true, placeholder: 'e.g. Finished Goods Godown' },
        { name: 'code', label: 'Code', required: true, placeholder: 'WH-FGG', uppercase: true, maxLength: 10 },
        { name: 'address', label: 'Address', type: 'textarea', required: true, span: 'full', rows: 2 },
        { name: 'contactPerson', label: 'Contact person', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 98370 41256' },
        { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true },
      ]}
      columns={[
        {
          key: 'name',
          header: 'Warehouse',
          accessor: (r) => `${r.name} ${r.address}`,
          sortValue: (r) => r.name,
          render: (r) => (
            <div style={{ maxWidth: 360 }}>
              <div className="cell-primary">{r.name}</div>
              <div className="cell-secondary truncate">{r.address}</div>
            </div>
          ),
        },
        { key: 'code', header: 'Code', render: (r) => <span className="doc-no">{r.code}</span> },
        {
          key: 'contactPerson',
          header: 'Contact',
          render: (r) => (
            <div>
              <div>{r.contactPerson}</div>
              <div className="cell-secondary">{r.phone}</div>
            </div>
          ),
        },
        { key: 'items', header: 'Items in stock', align: 'right', accessor: (r) => stats[r.id]?.items || 0, render: (r) => num(stats[r.id]?.items || 0) },
        { key: 'value', header: 'Stock value', align: 'right', accessor: (r) => Math.round(stats[r.id]?.value || 0), render: (r) => inr(stats[r.id]?.value || 0) },
        { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      exportName="warehouses"
      stats={(rows) => {
        const total = Object.values(stats).reduce((a, s) => a + s.value, 0)
        const top = [...rows].sort((a, b) => (stats[b.id]?.value || 0) - (stats[a.id]?.value || 0))[0]
        return [
          { label: 'Warehouses', value: num(rows.length), icon: Warehouse, tone: 'blue', foot: `${rows.filter((r) => r.status === 'Active').length} active` },
          { label: 'Total stock value', value: inrCompact(total), icon: Boxes, tone: 'brass', foot: 'At purchase rate' },
          { label: 'Largest location', value: top?.name || '—', icon: MapPin, tone: 'teal', foot: top ? inrCompact(stats[top.id]?.value || 0) : '' },
        ]
      }}
      validate={(v, s) => {
        const e = {}
        const code = (v.code || '').trim().toUpperCase()
        if (code && s.warehouses.some((w) => w.code.toUpperCase() === code && w.id !== v.id)) e.code = `Code ${code} is already in use`
        if (v.phone && !validMobile(v.phone) && String(v.phone).replace(/\D/g, '').length < 10) e.phone = 'Enter a valid phone number'
        return e
      }}
      beforeSave={(v) => ({ ...v, code: v.code.trim().toUpperCase(), phone: v.phone && validMobile(v.phone) ? formatMobile(v.phone) : v.phone })}
      deleteGuard={(r, s) => {
        if (s.items.some((i) => i.warehouseId === r.id)) return 'Items use this warehouse as their default location. Change them first or mark it inactive.'
        if (s.stockMoves.some((m) => m.warehouseId === r.id)) return 'Stock transactions exist for this warehouse. Mark it inactive instead.'
        return null
      }}
      viewFields={(r) => [
        { label: 'Code', value: r.code },
        { label: 'Contact person', value: r.contactPerson },
        { label: 'Phone', value: r.phone },
        { label: 'Items in stock', value: num(stats[r.id]?.items || 0) },
        { label: 'Address', value: r.address, span: 2 },
        { label: 'Stock value', value: inr(stats[r.id]?.value || 0) },
      ]}
      viewExtra={(r) => {
        const rows = [...(stats[r.id]?.rows || [])].sort((a, b) => b.value - a.value).slice(0, 8)
        return (
          <div>
            <SectionTitle action={<Button size="sm" variant="ghost" to="/inventory/stock">Open stock overview</Button>}>Top items by value</SectionTitle>
            <MiniTable
              empty="No stock held in this warehouse."
              rows={rows}
              columns={[
                { header: 'Item', render: (x) => <div><div className="cell-primary">{x.item.name}</div><div className="cell-secondary">{x.item.code}</div></div> },
                { header: 'Balance', align: 'right', render: (x) => `${num(x.balance)} ${x.item.unit}` },
                { header: 'Value', align: 'right', render: (x) => inr(x.value) },
              ]}
            />
          </div>
        )
      }}
    />
  )
}
