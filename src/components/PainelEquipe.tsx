import { useState, useEffect } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal } from '../constants'

export function PainelEquipe() {
  const { meuLogin, statusTexto, statusDetalhe, filaEproc, filaJpe, updateStatus } = useBastaoStore()
  const [statusAberto, setStatusAberto] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [modalAlvo, setModalAlvo] = useState('')

  const handleCliqueNome = (nome: string) => {
    const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
    const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'

    if (!isSecretaria && meuLogin !== nome) {
       const confirmar = window.confirm(
          `⚠️ AUDITORIA\n\nVocê está alterando o status de ${nome}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
       )
       if (!confirmar) return
    }

    const status = statusTexto[nome] || ''

    // Se tem status ativo (não vazio, não Indisponível) → mostra modal
    if (status && status !== 'Indisponível') {
      setModalAlvo(nome)
      setModalAberto(true)
      return
    }

    // Se está Indisponível → volta direto pra fila
    updateStatus(nome, '', true, '')
  }

  const handleEscolhaModal = (escolha: 'bastao' | 'indisponivel') => {
    if (escolha === 'bastao') {
      updateStatus(modalAlvo, '', true, '')
    } else {
      updateStatus(modalAlvo, 'Indisponível', false, '')
    }
    setModalAberto(false)
    setModalAlvo('')
  }

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Atividades': return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
      case 'Projeto': return 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200'
      case 'Treinamento': return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
      case 'Reunião': return 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200'
      case 'Almoço': return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
      case 'Sessão': return 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
      case 'Atend. Presencial': return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
    }
  }

  const agrupado = USUARIOS_SISTEMA.reduce((acc, user) => {
    if (user.perfil === 'Secretaria' || user.perfil === 'Gestor') return acc
    const nome = user.nome
    const naFila = filaEproc.includes(nome) || filaJpe.includes(nome)
    if (naFila) return acc
    let statusAtual = statusTexto[nome] && statusTexto[nome] !== '' ? statusTexto[nome] : 'Indisponível'
    if (statusAtual === 'Com o Bastão') statusAtual = 'Indisponível'
    if (!acc[statusAtual]) acc[statusAtual] = []
    acc[statusAtual].push(nome)
    return acc
  }, {} as Record<string, string[]>)

  useEffect(() => {
    if (statusAberto && !agrupado[statusAberto]) setStatusAberto(null)
  }, [agrupado, statusAberto])

  const statusOrder = ['Atividades', 'Projeto', 'Treinamento', 'Reunião', 'Almoço', 'Sessão', 'Atend. Presencial', 'Indisponível']
  const statusKeys = Object.keys(agrupado).sort((a, b) => {
     const indexA = statusOrder.indexOf(a)
     const indexB = statusOrder.indexOf(b)
     return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB)
  })

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">👥 Onde está a equipe?</h2>
      
      {statusKeys.length === 0 ? (
        <p className="text-sm text-gray-500 font-bold">Todos os consultores estão no bastão! 🔥</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {statusKeys.map(status => (
            <button key={status} onClick={() => setStatusAberto(status)} className={`px-4 py-2 rounded-xl border-2 font-black text-sm shadow-sm transition-all active:scale-95 ${getStatusStyle(status)}`}>
              {status} <span className="bg-white/50 px-2 py-0.5 rounded-md ml-1">{agrupado[status].length}</span>
            </button>
          ))}
        </div>
      )}

      {statusAberto && agrupado[statusAberto] && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200">
            <h3 className="text-xl font-black text-gray-800 mb-4 border-b pb-2 flex justify-between items-center">
              Pessoas em: {statusAberto}
              <button onClick={() => setStatusAberto(null)} className="text-gray-400 hover:text-red-500 text-2xl">✖</button>
            </h3>
            
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {agrupado[statusAberto]?.map(nome => (
                <div 
                  key={nome} 
                  onClick={() => handleCliqueNome(nome)}
                  title="Clique para alterar status"
                  className="bg-gray-50 border border-gray-200 p-3 rounded-xl cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors group relative"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-800 text-lg group-hover:text-orange-700">{nome}</span>
                    <span className="text-xs font-black bg-gray-200 text-gray-600 px-2 py-1 rounded-md transition-transform duration-300 group-hover:scale-125 origin-right group-hover:bg-orange-100 group-hover:text-orange-700">
                      ☎ {getRamal(nome)}
                    </span>
                  </div>
                  {statusDetalhe[nome] ? (
                    <p className="text-sm text-indigo-700 font-bold bg-indigo-50 p-2 rounded-lg inline-block">↳ {statusDetalhe[nome]}</p>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium italic">Sem detalhes adicionais</p>
                  )}
                  
                  <div className="absolute inset-0 bg-orange-500/90 text-white font-black text-sm flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    🔄 Clique para alterar status
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStatusAberto(null)} className="w-full mt-6 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300">
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal: Voltar ao Bastão ou Ficar Indisponível */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-800 mb-2 text-center">O que deseja fazer?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-indigo-600">{modalAlvo}</span> está em <span className="font-bold">{statusTexto[modalAlvo]}</span>.
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleEscolhaModal('bastao')} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-sm active:scale-95 transition-all text-base flex items-center justify-center gap-2">
                🔄 Voltar ao Bastão
              </button>
              <button onClick={() => handleEscolhaModal('indisponivel')} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-sm active:scale-95 transition-all text-base flex items-center justify-center gap-2">
                🚫 Ficar Indisponível
              </button>
              <button onClick={() => { setModalAberto(false); setModalAlvo(''); }} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-all text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
