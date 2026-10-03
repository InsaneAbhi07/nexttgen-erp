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

/* Lock & handle manufacturing — process stages, job work, QC, variants */
export const PROCESS_STAGES = ['Die Casting', 'Machining', 'Buffing & Polishing', 'Plating', 'Assembly', 'Final QC', 'Packing']
export const WORK_CENTRES = {
  'Die Casting': ['Die-casting M/C 1 (80T)', 'Die-casting M/C 2 (120T)'],
  Machining: ['CNC Lathe Bay', 'Drilling & Tapping Line', 'Power Press 40T'],
  'Buffing & Polishing': ['Buffing Line A', 'Buffing Line B'],
  Plating: ['Plating Shop (in-house)'],
  Assembly: ['Lock Assembly Line', 'Handle Assembly Table'],
  'Final QC': ['QC Bench'],
  Packing: ['Packing Section'],
}
export const JOB_WORK_PROCESSES = ['Nickel Plating', 'Chrome Plating', 'Antique Finish', 'Buffing & Polishing', 'Powder Coating', 'Heat Treatment']
export const OPERATION_MODES = ['In-house', 'Job Work']
export const QC_TYPES = ['Incoming', 'Job Work', 'In-process', 'Final']
export const QC_RESULTS = ['Accepted', 'Accepted with Deviation', 'Rework', 'Rejected']
export const QC_INSPECTORS = ['Deepak Chauhan', 'Suresh Yadav', 'Mohd. Irfan']
export const JOB_WORK_WAREHOUSE = 'wh-jbw'
export const SCRAP_WAREHOUSE = 'wh-scr'
export const DEPARTMENTS = ['Management', 'Operations', 'Accounts', 'Purchase', 'Sales', 'Stores', 'Production', 'Quality', 'Maintenance', 'Packaging']
/* HR — attendance, leave and payroll */
export const DESIGNATIONS = ['Plant Manager', 'Accounts Executive', 'Purchase Executive', 'Sales Executive', 'Store Keeper', 'Production Supervisor', 'QC Inspector', 'Machine Operator', 'Die-casting Operator', 'Buffing Operator', 'Assembly Worker', 'Packer', 'Helper', 'Driver', 'HR & Admin Executive', 'Dispatch In-charge', 'Maintenance Fitter']
export const EMPLOYMENT_TYPES = ['Permanent', 'Probation', 'Contract', 'Daily Wage']
export const SALARY_TYPES = ['Monthly', 'Daily']
export const GENDERS = ['Male', 'Female', 'Other']
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const SHIFTS = [
  { name: 'General', start: '09:30', end: '18:00' },
  { name: 'Morning', start: '06:00', end: '14:00' },
  { name: 'Evening', start: '14:00', end: '22:00' },
]
export const GRACE_MINUTES = 10
export const HOLIDAY_TYPES = ['National', 'Festival', 'Restricted']
export const LEAVE_STATUS = ['Pending', 'Approved', 'Rejected', 'Cancelled']
export const PAYROLL_STATUS = ['Draft', 'Approved', 'Paid']
/* Statutory rates used by the payroll engine (demo values) */
export const STATUTORY = { pfRate: 12, pfWageCeiling: 15000, esiEmployee: 0.75, esiEmployer: 3.25, esiWageLimit: 21000, otMultiplier: 2 }

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

export const PERMISSION_MODULES = ['Dashboard', 'Masters', 'Purchase', 'Sales', 'Inventory', 'Production', 'Quality', 'HR', 'Payroll', 'Accounts', 'Reports', 'Users & Access', 'Settings']
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
  jobWork: ['Sent', 'Partially Received', 'Received', 'Closed'],
  qcResult: ['Accepted', 'Accepted with Deviation', 'Rework', 'Rejected'],
  payment: ['Paid', 'Partially Paid', 'Unpaid', 'Overdue'],
}
