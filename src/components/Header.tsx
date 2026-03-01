import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

export function Header() {
  const { meuLogin, setMeuLogin } = useBastaoStore()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  
  const perfil = usuarioLogado ? usuarioLogado.perfil : 'Consultor'
  const equipe = usuarioLogado ? usuarioLogado.equipe : 'Eproc'
  const [showDemolay, setShowDemolay] = useState(false)

  let badgeColor = 'bg-blue-100 text-blue-700 border-blue-200'
  let badgeText = perfil

  if (perfil === 'Secretaria') badgeColor = 'bg-pink-100 text-pink-700 border-pink-200'
  
  if (perfil === 'Gestor') {
    if (equipe === 'Projetos') {
      badgeColor = 'bg-teal-100 text-teal-700 border-teal-200'
      badgeText = 'Projetos'
    } else {
      badgeColor = 'bg-indigo-100 text-indigo-700 border-indigo-200'
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 mb-6 flex justify-between items-center shadow-sm rounded-b-2xl relative z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Controle Bastão Cesupe 2026 🎭</h1>
          <div className="flex items-center gap-3">
            <video src="/Cesupinho.mp4" autoPlay loop muted playsInline className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white transition-all duration-300 hover:scale-[2.5] hover:z-50 relative cursor-pointer origin-top" />
            <video src="/PugDemolay.mp4" autoPlay loop muted playsInline onClick={() => setShowDemolay(true)} className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-yellow-400 transition-all duration-300 hover:scale-[3.5] hover:z-50 relative cursor-pointer origin-top hover:border-yellow-300 hover:shadow-2xl" title="🔱 Clique para saber mais sobre Demolay" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Logado como</p>
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-800 text-lg">{meuLogin}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${badgeColor}`}>{badgeText}</span>
          </div>
        </div>
        <button onClick={() => { setMeuLogin(''); localStorage.removeItem('@bastao:meuLogin'); }} className="text-sm font-bold text-red-500 hover:text-red-700 underline underline-offset-4">Trocar usuário</button>
      </div>

      {/* Modal Demolay */}
      {showDemolay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in" onClick={() => setShowDemolay(false)}>
          <div className="bg-white max-w-lg w-full mx-4 rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-red-800 to-red-950 p-6 text-center">
              <span className="text-5xl">🔱</span>
              <h2 className="text-2xl font-black text-white mt-2">Mês em homenagem a Jacques Demolay</h2>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              <video src="/PugDemolay.mp4" autoPlay loop muted playsInline className="h-40 w-40 object-cover rounded-full shadow-lg border-4 border-red-800" />
              <p className="text-gray-700 text-center leading-relaxed font-medium">
                <strong>Jacques de Molay</strong> foi o último Grão-Mestre dos Templários. Preso e acusado injustamente, ele se recusou a trair seus companheiros ou renegar seus princípios, mantendo-se firme até o fim — e preferiu a morte à desonra.
              </p>
              <button onClick={() => setShowDemolay(false)} className="mt-2 bg-red-800 hover:bg-red-900 text-white font-bold px-8 py-3 rounded-xl transition-colors">
                ✝️ Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}