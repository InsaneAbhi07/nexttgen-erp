/** Badge & StatusBadge — consistent colour language for every status in the ERP. */

export function Badge({ tone = 'gray', dot = false, children, className = '', title }) {
  return (
    <span className={`badge badge-${tone} ${className}`} title={title}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

const STATUS_TONES = {
  // positive
  Active: 'green', Paid: 'green', Received: 'green', Completed: 'green', Delivered: 'green', Invoiced: 'green',
  Approved: 'green', Converted: 'teal', Accepted: 'green', 'Credit Note Issued': 'teal', Success: 'green', Posted: 'green',
  // in flight
  Submitted: 'blue', Sent: 'blue', Confirmed: 'blue', Released: 'blue', 'In Progress': 'blue', Dispatched: 'blue', 'In Transit': 'blue',
  Planned: 'violet',
  // attention
  Pending: 'amber', 'Partially Received': 'amber', 'Partially Delivered': 'amber', 'Partially Paid': 'amber', Unpaid: 'amber',
  // negative
  Cancelled: 'red', Rejected: 'red', Overdue: 'red', Failed: 'red',
  // neutral
  Draft: 'gray', Inactive: 'gray', Expired: 'gray',
  // priority
  Low: 'gray', Medium: 'blue', High: 'amber', Urgent: 'red',
  // wastage types
  Wastage: 'amber', Rejection: 'red', Damage: 'violet', Scrap: 'gray',
  // stock
  'In Stock': 'green', 'Low Stock': 'amber', 'Out of Stock': 'red',
  // job work & quality
  'Accepted with Deviation': 'amber', Rework: 'amber', Pass: 'green', Fail: 'red', Closed: 'gray',
  'In-house': 'teal', 'Job Work': 'violet', Incoming: 'blue', 'In-process': 'violet', Final: 'teal', 'Pending QC': 'amber',
}

export function statusTone(status) {
  return STATUS_TONES[status] || 'gray'
}

export function StatusBadge({ status, className = '' }) {
  if (!status) return null
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {status}
    </Badge>
  )
}

export default Badge
