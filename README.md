# NexttGen ERP — Manufacturing & Trading Management System

A **frontend-only UI/UX demo** of a Manufacturing + Trading ERP for NexttGen Technologies, built for client presentations.

> There is **no backend, database, API, real payment or real GST integration**.
> Every screen runs on realistic mock data generated in the browser and saved to `localStorage`,
> so records you add during a demo (customers, orders, invoices, production…) stay on screen and flow through the whole system.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Live demo

https://insaneabhi07.github.io/nexttgen-erp/

The site is served from the `gh-pages` branch. To publish changes (Git Bash):

```bash
MSYS_NO_PATHCONV=1 BASE_PATH=/nexttgen-erp/ npx vite build
cp dist/index.html dist/404.html && touch dist/.nojekyll
cd dist && git init -b gh-pages && git add -A && git commit -m "Deploy" \
  && git push -f https://github.com/InsaneAbhi07/nexttgen-erp.git gh-pages && rm -rf .git
```

`404.html` lets deep links such as `/nexttgen-erp/sales/invoices` work on refresh.

## Demo login

| Role | Email | Password |
| --- | --- | --- |
| Owner / Super Admin | admin@nexttgen.com | demo123 |
| Manager | manager@nexttgen.com | demo123 |
| Accountant | accounts@nexttgen.com | demo123 |
| Sales user | sales@nexttgen.com | demo123 |

Use **Demo walkthrough** in the sidebar for the guided client flow, and **Reset demo data** in the profile menu to start fresh.

## What's inside

- **Dashboards** — Owner, Admin and Manager views driven by live mock data
- **Masters** — items, categories, brands, units, warehouses, customers, suppliers
- **Purchase** — requisition, purchase order, GRN, purchase invoice, purchase return
- **Sales** — quotation, sales order, delivery challan, GST tax invoice, sales return
- **Inventory** — stock overview, stock in/out, transfers, adjustments, stock ledger
- **Production** — BOM builder, production orders, material issue, production entry, costing, wastage
- **Accounts** — receipts, payments, customer/supplier ledgers, outstanding, cash & bank
- **Reports** — 30 sales, purchase, inventory, production, accounts and GST reports with Excel (CSV) / PDF (print) export
- **Users & access** — users, roles and permission matrix; company, tax, invoice and payment-term settings

## How the mock "backend" works

| File | Purpose |
| --- | --- |
| `src/data/seed.js` | Generates ~12 months of consistent sample data relative to today |
| `src/store/ErpStore.jsx` | React context holding all collections; persists to localStorage |
| `src/store/stockEngine.js` | Turns GRNs, issues, production, challans… into stock moves and syncs workflow statuses |
| `src/store/selectors.js` | Stock balances, ledgers, outstanding, costing — all derived in the browser |
| `src/components/ui` | Reusable UI kit (DataTable, Modal, Drawer, FormField, DatePicker, Toast, ConfirmDialog…) |
| `src/modules/*` | One folder per ERP module with its own nested routes |

Tech: React 19, Vite, React Router, Recharts, Lucide icons, IBM Plex (bundled locally, works offline).
