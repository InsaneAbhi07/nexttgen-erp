/** Printable receipt / payment voucher (browser print only — demo). */
import { Download, Printer } from 'lucide-react'
import { useErp } from '../../store/ErpStore.jsx'
import { amountInWords, fmtDate, inr2 } from '../../utils/format.js'
import { printPage } from '../../utils/export.js'
import { Button, Modal, useToast } from '../../components/ui/index.js'
import BrandMark from '../../components/layout/BrandMark.jsx'
import { VOUCHER_KINDS } from './config.js'

export function VoucherPaper({ kind, voucher }) {
  const { state, get } = useErp()
  const K = VOUCHER_KINDS[kind]
  const c = state.settings.company
  const party = get(K.partyColl, voucher[K.partyKey])
  const invoice = voucher.invoiceId ? get(K.invoiceColl, voucher.invoiceId) : null
  const account = (state.settings.accounts || []).find((a) => a.id === voucher.accountId)

  return (
    <div className="doc-paper print-area" style={{ maxWidth: 760 }}>
      <div className="doc-head">
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          {c.logo ? <img src={c.logo} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} /> : <BrandMark size={44} />}
          <div>
            <div className="doc-company-name">{c.name}</div>
            <div className="doc-company-meta">
              {c.address}, {c.city}, {c.state} {c.pincode}
              <br />
              <b>GSTIN</b> {c.gstin} &nbsp; <b>PAN</b> {c.pan}
            </div>
          </div>
        </div>
        <div className="doc-type">
          <div className="doc-type-title">{K.voucherTitle}</div>
          <div className="doc-type-sub">{kind === 'receipts' ? 'Acknowledgement of money received' : 'Record of money paid'}</div>
        </div>
      </div>
      <div className="doc-meta">
        <div>
          <div className="doc-meta-label">{K.partyHeading}</div>
          <div className="doc-party-name">{party?.name}</div>
          {party?.companyName && party.companyName !== party.name && <div>{party.companyName}</div>}
          <div style={{ color: '#4a5568' }}>
            {party?.address}, {party?.city}, {party?.state}
          </div>
          {party?.gstin && (
            <div style={{ marginTop: 4 }}>
              <b>GSTIN</b> {party.gstin}
            </div>
          )}
        </div>
        <div>
          <dl className="doc-kv">
            <dt>Voucher No.</dt>
            <dd className="mono">{voucher.number}</dd>
            <dt>Date</dt>
            <dd>{fmtDate(voucher.date)}</dd>
            <dt>Mode</dt>
            <dd>{voucher.mode}</dd>
            <dt>Account</dt>
            <dd>{account?.name || '—'}</dd>
            {voucher.reference && (
              <>
                <dt>Reference</dt>
                <dd>{voucher.reference}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
      <table className="doc-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th className="r">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style={{ fontWeight: 600 }}>{invoice ? `Against invoice ${invoice.number} dated ${fmtDate(invoice.date)}` : 'On account (not adjusted against an invoice)'}</div>
              {voucher.remarks && <div style={{ color: '#6b7280' }}>{voucher.remarks}</div>}
            </td>
            <td className="r">{inr2(voucher.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="r">{inr2(voucher.amount)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="doc-bottom" style={{ gridTemplateColumns: '1fr 260px' }}>
        <div>
          <div className="doc-meta-label">Amount in words</div>
          <div className="doc-words">{amountInWords(voucher.amount)}</div>
        </div>
        <div className="doc-totals">
          <div className="t-row grand" style={{ borderTop: 0, marginTop: 0 }}>
            <span>{K.flowWord}</span>
            <span>{inr2(voucher.amount)}</span>
          </div>
        </div>
      </div>
      <div className="doc-foot">
        <div className="doc-terms">
          {kind === 'receipts' ? 'Subject to realisation of cheque / bank credit.' : 'Payment released as per agreed credit terms.'}
          {'\n'}Prepared by {voucher.createdBy || 'Accounts team'}.
        </div>
        <div className="doc-sign">
          <div style={{ fontWeight: 600 }}>For {c.name}</div>
          <div className="sign-line">Authorised Signatory</div>
        </div>
      </div>
      <div className="doc-footer-note">Computer generated voucher from NexttGen ERP (demo data).</div>
    </div>
  )
}

export default function VoucherPreview({ kind, voucher, onClose }) {
  const toast = useToast()
  const K = VOUCHER_KINDS[kind]
  return (
    <Modal
      open={Boolean(voucher)}
      onClose={onClose}
      size="lg"
      title={`${K.voucherTitle} preview`}
      subtitle={voucher?.number}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} style={{ marginRight: 'auto' }}>
            Close
          </Button>
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
      {voucher && <VoucherPaper kind={kind} voucher={voucher} />}
    </Modal>
  )
}
