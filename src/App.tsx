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
