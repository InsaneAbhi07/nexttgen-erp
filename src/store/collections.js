/**
 * Collection metadata for the mock ERP store.
 * - prefix:   document number series (e.g. PO/26-27/0143)
 * - idPrefix: prefix for generated record ids
 * - label:    human name used in toasts, activity log and search
 * - route:    detail page for a record (used by global search / notifications)
 */

export const COLLECTIONS = {
  // Masters
  items: { label: 'Item', module: 'Masters', idPrefix: 'itm', route: (r) => `/masters/items?view=${r.id}` },
  categories: { label: 'Category', module: 'Masters', idPrefix: 'cat', route: () => '/masters/categories' },
  brands: { label: 'Brand', module: 'Masters', idPrefix: 'brd', route: () => '/masters/brands' },
  units: { label: 'Unit', module: 'Masters', idPrefix: 'unt', route: () => '/masters/units' },
  warehouses: { label: 'Warehouse', module: 'Masters', idPrefix: 'wh', route: (r) => `/masters/warehouses?view=${r.id}` },
  customers: { label: 'Customer', module: 'Masters', idPrefix: 'cus', route: (r) => `/masters/customers?view=${r.id}` },
  suppliers: { label: 'Supplier', module: 'Masters', idPrefix: 'sup', route: (r) => `/masters/suppliers?view=${r.id}` },
  productFamilies: { label: 'Product Family', module: 'Masters', idPrefix: 'fam', route: (r) => `/masters/variants/${r.id}` },

  // Purchase
  purchaseRequisitions: { label: 'Purchase Requisition', module: 'Purchase', prefix: 'PR', idPrefix: 'pr', route: (r) => `/purchase/requisitions/${r.id}` },
  purchaseOrders: { label: 'Purchase Order', module: 'Purchase', prefix: 'PO', idPrefix: 'po', route: (r) => `/purchase/orders/${r.id}` },
  grns: { label: 'Goods Receipt', module: 'Purchase', prefix: 'GRN', idPrefix: 'grn', route: (r) => `/purchase/grn/${r.id}` },
  purchaseInvoices: { label: 'Purchase Invoice', module: 'Purchase', prefix: 'PB', idPrefix: 'pinv', route: (r) => `/purchase/invoices/${r.id}` },
  purchaseReturns: { label: 'Purchase Return', module: 'Purchase', prefix: 'PRN', idPrefix: 'prn', route: (r) => `/purchase/returns/${r.id}` },

  // Sales
  quotations: { label: 'Quotation', module: 'Sales', prefix: 'QT', idPrefix: 'qt', route: (r) => `/sales/quotations/${r.id}` },
  salesOrders: { label: 'Sales Order', module: 'Sales', prefix: 'SO', idPrefix: 'so', route: (r) => `/sales/orders/${r.id}` },
  deliveryChallans: { label: 'Delivery Challan', module: 'Sales', prefix: 'DC', idPrefix: 'dc', route: (r) => `/sales/challans/${r.id}` },
  salesInvoices: { label: 'Sales Invoice', module: 'Sales', prefix: 'NGT/INV', idPrefix: 'inv', route: (r) => `/sales/invoices/${r.id}` },
  salesReturns: { label: 'Sales Return', module: 'Sales', prefix: 'SRN', idPrefix: 'srn', route: (r) => `/sales/returns/${r.id}` },

  // Inventory
  stockIns: { label: 'Stock In', module: 'Inventory', prefix: 'SIN', idPrefix: 'sin', route: () => '/inventory/stock-in' },
  stockOuts: { label: 'Stock Out', module: 'Inventory', prefix: 'SOUT', idPrefix: 'sout', route: () => '/inventory/stock-out' },
  stockTransfers: { label: 'Stock Transfer', module: 'Inventory', prefix: 'STR', idPrefix: 'str', route: (r) => `/inventory/transfers/${r.id}` },
  stockAdjustments: { label: 'Stock Adjustment', module: 'Inventory', prefix: 'ADJ', idPrefix: 'adj', route: () => '/inventory/adjustments' },

  // Production
  boms: { label: 'Bill of Material', module: 'Production', idPrefix: 'bom', route: (r) => `/production/bom/${r.id}` },
  productionOrders: { label: 'Production Order', module: 'Production', prefix: 'PRD', idPrefix: 'prd', route: (r) => `/production/orders/${r.id}` },
  materialIssues: { label: 'Material Issue', module: 'Production', prefix: 'MI', idPrefix: 'mi', route: (r) => `/production/material-issue/${r.id}` },
  productionEntries: { label: 'Production Entry', module: 'Production', prefix: 'PE', idPrefix: 'pe', route: (r) => `/production/entries/${r.id}` },
  wastages: { label: 'Wastage Entry', module: 'Production', prefix: 'WST', idPrefix: 'wst', route: () => '/production/wastage' },
  routings: { label: 'Process Route', module: 'Production', idPrefix: 'rt', route: (r) => `/production/routings?view=${r.id}` },
  stageEntries: { label: 'Stage Output', module: 'Production', prefix: 'SE', idPrefix: 'se', route: (r) => `/production/orders/${r.productionOrderId}` },
  jobWorkOrders: { label: 'Job Work Challan', module: 'Production', prefix: 'JWO', idPrefix: 'jwo', route: (r) => `/production/job-work/${r.id}` },
  jobWorkReceipts: { label: 'Job Work Receipt', module: 'Production', prefix: 'JWR', idPrefix: 'jwr', route: (r) => `/production/job-work/${r.jobWorkOrderId}` },

  // Quality
  qcInspections: { label: 'QC Inspection', module: 'Quality', prefix: 'QC', idPrefix: 'qc', route: (r) => `/quality/inspections/${r.id}` },

  // HR & payroll
  employees: { label: 'Employee', module: 'HR', idPrefix: 'emp', route: (r) => `/masters/employees?view=${r.id}` },
  leaveTypes: { label: 'Leave Type', module: 'HR', idPrefix: 'lt', route: () => '/hr/leave-types' },
  holidays: { label: 'Holiday', module: 'HR', idPrefix: 'hol', route: () => '/hr/holidays' },
  attendance: { label: 'Attendance', module: 'HR', idPrefix: 'att', route: (r) => `/hr/attendance?date=${r.date}` },
  leaveApplications: { label: 'Leave Application', module: 'HR', prefix: 'LV', idPrefix: 'lv', route: (r) => `/hr/leaves?view=${r.id}` },
  payrollRuns: { label: 'Salary Sheet', module: 'Payroll', prefix: 'SAL', idPrefix: 'sal', route: (r) => `/hr/payroll/${r.id}` },

  // Accounts
  receipts: { label: 'Customer Receipt', module: 'Accounts', prefix: 'RCT', idPrefix: 'rct', route: () => '/accounts/receipts' },
  payments: { label: 'Supplier Payment', module: 'Accounts', prefix: 'PAY', idPrefix: 'pay', route: () => '/accounts/payments' },

  // Users
  users: { label: 'User', module: 'Users & Access', idPrefix: 'usr', route: () => '/users' },
  roles: { label: 'Role', module: 'Users & Access', idPrefix: 'role', route: () => '/users/roles' },
}

export const NUMBERED_COLLECTIONS = Object.entries(COLLECTIONS)
  .filter(([, m]) => m.prefix)
  .map(([k]) => k)
