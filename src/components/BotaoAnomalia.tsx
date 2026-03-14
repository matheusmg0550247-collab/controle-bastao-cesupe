import { useState, useEffect } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { supabase } from '../lib/supabase'
import { USUARIOS_SISTEMA } from '../constants'

interface Anomalia {
  id: number
  consultor: string
  sistema: string
  descricao: string
  gravidade: 'Baixa' | 'Média' | 'Alta' | 'Crítica'
  status: 'Aberta' | 'Em Análise' | 'Resolvida'
  resolucao: string
  criado_em: string
  data: string
}

const GRAVIDADE_CORES: Record<string, string> = {
  'Baixa':    'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Média':    'bg-orange-100 text-orange-800 border-orange-300',
  'Alta':     'bg-red-100 text-red-800 border-red-300',
  'Crítica':  'bg-purple-100 text-purple-900 border-purple-400',
}

const SISTEMAS = ['Eproc', 'JPE', 'PJe', 'SEI', 'Themis', 'Conveniados', 'Outro']
const GRAVIDADES = ['Baixa', 'Média', 'Alta', 'Crítica']

const GRAVIDADE_ICONE: Record<string, string> = {
  'Baixa': '🟡', 'Média': '🟠', 'Alta': '🔴', 'Crítica': '🚨',
}

export function BannerAnomalia() {
  const [abertas, setAbertas] = useState<Anomalia[]>([])

  useEffect(() => {
    buscarAbertas()
    const ch = supabase.channel('anomalias-banner')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anomalias' }, buscarAbertas)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function buscarAbertas() {
    const hoje = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('anomalias')
      .select('*')
      .in('status', ['Aberta', 'Em Análise'])
      .eq('data', hoje)
      .order('criado_em', { ascending: false })
    setAbertas(data || [])
  }

  if (abertas.length === 0) return null

  const temCritica = abertas.some(a => a.gravidade === 'Crítica')
  const bgColor = temCritica ? '#581c87' : '#991b1b'
  const borderColor = temCritica ? '#a855f7' : '#ef4444'

  // Monta o texto do ticker: cada anomalia vira um item separado por separador
  const itens = abertas.map(a =>
    `${GRAVIDADE_ICONE[a.gravidade] || '⚠️'}  [${a.gravidade.toUpperCase()}]  ${a.sistema}  —  ${a.descricao}  |  Reportado por: ${a.consultor}  ${a.status === 'Em Análise' ? '🔍 Em Análise' : '🔓 Aberta'}`
  )
  const tickerText = itens.join('          ◆          ')
  // Duplica para loop contínuo
  const fullText = `${tickerText}          ◆          ${tickerText}`

  return (
    <div
      style={{ backgroundColor: bgColor, borderBottom: `2px solid ${borderColor}` }}
      className="w-full overflow-hidden flex items-center shadow-lg"
    >
      {/* Label fixo à esquerda */}
      <div
        style={{ backgroundColor: borderColor, minWidth: 'fit-content' }}
        className="flex items-center gap-2 px-4 py-2 font-black text-white text-xs tracking-widest uppercase whitespace-nowrap z-10 shadow-md"
      >
        <span className="text-base">⚠️</span>
        <span>ANOMALIA</span>
        <span className="bg-white text-red-700 font-black text-xs rounded px-1.5 py-0.5 ml-1">
          {abertas.length}
        </span>
      </div>

      {/* Ticker scrolling */}
      <div className="flex-1 overflow-hidden py-2 relative">
        <style>{`
          @keyframes ticker {
            0%   { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .ticker-track {
            display: inline-flex;
            white-space: nowrap;
            animation: ticker ${Math.max(60, abertas.length * 40)}s linear infinite;
          }
          .ticker-track:hover { animation-play-state: paused; }
        `}</style>
        <div className="ticker-track text-white text-sm font-semibold tracking-wide">
          <span>{fullText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
        </div>
      </div>
    </div>
  )
}

export function BotaoAnomalia() {
  const { meuLogin } = useBastaoStore()
  const [modalAberto, setModalAberto] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [anomalias, setAnomalias] = useState<Anomalia[]>([])
  const [loading, setLoading] = useState(false)

  // Form
  const [sistema, setSistema] = useState('JPE')
  const [descricao, setDescricao] = useState('')
  const [gravidade, setGravidade] = useState<string>('Média')

  // Resolver
  const [modalResolver, setModalResolver] = useState<Anomalia | null>(null)
  const [resolucaoTexto, setResolucaoTexto] = useState('')

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isGestor = usuarioLogado?.perfil === 'Gestor'

  useEffect(() => {
    buscarAnomalias()
    const ch = supabase.channel('anomalias-painel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anomalias' }, buscarAnomalias)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function buscarAnomalias() {
    const { data } = await supabase
      .from('anomalias')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50)
    setAnomalias(data || [])
  }

  const abertas = anomalias.filter(a => a.status !== 'Resolvida')
  const temAberta = abertas.length > 0

  async function handleRegistrar() {
    if (!descricao.trim()) return alert('Preencha a descrição!')
    setLoading(true)
    try {
      await supabase.from('anomalias').insert({
        consultor: meuLogin,
        sistema,
        descricao: descricao.trim(),
        gravidade,
        status: 'Aberta',
        resolucao: '',
        resolvido_por: '',
        criado_em: new Date().toISOString(),
        data: new Date().toISOString().split('T')[0]
      })
      alert('✅ Anomalia registrada!')
      setModalAberto(false)
      setSistema('JPE'); setDescricao(''); setGravidade('Média')
      await buscarAnomalias()
    } catch (e) {
      alert('❌ Erro ao registrar anomalia.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResolver(anomalia: Anomalia) {
    if (!resolucaoTexto.trim()) return alert('Preencha a resolução!')
    setLoading(true)
    try {
      await supabase.from('anomalias').update({
        status: 'Resolvida',
        resolucao: resolucaoTexto.trim(),
        resolvido_por: meuLogin,
        resolvido_em: new Date().toISOString()
      }).eq('id', anomalia.id)
      alert('✅ Anomalia marcada como resolvida.')
      setModalResolver(null); setResolucaoTexto('')
      await buscarAnomalias()
    } catch {
      alert('❌ Erro ao resolver anomalia.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalisar(anomalia: Anomalia) {
    await supabase.from('anomalias').update({ status: 'Em Análise' }).eq('id', anomalia.id)
    await buscarAnomalias()
  }

  const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 bg-gray-50 text-gray-800 transition-shadow"

  return (
    <>
      {/* BOTÃO PRINCIPAL */}
      <button
        onClick={() => setListaAberta(true)}
        className={`relative w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-base shadow-lg transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0
          ${temAberta
            ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white animate-pulse'
            : 'bg-gradient-to-r from-slate-600 to-gray-700 hover:from-slate-700 hover:to-gray-800 text-white'
          }`}
      >
        <span className="text-2xl">⚠️</span>
        <span>Anomalias do Sistema</span>
        {temAberta && (
          <span className="absolute -top-2 -right-2 bg-white text-red-600 font-black text-xs rounded-full w-6 h-6 flex items-center justify-center shadow border-2 border-red-500">
            {abertas.length}
          </span>
        )}
      </button>

      {/* MODAL LISTA */}
      {listaAberta && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-gray-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">⚠️ Anomalias do Sistema</h3>
              <button
                onClick={() => { setListaAberta(false); setModalAberto(true) }}
                className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all"
              >
                + Reportar Nova
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col gap-3 pr-1">
              {anomalias.length === 0 && (
                <p className="text-center text-gray-400 py-10">Nenhuma anomalia registrada.</p>
              )}
              {anomalias.map(a => (
                <div key={a.id} className={`rounded-xl border p-4 ${a.status === 'Resolvida' ? 'opacity-50 bg-gray-50' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${GRAVIDADE_CORES[a.gravidade] || ''}`}>{a.gravidade}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-full border border-blue-200">{a.sistema}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                        a.status === 'Resolvida' ? 'bg-green-100 text-green-700 border-green-200' :
                        a.status === 'Em Análise' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        'bg-red-100 text-red-700 border-red-200'
                      }`}>{a.status}</span>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-1"><span className="font-bold">Reportado por:</span> {a.consultor}</p>
                  <p className="text-sm text-gray-700 mb-2">{a.descricao}</p>
                  {a.resolucao && <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2">✅ <strong>Resolução:</strong> {a.resolucao}</p>}
                  {a.status !== 'Resolvida' && isGestor && (
                    <div className="flex gap-2 mt-3">
                      {a.status === 'Aberta' && (
                        <button onClick={() => handleAnalisar(a)} className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold px-3 py-1.5 rounded-lg border border-yellow-300 transition-all">
                          🔍 Marcar Em Análise
                        </button>
                      )}
                      <button onClick={() => { setModalResolver(a); setResolucaoTexto('') }} className="text-xs bg-green-100 hover:bg-green-200 text-green-800 font-bold px-3 py-1.5 rounded-lg border border-green-300 transition-all">
                        ✅ Resolver
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => setListaAberta(false)} className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition-all">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* MODAL REPORTAR */}
      {modalAberto && (
        <div className="fixed inset-0 z-[60] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-extrabold text-red-600 mb-4 flex items-center gap-2">⚠️ Reportar Anomalia</h3>
            <label className="block text-xs font-bold text-gray-500 mb-1">Sistema:</label>
            <select value={sistema} onChange={e => setSistema(e.target.value)} className={`${inputClass} mb-3`}>
              {SISTEMAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="block text-xs font-bold text-gray-500 mb-1">Gravidade:</label>
            <select value={gravidade} onChange={e => setGravidade(e.target.value)} className={`${inputClass} mb-3`}>
              {GRAVIDADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <label className="block text-xs font-bold text-gray-500 mb-1">Descrição da Anomalia:</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4} className={`${inputClass} resize-none mb-4`} placeholder="Descreva o que está acontecendo..." />
            <div className="flex gap-2">
              <button disabled={loading || !descricao.trim()} onClick={handleRegistrar} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50 transition-all">
                {loading ? 'Salvando...' : '📤 Reportar'}
              </button>
              <button onClick={() => { setModalAberto(false); setListaAberta(true) }} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Voltar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESOLVER */}
      {modalResolver && (
        <div className="fixed inset-0 z-[60] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-extrabold text-green-600 mb-4">✅ Resolver Anomalia</h3>
            <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl">{modalResolver.descricao}</p>
            <label className="block text-xs font-bold text-gray-500 mb-1">Como foi resolvido?</label>
            <textarea value={resolucaoTexto} onChange={e => setResolucaoTexto(e.target.value)} rows={3} className={`${inputClass} resize-none mb-4`} placeholder="Descreva a solução ou ação tomada..." />
            <div className="flex gap-2">
              <button disabled={loading || !resolucaoTexto.trim()} onClick={() => handleResolver(modalResolver)} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50 transition-all">
                {loading ? 'Salvando...' : '✅ Confirmar Resolução'}
              </button>
              <button onClick={() => setModalResolver(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
