import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'
import { TODOS_CONSULTORES } from '../constants'

function nomeExibicao(nome: string): string {
  const p = nome.trim().split(' ').filter(Boolean)
  if (p.length <= 1) return nome
  return p[0] + ' ' + p[p.length - 1]
}



// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AgendaAtividade {
  id: string
  data: string
  tipo: string
  observacao?: string
  consultores: string[]
  criado_por: string
  criado_em: string
}

// ─── Catálogo de atividades ───────────────────────────────────────────────────
const TIPOS_ATIVIDADE = [
  'Atendimento pres.',
  'BNMP',
  'Compensação',
  'DJEN/TH',
  'DJEN/TH/BNMP',
  'Férias',
  'HP',
  'Plantão',
  'Projeto Boas Práticas',
  'Reunião',
  'Reunião ASCOM',
  'TRE',
  'TRE PLANTÃO',
  'Treinamento',
  'Treinamento Boas Práticas',
  'WhatsApp eproc/HP',
  'Atestado',
  'Acompanhar visita no gabinete',
  'Outros',
].sort()

// Ícone e cor por tipo
const TIPO_CONFIG: Record<string, { icon: string; bg: string; border: string; text: string; badge: string }> = {
  'Compensação':              { icon:'🌴', bg:'bg-emerald-50', border:'border-emerald-300', text:'text-emerald-800', badge:'bg-emerald-100 text-emerald-700' },
  'Férias':                   { icon:'✈️', bg:'bg-sky-50',     border:'border-sky-300',     text:'text-sky-800',     badge:'bg-sky-100 text-sky-700'     },
  'Treinamento':              { icon:'🎓', bg:'bg-amber-50',   border:'border-amber-300',   text:'text-amber-800',   badge:'bg-amber-100 text-amber-700'   },
  'Treinamento Boas Práticas':{ icon:'🎓', bg:'bg-amber-50',   border:'border-amber-300',   text:'text-amber-800',   badge:'bg-amber-100 text-amber-700'   },
  'Projeto Boas Práticas':    { icon:'🎓', bg:'bg-amber-50',   border:'border-amber-300',   text:'text-amber-800',   badge:'bg-amber-100 text-amber-700'   },
  'Reunião':                  { icon:'📅', bg:'bg-teal-50',    border:'border-teal-300',    text:'text-teal-800',    badge:'bg-teal-100 text-teal-700'    },
  'Reunião ASCOM':            { icon:'📅', bg:'bg-teal-50',    border:'border-teal-300',    text:'text-teal-800',    badge:'bg-teal-100 text-teal-700'    },
  'HP':                       { icon:'🎯', bg:'bg-indigo-50',  border:'border-indigo-300',  text:'text-indigo-800',  badge:'bg-indigo-100 text-indigo-700'  },
  'DJEN/TH':                  { icon:'📋', bg:'bg-blue-50',    border:'border-blue-300',    text:'text-blue-800',    badge:'bg-blue-100 text-blue-700'    },
  'DJEN/TH/BNMP':             { icon:'📋', bg:'bg-blue-50',    border:'border-blue-300',    text:'text-blue-800',    badge:'bg-blue-100 text-blue-700'    },
  'BNMP':                     { icon:'⚖️', bg:'bg-purple-50',  border:'border-purple-300',  text:'text-purple-800',  badge:'bg-purple-100 text-purple-700'  },
  'TRE':                      { icon:'🏋️', bg:'bg-orange-50',  border:'border-orange-300',  text:'text-orange-800',  badge:'bg-orange-100 text-orange-700'  },
  'TRE PLANTÃO':              { icon:'🏋️', bg:'bg-orange-50',  border:'border-orange-300',  text:'text-orange-800',  badge:'bg-orange-100 text-orange-700'  },
  'Plantão':                  { icon:'🔴', bg:'bg-red-50',     border:'border-red-300',     text:'text-red-800',     badge:'bg-red-100 text-red-700'     },
  'WhatsApp eproc/HP':        { icon:'💬', bg:'bg-green-50',   border:'border-green-300',   text:'text-green-800',   badge:'bg-green-100 text-green-700'   },
  'Atendimento pres.':        { icon:'🤝', bg:'bg-gray-50',    border:'border-gray-300',    text:'text-gray-700',    badge:'bg-gray-100 text-gray-600'    },
  'Atestado':                 { icon:'🏥', bg:'bg-rose-50',    border:'border-rose-300',    text:'text-rose-800',    badge:'bg-rose-100 text-rose-700'    },
  'default':                  { icon:'📌', bg:'bg-gray-50',    border:'border-gray-200',    text:'text-gray-700',    badge:'bg-gray-100 text-gray-600'    },
}
const getCfg = (tipo: string) => TIPO_CONFIG[tipo] ?? TIPO_CONFIG['default']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(d: Date) {
  const dt = new Date(d); const day = dt.getDay()
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1)); dt.setHours(0,0,0,0); return dt
}
function getWeekDays(m: Date) {
  return Array.from({length:5},(_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d })
}
function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const DIAS_PT: Record<number,string> = {1:'Segunda-feira',2:'Terça-feira',3:'Quarta-feira',4:'Quinta-feira',5:'Sexta-feira'}

// ─── Card de atividade ────────────────────────────────────────────────────────
function CardAtividade({ item, canEdit, onEdit, onDelete }: {
  item: AgendaAtividade; canEdit: boolean; onEdit: () => void; onDelete: () => void
}) {
  const cfg = getCfg(item.tipo)
  return (
    <div className={`border-2 rounded-2xl p-3 transition-all ${cfg.bg} ${cfg.border} ${canEdit ? 'hover:shadow-md' : ''}`}>
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.icon} {item.tipo}
        </span>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onEdit} className="w-6 h-6 rounded-lg bg-white/70 hover:bg-white border border-gray-200 flex items-center justify-center text-xs" title="Editar">✏️</button>
            <button onClick={onDelete} className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-xs text-red-500" title="Excluir">✕</button>
          </div>
        )}
      </div>
      {item.observacao && (
        <p className="text-[10px] text-gray-500 mb-2 leading-snug italic">💬 {item.observacao}</p>
      )}
      <div className="flex flex-wrap gap-1">
        {item.consultores.length === 0
          ? <span className="text-[10px] text-gray-400 italic">Sem consultor</span>
          : item.consultores.map(c => (
            <span key={c} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/70 border ${cfg.border} ${cfg.text}`}>
              {nomeExibicao(c)}
            </span>
          ))
        }
      </div>
    </div>
  )
}

// ─── Modal adicionar/editar ───────────────────────────────────────────────────
function ModalAtividade({ data, item, onSave, onClose, meuLogin }: {
  data: string; item?: AgendaAtividade
  onSave: (p: Omit<AgendaAtividade,'id'|'criado_em'>) => void
  onClose: () => void; meuLogin: string
}) {
  const isNew = !item
  const [tipoFiltro,   setTipoFiltro]   = useState('')
  const [tipo,         setTipo]         = useState(item?.tipo ?? '')
  const [observacao,   setObservacao]   = useState(item?.observacao ?? '')
  const [consultores,  setConsultores]  = useState<string[]>(item?.consultores ?? [])
  const [dataItem,     setDataItem]     = useState(item?.data ?? data)

  const catFiltrado = useMemo(() =>
    TIPOS_ATIVIDADE.filter(t => t.toLowerCase().includes(tipoFiltro.toLowerCase()))
  , [tipoFiltro])

  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 bg-white"
  const lbl = "block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1 mt-3"

  return (
    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex justify-between items-start flex-shrink-0">
          <div>
            <h3 className="text-base font-black">{isNew ? '➕ Nova atividade' : '✏️ Editar atividade'}</h3>
            <p className="text-xs text-white/60 mt-0.5">
              {new Date(dataItem+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <label className={lbl}>Data</label>
          <input type="date" value={dataItem} onChange={e=>setDataItem(e.target.value)} className={inp} />

          <label className={lbl}>Tipo de atividade</label>
          <input type="text" value={tipoFiltro || tipo}
            onChange={e=>{ setTipoFiltro(e.target.value); setTipo(e.target.value) }}
            placeholder="Buscar ou digitar atividade..." className={inp} autoFocus />
          {tipoFiltro && catFiltrado.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto shadow-md mt-1">
              {catFiltrado.map(t => {
                const cfg = getCfg(t)
                return (
                  <button key={t} onClick={()=>{ setTipo(t); setTipoFiltro('') }}
                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0 flex items-center gap-2">
                    <span>{cfg.icon}</span> {t}
                  </button>
                )
              })}
            </div>
          )}

          {/* Preview cor */}
          {tipo && (
            <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 ${getCfg(tipo).bg} ${getCfg(tipo).border} ${getCfg(tipo).text}`}>
              {getCfg(tipo).icon} {tipo}
            </div>
          )}

          <label className={lbl}>Observação (opcional)</label>
          <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={2}
            className={`${inp} resize-none`} placeholder="Detalhes adicionais..." />

          <label className={lbl}>Consultores ({consultores.length})</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
            {TODOS_CONSULTORES.map(c => {
              const sel = consultores.includes(c)
              return (
                <button key={c} onClick={()=>setConsultores(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-lg font-bold border transition-all ${sel?'border-blue-500 bg-blue-100 text-blue-700':'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}>
                  {sel && '✓ '}{c.split(' ')[0]} {c.split(' ').slice(-1)[0]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={() => {
            if (!tipo.trim()) return alert('Informe o tipo de atividade!')
            onSave({ data: dataItem, tipo: tipo.trim(), observacao: observacao.trim() || undefined, consultores, criado_por: meuLogin })
          }} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl">
            💾 Salvar
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function PainelGestaoAtividades() {
  const { meuLogin, adicionarMensagemMural } = useBastaoStore()
  const [aberto,         setAberto]         = useState(false)
  const [itens,          setItens]          = useState<AgendaAtividade[]>([])
  const [loading,        setLoading]        = useState(false)
  const [copiando,       setCopiando]       = useState(false)
  const [semanaOffset,   setSemanaOffset]   = useState(0)
  const [modal,          setModal]          = useState<{data:string; item?:AgendaAtividade}|null>(null)
  const [filtroConsultor,setFiltroConsultor]= useState('Todos')

  const monday   = useMemo(()=>{const m=getMonday(new Date());m.setDate(m.getDate()+semanaOffset*7);return m},[semanaOffset])
  const weekDays = useMemo(()=>getWeekDays(monday),[monday])
  const weekStart = fmtLocal(weekDays[0])
  const weekEndSun = useMemo(()=>{const s=new Date(monday);s.setDate(monday.getDate()+6);return fmtLocal(s)},[monday])

  useEffect(()=>{ if(aberto) load() },[weekStart,weekEndSun,aberto])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('agenda_atividades')
      .select('*').gte('data',weekStart).lte('data',weekEndSun)
      .order('data').order('tipo')
    setItens(data || [])
    setLoading(false)
  }

  async function handleSalvar(payload: Omit<AgendaAtividade,'id'|'criado_em'>) {
    const existe = itens.find(i => i.data===payload.data && i.tipo===payload.tipo)
    if (existe) {
      await supabase.from('agenda_atividades').update(payload).eq('id', existe.id)
    } else {
      await supabase.from('agenda_atividades').insert({...payload, criado_em: new Date().toISOString()})
    }
    const dataBR = new Date(payload.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    const cfg = getCfg(payload.tipo)
    const msg = `${cfg.icon} ${existe?'Atualizado':'Novo'}: ${payload.tipo} — ${dataBR} · ${payload.consultores.map(c=>c.split(' ')[0]).join(', ')||'sem consultor'}`
    adicionarMensagemMural(msg, 'comum', meuLogin!)
    setModal(null); await load()
  }

  async function handleDeletar(item: AgendaAtividade) {
    if (!confirm(`Remover "${item.tipo}"?`)) return
    await supabase.from('agenda_atividades').delete().eq('id', item.id)
    await load()
  }

  async function copiarSemanaAnterior() {
    setCopiando(true)
    const semAntStart = fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-7)))
    const semAntEnd   = fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-1)))
    const { data: anterior } = await supabase.from('agenda_atividades')
      .select('*').gte('data',semAntStart).lte('data',semAntEnd)
    if (!anterior?.length) { alert('Nenhuma atividade na semana anterior.'); setCopiando(false); return }
    const novos: any[] = []
    for (const old of anterior) {
      const dw = new Date(old.data+'T12:00:00').getDay()
      const novaData = fmtLocal(weekDays[dw-1])
      if (!itens.some(i=>i.data===novaData&&i.tipo===old.tipo))
        novos.push({ data:novaData, tipo:old.tipo, observacao:old.observacao, consultores:old.consultores, criado_por:meuLogin!, criado_em:new Date().toISOString() })
    }
    if (novos.length > 0) {
      await supabase.from('agenda_atividades').insert(novos)
      adicionarMensagemMural(`📋 ${novos.length} atividades copiadas para semana de ${weekDays[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`, 'comum', meuLogin!)
    } else alert('Todas as atividades já estão na semana atual.')
    await load(); setCopiando(false)
  }

  const itensPorDia = useMemo(()=>{
    const map: Record<string,AgendaAtividade[]> = {}
    for (const d of weekDays) map[fmtLocal(d)] = []
    for (const it of itens) {
      if (!map[it.data]) continue
      const ok = filtroConsultor==='Todos' || it.consultores.includes(filtroConsultor) || (filtroConsultor==='Minhas' && it.consultores.includes(meuLogin||''))
      if (ok) map[it.data].push(it)
    }
    return map
  },[itens,weekDays,filtroConsultor,meuLogin])

  if (!aberto) return (
    <button onClick={()=>setAberto(true)}
      className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-600 hover:via-indigo-600 hover:to-blue-700 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0">
      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📋</span>
      <span className="tracking-wide">Atividades da Equipe</span>
      <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
    </button>
  )

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-black text-white">📋 Atividades da Equipe</h2>
            <p className="text-xs text-white/60">{itens.length} atividades esta semana</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copiarSemanaAnterior} disabled={copiando}
              className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5">
              {copiando ? '⏳' : '📋'} Copiar sem. ant.
            </button>
            <button onClick={()=>setModal({data:fmtLocal(new Date())})}
              className="bg-white text-blue-700 hover:bg-blue-50 font-black px-3 py-1.5 rounded-xl text-xs">
              + Atividade
            </button>
            <button onClick={()=>setAberto(false)} className="text-white/60 hover:text-white text-xl px-1">✕</button>
          </div>
        </div>

        {/* Navegação */}
        <div className="border-b border-gray-100 px-5 py-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={()=>setSemanaOffset(v=>v-1)} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">←</button>
            <span className="text-sm font-black text-gray-700">
              {weekDays[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – {weekDays[4].toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
            </span>
            <button onClick={()=>setSemanaOffset(v=>v+1)} className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center text-sm font-bold">→</button>
            {semanaOffset !== 0 && <button onClick={()=>setSemanaOffset(0)} className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Hoje</button>}
          </div>
          <select value={filtroConsultor} onChange={e=>setFiltroConsultor(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-blue-400">
            <option value="Todos">Todos</option>
            {meuLogin && <option value="Minhas">Minhas atividades</option>}
            {TODOS_CONSULTORES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Dias */}
        {loading
          ? <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
          : <div className="divide-y divide-gray-50">
              {weekDays.map(d => {
                const dateStr = fmtLocal(d)
                const isToday = dateStr === fmtLocal(new Date())
                const atvsDia = itensPorDia[dateStr] ?? []

                return (
                  <div key={dateStr} className={`px-5 py-4 ${isToday ? 'bg-blue-50/20' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-sm font-black ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>{DIAS_PT[d.getDay()]}</span>
                      <span className={`text-xs font-bold ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                        {d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}
                      </span>
                      {isToday && <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">HOJE</span>}
                      <span className={`ml-auto text-xs font-black ${atvsDia.length>0?'text-blue-500':'text-gray-300'}`}>
                        {atvsDia.length} {atvsDia.length===1?'atividade':'atividades'}
                      </span>
                      <button onClick={()=>setModal({data:dateStr})}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold px-2.5 py-1 rounded-lg border border-blue-100">
                        + Atividade
                      </button>
                    </div>

                    {atvsDia.length === 0
                      ? <p className="text-xs text-gray-300 italic">Nenhuma atividade</p>
                      : <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                          {atvsDia.map(it => (
                            <CardAtividade key={it.id} item={it} canEdit={true}
                              onEdit={()=>setModal({data:it.data,item:it})}
                              onDelete={()=>handleDeletar(it)} />
                          ))}
                        </div>
                    }
                  </div>
                )
              })}
            </div>
        }
      </div>

      {modal && (
        <ModalAtividade
          data={modal.data}
          item={modal.item}
          onSave={handleSalvar}
          onClose={()=>setModal(null)}
          meuLogin={meuLogin!}
        />
      )}
    </>
  )
}
