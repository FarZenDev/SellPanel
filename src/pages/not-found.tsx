import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page introuvable"
      description="Cette page n’existe pas ou a été supprimée."
      action={
        <Link to="/">
          <Button variant="primary">Retour au tableau de bord</Button>
        </Link>
      }
    />
  )
}
