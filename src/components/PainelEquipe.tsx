import { useState, useEffect, useRef } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal } from '../constants'

// =============================================
// COMPONENTE: Tooltip flutuante com ramal + mensagens do mural
// =============================================
function TooltipConsultor({ nome, children }: { nome: string; children: React.ReactNode }) {
  const { logmein } = useBastaoStore();
  const [visivel, setVisivel] = useState(false);
  const [posicao, setPosicao] = useState<'bottom' | 'top'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ramal = getRamal(nome);
  const primeiroNome = nome.split(' ')[0];

  // Pega as 5 últimas mensagens do consultor OU que mencionam ele
  const mensagensRelacionadas = (logmein.mensagens || [])
    .filter(m => m.autor === nome || m.autor === primeiroNome || m.texto.includes(`@${primeiroNome}`) || m.texto.includes(nome))
    .slice(0, 5);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      // Calcula se o tooltip cabe abaixo ou precisa ir pra cima
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const espacoAbaixo = window.innerHeight - rect.bottom;
        setPosicao(espacoAbaixo < 260 ? 'top' : 'bottom');
      }
      setVisivel(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisivel(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {visivel && (
        <div className={`absolute z-[999] left-0 ${posicao === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in`}
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          {/* Cabeçalho com nome e ramal */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white">
            <p className="font-black text-lg">{nome}</p>
            <p className="text-orange-100 font-bold flex items-center gap-2 mt-1">
              ☎ Ramal: <span className="bg-white/20 px-3 py-1 rounded-lg text-white font-black text-base">{ramal}</span>
            </p>
          </div>

          {/* Últimas mensagens no mural */}
          <div className="p-3 max-h-48 overflow-y-auto">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2">
              💬 Últimas mensagens no mural
            </p>
            {mensagensRelacionadas.length > 0 ? (
              <div className="flex flex-col gap-2">
                {mensagensRelacionadas.map(msg => {
                  const hora = new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const dia = new Date(msg.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  return (
                    <div key={msg.id} className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-gray-500">{msg.autor}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{dia} {hora}</span>
                      </div>
                      <p className="text-xs text-gray-700 font-medium leading-relaxed line-clamp-2">{msg.texto}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center py-3">Nenhuma mensagem recente</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL: PainelEquipe
// =============================================
export function PainelEquipe() {
  const { meuLogin, statusTexto, statusDetalhe, filaEproc, filaJpe, updateStatus } = useBastaoStore()
  const [statusAberto, setStatusAberto] = useState<string | null>(null)

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
                <TooltipConsultor key={nome} nome={nome}>
                  <div 
                    onClick={() => handleVoltarParaFila(nome)}
                    title="Clique para devolver ao Bastão"
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl cursor-pointer hover:bg-orange-50 hover:border-orange-300 transition-colors group"
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
                  </div>
                </TooltipConsultor>
              ))}
            </div>

            <button onClick={() => setStatusAberto(null)} className="w-full mt-6 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-300">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
