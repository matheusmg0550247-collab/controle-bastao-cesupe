import { useState, useEffect } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal, getConsultorDisplayName, CONSULTOR_IMAGENS } from '../constants'

export function PainelEquipe() {
  const { meuLogin, statusTexto, statusDetalhe, filaEproc, filaJpe, updateStatus } = useBastaoStore()
  const [statusAberto, setStatusAberto] = useState<string | null>(null)
  const [ramalPopover, setRamalPopover] = useState<string | null>(null)

  const handleVoltarParaFila = (nome: string) => {
    const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin);
    const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor';

    if (!isSecretaria && meuLogin !== nome) {
       const confirmar = window.confirm(
          `⚠️ AUDITORIA\n\nVocê está devolvendo ${nome} para a Fila do Bastão.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
       );
       if (!confirmar) return;
    }
    updateStatus(nome, '', true, ''); 
  }

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'Atividades': return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200';
      case 'Projeto': return 'bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200';
      case 'Treinamento': return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200';
      case 'Reunião': return 'bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-200';
      case 'Almoço': return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200';
      case 'Sessão': return 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200';
      case 'Atend. Presencial': return 'bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
    }
  }

  const agrupado = USUARIOS_SISTEMA.reduce((acc, user) => {
    if (user.perfil === 'Secretaria' || user.perfil === 'Gestor') return acc;
    const nome = user.nome;
    const naFila = filaEproc.includes(nome) || filaJpe.includes(nome);
    if (naFila) return acc;
    let statusAtual = statusTexto[nome] && statusTexto[nome] !== '' ? statusTexto[nome] : 'Indisponível';
    if (statusAtual === 'Com o Bastão') statusAtual = 'Indisponível';
    if (!acc[statusAtual]) acc[statusAtual] = [];
    acc[statusAtual].push(nome);
    return acc;
  }, {} as Record<string, string[]>);

  useEffect(() => {
    if (statusAberto && !agrupado[statusAberto]) setStatusAberto(null);
  }, [agrupado, statusAberto]);

  const statusOrder = ['Atividades', 'Projeto', 'Treinamento', 'Reunião', 'Almoço', 'Sessão', 'Atend. Presencial', 'Indisponível'];
  const statusKeys = Object.keys(agrupado).sort((a, b) => {
     const indexA = statusOrder.indexOf(a);
     const indexB = statusOrder.indexOf(b);
     return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
  });

  return (
    <>
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
                  onClick={() => handleVoltarParaFila(nome)}
                  title="Clique para devolver ao Bastão"
                  className="bg-gray-50 border border-gray-200 p-3 rounded-xl cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors group relative"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-800 text-lg group-hover:text-orange-700 flex items-center gap-1">
                      {CONSULTOR_IMAGENS[nome] && <img src={CONSULTOR_IMAGENS[nome]} alt="" className="w-5 h-5 object-contain inline-block" />}
                      {getConsultorDisplayName(nome)}
                    </span>
                    <span
                      onMouseEnter={(e) => { e.stopPropagation(); setRamalPopover(nome); }}
                      onMouseLeave={() => setRamalPopover(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-black bg-gray-200 text-gray-600 px-2 py-1 rounded-md cursor-default transition-transform duration-300 group-hover:scale-125 origin-right group-hover:bg-orange-100 group-hover:text-orange-700 z-10 relative"
                    >
                      ☎ {getRamal(nome)}
                    </span>
                  </div>
                  {statusDetalhe[nome] ? (
                    <p className="text-sm text-indigo-700 font-bold bg-indigo-50 p-2 rounded-lg inline-block">↳ {statusDetalhe[nome]}</p>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium italic">Sem detalhes adicionais</p>
                  )}
                  
                  <div className="absolute inset-0 bg-orange-500/90 text-white font-black text-sm flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    🔥 Clique para voltar à Fila
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
    </div>

      {/* POPOVER GRANDE DO RAMAL */}
      {ramalPopover && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-orange-200 p-8 text-center pointer-events-none" style={{ animation: 'fadeIn 0.15s ease-out' }}>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Ramal de</p>
            <p className="text-2xl font-black text-gray-800 mb-2 flex items-center justify-center gap-2">
              {CONSULTOR_IMAGENS[ramalPopover] && (
                <img src={CONSULTOR_IMAGENS[ramalPopover]} alt="" className="w-10 h-10 object-contain" />
              )}
              {ramalPopover}
            </p>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl px-10 py-5 shadow-lg">
              <p className="text-5xl font-black tracking-wider">☎ {getRamal(ramalPopover)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}