import { useState, useEffect, useRef } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { USUARIOS_SISTEMA } from '../constants'

const STATUS_PRESENCIAL = ['Treinamento', 'Reunião', 'Sessão', 'Atend. Presencial']

function formatCron(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
  return `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
}

const STATUS_ICONE: Record<string, string> = {
  'Treinamento': '🎓', 'Reunião': '📅', 'Sessão': '🎙️', 'Atend. Presencial': '🤝',
}

export function PainelStatus() {
  const {
    meuLogin, alvoSelecionado, statusTexto,
    updateStatus, setLogmeinOpen,
    abrirModalAtividade,
  } = useBastaoStore()

  const [modalStatus, setModalStatus]   = useState<string | null>(null)
  const [detalheText, setDetalheText]   = useState('')
  const [manterNaFila, setManterNaFila] = useState(false)

  // Cronômetro ao vivo (só mostra se o alvo está em status presencial)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const inicioRef = useRef<number>(Date.now())
  const [cronSeg, setCronSeg] = useState(0)

  const statusAtualAlvo = alvoSelecionado ? (statusTexto[alvoSelecionado] || '') : ''
  const ePresencial     = STATUS_PRESENCIAL.includes(statusAtualAlvo)

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    setCronSeg(0)
    if (!alvoSelecionado || !ePresencial) return

    // Reinicia contador; o tempo exato vem do ModalAtividadePresencial via Supabase
    inicioRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setCronSeg(Math.floor((Date.now() - inicioRef.current) / 1000))
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [alvoSelecionado, statusAtualAlvo])

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isSecretaria  = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'

  const handleAbrirModal = (novoStatus: string, regraPadraoFila: boolean) => {
    if (!alvoSelecionado) return alert('Selecione alguém no painel de Ações primeiro!')

    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      if (!window.confirm(
        `⚠️ AUDITORIA\n\nVocê está aplicando "${novoStatus}" no perfil de ${alvoSelecionado}.\nRegistrado em seu nome (${meuLogin}).\n\nContinuar?`
      )) return
    }

    // Saindo de status presencial → abre modal global de registro
    if (STATUS_PRESENCIAL.includes(statusAtualAlvo)) {
      abrirModalAtividade({
        consultor:     alvoSelecionado,
        statusAtual:   statusAtualAlvo,
        proximoStatus: novoStatus === 'Almoço' || novoStatus === 'Lanche' ? novoStatus : novoStatus,
        proximoFila:   regraPadraoFila,
      })
      return
    }

    // Almoço e Lanche: direto
    if (novoStatus === 'Almoço' || novoStatus === 'Lanche') {
      updateStatus(alvoSelecionado, novoStatus, false, '')
      return
    }

    setDetalheText('')
    setManterNaFila(regraPadraoFila)
    setModalStatus(novoStatus)
  }

  const handleSalvarStatus = () => {
    if (alvoSelecionado && modalStatus) {
      updateStatus(alvoSelecionado, modalStatus, manterNaFila, detalheText)
      setModalStatus(null)
    }
  }

  const handleAbrirLogmein = () => {
    setLogmeinOpen(true)
    setTimeout(() => { document.getElementById('painel-logmein-section')?.scrollIntoView({ behavior: 'smooth' }) }, 150)
  }

  const btnBase = "border border-gray-200 bg-white hover:bg-gray-50 px-4 py-3 rounded-xl text-sm font-bold text-gray-700 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
  const btnAtivo = (s: string) => statusAtualAlvo === s
    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-300'
    : ''

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">🔄 Status Rápido</h2>

      {/* Cronômetro ao vivo */}
      {alvoSelecionado && ePresencial && (
        <div
          className="mb-4 flex items-center justify-between bg-violet-50 border border-violet-200 rounded-xl px-4 py-2 cursor-pointer hover:bg-violet-100 transition-colors group"
          title="Clique para registrar a atividade"
          onClick={() => abrirModalAtividade({ consultor: alvoSelecionado, statusAtual: statusAtualAlvo, mostrarEscolhaApos: true })}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{STATUS_ICONE[statusAtualAlvo]}</span>
            <span className="text-sm font-bold text-violet-700">{statusAtualAlvo}</span>
            <span className="text-xs text-violet-400">— {alvoSelecionado}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-violet-700 tabular-nums">⏱ {formatCron(cronSeg)}</span>
            <span className="text-xs text-violet-400 group-hover:text-violet-600 transition-colors">📋 registrar</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <button onClick={() => handleAbrirModal('Atividades', true)}          className={`${btnBase} ${btnAtivo('Atividades')}`}>📋 Atividades</button>
        <button onClick={() => handleAbrirModal('Projeto', true)}             className={`${btnBase} ${btnAtivo('Projeto')}`}>🏗️ Projeto</button>
        <button onClick={() => handleAbrirModal('Treinamento', false)}        className={`${btnBase} ${btnAtivo('Treinamento')}`}>🎓 Treinamento</button>
        <button onClick={() => handleAbrirModal('Reunião', false)}            className={`${btnBase} ${btnAtivo('Reunião')}`}>📅 Reunião</button>
        <button onClick={() => handleAbrirModal('Almoço', false)}             className={`${btnBase} ${btnAtivo('Almoço')}`}>🍽️ Almoço</button>
        <button onClick={() => handleAbrirModal('Lanche', false)}             className={`${btnBase} ${btnAtivo('Lanche')}`}>🍔 Lanche</button>
        <button onClick={() => handleAbrirModal('Sessão', false)}             className={`${btnBase} ${btnAtivo('Sessão')}`}>🎙️ Sessão</button>
        <button onClick={() => handleAbrirModal('Atend. Presencial', false)}  className={`${btnBase} ${btnAtivo('Atend. Presencial')}`}>🤝 Presencial</button>
        <button onClick={handleAbrirLogmein} className={`${btnBase} bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100`}>💻 LogMeIn</button>
      </div>

      {/* Modal entrada de status */}
      {modalStatus && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-black text-gray-800 mb-2">Informar detalhes</h3>
            <p className="text-sm text-gray-500 mb-4">Status: <strong className="text-indigo-600">{modalStatus}</strong> para {alvoSelecionado}</p>
            <label className="block text-sm font-bold text-gray-700 mb-1">Qual o detalhe? (Opcional)</label>
            <input
              type="text" value={detalheText} onChange={e => setDetalheText(e.target.value)}
              placeholder="Ex: BNMP, Reunião Diretoria..."
              className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 mb-4"
              autoFocus
            />
            {(modalStatus === 'Projeto' || modalStatus === 'Atividades') && (
              <label className="flex items-center gap-2 mb-6 cursor-pointer bg-gray-50 p-3 rounded-xl border border-gray-200">
                <input type="checkbox" checked={manterNaFila} onChange={e => setManterNaFila(e.target.checked)} className="w-5 h-5 rounded text-indigo-600" />
                <span className="text-sm font-bold text-gray-700">Manter {alvoSelecionado} na fila do Bastão?</span>
              </label>
            )}
            <div className="flex gap-2 mt-2">
              <button onClick={handleSalvarStatus} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl">Salvar Status</button>
              <button onClick={() => setModalStatus(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
