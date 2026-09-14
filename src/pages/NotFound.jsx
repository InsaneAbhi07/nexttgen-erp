import { Compass } from 'lucide-react'
import { Button, EmptyState } from '../components/ui/index.js'
import { usePageTitle } from '../utils/hooks.js'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="card" style={{ marginTop: 40 }}>
      <EmptyState
        icon={Compass}
        title="This page doesn’t exist"
        description="The link may be outdated. Use the sidebar or global search to find what you need."
        action={<Button variant="primary" to="/dashboard">Go to dashboard</Button>}
      />
    </div>
  )
}
