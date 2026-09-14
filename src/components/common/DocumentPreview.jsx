/**
 * DocumentPaper / DocumentPreview — printable Indian business documents
 * (Tax Invoice, Purchase Order, Quotation, Delivery Challan, GRN...).
 * Print uses the browser dialog; "Download PDF" = print → Save as PDF. No server involved.
 */
import { Download, Printer, Send } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { byId } from '../../store/selectors.js'
import { calcLine } from '../../utils/calc.js'
import { amountInWords, fmtDate, inr2, num } from '../../utils/format.js'
import { stateCode } from '../../data/constants.js'
import { printPage } from '../../utils/export.js'
import { Button, Modal, useToast } from '../ui/index.js'
import BrandMark from '../layout/BrandMark.jsx'

/**
 * props:
 *  title ('Tax Invoice'), subtitle ('Original for Recipient'), numberLabel ('Invoice No.'), number, date
 *  meta: [{ label, value }]           extra header fields (due date, PO ref, vehicle...)
 *  party: { heading, name, address, gstin, state, phone }
 *  shipTo: { heading, name, address } optional
 *  lines: [{ itemId, qty, rate, discount, gst }]   (tax layout)
 *  columns: [{ header, render(line, item, idx), align }]   (simple layout — no tax columns/totals)
 *  totals, interState, notes, terms, stamp ('PAID'), showBank, signLabel
 */
export function DocumentPaper({
  title,
  subtitle,
  numberLabel = 'Document No.',
  number,
  date,
  meta = [],
  party,
  shipTo,
  lines = [],
  columns,
  totals,
  interState = false,
  notes,
  terms,
  stamp,
  showBank = false,
  signLabel = 'Authorised Signatory',
}) {
  const { state } = useErp()
  const c = state.settings.company
  const inv = state.settings.invoice
  const items = byId(state.items)
  const showTaxCols = !columns && Boolean(totals)

  return (
    <div className="doc-paper print-area">
      <div className="doc-head">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          {c.logo ? <img src={c.logo} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} /> : <BrandMark size={44} />}
          <div>
            <div className="doc-company-name">{c.name}</div>
            <div className="doc-company-meta">
              {c.legalName}
              <br />
              {c.address}, {c.city}, {c.state} {c.pincode}
              <br />
              Phone {c.phone}, {c.email}
              <br />
              <b>GSTIN</b> {c.gstin} &nbsp; <b>PAN</b> {c.pan}
            </div>
          </div>
        </div>
        <div className="doc-type">
          <div className="doc-type-title">{title}</div>
          {subtitle && <div className="doc-type-sub">{subtitle}</div>}
          {stamp && (
            <div style={{ marginTop: 10 }}>
              <span className="doc-stamp">{stamp}</span>
            </div>
          )}
        </div>
      </div>

      <div className="doc-meta">
        <div>
          {party && (
            <>
              <div className="doc-meta-label">{party.heading || 'Bill To'}</div>
              <div className="doc-party-name">{party.name}</div>
              {party.legalName && party.legalName !== party.name && <div>{party.legalName}</div>}
              {party.address && <div style={{ color: '#4a5568' }}>{party.address}</div>}
              {party.phone && <div style={{ color: '#4a5568' }}>Phone {party.phone}</div>}
              {party.gstin && (
                <div style={{ marginTop: 4 }}>
                  <b>GSTIN</b> {party.gstin}
                </div>
              )}
              {party.state && (
                <div>
                  <b>State</b> {party.state} ({stateCode(party.state)})
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <dl className="doc-kv">
            <dt>{numberLabel}</dt>
            <dd className="mono">{number}</dd>
            <dt>Date</dt>
            <dd>{fmtDate(date)}</dd>
            {meta
              .filter((m) => m && m.value)
              .map((m) => (
                <FragmentKV key={m.label} label={m.label} value={m.value} />
              ))}
          </dl>
        </div>
      </div>

      {shipTo && (
        <div className="doc-meta">
          <div>
            <div className="doc-meta-label">{shipTo.heading || 'Ship To'}</div>
            <div className="doc-party-name">{shipTo.name}</div>
            <div style={{ color: '#4a5568' }}>{shipTo.address}</div>
          </div>
          <div>
            {shipTo.right && (
              <dl className="doc-kv">
                {shipTo.right.filter((m) => m.value).map((m) => (
                  <FragmentKV key={m.label} label={m.label} value={m.value} />
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="doc-table">
          <thead>
            <tr>
              <th className="c" style={{ width: 28 }}>#</th>
              <th>Description of goods</th>
              {columns
                ? columns.map((col) => (
                    <th key={col.header} className={col.align === 'right' ? 'r' : col.align === 'center' ? 'c' : ''}>
                      {col.header}
                    </th>
                  ))
                : (
                  <>
                    <th>HSN</th>
                    <th className="r">Qty</th>
                    <th>Unit</th>
                    <th className="r">Rate</th>
                    <th className="r">Disc.</th>
                    <th className="r">Taxable</th>
                    {showTaxCols && interState && <th className="r">IGST</th>}
                    {showTaxCols && !interState && <th className="r">CGST</th>}
                    {showTaxCols && !interState && <th className="r">SGST</th>}
                    <th className="r">Amount</th>
                  </>
                )}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const it = items.get(l.itemId)
              const calc = calcLine(l)
              return (
                <tr key={l.id || idx}>
                  <td className="c">{idx + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{it?.name || 'Item'}</div>
                    <div style={{ color: '#6b7280', fontSize: 10.5 }}>{it?.code}</div>
                  </td>
                  {columns ? (
                    columns.map((col) => (
                      <td key={col.header} className={col.align === 'right' ? 'r' : col.align === 'center' ? 'c' : ''}>
                        {col.render(l, it, idx)}
                      </td>
                    ))
                  ) : (
                    <>
                      <td>{it?.hsn}</td>
                      <td className="r">{num(l.qty)}</td>
                      <td>{it?.unit}</td>
                      <td className="r">{inr2(l.rate)}</td>
                      <td className="r">{Number(l.discount) ? `${l.discount}%` : '—'}</td>
                      <td className="r">{inr2(calc.taxable)}</td>
                      {showTaxCols && interState && (
                        <td className="r">
                          {inr2(calc.gstAmt)}
                          <div style={{ color: '#6b7280', fontSize: 10 }}>@{l.gst}%</div>
                        </td>
                      )}
                      {showTaxCols && !interState && (
                        <>
                          <td className="r">
                            {inr2(calc.gstAmt / 2)}
                            <div style={{ color: '#6b7280', fontSize: 10 }}>@{Number(l.gst) / 2}%</div>
                          </td>
                          <td className="r">
                            {inr2(calc.gstAmt / 2)}
                            <div style={{ color: '#6b7280', fontSize: 10 }}>@{Number(l.gst) / 2}%</div>
                          </td>
                        </>
                      )}
                      <td className="r" style={{ fontWeight: 600 }}>{inr2(calc.total)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          {totals && !columns && (
            <tfoot>
              <tr>
                <td />
                <td>Total</td>
                <td />
                <td className="r">{num(lines.reduce((a, l) => a + (Number(l.qty) || 0), 0))}</td>
                <td />
                <td />
                <td className="r">{inr2(totals.discount)}</td>
                <td className="r">{inr2(totals.taxable)}</td>
                {interState ? <td className="r">{inr2(totals.igst)}</td> : (<><td className="r">{inr2(totals.cgst)}</td><td className="r">{inr2(totals.sgst)}</td></>)}
                <td className="r">{inr2(totals.taxable + totals.gst)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totals && (
        <div className="doc-bottom">
          <div>
            <div className="doc-meta-label">Amount in words</div>
            <div className="doc-words">{amountInWords(totals.grandTotal)}</div>
            {totals.taxBreakup?.length > 0 && (
              <table className="doc-tax-table">
                <thead>
                  <tr>
                    <th>GST rate</th>
                    <th>Taxable value</th>
                    {interState ? <th>IGST</th> : (<><th>CGST</th><th>SGST</th></>)}
                    <th>Total tax</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.taxBreakup.map((t) => (
                    <tr key={t.rate}>
                      <td>{t.rate}%</td>
                      <td>{inr2(t.taxable)}</td>
                      {interState ? <td>{inr2(t.tax)}</td> : (<><td>{inr2(t.tax / 2)}</td><td>{inr2(t.tax / 2)}</td></>)}
                      <td>{inr2(t.tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {showBank && (
              <div style={{ marginTop: 10 }}>
                <div className="doc-meta-label">Bank details</div>
                <div>
                  {c.bankName}, A/c No. {c.bankAccount}, IFSC {c.ifsc}, {c.bankBranch}
                </div>
              </div>
            )}
          </div>
          <div className="doc-totals">
            <div className="t-row"><span>Subtotal</span><span>{inr2(totals.subtotal)}</span></div>
            <div className="t-row"><span>Discount</span><span>− {inr2(totals.discount)}</span></div>
            <div className="t-row"><span>Taxable amount</span><span>{inr2(totals.taxable)}</span></div>
            {interState ? (
              <div className="t-row"><span>IGST</span><span>{inr2(totals.igst)}</span></div>
            ) : (
              <>
                <div className="t-row"><span>CGST</span><span>{inr2(totals.cgst)}</span></div>
                <div className="t-row"><span>SGST</span><span>{inr2(totals.sgst)}</span></div>
              </>
            )}
            <div className="t-row"><span>Round off</span><span>{inr2(totals.roundOff)}</span></div>
            <div className="t-row grand"><span>Grand total</span><span>{inr2(totals.grandTotal)}</span></div>
          </div>
        </div>
      )}

      <div className="doc-foot">
        <div>
          {notes && (
            <div style={{ marginBottom: 10 }}>
              <div className="doc-meta-label">Notes</div>
              <div className="doc-terms">{notes}</div>
            </div>
          )}
          <div className="doc-meta-label">Terms &amp; conditions</div>
          <div className="doc-terms">{terms ?? inv.terms}</div>
        </div>
        <div className="doc-sign">
          <div style={{ fontWeight: 600 }}>For {c.name}</div>
          <div className="sign-line">{signLabel}</div>
        </div>
      </div>
      <div className="doc-footer-note">{inv.footer} Generated by NexttGen ERP (demo).</div>
    </div>
  )
}

function FragmentKV({ label, value }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

/** Modal wrapper with Print / Download PDF / Send actions. */
export default function DocumentPreview({ open, onClose, modalTitle, onSend, sendLabel = 'Send to party', ...paper }) {
  const toast = useToast()
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={modalTitle || `${paper.title} preview`}
      subtitle={paper.number}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} style={{ marginRight: 'auto' }}>
            Close
          </Button>
          {onSend !== false && (
            <Button
              icon={Send}
              onClick={() => {
                if (onSend) onSend()
                else toast.success('Sent (demo)', `${paper.number} would be emailed and shared on WhatsApp in the live product.`)
              }}
            >
              {sendLabel}
            </Button>
          )}
          <Button
            icon={Download}
            onClick={() => {
              toast.info('Download PDF', 'Choose “Save as PDF” as the destination in the print dialog.')
              printPage()
            }}
          >
            Download PDF
          </Button>
          <Button variant="primary" icon={Printer} onClick={printPage}>
            Print
          </Button>
        </>
      }
    >
      <DocumentPaper {...paper} />
    </Modal>
  )
}
