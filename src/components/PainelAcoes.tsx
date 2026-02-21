import { useBastaoStore } from '../store/useBastaoStore'
import { getEquipe, USUARIOS_SISTEMA } from '../constants' 

export function PainelAcoes() {
  const { meuLogin, alvoSelecionado, setAlvoSelecionado, passarBastao, toggleTelefone, toggleCafe, toggleSkip, toggleFila, filaEproc, filaJpe } = useBastaoStore()

  const todosNomes = USUARIOS_SISTEMA.map(u => u.nome).sort()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'

  // Auditoria para os botões genéricos (Telefone, Café, Entrar/Sair, Pular)
  const handleAcaoAuditada = (acaoFn: () => void, nomeAcao: string) => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!');
    
    // Se não for Secretaria/Gestão E o alvo não for a própria pessoa = ALERTA!
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está aplicando "${nomeAcao}" no perfil de ${alvoSelecionado}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
      );
      if (!confirmar) return;
    }
    acaoFn();
  }

  // Auditoria ESPECÍFICA para Passar o Bastão (Só o dono do bastão atual passa sem aviso)
  const handlePassarAuditado = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro para identificar a fila!');
    const equipe = getEquipe(alvoSelecionado) as "EPROC" | "JPE";
    if (!equipe) return;
    
    const filaAtual = equipe === "EPROC" ? filaEproc : filaJpe;
    const donoDoBastao = filaAtual.length > 0 ? filaAtual[0] : null;

    // Se não for Gestão/Secretaria E quem clicou não for o dono do bastão atual = ALERTA!
    if (!isSecretaria && meuLogin !== donoDoBastao) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está passando o Bastão da equipe ${equipe}, mas ele está com ${donoDoBastao || 'ninguém'}.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
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
        <select value={alvoSelecionado || ''} onChange={(e) => setAlvoSelecionado(e.target.value)} className="w-full border-2 rounded-xl p-3 outline-none font-bold text-gray-700 transition-all bg-white border-orange-200 focus:border-orange-500">
          <option value="" disabled>Selecione alguém...</option>
          {todosNomes.map(nome => (<option key={nome} value={nome}>{nome}</option>))}
        </select>
        {isSecretaria && <p className="text-[12px] text-green-700 mt-2 font-bold flex items-center gap-1">👑 Acesso de Secretaria/Gestão: Alteração livre.</p>}
      </div>

      <div className="grid grid-cols-5 gap-2">
        <button onClick={() => handleAcaoAuditada(() => toggleTelefone(alvoSelecionado!), 'Telefone')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl">📞</button>
        <button onClick={() => handleAcaoAuditada(() => toggleCafe(alvoSelecionado!), 'Café')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl">☕</button>
        <button onClick={() => handleAcaoAuditada(() => toggleFila(alvoSelecionado!), 'Entrar/Sair do Bastão')} className="col-span-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm truncate">Entrar/Sair</button>
        <button onClick={handlePassarAuditado} className="col-span-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm truncate">Passar</button>
        <button onClick={() => handleAcaoAuditada(() => toggleSkip(alvoSelecionado!), 'Pular Vez')} className="col-span-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1 truncate">⏩ Pular</button>
      </div>
    </div>
  )
}