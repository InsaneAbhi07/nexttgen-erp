import { inr2, amountInWords } from '../../utils/format.js'

/** Subtotal → discount → taxable → GST split → round off → grand total */
export default function TotalsSummary({ totals, showWords = false, style }) {
  if (!totals) return null
  return (
    <div className="totals" style={style}>
      <div className="totals-row"><span>Subtotal</span><span>{inr2(totals.subtotal)}</span></div>
      <div className="totals-row"><span>Discount</span><span>− {inr2(totals.discount)}</span></div>
      <div className="totals-row"><span>Taxable amount</span><span>{inr2(totals.taxable)}</span></div>
      {totals.interState ? (
        <div className="totals-row"><span>IGST</span><span>{inr2(totals.igst)}</span></div>
      ) : (
        <>
          <div className="totals-row"><span>CGST</span><span>{inr2(totals.cgst)}</span></div>
          <div className="totals-row"><span>SGST</span><span>{inr2(totals.sgst)}</span></div>
        </>
      )}
      {Math.abs(totals.roundOff) > 0 && <div className="totals-row"><span>Round off</span><span>{inr2(totals.roundOff)}</span></div>}
      <div className="totals-row grand"><span>Grand total</span><span>{inr2(totals.grandTotal)}</span></div>
      {showWords && <div className="tiny muted" style={{ textAlign: 'right', marginTop: 4 }}>{amountInWords(totals.grandTotal)}</div>}
    </div>
  )
}
