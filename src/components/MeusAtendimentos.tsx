import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'

interface Atendimento {
  id: number
  data: string
  usuario: string
  nome_setor: string
  sistema: string
  descricao: string
  canal: string
  desfecho: string
  solucao: string | null
}

type Periodo = 'hoje' | 'semana' | 'mes' | 'ano' | string // string para anos ex: '2025', '2024'

const hoje = () => new Date().toISOString().split('T')[0]

const ANO_ATUAL = new Date().getFullYear()
// Anos anteriores disponíveis (últimos 3 anos além do atual)
const ANOS_ANTERIORES = [ANO_ATUAL - 1, ANO_ATUAL - 2, ANO_ATUAL - 3]

function getIntervalo(periodo: Periodo): { ini: string; fim: string } | null {
  const now = new Date()
  const fim = hoje()
  if (periodo === 'todos') return null // sem filtro de data
  if (periodo === 'hoje')  return { ini: fim, fim }
  if (periodo === 'semana') {
    const dow = now.getDay()
    const seg = new Date(now)
    seg.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
    return { ini: seg.toISOString().split('T')[0], fim }
  }
  if (periodo === 'mes') {
    return { ini: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, fim }
  }
  if (periodo === 'ano') {
    return { ini: `${now.getFullYear()}-01-01`, fim }
  }
  // ano específico ex: '2024'
  const ano = parseInt(periodo)
  if (!isNaN(ano)) return { ini: `${ano}-01-01`, fim: `${ano}-12-31` }
  return { ini: fim, fim }
}

const fmtData = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const usuarioOptions = ['Cartório', 'Gabinete', 'Público Externo', 'Interno', 'Outros']
const sistemaOptions = ['Eproc', 'JPE', 'PJe', 'SEI', 'Themis', 'Conveniados', 'Outros']
const canalOptions   = ['Whatsapp', 'Telefone', 'Presencial', 'E-mail', 'Outros']
const desfechoOptions = ['Resolvido - Cesupe', 'Encaminhado N2', 'Encaminhado N3', 'Aguardando Usuário', 'Outros']

export function MeusAtendimentos() {
  const { meuLogin } = useBastaoStore()
  const [aberto, setAberto]           = useState(false)
  const [periodo, setPeriodo]         = useState<Periodo>('hoje')
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [loading, setLoading]         = useState(false)
  const [editando, setEditando]       = useState<Atendimento | null>(null)
  const [salvando, setSalvando]       = useState(false)

  // Campos do form de edição
  const [eUsuario,   setEUsuario]   = useState('')
  const [eSetor,     setESetor]     = useState('')
  const [eSistema,   setESistema]   = useState('')
  const [eDescricao, setEDescricao] = useState('')
  const [eCanal,     setECanal]     = useState('')
  const [eDesfecho,  setEDesfecho]  = useState('')
  const [eSolucao,   setESolucao]   = useState('')

  const inputClass = 'w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 bg-gray-50 text-gray-800 text-sm'
  const labelClass = 'block text-xs font-bold text-gray-500 mb-1 mt-2'

  async function buscar() {
    if (!meuLogin) return
    setLoading(true)
    const intervalo = getIntervalo(periodo)
    let query = supabase
      .from('atendimentos_cesupe')
      .select('id,data,usuario,nome_setor,sistema,descricao,canal,desfecho,solucao')
      .eq('consultor', meuLogin)
      .order('data', { ascending: false })
      .order('id',   { ascending: false })
    if (intervalo) {
      query = query.gte('data', intervalo.ini).lte('data', intervalo.fim)
    }
    const { data } = await query
    setAtendimentos(data || [])
    setLoading(false)
  }

  useEffect(() => { if (aberto) buscar() }, [aberto, periodo])

  function abrirEdicao(a: Atendimento) {
    setEditando(a)
    setEUsuario(a.usuario || '')
    setESetor(a.nome_setor || '')
    setESistema(a.sistema || '')
    setEDescricao(a.descricao || '')
    setECanal(a.canal || '')
    setEDesfecho(a.desfecho || '')
    setESolucao(a.solucao || '')
  }

  async function salvarEdicao() {
    if (!editando || !eDescricao.trim()) return alert('Preencha a descrição!')
    setSalvando(true)
    const { error } = await supabase
      .from('atendimentos_cesupe')
      .update({
        usuario:     eUsuario,
        nome_setor:  eSetor,
        sistema:     eSistema,
        descricao:   eDescricao,
        canal:       eCanal,
        desfecho:    eDesfecho,
        solucao:     eSolucao || null,
      })
      .eq('id', editando.id)
    setSalvando(false)
    if (error) { alert('❌ Erro ao salvar.'); return }
    setEditando(null)
    buscar()
  }

  const PERIODOS: { key: string; label: string }[] = [
    { key: 'hoje',    label: 'Hoje' },
    { key: 'semana',  label: 'Semana' },
    { key: 'mes',     label: 'Mês' },
    { key: 'ano',     label: `${ANO_ATUAL}` },
    ...ANOS_ANTERIORES.map(a => ({ key: String(a), label: String(a) })),
    { key: 'todos',   label: 'Todos' },
  ]

  const SISTEMA_COLORS: Record<string, string> = {
    Eproc: 'bg-orange-100 text-orange-700',
    JPE:   'bg-blue-100 text-blue-700',
    PJe:   'bg-purple-100 text-purple-700',
    Themis:'bg-teal-100 text-teal-700',
    SEI:   'bg-green-100 text-green-700',
  }

  return (
    <>
      {/* Botão de acesso */}
      <button
        onClick={() => setAberto(true)}
        className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 hover:from-violet-600 hover:via-purple-600 hover:to-indigo-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📋</span>
        <span className="tracking-wide">Meus Atendimentos</span>
        <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
      </button>

      {/* Modal */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => { setAberto(false); setEditando(null) }}
        >
          <div
            className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-800">📋 Meus Atendimentos</h2>
                <p className="text-xs text-gray-400 mt-0.5">{meuLogin} · {atendimentos.length} registro{atendimentos.length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setAberto(false); setEditando(null) }} className="text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors">✖</button>
            </div>

            {/* Filtros de período */}
            <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-gray-100">
              {PERIODOS.map(p => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    periodo === p.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={buscar}
                className="ml-auto px-3 py-1.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                title="Atualizar"
              >
                🔄
              </button>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : atendimentos.length === 0 ? (
                <p className="text-center text-gray-400 py-10 font-bold">Nenhum atendimento encontrado no período.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {atendimentos.map(a => (
                    <div key={a.id} className="border border-gray-200 rounded-xl p-4 hover:border-violet-200 hover:bg-violet-50/30 transition-all group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-gray-400">{fmtData(a.data)}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SISTEMA_COLORS[a.sistema] || 'bg-gray-100 text-gray-600'}`}>
                            {a.sistema}
                          </span>
                          <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.usuario}</span>
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{a.desfecho}</span>
                        </div>
                        <button
                          onClick={() => abrirEdicao(a)}
                          className="text-xs font-bold text-violet-600 hover:text-violet-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                        >
                          ✏️ Editar
                        </button>
                      </div>
                      <p className="text-sm text-gray-700 font-medium leading-snug">{a.descricao}</p>
                      {a.nome_setor && <p className="text-xs text-gray-400 mt-1">📍 {a.nome_setor}</p>}
                      {a.solucao && (
                        <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1 mt-2 font-medium">
                          💡 {a.solucao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editando && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEditando(null)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-y-auto"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-black text-violet-700">✏️ Editar Atendimento</h3>
              <button onClick={() => setEditando(null)} className="text-gray-400 hover:text-red-500 text-xl font-bold">✖</button>
            </div>

            <div className="px-6 py-4">
              <label className={labelClass}>Usuário:</label>
              <select value={eUsuario} onChange={e => setEUsuario(e.target.value)} className={inputClass}>
                {usuarioOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <label className={labelClass}>Setor:</label>
              <input type="text" value={eSetor} onChange={e => setESetor(e.target.value)} className={inputClass} placeholder="Ex: 3ª Vara Cível..." />

              <label className={labelClass}>Sistema:</label>
              <select value={eSistema} onChange={e => setESistema(e.target.value)} className={inputClass}>
                {sistemaOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <label className={labelClass}>Descrição: *</label>
              <textarea value={eDescricao} onChange={e => setEDescricao(e.target.value)} className={`${inputClass} h-20 resize-none`} />

              <label className={labelClass}>Canal:</label>
              <select value={eCanal} onChange={e => setECanal(e.target.value)} className={inputClass}>
                {canalOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <label className={labelClass}>Desfecho:</label>
              <select value={eDesfecho} onChange={e => setEDesfecho(e.target.value)} className={inputClass}>
                {desfechoOptions.map(o => <option key={o}>{o}</option>)}
              </select>

              <label className={labelClass}>Solução aplicada: <span className="text-gray-400 font-normal">(opcional)</span></label>
              <textarea value={eSolucao} onChange={e => setESolucao(e.target.value)} className={`${inputClass} h-16 resize-none`} placeholder="Descreva a solução..." />
            </div>

            <div className="flex gap-2 px-6 pb-5">
              <button
                disabled={salvando || !eDescricao.trim()}
                onClick={salvarEdicao}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
              >
                {salvando ? 'Salvando...' : '💾 Salvar alterações'}
              </button>
              <button onClick={() => setEditando(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
