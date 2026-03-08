import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

interface Rotacao {
  id: number
  equipe: string
  de_consultor: string
  para_consultor: string
  data_hora: string
  registro_status: string
}

interface Props {
  /** true = visão gestor: mostra pendências de todos.
   *  false = visão consultor: só as do usuário logado (de_consultor). */
  modoGestor?: boolean
}

export function BadgePendencias({ modoGestor = false }: Props) {
  const { meuLogin } = useBastaoStore()
  const [pendentes, setPendentes] = useState<Rotacao[]>([])
  const [aberto, setAberto] = useState(false)

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isGestor = usuarioLogado?.perfil === 'Gestor'
  const deveVerTodos = modoGestor && isGestor

  useEffect(() => {
    buscar()
    const ch = supabase
      .channel('badge-pendencias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bastao_rotacoes' }, buscar)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [meuLogin])

  async function buscar() {
    if (!meuLogin) return
    let query = supabase
      .from('bastao_rotacoes')
      .select('id, equipe, de_consultor, para_consultor, data_hora, registro_status')
      .eq('registro_status', 'depois')
      .order('data_hora', { ascending: false })

    // Consultor vê apenas os DELE (de_consultor = meuLogin)
    // Mesmo que outra pessoa tenha girado o bastão por ele (auditoria),
    // a pendência fica no de_consultor = dono do bastão
    if (!deveVerTodos) {
      query = query.eq('de_consultor', meuLogin)
    }

    const { data } = await query
    setPendentes(data || [])
  }

  if (pendentes.length === 0) return null

  const fmtData = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })

  // Agrupa por consultor para o gestor
  const porConsultor: Record<string, Rotacao[]> = {}
  pendentes.forEach(r => {
    if (!porConsultor[r.de_consultor]) porConsultor[r.de_consultor] = []
    porConsultor[r.de_consultor].push(r)
  })

  return (
    <>
      {/* Badge compacto */}
      <button
        onClick={() => setAberto(true)}
        className="relative flex items-center gap-2 bg-yellow-50 border-2 border-yellow-400 text-yellow-800 font-bold px-4 py-3 rounded-2xl shadow-sm hover:bg-yellow-100 transition-all text-sm w-full justify-center"
      >
        <span className="text-lg">⏳</span>
        <span>
          {deveVerTodos
            ? `${pendentes.length} atendimento(s) pendente(s) na equipe`
            : `Você tem ${pendentes.length} atendimento(s) para registrar`}
        </span>
        <span className="bg-yellow-500 text-white text-xs font-black rounded-full w-6 h-6 flex items-center justify-center ml-1 flex-shrink-0">
          {pendentes.length}
        </span>
      </button>

      {/* Modal lista */}
      {aberto && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-gray-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
                ⏳ Bastões pendentes de registro
              </h3>
              <span className="bg-yellow-100 text-yellow-800 font-black text-sm px-3 py-1 rounded-full border border-yellow-300">
                {pendentes.length}
              </span>
            </div>

            {!deveVerTodos && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-xs text-blue-700">
                Para registrar, acesse <strong>🛠️ Ferramentas → 📝 Atendimentos</strong>.
                Os bastões pendentes aparecerão no topo do modal.
              </div>
            )}

            <div className="overflow-y-auto flex-1 flex flex-col gap-3">
              {deveVerTodos
                ? // Visão gestor: agrupado por consultor
                  Object.entries(porConsultor).map(([consultor, rots]) => (
                    <div key={consultor}>
                      <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mb-1 px-1">
                        {consultor} — {rots.length} pendente(s)
                      </p>
                      {rots.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-1">
                          <div>
                            <span className="text-xs bg-yellow-200 text-yellow-800 font-bold px-2 py-0.5 rounded-full mr-1">{r.equipe === 'JPE' ? 'Legados' : r.equipe}</span>
                            <span className="text-sm text-gray-700">→ <strong>{r.para_consultor}</strong></span>
                            <p className="text-xs text-gray-400 mt-0.5">{fmtData(r.data_hora)}</p>
                          </div>
                          <span className="text-yellow-400 text-xl">⏳</span>
                        </div>
                      ))}
                    </div>
                  ))
                : // Visão consultor: lista simples
                  pendentes.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                      <div>
                        <span className="text-xs bg-yellow-200 text-yellow-800 font-bold px-2 py-0.5 rounded-full mr-1">{r.equipe === 'JPE' ? 'Legados' : r.equipe}</span>
                        <span className="text-sm text-gray-700">Passou para <strong>{r.para_consultor}</strong></span>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtData(r.data_hora)}</p>
                      </div>
                      <span className="text-yellow-400 text-xl">⏳</span>
                    </div>
                  ))
              }
            </div>

            <button
              onClick={() => setAberto(false)}
              className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-sm transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
