import { useBastaoStore } from '../store/useBastaoStore'
import { getEquipe, USUARIOS_SISTEMA } from '../constants' 

export function PainelAcoes() {
  const { meuLogin, alvoSelecionado, setAlvoSelecionado, passarBastao, toggleTelefone, toggleCafe, toggleSkip, toggleFila, filaEproc, filaJpe } = useBastaoStore()

  const todosNomes = USUARIOS_SISTEMA.map(u => u.nome).sort()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'

  const handleAcaoAuditada = (acaoFn: () => void, nomeAcao: string) => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!');
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está aplicando "${nomeAcao}" no perfil de ${alvoSelecionado}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
      );
      if (!confirmar) return;
    }
    acaoFn();
  }

  const handlePassarAuditado = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro para identificar a fila!');
    const equipe = getEquipe(alvoSelecionado) as "EPROC" | "JPE";
    if (!equipe) return;
    const filaAtual = equipe === "EPROC" ? filaEproc : filaJpe;
    const donoDoBastao = filaAtual.length > 0 ? filaAtual[0] : null;
    if (!isSecretaria && meuLogin !== donoDoBastao) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está passando o Bastão da equipe ${equipe}, mas ele está com ${donoDoBastao || 'ninguém'}.\nEsta ação será registrada em seu nome (${meuLogin}).\n\nDeseja continuar?`
      );
      if (!confirmar) return;
    }
    passarBastao(equipe);
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
          <button onClick={() => handleAcaoAuditada(() => toggleFila(alvoSelecionado!), 'Entrar/Sair do Bastão')} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 rounded-xl shadow-sm active:scale-95 transition-all text-sm whitespace-nowrap">Entrar/Sair</button>
        </div>
        {isSecretaria && <p className="text-[12px] text-green-700 mt-2 font-bold flex items-center gap-1">👑 Acesso de Secretaria/Gestão: Alteração livre.</p>}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => handleAcaoAuditada(() => toggleTelefone(alvoSelecionado!), 'Telefone')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl" title="Telefone">📞</button>
        <button onClick={() => handleAcaoAuditada(() => toggleCafe(alvoSelecionado!), 'Café')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl" title="Café">☕</button>
        <button onClick={handlePassarAuditado} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">🏆 Passar Bastão</button>
        <button onClick={() => handleAcaoAuditada(() => toggleSkip(alvoSelecionado!), 'Pular Vez')} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">⏩ Pular</button>
      </div>
    </div>
  )
}
