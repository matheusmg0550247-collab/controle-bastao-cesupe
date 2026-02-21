import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

export function PainelStatus() {
  const { meuLogin, alvoSelecionado, updateStatus, setLogmeinOpen } = useBastaoStore()
  
  const [modalStatus, setModalStatus] = useState<string | null>(null)
  const [detalheText, setDetalheText] = useState('')
  const [manterNaFila, setManterNaFila] = useState(false)

  const handleAbrirModal = (status: string, regraPadraoFila: boolean) => {
    if (!alvoSelecionado) return alert('Selecione alguém no painel de Ações primeiro!');
    
    // VERIFICAÇÃO DA AUDITORIA
    const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin);
    const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor';

    if (!isSecretaria && meuLogin !== alvoSelecionado) {
       const confirmar = window.confirm(
          `⚠️ AUDITORIA\n\nVocê está aplicando "${status}" no perfil de ${alvoSelecionado}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
       );
       if (!confirmar) return;
    }

    if (status === 'Almoço') {
      updateStatus(alvoSelecionado, status, false, '');
      return;
    }
    
    setDetalheText('');
    setManterNaFila(regraPadraoFila);
    setModalStatus(status);
  }

  const handleSalvarStatus = () => {
    if (alvoSelecionado && modalStatus) {
      updateStatus(alvoSelecionado, modalStatus, manterNaFila, detalheText);
      setModalStatus(null);
    }
  }

  const handleAbrirLogmein = () => {
    setLogmeinOpen(true);
    setTimeout(() => { document.getElementById('painel-logmein-section')?.scrollIntoView({ behavior: 'smooth' }); }, 150);
  }

  const btnClass = "border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 rounded-xl text-sm font-bold text-gray-700 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">🔄 Status Rápido</h2>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button onClick={() => handleAbrirModal('Atividades', true)} className={btnClass}>📋 Atividades</button>
        <button onClick={() => handleAbrirModal('Projeto', true)} className={btnClass}>🏗️ Projeto</button>
        <button onClick={() => handleAbrirModal('Treinamento', false)} className={btnClass}>🎓 Treinamento</button>
        <button onClick={() => handleAbrirModal('Reunião', false)} className={btnClass}>📅 Reunião</button>
        <button onClick={() => handleAbrirModal('Almoço', false)} className={btnClass}>🍽️ Almoço</button>
        <button onClick={() => handleAbrirModal('Sessão', false)} className={btnClass}>🎙️ Sessão</button>
        <button onClick={() => handleAbrirModal('Atend. Presencial', false)} className={btnClass}>🤝 Presencial</button>
        <button onClick={handleAbrirLogmein} className={`${btnClass} bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100`}>💻 LogMeIn</button>
      </div>

      {modalStatus && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-black text-gray-800 mb-2">Informar detalhes</h3>
            <p className="text-sm text-gray-500 mb-4">Status: <strong className="text-indigo-600">{modalStatus}</strong> para {alvoSelecionado}</p>
            
            <label className="block text-sm font-bold text-gray-700 mb-1">Qual o detalhe? (Opcional)</label>
            <input type="text" value={detalheText} onChange={e => setDetalheText(e.target.value)} placeholder="Ex: BNMP, Reunião Diretoria..." className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 mb-4" autoFocus />

            {(modalStatus === 'Projeto' || modalStatus === 'Atividades') && (
              <label className="flex items-center gap-2 mb-6 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-200">
                <input type="checkbox" checked={manterNaFila} onChange={e => setManterNaFila(e.target.checked)} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-gray-700">Manter {alvoSelecionado} na fila do Bastão?</span>
              </label>
            )}

            <div className="flex gap-2 mt-2">
              <button onClick={handleSalvarStatus} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all">Salvar Status</button>
              <button onClick={() => setModalStatus(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}