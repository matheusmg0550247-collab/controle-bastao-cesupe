import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { getEquipe, USUARIOS_SISTEMA } from '../constants'
import { supabase } from '../lib/supabase'

const USUARIO_OPTIONS  = ["Cartório", "Gabinete", "Público Externo", "Interno", "Outros"]
const SISTEMA_OPTIONS  = ["Eproc", "JPE", "PJe", "SEI", "Conveniados", "Outros"]
const CANAL_OPTIONS    = ["Whatsapp", "Telefone", "Presencial", "E-mail", "Outros"]
const DESFECHO_OPTIONS = ["Resolvido - Cesupe", "Encaminhado N2", "Encaminhado N3", "Aguardando Usuário", "Outros"]

// Etapas do modal pós-bastão
type EtapaModal = 'escolha' | 'form_registrar' | 'form_nao_registrar'

export function PainelAcoes() {
  const {
    meuLogin, alvoSelecionado, setAlvoSelecionado,
    passarBastao, toggleTelefone, toggleCafe, toggleSkip, toggleFila,
    updateStatus, filaEproc, filaJpe, statusTexto,
    modalAtendimentoPos, setModalAtendimentoPos
  } = useBastaoStore()

  const [modalAberto, setModalAberto] = useState(false)
  const [modalAlvo, setModalAlvo] = useState('')
  const [loadingAtd, setLoadingAtd] = useState(false)
  const [etapa, setEtapa] = useState<EtapaModal>('escolha')
  const [motivoNaoReg, setMotivoNaoReg] = useState('')

  const hoje = new Date().toISOString().split('T')[0]
  const [atdUsuario,  setAtdUsuario]  = useState('Público Externo')
  const [atdSetor,    setAtdSetor]    = useState('')
  const [atdSistema,  setAtdSistema]  = useState('JPE')
  const [atdDescricao,setAtdDescricao]= useState('')
  const [atdCanal,    setAtdCanal]    = useState('Whatsapp')
  const [atdDesfecho, setAtdDesfecho] = useState('Resolvido - Cesupe')

  const usuarioLogado = USUARIOS_SISTEMA.find(u => u.nome === meuLogin)
  const isSecretaria  = usuarioLogado?.perfil === 'Secretaria' || usuarioLogado?.perfil === 'Gestor'
  const todosNomes    = USUARIOS_SISTEMA.map(u => u.nome).sort()

  const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 bg-gray-50 text-gray-800 text-sm"
  const labelClass = "block text-xs font-bold text-gray-500 mb-1 mt-3"

  // ── helpers ──────────────────────────────────────────────
  const resetAtd = () => {
    setAtdUsuario('Público Externo'); setAtdSetor(''); setAtdSistema('JPE')
    setAtdDescricao(''); setAtdCanal('Whatsapp'); setAtdDesfecho('Resolvido - Cesupe')
    setMotivoNaoReg(''); setEtapa('escolha')
  }

  const fecharModal = () => { resetAtd(); setModalAtendimentoPos(null) }

  // ── atualiza registro_status na rotação ──────────────────
  const atualizarRotacao = async (status: string, extra: object = {}) => {
    if (!modalAtendimentoPos?.rotacaoId) return
    await supabase.from('bastao_rotacoes')
      .update({ registro_status: status, ...extra })
      .eq('id', modalAtendimentoPos.rotacaoId)
  }

  // ── Registrar agora ──────────────────────────────────────
  const handleSalvarAtendimento = async () => {
    if (!atdDescricao.trim()) return alert('Preencha a descrição!')
    if (!modalAtendimentoPos) return
    setLoadingAtd(true)
    try {
      const { data: atd } = await supabase.from('atendimentos_cesupe').insert({
        data: hoje, consultor: modalAtendimentoPos.quemPassou,
        usuario: atdUsuario, nome_setor: atdSetor, sistema: atdSistema,
        descricao: atdDescricao, canal: atdCanal, desfecho: atdDesfecho, resumo: '',
      }).select('id').single()
      await atualizarRotacao('registrado', { atendimento_cesupe_id: atd?.id ?? null })
      alert('Atendimento registrado!')
      fecharModal()
    } catch { alert('Erro ao salvar atendimento.') }
    finally { setLoadingAtd(false) }
  }

  // ── Registrar depois ─────────────────────────────────────
  const handleDepois = async () => {
    await atualizarRotacao('depois')
    fecharModal()
  }

  // ── Não registrar ────────────────────────────────────────
  const handleNaoRegistrar = async () => {
    if (!motivoNaoReg.trim()) return alert('Informe o motivo!')
    setLoadingAtd(true)
    try {
      await atualizarRotacao('nao_registrado', { motivo_nao_registro: motivoNaoReg.trim() })
      fecharModal()
    } catch { alert('Erro ao salvar.') }
    finally { setLoadingAtd(false) }
  }

  // ── Ações do painel ──────────────────────────────────────
  const handleAcaoAuditada = (fn: () => void, nome: string) => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!')
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      if (!window.confirm(`⚠️ AUDITORIA\n\nVocê está aplicando "${nome}" no perfil de ${alvoSelecionado}.\nRegistrado em seu nome (${meuLogin}).\n\nContinuar?`)) return
    }
    fn()
  }

  const handleEntrarSair = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!')
    if (!isSecretaria && meuLogin !== alvoSelecionado) {
      if (!window.confirm(`⚠️ AUDITORIA\n\nAlterando Entrar/Sair de ${alvoSelecionado}.\nRegistrado em seu nome (${meuLogin}).\n\nContinuar?`)) return
    }
    const equipe = getEquipe(alvoSelecionado); if (!equipe) return
    const fila = equipe === 'EPROC' ? filaEproc : filaJpe
    if (fila.includes(alvoSelecionado)) { toggleFila(alvoSelecionado); return }
    const status = statusTexto[alvoSelecionado] || ''
    if (status && status !== 'Indisponivel') { setModalAlvo(alvoSelecionado); setModalAberto(true); return }
    toggleFila(alvoSelecionado)
  }

  const handleEscolhaModal = (escolha: 'bastao' | 'indisponivel') => {
    if (escolha === 'bastao') updateStatus(modalAlvo, '', true)
    else updateStatus(modalAlvo, 'Indisponivel', false)
    setModalAberto(false); setModalAlvo('')
  }

  const handlePassarAuditado = () => {
    if (!alvoSelecionado) return alert('Selecione alguém primeiro!')
    const equipe = getEquipe(alvoSelecionado) as "EPROC" | "JPE"; if (!equipe) return
    const filaAtual = equipe === "EPROC" ? filaEproc : filaJpe
    const dono = filaAtual[0] || null
    if (!isSecretaria && meuLogin !== dono) {
      if (!window.confirm(`⚠️ AUDITORIA\n\nBastão ${equipe} está com ${dono || 'ninguém'}.\nRegistrado em seu nome (${meuLogin}).\n\nContinuar?`)) return
    }
    passarBastao(equipe)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">🎯 Ações do Bastão</h2>

      <div className="mb-6 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
        <label className="block text-sm font-bold text-orange-800 mb-2">Alvo da Ação:</label>
        <div className="flex gap-2">
          <select value={alvoSelecionado || ''} onChange={e => setAlvoSelecionado(e.target.value)} className="flex-1 border-2 rounded-xl p-3 outline-none font-bold text-gray-700 bg-white border-orange-200 focus:border-orange-500">
            <option value="" disabled>Selecione alguém...</option>
            {todosNomes.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={handleEntrarSair} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 rounded-xl shadow-sm active:scale-95 transition-all text-sm whitespace-nowrap">Entrar/Sair</button>
        </div>
        {isSecretaria && <p className="text-[12px] text-green-700 mt-2 font-bold">👑 Acesso de Secretaria/Gestão: Alteração livre.</p>}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => handleAcaoAuditada(() => toggleTelefone(alvoSelecionado!), 'Telefone')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl">📞</button>
        <button onClick={() => handleAcaoAuditada(() => toggleCafe(alvoSelecionado!), 'Café')} className="bg-gray-100 hover:bg-gray-200 py-3 rounded-xl shadow-sm active:scale-95 transition-all text-xl">☕</button>
        <button onClick={handlePassarAuditado} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">🏆 Passar Bastão</button>
        <button onClick={() => handleAcaoAuditada(() => toggleSkip(alvoSelecionado!), 'Pular Vez')} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-2 rounded-xl shadow-sm active:scale-95 transition-all text-sm flex items-center justify-center gap-1">⏩ Pular</button>
      </div>

      {/* ── Modal: Voltar ao Bastão ou Ficar Indisponível ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-black text-gray-800 mb-2 text-center">O que deseja fazer?</h3>
            <p className="text-sm text-gray-500 text-center mb-6"><span className="font-bold text-indigo-600">{modalAlvo}</span> está com status ativo fora da fila.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => handleEscolhaModal('bastao')} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-all">🔄 Voltar ao Bastão</button>
              <button onClick={() => handleEscolhaModal('indisponivel')} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl active:scale-95 transition-all">🚫 Ficar Indisponível</button>
              <button onClick={() => { setModalAberto(false); setModalAlvo('') }} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Atendimento Pós-Bastão ── */}
      {modalAtendimentoPos && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 max-h-[92vh] overflow-y-auto">

            {/* Cabeçalho */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-5 text-white">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <h3 className="text-lg font-black">Bastão passado!</h3>
                  <p className="text-sm text-white/80">
                    <span className="font-bold">{modalAtendimentoPos.quemPassou}</span>
                    {' '}→{' '}
                    <span className="font-bold">{modalAtendimentoPos.quemRecebeu}</span>
                    {' '}({modalAtendimentoPos.equipe})
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* ── ETAPA 1: Escolha ── */}
              {etapa === 'escolha' && (
                <>
                  <p className="text-sm text-gray-600 mb-5 text-center">Houve um atendimento nesta passagem?</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setEtapa('form_registrar')}
                      className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 text-base"
                    >
                      <span className="text-xl">📝</span>
                      <div className="text-left">
                        <div>Registrar agora</div>
                        <div className="text-xs font-normal text-white/80">Preencho os dados do atendimento</div>
                      </div>
                    </button>
                    <button
                      onClick={handleDepois}
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 text-base"
                    >
                      <span className="text-xl">⏳</span>
                      <div className="text-left">
                        <div>Registrar depois</div>
                        <div className="text-xs font-normal text-white/80">Fica pendente em Ferramentas → Atendimentos</div>
                      </div>
                    </button>
                    <button
                      onClick={() => setEtapa('form_nao_registrar')}
                      className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-3 text-base"
                    >
                      <span className="text-xl">🚫</span>
                      <div className="text-left">
                        <div>Não registrar</div>
                        <div className="text-xs font-normal text-white/80">Informar motivo obrigatório</div>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {/* ── ETAPA 2a: Formulário de registro ── */}
              {etapa === 'form_registrar' && (
                <>
                  <button onClick={() => setEtapa('escolha')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">← Voltar</button>
                  <label className={labelClass}>Usuário:</label>
                  <select value={atdUsuario} onChange={e => setAtdUsuario(e.target.value)} className={inputClass}>{USUARIO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                  <label className={labelClass}>Setor:</label>
                  <input type="text" value={atdSetor} onChange={e => setAtdSetor(e.target.value)} className={inputClass} placeholder="Ex: 3ª Vara Cível..." />
                  <label className={labelClass}>Sistema:</label>
                  <select value={atdSistema} onChange={e => setAtdSistema(e.target.value)} className={inputClass}>{SISTEMA_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                  <label className={labelClass}>Descrição: *</label>
                  <input type="text" value={atdDescricao} onChange={e => setAtdDescricao(e.target.value)} className={inputClass} placeholder="Descreva o atendimento..." autoFocus />
                  <label className={labelClass}>Canal:</label>
                  <select value={atdCanal} onChange={e => setAtdCanal(e.target.value)} className={inputClass}>{CANAL_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                  <label className={labelClass}>Desfecho:</label>
                  <select value={atdDesfecho} onChange={e => setAtdDesfecho(e.target.value)} className={inputClass}>{DESFECHO_OPTIONS.map(o => <option key={o}>{o}</option>)}</select>
                  <div className="flex gap-2 mt-5">
                    <button disabled={loadingAtd || !atdDescricao.trim()} onClick={handleSalvarAtendimento} className="flex-[2] bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all">
                      {loadingAtd ? 'Salvando...' : '💾 Salvar Atendimento'}
                    </button>
                    <button onClick={fecharModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">Cancelar</button>
                  </div>
                </>
              )}

              {/* ── ETAPA 2b: Motivo não registrar ── */}
              {etapa === 'form_nao_registrar' && (
                <>
                  <button onClick={() => setEtapa('escolha')} className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1">← Voltar</button>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <p className="text-sm text-red-700 font-bold">Por que não vai registrar este atendimento?</p>
                    <p className="text-xs text-red-500 mt-1">O motivo ficará salvo no histórico para o gestor.</p>
                  </div>
                  <label className={labelClass}>Motivo: *</label>
                  <textarea
                    value={motivoNaoReg}
                    onChange={e => setMotivoNaoReg(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none`}
                    placeholder="Ex: Dúvida rápida sem necessidade de registro, ligação muda, teste..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-5">
                    <button disabled={loadingAtd || !motivoNaoReg.trim()} onClick={handleNaoRegistrar} className="flex-[2] bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition-all">
                      {loadingAtd ? 'Salvando...' : '✅ Confirmar'}
                    </button>
                    <button onClick={fecharModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm">Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
