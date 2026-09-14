/** Users & Access routes — frontend-only demo. */
import { Route, Routes } from 'react-router-dom'
import NotFound from '../../pages/NotFound.jsx'
import UsersPage from './UsersPage.jsx'
import RolesPage from './RolesPage.jsx'

export default function UsersModule() {
  return (
    <Routes>
      <Route index element={<UsersPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
