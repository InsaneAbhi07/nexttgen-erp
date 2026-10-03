/**
 * Sidebar navigation. Every path here maps to a real page (no dead links).
 * `module` ties the entry to the role permission matrix.
 */
import { BarChart3, Boxes, CalendarCheck, ClipboardCheck, Database, Factory, Landmark, LayoutDashboard, Settings, ShieldCheck, ShoppingCart, Receipt } from 'lucide-react'

export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', module: 'Dashboard' },
  {
    key: 'masters', label: 'Masters', icon: Database, base: '/masters', module: 'Masters',
    children: [
      { label: 'Items', to: '/masters/items' },
      { label: 'Product Variants', to: '/masters/variants' },
      { label: 'Categories', to: '/masters/categories' },
      { label: 'Brands', to: '/masters/brands' },
      { label: 'Units', to: '/masters/units' },
      { label: 'Warehouses', to: '/masters/warehouses' },
      { label: 'Customers', to: '/masters/customers' },
      { label: 'Suppliers', to: '/masters/suppliers' },
      { label: 'Employees', to: '/masters/employees', module: 'HR' },
    ],
  },
  {
    key: 'purchase', label: 'Purchase', icon: ShoppingCart, base: '/purchase', module: 'Purchase',
    children: [
      { label: 'Purchase Requisitions', to: '/purchase/requisitions' },
      { label: 'Purchase Orders', to: '/purchase/orders' },
      { label: 'Goods Receipt (GRN)', to: '/purchase/grn' },
      { label: 'Purchase Invoices', to: '/purchase/invoices' },
      { label: 'Purchase Returns', to: '/purchase/returns' },
    ],
  },
  {
    key: 'sales', label: 'Sales', icon: Receipt, base: '/sales', module: 'Sales',
    children: [
      { label: 'Quotations', to: '/sales/quotations' },
      { label: 'Sales Orders', to: '/sales/orders' },
      { label: 'Delivery Challans', to: '/sales/challans' },
      { label: 'Sales Invoices', to: '/sales/invoices' },
      { label: 'Sales Returns', to: '/sales/returns' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory', icon: Boxes, base: '/inventory', module: 'Inventory',
    children: [
      { label: 'Stock Overview', to: '/inventory/stock' },
      { label: 'Stock In', to: '/inventory/stock-in' },
      { label: 'Stock Out', to: '/inventory/stock-out' },
      { label: 'Stock Transfer', to: '/inventory/transfers' },
      { label: 'Stock Adjustment', to: '/inventory/adjustments' },
      { label: 'Stock Ledger', to: '/inventory/ledger' },
    ],
  },
  {
    key: 'production', label: 'Production', icon: Factory, base: '/production', module: 'Production',
    children: [
      { label: 'Bill of Material', to: '/production/bom' },
      { label: 'Process Routes', to: '/production/routings' },
      { label: 'Production Orders', to: '/production/orders' },
      { label: 'Shop Floor (WIP)', to: '/production/shop-floor' },
      { label: 'Material Issue', to: '/production/material-issue' },
      { label: 'Production Entry', to: '/production/entries' },
      { label: 'Job Work', to: '/production/job-work' },
      { label: 'Production Costing', to: '/production/costing' },
      { label: 'Wastage & Rejection', to: '/production/wastage' },
    ],
  },
  {
    key: 'quality', label: 'Quality', icon: ClipboardCheck, base: '/quality', module: 'Quality',
    children: [
      { label: 'QC Dashboard', to: '/quality', end: true },
      { label: 'Inspections', to: '/quality/inspections' },
      { label: 'QC Plans', to: '/quality/plans' },
    ],
  },
  {
    key: 'hr', label: 'HR & Payroll', icon: CalendarCheck, base: '/hr', module: 'HR',
    children: [
      { label: 'Attendance Dashboard', to: '/hr', end: true },
      { label: 'Mark Attendance', to: '/hr/attendance' },
      { label: 'Attendance Register', to: '/hr/register' },
      { label: 'Leave Applications', to: '/hr/leaves' },
      { label: 'Leave Types', to: '/hr/leave-types' },
      { label: 'Holidays', to: '/hr/holidays' },
      { label: 'Salary / Payroll', to: '/hr/payroll', module: 'Payroll' },
      { label: 'Employees', to: '/masters/employees' },
    ],
  },
  {
    key: 'accounts', label: 'Accounts', icon: Landmark, base: '/accounts', module: 'Accounts',
    children: [
      { label: 'Customer Receipts', to: '/accounts/receipts' },
      { label: 'Supplier Payments', to: '/accounts/payments' },
      { label: 'Customer Ledger', to: '/accounts/customer-ledger' },
      { label: 'Supplier Ledger', to: '/accounts/supplier-ledger' },
      { label: 'Outstanding', to: '/accounts/outstanding' },
      { label: 'Cash & Bank', to: '/accounts/cash-bank' },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: BarChart3, base: '/reports', module: 'Reports',
    children: [
      { label: 'Reports Center', to: '/reports', end: true },
      { label: 'Sales Summary', to: '/reports/sales-summary' },
      { label: 'Stock Report', to: '/reports/stock-report' },
      { label: 'Production Summary', to: '/reports/production-summary' },
      { label: 'GST Summary', to: '/reports/tax-summary' },
    ],
  },
  {
    key: 'users', label: 'Users & Access', icon: ShieldCheck, base: '/users', module: 'Users & Access',
    children: [
      { label: 'Users', to: '/users', end: true },
      { label: 'Roles & Permissions', to: '/users/roles' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Settings, base: '/settings', module: 'Settings',
    children: [
      { label: 'Company Profile', to: '/settings/company' },
      { label: 'Tax Settings', to: '/settings/tax' },
      { label: 'Invoice Settings', to: '/settings/invoice' },
      { label: 'Payment Terms', to: '/settings/payment-terms' },
    ],
  },
]
