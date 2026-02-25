import { create } from 'zustand'
import { getEquipe } from '../constants'
import { supabase } from '../lib/supabase'

interface Indicadores {
  telefone: boolean
  cafe: boolean
}

interface Auditoria {
  ator: string
  acao: string
  data: string
}

export interface MensagemMural {
  id: string
  texto: string
  autor: string
  data: string
  tipo: 'comum' | 'logmein'
}

export interface LogmeinState {
  emUso: boolean
  consultor: string | null
  assumidoEm: string | null
  mensagens: MensagemMural[]
}

interface BastaoState {
  filaEproc: string[]
  filaJpe: string[]
  statusTexto: Record<string, string>
  statusDetalhe: Record<string, string>
  skipFlags: Record<string, boolean>
  quickIndicators: Record<string, Indicadores>
  ultimaAuditoria: Auditoria | null
  meuLogin: string | null
  alvoSelecionado: string | null
  logmein: LogmeinState
  isLogmeinOpen: boolean
  setLogmeinOpen: (open: boolean) => void
  setMeuLogin: (nome: string) => void
  setAlvoSelecionado: (nome: string) => void
  updateStatus: (nome: string, status: string, manterNaFila?: boolean, detalhe?: string) => void
  toggleFila: (nome: string) => void
  toggleTelefone: (nome: string) => void
  toggleCafe: (nome: string) => void
  toggleSkip: (nome: string) => void
  passarBastao: (equipe: 'EPROC' | 'JPE') => void
  assumirLogmein: (alvo: string, ator: string) => void
  liberarLogmein: (alvo: string, ator: string) => void
  pedirLiberacaoLogmein: (deQuem: string, paraQuem: string) => void
  adicionarMensagemMural: (texto: string, tipo: 'comum' | 'logmein', autor: string) => void
  enviarRegistroN8n: (tipo: string, dados: any, mensagemFormatada: string) => Promise<boolean>
  salvarCertidaoSupabase: (payload: any) => Promise<boolean>
  initRealtime: () => void
  _saveToDb: (partialState: Partial<BastaoState>, acaoDesc: string) => void
  _saveLogmeinToDb: (novoLogmein: LogmeinState) => void
}

const TEAM_ID = 2
const LOGMEIN_ID = 1
let realtimeConectado = false

const WEBHOOK_BASTAO = 'https://matheusgomes12.app.n8n.cloud/webhook/b0fe5e6a-7586-4d95-8472-463d84237c09'
const WEBHOOK_REGISTRO = 'https://matheusgomes12.app.n8n.cloud/webhook/c0a19cc9-2167-4824-a9b1-3672288f0841'

async function registrarPassagemBastao(consultor: string, equipe: string) {
  const hoje = new Date().toISOString().split('T')[0]
  try {
    const { data: existente } = await supabase
      .from('daily_logs')
      .select('id, payload')
      .eq('consultor', consultor)
      .eq('date', hoje)
      .eq('source', 'bastao_pass')
      .maybeSingle()

    if (existente) {
      const p = (existente.payload as any) || {}
      await supabase
        .from('daily_logs')
        .update({
          payload: {
            ...p,
            bastoes_assumidos: (p.bastoes_assumidos || 0) + 1,
            equipe,
            ultima_passagem: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
    } else {
      await supabase.from('daily_logs').insert({
        date: hoje,
        consultor,
        source: 'bastao_pass',
        payload: {
          bastoes_assumidos: 1,
          equipe,
          ultima_passagem: new Date().toISOString(),
        },
      })
    }
  } catch (err) {
    console.error('Erro registrar passagem bastão:', err)
  }
}

export const useBastaoStore = create<BastaoState>((set, get) => ({
  filaEproc: [],
  filaJpe: [],
  statusTexto: {},
  statusDetalhe: {},
  skipFlags: {},
  quickIndicators: {},
  ultimaAuditoria: null,
  meuLogin: localStorage.getItem('@bastao:meuLogin'),
  alvoSelecionado: null,
  logmein: { emUso: false, consultor: null, assumidoEm: null, mensagens: [] },
  isLogmeinOpen: false,

  setLogmeinOpen: (open) => set({ isLogmeinOpen: open }),

  setMeuLogin: (nome) => {
    localStorage.setItem('@bastao:meuLogin', nome)
    set({ meuLogin: nome, alvoSelecionado: nome })
  },

  setAlvoSelecionado: (nome) => set({ alvoSelecionado: nome }),

  // ===================== PERSISTÊNCIA =====================

  _saveToDb: async (partialState, acaoDesc) => {
    const state = get()
    const auditoria: Auditoria = {
      ator: state.meuLogin || 'Desconhecido',
      acao: acaoDesc,
      data: new Date().toISOString(),
    }
    const dataToSave = {
      filaEproc: partialState.filaEproc ?? state.filaEproc,
      filaJpe: partialState.filaJpe ?? state.filaJpe,
      statusTexto: partialState.statusTexto ?? state.statusTexto,
      statusDetalhe: partialState.statusDetalhe ?? state.statusDetalhe,
      skipFlags: partialState.skipFlags ?? state.skipFlags,
      quickIndicators: partialState.quickIndicators ?? state.quickIndicators,
      ultimaAuditoria: auditoria,
    }
    set({ ultimaAuditoria: auditoria })
    await supabase.from('app_state').upsert({ id: TEAM_ID, data: dataToSave })
  },

  _saveLogmeinToDb: async (novoLogmein) => {
    set({ logmein: novoLogmein })
    await supabase.from('app_state').upsert({ id: LOGMEIN_ID, data: novoLogmein })
  },

  // ===================== REALTIME =====================

  initRealtime: async () => {
    if (realtimeConectado) return
    realtimeConectado = true

    const sync = async () => {
      const resFila = await supabase.from('app_state').select('data').eq('id', TEAM_ID).single()
      if (resFila.data?.data) {
        const cur = get()
        if (cur.ultimaAuditoria?.data !== resFila.data.data.ultimaAuditoria?.data) {
          const d = resFila.data.data
          set({
            filaEproc: d.filaEproc || [],
            filaJpe: d.filaJpe || [],
            statusTexto: d.statusTexto || {},
            statusDetalhe: d.statusDetalhe || {},
            skipFlags: d.skipFlags || {},
            quickIndicators: d.quickIndicators || {},
            ultimaAuditoria: d.ultimaAuditoria || null,
          })
        }
      }
      const resLm = await supabase.from('app_state').select('data').eq('id', LOGMEIN_ID).single()
      if (resLm.data?.data) {
        const d = resLm.data.data
        set({
          logmein: {
            emUso: d.emUso || false,
            consultor: d.consultor || null,
            assumidoEm: d.assumidoEm || null,
            mensagens: d.mensagens || [],
          },
        })
      }
    }

    await sync()

    supabase
      .channel('painel-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (p: any) => {
        if (!p.new?.data) return
        const d = p.new.data
        if (p.new.id === TEAM_ID) {
          set({
            filaEproc: d.filaEproc || [],
            filaJpe: d.filaJpe || [],
            statusTexto: d.statusTexto || {},
            statusDetalhe: d.statusDetalhe || {},
            skipFlags: d.skipFlags || {},
            quickIndicators: d.quickIndicators || {},
            ultimaAuditoria: d.ultimaAuditoria || null,
          })
        } else if (p.new.id === LOGMEIN_ID) {
          set({
            logmein: {
              emUso: d.emUso || false,
              consultor: d.consultor || null,
              assumidoEm: d.assumidoEm || null,
              mensagens: d.mensagens || [],
            },
          })
        }
      })
      .subscribe()

    setInterval(sync, 3500)
  },

  // ===================== LOGMEIN / MURAL =====================

  adicionarMensagemMural: (texto, tipo, autor) => {
    const state = get()
    const msg: MensagemMural = {
      id: Math.random().toString(36).substring(7),
      texto,
      autor,
      data: new Date().toISOString(),
      tipo,
    }
    get()._saveLogmeinToDb({
      ...state.logmein,
      mensagens: [msg, ...state.logmein.mensagens].slice(0, 100),
    })
  },

  assumirLogmein: (alvo, ator) => {
    const s = get()
    get()._saveLogmeinToDb({
      ...s.logmein,
      emUso: true,
      consultor: alvo,
      assumidoEm: new Date().toISOString(),
    })
    get().adicionarMensagemMural(`${ator} assumiu o LogMeIn.`, 'logmein', ator)
  },

  liberarLogmein: (alvo, ator) => {
    const s = get()
    let t = ''
    if (s.logmein.assumidoEm) {
      const m = Math.max(1, Math.round((Date.now() - new Date(s.logmein.assumidoEm).getTime()) / 60000))
      t = ` (${m} min)`
    }
    get()._saveLogmeinToDb({
      ...s.logmein,
      emUso: false,
      consultor: null,
      assumidoEm: null,
    })
    get().adicionarMensagemMural(`${ator} liberou o LogMeIn.${t}`, 'logmein', ator)
  },

  pedirLiberacaoLogmein: (de, para) => {
    get().adicionarMensagemMural(`⚠️ ${de} solicita a liberação do LogMeIn de ${para}.`, 'logmein', de)
  },

  // ===================== WEBHOOKS / N8N =====================

  enviarRegistroN8n: async (tipo, dados, mensagemFormatada) => {
    const state = get()
    fetch(WEBHOOK_REGISTRO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        consultor: state.meuLogin,
        data_envio: new Date().toISOString(),
        dados,
        message: mensagemFormatada,
        mensagem_formatada: mensagemFormatada,
      }),
    }).catch(() => {})
    return true
  },

  salvarCertidaoSupabase: async (payload) => {
    try {
      const { error } = await supabase.from('certidoes_registro').insert(payload)
      if (error) {
        console.error('Erro certidão:', error)
        return false
      }
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  },

  // ===================== STATUS =====================

  updateStatus: (nome, status, manterNaFila = false, detalhe = '') => {
    const s = get()
    const eq = getEquipe(nome)
    const ns: Partial<BastaoState> = {
      statusTexto: { ...s.statusTexto, [nome]: status },
      statusDetalhe: { ...s.statusDetalhe, [nome]: detalhe },
    }

    if (status === 'Indisponível' || status === '') {
      ns.quickIndicators = { ...s.quickIndicators, [nome]: { telefone: false, cafe: false } }
      ns.skipFlags = { ...s.skipFlags, [nome]: false }
      ns.statusDetalhe = { ...s.statusDetalhe, [nome]: '' }
    }

    if (eq) {
      const fila = eq === 'EPROC' ? s.filaEproc : s.filaJpe
      const nela = fila.includes(nome)
      if (manterNaFila && !nela) {
        if (eq === 'EPROC') ns.filaEproc = [...s.filaEproc, nome]
        else ns.filaJpe = [...s.filaJpe, nome]
      } else if (!manterNaFila && nela) {
        if (eq === 'EPROC') ns.filaEproc = fila.filter((n) => n !== nome)
        else ns.filaJpe = fila.filter((n) => n !== nome)
      }
    }
    set(ns)
    get()._saveToDb(ns, `Status ${nome}: ${status}`)
  },

  // ===================== FILA =====================

  toggleFila: (nome) => {
    const eq = getEquipe(nome)
    if (!eq) return
    const s = get()
    const fila = eq === 'EPROC' ? s.filaEproc : s.filaJpe
    const inQ = fila.includes(nome)
    const nf = inQ ? fila.filter((n) => n !== nome) : [...fila, nome]
    const ns: Partial<BastaoState> = eq === 'EPROC' ? { filaEproc: nf } : { filaJpe: nf }
    ns.statusTexto = { ...s.statusTexto, [nome]: inQ ? 'Indisponível' : '' }
    if (inQ) {
      ns.quickIndicators = { ...s.quickIndicators, [nome]: { telefone: false, cafe: false } }
      ns.skipFlags = { ...s.skipFlags, [nome]: false }
      ns.statusDetalhe = { ...s.statusDetalhe, [nome]: '' }
    }
    set(ns)
    get()._saveToDb(ns, inQ ? `Removeu ${nome}` : `Colocou ${nome}`)
  },

  // ===================== INDICADORES RÁPIDOS =====================

  toggleTelefone: (nome) => {
    const s = get()
    const atual = s.quickIndicators[nome] || { telefone: false, cafe: false }
    const ns = {
      quickIndicators: {
        ...s.quickIndicators,
        [nome]: { ...atual, telefone: !atual.telefone, cafe: false },
      },
    }
    set(ns)
    get()._saveToDb(ns, `Telefone ${nome}`)
  },

  toggleCafe: (nome) => {
    const s = get()
    const atual = s.quickIndicators[nome] || { telefone: false, cafe: false }
    const ns = {
      quickIndicators: {
        ...s.quickIndicators,
        [nome]: { ...atual, cafe: !atual.cafe, telefone: false },
      },
    }
    set(ns)
    get()._saveToDb(ns, `Café ${nome}`)
  },

  toggleSkip: (nome) => {
    const s = get()
    const ns = { skipFlags: { ...s.skipFlags, [nome]: !s.skipFlags[nome] } }
    set(ns)
    get()._saveToDb(ns, `Pular ${nome}`)
  },

  // ===================== PASSAR BASTÃO =====================

  passarBastao: (equipe) => {
    const s = get()
    const fo = equipe === 'EPROC' ? s.filaEproc : s.filaJpe
    if (fo.length <= 1) return

    let nf = [...fo]
    const resp = nf.shift()!
    nf.push(resp)

    let sk = { ...s.skipFlags }
    while (nf.length > 0 && sk[nf[0]]) {
      const p = nf.shift()!
      sk[p] = false
      nf.push(p)
    }

    const ns: Partial<BastaoState> =
      equipe === 'EPROC' ? { filaEproc: nf, skipFlags: sk } : { filaJpe: nf, skipFlags: sk }

    set(ns)
    get()._saveToDb(ns, `Bastão ${equipe}`)

    registrarPassagemBastao(nf[0], equipe)

    fetch(WEBHOOK_BASTAO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        evento: 'bastao_giro',
        team_name: equipe === 'EPROC' ? 'Eproc' : 'Legados',
        com_bastao_agora: nf[0],
        proximos: nf.slice(1),
      }),
    }).catch(() => {})
  },
}))
