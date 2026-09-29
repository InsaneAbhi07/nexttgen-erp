/** Masters module routes — frontend-only demo. */
import { Navigate, Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import ItemsPage from './ItemsPage.jsx'
import WarehousesPage from './WarehousesPage.jsx'
import { BrandsPage, CategoriesPage, UnitsPage } from './SimpleMasters.jsx'
import { CustomersPage, SuppliersPage } from './PartyPages.jsx'
import VariantsPage from './VariantsPage.jsx'
import VariantFamilyView from './VariantFamilyView.jsx'

export default function MastersModule() {
  return (
    <Routes>
      <Route index element={<Navigate to="/masters/items" replace />} />
      <Route path="items" element={<ItemsPage />} />
      <Route path="variants" element={<VariantsPage />} />
      <Route path="variants/:id" element={<VariantFamilyView />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="brands" element={<BrandsPage />} />
      <Route path="units" element={<UnitsPage />} />
      <Route path="warehouses" element={<WarehousesPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="suppliers" element={<SuppliersPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
