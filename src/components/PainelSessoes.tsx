import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal, EQUIPE_EPROC, EQUIPE_JPE } from '../constants'

// Retorna primeiro + último nome para diferenciar consultores com mesmo primeiro nome
function nomeExibicao(nome: string): string {
  const p = nome.trim().split(' ').filter(Boolean)
  if (p.length <= 1) return nome
  return p[0] + ' ' + p[p.length - 1]
}



interface Atividade { consultor: string; date: string; atividade: string }
interface Plantao   { tipo_dia: string; date: string; plantonistas: string }
interface AgendaDetalhe {
  id: string; data: string; nome_sessao: string; modalidade?: string
  horario?: string; plenario?: string; descricao?: string
  pauta?: number; mesa?: number; consultores: string[]
}
interface AgendaAtividade {
  id: string; data: string; tipo: string; observacao?: string; consultores: string[]
}
interface SessaoAgrupada { nomeSessao: string; consultores: string[]; detalhe?: AgendaDetalhe }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extrairSessoes(atividade: string): string[] {
  const upper = atividade.toUpperCase()
  if (!upper.includes('SESSÃO') && !upper.includes('SESSAO')) return []
  return atividade.split('/').map(s => s.trim()).filter(s => {
    const u = s.toUpperCase(); return u.includes('SESSÃO') || u.includes('SESSAO')
  })
}
function getMonday(d: Date): Date {
  const dt = new Date(d); const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0); return dt
}
function getWeekDays(monday: Date): Date[] {
  return Array.from({length:5},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d })
}
function fmt(d: Date): string { return d.toISOString().split('T')[0] }
function fmtBR(d: Date): string { return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) }
const DIAS_LABEL: Record<number,string> = {1:'Segunda-feira',2:'Terça-feira',3:'Quarta-feira',4:'Quinta-feira',5:'Sexta-feira'}

// Ícone/cor por tipo atividade
const TIPO_CFG: Record<string,{icon:string;badge:string}> = {
  'Compensação':               {icon:'🌴', badge:'bg-emerald-100 text-emerald-700'},
  'Férias':                    {icon:'✈️', badge:'bg-sky-100 text-sky-700'},
  'Treinamento':               {icon:'🎓', badge:'bg-amber-100 text-amber-700'},
  'Treinamento Boas Práticas': {icon:'🎓', badge:'bg-amber-100 text-amber-700'},
  'Projeto Boas Práticas':     {icon:'🎓', badge:'bg-amber-100 text-amber-700'},
  'Reunião':                   {icon:'📅', badge:'bg-teal-100 text-teal-700'},
  'Reunião ASCOM':             {icon:'📅', badge:'bg-teal-100 text-teal-700'},
  'HP':                        {icon:'🎯', badge:'bg-indigo-100 text-indigo-700'},
  'DJEN/TH':                   {icon:'📋', badge:'bg-blue-100 text-blue-700'},
  'DJEN/TH/BNMP':              {icon:'📋', badge:'bg-blue-100 text-blue-700'},
  'BNMP':                      {icon:'⚖️', badge:'bg-purple-100 text-purple-700'},
  'TRE':                       {icon:'🏋️', badge:'bg-orange-100 text-orange-700'},
  'TRE PLANTÃO':               {icon:'🏋️', badge:'bg-orange-100 text-orange-700'},
  'Plantão':                   {icon:'🔴', badge:'bg-red-100 text-red-700'},
  'WhatsApp eproc/HP':         {icon:'💬', badge:'bg-green-100 text-green-700'},
  'Atestado':                  {icon:'🏥', badge:'bg-rose-100 text-rose-700'},
}
const getCfgAtv = (tipo: string) => TIPO_CFG[tipo] ?? {icon:'📌', badge:'bg-gray-100 text-gray-600'}

// Cor por modalidade
const COR_MOD: Record<string,{bg:string;border:string;text:string}> = {
  'PRESENCIAL':       {bg:'bg-violet-50', border:'border-violet-300', text:'text-violet-800'},
  'VIRTUAL':          {bg:'bg-cyan-50',   border:'border-cyan-300',   text:'text-cyan-800'},
  'HÍBRIDA':          {bg:'bg-indigo-50', border:'border-indigo-300', text:'text-indigo-800'},
  'VIDEOCONFERÊNCIA': {bg:'bg-sky-50',    border:'border-sky-300',    text:'text-sky-800'},
}
const ICON_MOD: Record<string,string> = {'PRESENCIAL':'🏛️','VIRTUAL':'🖥️','HÍBRIDA':'🔀','VIDEOCONFERÊNCIA':'📹'}

// ─── Popover FIXED com detalhes da sessão ────────────────────────────────────
function PopoverSessao({ sessao, pos, onClose }: {
  sessao: SessaoAgrupada
  pos: { x: number; y: number }
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Ajusta posição para não sair da tela
  const [style, setStyle] = useState<React.CSSProperties>({ position:'fixed', left: pos.x, top: pos.y, zIndex: 9999 })

  useEffect(() => {
    const fn = (e: MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', fn)

    // Calcula posição real após montar
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      const vw = window.innerWidth, vh = window.innerHeight
      let x = pos.x, y = pos.y
      if (x + rect.width > vw - 12) x = vw - rect.width - 12
      if (y + rect.height > vh - 12) y = pos.y - rect.height - 8
      if (x < 8) x = 8
      if (y < 8) y = 8
      setStyle({ position:'fixed', left: x, top: y, zIndex: 9999 })
    }

    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const d = sessao.detalhe
  const cor = COR_MOD[d?.modalidade||''] ?? {bg:'bg-purple-50', border:'border-purple-300', text:'text-purple-800'}
  const isVirtual = sessao.nomeSessao.toUpperCase().includes('VIRTUAL')

  return (
    <div ref={ref} style={style}
      className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden w-80">
      {/* Header */}
      <div className={`${cor.bg} border-b ${cor.border} p-4`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{d?.modalidade ? ICON_MOD[d.modalidade]||'🏛️' : isVirtual ? '🖥️' : '🏛️'}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${cor.text}`}>
              {d?.modalidade ?? (isVirtual ? 'VIRTUAL' : 'SESSÃO')}
            </span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm leading-none">✕</button>
        </div>
        <p className={`text-sm font-black leading-tight ${cor.text}`}>{sessao.nomeSessao}</p>
        {(d?.horario || d?.plenario) && (
          <div className="flex gap-3 mt-1.5 text-xs opacity-75">
            {d?.horario  && <span>🕐 {d.horario}</span>}
            {d?.plenario && <span>🏛️ Plenário {d.plenario}</span>}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5">
        {(d?.pauta || d?.mesa) && (
          <div className="flex gap-2">
            {d?.pauta ? <span className="text-xs bg-violet-50 text-violet-700 font-bold px-2 py-1 rounded-lg">📋 Pauta: {d.pauta}</span> : null}
            {d?.mesa  ? <span className="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-lg">🪑 Mesa: {d.mesa}</span>  : null}
          </div>
        )}
        {d?.descricao && (
          <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-relaxed">
            💬 {d.descricao}
          </p>
        )}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1.5">Consultores</p>
          <div className="flex flex-wrap gap-1">
            {sessao.consultores.length === 0
              ? <span className="text-xs text-gray-300 italic">Nenhum</span>
              : sessao.consultores.map(c => (
                <span key={c} className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">
                  {c}
                </span>
              ))
            }
          </div>
        </div>
        {!d && (
          <p className="text-[10px] text-gray-300 italic text-center">Sem detalhes adicionados pela secretaria</p>
        )}
      </div>
    </div>
  )
}

// ─── Chip de sessão ───────────────────────────────────────────────────────────
function ChipSessao({ sessao, filtroConsultor }: { sessao: SessaoAgrupada; filtroConsultor: string }) {
  const [popoverPos, setPopoverPos] = useState<{x:number;y:number}|null>(null)
  const isVirtual  = sessao.nomeSessao.toUpperCase().includes('VIRTUAL')
  const isMinha    = filtroConsultor && sessao.consultores.includes(filtroConsultor)
  const temDetalhe = !!sessao.detalhe

  const baseClass = isMinha
    ? 'bg-purple-200 text-purple-900 border-purple-400 ring-2 ring-purple-300'
    : isVirtual
    ? 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:border-indigo-400'
    : 'bg-purple-50 text-purple-800 border-purple-200 hover:border-purple-400'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (popoverPos) { setPopoverPos(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopoverPos({ x: rect.left, y: rect.bottom + 6 })
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all hover:shadow-md hover:scale-[1.02] active:scale-95 cursor-pointer text-left ${baseClass} ${temDetalhe ? 'ring-1 ring-offset-1 ring-violet-300' : ''}`}
      >
        <div className="flex items-center gap-1.5">
          <span>{isVirtual ? '🖥️' : '🏛️'}</span>
          <span>{sessao.nomeSessao}</span>
          {sessao.detalhe?.horario && (
            <span className="text-[10px] opacity-60 ml-0.5">{sessao.detalhe.horario}</span>
          )}
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1 ${isVirtual ? 'bg-indigo-200 text-indigo-700' : 'bg-purple-200 text-purple-700'}`}>
            {sessao.consultores.length}👤
          </span>
        </div>
      </button>
      {popoverPos && (
        <PopoverSessao sessao={sessao} pos={popoverPos} onClose={() => setPopoverPos(null)} />
      )}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function PainelSessoes() {
  const [aberto,         setAberto]         = useState(false)
  const [atividades,     setAtividades]     = useState<Atividade[]>([])
  const [plantoes,       setPlantoes]       = useState<Plantao[]>([])
  const [detalhes,       setDetalhes]       = useState<AgendaDetalhe[]>([])
  const [atvsEquipe,     setAtvsEquipe]     = useState<AgendaAtividade[]>([])
  const [loading,        setLoading]        = useState(true)
  const [semanaOffset,   setSemanaOffset]   = useState(0)
  const [abaAtiva,       setAbaAtiva]       = useState<'sessoes'|'plantoes'|'atividades'|'equipe'>('sessoes')
  const [filtroConsultor,setFiltroConsultor]= useState('')
  const [filtroAtividade,setFiltroAtividade]= useState('')
  const meuLogin = useBastaoStore(s => s.meuLogin)

  const monday    = useMemo(() => { const m=getMonday(new Date()); m.setDate(m.getDate()+semanaOffset*7); return m }, [semanaOffset])
  const weekDays  = useMemo(() => getWeekDays(monday), [monday])
  const weekStart = fmt(weekDays[0])
  const weekEndSun = useMemo(() => { const s=new Date(monday); s.setDate(monday.getDate()+6); return fmt(s) }, [monday])

  useEffect(() => {
    if (!aberto) return
    const load = async () => {
      setLoading(true)
      const hoje = new Date().toISOString().split('T')[0]
      const [ativRes, plantRes, detRes, atvsRes] = await Promise.all([
        supabase.from('atividades_consultores').select('consultor,date,atividade').gte('date',weekStart).lte('date',weekEndSun).order('date'),
        supabase.from('plantonistas_fds').select('tipo_dia,date,plantonistas').gte('date',hoje).order('date').limit(20),
        supabase.from('agenda_detalhes').select('*').gte('data',weekStart).lte('data',weekEndSun),
        supabase.from('agenda_atividades').select('*').gte('data',weekStart).lte('data',weekEndSun).order('data').order('tipo'),
      ])
      setAtividades(ativRes.data || [])
      setPlantoes(plantRes.data || [])
      setDetalhes(detRes.data || [])
      setAtvsEquipe(atvsRes.data || [])
      setLoading(false)
    }
    load()
  }, [weekStart, weekEndSun, aberto])

  const consultoresComSessao = useMemo(() => {
    const nomes = new Set<string>()
    for (const a of atividades) { if(extrairSessoes(a.atividade).length>0) nomes.add(a.consultor) }
    return [...nomes].sort()
  }, [atividades])

  const sessoesPorDia = useMemo(() => {
    const result: Record<string, SessaoAgrupada[]> = {}
    for (const day of weekDays) {
      const dateStr = fmt(day)
      const sessoesMap: Record<string, string[]> = {}
      for (const a of atividades.filter(a=>a.date===dateStr)) {
        for (const s of extrairSessoes(a.atividade)) {
          const key = s.toUpperCase().trim()
          if (!sessoesMap[key]) sessoesMap[key] = []
          if (!sessoesMap[key].includes(a.consultor)) sessoesMap[key].push(a.consultor)
        }
      }
      let agrupadas: SessaoAgrupada[] = Object.entries(sessoesMap)
        .map(([nome, cons]) => ({
          nomeSessao: nome,
          consultores: cons.sort(),
          detalhe: detalhes.find(d =>
            d.data === dateStr && d.nome_sessao.toUpperCase() === nome.toUpperCase()
          ),
        }))
        .sort((a, b) => {
          const ha = a.detalhe?.horario ?? '99:99'
          const hb = b.detalhe?.horario ?? '99:99'
          return ha.localeCompare(hb) || a.nomeSessao.localeCompare(b.nomeSessao)
        })
      if (filtroConsultor) agrupadas = agrupadas.filter(s=>s.consultores.includes(filtroConsultor))
      result[dateStr] = agrupadas
    }
    return result
  }, [atividades, detalhes, weekDays, filtroConsultor])

  const atvsEquipePorDia = useMemo(() => {
    const map: Record<string, AgendaAtividade[]> = {}
    for (const d of weekDays) map[fmt(d)] = []
    for (const a of atvsEquipe) {
      if (!map[a.data]) continue
      const okConsultor = !filtroAtividade || a.consultores.some(c =>
        c === filtroAtividade || c.split(' ')[0] === filtroAtividade.split(' ')[0]
      )
      if (okConsultor) map[a.data].push(a)
    }
    return map
  }, [atvsEquipe, weekDays, filtroAtividade])

  const totalSessoesSemana = useMemo(() =>
    Object.values(sessoesPorDia).reduce((s,arr)=>s+arr.length,0), [sessoesPorDia])

  const hojeStr = fmt(new Date())

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header clicável */}
      <button onClick={()=>setAberto(!aberto)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <h2 className="text-xl font-bold text-gray-800">👥 Painel Equipe</h2>
        <div className="flex items-center gap-3">
          {!aberto && <span className="text-xs text-gray-400 font-bold">Clique para expandir</span>}
          <span className={`text-xl transition-transform duration-300 ${aberto?'rotate-180':''}`}>▼</span>
        </div>
      </button>

      {aberto && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {/* Abas */}
          <div className="flex items-center gap-2 mt-4 mb-4">
            <button onClick={()=>setAbaAtiva('sessoes')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva==='sessoes'?'bg-purple-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              🏛️ Sessões
            </button>
            <button onClick={()=>setAbaAtiva('plantoes')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva==='plantoes'?'bg-red-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              🚨 Plantões
            </button>
            <button onClick={()=>setAbaAtiva('atividades')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva==='atividades'?'bg-blue-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              📋 Atividades
            </button>
            <button onClick={()=>setAbaAtiva('equipe')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${abaAtiva==='equipe'?'bg-indigo-600 text-white shadow-md':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              👥 Equipe & Setor
            </button>
          </div>

          {/* ── ABA SESSÕES ─────────────────────────────────────────────── */}
          {abaAtiva === 'sessoes' && (
            <>
              <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setSemanaOffset(s=>s-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm">◀</button>
                  <button onClick={()=>setSemanaOffset(0)} className={`px-4 py-1.5 rounded-lg font-bold text-sm ${semanaOffset===0?'bg-purple-600 text-white':'bg-gray-100 hover:bg-gray-200'}`}>Hoje</button>
                  <button onClick={()=>setSemanaOffset(s=>s+1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm">▶</button>
                  <span className="text-sm font-black text-gray-500 ml-2">{fmtBR(weekDays[0])} — {fmtBR(weekDays[4])}</span>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black border border-purple-200">
                  🏛️ {totalSessoesSemana} sessões
                </span>
              </div>

              {/* Filtro */}
              <div className="flex flex-wrap gap-3 mb-5 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-xs font-black text-gray-500">🔍 Filtrar:</span>
                <select value={filtroConsultor} onChange={e=>setFiltroConsultor(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-bold bg-white focus:ring-2 focus:ring-purple-400 outline-none">
                  <option value="">Todos os consultores</option>
                  {consultoresComSessao.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
                {meuLogin && consultoresComSessao.includes(meuLogin) && (
                  <button onClick={()=>setFiltroConsultor(filtroConsultor===meuLogin?'':meuLogin)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filtroConsultor===meuLogin?'bg-purple-600 text-white border-purple-700':'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'}`}>
                    👤 Minhas Sessões
                  </button>
                )}
                {filtroConsultor && (
                  <button onClick={()=>setFiltroConsultor('')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200">
                    ✖ Limpar
                  </button>
                )}
              </div>

              {loading
                ? <div className="text-center py-12 text-gray-400 font-bold">Carregando sessões...</div>
                : <div className="flex flex-col gap-4">
                    {weekDays.map(day => {
                      const dateStr=fmt(day); const isHoje=dateStr===hojeStr
                      const sessDia=sessoesPorDia[dateStr]||[]; const dayNum=day.getDay()
                      return (
                        <div key={dateStr} className={`rounded-xl border-2 overflow-hidden ${isHoje?'border-purple-400 shadow-lg shadow-purple-100':'border-gray-200'}`}>
                          <div className={`px-4 py-2.5 flex items-center justify-between ${isHoje?'bg-purple-600 text-white':'bg-gray-50 text-gray-700'}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-sm">{DIAS_LABEL[dayNum]||''}</span>
                              <span className={`text-xs font-bold ${isHoje?'text-purple-200':'text-gray-400'}`}>{day.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</span>
                              {isHoje && <span className="text-[10px] font-black bg-white text-purple-700 px-2 py-0.5 rounded-full">HOJE</span>}
                            </div>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isHoje?'bg-white/20 text-white':'bg-purple-100 text-purple-700'}`}>
                              {sessDia.length} {sessDia.length===1?'sessão':'sessões'}
                            </span>
                          </div>
                          <div className="p-4">
                            {sessDia.length === 0
                              ? <p className="text-xs text-gray-400 italic">Nenhuma sessão neste dia</p>
                              : <div className="flex flex-wrap gap-2">
                                  {sessDia.map((sessao, j) => (
                                    <ChipSessao key={j} sessao={sessao} filtroConsultor={filtroConsultor} />
                                  ))}
                                </div>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </>
          )}

          {/* ── ABA PLANTÕES ────────────────────────────────────────────── */}
          {abaAtiva === 'plantoes' && (
            <div>
              <h3 className="text-lg font-black text-gray-800 mb-4">🚨 Próximos Plantões e Feriados</h3>
              {loading
                ? <div className="text-center py-12 text-gray-400 font-bold">Carregando...</div>
                : plantoes.length === 0
                ? <p className="text-sm text-gray-400 italic text-center py-8">Nenhum plantão cadastrado.</p>
                : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {plantoes.map((p,i) => {
                      const dt=new Date(p.date+'T12:00:00'); const isHoje=fmt(dt)===hojeStr
                      const diff=dt.getTime()-new Date().setHours(0,0,0,0); const isProx=diff>=0&&diff<=7*86400000
                      const isFeriado=p.tipo_dia.toUpperCase().includes('FERIADO')||p.tipo_dia.toUpperCase().includes('CARNAVAL')
                      return (
                        <div key={i} className={`p-4 rounded-xl border-2 ${isHoje?'border-red-500 bg-red-50 shadow-lg':isProx?'border-orange-400 bg-orange-50':'border-gray-200 bg-white'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[11px] font-black px-2 py-1 rounded-lg ${isFeriado?'bg-amber-200 text-amber-900':'bg-gray-100 text-gray-600'}`}>{isFeriado?'🎉':'📅'} {p.tipo_dia}</span>
                            {isHoje&&<span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">HOJE</span>}
                            {isProx&&!isHoje&&<span className="text-[10px] font-black bg-orange-500 text-white px-2 py-0.5 rounded-full">ESTA SEMANA</span>}
                          </div>
                          <p className="text-sm font-black text-gray-800 mb-1">{dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p>
                          <p className="text-sm font-bold text-indigo-700">👥 {p.plantonistas}</p>
                        </div>
                      )
                    })}
                  </div>
              }
            </div>
          )}

          {/* ── ABA ATIVIDADES ────────────────────────────────────────────── */}
          {abaAtiva === 'atividades' && (
            <>
              <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setSemanaOffset(s=>s-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm">◀</button>
                  <button onClick={()=>setSemanaOffset(0)} className={`px-4 py-1.5 rounded-lg font-bold text-sm ${semanaOffset===0?'bg-blue-600 text-white':'bg-gray-100 hover:bg-gray-200'}`}>Hoje</button>
                  <button onClick={()=>setSemanaOffset(s=>s+1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-sm">▶</button>
                  <span className="text-sm font-black text-gray-500 ml-2">{fmtBR(weekDays[0])} — {fmtBR(weekDays[4])}</span>
                </div>
              </div>

              {/* Filtro atividades */}
              <div className="flex flex-wrap gap-3 mb-5 items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                <span className="text-xs font-black text-gray-500">🔍 Filtrar:</span>
                <select value={filtroAtividade} onChange={e=>setFiltroAtividade(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-bold bg-white focus:ring-2 focus:ring-blue-400 outline-none">
                  <option value="">Todos os consultores</option>
                  {[...new Set(atvsEquipe.flatMap(a=>a.consultores))].sort().map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                {meuLogin && (
                  <button onClick={()=>setFiltroAtividade(filtroAtividade===meuLogin?'':meuLogin)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${filtroAtividade===meuLogin?'bg-blue-600 text-white border-blue-700':'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'}`}>
                    👤 Minhas Atividades
                  </button>
                )}
                {filtroAtividade && (
                  <button onClick={()=>setFiltroAtividade('')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200">
                    ✖ Limpar
                  </button>
                )}
              </div>

              {loading
                ? <div className="text-center py-12 text-gray-400 font-bold">Carregando atividades...</div>
                : <div className="flex flex-col gap-4">
                    {weekDays.map(day => {
                      const dateStr=fmt(day); const isHoje=dateStr===hojeStr
                      const atvsDia=atvsEquipePorDia[dateStr]||[]; const dayNum=day.getDay()
                      return (
                        <div key={dateStr} className={`rounded-xl border-2 overflow-hidden ${isHoje?'border-blue-400 shadow-lg shadow-blue-100':'border-gray-200'}`}>
                          <div className={`px-4 py-2.5 flex items-center justify-between ${isHoje?'bg-blue-600 text-white':'bg-gray-50 text-gray-700'}`}>
                            <div className="flex items-center gap-3">
                              <span className="font-black text-sm">{DIAS_LABEL[dayNum]||''}</span>
                              <span className={`text-xs font-bold ${isHoje?'text-blue-200':'text-gray-400'}`}>{day.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</span>
                              {isHoje && <span className="text-[10px] font-black bg-white text-blue-700 px-2 py-0.5 rounded-full">HOJE</span>}
                            </div>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isHoje?'bg-white/20 text-white':'bg-blue-100 text-blue-700'}`}>
                              {atvsDia.length} {atvsDia.length===1?'atividade':'atividades'}
                            </span>
                          </div>
                          <div className="p-4">
                            {atvsDia.length === 0
                              ? <p className="text-xs text-gray-400 italic">Nenhuma atividade neste dia</p>
                              : <div className="flex flex-wrap gap-2">
                                  {atvsDia.map((a, j) => {
                                    const cfg = getCfgAtv(a.tipo)
                                    return (
                                      <div key={j} className={`inline-flex flex-col gap-1 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white shadow-sm`}>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full self-start ${cfg.badge}`}>
                                          {cfg.icon} {a.tipo}
                                        </span>
                                        {a.observacao && (
                                          <span className="text-[10px] text-gray-500 italic">💬 {a.observacao}</span>
                                        )}
                                        <div className="flex flex-wrap gap-0.5 mt-0.5">
                                          {a.consultores.map(c => (
                                            <span key={c} className="text-[10px] text-gray-600 font-bold bg-gray-100 px-1.5 py-0.5 rounded-full">
                                              {nomeExibicao(c)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                            }
                          </div>
                        </div>
                      )
                    })}
                  </div>
              }
            </>
          )}

          {/* ── ABA EQUIPE & SETOR ────────────────────────────────────────── */}
          {abaAtiva === 'equipe' && (
            <div>
              <h3 className="text-lg font-black text-gray-800 mb-4">👥 Informações da Equipe</h3>

              {/* EPROC */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
                  <h4 className="text-sm font-black text-green-700 uppercase tracking-wide">Equipe EPROC</h4>
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                    {EQUIPE_EPROC.length} consultores
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {EQUIPE_EPROC.sort().map(nome => (
                    <div key={nome} className="bg-green-50 border-2 border-green-200 rounded-2xl p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-black text-green-900 leading-tight">{nome}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">EPROC</span>
                        <span className="text-[10px] text-green-600 font-bold">☎ {getRamal(nome)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JPE / Themis */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                  <h4 className="text-sm font-black text-red-700 uppercase tracking-wide">Equipe JPE / Themis</h4>
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                    {EQUIPE_JPE.length} consultores
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {EQUIPE_JPE.sort().map(nome => (
                    <div key={nome} className="bg-red-50 border-2 border-red-200 rounded-2xl p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-black text-red-900 leading-tight">{nome}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">JPE/Themis</span>
                        <span className="text-[10px] text-red-600 font-bold">☎ {getRamal(nome)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gestão e Secretaria */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
                  <h4 className="text-sm font-black text-indigo-700 uppercase tracking-wide">Gestão & Secretaria</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {USUARIOS_SISTEMA.filter(u => u.perfil === 'Gestor' || u.perfil === 'Secretaria').map(u => (
                    <div key={u.nome} className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-black text-indigo-900 leading-tight">{u.nome}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${u.perfil==='Gestor'?'bg-indigo-200 text-indigo-800':'bg-purple-200 text-purple-800'}`}>
                          {u.perfil}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-bold">☎ {getRamal(u.nome)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
