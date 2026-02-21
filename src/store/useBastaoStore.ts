import { create } from 'zustand'
import { getEquipe } from '../constants'
import { supabase } from '../lib/supabase'

interface Indicadores { telefone: boolean; cafe: boolean; }
interface Auditoria { ator: string; acao: string; data: string; }
export interface MensagemMural { id: string; texto: string; autor: string; data: string; tipo: 'comum' | 'logmein'; }
export interface LogmeinState { emUso: boolean; consultor: string | null; assumidoEm: string | null; mensagens: MensagemMural[]; }

interface BastaoState {
  filaEproc: string[]; filaJpe: string[];
  statusTexto: Record<string, string>; statusDetalhe: Record<string, string>;
  skipFlags: Record<string, boolean>; quickIndicators: Record<string, Indicadores>;
  ultimaAuditoria: Auditoria | null;
  meuLogin: string | null; alvoSelecionado: string | null;
  logmein: LogmeinState;
  isLogmeinOpen: boolean;
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
  initRealtime: () => void;
  _saveToDb: (partialState: Partial<BastaoState>, acaoDesc: string) => void;
  _saveLogmeinToDb: (novoLogmein: LogmeinState) => void;
}

const TEAM_ID = 2; const LOGMEIN_ID = 1; let realtimeConectado = false; 

export const useBastaoStore = create<BastaoState>((set, get) => ({
  filaEproc: [], filaJpe: [], statusTexto: {}, statusDetalhe: {}, skipFlags: {}, quickIndicators: {}, ultimaAuditoria: null,
  meuLogin: localStorage.getItem('@bastao:meuLogin'), alvoSelecionado: null,
  logmein: { emUso: false, consultor: null, assumidoEm: null, mensagens: [] },
  isLogmeinOpen: false, setLogmeinOpen: (open) => set({ isLogmeinOpen: open }),
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
    const sincronizarComNuvem = async () => {
      const resFila = await supabase.from('app_state').select('data').eq('id', TEAM_ID).single();
      if (resFila.data?.data) {
        const stateAtual = get();
        if (stateAtual.ultimaAuditoria?.data !== resFila.data.data.ultimaAuditoria?.data) {
          set({ filaEproc: resFila.data.data.filaEproc || [], filaJpe: resFila.data.data.filaJpe || [], statusTexto: resFila.data.data.statusTexto || {}, statusDetalhe: resFila.data.data.statusDetalhe || {}, skipFlags: resFila.data.data.skipFlags || {}, quickIndicators: resFila.data.data.quickIndicators || {}, ultimaAuditoria: resFila.data.data.ultimaAuditoria || null });
        }
      }
      const resLogmein = await supabase.from('app_state').select('data').eq('id', LOGMEIN_ID).single();
      if (resLogmein.data?.data) set({ logmein: { emUso: resLogmein.data.data.emUso || false, consultor: resLogmein.data.data.consultor || null, assumidoEm: resLogmein.data.data.assumidoEm || null, mensagens: resLogmein.data.data.mensagens || [] } });
    };
    await sincronizarComNuvem();
    
    supabase.channel('painel-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (p: any) => {
        if (!p.new?.data) return; 
        const novoDb = p.new.data;
        if (p.new.id === TEAM_ID) set({ filaEproc: novoDb.filaEproc || [], filaJpe: novoDb.filaJpe || [], statusTexto: novoDb.statusTexto || {}, statusDetalhe: novoDb.statusDetalhe || {}, skipFlags: novoDb.skipFlags || {}, quickIndicators: novoDb.quickIndicators || {}, ultimaAuditoria: novoDb.ultimaAuditoria || null });
        else if (p.new.id === LOGMEIN_ID) set({ logmein: { emUso: novoDb.emUso || false, consultor: novoDb.consultor || null, assumidoEm: novoDb.assumidoEm || null, mensagens: novoDb.mensagens || [] } });
    }).subscribe();
    setInterval(sincronizarComNuvem, 3500);
  },

  adicionarMensagemMural: (texto, tipo, autor) => {
    const state = get(); const novaMensagem: MensagemMural = { id: Math.random().toString(36).substring(7), texto, autor, data: new Date().toISOString(), tipo };
    const muralAtualizado = [novaMensagem, ...state.logmein.mensagens].slice(0, 100);
    get()._saveLogmeinToDb({ ...state.logmein, mensagens: muralAtualizado });
  },

  assumirLogmein: (alvo, ator) => { 
    const state = get(); const agora = new Date().toISOString();
    get()._saveLogmeinToDb({ ...state.logmein, emUso: true, consultor: alvo, assumidoEm: agora }); 
    get().adicionarMensagemMural(`${ator} assumiu o LogMeIn.`, 'logmein', ator); 
  },
  liberarLogmein: (alvo, ator) => { 
    const state = get(); let tempoExtra = '';
    if (state.logmein.assumidoEm) {
        const minutos = Math.max(1, Math.round((new Date().getTime() - new Date(state.logmein.assumidoEm).getTime()) / 60000));
        tempoExtra = ` (Tempo de uso: ${minutos} min)`;
    }
    get()._saveLogmeinToDb({ ...state.logmein, emUso: false, consultor: null, assumidoEm: null }); 
    get().adicionarMensagemMural(`${ator} liberou o LogMeIn.${tempoExtra}`, 'logmein', ator); 
  },
  pedirLiberacaoLogmein: (deQuem, paraQuem) => { 
    get().adicionarMensagemMural(`⚠️ ${deQuem} solicita a liberação do LogMeIn de ${paraQuem}.`, 'logmein', deQuem); 
  },

  updateStatus: (nome, status, manterNaFila = false, detalhe = '') => {
    const state = get(); const equipe = getEquipe(nome);
    const newState: Partial<BastaoState> = { statusTexto: { ...state.statusTexto, [nome]: status }, statusDetalhe: { ...state.statusDetalhe, [nome]: detalhe } };
    if (equipe) {
      const filaAtual = equipe === "EPROC" ? state.filaEproc : state.filaJpe;
      const estaNaFila = filaAtual.includes(nome);
      if (manterNaFila && !estaNaFila) {
        if (equipe === "EPROC") newState.filaEproc = [...state.filaEproc, nome];
        else newState.filaJpe = [...state.filaJpe, nome];
      } else if (!manterNaFila && estaNaFila) {
        if (equipe === "EPROC") newState.filaEproc = filaAtual.filter(n => n !== nome);
        else newState.filaJpe = filaAtual.filter(n => n !== nome);
      }
    }
    set(newState); get()._saveToDb(newState, `Alterou status de ${nome} para: ${status}`);
  },

  toggleFila: (nome) => {
    const equipe = getEquipe(nome); if (!equipe) return; const state = get();
    const filaAtual = equipe === "EPROC" ? state.filaEproc : state.filaJpe;
    const inQueue = filaAtual.includes(nome);
    const novaFila = inQueue ? filaAtual.filter(n => n !== nome) : [...filaAtual, nome];
    const newState: Partial<BastaoState> = equipe === "EPROC" ? { filaEproc: novaFila } : { filaJpe: novaFila };
    newState.statusTexto = { ...state.statusTexto, [nome]: inQueue ? 'Indisponível' : '' };
    set(newState); get()._saveToDb(newState, inQueue ? `Removeu ${nome}` : `Colocou ${nome}`);
  },

  toggleTelefone: (nome) => { const state = get(); const atual = state.quickIndicators[nome] || { telefone: false, cafe: false }; const newState = { quickIndicators: { ...state.quickIndicators, [nome]: { ...atual, telefone: !atual.telefone, cafe: false } } }; set(newState); get()._saveToDb(newState, `Telefone ${nome}`); },
  toggleCafe: (nome) => { const state = get(); const atual = state.quickIndicators[nome] || { telefone: false, cafe: false }; const newState = { quickIndicators: { ...state.quickIndicators, [nome]: { ...atual, cafe: !atual.cafe, telefone: false } } }; set(newState); get()._saveToDb(newState, `Café ${nome}`); },
  toggleSkip: (nome) => { const state = get(); const newState = { skipFlags: { ...state.skipFlags, [nome]: !state.skipFlags[nome] } }; set(newState); get()._saveToDb(newState, `Pular ${nome}`); },
  
  passarBastao: (equipe) => {
    const state = get(); const filaOriginal = equipe === "EPROC" ? state.filaEproc : state.filaJpe;
    if (filaOriginal.length <= 1) return;
    let novaFila = [...filaOriginal]; const responsavel = novaFila.shift()!; novaFila.push(responsavel);
    let novasSkips = { ...state.skipFlags };
    while (novaFila.length > 0 && novasSkips[novaFila[0]]) { const pulou = novaFila.shift()!; novasSkips[pulou] = false; novaFila.push(pulou); }
    const newState: Partial<BastaoState> = equipe === "EPROC" ? { filaEproc: novaFila, skipFlags: novasSkips } : { filaJpe: novaFila, skipFlags: novasSkips };
    set(newState); get()._saveToDb(newState, `Passou bastão ${equipe}`);
    
    const payload = { evento: "bastao_giro", team_name: equipe === "EPROC" ? "Eproc" : "Legados", com_bastao_agora: novaFila[0], proximos: novaFila.slice(1) };
    fetch("https://matheusgomes12.app.n8n.cloud/webhook/b0fe5e6a-7586-4d95-8472-463d84237c09", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  }
}))