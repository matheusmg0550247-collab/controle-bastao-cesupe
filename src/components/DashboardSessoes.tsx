import { useState, useEffect, useMemo } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { EQUIPE_EPROC, EQUIPE_JPE, TODOS_CONSULTORES, getRamal } from '../constants'
import { supabase } from '../lib/supabase'

interface DailyLogEntry {
  consultor: string;
  payload: { bastoes_assumidos?: number; equipe?: string; ultima_passagem?: string };
}

export function DashboardSessoes() {
  const { filaEproc, filaJpe, statusTexto, quickIndicators } = useBastaoStore()
  const [abaAtiva, setAbaAtiva] = useState<'visao' | 'sessoes' | 'plantao'>('visao')
  const [logsHoje, setLogsHoje] = useState<DailyLogEntry[]>([])
  const [horaAtual, setHoraAtual] = useState(new Date())

  // Relógio atualizado a cada minuto
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  // Buscar logs do dia (bastões passados)
  useEffect(() => {
    const fetchLogs = async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('daily_logs')
        .select('consultor, payload')
        .eq('date', hoje)
        .eq('source', 'bastao_pass')
      if (data) setLogsHoje(data as DailyLogEntry[])
    }
    fetchLogs()
    const interval = setInterval(fetchLogs, 30000)
    return () => clearInterval(interval)
  }, [])

  // Métricas calculadas
  const metricas = useMemo(() => {
    const todosNaFila = [...filaEproc, ...filaJpe]
    const todosStatus = Object.entries(statusTexto)

    const ativos = todosNaFila.length
    const emAlmoco = todosStatus.filter(([, s]) => s === 'Almoço').length
    const emLanche = todosStatus.filter(([, s]) => s === 'Lanche').length
    const emTelefone = Object.entries(quickIndicators).filter(([, ind]) => ind.telefone).length
    const emCafe = Object.entries(quickIndicators).filter(([, ind]) => ind.cafe).length
    const indisponiveis = TODOS_CONSULTORES.filter(n => !todosNaFila.includes(n) && statusTexto[n] !== 'Almoço' && statusTexto[n] !== 'Lanche').length
    const totalBastoes = logsHoje.reduce((acc, l) => acc + (l.payload?.bastoes_assumidos || 0), 0)

    return { ativos, emAlmoco, emLanche, emTelefone, emCafe, indisponiveis, totalBastoes }
  }, [filaEproc, filaJpe, statusTexto, quickIndicators, logsHoje])

  // Ranking de bastões do dia
  const rankingBastoes = useMemo(() => {
    return logsHoje
      .map(l => ({ nome: l.consultor, bastoes: l.payload?.bastoes_assumidos || 0, equipe: l.payload?.equipe || '?' }))
      .sort((a, b) => b.bastoes - a.bastoes)
      .slice(0, 10)
  }, [logsHoje])

  // Status de cada consultor por equipe
  const getStatusVisual = (nome: string) => {
    const status = statusTexto[nome] || ''
    const ind = quickIndicators[nome] || { telefone: false, cafe: false, lanche: false }
    const naFilaEproc = filaEproc.includes(nome)
    const naFilaJpe = filaJpe.includes(nome)
    const naFila = naFilaEproc || naFilaJpe

    if (status === 'Almoço') return { cor: 'bg-amber-100 text-amber-800 border-amber-300', icone: '🍽️', texto: 'Almoço' }
    if (status === 'Lanche') return { cor: 'bg-orange-100 text-orange-800 border-orange-300', icone: '🥪', texto: 'Lanche' }
    if (ind.telefone) return { cor: 'bg-blue-100 text-blue-800 border-blue-300', icone: '📞', texto: 'Telefone' }
    if (ind.cafe) return { cor: 'bg-yellow-100 text-yellow-800 border-yellow-300', icone: '☕', texto: 'Café' }
    if (naFila) {
      const pos = naFilaEproc ? filaEproc.indexOf(nome) : filaJpe.indexOf(nome)
      if (pos === 0) return { cor: 'bg-green-100 text-green-800 border-green-400', icone: '🏏', texto: 'Com Bastão' }
      return { cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', icone: '✅', texto: `Fila #${pos + 1}` }
    }
    if (status === 'Indisponível') return { cor: 'bg-red-100 text-red-700 border-red-300', icone: '🔴', texto: 'Indisponível' }
    return { cor: 'bg-gray-100 text-gray-500 border-gray-200', icone: '⚪', texto: 'Fora' }
  }

  // Horário do turno
  const agora = horaAtual.getHours()
  const turnoAtual = agora < 12 ? 'Manhã' : agora < 18 ? 'Tarde' : 'Noite'
  const turnoIcone = agora < 12 ? '🌅' : agora < 18 ? '☀️' : '🌙'

  const tabClass = (tab: string) =>
    `px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${abaAtiva === tab ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <div>
            <h2 className="text-white font-extrabold text-lg">Dashboard — Sessões & Plantões</h2>
            <p className="text-white/70 text-xs">
              {turnoIcone} Turno: {turnoAtual} • {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAbaAtiva('visao')} className={tabClass('visao')}>Visão Geral</button>
          <button onClick={() => setAbaAtiva('sessoes')} className={tabClass('sessoes')}>Sessões Ativas</button>
          <button onClick={() => setAbaAtiva('plantao')} className={tabClass('plantao')}>Plantão</button>
        </div>
      </div>

      <div className="p-6">
        {/* ====================== VISÃO GERAL ====================== */}
        {abaAtiva === 'visao' && (
          <div className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              {[
                { label: 'Na Fila', valor: metricas.ativos, cor: 'from-emerald-500 to-green-600', icone: '✅' },
                { label: 'Almoço', valor: metricas.emAlmoco, cor: 'from-amber-400 to-amber-600', icone: '🍽️' },
                { label: 'Lanche', valor: metricas.emLanche, cor: 'from-orange-400 to-orange-600', icone: '🥪' },
                { label: 'Telefone', valor: metricas.emTelefone, cor: 'from-blue-400 to-blue-600', icone: '📞' },
                { label: 'Café', valor: metricas.emCafe, cor: 'from-yellow-400 to-yellow-600', icone: '☕' },
                { label: 'Fora', valor: metricas.indisponiveis, cor: 'from-gray-400 to-gray-600', icone: '⚪' },
                { label: 'Bastões Hoje', valor: metricas.totalBastoes, cor: 'from-violet-500 to-purple-700', icone: '🏏' },
              ].map((card) => (
                <div key={card.label} className={`bg-gradient-to-br ${card.cor} rounded-xl p-4 text-white shadow-md`}>
                  <div className="text-2xl mb-1">{card.icone}</div>
                  <div className="text-3xl font-black">{card.valor}</div>
                  <div className="text-xs font-bold opacity-80">{card.label}</div>
                </div>
              ))}
            </div>

            {/* Ranking de Bastões do Dia */}
            {rankingBastoes.length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h3 className="font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                  🏆 Ranking de Bastões Hoje
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {rankingBastoes.map((r, i) => (
                    <div key={r.nome} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                      <span className="text-lg font-black text-gray-400 w-6">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate text-gray-800">{r.nome}</div>
                        <div className="text-xs text-gray-400">{r.equipe}</div>
                      </div>
                      <span className="bg-violet-100 text-violet-700 font-black text-sm px-2 py-0.5 rounded-lg">{r.bastoes}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo por Equipe */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResumoEquipe titulo="EPROC" equipe={EQUIPE_EPROC} fila={filaEproc} getStatus={getStatusVisual} cor="blue" />
              <ResumoEquipe titulo="JPE / Legados" equipe={EQUIPE_JPE} fila={filaJpe} getStatus={getStatusVisual} cor="purple" />
            </div>
          </div>
        )}

        {/* ====================== SESSÕES ATIVAS ====================== */}
        {abaAtiva === 'sessoes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sessão EPROC */}
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-blue-800 text-lg flex items-center gap-2">
                    ⚖️ Sessão EPROC
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${filaEproc.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {filaEproc.length > 0 ? `${filaEproc.length} na fila` : 'Sem fila'}
                  </span>
                </div>
                {filaEproc.length > 0 ? (
                  <div className="space-y-2">
                    {filaEproc.map((nome, i) => {
                      const sv = getStatusVisual(nome)
                      return (
                        <div key={nome} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${i === 0 ? 'bg-green-50 border-green-300 ring-2 ring-green-200' : 'bg-white border-gray-200'}`}>
                          <span className="font-black text-lg w-8 text-center text-gray-400">{i === 0 ? '🏏' : `${i + 1}º`}</span>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800">{nome}</div>
                            <div className="text-xs text-gray-400">Ramal: {getRamal(nome)}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${sv.cor}`}>{sv.icone} {sv.texto}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-blue-400 text-sm italic">Nenhum consultor na fila EPROC</p>
                )}
              </div>

              {/* Sessão JPE */}
              <div className="bg-purple-50 rounded-xl border border-purple-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-extrabold text-purple-800 text-lg flex items-center gap-2">
                    ⚖️ Sessão JPE / Legados
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${filaJpe.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {filaJpe.length > 0 ? `${filaJpe.length} na fila` : 'Sem fila'}
                  </span>
                </div>
                {filaJpe.length > 0 ? (
                  <div className="space-y-2">
                    {filaJpe.map((nome, i) => {
                      const sv = getStatusVisual(nome)
                      return (
                        <div key={nome} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${i === 0 ? 'bg-green-50 border-green-300 ring-2 ring-green-200' : 'bg-white border-gray-200'}`}>
                          <span className="font-black text-lg w-8 text-center text-gray-400">{i === 0 ? '🏏' : `${i + 1}º`}</span>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800">{nome}</div>
                            <div className="text-xs text-gray-400">Ramal: {getRamal(nome)}</div>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${sv.cor}`}>{sv.icone} {sv.texto}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-purple-400 text-sm italic">Nenhum consultor na fila JPE</p>
                )}
              </div>
            </div>

            {/* Quem está fora */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="font-extrabold text-gray-700 mb-3">🚫 Consultores Fora da Sessão</h3>
              <div className="flex flex-wrap gap-2">
                {TODOS_CONSULTORES.filter(n => !filaEproc.includes(n) && !filaJpe.includes(n)).map(nome => {
                  const sv = getStatusVisual(nome)
                  return (
                    <span key={nome} className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${sv.cor}`}>
                      {sv.icone} {nome}
                      {sv.texto !== 'Fora' && sv.texto !== 'Indisponível' ? ` (${sv.texto})` : ''}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====================== PLANTÃO ====================== */}
        {abaAtiva === 'plantao' && (
          <div className="space-y-6">
            {/* Info do Turno Atual */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-4xl">{turnoIcone}</span>
                <div>
                  <h3 className="font-extrabold text-indigo-800 text-xl">Turno {turnoAtual}</h3>
                  <p className="text-indigo-500 text-sm">
                    {horaAtual.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    {' • '}
                    {horaAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
                  <div className="text-3xl font-black text-indigo-700">{filaEproc.length + filaJpe.length}</div>
                  <div className="text-xs font-bold text-indigo-400">Consultores Ativos</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
                  <div className="text-3xl font-black text-emerald-600">{filaEproc.length}</div>
                  <div className="text-xs font-bold text-indigo-400">EPROC</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
                  <div className="text-3xl font-black text-purple-600">{filaJpe.length}</div>
                  <div className="text-xs font-bold text-indigo-400">JPE</div>
                </div>
              </div>
            </div>

            {/* Tabela Completa de Status */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-extrabold text-gray-600">Consultor</th>
                    <th className="text-center px-4 py-3 font-extrabold text-gray-600">Equipe</th>
                    <th className="text-center px-4 py-3 font-extrabold text-gray-600">Ramal</th>
                    <th className="text-center px-4 py-3 font-extrabold text-gray-600">Status</th>
                    <th className="text-center px-4 py-3 font-extrabold text-gray-600">Posição Fila</th>
                    <th className="text-center px-4 py-3 font-extrabold text-gray-600">Bastões Hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {TODOS_CONSULTORES.map((nome) => {
                    const sv = getStatusVisual(nome)
                    const equipe = EQUIPE_EPROC.includes(nome) ? 'EPROC' : 'JPE'
                    const fila = equipe === 'EPROC' ? filaEproc : filaJpe
                    const posicao = fila.indexOf(nome)
                    const logConsultor = logsHoje.find(l => l.consultor === nome)
                    const bastoesHoje = logConsultor?.payload?.bastoes_assumidos || 0

                    return (
                      <tr key={nome} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-gray-800">{nome}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${equipe === 'EPROC' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {equipe}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-gray-500">{getRamal(nome)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${sv.cor}`}>{sv.icone} {sv.texto}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-gray-600">
                          {posicao === 0 ? '🏏 1º' : posicao > 0 ? `${posicao + 1}º` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {bastoesHoje > 0 ? (
                            <span className="bg-violet-100 text-violet-700 font-black px-2 py-0.5 rounded-lg">{bastoesHoje}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Componente auxiliar: Resumo por equipe
function ResumoEquipe({ titulo, equipe, fila, getStatus, cor }: {
  titulo: string; equipe: string[]; fila: string[];
  getStatus: (nome: string) => { cor: string; icone: string; texto: string };
  cor: 'blue' | 'purple';
}) {
  const corBase = cor === 'blue'
    ? 'bg-blue-50 border-blue-200'
    : 'bg-purple-50 border-purple-200'
  const corTitulo = cor === 'blue' ? 'text-blue-800' : 'text-purple-800'

  return (
    <div className={`rounded-xl border p-4 ${corBase}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-extrabold ${corTitulo}`}>⚖️ {titulo}</h3>
        <span className="text-xs font-bold text-gray-400">{fila.length}/{equipe.length} ativos</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {equipe.map(nome => {
          const sv = getStatus(nome)
          return (
            <div key={nome} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs ${sv.cor}`}>
              <span>{sv.icone}</span>
              <span className="font-bold truncate">{nome}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
