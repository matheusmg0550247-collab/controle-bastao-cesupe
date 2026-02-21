import { useBastaoStore } from '../store/useBastaoStore'

export function PainelLogmein() {
  const { logmein, meuLogin, assumirLogmein, liberarLogmein, pedirLiberacaoLogmein, isLogmeinOpen, setLogmeinOpen } = useBastaoStore()
  
  const handleAssumir = () => meuLogin && assumirLogmein(meuLogin, meuLogin)
  const handleLiberar = () => meuLogin && liberarLogmein(logmein.consultor || meuLogin, meuLogin)
  const handlePedir = () => { if (meuLogin && logmein.consultor) pedirLiberacaoLogmein(meuLogin, logmein.consultor) }

  // 👇 FILTRA PARA EXIBIR APENAS AS MENSAGENS DO TIPO LOGMEIN NO HISTÓRICO
  const historicoLogmein = logmein.mensagens.filter(m => m.tipo === 'logmein');

  return (
    <div id="painel-logmein-section" className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      <button onClick={() => setLogmeinOpen(!isLogmeinOpen)} className="w-full p-6 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800">💻 Controle LogMeIn</h2>
          {logmein.emUso ? (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider animate-pulse border border-red-200">
              EM USO POR {logmein.consultor}
            </span>
          ) : (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider border border-green-200">
              LIVRE
            </span>
          )}
        </div>
        <span className="text-gray-400 font-bold text-xl">{isLogmeinOpen ? '▲' : '▼'}</span>
      </button>

      {isLogmeinOpen && (
        <div className="p-6 flex flex-col xl:flex-row gap-6">
          
          <div className="w-full xl:w-1/2 flex flex-col gap-4">
            <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner border border-gray-200 relative">
              <video src="/PugLog.mp4" autoPlay loop muted playsInline className="w-full h-full object-cover border-0" />
            </div>
            
            <div className="flex gap-3 mt-2">
              {!logmein.emUso ? (
                <button onClick={handleAssumir} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-sm transition-all active:scale-95 text-lg">
                  Assumir LogMeIn
                </button>
              ) : (
                <>
                  {logmein.consultor === meuLogin ? (
                    <button onClick={handleLiberar} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-sm transition-all active:scale-95 text-lg">
                      Liberar LogMeIn
                    </button>
                  ) : (
                    // 👇 MUDANÇA DO BOTÃO PARA "COBRAR LIBERAÇÃO"
                    <button onClick={handlePedir} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-sm transition-all active:scale-95 text-lg">
                      Cobrar liberação
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="w-full xl:w-1/2 bg-gray-50 rounded-xl p-4 border border-gray-200 h-[340px] overflow-y-auto flex flex-col">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 tracking-wider">Histórico de Uso</h3>
            {historicoLogmein.length === 0 ? (
              <p className="text-gray-400 text-sm text-center mt-10 font-medium">Nenhum registro recente.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {historicoLogmein.map(msg => {
                  const horaFormatada = new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg.id} className="text-sm bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">{msg.autor}</span>
                        <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          {horaFormatada}
                        </span>
                      </div>
                      <span className="text-gray-600">{msg.texto}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  )
}