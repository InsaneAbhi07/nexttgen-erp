/**
 * Production module routes — BOM, production orders, material issue,
 * production entry, costing, wastage, process routes, shop-floor WIP and job work. Frontend-only demo (mock store).
 */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import BomList from './BomList.jsx'
import BomForm from './BomForm.jsx'
import BomView from './BomView.jsx'
import OrderList from './OrderList.jsx'
import OrderForm from './OrderForm.jsx'
import OrderView from './OrderView.jsx'
import IssueList from './IssueList.jsx'
import IssueForm from './IssueForm.jsx'
import IssueView from './IssueView.jsx'
import EntryList from './EntryList.jsx'
import EntryForm from './EntryForm.jsx'
import EntryView from './EntryView.jsx'
import CostingPage from './CostingPage.jsx'
import WastagePage from './WastagePage.jsx'
import RoutingPage from './RoutingPage.jsx'
import ShopFloorPage from './ShopFloorPage.jsx'
import JobWorkList from './JobWorkList.jsx'
import JobWorkForm from './JobWorkForm.jsx'
import JobWorkView from './JobWorkView.jsx'
import './production.css'

export default function ProductionModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="orders" replace />} />
      <Route path="bom" element={<BomList />} />
      <Route path="bom/new" element={<BomForm key="new" />} />
      <Route path="bom/:id" element={<BomView />} />
      <Route path="bom/:id/edit" element={<BomForm />} />
      <Route path="orders" element={<OrderList />} />
      <Route path="orders/new" element={<OrderForm key="new" />} />
      <Route path="orders/:id" element={<OrderView />} />
      <Route path="orders/:id/edit" element={<OrderForm />} />
      <Route path="material-issue" element={<IssueList />} />
      <Route path="material-issue/new" element={<IssueForm />} />
      <Route path="material-issue/:id" element={<IssueView />} />
      <Route path="entries" element={<EntryList />} />
      <Route path="entries/new" element={<EntryForm />} />
      <Route path="entries/:id" element={<EntryView />} />
      <Route path="costing" element={<CostingPage />} />
      <Route path="wastage" element={<WastagePage />} />
      <Route path="routings" element={<RoutingPage />} />
      <Route path="shop-floor" element={<ShopFloorPage />} />
      <Route path="job-work" element={<JobWorkList />} />
      <Route path="job-work/new" element={<JobWorkForm key="new" />} />
      <Route path="job-work/:id" element={<JobWorkView />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
