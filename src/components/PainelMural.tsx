import { useState } from 'react';
import { useBastaoStore } from '../store/useBastaoStore';

interface MensagemMural {
  id: string; autor: string; texto: string; data: string; tipo: string;
}

export function PainelMural() {
  const { logmein, adicionarMensagemMural, meuLogin } = useBastaoStore();
  const [filtro, setFiltro] = useState('Todas');
  const [novaMsg, setNovaMsg] = useState('');
  const [msgExpandida, setMsgExpandida] = useState<MensagemMural | null>(null);

  const todasMensagens: MensagemMural[] = (logmein.mensagens || []) as MensagemMural[];

  const handleEnviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMsg.trim() || !meuLogin) return;
    adicionarMensagemMural(novaMsg, 'comum', meuLogin);
    setNovaMsg('');
  };

  const gestores = ['Matheus', 'Gilberto'];
  const secProj = ['Juliana', 'Brenda', 'Larissa'];

  const msgGestao = todasMensagens.find(m => gestores.includes(m.autor));
  const msgSecProj = todasMensagens.find(m => secProj.includes(m.autor) && m.id !== msgGestao?.id);
  const msgLogmein = todasMensagens.find(m => m.tipo === 'logmein' && m.id !== msgGestao?.id && m.id !== msgSecProj?.id);

  const pinnedIds = [msgGestao?.id, msgSecProj?.id, msgLogmein?.id].filter(Boolean);
  const outrasMensagens = todasMensagens.filter(m => !pinnedIds.includes(m.id));

  let exibicao = outrasMensagens;
  if (filtro === 'Gestão') exibicao = outrasMensagens.filter(m => gestores.includes(m.autor));
  if (filtro === 'Secretaria/Projetos') exibicao = outrasMensagens.filter(m => secProj.includes(m.autor));
  if (filtro === 'LogMeIn') exibicao = outrasMensagens.filter(m => m.tipo === 'logmein');
  if (filtro === 'Consultores') exibicao = outrasMensagens.filter(m => !gestores.includes(m.autor) && !secProj.includes(m.autor) && m.tipo !== 'logmein');
  if (filtro === 'Menções') exibicao = outrasMensagens.filter(m => m.texto.includes('@'));

  const renderCard = (msg: MensagemMural, isPinned: boolean) => {
    const isGestao = gestores.includes(msg.autor);
    const isSecProj = secProj.includes(msg.autor);
    const isLogmein = msg.tipo === 'logmein';
    const hasMention = msg.texto.includes('@');

    let css = "bg-white border-gray-200 text-gray-700";
    let emoji = "💬";

    if (isGestao) {
      css = "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 border-none shadow-xl shadow-fuchsia-500/30 text-white";
      emoji = "👑";
    } else if (isSecProj) {
      css = "bg-gradient-to-r from-pink-50 to-rose-100 border-pink-300 shadow-pink-100";
      emoji = "🌸";
    } else if (isLogmein) {
      css = "bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200 shadow-indigo-50";
      emoji = "💻";
    } else if (hasMention) {
      // REMOVIDO animate-pulse — era a causa do tremor!
      css = "bg-gradient-to-r from-red-500 to-rose-500 border-red-600 text-white shadow-lg";
      emoji = "🚨";
    }

    if (isPinned) css += " ring-2 ring-white";
    const isDarkBg = isGestao || (hasMention && !isSecProj && !isLogmein);
    const horaFormatada = new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
      <div
        key={msg.id}
        onClick={() => setMsgExpandida(msg)}
        className={`p-4 rounded-xl border ${css} transition-shadow duration-200 hover:shadow-xl cursor-pointer`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className={`font-bold flex items-center gap-2 ${isDarkBg ? 'text-white' : ''}`}>
            {emoji} {msg.autor}
            {isPinned && <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${isDarkBg ? 'bg-white/20 border-white/30 text-white' : 'bg-white/50 border-black/10 text-black'}`}>Fixado</span>}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isDarkBg ? 'bg-black/20 border-black/30 text-white' : 'bg-white/60 border-black/10 text-black/60'}`}>
            {horaFormatada}
          </span>
        </div>
        <p className={`text-sm mt-1 font-medium ${isDarkBg ? 'text-white' : 'text-gray-800'} line-clamp-2`}>
          {msg.texto}
        </p>
      </div>
    );
  };

  const formatarDataCompleta = (data: string) => {
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      + ' às '
      + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getAutorTag = (autor: string) => {
    if (gestores.includes(autor)) return { label: 'Gestor', css: 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white', emoji: '👑' };
    if (secProj.includes(autor)) return { label: 'Secretaria/Projetos', css: 'bg-pink-100 text-pink-700 border border-pink-300', emoji: '🌸' };
    return { label: 'Consultor', css: 'bg-gray-100 text-gray-700 border border-gray-300', emoji: '💬' };
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full">
      <div className="flex justify-between items-center border-b pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">📌 Mural da Equipe</h2>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="bg-gray-50 border-2 border-gray-200 text-gray-700 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:border-indigo-500 transition-all cursor-pointer">
          <option value="Todas">Todas</option>
          <option value="Gestão">Apenas Gestão 👑</option>
          <option value="Secretaria/Projetos">Apenas Sec/Proj 🌸</option>
          <option value="Consultores">Apenas Consultores 💬</option>
          <option value="LogMeIn">Apenas LogMeIn 💻</option>
          <option value="Menções">Menções (@) 🚨</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 min-h-[350px]">
        {filtro === 'Todas' && (
          <div className="flex flex-col gap-3 pb-3 border-b-2 border-dashed border-gray-200 mb-2">
            {msgGestao && renderCard(msgGestao, true)}
            {msgSecProj && renderCard(msgSecProj, true)}
            {msgLogmein && renderCard(msgLogmein, true)}
          </div>
        )}
        {exibicao.length === 0
          ? <p className="text-center text-gray-400 mt-10 font-medium italic">Nenhuma mensagem.</p>
          : exibicao.map(msg => renderCard(msg, false))
        }
      </div>

      <form onSubmit={handleEnviar} className="mt-4 flex gap-2 pt-4 border-t border-gray-200">
        <input type="text" value={novaMsg} onChange={e => setNovaMsg(e.target.value)} placeholder="Escreva um recado (Use @Nome para alertar)..." className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 font-medium text-gray-700 bg-gray-50" />
        <button type="submit" disabled={!novaMsg.trim()} className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50">Enviar</button>
      </form>

      {/* POPOVER DE MENSAGEM EXPANDIDA */}
      {msgExpandida && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMsgExpandida(null)}>
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-gray-200 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMsgExpandida(null)} className="absolute top-4 right-5 text-gray-400 hover:text-red-500 text-2xl font-bold">✖</button>

            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getAutorTag(msgExpandida.autor).emoji}</span>
              <div>
                <p className="text-xl font-black text-gray-800">{msgExpandida.autor}</p>
                <span className={`text-xs font-black px-2 py-1 rounded-lg ${getAutorTag(msgExpandida.autor).css}`}>
                  {getAutorTag(msgExpandida.autor).label}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-400 font-bold mb-4 bg-gray-50 p-2 rounded-lg">
              🕐 {formatarDataCompleta(msgExpandida.data)}
            </p>

            {msgExpandida.tipo === 'logmein' && (
              <span className="inline-block text-xs font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg mb-3">💻 Mensagem do LogMeIn</span>
            )}

            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <p className="text-base font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">
                {msgExpandida.texto}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
