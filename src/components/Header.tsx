
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

export function Header() {
  const { meuLogin, setMeuLogin } = useBastaoStore()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  
  const perfil = usuarioLogado ? usuarioLogado.perfil : 'Consultor'
  const equipe = usuarioLogado ? usuarioLogado.equipe : 'Eproc'

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
    // Adicionei relative e z-50 no header para os vídeos poderem "vazar" por cima do resto do site
    <header className="bg-white border-b border-gray-200 px-6 py-4 mb-6 flex justify-between items-center shadow-sm rounded-b-2xl relative z-50">
      <div className="flex items-center gap-6">
        
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Controle Bastão Cesupe 2026 🎭</h1>
          
          {/* OS VÍDEOS COM O EFEITO DE POPOVER GIGANTE NO HOVER */}
          <div className="flex items-center gap-3">
            <video 
              src="/Cesupinho.mp4" 
              autoPlay loop muted playsInline 
              title="Cesupinho"
              className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white ring-2 ring-indigo-100 transition-all duration-300 ease-out hover:scale-[2.5] hover:shadow-2xl hover:z-50 relative z-10 cursor-pointer origin-top" 
            />
            <video 
              src="/PugMês.mp4" 
              autoPlay loop muted playsInline 
              title="PugMês"
              className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white ring-2 ring-indigo-100 transition-all duration-300 ease-out hover:scale-[2.5] hover:shadow-2xl hover:z-50 relative z-10 cursor-pointer origin-top" 
            />
          </div>
        </div>
        
        {/* RAMAIS DA GESTÃO */}
        <div className="hidden 2xl:flex items-center gap-4 text-[11px] font-bold text-gray-500 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 shadow-inner ml-4">
          <span className="text-indigo-600 uppercase tracking-wider">👑 Gestão:</span>
          <span className="flex items-center gap-1">Gilberto <span className="bg-white px-1.5 py-0.5 rounded border">☎ 2645</span></span>
          <span className="flex items-center gap-1">Matheus <span className="bg-white px-1.5 py-0.5 rounded border">☎ 2664</span></span>
          
          <div className="h-4 w-px bg-gray-300 mx-1"></div>
          
          <span className="text-teal-600 uppercase tracking-wider">🎯 Projetos:</span>
          <span className="flex items-center gap-1">Juliana <span className="bg-white px-1.5 py-0.5 rounded border">☎ 4209</span></span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Logado no PC como</p>
          <div className="flex items-center gap-2">
            <span className="font-black text-gray-800 text-lg">{meuLogin}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide ${badgeColor}`}>{badgeText}</span>
          </div>
        </div>
        <div className="h-10 w-px bg-gray-200 mx-2"></div>
        <button onClick={() => { setMeuLogin(''); localStorage.removeItem('@bastao:meuLogin'); }} className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors underline decoration-dotted underline-offset-4">Trocar usuário</button>
      </div>
    </header>
  )
}