import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { PainelBastao } from './components/PainelBastao'
import { PainelAcoes } from './components/PainelAcoes'
import { PainelStatus } from './components/PainelStatus'
import { PainelLogmein } from './components/PainelLogmein'
import { PainelMural } from './components/PainelMural'
import { PainelFerramentas } from './components/PainelFerramentas'
import { PainelEquipe } from './components/PainelEquipe'
import { PainelGerencial } from './components/PainelGerencial'
import { PainelAtividades, PainelAnalytics } from './components/PainelAtividades'
import { PainelSessoes } from './components/PainelSessoes'
import { LojinhaVirtual } from './components/LojinhaVirtual'
import { LojinhaRashid } from './components/LojinhaRashid'
import { TriagemBastao } from './components/TriagemBastao'
import { Login } from './components/Login'
import { BannerAnomalia, BotaoAnomalia } from './components/BotaoAnomalia'
import { BadgePendencias } from './components/BadgePendencias'
import { ModalAtividadePresencial } from './components/ModalAtividadePresencial'
import { useBastaoStore } from './store/useBastaoStore'
import { USUARIOS_SISTEMA, getRamal } from './constants'

function BotaoDicasDiarias() {
  return (
    <button
      onClick={() => window.open('/dicasdiarias.html', '_blank', 'noopener,noreferrer')}
      className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">💡</span>
      <span className="tracking-wide">Acesso Dica da Semana</span>
      <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
    </button>
  )
}

function BotaoCarometro() {
  return (
    <button
      onClick={() => window.open('/Carômetro_Cesupe.html', '_blank', 'noopener,noreferrer')}
      className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-600 hover:via-teal-600 hover:to-emerald-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform duration-300">👥</span>
      <span className="tracking-wide">Carômetro CESUPE</span>
      <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
    </button>
  )
}

function App() {
  const { initRealtime, meuLogin } = useBastaoStore()
  const [showDashboard, setShowDashboard] = useState(false)
  const [showDadosConsultor, setShowDadosConsultor] = useState(false)

  useEffect(() => { initRealtime() }, [])

  if (!meuLogin) return <Login />

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isGestor = usuarioLogado?.perfil === 'Gestor'

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      {/* Banner de anomalia — aparece no topo para todos */}
      <BannerAnomalia />

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
            {/* Botão toggle dashboard */}
            <button
              onClick={() => setShowDashboard(v => !v)}
              className={`flex items-center justify-between w-full px-6 py-3 rounded-2xl font-bold text-sm shadow-sm border transition-all ${showDashboard ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'}`}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                Dashboard Gerencial
              </span>
              <span className={`transition-transform duration-200 ${showDashboard ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Dashboard expansível no topo */}
            {showDashboard && (
              <div className="animate-fadeIn">
                <PainelGerencial inline={true} perfil={usuarioLogado?.perfil ?? 'Consultor'} />
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <PainelBastao />
              </div>
              <div className="xl:col-span-1 flex flex-col gap-6">
                <PainelEquipe />
                <BadgePendencias modoGestor={true} />
                <BotaoAnomalia />
                <BotaoDicasDiarias />
                <BotaoCarometro />
                <PainelFerramentas />
                <TriagemBastao />
                <PainelMural />
              </div>
            </div>
            <PainelSessoes />
            <LojinhaVirtual />
            <LojinhaRashid />
            <PainelAtividades inline={true} />
          </main>
        ) : (
          <main className="px-4 flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-6">
                <PainelBastao />
                <PainelEquipe />
                <PainelLogmein />
                <BadgePendencias modoGestor={false} />
                <PainelFerramentas />
                <BotaoAnomalia />
                <BotaoDicasDiarias />
                <BotaoCarometro />
                <PainelFerramentas />
                <TriagemBastao />
              </div>
              <div className="flex flex-col gap-6">
                <PainelAcoes />
                <PainelStatus />
                <PainelMural />
              </div>
            </div>
            <PainelSessoes />
            <LojinhaVirtual />
            <LojinhaRashid />
            {/* ── Análise Cesupe — menu suspenso ── */}
            <button
              onClick={() => setShowDadosConsultor(v => !v)}
              className={`flex items-center justify-between w-full px-6 py-3 rounded-2xl font-bold text-sm shadow-sm border transition-all ${showDadosConsultor ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200 hover:bg-red-50'}`}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                Dados Cesupe
              </span>
              <span className={`transition-transform duration-200 ${showDadosConsultor ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {showDadosConsultor && (
              <div className="animate-fadeIn flex flex-col gap-4">
                <PainelGerencial inline={true} perfil={usuarioLogado?.perfil ?? 'Consultor'} />
                <PainelAnalytics inline={true} />
              </div>
            )}
          </main>
        )}
      </div>
      <ModalAtividadePresencial />
    </div>
  )
}

export default App
