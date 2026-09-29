import * as Tooltip from '@radix-ui/react-tooltip'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { EditorsProvider } from './components/editors'
import { AppShell } from './components/layout/app-shell'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { ConfirmProvider } from './components/ui/dialog'
import { Input } from './components/ui/form'
import { api } from './lib/api'
import { queryClient } from './lib/queries'
import { useTheme } from './lib/theme'
import { BuildDetailPage } from './pages/build-detail'
import { BuildPrintPage } from './pages/build-print'
import { BuildsPage } from './pages/builds'
import { DashboardPage } from './pages/dashboard'
import { ExpensesPage } from './pages/expenses'
import { ItemDetailPage } from './pages/item-detail'
import { ItemsPage } from './pages/items'
import { LotDetailPage } from './pages/lot-detail'
import { LotsPage } from './pages/lots'
import { NotFoundPage } from './pages/not-found'
import { ReportsPage } from './pages/reports'
import { SalesPage } from './pages/sales'
import { SettingsPage } from './pages/settings'

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="mb-4 size-12 rounded-xl shadow-lg shadow-accent/30" />
          <h1 className="text-lg font-semibold">SellPanel</h1>
          <p className="mt-1 text-sm text-muted">Entrez le mot de passe pour accéder au panel.</p>
        </div>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await api.post('/api/auth/login', { password })
              onSuccess()
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" />
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={busy}>
            <Lock /> Se connecter
          </Button>
        </form>
      </Card>
    </div>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useQuery({ queryKey: ['auth'], queryFn: () => api.get<{ enabled: boolean; authenticated: boolean }>('/api/auth/status'), staleTime: Infinity })
  useEffect(() => {
    const onUnauthorized = () => void status.refetch()
    window.addEventListener('sp:unauthorized', onUnauthorized)
    return () => window.removeEventListener('sp:unauthorized', onUnauthorized)
  }, [status])
  if (status.isLoading) return null
  if (status.isError)
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sm text-muted">
        Impossible de joindre le serveur SellPanel. Vérifiez qu’il est démarré puis rechargez la page.
      </div>
    )
  if (status.data?.enabled && !status.data.authenticated)
    return (
      <Login
        onSuccess={async () => {
          await status.refetch()
          void queryClient.invalidateQueries()
        }}
      />
    )
  return <>{children}</>
}

export function App() {
  const [theme] = useTheme()
  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider>
        <BrowserRouter>
          <AuthGate>
            <ConfirmProvider>
              <EditorsProvider>
                <Routes>
                  <Route path="/builds/:id/print" element={<BuildPrintPage />} />
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="items" element={<ItemsPage />} />
                    <Route path="items/:id" element={<ItemDetailPage />} />
                    <Route path="builds" element={<BuildsPage />} />
                    <Route path="builds/:id" element={<BuildDetailPage />} />
                    <Route path="lots" element={<LotsPage />} />
                    <Route path="lots/:id" element={<LotDetailPage />} />
                    <Route path="sales" element={<SalesPage />} />
                    <Route path="expenses" element={<ExpensesPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
              </EditorsProvider>
            </ConfirmProvider>
          </AuthGate>
        </BrowserRouter>
      </Tooltip.Provider>
      <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
    </QueryClientProvider>
  )
}
