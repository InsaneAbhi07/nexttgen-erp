/**
 * Item master — frontend-only demo. Items are stored in the mock store (localStorage).
 * Opening stock creates an "Opening" stock move; later changes go through stock adjustment.
 */
import { Link, useSearchParams } from 'react-router-dom'
import { Box, Boxes, Factory, Grid3x3, History, Layers, ShoppingCart, TriangleAlert } from 'lucide-react'
import CrudPage from '../../components/common/CrudPage.jsx'
import { Badge, Button, StatusBadge } from '../../components/ui/index.js'
import { useErp } from '../../store/ErpStore.jsx'
import { byId, itemStock, lowStockItems } from '../../store/selectors.js'
import { nextCode } from '../../store/numbering.js'
import { PRODUCT_TYPES } from '../../data/constants.js'
import { fmtDate, inr2, num } from '../../utils/format.js'
import { itemUsage, mastersCrumbs, MiniTable, SectionTitle, stockStatus } from './shared.jsx'

const TYPE_PREFIX = { 'Finished Good': 'FG', 'Raw Material': 'RM', 'Trading Goods': 'TR', 'Semi Finished': 'SF', Consumable: 'CN', 'Packaging Material': 'PK' }
const TYPE_TONE = { 'Finished Good': 'brass', 'Raw Material': 'teal', 'Trading Goods': 'violet', 'Semi Finished': 'blue', Consumable: 'gray', 'Packaging Material': 'gray' }
const STOCK_TONE = { 'In Stock': 'green', 'Low Stock': 'amber', 'Out of Stock': 'red' }

/** "Pull Handle · 8" · Antique Brass" for items that are variants of a product family */
const variantLabel = (item, families) => {
  const fam = item.familyId && families.get(item.familyId)
  if (!fam) return ''
  return [fam.name, ...fam.attributes.map((a) => item.attributes?.[a.name]).filter(Boolean)].join(' · ')
}

const fields = [
  { name: 'type', label: 'Product type', type: 'select', options: PRODUCT_TYPES, required: true, section: 'Basic details' },
  { name: 'code', label: 'Item code', placeholder: 'Auto-generated', hint: 'Leave blank to generate from the product type', uppercase: true, maxLength: 20 },
  { name: 'name', label: 'Item name', required: true, span: 'full', placeholder: 'e.g. Mortise Lock 250mm Stainless Steel' },
  { name: 'category', label: 'Category', type: 'select', required: true, options: (s) => s.categories.filter((c) => c.status === 'Active').map((c) => c.name) },
  { name: 'subCategory', label: 'Sub category', placeholder: 'e.g. Mortise Locks' },
  { name: 'brand', label: 'Brand', type: 'select', options: (s) => s.brands.filter((b) => b.status === 'Active').map((b) => b.name) },
  { name: 'unit', label: 'Unit', type: 'select', required: true, options: (s) => s.units.filter((u) => u.status === 'Active').map((u) => u.name) },
  { name: 'hsn', label: 'HSN code', required: true, placeholder: '83014090', maxLength: 8 },
  { name: 'gst', label: 'GST %', type: 'select', required: true, options: (s) => s.settings.tax.gstRates.map((g) => ({ value: g, label: `${g}%` })) },
  { name: 'purchaseRate', label: 'Purchase rate', type: 'number', prefix: '₹', section: 'Pricing and stock' },
  { name: 'salesRate', label: 'Sales rate', type: 'number', prefix: '₹' },
  { name: 'minStock', label: 'Minimum stock', type: 'number', hint: 'A low stock alert is raised at this level' },
  { name: 'openingStock', label: 'Opening stock', type: 'number', hint: 'Later changes go through stock adjustment', visible: (v) => !v.id },
  { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: (s) => s.warehouses.filter((w) => w.status === 'Active').map((w) => ({ value: w.id, label: w.name })) },
  { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], required: true },
  { name: 'description', label: 'Description', type: 'textarea', span: 'full', rows: 2 },
]

export default function ItemsPage() {
  const [params] = useSearchParams()
  const presetType = PRODUCT_TYPES.includes(params.get('type')) ? params.get('type') : null
  const { state } = useErp()
  const families = byId(state.productFamilies || [])

  const columns = [
    { key: 'code', header: 'Code', width: 96, render: (r) => <span className="doc-no">{r.code}</span> },
    {
      key: 'name',
      header: 'Item',
      accessor: (r) => `${r.name} ${r.category} ${r.brand || ''}`,
      sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <div className="cell-primary">{r.name}</div>
          <div className="cell-secondary">
            {r.category}
            {r.subCategory ? `, ${r.subCategory}` : ''}
          </div>
          {r.familyId && families.get(r.familyId) && (
            <div className="cell-secondary" style={{ marginTop: 2 }}>
              <Badge tone="brass">Variant</Badge> {variantLabel(r, families)}
            </div>
          )}
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge> },
    { key: 'hsn', header: 'HSN', render: (r) => <span className="mono small">{r.hsn}</span> },
    { key: 'purchaseRate', header: 'Purchase rate', align: 'right', render: (r) => inr2(r.purchaseRate) },
    { key: 'salesRate', header: 'Sales rate', align: 'right', render: (r) => (Number(r.salesRate) ? inr2(r.salesRate) : <span className="muted">—</span>) },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      accessor: (r) => itemStock(state, r.id),
      render: (r) => {
        const bal = itemStock(state, r.id)
        const st = stockStatus(bal, r.minStock)
        return (
          <div>
            <div className="num strong">
              {num(bal)} <span className="muted small">{r.unit}</span>
            </div>
            {st !== 'In Stock' && <Badge tone={STOCK_TONE[st]}>{st}</Badge>}
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  const filters = [
    { key: 'type', label: 'Types', options: PRODUCT_TYPES },
    { key: 'category', label: 'Categories', options: (s) => s.categories.map((c) => c.name) },
    { key: 'brand', label: 'Brands', options: (s) => s.brands.map((b) => b.name) },
    {
      key: 'family',
      label: 'Family',
      placeholder: 'Any family',
      options: (s) => [...(s.productFamilies || []).map((f) => ({ value: f.id, label: f.name })), { value: '__none', label: 'Not a variant' }],
      match: (r, v) => (v === '__none' ? !r.familyId : r.familyId === v),
    },
    { key: 'stock', label: 'Stock', placeholder: 'Any stock level', options: ['In Stock', 'Low Stock', 'Out of Stock'], match: (r, v, s) => stockStatus(itemStock(s, r.id), r.minStock) === v },
  ]

  return (
    <CrudPage
      collection="items"
      singular="Item"
      title="Items"
      subtitle="Finished goods, raw materials, trading goods and packaging with rates, tax and stock levels."
      breadcrumbs={mastersCrumbs('Items')}
      fields={fields}
      columns={columns}
      filters={filters}
      exportName="item-master"
      searchPlaceholder="Search by code, name, category or brand…"
      drawerSize="lg"
      initialSort={{ key: 'code', dir: 'asc' }}
      titleOf={(r) => r.name}
      defaults={(s) => ({
        type: presetType || 'Finished Good',
        unit: 'PCS',
        gst: s.settings.tax.defaultGst,
        warehouseId: ['Raw Material', 'Consumable', 'Packaging Material'].includes(presetType) ? 'wh-rms' : 'wh-fgg',
        category: presetType === 'Raw Material' ? 'Raw Materials' : '',
        brand: presetType === 'Raw Material' ? 'Generic' : 'NexttGen',
        minStock: 0,
        openingStock: 0,
        purchaseRate: '',
        salesRate: '',
      })}
      validate={(v, s) => {
        const e = {}
        const code = (v.code || '').trim().toUpperCase()
        if (code && s.items.some((i) => i.code.toUpperCase() === code && i.id !== v.id)) e.code = `Code ${code} is already used by another item`
        if (v.hsn && !/^\d{4,8}$/.test(String(v.hsn).trim())) e.hsn = 'HSN must be 4 to 8 digits'
        if (['Finished Good', 'Trading Goods'].includes(v.type) && !(Number(v.salesRate) > 0)) e.salesRate = 'Enter a sales rate for saleable items'
        if (Number(v.purchaseRate) < 0) e.purchaseRate = 'Rate cannot be negative'
        return e
      }}
      beforeSave={(v, s) => ({
        ...v,
        code: (v.code || '').trim().toUpperCase() || nextCode(s.items, TYPE_PREFIX[v.type] || 'IT'),
        name: v.name.trim(),
        hsn: String(v.hsn).trim(),
        gst: Number(v.gst),
        purchaseRate: Number(v.purchaseRate) || 0,
        salesRate: Number(v.salesRate) || 0,
        minStock: Number(v.minStock) || 0,
        openingStock: Number(v.openingStock) || 0,
      })}
      stats={(rows, s) => [
        { label: 'Total items', value: num(rows.length), icon: Boxes, tone: 'blue', foot: `${rows.filter((r) => r.status === 'Active').length} active` },
        { label: 'Finished goods', value: num(rows.filter((r) => r.type === 'Finished Good').length), icon: Factory, tone: 'brass', foot: `${rows.filter((r) => r.type === 'Trading Goods').length} trading goods` },
        { label: 'Raw materials', value: num(rows.filter((r) => r.type === 'Raw Material').length), icon: Box, tone: 'teal', foot: `${rows.filter((r) => ['Packaging Material', 'Consumable'].includes(r.type)).length} packaging and consumables` },
        { label: 'Low stock', value: num(lowStockItems(s).length), icon: TriangleAlert, tone: 'amber', foot: 'At or below minimum level', to: '/inventory/stock' },
      ]}
      viewFields={(r, s) => [
        r.familyId && s.productFamilies?.some((f) => f.id === r.familyId) && {
          label: 'Variant of',
          value: <Link to={`/masters/variants/${r.familyId}`}>{variantLabel(r, byId(s.productFamilies))}</Link>,
          span: 2,
        },
        { label: 'Product type', value: r.type },
        { label: 'Category', value: [r.category, r.subCategory].filter(Boolean).join(', ') },
        { label: 'Brand', value: r.brand },
        { label: 'Unit', value: r.unit },
        { label: 'HSN code', value: <span className="mono">{r.hsn}</span> },
        { label: 'GST', value: `${r.gst}%` },
        { label: 'Purchase rate', value: inr2(r.purchaseRate) },
        { label: 'Sales rate', value: Number(r.salesRate) ? inr2(r.salesRate) : '—' },
        { label: 'Minimum stock', value: `${num(r.minStock)} ${r.unit}` },
        { label: 'Opening stock', value: `${num(r.openingStock)} ${r.unit}` },
        { label: 'Default warehouse', value: byId(s.warehouses).get(r.warehouseId)?.name },
        { label: 'Current stock', value: `${num(itemStock(s, r.id))} ${r.unit}` },
        r.description && { label: 'Description', value: r.description, span: 2 },
      ].filter(Boolean)}
      viewExtra={(r, s) => <ItemExtra item={r} state={s} />}
      deleteGuard={(r, s) => itemUsage(s, r.id)}
    />
  )
}

function ItemExtra({ item, state }) {
  const warehouses = state.warehouses
    .map((w) => ({ id: w.id, name: w.name, qty: itemStock(state, item.id, w.id) }))
    .filter((w) => w.qty !== 0)
  const moves = state.stockMoves
    .filter((m) => m.itemId === item.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5)
  const bom = state.boms.find((b) => b.productId === item.id)
  const isFG = item.type === 'Finished Good'
  const buyable = ['Raw Material', 'Packaging Material', 'Consumable', 'Trading Goods'].includes(item.type)

  return (
    <>
      <div className="row row-wrap">
        <Button size="sm" icon={History} to={`/inventory/ledger?item=${item.id}`}>
          View stock ledger
        </Button>
        {isFG && (
          <Button size="sm" icon={Layers} to={bom ? `/production/bom/${bom.id}` : `/production/bom/new?product=${item.id}`}>
            {bom ? 'Open BOM' : 'Create BOM'}
          </Button>
        )}
        {item.familyId && (
          <Button size="sm" icon={Grid3x3} to={`/masters/variants/${item.familyId}`}>
            Variant matrix
          </Button>
        )}
        {isFG && (
          <Button size="sm" icon={Factory} to={`/production/orders/new?product=${item.id}&qty=100`}>
            Plan production
          </Button>
        )}
        {buyable && (
          <Button size="sm" icon={ShoppingCart} to="/purchase/orders/new">
            Raise purchase order
          </Button>
        )}
      </div>
      <div>
        <SectionTitle>Stock by warehouse</SectionTitle>
        <MiniTable
          empty="No stock in any warehouse."
          rows={warehouses}
          columns={[
            { header: 'Warehouse', render: (w) => w.name },
            { header: 'Quantity', align: 'right', render: (w) => `${num(w.qty)} ${item.unit}` },
            { header: 'Value', align: 'right', render: (w) => inr2(w.qty * item.purchaseRate) },
          ]}
        />
      </div>
      <div>
        <SectionTitle>Recent stock movements</SectionTitle>
        <MiniTable
          empty="No movements recorded yet."
          rows={moves}
          columns={[
            { header: 'Date', render: (m) => fmtDate(m.date) },
            { header: 'Type', render: (m) => m.type },
            { header: 'Reference', render: (m) => <span className="doc-no">{m.ref}</span> },
            { header: 'Qty', align: 'right', render: (m) => <span className={m.qty < 0 ? 'text-red' : 'text-green'}>{m.qty > 0 ? '+' : ''}{num(m.qty)}</span> },
          ]}
        />
      </div>
    </>
  )
}
