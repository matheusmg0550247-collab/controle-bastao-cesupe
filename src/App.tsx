import { useEffect } from 'react'
import { Header } from './components/Header'
import { PainelBastao } from './components/PainelBastao'
import { PainelAcoes } from './components/PainelAcoes'
import { PainelStatus } from './components/PainelStatus'
import { PainelLogmein } from './components/PainelLogmein'
import { PainelMural } from './components/PainelMural'
import { PainelFerramentas } from './components/PainelFerramentas'
import { PainelEquipe } from './components/PainelEquipe'
import { PainelGerencial } from './components/PainelGerencial'
import { PainelSessoes } from './components/PainelSessoes'
import { LojinhaVirtual } from './components/LojinhaVirtual'
import { Login } from './components/Login'
import { useBastaoStore } from './store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal } from './constants'

function BotaoDicasDiarias() {
  return (
    <a
      href="/dicasdiarias.html"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">💡</span>
      <span className="tracking-wide">Acesso Dicas Diárias</span>
      <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
    </a>
  )
}

function App() {
  const { initRealtime, meuLogin } = useBastaoStore()

  useEffect(() => { initRealtime() }, [])

  if (!meuLogin) return <Login />

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isGestor = usuarioLogado?.perfil === 'Gestor'

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <div className="max-w-[1850px] mx-auto pt-2 pb-8">
        <Header />

        {/* BARRA DE RAMAIS DA GESTÃO */}
        <div className="px-4 mb-4">
          <div className="bg-gradient-to-r from-indigo-900 to-violet-800 rounded-2xl px-6 py-3 flex items-center justify-center gap-8 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm font-bold">👑 Matheus:</span>
              <span className="bg-white/20 text-white font-black text-lg px-4 py-1 rounded-xl border border-white/30">☎ {getRamal('Matheus')}</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-sm font-bold">👑 Gilberto:</span>
              <span className="bg-white/20 text-white font-black text-lg px-4 py-1 rounded-xl border border-white/30">☎ {getRamal('Gilberto')}</span>
            </div>
          </div>
        </div>

        {isGestor ? (
          <main className="px-4 flex flex-col gap-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <PainelBastao />
              </div>
              <div className="xl:col-span-1 flex flex-col gap-6">
                <PainelEquipe />
                <BotaoDicasDiarias />
                <PainelMural />
              </div>
            </div>
            <PainelSessoes />
            <LojinhaVirtual />
            <PainelGerencial />
          </main>
        ) : (
          <main className="px-4 flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                <PainelBastao />
                <PainelEquipe />
                <BotaoDicasDiarias />
                <PainelLogmein />
                <PainelFerramentas />
              </div>
              <div className="flex flex-col gap-6">
                <PainelAcoes />
                <PainelStatus />
                <PainelMural />
              </div>
            </div>
            <PainelSessoes />
            <LojinhaVirtual />
          </main>
        )}
      </div>
    </div>
  )
}

export default App
