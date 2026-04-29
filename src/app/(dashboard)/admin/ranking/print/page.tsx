import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PrintButton } from '@/components/admin/print-button'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const CAT_ORDER = ['M4', 'M5', 'F54', 'MX']

export default async function RankingPrintPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const { data: tournament } = await admin
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'draft'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: categories } = await admin
    .from('categories')
    .select('*')
    .order('sort_order')

  const { data: rankings } = await admin
    .from('rankings')
    .select('*, team:teams(name, player1_name, player2_name, status)')
    .order('position')

  type RankingRow = NonNullable<typeof rankings>[number]
  const byCategory: Record<string, RankingRow[]> = {}
  for (const r of rankings ?? []) {
    if (!byCategory[r.category_id]) byCategory[r.category_id] = []
    byCategory[r.category_id]!.push(r)
  }

  const sortedCats = (categories ?? []).sort(
    (a: any, b: any) => CAT_ORDER.indexOf(a.code) - CAT_ORDER.indexOf(b.code)
  )

  const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-4">
      {/* Barra de controlo — só visível no ecrã */}
      <div className="print:hidden flex items-center justify-between mb-8 pb-4 border-b">
        <div>
          <h1 className="text-xl font-bold">Ranking — {tournament?.name} {tournament?.season}</h1>
          <p className="text-sm text-gray-500">Gerado em {today}</p>
        </div>
        <PrintButton />
      </div>

      {/* Cabeçalho para impressão */}
      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-2xl font-black">EMTP — Torneio Escada 2026</h1>
        <p className="text-base font-semibold mt-1">Ranking {today}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-6">
        {sortedCats.map((cat: any) => {
          const rows = byCategory[cat.id] ?? []
          if (rows.length === 0) return null
          return (
            <div key={cat.id} className="break-inside-avoid">
              <h2 className="text-base font-black uppercase tracking-widest mb-3 border-b-2 border-black pb-1">
                {cat.code === 'F54' ? 'F5/4' : cat.code} — {cat.name}
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {rows.map((r) => {
                    const team = Array.isArray(r.team) ? r.team[0] : r.team
                    const suspended = team?.status === 'suspended'
                    return (
                      <tr key={r.id} className={`border-b border-gray-100 ${suspended ? 'opacity-40' : ''}`}>
                        <td className="py-1.5 w-8 font-black text-gray-400 text-base">{r.position}</td>
                        <td className="py-1.5">
                          <p className="font-semibold">{team?.name}{suspended ? ' (suspensa)' : ''}</p>
                          <p className="text-xs text-gray-500">{team?.player1_name}{team?.player2_name ? ` / ${team.player2_name}` : ''}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      <div className="hidden print:block mt-8 pt-4 border-t text-xs text-gray-400 text-center">
        Escola Municipal de Ténis e Padel · Oliveira do Bairro · emtp.vercel.app
      </div>
    </div>
  )
}
