import { useState, useEffect, useRef } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { supabase } from '../lib/supabase'
import { getEquipe } from '../constants'

const STATUS_ICONE: Record<string, string> = {
  'Treinamento':       '🎓',
  'Reunião':           '📅',
  'Sessão':            '🎙️',
  'Atend. Presencial': '🤝',
}

function horaAtual() {
  return new Date().toTimeString().slice(0, 5)
}

function calcMin(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fim.split(':').map(Number)
  return Math.max(0, (hf * 60 + mf) - (hi * 60 + mi))
}

function formatCron(seg: number): string {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
  return `${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
}

type Etapa = 'form' | 'sucesso' | 'escolha'

export function ModalAtividadePresencial() {
  const { modalAtividade, fecharModalAtividade, updateStatus, filaEproc, filaJpe } = useBastaoStore()

  const [etapa,             setEtapa]             = useState<Etapa>('form')
  const [presData,          setPresData]          = useState('')
  const [presAtividade,     setPresAtividade]      = useState('')
  const [presHoraInicio,    setPresHoraInicio]     = useState('')
  const [presHoraFim,       setPresHoraFim]        = useState('')
  const [presDuracao,       setPresDuracao]        = useState('')
  const [presParticipantes, setPresParticipantes]  = useState('1')
  const [presResumo,        setPresResumo]         = useState('')
  const [loading,           setLoading]            = useState(false)

  const inicioRef = useRef<Date | null>(null)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const [cronSeg, setCronSeg] = useState(0)

  // Ao abrir
  useEffect(() => {
    if (!modalAtividade) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    setEtapa('form')
    const { consultor, statusAtual } = modalAtividade
    const hoje = new Date().toISOString().split('T')[0]
    const fim  = horaAtual()

    setPresData(hoje)
    setPresAtividade(statusAtual)
    setPresHoraFim(fim)
    setPresParticipantes('1')
    setPresResumo('')
    setPresDuracao('')
    setPresHoraInicio('')

    supabase
      .from('registros_status')
      .select('inicio')
      .eq('consultor', consultor)
      .is('fim', null)
      .order('inicio', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const ref = data?.inicio ? new Date(data.inicio) : new Date()
        inicioRef.current = ref
        const horaIni = ref.toTimeString().slice(0, 5)
        setPresHoraInicio(horaIni)
        const dur = calcMin(horaIni, fim)
        setPresDuracao(dur > 0 ? String(dur) : '0')
        if (timerRef.current) clearInterval(timerRef.current)
        setCronSeg(Math.floor((Date.now() - ref.getTime()) / 1000))
        timerRef.current = setInterval(() => {
          setCronSeg(Math.floor((Date.now() - ref.getTime()) / 1000))
        }, 1000)
      })

    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [modalAtividade?.consultor, modalAtividade?.statusAtual])

  if (!modalAtividade) return null

  const { consultor, statusAtual, proximoStatus, proximoFila, mostrarEscolhaApos, avulso } = modalAtividade
  const icone = STATUS_ICONE[statusAtual] || '📋'

  // Verifica se o consultor está em alguma fila (para a tela de escolha)
  const equipe    = getEquipe(consultor)
  const naFila    = equipe === 'EPROC' ? filaEproc.includes(consultor) : filaJpe.includes(consultor)

  const handleEscolha = (opcao: 'bastao' | 'indisponivel') => {
    if (opcao === 'bastao') {
      updateStatus(consultor, '', true, '')   // volta à fila
    } else {
      updateStatus(consultor, 'Indisponível', false, '')
    }
    fecharModalAtividade()
  }

  const handleSalvar = async (pular = false) => {
    setLoading(true)
    try {
      if (!pular) {
        // ── Salva a atividade normalmente ──
        const dur = Number(presDuracao) || calcMin(presHoraInicio, presHoraFim)
        const { error } = await supabase.from('atividades_presenciais').insert({
          data:          presData,
          consultor,
          atividade:     presAtividade,
          hora_inicio:   presHoraInicio,
          hora_fim:      presHoraFim,
          duracao_min:   dur,
          participantes: Number(presParticipantes) || 1,
          resumo:        presResumo.trim() || null,
        })
        if (error) throw error
        setEtapa('sucesso')
        await new Promise(r => setTimeout(r, 1400))
      } else if (!avulso) {
        // ── "Depois" / "Pular registro": grava pendência em atividades_pendentes ──
        // Não cria em bastao_rotacoes (que é só para atendimentos de bastão)
        await supabase.from('atividades_pendentes').insert({
          consultor,
          status_origem: statusAtual || 'Presencial',
          data_hora:     new Date().toISOString(),
          registrado:    false,
        })
      }
    } catch (e) {
      console.error(e)
      if (!pular) alert('❌ Erro ao salvar atividade. O status será atualizado mesmo assim.')
    }

    // ── Aplica o próximo status (veio de PainelStatus) — sempre executa ──
    if (proximoStatus !== undefined) {
      updateStatus(consultor, proximoStatus, proximoFila ?? false, '')
      fecharModalAtividade()
      setLoading(false)
      return
    }

    // ── Avulso: simplesmente fecha ──
    if (avulso) {
      fecharModalAtividade()
      setLoading(false)
      return
    }

    // ── Pular no modo PainelEquipe: mostra escolha ──
    if (pular && mostrarEscolhaApos) {
      setEtapa('escolha')
      setLoading(false)
      return
    }

    // ── Veio de PainelEquipe com flag — mostra escolha ──
    if (mostrarEscolhaApos) {
      setEtapa('escolha')
      setLoading(false)
      return
    }

    fecharModalAtividade()
    setLoading(false)
  }

  const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50 text-gray-800 text-sm"
  const labelClass = "block text-xs font-bold text-gray-500 mb-1"

  return (
    <div className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden relative">

        {/* ── ETAPA: Sucesso ── */}
        {etapa === 'sucesso' && (
          <div className="absolute inset-0 bg-green-600 rounded-2xl flex flex-col items-center justify-center gap-4 z-10">
            <span className="text-7xl">✅</span>
            <p className="text-white font-black text-xl text-center px-4">
              Registro realizado com sucesso!
            </p>
          </div>
        )}

        {/* ── ETAPA: Escolha Bastão ou Indisponível ── */}
        {etapa === 'escolha' && (
          <div className="p-6 flex flex-col gap-4">
            <div className="text-center mb-2">
              <p className="text-sm font-bold text-gray-500">Atividade registrada ✅</p>
              <h3 className="text-xl font-black text-gray-800 mt-1">O que fazer agora?</h3>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-bold text-indigo-600">{consultor}</span> saiu de <span className="font-bold">{statusAtual}</span>
              </p>
            </div>

            <button
              onClick={() => handleEscolha('bastao')}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-5 rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 text-base"
            >
              <span className="text-2xl">🔥</span>
              <div className="text-left">
                <div>Voltar ao Bastão</div>
                <div className="text-xs font-normal text-white/80">Entra na fila de atendimento</div>
              </div>
            </button>

            <button
              onClick={() => handleEscolha('indisponivel')}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-5 rounded-2xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 text-base"
            >
              <span className="text-2xl">🚫</span>
              <div className="text-left">
                <div>Ficar Indisponível</div>
                <div className="text-xs font-normal text-white/80">Não entra na fila agora</div>
              </div>
            </button>

            <button
              onClick={fecharModalAtividade}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm transition-all"
            >
              Fechar sem alterar
            </button>
          </div>
        )}

        {/* ── ETAPA: Formulário ── */}
        {etapa === 'form' && (
          <>
            {/* Cabeçalho */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{icone}</span>
                  <div>
                    <h3 className="text-lg font-black leading-tight">{avulso ? 'Registrar atividade' : 'Registrar atividade'}</h3>
                    <p className="text-sm text-white/80">
                      {consultor}
                      {!avulso && proximoStatus !== undefined && (
                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          → {proximoStatus || 'Disponível'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-xl tabular-nums">⏱ {formatCron(cronSeg)}</div>
                  <div className="text-xs text-white/60">tempo em {statusAtual}</div>
                </div>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelClass}>Data</label>
                <input type="date" value={presData} onChange={e => setPresData(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Atividade</label>
                <input type="text" value={presAtividade} onChange={e => setPresAtividade(e.target.value)} className={inputClass} placeholder="Ex: Sessão 3ª Câmara, Treinamento BNMP..." autoFocus />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Início</label>
                  <input type="time" value={presHoraInicio}
                    onChange={e => { setPresHoraInicio(e.target.value); const d = calcMin(e.target.value, presHoraFim); if (d >= 0) setPresDuracao(String(d)) }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Fim</label>
                  <input type="time" value={presHoraFim}
                    onChange={e => { setPresHoraFim(e.target.value); const d = calcMin(presHoraInicio, e.target.value); if (d >= 0) setPresDuracao(String(d)) }}
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Duração (min)</label>
                  <input type="number" value={presDuracao} onChange={e => setPresDuracao(e.target.value)} className={`${inputClass} font-bold text-violet-700`} min="0" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Participantes</label>
                <input type="number" value={presParticipantes} onChange={e => setPresParticipantes(e.target.value)} className={inputClass} min="1" />
              </div>
              <div>
                <label className={labelClass}>Resumo (opcional)</label>
                <textarea value={presResumo} onChange={e => setPresResumo(e.target.value)} rows={2} className={`${inputClass} resize-none`} placeholder="Observações sobre a atividade..." />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  disabled={loading || !presAtividade.trim()}
                  onClick={() => handleSalvar(false)}
                  className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all"
                >
                  {loading ? 'Salvando...' : '💾 Salvar atividade'}
                </button>
                {/* Avulso: botão Cancelar. Status-change: Pular. Presencial normal: Depois */}
                {avulso ? (
                  <button
                    disabled={loading}
                    onClick={fecharModalAtividade}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm transition-all"
                  >
                    Cancelar
                  </button>
                ) : (
                  <button
                    disabled={loading}
                    onClick={() => handleSalvar(true)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm transition-all"
                  >
                    {proximoStatus !== undefined ? '⏩ Pular registro' : '⏳ Depois'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
