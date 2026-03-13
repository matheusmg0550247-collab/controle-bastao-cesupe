import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'

interface Chamado {
  id: number
  numero: string
  tipo: 'Chamado' | 'JIRA'
  descricao: string
  proprietario: string
  todos_editam: boolean
  status: string
  data_abertura: string | null
  atualizacoes: string | null
  link_jira: string | null
  problema: string | null
  relator: string | null
  observacoes_ini: string | null
  updated_at: string
}

interface LogEntry {
  id: number
  chamado_id: number
  consultor: string
  texto: string
  created_at: string
}

const STATUS_OPTIONS = [
  'Aberto sem andamento',
  'Em andamento',
  'Urgente',
  'Revisar solução/orientar usuário',
  'Fechado',
]

const STATUS_COLORS: Record<string, string> = {
  'Aberto sem andamento':          'bg-gray-100 text-gray-700',
  'Em andamento':                  'bg-blue-100 text-blue-700',
  'Urgente':                       'bg-red-100 text-red-700',
  'Revisar solução/orientar usuário': 'bg-yellow-100 text-yellow-700',
  'Fechado':                       'bg-green-100 text-green-700',
}

const EPROC_CONSULTORES = [
  'Barbara Mara','Bruno Glaicon','Claudia Luiza','Douglas Paiva','Fábio Alves',
  'Glayce Torres','Isabela Dias','Isac Candido','Ivana Guimarães','Jonatas',
  'Leonardo Damaceno','Marcelo Pena Guerra','Michael Douglas','Morôni',
  'Pablo Mol','Ranyer Segal','Sarah Leal','Victoria Lisboa',
]

function fmtData(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export function ChamadosEproc() {
  const { meuLogin } = useBastaoStore()
  const isEproc = EPROC_CONSULTORES.includes(meuLogin)

  const [aberto, setAberto]                 = useState(false)
  const [chamados, setChamados]             = useState<Chamado[]>([])
  const [loading, setLoading]               = useState(false)
  const [busca, setBusca]                   = useState('')
  const [filtroStatus, setFiltroStatus]     = useState('Todos')
  const [filtroTipo, setFiltroTipo]         = useState('Todos')
  const [detalhe, setDetalhe]               = useState<Chamado | null>(null)
  const [log, setLog]                       = useState<LogEntry[]>([])
  const [novaObs, setNovaObs]               = useState('')
  const [salvando, setSalvando]             = useState(false)
  const [editando, setEditando]             = useState(false)
  // Campos de edição
  const [editStatus, setEditStatus]         = useState('')
  const [editAtualizacoes, setEditAtualizacoes] = useState('')
  const [editDescricao, setEditDescricao]   = useState('')
  const buscaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!aberto) return
    buscar()
    setTimeout(() => buscaRef.current?.focus(), 100)
    const ch = supabase.channel('chamados-eproc-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados_eproc' }, buscar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [aberto])

  useEffect(() => {
    if (!detalhe) return
    buscarLog(detalhe.id)
    const ch = supabase.channel(`chamados-log-${detalhe.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chamados_eproc_log',
        filter: `chamado_id=eq.${detalhe.id}`
      }, () => buscarLog(detalhe.id))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [detalhe?.id])

  async function buscar() {
    setLoading(true)
    const { data } = await supabase
      .from('chamados_eproc')
      .select('*')
      .order('data_abertura', { ascending: false })
    setChamados(data || [])
    setLoading(false)
  }

  async function buscarLog(id: number) {
    const { data } = await supabase
      .from('chamados_eproc_log')
      .select('*')
      .eq('chamado_id', id)
      .order('created_at', { ascending: true })
    setLog(data || [])
  }

  function podeEditar(c: Chamado) {
    if (c.todos_editam) return true
    return c.proprietario === meuLogin
  }

  function abrirDetalhe(c: Chamado) {
    setDetalhe(c)
    setEditando(false)
    setNovaObs('')
    setEditStatus(c.status)
    setEditAtualizacoes(c.atualizacoes || '')
    setEditDescricao(c.descricao || '')
  }

  async function salvarEdicao() {
    if (!detalhe) return
    setSalvando(true)
    const { data: updated } = await supabase
      .from('chamados_eproc')
      .update({
        status: editStatus,
        atualizacoes: editAtualizacoes,
        descricao: editDescricao,
        updated_at: new Date().toISOString(),
      })
      .eq('id', detalhe.id)
      .select()
      .single()
    if (updated) {
      setDetalhe(updated)
      setChamados(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
    setEditando(false)
    setSalvando(false)
  }

  async function salvarObs() {
    if (!detalhe || !novaObs.trim()) return
    setSalvando(true)
    await supabase.from('chamados_eproc_log').insert({
      chamado_id: detalhe.id,
      consultor: meuLogin,
      texto: novaObs.trim(),
    })
    setNovaObs('')
    setSalvando(false)
  }

  // Filtragem local
  const filtrados = chamados.filter(c => {
    if (filtroStatus !== 'Todos' && c.status !== filtroStatus) return false
    if (filtroTipo !== 'Todos' && c.tipo !== filtroTipo) return false
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      c.numero.toLowerCase().includes(q) ||
      (c.descricao || '').toLowerCase().includes(q) ||
      (c.proprietario || '').toLowerCase().includes(q) ||
      (c.problema || '').toLowerCase().includes(q)
    )
  })

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50'
  const labelCls = 'block text-xs font-bold text-gray-500 mb-1 mt-3'

  // Só mostra para equipe Eproc
  if (!isEproc) return null

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform duration-300">🗂️</span>
        <span className="tracking-wide">Chamados Eproc</span>
        <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
      </button>

      {/* Modal lista */}
      {aberto && !detalhe && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAberto(false)}>
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-800">🗂️ Chamados Eproc 2G</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loading ? 'Carregando...' : `${filtrados.length} de ${chamados.length} registros`}
                </p>
              </div>
              <button onClick={() => setAberto(false)}
                className="text-gray-400 hover:text-red-500 text-2xl font-bold">✖</button>
            </div>

            {/* Filtros */}
            <div className="px-6 py-3 border-b border-gray-100 space-y-2">
              <input ref={buscaRef} type="text" value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="🔍 Buscar por número, descrição ou proprietário..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50"
              />
              <div className="flex flex-wrap gap-2">
                <div className="flex gap-1 flex-wrap">
                  {['Todos', 'Chamado', 'JIRA'].map(t => (
                    <button key={t} onClick={() => setFiltroTipo(t)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${filtroTipo === t ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {['Todos', ...STATUS_OPTIONS].map(s => (
                    <button key={s} onClick={() => setFiltroStatus(s)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${filtroStatus === s ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {s === 'Todos' ? 'Todos status' : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Lista de cards */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtrados.length === 0 ? (
                <p className="text-center text-gray-400 py-12 font-bold">Nenhum chamado encontrado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtrados.map(c => (
                    <div key={c.id}
                      onClick={() => abrirDetalhe(c)}
                      className="border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-amber-300 hover:shadow-sm transition-all group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-full ${c.tipo === 'JIRA' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {c.tipo}
                          </span>
                          <span className="text-sm font-black text-gray-800">{c.numero}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-600'}`}>
                            {c.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{fmtData(c.data_abertura)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 font-medium">{c.proprietario || '—'}</p>
                      <p className="text-sm text-gray-700 line-clamp-3 leading-snug">{c.descricao}</p>
                      {c.todos_editam && (
                        <span className="mt-2 inline-block text-xs bg-teal-50 text-teal-600 font-bold px-2 py-0.5 rounded-full">
                          Todos podem editar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetalhe(null)}>
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>

            {/* Header detalhe */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${detalhe.tipo === 'JIRA' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                  {detalhe.tipo}
                </span>
                <h3 className="text-lg font-black text-gray-800">{detalhe.numero}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[detalhe.status] || 'bg-gray-100 text-gray-600'}`}>
                  {detalhe.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {podeEditar(detalhe) && !editando && (
                  <button onClick={() => setEditando(true)}
                    className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl hover:bg-amber-200 transition-all">
                    ✏️ Editar
                  </button>
                )}
                <button onClick={() => setDetalhe(null)}
                  className="text-gray-400 hover:text-red-500 text-xl font-bold">✖</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

              {/* Modo edição */}
              {editando ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-black text-amber-700 uppercase">✏️ Modo de edição</p>
                  <div>
                    <label className={labelCls}>Status:</label>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className={inputCls}>
                      {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Descrição:</label>
                    <textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)}
                      className={`${inputCls} h-24 resize-none`} />
                  </div>
                  <div>
                    <label className={labelCls}>Atualizações no chamado:</label>
                    <textarea value={editAtualizacoes} onChange={e => setEditAtualizacoes(e.target.value)}
                      className={`${inputCls} h-24 resize-none`} />
                  </div>
                  <div className="flex gap-2">
                    <button disabled={salvando} onClick={salvarEdicao}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
                      {salvando ? 'Salvando...' : '💾 Salvar alterações'}
                    </button>
                    <button onClick={() => setEditando(false)}
                      className="flex-1 bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm hover:bg-gray-300">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Meta */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span><strong>Abertura:</strong> {fmtData(detalhe.data_abertura)}</span>
                    <span><strong>Proprietário:</strong> {detalhe.proprietario || '—'}</span>
                    {detalhe.relator && <span><strong>Relator:</strong> {detalhe.relator}</span>}
                    {detalhe.link_jira && (
                      <a href={detalhe.link_jira} target="_blank" rel="noopener noreferrer"
                        className="text-blue-600 underline font-bold">
                        🔗 Link JIRA
                      </a>
                    )}
                  </div>

                  {/* Problema (JIRA) */}
                  {detalhe.problema && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                      <p className="text-xs font-black text-purple-700 mb-1">Problema</p>
                      <p className="text-sm text-gray-700">{detalhe.problema}</p>
                    </div>
                  )}

                  {/* Descrição */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <p className="text-xs font-black text-gray-500 mb-1">Descrição</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{detalhe.descricao}</p>
                  </div>

                  {/* Atualizações originais */}
                  {detalhe.atualizacoes && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-xs font-black text-blue-700 mb-1">Atualizações no chamado</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{detalhe.atualizacoes}</p>
                    </div>
                  )}
                </>
              )}

              {/* Log de observações */}
              <div>
                <p className="text-xs font-black text-gray-500 uppercase mb-2">
                  💬 Observações da equipe ({log.length})
                </p>
                {log.length === 0 ? (
                  <p className="text-xs text-gray-400 italic mb-2">Nenhuma observação ainda.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {log.map(entry => (
                      <div key={entry.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-gray-700">{entry.consultor}</span>
                          <span className="text-xs text-gray-400">{fmtDataHora(entry.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.texto}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nova observação — todos da equipe Eproc podem */}
                <div className="border-t border-gray-100 pt-3">
                  <textarea
                    value={novaObs}
                    onChange={e => setNovaObs(e.target.value)}
                    placeholder="Adicionar observação..."
                    className={`${inputCls} h-20 resize-none`}
                  />
                  <button
                    disabled={salvando || !novaObs.trim()}
                    onClick={salvarObs}
                    className="mt-2 w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
                  >
                    {salvando ? 'Salvando...' : '💬 Adicionar observação'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
