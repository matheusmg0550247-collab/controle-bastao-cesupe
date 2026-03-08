import { create } from 'zustand'
import { getEquipe } from '../constants'
import { supabase } from '../lib/supabase'

interface Indicadores { telefone: boolean; cafe: boolean; }
interface Auditoria { ator: string; acao: string; data: string; }
export interface MensagemMural { id: string; texto: string; autor: string; data: string; tipo: 'comum' | 'logmein'; }
export interface LogmeinState { emUso: boolean; consultor: string | null; assumidoEm: string | null; mensagens: MensagemMural[]; }

export interface ModalAtendimentoPos {
  equipe: 'EPROC' | 'JPE'
  quemPassou: string
  quemRecebeu: string
  rotacaoId: number | null
}

export interface ModalAtividade {
  consultor: string
  statusAtual: string
  proximoStatus?: string   // se vier de PainelStatus (troca de status)
  proximoFila?: boolean
  mostrarEscolhaApos?: boolean  // se true, após salvar pergunta: Bastão ou Indisponível?
}

interface BastaoState {
  filaEproc: string[]; filaJpe: string[];
  statusTexto: Record<string, string>; statusDetalhe: Record<string, string>;
  skipFlags: Record<string, boolean>; quickIndicators: Record<string, Indicadores>;
  ultimaAuditoria: Auditoria | null;
  meuLogin: string | null; alvoSelecionado: string | null;
  logmein: LogmeinState;
  isLogmeinOpen: boolean;
  modalAtendimentoPos: ModalAtendimentoPos | null;
  setModalAtendimentoPos: (modal: ModalAtendimentoPos | null) => void;
  modalAtividade: ModalAtividade | null;
  abrirModalAtividade: (dados: ModalAtividade) => void;
  fecharModalAtividade: () => void;
  setLogmeinOpen: (open: boolean) => void;
  setMeuLogin: (nome: string) => void; setAlvoSelecionado: (nome: string) => void;
  updateStatus: (nome: string, status: string, manterNaFila?: boolean, detalhe?: string) => void;
  toggleFila: (nome: string) => void;
  toggleTelefone: (nome: string) => void; toggleCafe: (nome: string) => void; toggleSkip: (nome: string) => void;
  passarBastao: (equipe: "EPROC" | "JPE") => void;
  assumirLogmein: (alvo: string, ator: string) => void;
  liberarLogmein: (alvo: string, ator: string) => void;
  pedirLiberacaoLogmein: (deQuem: string, paraQuem: string) => void;
  adicionarMensagemMural: (texto: string, tipo: 'comum' | 'logmein', autor: string) => void;
  enviarRegistroN8n: (tipo: string, dados: any, mensagemFormatada: string) => Promise<boolean>;
  salvarCertidaoSupabase: (payload: any) => Promise<boolean>;
  initRealtime: () => void;
  _saveToDb: (partialState: Partial<BastaoState>, acaoDesc: string) => void;
  _saveLogmeinToDb: (novoLogmein: LogmeinState) => void;
}

const TEAM_ID = 2; const LOGMEIN_ID = 1; let realtimeConectado = false;

async function registrarRotacaoBastao(equipe: string, deConsultor: string, paraConsultor: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('bastao_rotacoes')
      .insert({ equipe, de_consultor: deConsultor, para_consultor: paraConsultor, data_hora: new Date().toISOString(), registro_status: 'pendente' })
      .select('id').single()
    if (error) throw error
    return data?.id ?? null
  } catch (err) { console.error('Erro ao registrar rotacao:', err); return null; }
}

async function registrarMudancaStatus(consultor: string, novoStatus: string, detalhe: string) {
  const agora = new Date().toISOString(); const hoje = agora.split('T')[0]
  try {
    const { data: aberto } = await supabase.from('registros_status').select('id, inicio').eq('consultor', consultor).is('fim', null).order('inicio', { ascending: false }).limit(1).maybeSingle()
    if (aberto) {
      const durMin = Math.max(0, Math.round((new Date(agora).getTime() - new Date(aberto.inicio).getTime()) / 60000))
      await supabase.from('registros_status').update({ fim: agora, duracao_min: durMin }).eq('id', aberto.id)
    }
    if (novoStatus && novoStatus !== 'Indisponivel') {
      await supabase.from('registros_status').insert({ consultor, status: novoStatus, subtipo: '', detalhes: detalhe || '', inicio: agora, data: hoje })
    }
  } catch (err) { console.error('Erro ao registrar status:', err) }
}

async function registrarPassagemBastao(consultor: string, equipe: string) {
  const hoje = new Date().toISOString().split('T')[0];
  try {
    const { data: existente } = await supabase.from('daily_logs').select('id, payload').eq('consultor', consultor).eq('date', hoje).eq('source', 'bastao_pass').maybeSingle();
    if (existente) {
      const p = (existente.payload as any) || {};
      await supabase.from('daily_logs').update({ payload: { ...p, bastoes_assumidos: (p.bastoes_assumidos || 0) + 1, equipe, ultima_passagem: new Date().toISOString() }, updated_at: new Date().toISOString() }).eq('id', existente.id);
    } else {
      await supabase.from('daily_logs').insert({ date: hoje, consultor, source: 'bastao_pass', payload: { bastoes_assumidos: 1, equipe, ultima_passagem: new Date().toISOString() } });
    }
  } catch (err) { console.error('Erro daily_logs:', err); }
}

export const useBastaoStore = create<BastaoState>((set, get) => ({
  filaEproc: [], filaJpe: [], statusTexto: {}, statusDetalhe: {}, skipFlags: {}, quickIndicators: {}, ultimaAuditoria: null,
  meuLogin: localStorage.getItem('@bastao:meuLogin'), alvoSelecionado: null,
  logmein: { emUso: false, consultor: null, assumidoEm: null, mensagens: [] },
  isLogmeinOpen: false, setLogmeinOpen: (open) => set({ isLogmeinOpen: open }),
  modalAtendimentoPos: null,
  setModalAtendimentoPos: (modal) => set({ modalAtendimentoPos: modal }),
  modalAtividade: null,
  abrirModalAtividade: (dados) => set({ modalAtividade: dados }),
  fecharModalAtividade: () => set({ modalAtividade: null }),
  setMeuLogin: (nome) => { localStorage.setItem('@bastao:meuLogin', nome); set({ meuLogin: nome, alvoSelecionado: nome }); },
  setAlvoSelecionado: (nome) => set({ alvoSelecionado: nome }),

  _saveToDb: async (partialState, acaoDesc) => {
    const state = get(); const auditoria = { ator: state.meuLogin || 'Desconhecido', acao: acaoDesc, data: new Date().toISOString() };
    const dataToSave = { filaEproc: partialState.filaEproc ?? state.filaEproc, filaJpe: partialState.filaJpe ?? state.filaJpe, statusTexto: partialState.statusTexto ?? state.statusTexto, statusDetalhe: partialState.statusDetalhe ?? state.statusDetalhe, skipFlags: partialState.skipFlags ?? state.skipFlags, quickIndicators: partialState.quickIndicators ?? state.quickIndicators, ultimaAuditoria: auditoria };
    set({ ultimaAuditoria: auditoria }); await supabase.from('app_state').upsert({ id: TEAM_ID, data: dataToSave });
  },
  _saveLogmeinToDb: async (novoLogmein) => { set({ logmein: novoLogmein }); await supabase.from('app_state').upsert({ id: LOGMEIN_ID, data: novoLogmein }); },

  initRealtime: async () => {
    if (realtimeConectado) return; realtimeConectado = true;
    const sync = async () => {
      const r = await supabase.from('app_state').select('data').eq('id', TEAM_ID).single();
      if (r.data?.data) { const s = get(); if (s.ultimaAuditoria?.data !== r.data.data.ultimaAuditoria?.data) set({ filaEproc: r.data.data.filaEproc || [], filaJpe: r.data.data.filaJpe || [], statusTexto: r.data.data.statusTexto || {}, statusDetalhe: r.data.data.statusDetalhe || {}, skipFlags: r.data.data.skipFlags || {}, quickIndicators: r.data.data.quickIndicators || {}, ultimaAuditoria: r.data.data.ultimaAuditoria || null }); }
      const rl = await supabase.from('app_state').select('data').eq('id', LOGMEIN_ID).single();
      if (rl.data?.data) set({ logmein: { emUso: rl.data.data.emUso || false, consultor: rl.data.data.consultor || null, assumidoEm: rl.data.data.assumidoEm || null, mensagens: rl.data.data.mensagens || [] } });
    };
    await sync();
    supabase.channel('painel-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (p: any) => {
      if (!p.new?.data) return; const d = p.new.data;
      if (p.new.id === TEAM_ID) set({ filaEproc: d.filaEproc || [], filaJpe: d.filaJpe || [], statusTexto: d.statusTexto || {}, statusDetalhe: d.statusDetalhe || {}, skipFlags: d.skipFlags || {}, quickIndicators: d.quickIndicators || {}, ultimaAuditoria: d.ultimaAuditoria || null });
      else if (p.new.id === LOGMEIN_ID) set({ logmein: { emUso: d.emUso || false, consultor: d.consultor || null, assumidoEm: d.assumidoEm || null, mensagens: d.mensagens || [] } });
    }).subscribe();
    setInterval(sync, 3500);
  },

  adicionarMensagemMural: (texto, tipo, autor) => {
    const state = get(); const msg: MensagemMural = { id: Math.random().toString(36).substring(7), texto, autor, data: new Date().toISOString(), tipo };
    get()._saveLogmeinToDb({ ...state.logmein, mensagens: [msg, ...state.logmein.mensagens].slice(0, 100) });
  },
  enviarRegistroN8n: async (tipo, dados, mensagemFormatada) => {
    try {
      const res = await fetch("https://matheusgomes12.app.n8n.cloud/webhook/c0a19cc9-2167-4824-a9b1-3672288f0841", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, dados, message: mensagemFormatada, consultor: get().meuLogin, timestamp: new Date().toISOString() }) });
      return res.ok;
    } catch { return false; }
  },
  salvarCertidaoSupabase: async (payload) => {
    try { const { error } = await supabase.from('certidoes_registro').insert(payload); return !error; } catch { return false; }
  },
  assumirLogmein: (alvo, ator) => { const s = get(); get()._saveLogmeinToDb({ ...s.logmein, emUso: true, consultor: alvo, assumidoEm: new Date().toISOString() }); get().adicionarMensagemMural(`${ator} assumiu o LogMeIn.`, 'logmein', ator); },
  liberarLogmein: (alvo, ator) => {
    const s = get(); let t = '';
    if (s.logmein.assumidoEm) { const m = Math.max(1, Math.round((Date.now() - new Date(s.logmein.assumidoEm).getTime()) / 60000)); t = ` (${m} min)`; }
    get()._saveLogmeinToDb({ ...s.logmein, emUso: false, consultor: null, assumidoEm: null });
    get().adicionarMensagemMural(`${ator} liberou o LogMeIn.${t}`, 'logmein', ator);
  },
  pedirLiberacaoLogmein: (deQuem, paraQuem) => { get().adicionarMensagemMural(`⚠️ ${deQuem} solicita liberação do LogMeIn de ${paraQuem}.`, 'logmein', deQuem); },

  updateStatus: (nome, status, manterNaFila = false, detalhe = '') => {
    const state = get(); const equipe = getEquipe(nome);
    const newState: Partial<BastaoState> = { statusTexto: { ...state.statusTexto, [nome]: status }, statusDetalhe: { ...state.statusDetalhe, [nome]: detalhe } };
    if (equipe) {
      const fa = equipe === "EPROC" ? state.filaEproc : state.filaJpe; const enf = fa.includes(nome);
      if (manterNaFila && !enf) { if (equipe === "EPROC") newState.filaEproc = [...state.filaEproc, nome]; else newState.filaJpe = [...state.filaJpe, nome]; }
      else if (!manterNaFila && enf) { if (equipe === "EPROC") newState.filaEproc = fa.filter(n => n !== nome); else newState.filaJpe = fa.filter(n => n !== nome); }
    }
    set(newState); get()._saveToDb(newState, `Status ${nome}: ${status}`); registrarMudancaStatus(nome, status, detalhe);
  },
  toggleFila: (nome) => {
    const eq = getEquipe(nome); if (!eq) return; const s = get();
    const fa = eq === "EPROC" ? s.filaEproc : s.filaJpe; const inQ = fa.includes(nome);
    const nf = inQ ? fa.filter(n => n !== nome) : [...fa, nome];
    const ns: Partial<BastaoState> = eq === "EPROC" ? { filaEproc: nf } : { filaJpe: nf };
    ns.statusTexto = { ...s.statusTexto, [nome]: inQ ? 'Indisponivel' : '' };
    set(ns); get()._saveToDb(ns, inQ ? `Removeu ${nome}` : `Colocou ${nome}`);
  },
  toggleTelefone: (nome) => { const s = get(); const a = s.quickIndicators[nome] || { telefone: false, cafe: false }; const ns = { quickIndicators: { ...s.quickIndicators, [nome]: { ...a, telefone: !a.telefone, cafe: false } } }; set(ns); get()._saveToDb(ns, `Telefone ${nome}`); },
  toggleCafe: (nome) => { const s = get(); const a = s.quickIndicators[nome] || { telefone: false, cafe: false }; const ns = { quickIndicators: { ...s.quickIndicators, [nome]: { ...a, cafe: !a.cafe, telefone: false } } }; set(ns); get()._saveToDb(ns, `Cafe ${nome}`); },
  toggleSkip: (nome) => { const s = get(); const ns = { skipFlags: { ...s.skipFlags, [nome]: !s.skipFlags[nome] } }; set(ns); get()._saveToDb(ns, `Skip ${nome}`); },

  passarBastao: (equipe) => {
    const state = get(); const filaOrig = equipe === "EPROC" ? state.filaEproc : state.filaJpe;
    if (filaOrig.length <= 1) return;
    let nf = [...filaOrig]; const resp = nf.shift()!; nf.push(resp);
    let ns2 = { ...state.skipFlags };
    while (nf.length > 0 && ns2[nf[0]]) { const p = nf.shift()!; ns2[p] = false; nf.push(p); }
    const newSt: Partial<BastaoState> = equipe === "EPROC" ? { filaEproc: nf, skipFlags: ns2 } : { filaJpe: nf, skipFlags: ns2 };
    set(newSt); get()._saveToDb(newSt, `Passou bastao ${equipe}`);
    // Registra rotacao e abre modal com ID
    registrarRotacaoBastao(equipe, resp, nf[0]).then(rotacaoId => {
      set({ modalAtendimentoPos: { equipe, quemPassou: resp, quemRecebeu: nf[0], rotacaoId } })
    })
    registrarPassagemBastao(nf[0], equipe);
    fetch("https://matheusgomes12.app.n8n.cloud/webhook/b0fe5e6a-7586-4d95-8472-463d84237c09", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento: "bastao_giro", team_name: equipe === "EPROC" ? "Eproc" : "Legados", com_bastao_agora: nf[0], proximos: nf.slice(1) }) }).catch(() => {});
  }
}))
