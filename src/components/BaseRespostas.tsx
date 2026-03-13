import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface Resposta {
  id: number
  sistema: string
  categoria: string | null
  titulo: string
  texto: string
}

const SISTEMAS = ['Todos', 'JPE', 'Eproc', 'Themis', 'DJEN', 'Conveniados', 'Radar', 'Assistente TJMG', 'Plataforma JUS.BR', 'Geral']

const SISTEMA_COLORS: Record<string, string> = {
  JPE:                'bg-blue-100 text-blue-700',
  Eproc:              'bg-orange-100 text-orange-700',
  Themis:             'bg-teal-100 text-teal-700',
  DJEN:               'bg-purple-100 text-purple-700',
  Conveniados:        'bg-green-100 text-green-700',
  Radar:              'bg-pink-100 text-pink-700',
  'Assistente TJMG':  'bg-indigo-100 text-indigo-700',
  'Plataforma JUS.BR':'bg-cyan-100 text-cyan-700',
  Geral:              'bg-gray-100 text-gray-600',
}

export function BaseRespostas() {
  const [aberto, setAberto]               = useState(false)
  const [respostas, setRespostas]         = useState<Resposta[]>([])
  const [loading, setLoading]             = useState(false)
  const [busca, setBusca]                 = useState('')
  const [sistemaFiltro, setSistemaFiltro] = useState('Todos')
  const [expandido, setExpandido]         = useState<number | null>(null)
  const [copiado, setCopiado]             = useState<number | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      buscar()
      setTimeout(() => buscaRef.current?.focus(), 100)
    }
  }, [aberto])

  async function buscar() {
    setLoading(true)
    const { data } = await supabase
      .from('base_respostas')
      .select('id, sistema, categoria, titulo, texto')
      .eq('ativo', true)
      .order('sistema')
      .order('titulo')
    setRespostas(data || [])
    setLoading(false)
  }

  function copiar(r: Resposta) {
    navigator.clipboard.writeText(r.texto).then(() => {
      setCopiado(r.id)
      setTimeout(() => setCopiado(null), 2000)
    })
  }

  // Filtragem local (rápida, sem ir ao banco a cada tecla)
  const filtradas = respostas.filter(r => {
    const matchSistema = sistemaFiltro === 'Todos' || r.sistema === sistemaFiltro
    if (!matchSistema) return false
    if (!busca.trim()) return true
    const q = busca.toLowerCase()
    return (
      r.titulo.toLowerCase().includes(q) ||
      r.texto.toLowerCase().includes(q) ||
      (r.categoria || '').toLowerCase().includes(q)
    )
  })

  // Agrupa por sistema para exibição
  const agrupado: Record<string, Resposta[]> = {}
  filtradas.forEach(r => {
    if (!agrupado[r.sistema]) agrupado[r.sistema] = []
    agrupado[r.sistema].push(r)
  })

  return (
    <>
      {/* Botão de acesso */}
      <button
        onClick={() => setAberto(true)}
        className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📚</span>
        <span className="tracking-wide">Respostas Padrão</span>
        <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
      </button>

      {/* Modal principal */}
      {aberto && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-800">📚 Respostas Padrão</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loading ? 'Carregando...' : `${filtradas.length} de ${respostas.length} respostas`}
                </p>
              </div>
              <button
                onClick={() => setAberto(false)}
                className="text-gray-400 hover:text-red-500 text-2xl font-bold transition-colors"
              >✖</button>
            </div>

            {/* Busca + filtros */}
            <div className="px-6 py-3 border-b border-gray-100 space-y-2">
              <input
                ref={buscaRef}
                type="text"
                value={busca}
                onChange={e => { setBusca(e.target.value); setExpandido(null) }}
                placeholder="🔍 Buscar por título ou conteúdo..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
              />
              <div className="flex flex-wrap gap-1.5">
                {SISTEMAS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSistemaFiltro(s); setExpandido(null) }}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      sistemaFiltro === s
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtradas.length === 0 ? (
                <p className="text-center text-gray-400 py-12 font-bold">
                  {busca ? `Nenhum resultado para "${busca}"` : 'Nenhuma resposta encontrada.'}
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(agrupado).map(([sistema, items]) => (
                    <div key={sistema}>
                      {/* Cabeçalho do grupo */}
                      {sistemaFiltro === 'Todos' && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${SISTEMA_COLORS[sistema] || 'bg-gray-100 text-gray-600'}`}>
                            {sistema}
                          </span>
                          <span className="text-xs text-gray-400">{items.length} resposta{items.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}

                      <div className="space-y-2">
                        {items.map(r => (
                          <div
                            key={r.id}
                            className={`border rounded-xl overflow-hidden transition-all ${
                              expandido === r.id
                                ? 'border-teal-300 shadow-sm'
                                : 'border-gray-200 hover:border-teal-200'
                            }`}
                          >
                            {/* Linha do título */}
                            <div
                              className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => setExpandido(expandido === r.id ? null : r.id)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {sistemaFiltro !== 'Todos' && (
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${SISTEMA_COLORS[r.sistema] || 'bg-gray-100 text-gray-600'}`}>
                                    {r.sistema}
                                  </span>
                                )}
                                {r.categoria && (
                                  <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
                                    {r.categoria} /
                                  </span>
                                )}
                                <span className="text-sm font-semibold text-gray-800 truncate">
                                  {r.titulo}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={e => { e.stopPropagation(); copiar(r) }}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                                    copiado === r.id
                                      ? 'bg-green-500 text-white'
                                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
                                  }`}
                                  title="Copiar texto completo"
                                >
                                  {copiado === r.id ? '✅ Copiado!' : '📋 Copiar'}
                                </button>
                                <span className="text-gray-300 text-sm">
                                  {expandido === r.id ? '▲' : '▼'}
                                </span>
                              </div>
                            </div>

                            {/* Conteúdo expandido */}
                            {expandido === r.id && (
                              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                                  {r.texto}
                                </pre>
                                <button
                                  onClick={() => copiar(r)}
                                  className={`mt-3 w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                                    copiado === r.id
                                      ? 'bg-green-500 text-white'
                                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                                  }`}
                                >
                                  {copiado === r.id ? '✅ Copiado!' : '📋 Copiar resposta completa'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
