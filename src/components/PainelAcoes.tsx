import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { getEquipe, USUARIOS_SISTEMA } from '../constants'

export function PainelAcoes() {
  const { meuLogin, alvoSelecionado, setAlvoSelecionado, passarBastao, toggleTelefone, toggleCafe, toggleSkip, toggleFila, updateStatus, filaEproc, filaJpe, statusTexto } = useBastaoStore()
  const [modalAberto, setModalAberto] = useState(false)
  const [modalAlvo, setModalAlvo] = useState('')

  const todosNomes = USUARIOS_SISTEMA.map(u => u.nome).sort()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'

  const handleAcaoAuditada = (acaoFn: () => void, nomeAcao: string) => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!')
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está aplicando "${nomeAcao}" no perfil de ${alvoSelecionado}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
      )
      if (!confirmar) return
    }
    acaoFn()
  }

  // Lógica especial para Entrar/Sair com diálogo
  const handleEntrarSair = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!')

    // Auditoria se for outra pessoa
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está alterando "Entrar/Sair do Bastão" no perfil de ${alvoSelecionado}.\nEsta ação será registrada em seu nome (${meuLogin}).\n\nDeseja continuar?`
      )
      if (!confirmar) return
    }

    const equipe = getEquipe(alvoSelecionado)
    if (!equipe) return

    const fila = equipe === 'EPROC' ? filaEproc : filaJpe
    const estaNoTrem = fila.includes(alvoSelecionado)
    const status = statusTexto[alvoSelecionado] || ''

    // Se está na fila → tira normalmente
    if (estaNoTrem) {
      toggleFila(alvoSelecionado)
      return
    }

    // Se NÃO está na fila E tem status ativo (não vazio e não "Indisponível") → perguntar
    if (!estaNoTrem && status && status !== 'Indisponível') {
      setModalAlvo(alvoSelecionado)
      setModalAberto(true)
      return
    }

    // Se NÃO está na fila e está Indisponível ou sem status → entrar na fila
    toggleFila(alvoSelecionado)
  }

  const handleEscolhaModal = (escolha: 'bastao' | 'indisponivel') => {
    if (escolha === 'bastao') {
      // Volta pro bastão: limpa status e entra na fila
      updateStatus(modalAlvo, '', true)
    } else {
      // Fica indisponível: seta status e tira da fila
      updateStatus(modalAlvo, 'Indisponível', false)
    }
    setModalAberto(false)
    setModalAlvo('')
  }

  const handlePassarAuditado = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro para identificar a fila!')
    const equipe = getEquipe(alvoSelecionado) as "EPROC" | "JPE"
    if (!equipe) return
    const filaAtual = equipe === "EPROC" ? filaEproc : filaJpe
    const donoDoBastao = filaAtual.length > 0 ? filaAtual[0] : null
    if (!isSecretaria && meuLogin !== donoDoBastao) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está passando o Bastão da equipe ${equipe}, mas ele está com ${donoDoBastao || 'ninguém'}.\nEsta ação será registrada em seu nome (${meuLogin}).\n\nDeseja continuar?`
      )
      if (!confirmar) return
    }
    passarBastao(equipe)
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">🎯 Ações do Bastão</h2>
      <div className="mb-6 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
        <label className="block text-sm font-bold text-orange-800 mb-2">Alvo da Ação:</label>
        <div className="flex gap-2">
          <select value={alvoSelecionado || ''} onChange={(e) => setAlvoSelecionado(e.target.value)} className="flex-1 border-2 rounded-xl p-3 outline-none font-bold text-gray-700 bg-white border-orange-200 focus:border-orange-500">
            <option value="" disabled>Selecione alguém...</option>
            {todosNomes.map(nome => (<option key={nome} value={nome}>{nome}</option>))}
          </select>
          <button onClick={handleEntrarSair} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 rounded-xl shadow-sm active:scale-95 transition-all text-sm whitespace-nowrap">Entrar/Sair</button>
        </div>
        {isSecretaria && <p className="text-[12px] text-green-700 mt-2 font-bold flex items-center gap-1">👑 Acesso de Secretaria/Gestão: Alteração livre.</p>}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => handleAcaoAuditada(() => toggleTelefone(alvoSelecionado!), 'Telefone')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl" title="Telefone">📞</button>
        <button onClick={() => handleAcaoAuditada(() => toggleCafe(alvoSelecionado!), 'Café')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl" title="Café">☕</button>
        <button onClick={handlePassarAuditado} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">🏆 Passar Bastão</button>
        <button onClick={() => handleAcaoAuditada(() => toggleSkip(alvoSelecionado!), 'Pular Vez')} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">⏩ Pular</button>
      </div>

      {/* Modal: Voltar ao Bastão ou Ficar Indisponível */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-800 mb-2 text-center">O que deseja fazer?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              <span className="font-bold text-indigo-600">{modalAlvo}</span> está com status ativo fora da fila.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleEscolhaModal('bastao')}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-sm active:scale-95 transition-all text-base flex items-center justify-center gap-2"
              >
                🔄 Voltar ao Bastão
              </button>
              <button
                onClick={() => handleEscolhaModal('indisponivel')}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-sm active:scale-95 transition-all text-base flex items-center justify-center gap-2"
              >
                🚫 Ficar Indisponível
              </button>
              <button
                onClick={() => { setModalAberto(false); setModalAlvo(''); }}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition-all text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
