/**
 * Static reference lists used across the NexttGen ERP demo.
 * Frontend-only: nothing here is fetched from a server.
 */

export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
]
export const STATE_NAMES = INDIAN_STATES.map((s) => s.name)
export const stateCode = (name) => INDIAN_STATES.find((s) => s.name === name)?.code || ''

export const COMPANY_STATE = 'Uttar Pradesh'

export const PAYMENT_MODES = ['Cash', 'Bank', 'UPI', 'Cheque']
export const GST_RATES = [0, 5, 12, 18, 28]
export const PRODUCT_TYPES = ['Finished Good', 'Raw Material', 'Trading Goods', 'Semi Finished', 'Consumable', 'Packaging Material']
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']
export const WASTAGE_TYPES = ['Wastage', 'Rejection', 'Damage', 'Scrap']
export const DEPARTMENTS = ['Management', 'Operations', 'Accounts', 'Purchase', 'Sales', 'Stores', 'Production', 'Quality', 'Maintenance', 'Packaging']
export const SALES_PERSONS = ['Neha Gupta', 'Karan Singh', 'Arjun Mehra']
export const TRANSPORTERS = ['VRL Logistics', 'Gati Ltd.', 'TCI Freight', 'Safexpress', 'Own Vehicle', 'Delhivery Freight']

export const ROLES = [
  'Super Admin',
  'Admin',
  'Manager',
  'Accountant',
  'Purchase User',
  'Sales User',
  'Store User',
  'Production User',
  'Employee',
]

export const PERMISSION_MODULES = ['Dashboard', 'Masters', 'Purchase', 'Sales', 'Inventory', 'Production', 'Accounts', 'Reports', 'Users & Access', 'Settings']
export const PERMISSION_TYPES = ['view', 'add', 'edit', 'delete', 'approve', 'print', 'export']

export const STATUS = {
  master: ['Active', 'Inactive'],
  requisition: ['Pending', 'Approved', 'Rejected', 'Converted'],
  purchaseOrder: ['Draft', 'Submitted', 'Approved', 'Partially Received', 'Received', 'Cancelled'],
  quotation: ['Draft', 'Sent', 'Accepted', 'Converted', 'Rejected', 'Expired'],
  salesOrder: ['Pending', 'Confirmed', 'Partially Delivered', 'Delivered', 'Invoiced', 'Cancelled'],
  challan: ['Dispatched', 'Delivered', 'Invoiced'],
  returns: ['Pending', 'Approved', 'Credit Note Issued'],
  productionOrder: ['Planned', 'Released', 'In Progress', 'Completed', 'Cancelled'],
  bom: ['Active', 'Draft', 'Inactive'],
  transfer: ['In Transit', 'Received'],
  payment: ['Paid', 'Partially Paid', 'Unpaid', 'Overdue'],
}
