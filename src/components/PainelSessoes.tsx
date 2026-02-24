import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'

interface Atividade { consultor: string; date: string; atividade: string }
interface Plantao { tipo_dia: string; date: string; plantonistas: string }

function extrairSessoes(atividade: string): string[] {
  const upper = atividade.toUpperCase()
  if (!upper.includes('SESSÃO') && !upper.includes('SESSAO')) return []
  return atividade.split('/').map(s => s.trim()).filter(s => {
    const u = s.toUpperCase()
    return u.includes('SESSÃO') || u.includes('SESSAO')
  })
}

function getMonday(d: Date): Date {
  const dt = new Date(d); const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0, 0, 0, 0); return dt
}
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
}
function fmt(d: Date): string { return d.toISOString().split('T')[0] }
function fmtBR(d: Date): string { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }

const DIAS_LABEL: Record<number, string> = { 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira' }

interface SessaoAgrupada { nomeSessao: string; consultores: string[] }

export function PainelSessoes() {
  const [aberto, setAberto] = useState(false)
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [loading, setLoading] = useState(true)
  const [semanaOffset, setSemanaOffset] = useState(0)
  const [abaAtiva, setAbaAtiva] = useState<'sessoes' | 'plantoes'>('sessoes')
  const [popoverData, setPopoverData] = useState<{ sessao: SessaoAgrupada; x: number; y: number } | null>(null)
  const [filtroConsultor, setFiltroConsultor] = useState('')
  const meuLogin = useBastaoStore(s => s.meuLogin)

  const monday = useMemo(() => { const m = getMonday(new Date()); m.setDate(m.getDate() + semanaOffset * 7); return m }, [semanaOffset])
  const weekDays = useMemo(() => getWeekDays(monday), [monday])
  const weekStart = fmt(weekDays[0])
  const weekEndSun = (() => { const s = new Date(monday); s.setDate(monday.getDate() + 6); return fmt(s) })()

  useEffect(() => {
    if (!aberto) return
    const fetchData = async () => {
      setLoading(true)
      const [ativRes, plantRes] = await Promise.all([
        supabase.from('atividades_consultores').select('consultor, date, atividade').gte('date', weekStart).lte('date', weekEndSun).order('date'),
        supabase.from('plantonistas_fds').select('tipo_dia, date, plantonistas').gte('date', new Date().toISOString().split('T')[0]).order('date').limit(20)
      ])
      setAtividades(ativRes.data || [])
      setPlantoes(plantRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [weekStart, weekEndSun, aberto])

  const consultoresComSessao = useMemo(() => {
    const nomes = new Set<string>()
    for (const a of atividades) { if (extrairSessoes(a.atividade).length > 0) nomes.add(a.consultor) }
    return [...nomes].sort()
  }, [atividades])

  const sessoesPorDia = useMemo(() => {
    const result: Record<string, SessaoAgrupada[]> = {}
    for (const day of weekDays) {
      const dateStr = fmt(day)
      const sessoesMap: Record<string, string[]> = {}
      for (const a of atividades.filter(a => a.date === dateStr)) {
        for (const s of extrairSessoes(a.atividade)) {
          const key = s.toUpperCase().trim()
          if (!sessoesMap[key]) sessoesMap[key] = []
          if (!sessoesMap[key].includes(a.consultor)) sessoesMap[key].push(a.consultor)
        }
      }
      let agrupadas = Object.entries(sessoesMap).map(([nome, consultores]) => ({ nomeSessao: nome, consultores: consultores.sort() })).sort((a, b) => a.nomeSessao.localeCompare(b.nomeSessao))
      if (filtroConsultor) agrupadas = agrupadas.filter(s => s.consultores.includes(filtroConsultor))
      result[dateStr] = agrupadas
    }
    return result
  }, [atividades, weekDays, filtroConsultor])

  const totalSessoesSemana = useMemo(() => Object.values(sessoesPorDia).reduce((sum, arr) => sum + arr.length, 0), [sessoesPorDia])
  const hojeStr = fmt(new Date())

  useEffect(() => {
    const handler = () => setPopoverData(null)
    if (popoverData) { document.addEventListener('click', handler); return () => document.removeEventListener('click', handler) }
  }, [popoverData])

  const handleSessaoClick = (sessao: SessaoAgrupada, e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopoverData({ sessao, x: Math.min(rect.left, window.innerWidth - 340), y: Math.min(rect.bottom + 8, window.innerHeight - 250) })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* HEADER CLICÁVEL */}
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-xl font-bold text-gray-800">📅 Sessões & Plantões</h2>
        <div className="flex items-center gap-3">
          {!aberto && <span className="text-xs text-gray-400 font-bold">Clique para expandir</span>}
          <span className={`text-xl transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* CONTEÚDO COLAPSÁVEL */}
      {aberto && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {/* ABAS */}
          <div className="flex items-center gap-2 mt-4 mb-4">
            <button onClick={() => setAbaAtiva('sessoes')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'sessoes' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🎙️ Sessões</button>
            <button onClick={() => setAbaAtiva('plantoes')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'plantoes' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>🚨 Plantões</button>
          </div>

          {/* ======================== ABA SESSÕES ======================== */}
          {abaAtiva === 'sessoes' && (
            <>
              <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSemanaOffset(s => s - 1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm active:scale-95 transition-all">◀</button>
                  <button onClick={() => setSemanaOffset(0)} className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${semanaOffset === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>Hoje</button>
                  <button onClick={() => setSemanaOffset(s => s + 1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm active:scale-95 transition-all">▶</button>
                  <span className="text-sm font-black text-gray-500 ml-2">{fmtBR(weekDays[0])} — {fmtBR(weekDays[4])}</span>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black border border-purple-200">🎙️ {totalSessoesSemana} sessões</span>
              </div>

              {/* FILTRO POR CONSULTOR */}
              <div className="flex flex-wrap gap-3 mb-5 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-xs font-black text-gray-500">🔍 Filtrar:</span>
                <select value={filtroConsultor} onChange={(e) => setFiltroConsultor(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-bold bg-white focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none">
                  <option value="">Todos os consultores</option>
                  {consultoresComSessao.map(nome => <option key={nome} value={nome}>{nome}</option>)}
                </select>
                {meuLogin && consultoresComSessao.includes(meuLogin) && (
                  <button onClick={() => setFiltroConsultor(filtroConsultor === meuLogin ? '' : meuLogin)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filtroConsultor === meuLogin ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}>👤 Minhas Sessões</button>
                )}
                {filtroConsultor && (
                  <>
                    <button onClick={() => setFiltroConsultor('')} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-all">✖ Limpar</button>
                    <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">{totalSessoesSemana} sessão(ões) de {filtroConsultor}</span>
                  </>
                )}
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-400 font-bold">Carregando sessões...</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {weekDays.map(day => {
                    const dateStr = fmt(day); const isHoje = dateStr === hojeStr; const sessoesDoDia = sessoesPorDia[dateStr] || []; const dayNum = day.getDay()
                    return (
                      <div key={dateStr} className={`rounded-xl border-2 overflow-hidden transition-all ${isHoje ? 'border-purple-400 shadow-lg shadow-purple-100' : 'border-gray-200'}`}>
                        <div className={`px-4 py-2.5 flex items-center justify-between ${isHoje ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-sm">{DIAS_LABEL[dayNum] || ''}</span>
                            <span className={`text-xs font-bold ${isHoje ? 'text-purple-200' : 'text-gray-400'}`}>{day.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>
                            {isHoje && <span className="text-[10px] font-black bg-white text-purple-700 px-2 py-0.5 rounded-full">HOJE</span>}
                          </div>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isHoje ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-700'}`}>{sessoesDoDia.length} {sessoesDoDia.length === 1 ? 'sessão' : 'sessões'}</span>
                        </div>
                        <div className="p-4">
                          {sessoesDoDia.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">{filtroConsultor ? `Nenhuma sessão de ${filtroConsultor} neste dia` : 'Nenhuma sessão neste dia'}</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {sessoesDoDia.map((sessao, j) => {
                                const isVirtual = sessao.nomeSessao.toUpperCase().includes('VIRTUAL')
                                const isMinha = filtroConsultor && sessao.consultores.includes(filtroConsultor)
                                return (
                                  <button key={j} onClick={(e) => handleSessaoClick(sessao, e)} className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all hover:shadow-md hover:scale-[1.03] active:scale-95 cursor-pointer text-left ${isMinha ? 'bg-purple-200 text-purple-900 border-purple-400 ring-2 ring-purple-300' : isVirtual ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:border-indigo-400' : 'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-400'}`}>
                                    <div className="flex items-center gap-1.5">
                                      <span>{isVirtual ? '💻' : '🎙️'}</span>
                                      <span>{sessao.nomeSessao}</span>
                                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1 ${isVirtual ? 'bg-indigo-200 text-indigo-700' : 'bg-purple-200 text-purple-700'}`}>{sessao.consultores.length}👤</span>
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ======================== ABA PLANTÕES ======================== */}
          {abaAtiva === 'plantoes' && (
            <div>
              <h3 className="text-lg font-black text-gray-800 mb-4">🚨 Próximos Plantões e Feriados</h3>
              {loading ? (
                <div className="text-center py-12 text-gray-400 font-bold">Carregando...</div>
              ) : plantoes.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Nenhum plantão cadastrado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {plantoes.map((p, i) => {
                    const dt = new Date(p.date + 'T12:00:00'); const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
                    const diff = dt.getTime() - hoje.getTime(); const isHoje = fmt(dt) === hojeStr; const isProximo = diff >= 0 && diff <= 7 * 86400000
                    const isFeriado = p.tipo_dia.toUpperCase().includes('CARNAVAL') || p.tipo_dia.toUpperCase().includes('SANTA') || p.tipo_dia.toUpperCase().includes('PAIXÃO') || p.tipo_dia.toUpperCase().includes('FERIADO')
                    return (
                      <div key={i} className={`p-4 rounded-xl border-2 transition-all ${isHoje ? 'border-red-500 bg-red-50 shadow-lg shadow-red-200 ring-2 ring-red-300' : isProximo ? 'border-orange-400 bg-orange-50 shadow-md shadow-orange-100' : 'border-gray-200 bg-white hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[11px] font-black px-2 py-1 rounded-lg ${isFeriado ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-600'}`}>{isFeriado ? '🎉' : '📅'} {p.tipo_dia}</span>
                          {isHoje && <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">HOJE</span>}
                          {isProximo && !isHoje && <span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full">ESTA SEMANA</span>}
                        </div>
                        <p className="text-sm font-black text-gray-800 mb-1">{dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                        <p className="text-sm font-bold text-indigo-700">👥 {p.plantonistas}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* POPOVER */}
      {popoverData && (
        <div className="fixed z-[9999]" style={{ left: popoverData.x, top: popoverData.y }} onClick={e => e.stopPropagation()}>
          <div className="bg-white rounded-xl shadow-2xl border-2 border-purple-300 p-4 min-w-[280px] max-w-[380px]">
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-sm font-black text-purple-800 flex items-center gap-2">🎙️ {popoverData.sessao.nomeSessao}</h4>
              <button onClick={() => setPopoverData(null)} className="text-gray-400 hover:text-red-500 text-lg font-bold leading-none">✖</button>
            </div>
            <p className="text-[11px] text-gray-500 font-bold mb-2">{popoverData.sessao.consultores.length} consultor{popoverData.sessao.consultores.length > 1 ? 'es' : ''} responsáve{popoverData.sessao.consultores.length > 1 ? 'is' : 'l'}:</p>
            <div className="flex flex-col gap-1.5">
              {popoverData.sessao.consultores.map((nome, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${filtroConsultor === nome ? 'bg-purple-100 border-purple-300 ring-1 ring-purple-200' : 'bg-purple-50 border-purple-100'}`}>
                  <span className="text-sm">👤</span>
                  <span className="text-sm font-bold text-gray-800">{nome}</span>
                  {filtroConsultor === nome && <span className="text-[10px] bg-purple-600 text-white px-1.5 rounded-full font-black ml-auto">você</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
