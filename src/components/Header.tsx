import { useState, useEffect } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

// ╔══════════════════════════════════════════════════════════════╗
// ║  PIXEL ART OFFICE — IDs dos vídeos do YouTube               ║
// ║  Substitua pelos IDs desejados (parte final da URL do YT)   ║
// ╚══════════════════════════════════════════════════════════════╝
const SAURON_YT_ID = 'V4UfAL9f74I'   // 🔴 troque aqui
const TIAMAT_YT_ID = '4ej5yjOqBMI'   // 🐉 troque aqui

// ╔══════════════════════════════════════════════════════════════╗
// ║  ANIVERSARIANTES — adicione as fotos em public/aniversariantes/
// ║  Nomes: Michael.png  Jonatas.png  Glayce.png  Jerry.png
// ║         Leonardo.png  Igor.png  Luiz.png
// ╚══════════════════════════════════════════════════════════════╝
const ANIVERSARIANTES = [
  { apelido: 'Michael',  nome: 'Michael Douglas',    dia: 2,  mes: 3, tema: 'Senna 🏎️',    foto: '/aniversariantes/Michael.png'   },
  { apelido: 'Jonatas',  nome: 'Jonatas',             dia: 13, mes: 3, tema: 'Cruzeiro 💙',  foto: '/aniversariantes/Jonatas.png'   },
  { apelido: 'Glayce',   nome: 'Glayce Torres',       dia: 15, mes: 3, tema: 'Mulan 🌸',     foto: '/aniversariantes/Glayce.png'    },
  { apelido: 'Jerry',    nome: 'Jerry Marcos',         dia: 16, mes: 3, tema: 'MCD 🥃',       foto: '/aniversariantes/Jerry.png'     },
  { apelido: 'Leonardo', nome: 'Leonardo Damaceno',   dia: 17, mes: 3, tema: 'Galoucura 🐓', foto: '/aniversariantes/Leonardo.png'  },
  { apelido: 'Igor',     nome: 'Igor Dayrell',         dia: 21, mes: 3, tema: 'Galo 🐓',      foto: '/aniversariantes/Igor.png'      },
  { apelido: 'Luiz',     nome: 'Luiz Henrique',        dia: 27, mes: 3, tema: 'Moto 🏍️',     foto: '/aniversariantes/Luiz.png'      },
]

function useBirthdayData() {
  const now = new Date()
  const mesAtual = now.getMonth() + 1
  const diaAtual = now.getDate()
  const doMes  = ANIVERSARIANTES.filter(a => a.mes === mesAtual)
  const deHoje = ANIVERSARIANTES.filter(a => a.dia === diaAtual && a.mes === mesAtual)
  return { doMes, deHoje, mesAtual }
}

function BotaoAniversariantes() {
  const [aberto, setAberto] = useState(false)
  const { doMes, deHoje } = useBirthdayData()
  const temHoje = deHoje.length > 0
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  return (
    <>
      <div className="relative flex-shrink-0" title="Aniversariantes do mês">
        {temHoje ? (
          <button onClick={() => setAberto(true)}
            className="relative w-14 h-14 xl:w-16 xl:h-16 rounded-full overflow-visible focus:outline-none">
            <span className="absolute inset-0 rounded-full animate-ping bg-yellow-400 opacity-60 z-0" />
            <span className="absolute inset-[-4px] rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-yellow-300 animate-spin z-0" style={{animationDuration:'2s'}} />
            <img src={deHoje[0].foto} alt={deHoje[0].apelido}
              className="relative z-10 w-full h-full rounded-full object-cover border-4 border-white shadow-xl" />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-black text-yellow-600 bg-white rounded-full px-1.5 py-0.5 shadow z-20">
              🎂 {deHoje[0].apelido}!
            </span>
          </button>
        ) : (
          <button onClick={() => setAberto(true)}
            className="relative w-14 h-14 xl:w-16 xl:h-16 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 border-4 border-white shadow-md hover:scale-110 transition-transform flex items-center justify-center text-2xl">
            🎂
            {doMes.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow">
                {doMes.length}
              </span>
            )}
          </button>
        )}
      </div>

      {aberto && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAberto(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-5 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black">🎂 Aniversariantes</h3>
                <p className="text-sm text-white/70 mt-0.5">{MESES[new Date().getMonth()]} {new Date().getFullYear()}</p>
              </div>
              <button onClick={() => setAberto(false)} className="text-white/70 hover:text-white text-2xl">✕</button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {doMes.length === 0 ? (
                <p className="text-center text-gray-400 py-6">Nenhum aniversariante este mês.</p>
              ) : (
                [...doMes].sort((a,b) => a.dia - b.dia).map(a => {
                  const ehHoje = a.dia === new Date().getDate() && a.mes === new Date().getMonth()+1
                  return (
                    <div key={a.apelido}
                      className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all ${ehHoje ? 'border-yellow-400 bg-yellow-50 shadow-md' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="relative flex-shrink-0">
                        <img src={a.foto} alt={a.apelido}
                          className={`w-16 h-16 rounded-full object-cover border-4 ${ehHoje ? 'border-yellow-400' : 'border-white'} shadow transition-all duration-300 hover:scale-[2.5] hover:z-50 relative cursor-pointer origin-center`} />
                        {ehHoje && <span className="absolute -top-1 -right-1 text-lg animate-bounce">🎉</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-base ${ehHoje ? 'text-yellow-700' : 'text-gray-800'}`}>{a.apelido}</p>
                        <p className="text-xs text-gray-500 font-medium">{a.nome}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{a.tema}</p>
                      </div>
                      <div className={`text-right flex-shrink-0 ${ehHoje ? 'text-yellow-600' : 'text-gray-400'}`}>
                        <p className="text-2xl font-black tabular-nums">{String(a.dia).padStart(2,'0')}</p>
                        <p className="text-[10px] font-bold uppercase">{MESES[a.mes-1]}</p>
                        {ehHoje && <p className="text-[10px] font-black text-yellow-500 animate-pulse">HOJE! 🎂</p>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="px-5 pb-4">
              <p className="text-center text-xs text-gray-400">
                {doMes.length > 0 ? `${doMes.length} aniversariante${doMes.length>1?'s':''} em ${MESES[new Date().getMonth()]}` : 'Sem aniversariantes este mês'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sprite pixel art ──
interface PixelCharData {
  id: string; nome: string; cargo: string; equipe: string; ramal: string
  skin: string; hair: string; shirt: string
  isFemale?: boolean; isBald?: boolean; hasGlasses?: boolean; emoji?: string
}

const PIXEL_CHARS: PixelCharData[] = [
  { id:'matheus',  nome:'Matheus',          cargo:'Coordenador COSINF',       equipe:'Gestão',     ramal:'2664', skin:'#f5c5a3', hair:'#2c1810', shirt:'#4f46e5', hasGlasses:true },
  { id:'gilberto', nome:'Gilberto',          cargo:'Gerente CESUPE',           equipe:'Gestão',     ramal:'2645', skin:'#c68642', hair:'#1a1a1a', shirt:'#4f46e5', isBald:true },
  { id:'juliana',  nome:'Juliana',           cargo:'Gestão de Projetos',       equipe:'Projetos',   ramal:'4209', skin:'#f5c5a3', hair:'#8B4513', shirt:'#0d9488', isFemale:true },
  { id:'brenda',   nome:'Brenda',            cargo:'Secretaria CESUPE',        equipe:'Secretaria', ramal:'2640', skin:'#f5c5a3', hair:'#c41e3a', shirt:'#ec4899', isFemale:true },
  { id:'larissa',  nome:'Larissa',           cargo:'Secretaria CESUPE',        equipe:'Secretaria', ramal:'2661', skin:'#d4956a', hair:'#c41e3a', shirt:'#f472b6', isFemale:true },
  { id:'livia',    nome:'Lívia',             cargo:'Secretaria CESUPE',        equipe:'Secretaria', ramal:'2667', skin:'#f5c5a3', hair:'#8B4513', shirt:'#fda4af', isFemale:true },
  { id:'pablo',    nome:'Pablo Mol',         cargo:'Consultor Eproc / Triagem',equipe:'Eproc',      ramal:'2658', skin:'#f5c5a3', hair:'#1a1a1a', shirt:'#f97316', hasGlasses:true, emoji:'🤓' },
  { id:'leandro',  nome:'Leandro',           cargo:'Consultor JPE / Triagem',  equipe:'JPE',        ramal:'2652', skin:'#c68642', hair:'#2c1810', shirt:'#3b82f6' },
  { id:'ivana',    nome:'Ivana Guimarães',   cargo:'Consultora Eproc',         equipe:'Eproc',      ramal:'2653', skin:'#f5c5a3', hair:'#8B4513', shirt:'#f97316', isFemale:true, emoji:'❤️' },
  { id:'michael',  nome:'Michael Douglas',   cargo:'Consultor Eproc',          equipe:'Eproc',      ramal:'2660', skin:'#4A3728', hair:'#1a1a1a', shirt:'#f97316' },
  { id:'gleis',    nome:'Gleis',             cargo:'Consultora JPE',           equipe:'JPE',        ramal:'4212', skin:'#6B4226', hair:'#1a1a1a', shirt:'#3b82f6', isFemale:true },
  { id:'hugo',     nome:'Hugo Leonardo',     cargo:'Consultor JPE',            equipe:'JPE',        ramal:'4207', skin:'#c68642', hair:'#1a1a1a', shirt:'#3b82f6' },
]

const EQUIPE_COLORS: Record<string, string> = {
  Gestão:'#4f46e5', Projetos:'#0d9488', Secretaria:'#ec4899', Eproc:'#f97316', JPE:'#3b82f6',
}

function PixelSprite({ char, scale = 1 }: { char: PixelCharData; scale?: number }) {
  const w = 14 * scale * 2
  const h = 22 * scale * 2
  return (
    <svg viewBox="0 0 14 22" width={w} height={h} style={{ imageRendering:'pixelated', display:'block' }}>
      {!char.isBald && <rect x={2} y={0} width={10} height={2} fill={char.hair} />}
      {char.isFemale && !char.isBald && <>
        <rect x={1} y={1} width={2} height={7} fill={char.hair} />
        <rect x={11} y={1} width={2} height={7} fill={char.hair} />
      </>}
      <rect x={2} y={1} width={10} height={7} fill={char.skin} />
      <rect x={4} y={3} width={2} height={2} fill="#1a1a1a" />
      <rect x={8} y={3} width={2} height={2} fill="#1a1a1a" />
      {char.hasGlasses && <>
        <rect x={3} y={2} width={4} height={4} fill="none" stroke="#888" strokeWidth="0.8" />
        <rect x={7} y={2} width={4} height={4} fill="none" stroke="#888" strokeWidth="0.8" />
        <rect x={7} y={4} width={1} height={1} fill="#888" />
      </>}
      <rect x={5} y={6} width={4} height={1} fill="#b07060" />
      <rect x={5} y={8} width={4} height={2} fill={char.skin} />
      <rect x={1} y={9} width={12} height={7} fill={char.shirt} />
      <rect x={5} y={9} width={4} height={3} fill="#fff" />
      <rect x={0} y={9} width={1} height={6} fill={char.shirt} />
      <rect x={13} y={9} width={1} height={6} fill={char.shirt} />
      <rect x={0} y={15} width={1} height={2} fill={char.skin} />
      <rect x={13} y={15} width={1} height={2} fill={char.skin} />
      <rect x={2} y={16} width={4} height={6} fill="#1e293b" />
      <rect x={8} y={16} width={4} height={6} fill="#1e293b" />
    </svg>
  )
}

// ── Thumbnail do monitor no header ──
function ThumbnailMonitor({ onClick }: { onClick: () => void }) {
  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setBlink(v => !v), 700)
    return () => clearInterval(t)
  }, [])
  return (
    <button
      onClick={onClick}
      title="🏢 Escritório Pixel Art — CESUPE"
      className="relative flex flex-col items-center gap-0.5 group transition-transform duration-300 hover:scale-110 hover:z-50 origin-top cursor-pointer"
    >
      <div className="rounded-md border-2 border-gray-600 group-hover:border-indigo-400 transition-colors duration-300"
        style={{ background:'#2a2a3a', padding:'3px', width:72, height:56 }}>
        <div className="w-full h-full rounded-sm relative overflow-hidden" style={{ background:'#0a0a18' }}>
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            backgroundImage:'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)',
          }} />
          <img src="/Office.png" alt="Escritório CESUPE" className="w-full h-full object-cover object-top" style={{ imageRendering:'pixelated' }} />
          <div className="absolute top-1 right-1 font-mono" style={{ fontSize:5, color:'#00ff41', opacity: blink ? 1 : 0, transition:'opacity 0.15s' }}>▌</div>
          <div className="absolute inset-0 bg-indigo-400/0 group-hover:bg-indigo-400/10 transition-colors duration-300 rounded-sm" />
        </div>
      </div>
      <div className="w-5 h-1 rounded-sm bg-gray-600 group-hover:bg-indigo-400 transition-colors" />
      <div className="w-8 h-0.5 rounded-full bg-gray-700 group-hover:bg-indigo-500 transition-colors" />
      <p className="text-[8px] font-black tracking-widest text-gray-500 group-hover:text-indigo-400 transition-colors uppercase mt-0.5">PIXEL ART</p>
    </button>
  )
}

// ── Modal principal ──
function PixelOfficeModal({ onClose }: { onClose: () => void }) {


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])


  return (
    <>
      <style>{`
        @keyframes monPulse  { 0%,90%,100%{opacity:1} 95%{opacity:0.2} }
        @keyframes hsPulse   { 0%,100%{opacity:0;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.6;transform:translate(-50%,-50%) scale(1.25)} }
        @keyframes cardIn    { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes balaoIn   { from{opacity:0;transform:translate(-50%,-100%) scale(0.8)} to{opacity:1;transform:translate(-50%,-100%) scale(1)} }
        @keyframes balaoWobble { 0%,100%{transform:translate(-50%,-100%) rotate(-1deg)} 50%{transform:translate(-50%,-100%) rotate(1deg)} }
      `}</style>

      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background:'rgba(0,0,0,0.88)', backdropFilter:'blur(6px)' }}
        onClick={() => onClose()}>

        <div className="relative w-full max-w-7xl rounded-3xl overflow-hidden shadow-2xl"
          style={{ border:'1px solid rgba(99,102,241,0.3)' }}
          onClick={e => e.stopPropagation()}>

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b"
            style={{ background:'linear-gradient(90deg,#0f0c29,#302b63)', borderColor:'rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background:c }} />
                ))}
              </div>
              <span className="text-white font-black tracking-widest text-xs font-mono">🏢 CESUPE — ESCRITÓRIO PIXEL ART</span>
              <span className="bg-green-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">ONLINE</span>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-lg font-bold">✕</button>
          </div>

          {/* Container do jogo pixel art */}
          <div className="relative" style={{ background:'#1a1a2e' }}>
            <iframe
              src="/cesupe_pixel_room.html"
              title="CESUPE · Be More"
              style={{ display:'block', width:'100%', height:'88vh', border:'none' }}
              allow="autoplay"
            />
           </div>
        </div>
      </div>

    </>
  )
}

export function Header() {
  const { meuLogin, setMeuLogin } = useBastaoStore()
  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)

  const perfil = usuarioLogado ? usuarioLogado.perfil : 'Consultor'
  const equipe = usuarioLogado ? usuarioLogado.equipe : 'Eproc'

  const [showDemolay,    setShowDemolay]    = useState(false)
  const [showPixelOffice, setShowPixelOffice] = useState(false)

  let badgeColor = 'bg-blue-100 text-blue-700 border-blue-200'
  let badgeText  = perfil
  if (perfil === 'Secretaria') badgeColor = 'bg-pink-100 text-pink-700 border-pink-200'
  if (perfil === 'Gestor') {
    if (equipe === 'Projetos') { badgeColor = 'bg-teal-100 text-teal-700 border-teal-200'; badgeText = 'Projetos' }
    else badgeColor = 'bg-indigo-100 text-indigo-700 border-indigo-200'
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 mb-6 flex justify-between items-center shadow-sm rounded-b-2xl relative z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Controle Bastão Cesupe 2026 🎭</h1>
          <div className="flex items-center gap-3">
            <video src="/Cesupinho.mp4" autoPlay loop muted playsInline
              className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-white transition-all duration-300 hover:scale-[2.5] hover:z-50 relative cursor-pointer origin-top" />
            <video src="/PugDemolay.mp4" autoPlay loop muted playsInline
              onClick={() => setShowDemolay(true)}
              className="h-16 w-16 xl:h-20 xl:w-20 object-cover rounded-full shadow-md border-4 border-yellow-400 transition-all duration-300 hover:scale-[3.5] hover:z-50 relative cursor-pointer origin-top hover:border-yellow-300 hover:shadow-2xl"
              title="🔱 Clique para saber mais sobre Demolay" />
            {/* 🖥️ Monitor Pixel Art */}
            <ThumbnailMonitor onClick={() => setShowPixelOffice(true)} />
            {/* 🎂 Aniversariantes */}
            <BotaoAniversariantes />
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
        <button onClick={() => { setMeuLogin(''); localStorage.removeItem('@bastao:meuLogin') }}
          className="text-sm font-bold text-red-500 hover:text-red-700 underline underline-offset-4">
          Trocar usuário
        </button>
      </div>

      {/* Modal Demolay */}
      {showDemolay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in"
          onClick={() => setShowDemolay(false)}>
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
              <button onClick={() => setShowDemolay(false)} className="mt-2 bg-red-800 hover:bg-red-900 text-white font-bold px-8 py-3 rounded-xl transition-colors">✝️ Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pixel Office */}
      {showPixelOffice && <PixelOfficeModal onClose={() => setShowPixelOffice(false)} />}
    </header>
  )
}
