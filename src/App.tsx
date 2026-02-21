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
import { Login } from './components/Login'
import { useBastaoStore } from './store/useBastaoStore'
import { USUARIOS_SISTEMA } from './constants'

function App() {
  const { initRealtime, meuLogin } = useBastaoStore()

  useEffect(() => { initRealtime() }, [])

  if (!meuLogin) return <Login />

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin);
  const isGestor = usuarioLogado?.perfil === 'Gestor';

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <div className="max-w-[1850px] mx-auto pt-2 pb-8">
        <Header />
        
        {isGestor ? (
          <main className="px-4 flex flex-col gap-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <PainelBastao />
              </div>
              
              {/* 👇 GESTOR AGORA TEM O MURAL LOGO ABAIXO DA EQUIPE! */}
              <div className="xl:col-span-1 flex flex-col gap-6">
                <PainelEquipe />
                <PainelMural />
              </div>
            </div>
            
            <PainelGerencial />
          </main>
        ) : (
          <main className="px-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          </main>
        )}

      </div>
    </div>
  )
}
export default App