/** Product family — finish × size variant matrix with stock and rates. Frontend-only demo. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Boxes, ChevronDown, FileQuestion, IndianRupee, Pencil, Plus, Power, Sparkles } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { useAuth } from '../../store/AuthContext.jsx'
import { itemStock } from '../../store/selectors.js'
import { variantKey, variantName, variantRates } from '../../store/mfg.js'
import { inr, inr2, num, today } from '../../utils/format.js'
import { usePageTitle } from '../../utils/hooks.js'
import { Button, Card, Dropdown, EmptyState, KeyValue, PageHeader, StatCard, StatusBadge, useConfirm, useToast } from '../../components/ui/index.js'
import { mastersCrumbs, MiniTable, stockStatus } from './shared.jsx'
import { FamilyDrawer, familyStats } from './VariantsPage.jsx'
import './variants.css'

const DOT = { 'In Stock': '', 'Low Stock': 'low', 'Out of Stock': 'out' }

export default function VariantFamilyView() {
  const { id } = useParams()
  const { state, get, save } = useErp()
  const { can } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [editing, setEditing] = useState(false)
  const family = get('productFamilies', id)
  usePageTitle(family ? family.name : 'Product family')

  if (!family) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <EmptyState icon={FileQuestion} title="Product family not found" description="It may have been deleted, or the demo data was reset." action={<Button variant="primary" to="/masters/variants">Back to product variants</Button>} />
      </div>
    )
  }

  const stats = familyStats(state, family)
  const byKey = new Map(stats.variants.map((v) => [variantKey(v.attributes), v]))
  const [rowAttr, colAttr] = family.attributes
  const stockValue = stats.variants.reduce((a, v) => a + itemStock(state, v.id) * (Number(v.purchaseRate) || 0), 0)
  const canAdd = can('Masters', 'add') && family.status === 'Active'

  /** Create items for the given attribute combinations with unique FG codes. */
  const createVariants = (combos) => {
    let seq = state.items.reduce((max, i) => {
      const m = /^FG-(\d+)$/.exec(i.code || '')
      return m ? Math.max(max, Number(m[1])) : max
    }, 0)
    return combos.map((attrs) => {
      seq += 1
      const rates = variantRates(family, attrs)
      return save('items', {
        code: `FG-${String(seq).padStart(4, '0')}`,
        name: variantName(family, attrs),
        type: 'Finished Good',
        category: family.category,
        subCategory: family.subCategory,
        brand: family.brand,
        unit: family.unit,
        hsn: family.hsn,
        gst: Number(family.gst),
        purchaseRate: rates.purchaseRate,
        salesRate: rates.salesRate,
        minStock: 0,
        openingStock: 0,
        openingDate: today(),
        warehouseId: 'wh-fgg',
        status: 'Active',
        description: family.description || '',
        familyId: family.id,
        attributes: attrs,
      })
    })
  }

  const createOne = (attrs) => {
    const [item] = createVariants([attrs])
    toast.success('Variant created', `${item.code} ${item.name} at ${inr2(item.salesRate)}.`)
  }
  const createMissing = async () => {
    if (!stats.missing.length) return
    const ok = await confirm({
      title: `Create ${stats.missing.length} variant${stats.missing.length > 1 ? 's' : ''}?`,
      message: `New items will be added for every missing ${family.attributes.map((a) => a.name.toLowerCase()).join(' × ')} combination, priced from the base rate and adjustments. They start with zero stock.`,
      confirmLabel: 'Create variants',
    })
    if (!ok) return
    const created = createVariants(stats.missing)
    toast.success(`${created.length} variants created`, `${created[0].code} to ${created[created.length - 1].code} are ready for sales and production.`)
  }
  const toggleStatus = () => {
    const status = family.status === 'Active' ? 'Inactive' : 'Active'
    save('productFamilies', { ...family, status })
    toast.success(status === 'Active' ? 'Family activated' : 'Family deactivated', family.name)
  }

  const cell = (attrs) => {
    const item = byKey.get(variantKey(attrs))
    if (!item) {
      const rates = variantRates(family, attrs)
      return (
        <div className="var-cell empty">
          <span className="var-cell-rate">Not created, {inr(rates.salesRate)}</span>
          {canAdd && <Button size="sm" variant="soft" icon={Plus} onClick={() => createOne(attrs)}>Create</Button>}
        </div>
      )
    }
    const bal = itemStock(state, item.id)
    const st = stockStatus(bal, item.minStock)
    return (
      <button type="button" className={`var-cell ${item.status !== 'Active' ? 'inactive' : ''}`} onClick={() => navigate(`/masters/items?view=${item.id}`)} title={item.name}>
        <span className="var-cell-top">
          <span className="doc-no">{item.code}</span>
          <span className={`var-dot ${DOT[st]}`} aria-label={st} />
        </span>
        <span className="var-cell-stock">{num(bal)}<small>{item.unit}</small></span>
        <span className="var-cell-rate">{inr2(item.salesRate)}</span>
      </button>
    )
  }

  let matrix
  if (family.attributes.length === 1) {
    matrix = (
      <table className="var-matrix">
        <thead>
          <tr>{rowAttr.values.map((v) => <th key={v}>{v}</th>)}</tr>
        </thead>
        <tbody>
          <tr>{rowAttr.values.map((v) => <td key={v}>{cell({ [rowAttr.name]: v })}</td>)}</tr>
        </tbody>
      </table>
    )
  } else if (family.attributes.length === 2) {
    matrix = (
      <table className="var-matrix">
        <thead>
          <tr>
            <th>{rowAttr.name} \ {colAttr.name}</th>
            {colAttr.values.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rowAttr.values.map((r) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {colAttr.values.map((c) => <td key={c}>{cell({ [rowAttr.name]: r, [colAttr.name]: c })}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const priceRows = [...stats.variants]
    .sort((a, b) => (a.code < b.code ? -1 : 1))
    .map((v) => ({
      ...v,
      formula: family.attributes
        .map((a) => {
          const adj = Number(a.adjust?.[v.attributes?.[a.name]]) || 0
          return adj ? `${adj > 0 ? '+' : ''}${adj}% ${v.attributes[a.name]}` : null
        })
        .filter(Boolean)
        .join(', ') || 'Base',
    }))

  const moreItems = [
    can('Masters', 'edit') && { label: family.status === 'Active' ? 'Deactivate family' : 'Activate family', icon: Power, onClick: toggleStatus },
    { label: 'All items', icon: Boxes, to: '/masters/items' },
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={family.name}
        badge={<StatusBadge status={family.status} />}
        subtitle={`${family.code}, ${family.category}${family.subCategory ? ` / ${family.subCategory}` : ''}, ${family.brand}`}
        breadcrumbs={[...mastersCrumbs('Product variants').slice(0, 1), { label: 'Product variants', to: '/masters/variants' }, { label: family.name }]}
        actions={
          <>
            <Dropdown width={200} items={moreItems} trigger={({ toggle }) => <Button iconRight={ChevronDown} onClick={toggle}>More</Button>} />
            {can('Masters', 'edit') && <Button icon={Pencil} onClick={() => setEditing(true)}>Edit family</Button>}
            {canAdd && stats.missing.length > 0 && <Button variant="primary" icon={Sparkles} onClick={createMissing}>Create {stats.missing.length} missing</Button>}
          </>
        }
      />

      <div className="grid-4 mb-16">
        <StatCard label="Variants" value={`${stats.variants.length} of ${stats.combos.length}`} icon={Boxes} tone="brass" foot={family.attributes.map((a) => `${a.values.length} ${a.name.toLowerCase()}`).join(' × ')} />
        <StatCard label="Stock" value={`${num(stats.stock)} ${family.unit}`} icon={Boxes} tone="blue" foot={`${stats.outOfStock} variant(s) out of stock`} />
        <StatCard label="Stock value" value={inr(stockValue)} icon={IndianRupee} tone="green" foot="At purchase rate" />
        <StatCard label="Missing combinations" value={stats.missing.length} icon={Plus} tone="violet" foot={stats.missing.length ? 'Create from the matrix' : 'Every combination exists'} />
      </div>

      <Card
        title="Variant matrix"
        subtitle={family.attributes.length === 2 ? `${rowAttr.name} down, ${colAttr.name.toLowerCase()} across. Stock in each cell; click to open the item.` : 'Stock and rate of each variant'}
        className="mb-16"
      >
        {matrix ? (
          <>
            <div className="var-matrix-wrap">{matrix}</div>
            <div className="var-legend">
              <span><span className="var-dot" /> In stock</span>
              <span><span className="var-dot low" /> At or below minimum</span>
              <span><span className="var-dot out" /> Out of stock</span>
            </div>
          </>
        ) : (
          <div className="muted small">This family has three attributes, so variants are listed in the price list below.</div>
        )}
      </Card>

      <div className="grid-2">
        <Card title="Price list" subtitle={`Base ${inr2(family.baseSalesRate)}, adjusted per attribute`}>
          <MiniTable
            empty="No variants created yet"
            columns={[
              { header: 'Variant', render: (v) => (<div><Link className="cell-primary" to={`/masters/items?view=${v.id}`}>{v.name}</Link><div className="cell-secondary mono">{v.code}</div></div>) },
              { header: 'Pricing', render: (v) => <span className="small ink-2">{v.formula}</span> },
              { header: 'Sales rate', align: 'right', render: (v) => inr2(v.salesRate) },
              { header: 'Stock', align: 'right', render: (v) => num(itemStock(state, v.id)) },
            ]}
            rows={priceRows}
          />
        </Card>
        <Card title="Family details">
          <KeyValue
            cols={2}
            items={[
              { label: 'HSN code', value: <span className="mono">{family.hsn}</span> },
              { label: 'GST', value: `${family.gst}%` },
              { label: 'Unit', value: family.unit },
              { label: 'Base purchase rate', value: inr2(family.basePurchaseRate) },
              ...family.attributes.map((a) => ({
                label: a.name,
                span: 2,
                value: a.values.map((v) => (Number(a.adjust?.[v]) ? `${v} (${a.adjust[v] > 0 ? '+' : ''}${a.adjust[v]}%)` : v)).join(', '),
              })),
              family.description && { label: 'Description', value: family.description, span: 2 },
            ].filter(Boolean)}
          />
        </Card>
      </div>

      <FamilyDrawer open={editing} family={family} onClose={() => setEditing(false)} />
    </>
  )
}
