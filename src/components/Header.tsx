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
    <header className="bg-white border-b border-gray-200 px-6 py-4 mb-6 flex justify-between items-center shadow-sm rounded-b-2xl relative z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Controle Bastão Cesupe 2026 🎭</h1>
          <div className="flex items-center gap-3">
            <video src="/Cesupinho.mp4" autoPlay loop muted playsInline className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white transition-all duration-300 hover:scale-[2.5] hover:z-50 relative cursor-pointer origin-top" />
            <video src="/PugMês.mp4" autoPlay loop muted playsInline className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white transition-all duration-300 hover:scale-[2.5] hover:z-50 relative cursor-pointer origin-top" />
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
    </header>
  )
}