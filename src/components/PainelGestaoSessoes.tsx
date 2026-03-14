import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'
import { TODOS_CONSULTORES } from '../constants'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface AgendaDetalhe {
  id: string; data: string; nome_sessao: string; modalidade?: string
  horario?: string; plenario?: string; descricao?: string
  pauta?: number; mesa?: number; consultores: string[]
  setor?: string
  suspenso?: boolean; data_reativacao?: string | null
  criado_por: string; criado_em: string
}
interface AtividadeDia { atividade: string; consultores: string[] }

// ─── Catálogos ────────────────────────────────────────────────────────────────
const SESSOES_CATALOGO = [
  'SESSÃO 1ª CÍVEL','SESSÃO 2ª CÍVEL','SESSÃO 3ª CÍVEL','SESSÃO 4ª CÍVEL ESP.',
  'SESSÃO 5ª CÍVEL','SESSÃO 6ª CÍVEL','SESSÃO 7ª CÍVEL','SESSÃO 8ª CÍVEL',
  'SESSÃO 8ª CÍVEL ESP.','SESSÃO 8ª CÍVEL ESPECIALIZADA','SESSÃO 9ª CÍVEL',
  'SESSÃO 10ª CÍVEL','SESSÃO 11ª CÍVEL','SESSÃO 12ª CÍVEL','SESSÃO 13ª CÍVEL',
  'SESSÃO 14ª CÍVEL','SESSÃO 15ª CÍVEL','SESSÃO 16ª CÍVEL','SESSÃO 17ª CÍVEL',
  'SESSÃO 18ª CÍVEL','SESSÃO 19ª CÍVEL','SESSÃO 20ª CÍVEL','SESSÃO 21ª CÍVEL',
  'SESSÃO 21ª CÍVEL ESP.','SESSÃO 1ª CRIMINAL','SESSÃO 2ª CRIMINAL','SESSÃO 3ª CRIMINAL',
  'SESSÃO 4ª CRIMINAL','SESSÃO 5ª CRIMINAL','SESSÃO 6ª CRIMINAL','SESSÃO 7ª CRIMINAL',
  'SESSÃO 8ª CRIMINAL','SESSÃO 9ª CRIMINAL ESP.','SESSÃO ÓRGÃO ESPECIAL',
  'SESSÃO TRIBUNAL PLENO','SESSÃO CONSELHO DA MAGISTRATURA',
  'SESSÃO 1ª CAFES','SESSÃO 2ª CAFES','SESSÃO 1º CARTÓRIO DE FEITOS ESP.',
  'SESSÃO NÚCLEO DE JUSTIÇA 4.0','SESSÃO 1º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 2º NÚCLEO DE JUSTIÇA 4.0','SESSÃO 3º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0','SESSÃO 5º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 6º NÚCLEO DE JUSTIÇA 4.0','SESSÃO AUDIÊNCIA DE CONCILIAÇÃO',
  'SESSÃO 1º GRUPO CRIMINAL',
  'VIRTUAL SESSÃO 1ª CÍVEL','VIRTUAL SESSÃO 2ª CÍVEL','VIRTUAL SESSÃO 3ª CÍVEL',
  'VIRTUAL SESSÃO 4ª CÍVEL ESPECIALIZADA','VIRTUAL SESSÃO 5ª CÍVEL',
  'VIRTUAL SESSÃO 6ª CÍVEL','VIRTUAL SESSÃO 7ª CÍVEL','VIRTUAL SESSÃO 10ª CÍVEL',
  'VIRTUAL SESSÃO 12ª CÍVEL','VIRTUAL SESSÃO 13ª CÍVEL','VIRTUAL SESSÃO 14ª CÍVEL',
  'VIRTUAL SESSÃO 15ª CÍVEL','VIRTUAL SESSÃO 16ª CÍVEL','VIRTUAL SESSÃO 17ª CÍVEL',
  'VIRTUAL SESSÃO 21ª CÍVEL','VIRTUAL SESSÃO 21ª CÍVEL ESP.',
  'VIRTUAL SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0',
].sort()

const HORARIOS_PADRAO: Record<string,string> = {
  'SESSÃO 6ª CÍVEL':'13:30','SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0':'13:30','SESSÃO 17ª CÍVEL':'08:00',
}
const PLENARIOS_PADRAO: Record<string,string> = {
  'SESSÃO 6ª CÍVEL':'05','SESSÃO 8ª CÍVEL ESP.':'06','SESSÃO 10ª CÍVEL':'10',
  'SESSÃO 11ª CÍVEL':'10','SESSÃO ÓRGÃO ESPECIAL':'AUDITÓRIO',
  'SESSÃO NÚCLEO DE JUSTIÇA 4.0':'11','SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0':'11',
}
const MODALIDADE_PADRAO = (n:string) => n.startsWith('VIRTUAL') ? 'VIRTUAL' : 'PRESENCIAL'
const ICONE_ATV: Record<string,string> = {
  'Compensação':'🌴','DJEN':'📋','DJEN/TH':'📋','TREINAMENTO':'🎓','Treinamento':'🎓',
  'TREINAMENTO BOAS PRÁTICAS':'🎓','Boas Práticas':'🎓','WhatsApp eproc':'💬',
  'HP':'🎯','TRE':'🏋️','Férias':'✈️','BNMP':'⚖️','Reunião':'📅',
  'email':'📧',"email's":'📧',
}
function iconeAtividade(nome: string): string {
  for(const [key,ic] of Object.entries(ICONE_ATVY)) if(nome.toUpperCase().includes(key.toUpperCase())) return ic
  return '📌'
}
// workaround name collision
const ICONE_ATVY = ICONE_ATVY_MAP()
function ICONE_ATVY_MAP() { return ICONE_ATV }

// ─── Cores por modalidade ─────────────────────────────────────────────────────
const COR: Record<string,{bg:string;border:string;text:string;badge:string}> = {
  'PRESENCIAL':       {bg:'bg-violet-50',  border:'border-violet-300',  text:'text-violet-800',  badge:'bg-violet-100 text-violet-700'},
  'VIRTUAL':          {bg:'bg-cyan-50',    border:'border-cyan-300',    text:'text-cyan-800',    badge:'bg-cyan-100 text-cyan-700'},
  'HÍBRIDA':          {bg:'bg-indigo-50',  border:'border-indigo-300',  text:'text-indigo-800',  badge:'bg-indigo-100 text-indigo-700'},
  'VIDEOCONFERÊNCIA': {bg:'bg-sky-50',     border:'border-sky-300',     text:'text-sky-800',     badge:'bg-sky-100 text-sky-700'},
  'default':          {bg:'bg-gray-50',    border:'border-gray-300',    text:'text-gray-700',    badge:'bg-gray-100 text-gray-600'},
}
const getCor = (m?:string) => COR[m||'default']??COR.default
const ICON_MOD: Record<string,string> = {'PRESENCIAL':'🏛️','VIRTUAL':'🖥️','HÍBRIDA':'🔀','VIDEOCONFERÊNCIA':'📹'}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(d:Date){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-(day===0?6:day-1));dt.setHours(0,0,0,0);return dt}
function getWeekDays(m:Date){return Array.from({length:5},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d})}
function fmtLocal(d:Date){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const DIAS_PT:Record<number,string>={1:'Segunda-feira',2:'Terça-feira',3:'Quarta-feira',4:'Quinta-feira',5:'Sexta-feira'}
const WEBHOOK='https://matheusgomes12.app.n8n.cloud/webhook/01cc0578-4e51-45f5-9351-21380289bc86'

// Detecta erro de constraint única do Postgres/Supabase em qualquer formato
const isDuplicate = (e: any) =>
  e?.code === '23505' || e?.code === '409' ||
  String(e?.message).toLowerCase().includes('duplicate') ||
  String(e?.message).toLowerCase().includes('unique') ||
  String(e?.details).toLowerCase().includes('already exists')

function nomeExibicao(nome: string): string {
  const p = nome.trim().split(' ').filter(Boolean)
  if (p.length <= 1) return nome
  return p[0] + ' ' + p[p.length - 1]
}

// ─── Popover somente leitura ──────────────────────────────────────────────────
function Popover({item,onClose}:{item:AgendaDetalhe;onClose:()=>void}){
  const ref=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const fn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))onClose()}
    document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)
  },[])
  const cor=getCor(item.modalidade)
  return(
    <div ref={ref} className="absolute z-[400] w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      style={{top:'calc(100% + 4px)',left:'50%',transform:'translateX(-50%)'}}>
      <div className={`${cor.bg} border-b ${cor.border} p-3`}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs">{ICON_MOD[item.modalidade||'']||'🏛️'}</span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${cor.text}`}>{item.modalidade||'SESSÃO'}</span>
        </div>
        <p className={`text-sm font-black ${cor.text} leading-tight`}>{item.nome_sessao}</p>
        <div className="flex gap-3 mt-1 text-xs opacity-70">
          {item.horario&&<span>🕐 {item.horario}</span>}
          {item.plenario&&<span>🏛️ Pl. {item.plenario}</span>}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {(item.pauta||item.mesa)&&(
          <div className="flex gap-2">
            {item.pauta?<span className="text-xs bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded-lg">📋 Pauta: {item.pauta}</span>:null}
            {item.mesa?<span className="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-lg">🪑 Mesa: {item.mesa}</span>:null}
          </div>
        )}
        {item.descricao&&(
          <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-relaxed">💬 {item.descricao}</p>
        )}
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1">Consultores</p>
          <div className="flex flex-wrap gap-1">
            {item.consultores.length===0
              ?<span className="text-xs text-gray-300 italic">Nenhum</span>
              :item.consultores.map(c=>(
                <span key={c} className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-100">{nomeExibicao(c)}</span>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Card de sessão ───────────────────────────────────────────────────────────
function CardSessao({item,canEdit,onEdit,onDelete,onSuspend}:{item:AgendaDetalhe;canEdit:boolean;onEdit:()=>void;onDelete:()=>void;onSuspend?:()=>void}){
  const[popover,setPopover]=useState(false)
  const cor=getCor(item.modalidade)
  return(
    <div className="relative">
      <div className={`relative border-2 rounded-2xl p-3 transition-all ${cor.bg} ${cor.border} ${canEdit?'hover:shadow-md':'cursor-pointer hover:shadow-sm'}`}
        onClick={()=>{if(!canEdit)setPopover(v=>!v)}}>
        <div className="flex items-start justify-between gap-1 mb-2">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${cor.badge}`}>
            {ICON_MOD[item.modalidade||'']||'🏛️'} {item.modalidade||'SESSÃO'}
          </span>
          {canEdit&&(
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={e=>{e.stopPropagation();onEdit()}} className="w-6 h-6 rounded-lg bg-white/70 hover:bg-white border border-gray-200 flex items-center justify-center text-xs" title="Editar">✏️</button>
              {onSuspend&&<button onClick={e=>{e.stopPropagation();onSuspend()}} className="w-6 h-6 rounded-lg bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 flex items-center justify-center text-xs text-yellow-600" title="Suspender">⏸</button>}
              <button onClick={e=>{e.stopPropagation();onDelete()}} className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-xs text-red-500" title="Excluir">✕</button>
            </div>
          )}
        </div>
        <p className={`text-xs font-black leading-snug mb-2 ${cor.text}`}>{item.nome_sessao}</p>
        <div className="flex items-center gap-2 text-[10px] font-bold opacity-60 mb-2">
          {item.horario&&<span>🕐 {item.horario}</span>}
          {item.plenario&&<span>· Pl. {item.plenario}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {item.consultores.length===0
            ?<span className="text-[10px] text-gray-400 italic">Sem consultor</span>
            :item.consultores.map(c=>(
              <span key={c} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/70 border ${cor.border} ${cor.text}`}>{nomeExibicao(c)}</span>
            ))
          }
        </div>
      </div>
      {popover&&<Popover item={item} onClose={()=>setPopover(false)}/>}
    </div>
  )
}

// ─── Modal adicionar/editar ───────────────────────────────────────────────────
function ModalSessao({data,item,onSave,onClose,meuLogin}:{
  data:string;item?:AgendaDetalhe;
  onSave:(p:Omit<AgendaDetalhe,'criado_em'>&{id?:string})=>void;
  onClose:()=>void;meuLogin:string
}){
  const isNew=!item
  const[nomeFiltro,setNomeFiltro]=useState('')
  const[nomeSessao,setNomeSessao]=useState(item?.nome_sessao??'')
  const[modalidade,setModalidade]=useState(item?.modalidade??'PRESENCIAL')
  const[horario,setHorario]=useState(item?.horario??'')
  const[plenario,setPlenario]=useState(item?.plenario??'')
  const[descricao,setDescricao]=useState(item?.descricao??'')
  const[pauta,setPauta]=useState(String(item?.pauta??''))
  const[mesa,setMesa]=useState(String(item?.mesa??''))
  const[setor,setSetor]=useState(item?.setor??'')
  const[consultores,setConsultores]=useState<string[]>(item?.consultores??[])
  const[dataItem,setDataItem]=useState(item?.data??data)
  const[hoveredCons,setHoveredCons]=useState<string|null>(null)
  const[consStats,setConsStats]=useState<Record<string,{semana:number;total:number}>>({})

  useEffect(()=>{
    async function loadStats(){
      const now=new Date();const dow=now.getDay()
      const seg=new Date(now);seg.setDate(now.getDate()-(dow===0?6:dow-1))
      const ws=seg.toISOString().split('T')[0]
      const we=new Date(seg);we.setDate(seg.getDate()+6);const weStr=we.toISOString().split('T')[0]
      const[{data:semData},{data:totData}]=await Promise.all([
        supabase.from('agenda_detalhes').select('consultores').gte('data',ws).lte('data',weStr).limit(500),
        supabase.from('agenda_detalhes').select('consultores').limit(10000),
      ])
      const stats:Record<string,{semana:number;total:number}>={};
      (TODOS_CONSULTORES as string[]).forEach(c=>{stats[c]={semana:0,total:0}})
      semData?.forEach((r:any)=>{(r.consultores as string[]||[]).forEach(c=>{if(stats[c])stats[c].semana++})})
      totData?.forEach((r:any)=>{(r.consultores as string[]||[]).forEach(c=>{if(stats[c])stats[c].total++})})
      setConsStats(stats)
    }
    loadStats()
  },[])

  const cat=useMemo(()=>SESSOES_CATALOGO.filter(s=>s.toLowerCase().includes(nomeFiltro.toLowerCase())),[nomeFiltro])

  const selecionarCat=(nome:string)=>{
    setNomeSessao(nome);setNomeFiltro('')
    const mod=MODALIDADE_PADRAO(nome)
    setModalidade(mod)
    if(!horario)setHorario(HORARIOS_PADRAO[nome]??HORARIOS_PADRAO[nome.replace('VIRTUAL ','')]??'09:00')
    if(!plenario)setPlenario(PLENARIOS_PADRAO[nome]??PLENARIOS_PADRAO[nome.replace('VIRTUAL ','')]??'')
  }

  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white"
  const lbl="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1 mt-3"

  return(
    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-white flex justify-between items-start flex-shrink-0">
          <div>
            <h3 className="text-base font-black">{isNew?'➕ Nova sessão':'✏️ Editar sessão'}</h3>
            <p className="text-xs text-white/60 mt-0.5">{new Date(dataItem+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          <label className={lbl}>Data</label>
          <input type="date" value={dataItem} onChange={e=>setDataItem(e.target.value)} className={inp}/>

          <label className={lbl}>Sessão</label>
          <input type="text" value={nomeFiltro||nomeSessao}
            onChange={e=>{setNomeFiltro(e.target.value);setNomeSessao(e.target.value)}}
            placeholder="Buscar ou digitar sessão..." className={inp} autoFocus/>
          {nomeFiltro&&cat.length>0&&(
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto shadow-md mt-1">
              {cat.map(s=>(
                <button key={s} onClick={()=>selecionarCat(s)}
                  className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-violet-50 hover:text-violet-700 border-b border-gray-50 last:border-0">
                  {s.startsWith('VIRTUAL')?'🖥️ ':'🏛️ '}{s}
                </button>
              ))}
            </div>
          )}

          <label className={lbl}>Modalidade</label>
          <div className="flex gap-2">
            {['PRESENCIAL','VIRTUAL','HÍBRIDA','VIDEOCONFERÊNCIA'].map(m=>(
              <button key={m} onClick={()=>setModalidade(m)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border-2 transition-all ${modalidade===m?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-400'}`}>
                {ICON_MOD[m]||'🏛️'} {m==='VIDEOCONFERÊNCIA'?'VIDEO':m}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Horário</label><input type="time" value={horario} onChange={e=>setHorario(e.target.value)} className={inp}/></div>
            <div><label className={lbl}>Plenário</label><input type="text" value={plenario} onChange={e=>setPlenario(e.target.value)} className={inp} placeholder="Ex: 05"/></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Pauta</label><input type="number" value={pauta} onChange={e=>setPauta(e.target.value)} className={inp} min="0"/></div>
            <div><label className={lbl}>Mesa</label><input type="number" value={mesa} onChange={e=>setMesa(e.target.value)} className={inp} min="0"/></div>
          </div>

          <label className={lbl}>Cartório / Gabinete (opcional)</label>
          <input type="text" value={setor} onChange={e=>setSetor(e.target.value)}
            className={inp} placeholder="Ex: 3ª Vara Cível, Gabinete Des. João..."/>

          <label className={lbl}>Observações</label>
          <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={2}
            className={`${inp} resize-none`} placeholder="Detalhes, link, local..."/>

          <label className={lbl}>Consultores ({consultores.length})</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
            {(TODOS_CONSULTORES as string[]).map(c=>{
              const sel=consultores.includes(c)
              const st=consStats[c]
              return(
                <div key={c} className="relative">
                  <button
                    onMouseEnter={()=>setHoveredCons(c)}
                    onMouseLeave={()=>setHoveredCons(null)}
                    onClick={()=>setConsultores(prev=>prev.includes(c)?prev.filter(x=>x!==c):[...prev,c])}
                    className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg font-bold border transition-all ${sel?'border-violet-500 bg-violet-100 text-violet-700':'border-gray-200 bg-white text-gray-600 hover:border-violet-300'}`}>
                    {sel&&'✓ '}{c.split(' ')[0]} {c.split(' ').slice(-1)[0]}
                  </button>
                  {hoveredCons===c&&st&&(
                    <div className="absolute z-[500] bottom-full left-0 mb-1 bg-gray-900 text-white text-[10px] font-bold rounded-xl px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none">
                      <div className="flex gap-3">
                        <span className="text-yellow-300">📅 Semana: <b>{st.semana}</b></span>
                        <span className="text-blue-300">📊 Total: <b>{st.total}</b></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {horario&&consultores.length>0&&(
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-[10px] font-black text-green-600 uppercase tracking-wide mb-1">📱 WhatsApp (1h antes)</p>
              <p className="text-xs text-green-800 font-mono leading-relaxed whitespace-pre-wrap">
                {consultores.map(c=>`@${c.split(' ')[0]}`).join(' ')} — *{nomeSessao}* às {horario}{plenario?` · Pl. ${plenario}`:''}
                {descricao?`\n💬 ${descricao}`:''}
                {'\n\nBoa sessão e lembre-se que você representa o setor. 🏛️'}
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={()=>{
            if(!nomeSessao.trim())return alert('Informe o nome da sessão!')
            onSave({id:item?.id,data:dataItem,nome_sessao:nomeSessao.trim().toUpperCase(),modalidade,
              horario:horario||undefined,plenario:plenario||undefined,descricao:descricao.trim()||undefined,
              pauta:pauta?Number(pauta):undefined,mesa:mesa?Number(mesa):undefined,
              setor:setor.trim()||undefined,
              consultores,criado_por:meuLogin})
          }} className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-black py-3 rounded-xl">
            💾 Salvar
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Sugestão ───────────────────────────────────────────────────────────
function ModalSugestao({ meuLogin, weekDays, weekStart, weekEndSun, onClose, onSalvar }: {
  meuLogin: string; weekDays: Date[]; weekStart: string; weekEndSun: string
  onClose: () => void; onSalvar: (sessoes: Omit<AgendaDetalhe,'id'|'criado_em'>[]) => Promise<void>
}) {
  const [escopo,      setEscopo]      = useState<'semana'|'dia'>('semana')
  const [dataAlvo,    setDataAlvo]    = useState(weekDays[0] ? weekStart : '')
  const [loading,     setLoading]     = useState(false)
  const [salvando,    setSalvando]    = useState(false)
  const [sugestoes,   setSugestoes]   = useState<(Omit<AgendaDetalhe,'id'|'criado_em'> & {_key:string; editando?:boolean})[]>([])
  const [gerado,      setGerado]      = useState(false)
  const [editIdx,     setEditIdx]     = useState<number|null>(null)
  const [addData,     setAddData]     = useState(weekStart)

  const CONS_LISTA = TODOS_CONSULTORES as string[]

  async function gerarSugestao() {
    setLoading(true)
    try {
      // 1. Busca sessões do escopo
      const ini = escopo === 'dia' ? dataAlvo : weekStart
      const fim = escopo === 'dia' ? dataAlvo : weekEndSun
      const { data: sessoes } = await supabase.from('agenda_detalhes')
        .select('*').gte('data', ini).lte('data', fim).order('data').order('horario', { nullsFirst: false })

      // 2. Busca histórico para detectar consultores de manhã
      const { data: hist } = await supabase.from('agenda_detalhes')
        .select('consultores,horario').limit(5000)

      // 3. Busca pesos: contagem semanal e total
      const [{ data: semData }, { data: totData }] = await Promise.all([
        supabase.from('agenda_detalhes').select('consultores').gte('data', weekStart).lte('data', weekEndSun).limit(500),
        supabase.from('agenda_detalhes').select('consultores').limit(10000),
      ])

      // Calcula consultores de manhã (horario < 12:00)
      const manhaCount: Record<string, number> = {}
      CONS_LISTA.forEach(c => { manhaCount[c] = 0 })
      hist?.forEach((r: any) => {
        const h = r.horario || ''
        const hora = parseInt(h.split(':')[0] || '13')
        if (hora < 12) {
          ;(r.consultores as string[] || []).forEach((c: string) => {
            if (manhaCount[c] !== undefined) manhaCount[c]++
          })
        }
      })
      const maxManha = Math.max(...Object.values(manhaCount), 1)
      const consultoresManha = CONS_LISTA.filter(c => manhaCount[c] > maxManha * 0.2).sort((a,b) => manhaCount[b] - manhaCount[a])

      // Calcula pesos semanal e total
      const semPeso: Record<string, number> = {}
      const totPeso: Record<string, number> = {}
      CONS_LISTA.forEach(c => { semPeso[c] = 0; totPeso[c] = 0 })
      semData?.forEach((r: any) => { (r.consultores as string[] || []).forEach((c: string) => { if (semPeso[c] !== undefined) semPeso[c]++ }) })
      totData?.forEach((r: any) => { (r.consultores as string[] || []).forEach((c: string) => { if (totPeso[c] !== undefined) totPeso[c]++ }) })

      // Ordena consultores por peso (menor semana primeiro, total como desempate)
      const sortByCarga = (lista: string[]) => [...lista].sort((a,b) => {
        const ds = semPeso[a] - semPeso[b]; if (ds !== 0) return ds
        return totPeso[a] - totPeso[b]
      })

      // Rodízio manhã
      let idxManha = 0
      const sortedManha = consultoresManha.length > 0 ? sortByCarga(consultoresManha) : sortByCarga(CONS_LISTA)
      const sortedGeral = sortByCarga(CONS_LISTA)
      let idxGeral = 0

      const resultado: (Omit<AgendaDetalhe,'id'|'criado_em'> & {_key:string})[] = (sessoes || []).map((s: any, i: number) => {
        const hora = parseInt((s.horario || '13').split(':')[0])
        const ehManha = hora < 12
        let consultor: string
        if (ehManha && sortedManha.length > 0) {
          consultor = sortedManha[idxManha % sortedManha.length]
          idxManha++; semPeso[consultor]++
        } else {
          consultor = sortedGeral[idxGeral % sortedGeral.length]
          idxGeral++; semPeso[consultor]++
        }
        return {
          _key: `${s.id}_${i}`,
          data: s.data, nome_sessao: s.nome_sessao,
          modalidade: s.modalidade, horario: s.horario, plenario: s.plenario,
          descricao: s.descricao, pauta: s.pauta, mesa: s.mesa, setor: s.setor,
          consultores: [consultor], criado_por: meuLogin,
        }
      })

      setSugestoes(resultado)
      setGerado(true)
    } catch(e) { alert('Erro ao gerar sugestão.') }
    setLoading(false)
  }

  async function confirmar() {
    setSalvando(true)
    const payload = sugestoes.map(({ _key, editando, ...s }) => s)
    await onSalvar(payload)
    setSalvando(false)
    onClose()
  }

  const nomeEx = (n: string) => { const p = n.trim().split(' ').filter(Boolean); return p.length <= 1 ? n : p[0]+' '+p[p.length-1] }

  return (
    <div className="fixed inset-0 z-[280] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-white flex justify-between items-start flex-shrink-0">
          <div>
            <h3 className="text-base font-black">💡 Sugestão de Distribuição</h3>
            <p className="text-xs text-white/60 mt-0.5">Peso semanal primeiro · Total como desempate</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Seletor escopo */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(['semana','dia'] as const).map(e => (
                <button key={e} onClick={() => setEscopo(e)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${escopo===e?'bg-white shadow text-violet-600':'text-gray-500 hover:text-gray-700'}`}>
                  {e==='semana'?'📆 Semana':'📅 Dia'}
                </button>
              ))}
            </div>
            {escopo==='dia' && (
              <input type="date" value={dataAlvo} onChange={e => setDataAlvo(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400" />
            )}
            {escopo==='semana' && (
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
                {weekDays[0]?.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – {weekDays[4]?.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
            )}
            <button onClick={gerarSugestao} disabled={loading}
              className="ml-auto bg-violet-600 hover:bg-violet-700 text-white font-black px-5 py-2 rounded-xl text-sm disabled:opacity-50 flex items-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block"/>Gerando...</> : '✨ Gerar Sugestão'}
            </button>
          </div>

          {/* Preview */}
          {gerado && sugestoes.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhuma sessão encontrada para o período selecionado.</p>
          )}

          {gerado && sugestoes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wide">{sugestoes.length} sessão(ões) sugerida(s)</p>
                <button onClick={() => {
                  const ini = escopo==='dia' ? dataAlvo : weekStart
                  const fim = escopo==='dia' ? dataAlvo : weekEndSun
                  setSugestoes(prev => [...prev, {
                    _key: `new_${Date.now()}`,
                    data: ini, nome_sessao: '', modalidade: 'PRESENCIAL',
                    horario: '13:30', plenario: '', descricao: '', consultores: [], criado_por: meuLogin,
                  }])
                  setEditIdx(sugestoes.length)
                }} className="text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-100">
                  ➕ Adicionar sessão
                </button>
              </div>

              {sugestoes.map((s, i) => (
                <div key={s._key} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {editIdx === i ? (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase">Data</label>
                          <input type="date" value={s.data}
                            onChange={e => setSugestoes(prev => prev.map((x,j) => j===i ? {...x,data:e.target.value} : x))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-400 mt-1"/>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-gray-400 uppercase">Horário</label>
                          <input type="time" value={s.horario||''}
                            onChange={e => setSugestoes(prev => prev.map((x,j) => j===i ? {...x,horario:e.target.value} : x))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-400 mt-1"/>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase">Nome da Sessão</label>
                        <input type="text" value={s.nome_sessao}
                          onChange={e => setSugestoes(prev => prev.map((x,j) => j===i ? {...x,nome_sessao:e.target.value.toUpperCase()} : x))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-400 mt-1"/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase">Consultor</label>
                        <select value={s.consultores[0]||''}
                          onChange={e => setSugestoes(prev => prev.map((x,j) => j===i ? {...x,consultores:e.target.value?[e.target.value]:[]} : x))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-400 mt-1 bg-white">
                          <option value="">— nenhum —</option>
                          {CONS_LISTA.map(c => <option key={c} value={c}>{nomeEx(c)}</option>)}
                        </select>
                      </div>
                      <button onClick={() => setEditIdx(null)}
                        className="text-xs font-bold bg-violet-600 text-white py-1.5 rounded-lg hover:bg-violet-700">✓ Confirmar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-violet-800 truncate">{s.nome_sessao||'(nova sessão)'}</p>
                        <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                          <span>{new Date(s.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}</span>
                          {s.horario && <span>🕐 {s.horario}</span>}
                          {s.plenario && <span>Pl. {s.plenario}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.consultores.length > 0
                          ? <span className="text-xs font-bold px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">{nomeEx(s.consultores[0])}</span>
                          : <span className="text-xs text-gray-300 italic">sem consultor</span>
                        }
                        <button onClick={() => setEditIdx(i)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-xs hover:bg-violet-50" title="Editar">✏️</button>
                        <button onClick={() => setSugestoes(prev => prev.filter((_,j) => j!==i))} className="w-6 h-6 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-xs text-red-500 hover:bg-red-100" title="Remover">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {gerado && sugestoes.length > 0 && (
          <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <button onClick={confirmar} disabled={salvando}
              className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-black py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Salvando...</> : `💾 Confirmar (${sugestoes.length} sessões)`}
            </button>
            <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function PainelGestaoSessoes(){
  const{meuLogin,adicionarMensagemMural}=useBastaoStore()
  const[aberto,setAberto]=useState(false)
  const[itens,setItens]=useState<AgendaDetalhe[]>([])
  const[atvsNaoSessao,setAtvsNaoSessao]=useState<Record<string,AtividadeDia[]>>({})
  const[loading,setLoading]=useState(false)
  const[copiando,setCopiando]=useState(false)
  const[enviandoResumo,setEnviandoResumo]=useState(false)
  const[semanaOffset,setSemanaOffset]=useState(0)
  const[modal,setModal]=useState<{data:string;item?:AgendaDetalhe}|null>(null)
  const[filtroConsultor,setFiltroConsultor]=useState('Todos')
  const[quickNome,setQuickNome]=useState<Record<string,string>>({})
  const[quickSaving,setQuickSaving]=useState<string|null>(null)
  const[reativarModal,setReativarModal]=useState<AgendaDetalhe|null>(null)
  const[dataReativacao,setDataReativacao]=useState('')
  const[modalSugestao,setModalSugestao]=useState(false)

  // Apenas Brenda e Farley podem editar
  const canEdit = meuLogin==='Brenda' || meuLogin==='Farley'

  const monday=useMemo(()=>{const m=getMonday(new Date());m.setDate(m.getDate()+semanaOffset*7);return m},[semanaOffset])
  const weekDays=useMemo(()=>getWeekDays(monday),[monday])
  const weekStart=fmtLocal(weekDays[0])
  const weekEndSun=useMemo(()=>{const s=new Date(monday);s.setDate(monday.getDate()+6);return fmtLocal(s)},[monday])

  useEffect(()=>{if(aberto)load()},[weekStart,weekEndSun,aberto])

  async function load(){
    setLoading(true)
    const[{data:sessoes},{data:ativs}]=await Promise.all([
      supabase.from('agenda_detalhes').select('*').gte('data',weekStart).lte('data',weekEndSun)
        .order('data').order('horario',{nullsFirst:false}),
      supabase.from('atividades_consultores').select('consultor,date,atividade')
        .gte('date',weekStart).lte('date',weekEndSun),
    ])
    setItens(sessoes||[])

    // Agrupa não-sessões por dia
    const naoSessaoMap: Record<string,Record<string,string[]>> = {}
    for(const a of ativs||[]){
      if(!a.atividade||a.atividade.toUpperCase().includes('SESS'))continue
      const partes=a.atividade.split('/').map((p:string)=>p.trim()).filter((p:string)=>!p.toUpperCase().includes('SESS'))
      for(const p of partes){
        if(p.length<2)continue
        if(!naoSessaoMap[a.date])naoSessaoMap[a.date]={}
        if(!naoSessaoMap[a.date][p])naoSessaoMap[a.date][p]=[]
        const short=a.consultor.split(' ')[0]+(a.consultor.split(' ').length>1?' '+a.consultor.split(' ').slice(-1)[0]:'')
        if(!naoSessaoMap[a.date][p].includes(short))naoSessaoMap[a.date][p].push(short)
      }
    }
    const result:Record<string,AtividadeDia[]>={}
    for(const[d,ativMap] of Object.entries(naoSessaoMap)){
      result[d]=Object.entries(ativMap)
        .map(([atividade,cons])=>({atividade,consultores:cons.sort()}))
        .sort((a,b)=>a.atividade.localeCompare(b.atividade))
    }
    setAtvsNaoSessao(result)
    setLoading(false)
  }

  async function handleSalvar(payload:Omit<AgendaDetalhe,'criado_em'>&{id?:string}){
    const{id,...basePayload}=payload

    // Busca nome disponível: verifica se data+nome já existe (excluindo o próprio registro)
    async function nomeDisponivel(nome: string): Promise<string> {
      let tentativa = 0
      while (tentativa < 10) {
        const nomeTentativa = tentativa === 0 ? nome : `${nome} (${tentativa + 1})`
        let query = supabase.from('agenda_detalhes')
          .select('id').eq('data', basePayload.data).eq('nome_sessao', nomeTentativa)
        if (id) query = query.neq('id', id)  // exclui o próprio na edição
        const { data: existe } = await query.maybeSingle()
        if (!existe) return nomeTentativa  // nome livre
        tentativa++
      }
      return `${nome} (${Date.now()})`  // fallback
    }

    const nomeOk = await nomeDisponivel(basePayload.nome_sessao)
    basePayload.nome_sessao = nomeOk

    if(id){
      await supabase.from('agenda_detalhes').update(basePayload).eq('id',id)
    } else {
      await supabase.from('agenda_detalhes').insert({...basePayload, criado_em: new Date().toISOString()})
    }
    const dataBR=new Date(basePayload.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})
    const msg=`📅 ${id?'Atualizada':'Nova sessão'}: ${basePayload.nome_sessao} — ${dataBR}${basePayload.horario?' às '+basePayload.horario:''}${basePayload.plenario?' · Pl.'+basePayload.plenario:''} · ${basePayload.consultores.map(c=>c.split(' ')[0]).join(', ')||'sem consultor'}`
    adicionarMensagemMural(msg,'comum',meuLogin!)
    try{
      await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        evento:'agenda_sessao',acao:id?'atualizado':'criado',...basePayload,
        mensagem_whatsapp:basePayload.horario&&basePayload.consultores.length>0
          ?`${basePayload.consultores.map(c=>`@${c.split(' ')[0]}`).join(' ')} — *${basePayload.nome_sessao}* às ${basePayload.horario}${basePayload.plenario?' · Plenário '+basePayload.plenario:''}${basePayload.descricao?'\n💬 '+basePayload.descricao:''}\n\nBoa sessão e lembre-se que você representa o setor. 🏛️`
          :null,
        horario_envio_1h_antes:(()=>{
          if(!basePayload.data||!basePayload.horario)return null
          const[h,m]=basePayload.horario.split(':').map(Number)
          const dt=new Date(`${basePayload.data}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
          dt.setHours(dt.getHours()-1);return dt.toISOString()
        })(),
        secretaria:meuLogin,
      })})
    }catch{}
    setModal(null);await load()
  }

  async function handleDeletar(item:AgendaDetalhe){
    if(!confirm(`Remover "${item.nome_sessao}"?`))return
    await supabase.from('agenda_detalhes').delete().eq('id',item.id)
    await load()
  }

  async function handleQuickAdd(dateStr: string) {
    const nome = (quickNome[dateStr] || '').trim().toUpperCase()
    if (!nome) return
    setQuickSaving(dateStr)
    // Verifica disponibilidade do nome
    let nomeOk = nome
    for (let t = 1; t < 10; t++) {
      const { data: existe } = await supabase.from('agenda_detalhes')
        .select('id').eq('data', dateStr).eq('nome_sessao', nomeOk).maybeSingle()
      if (!existe) break
      nomeOk = `${nome} (${t + 1})`
    }
    const { error } = await supabase.from('agenda_detalhes').insert({
      data: dateStr, nome_sessao: nomeOk,
      modalidade: MODALIDADE_PADRAO(nomeOk),
      consultores: [], criado_por: meuLogin!, criado_em: new Date().toISOString()
    })
    if (!error) {
      setQuickNome(p => ({ ...p, [dateStr]: '' }))
      adicionarMensagemMural(`📅 Nova sessão: ${nomeOk} — ${new Date(dateStr+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`, 'comum', meuLogin!)
    }
    setQuickSaving(null)
    await load()
  }

  async function handleSuspenderSessao(item: AgendaDetalhe) {
    if (!confirm(`Suspender "${item.nome_sessao}"?`)) return
    await supabase.from('agenda_detalhes').update({ suspenso: true }).eq('id', item.id)
    await load()
  }

  async function handleReativarSessao() {
    if (!reativarModal || !dataReativacao) return alert('Informe a data!')
    await supabase.from('agenda_detalhes')
      .update({ suspenso: false, data: dataReativacao }).eq('id', reativarModal.id)
    setReativarModal(null); setDataReativacao('')
    await load()
  }

  async function copiarSemanaAnterior(){
    setCopiando(true)
    const semAntStart=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-7)))
    const semAntEnd=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-1)))
    const{data:anterior}=await supabase.from('agenda_detalhes').select('*').gte('data',semAntStart).lte('data',semAntEnd)
    if(!anterior?.length){alert('Nenhuma sessão na semana anterior.');setCopiando(false);return}
    let copiados=0
    for(const old of anterior){
      const dw=new Date(old.data+'T12:00:00').getDay()
      const novaData=fmtLocal(weekDays[dw-1])
      const base={data:novaData,modalidade:old.modalidade,horario:old.horario,
        plenario:old.plenario,descricao:old.descricao,pauta:old.pauta,mesa:old.mesa,
        setor:old.setor,consultores:old.consultores,criado_por:meuLogin!,criado_em:new Date().toISOString()}
      let tentativa=0
      while(tentativa<10){
        const nome=tentativa===0?old.nome_sessao:`${old.nome_sessao} (${tentativa+1})`
        const{error}=await supabase.from('agenda_detalhes').insert({...base,nome_sessao:nome})
        if(!error){copiados++;break}
        if(!isDuplicate(error))break
        tentativa++
      }
    }
    if(copiados>0){
      adicionarMensagemMural(`📅 ${copiados} sessões copiadas para a semana de ${weekDays[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`, 'comum', meuLogin!)
    } else alert('Todas as sessões já estão na semana atual.')
    await load();setCopiando(false)
  }

  // Envia resumo do dia no mural e WhatsApp (Brenda/Farley)
  async function enviarResumoDia(data:string){
    setEnviandoResumo(true)
    const sessoesDia=itens.filter(i=>i.data===data)
    const atividadesDia=atvsNaoSessao[data]||[]
    const dataBR=new Date(data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})

    // Filtra só atividades relevantes (não Atendimento pres.)
    const atvsRelevantes=atividadesDia.filter(a=>!a.atividade.toLowerCase().includes('atendimento'))

    // Linhas do resumo
    const linhas:string[]=[]
    for(const a of atvsRelevantes){
      const ic=iconeAtividade(a.atividade)
      const isComp=a.atividade.toLowerCase().includes('compensa')
      linhas.push(`${ic} *${a.atividade}:* ${a.consultores.join(', ')}${isComp?' — Bom descanso! 🌴':''}`)
    }

    const msgMural=[
      `📋 *Bom dia! Resumo de ${dataBR}:*`,
      ...linhas,
      sessoesDia.length>0?`🏛️ *Sessões hoje:* ${sessoesDia.length} sessão(ões)`:null,
    ].filter(Boolean).join('\n')

    adicionarMensagemMural(msgMural,'comum','Brenda')

    // Webhook para WhatsApp às 8h
    try{
      await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        evento:'resumo_dia',
        data,dataBR,
        atividades:atvsRelevantes,
        total_sessoes:sessoesDia.length,
        mensagem_whatsapp:`📋 *CESUPE — ${dataBR}*\n\n${linhas.join('\n')}${sessoesDia.length>0?`\n\n🏛️ *${sessoesDia.length} sessão(ões) hoje*`:''}`,
        horario_envio:'08:00',
        secretaria:meuLogin,
      })})
    }catch{}
    setEnviandoResumo(false)
  }

  // Agrupamento com filtro
  const itensPorDia=useMemo(()=>{
    const map:Record<string,AgendaDetalhe[]>={}
    for(const d of weekDays)map[fmtLocal(d)]=[]
    for(const it of itens){
      if(!map[it.data])continue
      const ok=filtroConsultor==='Todos'||it.consultores.includes(filtroConsultor)||(filtroConsultor==='Minhas'&&it.consultores.includes(meuLogin||''))
      if(ok)map[it.data].push(it)
    }
    return map
  },[itens,weekDays,filtroConsultor,meuLogin])

  if(!aberto)return(
    <button onClick={()=>setAberto(true)}
      className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 hover:from-violet-600 hover:via-purple-600 hover:to-indigo-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0">
      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📅</span>
      <span className="tracking-wide">Sessões &amp; Plantões &amp; Observações</span>
      <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
    </button>
  )

  return(
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-black text-white">📅 Sessões &amp; Plantões &amp; Observações</h2>
            <p className="text-xs text-white/60">{itens.length} sessões esta semana</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit&&(
              <>
                <button onClick={copiarSemanaAnterior} disabled={copiando}
                  className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-xs disabled:opacity-50 flex items-center gap-1.5">
                  {copiando?'⏳':'📋'} Copiar sem. ant.
                </button>
                <button onClick={()=>setModalSugestao(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                  💡 Sugestão
                </button>
                <button onClick={()=>setModal({data:fmtLocal(new Date())})}
                  className="bg-white text-violet-700 hover:bg-violet-50 font-black px-3 py-1.5 rounded-xl text-xs">
                  + Sessão
                </button>
              </>
            )}
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
            {semanaOffset!==0&&<button onClick={()=>setSemanaOffset(0)} className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg">Hoje</button>}
          </div>
          <select value={filtroConsultor} onChange={e=>setFiltroConsultor(e.target.value)}
            className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-violet-400">
            <option value="Todos">Todos</option>
            {meuLogin&&<option value="Minhas">Minhas sessões</option>}
            {TODOS_CONSULTORES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Dias */}
        {loading
          ?<div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"/></div>
          :<div className="divide-y divide-gray-50">
            {weekDays.map(d=>{
              const dateStr=fmtLocal(d)
              const isToday=dateStr===fmtLocal(new Date())
              const sessDia=itensPorDia[dateStr]?.filter(i=>!i.suspenso)??[]
              const atvsNSdia=(atvsNaoSessao[dateStr]||[]).filter(a=>!a.atividade.toLowerCase().includes('atendimento pres'))

              return(
                <div key={dateStr} className={`px-5 py-4 ${isToday?'bg-violet-50/20':''}`}>
                  {/* Cabeçalho do dia */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm font-black ${isToday?'text-violet-700':'text-gray-700'}`}>{DIAS_PT[d.getDay()]}</span>
                    <span className={`text-xs font-bold ${isToday?'text-violet-400':'text-gray-400'}`}>{d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</span>
                    {isToday&&<span className="bg-violet-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">HOJE</span>}
                    <span className={`ml-auto text-xs font-black ${sessDia.length>0?'text-violet-500':'text-gray-300'}`}>
                      {sessDia.length} {sessDia.length===1?'sessão':'sessões'}
                    </span>
                    {canEdit&&(
                      <div className="flex gap-1.5">
                        <button onClick={()=>enviarResumoDia(dateStr)} disabled={enviandoResumo}
                          className="text-[10px] bg-green-50 hover:bg-green-100 text-green-700 font-bold px-2 py-1 rounded-lg border border-green-200 disabled:opacity-50"
                          title="Enviar resumo do dia no mural + WhatsApp">
                          📤 Resumo
                        </button>
                        <button onClick={()=>setModal({data:dateStr})}
                          className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-600 font-bold px-2.5 py-1 rounded-lg border border-violet-100">
                          + Sessão
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Grid de sessões */}
                  {sessDia.length===0
                    ?<p className="text-xs text-gray-300 italic mb-3">Nenhuma sessão</p>
                    :<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
                      {sessDia.map(it=>(
                        <CardSessao key={it.id} item={it} canEdit={canEdit}
                          onEdit={()=>setModal({data:it.data,item:it})}
                          onDelete={()=>handleDeletar(it)}
                          onSuspend={()=>handleSuspenderSessao(it)}/>
                      ))}
                    </div>
                  }

                  {/* Quick-add inline */}
                  {canEdit&&(
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={quickNome[dateStr]||''}
                        onChange={e=>setQuickNome(p=>({...p,[dateStr]:e.target.value}))}
                        onKeyDown={e=>e.key==='Enter'&&handleQuickAdd(dateStr)}
                        placeholder="+ Digitar sessão e Enter..."
                        className="flex-1 border border-violet-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-violet-50 placeholder:text-violet-300"
                        list={`sessoes-${dateStr}`}
                      />
                      <datalist id={`sessoes-${dateStr}`}>
                        {SESSOES_CATALOGO.map(s=><option key={s} value={s}/>)}
                      </datalist>
                      <button
                        disabled={!quickNome[dateStr]?.trim()||quickSaving===dateStr}
                        onClick={()=>handleQuickAdd(dateStr)}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-black px-3 py-1.5 rounded-xl text-xs disabled:opacity-40 transition-all"
                      >
                        {quickSaving===dateStr?'⏳':'✓'}
                      </button>
                    </div>
                  )}

                  {/* Atividades não-sessão */}
                  {atvsNSdia.length>0&&(
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wide mb-2">📋 Observações do dia</p>
                      <div className="flex flex-wrap gap-2">
                        {atvsNSdia.map(a=>(
                          <div key={a.atividade} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs">
                            <span className="font-black text-gray-700">{iconeAtividade(a.atividade)} {a.atividade}</span>
                            <span className="text-gray-400 ml-1">— {a.consultores.map(c=>nomeExibicao(c)).join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        }

        {/* Sessões suspensas */}
        {canEdit && itens.some(i=>i.suspenso) && (
          <div className="border-t border-gray-100 px-5 py-4">
            <p className="text-xs font-black text-yellow-600 uppercase tracking-wide mb-3">⏸️ Sessões suspensas</p>
            <div className="flex flex-wrap gap-2">
              {itens.filter(i=>i.suspenso).map(it=>(
                <div key={it.id} className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                  <span className="text-xs font-bold text-yellow-800">{it.nome_sessao}</span>
                  <button onClick={()=>{setReativarModal(it);setDataReativacao(fmtLocal(new Date()))}}
                    className="text-[10px] bg-green-100 hover:bg-green-200 text-green-700 font-bold px-2 py-0.5 rounded-lg">
                    ▶ Reativar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal&&(
        <ModalSessao
          data={modal.data}
          item={modal.item}
          onSave={handleSalvar}
          onClose={()=>setModal(null)}
          meuLogin={meuLogin!}
        />
      )}

      {modalSugestao&&(
        <ModalSugestao
          meuLogin={meuLogin!}
          weekDays={weekDays}
          weekStart={weekStart}
          weekEndSun={weekEndSun}
          onClose={()=>setModalSugestao(false)}
          onSalvar={async (sessoes)=>{
            for(const s of sessoes){
              const{criado_por,...rest}=s
              await supabase.from('agenda_detalhes').insert({
                ...rest,criado_por,criado_em:new Date().toISOString()
              })
            }
            adicionarMensagemMural(`💡 ${sessoes.length} sessões distribuídas via Sugestão`,'comum',meuLogin!)
            await load()
          }}
        />
      )}

      {/* Modal reativar sessão */}
      {reativarModal&&(
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={()=>setReativarModal(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6"
            onClick={e=>e.stopPropagation()}>
            <h3 className="text-base font-black text-gray-800 mb-1">▶ Reativar sessão</h3>
            <p className="text-sm text-violet-600 font-bold mb-4">{reativarModal.nome_sessao}</p>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data de reativação</label>
            <input type="date" value={dataReativacao} onChange={e=>setDataReativacao(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 mb-4"/>
            <div className="flex gap-2">
              <button disabled={!dataReativacao} onClick={handleReativarSessao}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-black py-2.5 rounded-xl disabled:opacity-50">
                ▶ Reativar
              </button>
              <button onClick={()=>setReativarModal(null)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold py-2.5 rounded-xl hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
