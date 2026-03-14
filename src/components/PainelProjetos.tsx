import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFotoConsultor } from '../constants/fotosConsultores'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Projeto {
  id: number
  name: string
  description: string
  pin_code?: string
}

interface Tarefa {
  id: number
  project_id: number
  title: string
  description?: string
  owner_name?: string
  start_date?: string
  end_date?: string
  progress: number
  status: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }
  catch { return d }
}

const isVencida = (d?: string | null, progress?: number) => {
  if (!d || progress === 100) return false
  return new Date(d + 'T12:00:00') < new Date()
}

const STATUS_COLS = ['Não Iniciado', 'Em Andamento', 'Concluído'] as const
type StatusCol = typeof STATUS_COLS[number]

const COR_STATUS: Record<StatusCol, { bg: string; border: string; text: string; dot: string }> = {
  'Não Iniciado': { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    dot: 'bg-red-400'    },
  'Em Andamento': { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  'Concluído':    { bg: 'bg-green-50',  border: 'border-green-300',  text: 'text-green-700',  dot: 'bg-green-500'  },
}

const ICONE_STATUS: Record<StatusCol, string> = {
  'Não Iniciado': '📝',
  'Em Andamento': '🔨',
  'Concluído':    '✅',
}

function BarraProgresso({ value, status }: { value: number; status: string }) {
  const cor = status === 'Concluído' ? '#5cb85c' : status === 'Em Andamento' ? '#f0ad4e' : '#d9534f'
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: cor }} />
    </div>
  )
}


// ─── Gerador de Relatório HTML ────────────────────────────────────────────────
function gerarRelatorioHTML(projeto: Projeto, tarefas: Tarefa[]): string {
  const sorted = [...tarefas].sort((a,b) => (a.end_date||'').localeCompare(b.end_date||''))
  const total = tarefas.length
  const concl = tarefas.filter(t => t.progress === 100).length
  const pct   = total > 0 ? Math.round((concl/total)*100) : 0
  const media = total > 0 ? Math.round(tarefas.reduce((s,t)=>s+t.progress,0)/total) : 0
  const maxD  = tarefas.reduce((m,t)=>t.end_date&&t.end_date>m?t.end_date:m,'')
  const prev  = maxD ? new Date(maxD+'T12:00:00').toLocaleDateString('pt-BR') : 'N/D'
  const hoje  = new Date().toLocaleDateString('pt-BR')

  const statusStyle: Record<string,string> = {
    'Concluído':    'background:#dff0d8;color:#3c763d',
    'Em Andamento': 'background:#fcf8e3;color:#8a6d3b',
    'Não Iniciado': 'background:#f2dede;color:#a94442',
  }
  const rows = sorted.map(t => {
    const s = statusStyle[t.status] || ''
    const ini = t.start_date ? new Date(t.start_date+'T12:00:00').toLocaleDateString('pt-BR') : '—'
    const fim = t.end_date   ? new Date(t.end_date+'T12:00:00').toLocaleDateString('pt-BR')   : '—'
    return `<tr style="${s}"><td>${t.title}</td><td style="font-weight:bold;">${t.status}</td><td>${t.progress}%</td><td>${t.owner_name||'—'}</td><td>${ini}</td><td>${fim}</td></tr>`
  }).join('')

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório — ${projeto.name}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:32px;background:#f8f9fa;color:#333}
  h1{color:#1e1e2e;font-size:28px;margin-bottom:4px}
  .sub{color:#888;font-size:13px;margin-bottom:24px}
  .kpis{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap}
  .kpi{background:white;border-radius:12px;padding:16px 24px;box-shadow:0 2px 8px rgba(0,0,0,.08);flex:1;min-width:140px}
  .kpi-val{font-size:28px;font-weight:900;color:#4f46e5}
  .kpi-lbl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-top:4px}
  .prog{background:#e9ecef;border-radius:8px;height:10px;margin:20px 0}
  .prog-fill{height:100%;border-radius:8px;background:linear-gradient(90deg,#4f46e5,#7c3aed)}
  table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  th{background:#1e1e2e;color:white;padding:12px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px}
  tr:last-child td{border-bottom:none}
  .footer{margin-top:24px;font-size:12px;color:#aaa;text-align:right}
</style></head><body>
<h1>🚀 ${projeto.name}</h1>
<p class="sub">${projeto.description || ''} · Gerado em ${hoje}</p>
<div class="kpis">
  <div class="kpi"><div class="kpi-val">${total}</div><div class="kpi-lbl">📋 Total de tarefas</div></div>
  <div class="kpi"><div class="kpi-val">${concl}</div><div class="kpi-lbl">✅ Concluídas</div></div>
  <div class="kpi"><div class="kpi-val">${pct}%</div><div class="kpi-lbl">📊 % Concluído</div></div>
  <div class="kpi"><div class="kpi-val">${media}%</div><div class="kpi-lbl">📈 Progresso Global</div></div>
  <div class="kpi"><div class="kpi-val">${prev}</div><div class="kpi-lbl">📅 Previsão Término</div></div>
</div>
<div class="prog"><div class="prog-fill" style="width:${media}%"></div></div>
<table><thead><tr><th>Atividade</th><th>Status</th><th>%</th><th>Responsável</th><th>Início</th><th>Fim</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="footer">CESUPE · TJMG</p>
</body></html>`
}

// ─── Avatar do Consultor ──────────────────────────────────────────────────────
function AvatarConsultor({ nome }: { nome: string }) {
  const [aberto, setAberto] = useState(false)
  const foto = getFotoConsultor(nome)
  const primeiroNome = nome.split(' ')[0]

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-all ${
          foto
            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer'
            : 'bg-gray-100 text-gray-600'
        }`}>
        {primeiroNome}
      </button>
      {aberto && foto && (
        <>
          <div className="fixed inset-0 z-[600]" onClick={() => setAberto(false)} />
          <div className="absolute z-[601] bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 flex flex-col items-center gap-2 w-36 pointer-events-auto">
            <img src={foto} alt={nome} className="w-20 h-20 rounded-full object-cover border-2 border-indigo-200 shadow" />
            <p className="text-xs font-black text-gray-700 text-center leading-tight">{nome}</p>
            <button onClick={() => setAberto(false)} className="text-[10px] text-gray-400 hover:text-gray-600">✕ fechar</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Card de Tarefa ───────────────────────────────────────────────────────────
function CardTarefa({
  tarefa, canEdit, membros,
  onSalvar, onDeletar
}: {
  tarefa: Tarefa; canEdit: boolean; membros: string[]
  onSalvar: (t: Tarefa) => void; onDeletar: (id: number) => void
}) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ ...tarefa })
  const [salvando, setSalvando] = useState(false)
  const venc = isVencida(tarefa.end_date, tarefa.progress)
  const cor = COR_STATUS[tarefa.status as StatusCol] ?? COR_STATUS['Não Iniciado']

  async function salvar() {
    setSalvando(true)
    await onSalvar(form)
    setSalvando(false)
    setEditando(false)
  }

  const donos = tarefa.owner_name ? tarefa.owner_name.split('/').map(s => s.trim()) : []

  return (
    <div className={`rounded-2xl border-2 p-3 bg-white shadow-sm ${venc ? 'border-red-300' : 'border-gray-200'} hover:shadow-md transition-all`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-black text-gray-800 leading-snug flex-1">{tarefa.title}</p>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setForm({ ...tarefa }); setEditando(true) }}
              className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-blue-100 border border-gray-200 flex items-center justify-center text-xs">✏️</button>
            <button onClick={() => { if (confirm('Remover tarefa?')) onDeletar(tarefa.id) }}
              className="w-6 h-6 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-xs text-red-500">✕</button>
          </div>
        )}
      </div>

      {/* Responsáveis */}
      {donos.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {donos.map(d => <AvatarConsultor key={d} nome={d} />)}
        </div>
      )}

      {/* Data e progresso */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
        <span className={venc ? 'text-red-600 font-black' : ''}>
          {venc ? '🔴' : '📅'} {fmtDate(tarefa.end_date)}
        </span>
        <span className="font-bold">{tarefa.progress}%</span>
      </div>
      <BarraProgresso value={tarefa.progress} status={tarefa.status} />

      {/* Badge status */}
      <div className="mt-2">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cor.bg} ${cor.text} border ${cor.border}`}>
          {ICONE_STATUS[tarefa.status as StatusCol]} {tarefa.status}
        </span>
      </div>

      {/* Modal edição */}
      {editando && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditando(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 text-white flex justify-between items-center">
              <h3 className="font-black text-sm">✏️ Editar Tarefa</h3>
              <button onClick={() => setEditando(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Descrição</label>
                <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Responsáveis</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1 max-h-32 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
                  {membros.map(m => {
                    const donos = form.owner_name ? form.owner_name.split('/').map(s => s.trim()) : []
                    const sel = donos.includes(m)
                    return (
                      <button key={m} type="button"
                        onClick={() => {
                          const cur = form.owner_name ? form.owner_name.split('/').map(s => s.trim()) : []
                          const next = sel ? cur.filter(x => x !== m) : [...cur, m]
                          setForm(f => ({ ...f, owner_name: next.join(' / ') }))
                        }}
                        className={`text-xs px-2 py-1.5 rounded-lg font-bold border transition-all text-left ${sel ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'}`}>
                        {sel && '✓ '}{m.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Início</label>
                  <input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Prazo</label>
                  <input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Progresso: {form.progress}%</label>
                <input type="range" min={0} max={100} value={form.progress}
                  onChange={e => {
                    const p = Number(e.target.value)
                    const s = p === 100 ? 'Concluído' : p === 0 ? 'Não Iniciado' : 'Em Andamento'
                    setForm(f => ({ ...f, progress: p, status: s }))
                  }}
                  className="w-full mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Status</label>
                <div className="flex gap-2 mt-1">
                  {STATUS_COLS.map(s => {
                    const cor = COR_STATUS[s]
                    return (
                      <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-black border-2 transition-all ${form.status === s ? `${cor.bg} ${cor.border} ${cor.text}` : 'border-gray-200 text-gray-400 bg-white'}`}>
                        {ICONE_STATUS[s]} {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={salvar} disabled={salvando}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl disabled:opacity-50">
                {salvando ? 'Salvando...' : '💾 Salvar'}
              </button>
              <button onClick={() => setEditando(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function PainelProjetos({ canEdit = false }: { canEdit?: boolean }) {
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [projetoAtivo, setProjetoAtivo] = useState<Projeto | null>(null)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [membros, setMembros] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modalNovaTarefa, setModalNovaTarefa] = useState(false)
  const [modalNovoProjeto, setModalNovoProjeto] = useState(false)
  const [formTarefa, setFormTarefa] = useState({ title: '', description: '', owner_name: '', start_date: '', end_date: '', progress: 0, status: 'Não Iniciado' })
  const [formProjeto, setFormProjeto] = useState({ name: '', description: '' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { loadProjetos() }, [])
  useEffect(() => { if (projetoAtivo) loadTarefas(projetoAtivo.id) }, [projetoAtivo])

  async function loadProjetos() {
    setLoading(true)
    const [{ data: prj }, { data: mem }] = await Promise.all([
      supabase.from('projects').select('*').order('created_at'),
      supabase.from('members').select('name').order('name'),
    ])
    setProjetos(prj || [])
    setMembros((mem || []).map((m: any) => m.name))
    if (prj && prj.length > 0) setProjetoAtivo(prj[0])
    setLoading(false)
  }

  async function loadTarefas(projectId: number) {
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('end_date')
    setTarefas(data || [])
  }

  async function salvarTarefa(t: Tarefa) {
    const { id, project_id, ...payload } = t
    await supabase.from('tasks').update(payload).eq('id', id)
    await loadTarefas(projetoAtivo!.id)
  }

  async function deletarTarefa(id: number) {
    await supabase.from('tasks').delete().eq('id', id)
    setTarefas(prev => prev.filter(t => t.id !== id))
  }

  async function criarTarefa() {
    if (!formTarefa.title.trim() || !projetoAtivo) return
    setSalvando(true)
    await supabase.from('tasks').insert({ ...formTarefa, project_id: projetoAtivo.id })
    setModalNovaTarefa(false)
    setFormTarefa({ title: '', description: '', owner_name: '', start_date: '', end_date: '', progress: 0, status: 'Não Iniciado' })
    await loadTarefas(projetoAtivo.id)
    setSalvando(false)
  }

  async function criarProjeto() {
    if (!formProjeto.name.trim()) return
    setSalvando(true)
    const { data } = await supabase.from('projects').insert({ ...formProjeto }).select().single()
    await loadProjetos()
    if (data) setProjetoAtivo(data)
    setModalNovoProjeto(false)
    setFormProjeto({ name: '', description: '' })
    setSalvando(false)
  }

  // Métricas
  const total    = tarefas.length
  const concl    = tarefas.filter(t => t.progress === 100).length
  const pct      = total > 0 ? Math.round((concl / total) * 100) : 0
  const mediaP   = total > 0 ? Math.round(tarefas.reduce((s, t) => s + t.progress, 0) / total) : 0
  const maxDate  = tarefas.reduce((m, t) => t.end_date && t.end_date > m ? t.end_date : m, '')
  const previsao = maxDate ? fmtDate(maxDate).replace('/', '/') : 'N/D'

  const tarefasPorStatus = STATUS_COLS.reduce((acc, s) => {
    acc[s] = tarefas.filter(t => t.status === s)
    return acc
  }, {} as Record<StatusCol, Tarefa[]>)

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-5 py-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-black text-white">🚀 Gestão de Projetos</h2>
            <p className="text-xs text-white/60">Kanban · Progresso · Equipe</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de projeto */}
            <select
              value={projetoAtivo?.id ?? ''}
              onChange={e => {
                const p = projetos.find(x => x.id === Number(e.target.value))
                if (p) setProjetoAtivo(p)
              }}
              className="border border-white/30 bg-white/20 text-white font-bold text-sm rounded-xl px-3 py-1.5 outline-none focus:bg-white/30">
              {projetos.map(p => <option key={p.id} value={p.id} className="text-gray-800">{p.name}</option>)}
            </select>
            {projetoAtivo && tarefas.length > 0 && !canEdit && (
              <button onClick={() => {
                const html = gerarRelatorioHTML(projetoAtivo, tarefas)
                const blob = new Blob([html], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `Relatorio_${projetoAtivo.name}.html`; a.click()
                URL.revokeObjectURL(url)
              }} className="bg-white text-indigo-700 hover:bg-indigo-50 font-black px-3 py-1.5 rounded-xl text-xs">
                📄 Relatório
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={() => setModalNovaTarefa(true)}
                  className="bg-white text-indigo-700 hover:bg-indigo-50 font-black px-3 py-1.5 rounded-xl text-xs">
                  + Tarefa
                </button>
                <button onClick={() => setModalNovoProjeto(true)}
                  className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-xs">
                  + Projeto
                </button>
                {projetoAtivo && tarefas.length > 0 && (
                  <button onClick={() => {
                    const html = gerarRelatorioHTML(projetoAtivo, tarefas)
                    const blob = new Blob([html], { type: 'text/html' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `Relatorio_${projetoAtivo.name}.html`; a.click()
                    URL.revokeObjectURL(url)
                  }} className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-1.5 rounded-xl text-xs">
                    📄 Relatório
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Descrição do projeto */}
        {projetoAtivo?.description && (
          <p className="text-xs text-white/60 mt-2 italic">{projetoAtivo.description}</p>
        )}
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* KPIs */}
        {total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: total, from: 'from-gray-500', to: 'to-gray-700', icon: '📋' },
              { label: 'Concluídas', value: `${concl} (${pct}%)`, from: 'from-green-500', to: 'to-green-700', icon: '✅' },
              { label: 'Progresso Global', value: `${mediaP}%`, from: 'from-indigo-500', to: 'to-indigo-700', icon: '📊' },
              { label: 'Previsão', value: previsao, from: 'from-amber-400', to: 'to-amber-600', icon: '📅' },
            ].map(k => (
              <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.from} ${k.to} p-3 text-white`}>
                <p className="text-[10px] font-bold uppercase opacity-70">{k.icon} {k.label}</p>
                <p className="text-xl font-black">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Barra de progresso global */}
        {total > 0 && (
          <div>
            <div className="flex justify-between text-xs font-bold text-gray-500 mb-1">
              <span>Progresso Global</span>
              <span>{mediaP}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-700"
                style={{ width: `${mediaP}%` }} />
            </div>
          </div>
        )}

        {/* Kanban */}
        {total === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm italic">
            Nenhuma tarefa neste projeto.{canEdit ? ' Clique em "+ Tarefa" para adicionar.' : ''}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUS_COLS.map(status => {
              const cor = COR_STATUS[status]
              const lista = tarefasPorStatus[status]
              return (
                <div key={status}>
                  {/* Cabeçalho da coluna */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-3 ${cor.bg} border ${cor.border}`}>
                    <span className={`text-sm font-black ${cor.text}`}>
                      {ICONE_STATUS[status]} {status}
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-white/70 ${cor.text}`}>
                      {lista.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
                    {lista.length === 0 ? (
                      <p className="text-xs text-gray-300 italic text-center py-6">Nenhuma tarefa</p>
                    ) : (
                      lista.map(t => (
                        <CardTarefa key={t.id} tarefa={t} canEdit={canEdit} membros={membros}
                          onSalvar={salvarTarefa} onDeletar={deletarTarefa} />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Tarefa */}
      {modalNovaTarefa && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalNovaTarefa(false)}>
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 text-white flex justify-between items-center">
              <h3 className="font-black text-sm">➕ Nova Tarefa — {projetoAtivo?.name}</h3>
              <button onClick={() => setModalNovaTarefa(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Título *</label>
                <input value={formTarefa.title} onChange={e => setFormTarefa(f => ({ ...f, title: e.target.value }))} autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" placeholder="Nome da tarefa..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Descrição</label>
                <textarea value={formTarefa.description} onChange={e => setFormTarefa(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1 resize-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Responsáveis</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1 max-h-32 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
                  {membros.map(m => {
                    const donos = formTarefa.owner_name ? formTarefa.owner_name.split('/').map(s => s.trim()) : []
                    const sel = donos.includes(m)
                    return (
                      <button key={m} type="button"
                        onClick={() => {
                          const cur = formTarefa.owner_name ? formTarefa.owner_name.split('/').map(s => s.trim()) : []
                          const next = sel ? cur.filter(x => x !== m) : [...cur, m]
                          setFormTarefa(f => ({ ...f, owner_name: next.join(' / ') }))
                        }}
                        className={`text-xs px-2 py-1.5 rounded-lg font-bold border transition-all text-left ${sel ? 'border-indigo-500 bg-indigo-100 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'}`}>
                        {sel && '✓ '}{m.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Início</label>
                  <input type="date" value={formTarefa.start_date} onChange={e => setFormTarefa(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase">Prazo</label>
                  <input type="date" value={formTarefa.end_date} onChange={e => setFormTarefa(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Progresso: {formTarefa.progress}%</label>
                <input type="range" min={0} max={100} value={formTarefa.progress}
                  onChange={e => {
                    const p = Number(e.target.value)
                    const s = p === 100 ? 'Concluído' : p === 0 ? 'Não Iniciado' : 'Em Andamento'
                    setFormTarefa(f => ({ ...f, progress: p, status: s }))
                  }}
                  className="w-full mt-1" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={criarTarefa} disabled={salvando || !formTarefa.title.trim()}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl disabled:opacity-50">
                {salvando ? 'Criando...' : '💾 Criar Tarefa'}
              </button>
              <button onClick={() => setModalNovaTarefa(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Projeto */}
      {modalNovoProjeto && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setModalNovoProjeto(false)}>
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-violet-700 p-4 text-white flex justify-between items-center">
              <h3 className="font-black text-sm">🆕 Novo Projeto</h3>
              <button onClick={() => setModalNovoProjeto(false)} className="text-white/60 hover:text-white">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Nome *</label>
                <input value={formProjeto.name} onChange={e => setFormProjeto(f => ({ ...f, name: e.target.value }))} autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase">Descrição</label>
                <textarea value={formProjeto.description} onChange={e => setFormProjeto(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 mt-1 resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button onClick={criarProjeto} disabled={salvando || !formProjeto.name.trim()}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl disabled:opacity-50">
                {salvando ? 'Criando...' : '💾 Criar Projeto'}
              </button>
              <button onClick={() => setModalNovoProjeto(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
