import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { getRamal, USUARIOS_SISTEMA, getConsultorDisplayName } from '../constants'

export function PainelBastao() {
  const { filaEproc, filaJpe, skipFlags, quickIndicators, statusTexto, updateStatus, meuLogin } = useBastaoStore()
  const [ramalPopover, setRamalPopover] = useState<string | null>(null)

  const handleRemoverDaFila = (nome: string) => {
    const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin);
    const isSecretaria = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor';
    
    if (!isSecretaria && meuLogin !== nome) {
      const confirmar = window.confirm(
        `⚠️ AUDITORIA\n\nVocê está removendo ${nome} do Bastão.\nEsta ação será registrada no banco de dados em seu nome (${meuLogin}).\n\nDeseja continuar?`
      );
      if (!confirmar) return;
    }
    updateStatus(nome, 'Indisponível', false, '');
  }

  // Retorna o emoji do status se for Atividades ou Projeto
  const getStatusEmoji = (nome: string) => {
    const status = statusTexto[nome];
    if (status === 'Atividades') return '📋';
    if (status === 'Projeto') return '🏗️';
    return null;
  }

  const renderFila = (titulo: string, fila: string[], isEproc: boolean) => {
    const corTema = isEproc ? 'orange' : 'blue';
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex-1">
        <h2 className={`text-xl font-black text-${corTema}-600 mb-6 flex items-center gap-2 border-b border-${corTema}-100 pb-2`}>
          {isEproc ? '🔥' : '🔥'} Fila {titulo}
        </h2>
        
        <div className="mb-6">
          <p className="text-[10px] font-black text-gray-400 tracking-wider mb-2 uppercase">Com o Bastão:</p>
          {fila.length > 0 ? (
            <div onClick={() => handleRemoverDaFila(fila[0])} className={`border-2 border-${corTema}-400 bg-${corTema}-50 p-4 rounded-xl flex justify-between items-center shadow-md cursor-pointer hover:bg-${corTema}-100 transition-colors group`} title="Clique para remover da fila">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔥</span>
                <span className={`text-2xl font-black text-${corTema}-600 group-hover:text-${corTema}-800`}>
                  {getConsultorDisplayName(fila[0])}
                </span>
                {/* Emoji de status (Atividades/Projeto) */}
                {getStatusEmoji(fila[0]) && (
                  <span className="text-xl" title={statusTexto[fila[0]]}>{getStatusEmoji(fila[0])}</span>
                )}
                {skipFlags[fila[0]] && <span className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md ml-2 animate-pulse">PULAR</span>}
              </div>
              <div className="flex items-center gap-2">
                {quickIndicators[fila[0]]?.telefone && <span className="text-xl">📞</span>}
                {quickIndicators[fila[0]]?.cafe && <span className="text-xl">☕</span>}
                <span
                  onMouseEnter={(e) => { e.stopPropagation(); setRamalPopover(fila[0]); }}
                  onMouseLeave={() => setRamalPopover(null)}
                  className={`bg-white border border-${corTema}-200 text-${corTema}-700 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md origin-right cursor-default`}
                >
                  ☎ {getRamal(fila[0])}
                </span>
              </div>
            </div>
          ) : (
             <div className="border border-dashed border-gray-300 bg-gray-50 p-4 rounded-xl text-center text-gray-400 font-medium">(Ninguém)</div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black text-gray-400 tracking-wider mb-2 uppercase">Próximos:</p>
          {fila.length > 1 ? (
            <div className="flex flex-col gap-2">
              {fila.slice(1).map((nome, index) => (
                <div key={nome} onClick={() => handleRemoverDaFila(nome)} className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:bg-red-50 hover:border-red-200 transition-colors group" title="Clique para remover da fila">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-gray-400 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">{index + 2}º</span>
                    <span className="font-bold text-gray-700 group-hover:text-red-700">{getConsultorDisplayName(nome)}</span>
                    {/* Emoji de status (Atividades/Projeto) */}
                    {getStatusEmoji(nome) && (
                      <span className="text-sm" title={statusTexto[nome]}>{getStatusEmoji(nome)}</span>
                    )}
                    {skipFlags[nome] && <span className="bg-gray-300 text-gray-700 text-[10px] font-black px-1.5 py-0.5 rounded ml-1">PULAR</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {quickIndicators[nome]?.telefone && <span>📞</span>}
                    {quickIndicators[nome]?.cafe && <span>☕</span>}
                    <span
                      onMouseEnter={(e) => { e.stopPropagation(); setRamalPopover(nome); }}
                      onMouseLeave={() => setRamalPopover(null)}
                      className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200 transition-transform duration-300 group-hover:scale-125 group-hover:text-red-600 group-hover:border-red-300 origin-right cursor-default"
                    >
                      ☎ {getRamal(nome)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Fila vazia.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-6 w-full">
        {renderFila('EPROC', filaEproc, true)}
        {renderFila('JPE', filaJpe, false)}
      </div>

      {/* POPOVER GRANDE DO RAMAL */}
      {ramalPopover && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-3xl shadow-2xl border-2 border-orange-200 p-8 text-center pointer-events-none" style={{ animation: 'fadeIn 0.15s ease-out' }}>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Ramal de</p>
            <p className="text-2xl font-black text-gray-800 mb-4">{ramalPopover}</p>
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl px-10 py-5 shadow-lg">
              <p className="text-5xl font-black tracking-wider">☎ {getRamal(ramalPopover)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
