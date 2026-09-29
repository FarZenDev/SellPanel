import { ArrowLeft, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { slotOf } from '@shared/compat'
import { CONDITIONS, PC_SLOTS } from '@shared/constants'
import { buildListingTitle, specSummary } from '@shared/listing'
import { Button } from '@/components/ui/button'
import { photoUrl } from '@/lib/api'
import { eur0, fmtDate } from '@/lib/format'
import { useBuild, useLookups } from '@/lib/queries'

/** Fiche technique à remettre à l'acheteur (impression ou « Enregistrer en PDF »). */
export function BuildPrintPage() {
  const id = Number(useParams().id)
  const { data: build } = useBuild(id)
  const lk = useLookups()
  if (!build || !lk.meta) return null
  const shop = lk.meta.settings.shop_name
  const price = build.sale_price ?? build.listed_price ?? build.target_price
  const benches = build.benchmarks.filter((b) => b.label && b.value)
  const tests = build.checklist.filter((c) => c.done)

  return (
    <div className="min-h-dvh bg-surface-2 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-4">
        <Link to={`/builds/${build.id}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> Retour à la fiche
        </Link>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer /> Imprimer / PDF
        </Button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-10 text-[13px] text-zinc-900 shadow-xl print:max-w-none print:p-0 print:shadow-none" style={{ colorScheme: 'light' }}>
        <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-5">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">{shop}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{buildListingTitle(build, build.components, lk.categories)}</h1>
            <p className="mt-1 text-zinc-600">
              {build.name}
              {build.usage && ` — ${build.usage}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Référence</p>
            <p className="font-mono text-base font-semibold">{build.ref}</p>
            {price != null && <p className="mt-2 text-2xl font-bold">{eur0(price)}</p>}
          </div>
        </header>

        {build.photos[0] && <img src={photoUrl(build.photos[0])} alt="" className="mt-6 max-h-72 w-full rounded-lg object-cover" />}

        {build.description && <p className="mt-6 leading-relaxed whitespace-pre-wrap text-zinc-700">{build.description}</p>}

        <h2 className="mt-7 mb-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">Configuration</h2>
        <table className="w-full border-collapse">
          <tbody>
            {PC_SLOTS.flatMap((slot) =>
              build.components
                .filter((c) => slotOf(c, lk.categories) === slot.value)
                .map((c, i) => (
                  <tr key={c.id} className="border-b border-zinc-200">
                    <td className="w-40 py-2 pr-4 align-top text-zinc-500">{i === 0 ? slot.label : ''}</td>
                    <td className="py-2 font-medium">{c.title}</td>
                    <td className="py-2 pl-4 text-right text-zinc-500">{specSummary(slot.value, c.specs)}</td>
                    <td className="w-28 py-2 pl-4 text-right text-xs text-zinc-400">{CONDITIONS.find((x) => x.value === c.condition)?.label}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>

        <div className="mt-7 grid grid-cols-2 gap-8">
          {benches.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">Performances mesurées</h2>
              <ul className="space-y-1.5">
                {benches.map((b) => (
                  <li key={b.id} className="flex justify-between border-b border-dotted border-zinc-300 pb-1">
                    <span>{b.label}</span>
                    <span className="font-semibold">
                      {b.value} {b.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {tests.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold tracking-widest text-zinc-500 uppercase">Contrôles effectués</h2>
              <ul className="space-y-1">
                {tests.map((t) => (
                  <li key={t.id} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    {t.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="mt-10 flex items-end justify-between border-t border-zinc-200 pt-5 text-xs text-zinc-500">
          <div>
            {build.warranty_months > 0 ? (
              <p className="text-sm font-semibold text-zinc-900">
                Garantie {build.warranty_months} mois{build.sale_date ? ` à compter du ${fmtDate(build.sale_date)}` : ''}
              </p>
            ) : (
              <p>Vendu sans garantie.</p>
            )}
            <p className="mt-1">Garantie hors casse, oxydation, modification matérielle et mauvaise utilisation. Conservez cette fiche.</p>
          </div>
          <p>Édité le {fmtDate(new Date().toISOString())}</p>
        </footer>
      </article>
    </div>
  )
}
