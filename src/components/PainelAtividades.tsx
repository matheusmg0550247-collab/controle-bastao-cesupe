import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
         LabelList, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import { FOTOS_CONSULTORES } from '../data/fotosConsultores';
import { EQUIPE_EPROC, TODOS_CONSULTORES } from '../constants';

// ─── helpers ────────────────────────────────────────────────────────────────
const hoje = () => new Date().toISOString().split('T')[0];
const fmtMins = (m: number) => `${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`;
const parseMins = (t: string): number => {
  if (!t) return 0;
  const s = t.trim().toUpperCase();
  const hm = s.match(/(\d+)\s*H\s*(\d+)/);  if (hm) return parseInt(hm[1])*60+parseInt(hm[2]);
  const mo = s.match(/^(\d+)\s*M$/);          if (mo) return parseInt(mo[1]);
  const col = s.match(/^(\d+):(\d+)$/);       if (col) return parseInt(col[1])*60+parseInt(col[2]);
  return 0;
};
// Calcula minutos de uma atividade presencial:
// 1. usa duracao_min se preenchido
// 2. senão calcula de hora_inicio/hora_fim ("HH:MM" ou "HH:MM:SS")
function calcDuracaoMin(row: any): number {
  if (row.duracao_min && row.duracao_min > 0) return row.duracao_min;
  if (row.hora_inicio && row.hora_fim) {
    const toMin = (t: string) => {
      const parts = t.split(':');
      return parseInt(parts[0]||'0')*60 + parseInt(parts[1]||'0');
    };
    const ini = toMin(row.hora_inicio), fim = toMin(row.hora_fim);
    const diff = fim >= ini ? fim - ini : (fim + 1440) - ini; // passa meia-noite
    return diff > 0 ? diff : 0;
  }
  return 0;
}

function Spinner() {
  return <div className="flex justify-center items-center py-12">
    <div className="w-8 h-8 rounded-full border-4 border-red-500 border-t-transparent animate-spin"/>
  </div>;
}
const CORES = ['#f97316','#3b82f6','#06b6d4','#f59e0b','#ec4899','#14b8a6','#6366f1','#e11d48','#65a30d','#9333ea','#ef4444','#0ea5e9','#84cc16','#f43f5e'];
const ptD = (s:string) => s.split('-').reverse().join('/');

// ─── normalizações ─────────────────────────────────────────────────────────
function normSistema(s: string): string {
  if (!s) return 'N/A';
  const u = s.toUpperCase().trim();
  if (u.includes('EPROC'))   return 'EPROC';
  if (u.includes('JPE') || u.includes('JIPE')) return 'JPE';
  if (u.includes('THEMIS') || u.includes('TOOLS')) return 'Themis';
  if (u.includes('PJE'))     return 'PJE';
  if (u.includes('SIAP'))    return 'SIAP';
  if (u.includes('SEEU'))    return 'SEEU';
  if (u.includes('BNMP'))    return 'BNMP';
  if (u.includes('CONVEN') || u.includes('SNIPER') || u.includes('SISBAJUD') || u.includes('PDPJ')) return 'Conveniados';
  if (u.includes('CESUPE') || u.includes('RH') || u.includes('GERAL') || u.includes('HOMEOFFICE')) return 'Interno/Geral';
  return 'Outros';
}
function normCanal(s: string): string {
  if (!s) return 'N/A';
  const u = s.toLowerCase();
  if (u.includes('whatsapp'))  return 'WhatsApp';
  if (u.includes('email') || u.includes('e-mail')) return 'E-mail';
  if (u.includes('chamado'))   return 'Chamado';
  if (u.includes('presencial')) return 'Presencial';
  if (u.includes('telefone'))  return 'Telefone';
  return 'Outros';
}
function normSetor(usuario: string, nomeSetor?: string): string {
  const u  = (usuario   || '').trim().toUpperCase();
  const ns = (nomeSetor || '').trim().toUpperCase();

  // Classificação primária pelo campo "usuario"
  if (u.includes('CARTÓRIO') || u.includes('CARTORIO')) return '📋 Cartório';
  if (u.includes('EXTERN') || u.includes('ADVOG'))      return '⚖️ Externo';

  // "Gabinete" no usuario já está ok
  if (u.includes('GABIN')) {
    // Assessoria dentro do gabinete ainda é gabinete
    return '🏛️ Gabinete';
  }

  // "Interno" → desambiguar pelo nome_setor
  if (u.includes('INTERN') || u.includes('OUTRO') || u === 'N/A' || u === '') {
    if (/GAB|DES\.|DESEMB|MAGISTR|JUIZ|ASSESSOR|VICE|PRESIDÊN|PRESIDENC/.test(ns)) return '🏛️ Gabinete';
    if (/CARTÓRIO|CARTORIO|CACIV|CACRIM|CÂMARA|CAMARA|VARA|CRIMINAL|CÍVEL|CIVEL|COMARCA/.test(ns)) return '📋 Cartório';
    return '🏢 CESUPE/Interno';
  }

  // Fallback: tentar extrair do nome_setor
  if (/GAB|DES\.|DESEMB|MAGISTR/.test(ns)) return '🏛️ Gabinete';
  if (/CARTÓRIO|CARTORIO|CACIV|CACRIM/.test(ns))  return '📋 Cartório';

  return 'Não informado';
}


function normAtividade(s: string): string {
  if (!s) return 'Outros';
  const u = s.toUpperCase();
  if (u.includes('SESS') || u.includes('JULGAM'))    return 'Sessão de Julgamento';
  if (u.includes('REUNI') || u.includes('ALINH'))    return 'Reunião / Alinhamento';
  if (u.includes('TREIN') || u.startsWith('TRE'))    return 'Treinamento';
  if (u.includes('PRODUC') || u.includes('MATERIAL')) return 'Produção de Material';
  if (u.includes('HML') || u.includes('HOMOLOG') || u.includes('TESTE')) return 'Homologação / Testes';
  if (u.includes('SUPORTE') || u.includes('ATENDIM')) return 'Suporte / Atendimento';
  if (u.includes('SEI') || u.includes('ADMIN'))      return 'Administrativo (SEI/Email)';
  return 'Outros';
}
function normResumo(r: string): string {
  if (!r) return 'Não informado';
  const u = r.trim().toUpperCase();
  if (/^[\d\.,\s]+$/.test(r.trim()) || ['N/A','NULL','NONE','-','','OUTROS','TESTE','SOLICITAÇÃO','SOLICITACAO'].includes(u)) return 'Não informado';
  // Sessão / Julgamento
  if (/SESS[AÃ]O|JULGAM|P[OÓ]S.SESS|PR[EÉ].SESS|VOTO|PAUTA|MINUTA|ACORD[AÃ]O|ACÓ|MONOCR|REDIGIR|REDAÇ|TAQUIG|PAUTAR|TROCA.+RELAT|PERMUTA|SUSTENT|IMPEDIMENT|RETIRAD[AO].DECIS/.test(u)) return 'Sessão / Julgamento';
  // Acesso / Senha
  if (/SENHA|ACESSO|LOGIN|RESET|REDEFIN|REINICIALIZ|RECUPER|NOVA.SENHA|RESETAR|DESBLOQUEIO|PERMISS|GER[AO].+CHAVE|AUTENTI|2FA|LIBERA.+SISTEM|ATIVA.+USU|AUTORIZA.+PAST/.test(u)) return 'Acesso / Senha';
  // Cadastro / Vínculo
  if (/CADASTR|ASSOCIA|DESASSOC|DESCADASTR|REMO.+ESTAGI|REMO.+SERVID|INCLU.+SERVID|INCLU.+PASTA|INCLU.+ESTAGI|INCLU.+PARTES|INCLU.+INTEREST|INCLU.+MASSIV|AUTOCADASTR|NOVO.PERFIL|ATRIBUIÇ|ATRIBUIR|LOTA.+GABIN|INSCRI.+ADV|ATUALIZ.+RH|ATUALIZ.+DAD|VOCALATO|REMO.+SERV/.test(u)) return 'Cadastro / Vínculo';
  // Suporte / Atendimento
  if (/SUPORTE|ATENDIM|RESPOSTA.EMAIL|TRATATIVA|BNMP.REMOTO|ACESSO.REMOTO|PRIMEIRO.CONTATO|CHAMADO|ENCAMINH|BOAS.PR[AÁ]T|MANUAL|CARTILHA|PAINEL|CURSO|ENVIO.MATER|PLANTÃO|PLANTAO|VERIFIC.+JIRA|AUTOMA[CÇ]|IMPLEMENT.+AUTOM|ALINHA.+FLUXO/.test(u)) return 'Suporte / Atendimento';
  // Erro / Sistema
  if (/ERRO|INDISP|PRESO|TRAVAD|QUEDA.INTERNET|GERENCIAL.BRANCO/.test(u)) return 'Erro / Sistema';
  // Documentos / Despachos
  if (/DOCUMENT|LIBERA.+DOC|EXTRAIR|RELAT[OÓ]|EXTRA[CÇ]|ASSINAT|ALVARÁ|ALVARA|JUNTADA|DESPACHO|DESPACHAR|ANEXAR|EDIÇÃO|EDICAO|TIRAR.+EDI|DOWNLOAD|DISPONIB/.test(u)) return 'Documentos / Despachos';
  // Retificação / Autuação
  if (/RETIFIC|CORRE.+ATA|SUBSTITU.+ASSUNTO|VINCUL.+TEMA|VINCUL.+IRDR|VINCUL.+PROCESS|PROCESS.RELACION|PROCESS.DUPLIC|RETORNAR.RASCUNHO|REATIVA.+PROCESS|BAIXA.PROCESS|AUTUA|INSERIR.?ID/.test(u)) return 'Retificação / Autuação';
  // Movimentação / Processos
  if (/REMESSA|MOVIMENT|DISTRIBUI|REMETER|TRANSFERI|TRANSFERÊ|CONCLUIR|CONCLUS[AÃ]O|LANÇAM|LANCAM|LANÇAR|LANCAR|LOCALIZ|ENVIO.PROCESS|VISUALIZ.+PROCESS|PROCESS.URGENT|PROCESS.F[EÉ]RIAS|CONCLUSOS|MIGRAÇ|MIGRAR/.test(u)) return 'Movimentação / Processos';
  // Configuração / Automação
  if (/CONFIGUR|REGRA.AUTOM/.test(u)) return 'Configuração / Automação';
  // Comunicação Processual
  if (/COMUNIC|E.CARTA|CARTA.PRECATÓRIA|CARTA.PRECATORIA|CARTA.ORDEM|ATUA[CÇ].+MP/.test(u)) return 'Comunicação Processual';
  // Protocolo
  if (/PROTOCOL|PETICION/.test(u)) return 'Protocolo / Peticionamento';
  // Certidão
  if (/CERTID/.test(u)) return 'Certidão';
  // Intimação
  if (/INTIMA/.test(u)) return 'Intimação';
  // Recurso / Competência
  if (/RECURSO|AGRAVO|APELA|DECLIN|COMPET/.test(u)) return 'Recurso / Competência';
  // Prazo
  if (/PRAZO/.test(u)) return 'Prazo';
  // Processo Físico
  if (/F[IÍ]SIC|ORIGEM|DESENTRANH/.test(u)) return 'Processo Físico';
  // Alteração / Cancelamento
  if (/ALTER|PROCEDIM|RETIRAR|CANCELAM|EXCLUS[AÃ]O|EXCLUIR|GERENCIAM|GESTÃO.+LOC|GESTAO.+LOC|EVENTO/.test(u)) return 'Alteração / Cancelamento';
  // Dúvida / Treinamento
  if (/D[UÚ]VIDA|TREINAM|ORIENT|CONSULTA$|CONSUL$|VERIFIC/.test(u)) return 'Dúvida / Treinamento';
  // Segredo de Justiça
  if (/SEGREDO|SIGIL/.test(u)) return 'Segredo de Justiça';
  return 'Outros';
}


function normDesfecho(d: string): string {
  const u = (d||'').toUpperCase();
  if (u.includes('RESOLV'))  return 'Resolvido - CESUPE';
  if (u.includes('ESCALON')) return 'Escalonado';
  return 'N/A';
}
// Extrai sistema e tipo de "SISTEMA - Descricao do erro"
// Sem normalização: usa o texto original como está no banco
function parseChatCategoria(cat: string): { sistema: string; tipo: string } {
  if (!cat) return { sistema: 'Geral', tipo: 'Sem categoria' };
  const idx = cat.indexOf(' - ');
  if (idx > 0) {
    return {
      sistema: cat.slice(0, idx).trim(),
      tipo:    cat.slice(idx + 3).trim(),
    };
  }
  return { sistema: 'Geral', tipo: cat.trim() };
}

// ─── períodos ───────────────────────────────────────────────────────────────
const PERIODOS: {id:string; label:string}[] = [
  {id:'semana_atual',    label:'Esta semana'},
  {id:'semana_anterior', label:'Semana anterior'},
  {id:'mes_atual',       label:'Mês atual'},
  {id:'mes_anterior',    label:'Mês anterior'},
  {id:'tres_meses',      label:'Últimos 3 meses'},
  {id:'este_ano',        label:'Este ano'},
  {id:'ano_passado',     label:'Ano passado'},
];
const PERIODO_LABEL: Record<string,string> = Object.fromEntries(PERIODOS.map(p=>[p.id,p.label]));

function getPeriodo(id: string): { dataIni: string; dataFim: string } {
  const now = new Date(), ano = now.getFullYear(), mes = now.getMonth()+1;
  if (id==='semana_atual') {
    const dow=now.getDay(), seg=new Date(now); seg.setDate(now.getDate()-(dow===0?6:dow-1));
    return { dataIni:seg.toISOString().split('T')[0], dataFim:hoje() };
  }
  if (id==='semana_anterior') {
    const dow=now.getDay(), seg=new Date(now); seg.setDate(now.getDate()-(dow===0?6:dow-1)-7);
    const sex=new Date(seg); sex.setDate(seg.getDate()+6);
    return { dataIni:seg.toISOString().split('T')[0], dataFim:sex.toISOString().split('T')[0] };
  }
  if (id==='mes_atual')    return { dataIni:`${ano}-${String(mes).padStart(2,'0')}-01`, dataFim:hoje() };
  if (id==='mes_anterior') { const m2=mes===1?12:mes-1,a2=mes===1?ano-1:ano; return { dataIni:`${a2}-${String(m2).padStart(2,'0')}-01`, dataFim:`${a2}-${String(m2).padStart(2,'0')}-${new Date(a2,m2,0).getDate()}` }; }
  if (id==='este_ano')     return { dataIni:`${ano}-01-01`, dataFim:hoje() };
  if (id==='ano_passado')  return { dataIni:`${ano-1}-01-01`, dataFim:`${ano-1}-12-31` };
  if (id==='tres_meses')   { const d=new Date(); d.setMonth(d.getMonth()-3); return { dataIni:d.toISOString().split('T')[0], dataFim:hoje() }; }
  return { dataIni:`${ano}-${String(mes).padStart(2,'0')}-01`, dataFim:hoje() };
}

function SelectPeriodo({value,onChange}:{value:string;onChange:(v:string)=>void}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-red-400">
      {PERIODOS.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
}

// ─── GrafBar e GrafPie reutilizáveis ──────────────────────────────────────
function GrafBarH({data,titulo,cor,nameKey='name',valueKey='value',maxW=220,onBarClick}:{data:any[];titulo:string;cor:string;nameKey?:string;valueKey?:string;maxW?:number;onBarClick?:(v:string)=>void}) {
  if (!data.length) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-700 mb-3">{titulo}</h3>
      <p className="text-center text-gray-300 text-sm py-8">Sem dados.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-700 mb-3">{titulo}</h3>
      <div style={{height:Math.max(200,data.length*36), minHeight:200}}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{left:8,right:48}}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
            <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
            <YAxis type="category" dataKey={nameKey} width={maxW} tick={{fontSize:11,fontWeight:'bold',fill:'#374151'}} tickFormatter={(v:string)=>v.length>32?v.slice(0,32)+'…':v}/>
            <Tooltip contentStyle={{borderRadius:'12px',fontSize:12}}/>
            <Bar dataKey={valueKey} fill={cor} radius={[0,4,4,0]} maxBarSize={24}
              style={{cursor:onBarClick?'pointer':'default'}}
              onClick={onBarClick?(p:any)=>{if(p&&p[nameKey])onBarClick(p[nameKey]);}:undefined}>
              <LabelList dataKey={valueKey} position="right" style={{fontSize:11,fontWeight:'bold',fill:cor}}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function GrafPieComp({data,titulo,total}:{data:any[];titulo:string;total:number}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-700 mb-3">{titulo} <span className="text-xs font-normal text-gray-400">({total.toLocaleString('pt-BR')})</span></h3>
      <div style={{height:230}}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="42%" cy="50%" outerRadius={82}
              label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>
              {data.map((_:any,i:number)=><Cell key={i} fill={CORES[i%CORES.length]}/>)}
            </Pie>
            <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10}
              formatter={(v:string,e:any)=><span style={{fontSize:11,fontWeight:'bold'}}>{v}: {e.payload.value}</span>}/>
            <Tooltip contentStyle={{borderRadius:'12px',fontSize:12}}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
function MiniBarras({titulo,mapa,cor}:{titulo:string;mapa:Record<string,number>;cor:string}) {
  const rows = Object.entries(mapa).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxV = Math.max(...rows.map(r=>r[1]),1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-xs font-extrabold text-gray-600 mb-3 truncate">{titulo}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map(([nome,qtd])=>(
          <div key={nome} className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-40 shrink-0 truncate font-semibold">{nome}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 rounded-full" style={{width:`${Math.round(qtd/maxV*100)}%`,background:cor}}/>
            </div>
            <span className="text-xs font-extrabold tabular-nums" style={{color:cor}}>{qtd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAINEL CONSULTORES
// ════════════════════════════════════════════════════════════════════════════
const METRICAS = [
  { key:'bastoes',      label:'Bastões',         icon:'🔥', cor:'#f97316' },
  { key:'atendimentos', label:'Atendimentos',     icon:'💬', cor:'#06b6d4' },
  { key:'chat',         label:'Chat',             icon:'💬', cor:'#ec4899' },
  { key:'hp',           label:'HP',               icon:'🎯', cor:'#6366f1' },
  { key:'presencial',   label:'Presencial (qtd)', icon:'🏢', cor:'#65a30d' },
  { key:'certidoes',    label:'Certidões',        icon:'📋', cor:'#e11d48' },
  { key:'horasExtra',   label:'Horas Extras',     icon:'⏰', cor:'#9333ea' },
];
async function buscarConsultor(nome:string, dataIni:string, dataFim:string) {
  const tsI=`${dataIni}T00:00:00`, tsF=`${dataFim}T23:59:59`;
  const [{data:hist},{data:rt},{data:atd},{data:chat},{data:hp},{data:pres},{data:cert},{data:he}] = await Promise.all([
    supabase.from('bastao_historico').select('bastoes').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('bastao_rotacoes').select('id').eq('para_consultor',nome).gte('data_hora',tsI).lte('data_hora',tsF).limit(5000),
    supabase.from('atendimentos_cesupe').select('id').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('dados_chat').select('atendimentos').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('atendimentos_hp').select('id').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('atividades_presenciais').select('duracao_min').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('certidoes_registro').select('id').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
    supabase.from('horas_extras').select('tempo_total').eq('consultor',nome).gte('data',dataIni).lte('data',dataFim).limit(5000),
  ]);
  return {
    bastoes:      (hist?.reduce((s:number,r:any)=>s+(r.bastoes||0),0)??0)+(rt?.length??0),
    atendimentos: atd?.length??0,
    chat:         chat?.reduce((s:number,r:any)=>s+(r.atendimentos||0),0)??0,
    hp:           hp?.length??0,
    presencial:   pres?.length??0,
    certidoes:    cert?.length??0,
    horasExtra:   he?.reduce((s:number,r:any)=>s+parseMins(r.tempo_total),0)??0,
  };
}
export function PainelConsultores({inline=false}:{inline?:boolean}) {
  const [aberto,  setAberto]  = useState(true);
  const [periodo, setPeriodo] = useState('este_ano');
  const [nome1,   setNome1]   = useState(TODOS_CONSULTORES[0]??'');
  const [nome2,   setNome2]   = useState('');
  const [dados1,  setDados1]  = useState<any>(null);
  const [dados2,  setDados2]  = useState<any>(null);
  const [load1,   setLoad1]   = useState(false);
  const [load2,   setLoad2]   = useState(false);
  const {dataIni,dataFim} = getPeriodo(periodo);

  useEffect(()=>{
    if (!nome1) {setDados1(null);return;}
    setLoad1(true);
    buscarConsultor(nome1,dataIni,dataFim).then(d=>{setDados1(d);setLoad1(false);});
  },[nome1,periodo]);
  useEffect(()=>{
    if (!nome2) {setDados2(null);return;}
    setLoad2(true);
    buscarConsultor(nome2,dataIni,dataFim).then(d=>{setDados2(d);setLoad2(false);});
  },[nome2,periodo]);

  const eproc = TODOS_CONSULTORES.filter(n=>EQUIPE_EPROC.includes(n));
  const jpe   = TODOS_CONSULTORES.filter(n=>!EQUIPE_EPROC.includes(n));
  const eq1   = EQUIPE_EPROC.includes(nome1)?'EPROC':'JPE';
  const eq2   = nome2?(EQUIPE_EPROC.includes(nome2)?'EPROC':'JPE'):'';
  const maxG  = dados1?Math.max(...METRICAS.map(m=>Math.max(dados1[m.key]||0,dados2?.[m.key]||0)),1):1;

  const Avatar=({nome,size='lg'}:{nome:string;size?:'sm'|'lg'})=>{
    const foto=FOTOS_CONSULTORES[nome];
    const sz=size==='lg'?'w-16 h-16 text-xl ring-2':'w-8 h-8 text-sm ring-1';
    return foto
      ?<img src={foto} alt={nome} className={`${sz} rounded-full object-cover ring-red-200`}/>
      :<div className={`${sz} rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center text-white font-extrabold ring-gray-200`}>{nome[0]}</div>;
  };
  const SelectConsultor=({value,onChange,exclude,cor}:{value:string;onChange:(v:string)=>void;exclude?:string;cor:string})=>(
    <select value={value} onChange={e=>onChange(e.target.value)}
      className={`border-2 ${cor} rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none w-full`}>
      {!exclude&&<option value="">— nenhum —</option>}
      <optgroup label="── EPROC ──">{eproc.filter(n=>n!==exclude).map(n=><option key={n} value={n}>{n}</option>)}</optgroup>
      <optgroup label="── Legados (JPE) ──">{jpe.filter(n=>n!==exclude).map(n=><option key={n} value={n}>{n}</option>)}</optgroup>
    </select>
  );

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 w-full ${inline?'':'mt-4'}`}>
      <button onClick={()=>setAberto(v=>!v)}
        className="w-full border-b border-gray-100 px-6 py-4 flex flex-wrap gap-4 items-center justify-between hover:bg-gray-50/60 transition-colors text-left">
        <div>
          <h2 className="text-lg font-black text-gray-900">👥 Consultores</h2>
          <p className="text-xs text-gray-400">Selecione para ver métricas e comparar</p>
        </div>
        <div className="flex items-center gap-3">
          {aberto && (
            <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
              <span className="text-xs font-bold text-gray-400">Período:</span>
              <SelectPeriodo value={periodo} onChange={setPeriodo}/>
            </div>
          )}
          <span className={`text-gray-400 transition-transform duration-200 ${aberto?'rotate-180':''}`}>▼</span>
        </div>
      </button>
      {aberto && <div className="p-6 flex flex-col gap-5">
        {/* Seletores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-orange-200 bg-orange-50/30">
            <span className="text-xs font-extrabold text-orange-500 uppercase">Consultor A</span>
            <div className="flex items-center gap-3">
              <Avatar nome={nome1}/>
              <div className="flex flex-col gap-1.5 flex-1">
                <SelectConsultor value={nome1} onChange={setNome1} exclude="" cor="border-orange-300"/>
                <span className={`self-start text-xs font-bold px-2 py-0.5 rounded-full ${eq1==='EPROC'?'bg-orange-100 text-orange-600':'bg-blue-100 text-blue-600'}`}>{eq1}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30">
            <span className="text-xs font-extrabold text-blue-500 uppercase">Consultor B — comparação</span>
            <div className="flex items-center gap-3">
              {nome2?<Avatar nome={nome2}/>:<div className="w-16 h-16 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl text-gray-300">?</div>}
              <div className="flex flex-col gap-1.5 flex-1">
                <SelectConsultor value={nome2} onChange={setNome2} exclude={nome1} cor="border-blue-300"/>
                {eq2&&<span className={`self-start text-xs font-bold px-2 py-0.5 rounded-full ${eq2==='EPROC'?'bg-orange-100 text-orange-600':'bg-blue-100 text-blue-600'}`}>{eq2}</span>}
              </div>
            </div>
          </div>
        </div>
        {/* Métricas */}
        {load1?<Spinner/>:dados1&&(
          <div className="flex flex-col gap-3">
            {METRICAS.map(m=>{
              const v1=dados1?.[m.key]||0, v2=dados2?.[m.key]||0;
              const d1=m.key==='horasExtra'?fmtMins(v1):v1.toLocaleString('pt-BR');
              const d2=m.key==='horasExtra'?fmtMins(v2):v2.toLocaleString('pt-BR');
              const p1=Math.round(v1/maxG*100), p2=Math.round(v2/maxG*100);
              return (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 w-44 shrink-0">{m.icon} {m.label}</span>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-3 rounded-full transition-all duration-700" style={{width:`${p1}%`,background:m.cor}}/>
                    </div>
                    {nome2&&<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full bg-blue-400 opacity-70 transition-all duration-700" style={{width:`${p2}%`}}/>
                    </div>}
                  </div>
                  <div className="flex gap-3 w-28 justify-end">
                    <span className="text-sm font-extrabold tabular-nums" style={{color:m.cor}}>{d1}</span>
                    {nome2&&!load2&&<span className="text-sm font-extrabold tabular-nums text-blue-500">{d2}</span>}
                    {nome2&&load2&&<span className="text-sm text-gray-300">…</span>}
                  </div>
                </div>
              );
            })}
            {nome2&&(
              <div className="flex gap-6 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-400"/><span className="text-xs font-bold text-gray-500">{nome1.split(' ')[0]}</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-full bg-blue-400 opacity-70"/><span className="text-xs font-bold text-blue-400">{nome2.split(' ')[0]}</span></div>
              </div>
            )}
          </div>
        )}
      </div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ABA ERROS — HP (EPROC/Legados) + Chat (por sistema, com prefixo)
// ════════════════════════════════════════════════════════════════════════════
function gerarHtmlErros(
  hpEproc:any[], hpLegados:any[],
  chatPorSistema:Record<string,{tipo:string;qtd:number}[]>,
  periodo:string, dataIni:string, dataFim:string
):string {
  const tabHp=(titulo:string,rows:any[],cor:string)=>`
    <div class="card">
      <h2 style="color:${cor}">${titulo}</h2>
      ${!rows.length?'<p class="vazio">Sem dados para este período.</p>':`
      <table><thead><tr><th>Tipo de Erro</th><th>Qtd</th></tr></thead><tbody>
      ${rows.map((r,i)=>`<tr class="${i%2?'par':''}"><td>${r.cat}</td><td><b>${r.qtd}</b></td></tr>`).join('')}
      </tbody></table>`}
    </div>`;
  const chatSistemas=Object.keys(chatPorSistema).sort();
  const tabChat=chatSistemas.map((sist,si)=>{
    const cor=['#ec4899','#6366f1','#f59e0b','#14b8a6','#9333ea','#06b6d4'][si%6];
    const rows=chatPorSistema[sist];
    return `<div class="card">
      <h2 style="color:${cor}">💬 Chat — ${sist}</h2>
      ${!rows.length?'<p class="vazio">Sem dados.</p>':`
      <table><thead><tr><th>Tipo de Erro</th><th>Qtd</th></tr></thead><tbody>
      ${rows.sort((a,b)=>b.qtd-a.qtd).map((r,i)=>`<tr class="${i%2?'par':''}"><td>${r.tipo}</td><td><b>${r.qtd}</b></td></tr>`).join('')}
      </tbody></table>`}
    </div>`;
  }).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Erros CESUPE — ${PERIODO_LABEL[periodo]||periodo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#f0f2f5;color:#1f2937;padding:24px}
.header{margin-bottom:20px}.logo{font-size:22px;font-weight:900;color:#ef4444}.sub{color:#6b7280;font-size:13px;margin-top:4px}
.filtros{background:#fff;border-radius:14px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:20px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end}
.filtros label{font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;text-transform:uppercase}
.filtros select,.filtros input{border:1.5px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;background:#fff;outline:none}
.secoes{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.sec-btn{padding:6px 16px;border-radius:20px;border:2px solid #e5e7eb;background:#fff;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s}
.sec-btn.ativo{background:#ef4444;color:#fff;border-color:#ef4444}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px}
.card{background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h2{font-size:15px;font-weight:800;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:9px 12px;background:#f9fafb;font-weight:700;color:#6b7280;text-transform:uppercase;font-size:11px;border-bottom:2px solid #e5e7eb}
td{padding:9px 12px;border-bottom:1px solid #f3f4f6} tr.par td{background:#fafafa} tr:hover td{background:#fff7ed}
b{font-weight:800} .vazio{color:#9ca3af;text-align:center;padding:24px 0;font-size:13px}
</style></head><body>
<div class="header">
  <div class="logo">⚠️ CESUPE — Relatório de Erros</div>
  <div class="sub">Período: ${PERIODO_LABEL[periodo]||periodo} &nbsp;|&nbsp; ${ptD(dataIni)} → ${ptD(dataFim)} &nbsp;|&nbsp; Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>
<div class="filtros">
  <div><label>Buscar</label><input id="busca" type="text" placeholder="Filtrar por tipo de erro..." oninput="filtrar()" style="width:260px"></div>
  <div><label>Fonte</label><select id="fonte" onchange="filtrar()">
    <option value="">Todas</option>
    <option value="hp">HP</option>
    <option value="chat">Chat</option>
  </select></div>
</div>
<div class="grid" id="container">
  <div data-fonte="hp">${tabHp('🔥 HP — Erros EPROC',hpEproc,'#f97316')}</div>
  <div data-fonte="hp">${tabHp('🔵 HP — Erros Legados (JPE)',hpLegados,'#3b82f6')}</div>
  <div data-fonte="chat" style="display:contents">${tabChat}</div>
</div>
<script>
function filtrar(){
  var b=document.getElementById('busca').value.toLowerCase();
  var f=document.getElementById('fonte').value;
  document.querySelectorAll('#container > [data-fonte]').forEach(function(el){
    if(f&&el.dataset.fonte!==f){el.style.display='none';return;}
    el.style.display='';
    el.querySelectorAll('tbody tr').forEach(function(tr){
      tr.style.display=(!b||tr.textContent.toLowerCase().includes(b))?'':'none';
    });
  });
}
</script></body></html>`;
}

// ─── Popover de detalhes HP ──────────────────────────────────────────────────
interface PopErroProps {
  tipoErro: string;
  sistema: 'EPROC' | 'Legados';
  periodo: string;
  dataIni: string;
  dataFim: string;
  onClose: () => void;
}
function PopoverErroHP({ tipoErro, sistema, dataIni, dataFim, onClose }: PopErroProps) {
  const [rows, setRows]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('atendimentos_hp')
      .select('data,consultor,sistema,tipo_erro,tempo_solucao_geral_h,tempo_solucao_cesupe_h,tipo_solucao,publico')
      .eq('tipo_erro', tipoErro)
      .gte('data', dataIni).lte('data', dataFim)
      .order('data', { ascending: false })
      .limit(200)
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [tipoErro, dataIni, dataFim]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-extrabold text-gray-900">{tipoErro}</h3>
            <p className="text-xs text-gray-400 mt-0.5">HP — {sistema} &nbsp;·&nbsp; {ptD(dataIni)} → {ptD(dataFim)} &nbsp;·&nbsp; {rows.length} registros</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="overflow-auto flex-1 px-6 py-4">
          {loading ? <Spinner /> : rows.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-100 sticky top-0 bg-white">
                  {['Data','Consultor','Sistema','Tempo Geral','Tempo CESUPE','Tipo Solução','Público'].map(h => (
                    <th key={h} className="text-left pb-2 pr-3 font-extrabold text-gray-400 uppercase text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-orange-50 ${i%2===0?'':'bg-gray-50/40'}`}>
                    <td className="py-2 pr-3 font-semibold text-gray-600 whitespace-nowrap">{ptD(r.data)}</td>
                    <td className="py-2 pr-3 font-bold text-gray-800 whitespace-nowrap">{r.consultor}</td>
                    <td className="py-2 pr-3"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">{r.sistema}</span></td>
                    <td className="py-2 pr-3 text-gray-600">{r.tempo_solucao_geral_h ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.tempo_solucao_cesupe_h ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.tipo_solucao ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.publico ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Popover detalhes Chat ────────────────────────────────────────────────────
function PopoverErroChat({ sistema, tipo, onClose }: { sistema:string; tipo:string; onClose:()=>void }) {
  const [rows, setRows]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Busca todas as categorias do banco e filtra localmente por sistema+tipo
    supabase.from('dados_chat_categorias')
      .select('categoria,quantidade')
      .limit(1000)
      .then(({ data }) => {
        const filtered = (data ?? []).filter(r => {
          const p = parseChatCategoria(r.categoria || '');
          return p.sistema === sistema && p.tipo === tipo;
        });
        setRows(filtered);
        setLoading(false);
      });
  }, [sistema, tipo]);

  const total = rows.reduce((s: number, r: any) => s + (r.quantidade || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-extrabold text-gray-900">{tipo}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Chat — {sistema} &nbsp;·&nbsp; {total} ocorrências acumuladas &nbsp;·&nbsp; {rows.length} categorias originais</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">×</button>
        </div>
        <div className="overflow-auto flex-1 px-6 py-4">
          {loading ? <Spinner /> : rows.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="text-left pb-2 pr-4 font-extrabold text-gray-400 uppercase text-xs">Categoria Original</th>
                  <th className="text-center pb-2 font-extrabold text-pink-500 uppercase text-xs">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {rows.sort((a,b)=>b.quantidade-a.quantidade).map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-pink-50 ${i%2===0?'':'bg-gray-50/40'}`}>
                    <td className="py-2.5 pr-4 text-gray-700 font-semibold">{r.categoria}</td>
                    <td className="py-2.5 text-center font-extrabold text-pink-500">{r.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GrafBarErro clicável ─────────────────────────────────────────────────────
function GrafBarErro({ data, titulo, cor, nameKey='cat', valueKey='qtd', onBarClick }:{
  data:any[]; titulo:string; cor:string; nameKey?:string; valueKey?:string;
  onBarClick:(name:string)=>void;
}) {
  if (!data.length) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-700 mb-3">{titulo}</h3>
      <p className="text-center text-gray-300 text-sm py-8">Sem dados para este período.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-gray-700">{titulo}</h3>
        <span className="text-xs text-gray-400 italic">Clique para ver detalhes</span>
      </div>
      <div style={{ height: Math.max(160, data.length * 38), minHeight: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left:8, right:48 }}
            >
            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
            <XAxis type="number" tick={{ fontSize:11 }} allowDecimals={false}/>
            <YAxis type="category" dataKey={nameKey} width={230}
              tick={{ fontSize:11, fontWeight:'bold', fill:'#374151', cursor:'pointer' }}
              tickFormatter={(v:string) => v.length>32 ? v.slice(0,32)+'…' : v}/>
            <Tooltip contentStyle={{ borderRadius:'12px', fontSize:12 }}
              cursor={{ fill: cor+'22' }}/>
            <Bar dataKey={valueKey} fill={cor} radius={[0,4,4,0]} maxBarSize={24}
              style={{ cursor:'pointer' }}
              onClick={(payload:any) => { if (payload && payload[nameKey]) onBarClick(payload[nameKey]); }}>
              <LabelList dataKey={valueKey} position="right" style={{ fontSize:11, fontWeight:'bold', fill:cor }}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AbaErros() {
  // ── TODOS os hooks no topo ────────────────────────────────────────────────
  const [periodo,   setPeriodo]   = useState('este_ano');
  const [hpEproc,   setHpEproc]   = useState<any[]>([]);
  const [hpLegados, setHpLegados] = useState<any[]>([]);
  const [chatSist,  setChatSist]  = useState<Record<string,Record<string,number>>>({});
  const [loading,   setLoading]   = useState(true);
  const [abaErro,   setAbaErro]   = useState<'hp'|'chat'>('hp');
  const [popHP,     setPopHP]     = useState<{tipoErro:string;sistema:'EPROC'|'Legados'}|null>(null);
  const [popChat,   setPopChat]   = useState<{sistema:string;tipo:string}|null>(null);

  const { dataIni, dataFim } = getPeriodo(periodo);

  useEffect(() => { load(); }, [periodo]);

  async function load() {
    setLoading(true);
    const { data: hp } = await supabase
      .from('atendimentos_hp').select('tipo_erro,sistema')
      .gte('data', dataIni).lte('data', dataFim).limit(10000);
    const { data: chat } = await supabase
      .from('dados_chat_categorias').select('categoria,quantidade').limit(1000);

    // HP → separa por EPROC / Legados
    const em: Record<string,number> = {}, lm: Record<string,number> = {};
    hp?.forEach((r: any) => {
      const k = r.tipo_erro || 'Não informado';
      if ((r.sistema||'').toUpperCase().includes('EPROC')) em[k] = (em[k]||0)+1;
      else lm[k] = (lm[k]||0)+1;
    });
    setHpEproc(Object.entries(em).map(([cat,qtd])=>({cat,qtd})).sort((a,b)=>b.qtd-a.qtd));
    setHpLegados(Object.entries(lm).map(([cat,qtd])=>({cat,qtd})).sort((a,b)=>b.qtd-a.qtd));

    // Chat → separa por sistema (prefixo "SISTEMA - ")
    const cs: Record<string,Record<string,number>> = {};
    (chat ?? []).forEach((r: any) => {
      const { sistema, tipo } = parseChatCategoria(r.categoria||'');
      if (!cs[sistema]) cs[sistema] = {};
      cs[sistema][tipo] = (cs[sistema][tipo]||0) + (r.quantidade||0);
    });
    setChatSist(cs);
    setLoading(false);
  }

  function downloadHtml() {
    const chatParaHtml: Record<string,{tipo:string;qtd:number}[]> = {};
    Object.entries(chatSist).forEach(([sist,mapa]) => {
      chatParaHtml[sist] = Object.entries(mapa).map(([tipo,qtd])=>({tipo,qtd}));
    });
    const html = gerarHtmlErros(hpEproc, hpLegados, chatParaHtml, periodo, dataIni, dataFim);
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `erros-cesupe-${dataIni}-${dataFim}.html`;
    a.click();
  }

  const CHAT_CORES: Record<string,string> = {
    JPE:'#3b82f6', EPROC:'#f97316', PJE:'#14b8a6',
    Geral:'#6366f1', Themis:'#9333ea', SIAP:'#f59e0b'
  };
  const chatSistemas = Object.keys(chatSist).sort();

  if (loading) return <Spinner/>;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={()=>setAbaErro('hp')}
            className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${abaErro==='hp'?'bg-white shadow-sm text-orange-600':'text-gray-500 hover:text-gray-800'}`}>
            🖥️ Erros HP
          </button>
          <button onClick={()=>setAbaErro('chat')}
            className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${abaErro==='chat'?'bg-white shadow-sm text-pink-600':'text-gray-500 hover:text-gray-800'}`}>
            💬 Erros Chat
          </button>
        </div>
        <div className="flex items-center gap-3">
          {abaErro==='hp' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">Período:</span>
              <SelectPeriodo value={periodo} onChange={setPeriodo}/>
            </div>
          )}
          <button onClick={downloadHtml}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-extrabold shadow hover:shadow-lg transition-all">
            ⬇️ Baixar HTML
          </button>
        </div>
      </div>

      {/* ABA HP */}
      {abaErro==='hp' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400 italic">🖱️ Clique em qualquer barra para ver os registros do Supabase.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GrafBarErro data={hpEproc}   titulo="🔥 HP — Erros EPROC"        cor="#f97316"
              onBarClick={t=>setPopHP({tipoErro:t, sistema:'EPROC'})}/>
            <GrafBarErro data={hpLegados} titulo="🔵 HP — Erros Legados (JPE)" cor="#3b82f6"
              onBarClick={t=>setPopHP({tipoErro:t, sistema:'Legados'})}/>
          </div>
        </div>
      )}

      {/* ABA CHAT */}
      {abaErro==='chat' && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-gray-400 italic">📊 Dados acumulados — sem filtro de data. 🖱️ Clique para ver os registros originais.</p>
          {chatSistemas.length === 0
            ? <p className="text-gray-400 text-sm text-center py-10 bg-white rounded-2xl border border-gray-200">Sem dados de chat. Verifique a tabela <b>dados_chat_categorias</b>.</p>
            : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {chatSistemas.map((sist, si) => {
                  const cor = CHAT_CORES[sist] || CORES[si % CORES.length];
                  const dadosChat = Object.entries(chatSist[sist]||{})
                    .map(([cat, qtd]) => ({cat, qtd: qtd as number}))
                    .sort((a,b) => b.qtd - a.qtd);
                  return (
                    <GrafBarErro key={sist} data={dadosChat} titulo={`💬 ${sist}`} cor={cor}
                      onBarClick={t => setPopChat({sistema:sist, tipo:t})}/>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {/* Popovers */}
      {popHP && (
        <PopoverErroHP tipoErro={popHP.tipoErro} sistema={popHP.sistema}
          periodo={periodo} dataIni={dataIni} dataFim={dataFim}
          onClose={()=>setPopHP(null)}/>
      )}
      {popChat && (
        <PopoverErroChat sistema={popChat.sistema} tipo={popChat.tipo}
          onClose={()=>setPopChat(null)}/>
      )}
    </div>
  );
}


function gerarHtmlAtendimentos(
  rows:any[], periodo:string, dataIni:string, dataFim:string
):string {
  const ag=(fn:(r:any)=>string)=>{
    const m:Record<string,number>={};
    rows.forEach(r=>{const k=fn(r)||'N/A'; m[k]=(m[k]||0)+1;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };
  const tabela=(titulo:string, dados:[string,number][], cor:string)=>`
    <div class="card">
      <h2 style="color:${cor}">${titulo}</h2>
      <table><thead><tr><th>Categoria</th><th>Qtd</th></tr></thead><tbody>
      ${dados.map((r,i)=>`<tr class="${i%2?'par':''}"><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('')}
      </tbody></table>
    </div>`;
  // Por assunto/sistema
  const sistMap:Record<string,Record<string,number>>={};
  rows.forEach(r=>{
    const s=normSistema(r.sistema), a=normResumo(r.resumo);
    if(!sistMap[s]) sistMap[s]={};
    sistMap[s][a]=(sistMap[s][a]||0)+1;
  });
  const setorMap:Record<string,Record<string,number>>={};
  rows.forEach(r=>{
    const s=normSetor(r.usuario, r.nome_setor), a=normResumo(r.resumo);
    if(!setorMap[s]) setorMap[s]={};
    setorMap[s][a]=(setorMap[s][a]||0)+1;
  });
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Atendimentos CESUPE — ${PERIODO_LABEL[periodo]||periodo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#f0f2f5;color:#1f2937;padding:24px}
.header{margin-bottom:20px}.logo{font-size:22px;font-weight:900;color:#3b82f6}.sub{color:#6b7280;font-size:13px;margin-top:4px}
.filtros{background:#fff;border-radius:14px;padding:16px 20px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:20px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end}
.filtros label{font-size:11px;font-weight:700;color:#6b7280;display:block;margin-bottom:4px;text-transform:uppercase}
.filtros select,.filtros input{border:1.5px solid #e5e7eb;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;background:#fff;outline:none}
h1{font-size:17px;font-weight:900;margin:20px 0 12px;color:#374151;border-left:4px solid #3b82f6;padding-left:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-bottom:20px}
.card{background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
h2{font-size:14px;font-weight:800;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px 12px;background:#f9fafb;font-weight:700;color:#6b7280;text-transform:uppercase;font-size:11px;border-bottom:2px solid #e5e7eb}
td{padding:8px 12px;border-bottom:1px solid #f3f4f6} tr.par td{background:#fafafa} tr:hover td{background:#eff6ff}
b{font-weight:800}
</style></head><body>
<div class="header">
  <div class="logo">💬 CESUPE — Relatório de Atendimentos</div>
  <div class="sub">Período: ${PERIODO_LABEL[periodo]||periodo} &nbsp;|&nbsp; ${ptD(dataIni)} → ${ptD(dataFim)} &nbsp;|&nbsp; ${rows.length.toLocaleString('pt-BR')} atendimentos &nbsp;|&nbsp; Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>
<div class="filtros">
  <div><label>Buscar</label><input id="busca" type="text" placeholder="Filtrar texto..." oninput="filtrar()" style="width:260px"></div>
  <div><label>Seção</label><select id="secao" onchange="filtrar()">
    <option value="">Todas</option>
    <option value="geral">Geral</option>
    <option value="sistema">Por Sistema</option>
    <option value="setor">Por Setor</option>
  </select></div>
</div>
<h1 data-sec="geral">Visão Geral</h1>
<div class="grid" data-sec="geral">
  ${tabela('💻 Por Sistema',ag(r=>normSistema(r.sistema)),'#f97316')}
  ${tabela('📡 Por Canal',ag(r=>normCanal(r.canal)),'#06b6d4')}
  ${tabela('🏛️ Por Tipo de Setor',ag(r=>normSetor(r.usuario, r.nome_setor)),'#f59e0b')}
  ${tabela('✅ Por Desfecho',ag(r=>normDesfecho(r.desfecho)),'#14b8a6')}
</div>
<h1 data-sec="sistema">Assuntos por Sistema</h1>
<div class="grid" data-sec="sistema">
${Object.entries(sistMap).sort((a,b)=>Object.values(b[1]).reduce((s,v)=>s+v,0)-Object.values(a[1]).reduce((s,v)=>s+v,0)).map(([sist,mapa])=>
  tabela(sist, Object.entries(mapa).sort((a,b)=>b[1]-a[1]), '#6366f1')
).join('')}
</div>
<h1 data-sec="setor">Assuntos por Tipo de Setor</h1>
<div class="grid" data-sec="setor">
${['🏛 Gabinete','📋 Cartório','⚖️ Vara / Juízo','📎 Assessoria'].filter(s=>setorMap[s]).map(setor=>
  tabela(setor, Object.entries(setorMap[setor]||{}).sort((a,b)=>b[1]-a[1]), '#e11d48')
).join('')}
</div>
<script>
function filtrar(){
  var b=document.getElementById('busca').value.toLowerCase();
  var s=document.getElementById('secao').value;
  ['geral','sistema','setor'].forEach(function(sec){
    var show=!s||s===sec;
    document.querySelectorAll('[data-sec="'+sec+'"]').forEach(function(el){
      el.style.display=show?'':'none';
    });
    if(!show) return;
    document.querySelectorAll('[data-sec="'+sec+'"] tbody tr').forEach(function(tr){
      tr.style.display=(!b||tr.textContent.toLowerCase().includes(b))?'':'none';
    });
  });
}
</script></body></html>`;
}


function GrafPieCompClick({data,titulo,total,onSliceClick}:{data:any[];titulo:string;total:number;campo?:string;onSliceClick:(v:string)=>void}) {
  if (!data.length) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-extrabold text-gray-700 mb-3">{titulo}</h3>
      <p className="text-center text-gray-300 text-sm py-8">Sem dados.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-extrabold text-gray-700">{titulo} <span className="text-xs font-normal text-gray-400">({total.toLocaleString('pt-BR')})</span></h3>
        <span className="text-xs text-gray-400 italic">🖱️ Clique para ver</span>
      </div>
      <div style={{height:230,minHeight:230}}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="42%" cy="50%" outerRadius={82}
              label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}
              style={{cursor:'pointer'}}
              onClick={(slice:any)=>{if(slice?.name) onSliceClick(slice.name);}}>
              {data.map((_:any,i:number)=><Cell key={i} fill={CORES[i%CORES.length]}/>)}
            </Pie>
            <Legend layout="vertical" align="right" verticalAlign="middle" iconSize={10}
              formatter={(v:string,e:any)=>(
                <span style={{fontSize:11,fontWeight:'bold',cursor:'pointer'}} onClick={()=>onSliceClick(v)}>
                  {v}: {e.payload.value}
                </span>
              )}/>
            <Tooltip contentStyle={{borderRadius:'12px',fontSize:12}}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Popover Atendimentos ────────────────────────────────────────────────────
interface PopAtdProps {
  titulo: string;
  campo: string;
  valor: string;
  dataIni: string;
  dataFim: string;
  onClose: () => void;
}
function PopoverAtendimento({ titulo, campo, valor, dataIni, dataFim, onClose }: PopAtdProps) {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca,   setBusca]   = useState('');

  useEffect(() => {
    // Busca tudo do período e filtra localmente — mais simples e correto
    supabase.from('atendimentos_cesupe')
      .select('data,consultor,usuario,nome_setor,sistema,canal,descricao,desfecho,resumo')
      .gte('data', dataIni).lte('data', dataFim)
      .order('data', { ascending: false })
      .limit(5000)
      .then(({ data }) => {
        const tudo = data ?? [];
        const result = tudo.filter(r => {
          if (campo === 'sistema')  return normSistema(r.sistema)    === valor;
          if (campo === 'canal')    return normCanal(r.canal)        === valor;
          if (campo === 'setor')    return normSetor(r.usuario, r.nome_setor)   === valor;
          if (campo === 'desfecho') return normDesfecho(r.desfecho)  === valor;
          if (campo === 'resumo')   return normResumo(r.resumo)      === valor;
          return true;
        });
        setRows(result);
        setLoading(false);
      });
  }, [titulo, campo, valor, dataIni, dataFim]);

  const filtrados = busca
    ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(busca.toLowerCase()))
    : rows;

  const COLS = [
    { key:'data',       label:'Data',        fmt:(v:string)=>ptD(v) },
    { key:'consultor',  label:'Consultor',   fmt:(v:string)=>v },
    { key:'nome_setor', label:'Setor',       fmt:(v:string)=>v },
    { key:'sistema',    label:'Sistema',     fmt:(v:string)=>v },
    { key:'canal',      label:'Canal',       fmt:(v:string)=>v },
    { key:'desfecho',   label:'Desfecho',    fmt:(v:string)=>v },
    { key:'resumo',     label:'Resumo',      fmt:(v:string)=>v },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-extrabold text-gray-900 text-lg">{titulo}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {ptD(dataIni)} → {ptD(dataFim)} &nbsp;·&nbsp;
              {loading ? '…' : <><b className="text-blue-500">{filtrados.length}</b> atendimentos</>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-3xl font-bold leading-none">×</button>
        </div>
        {/* Busca */}
        <div className="px-6 py-3 border-b border-gray-50">
          <input value={busca} onChange={e=>setBusca(e.target.value)}
            placeholder="🔍 Buscar em todos os campos..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"/>
        </div>
        {/* Tabela */}
        <div className="overflow-auto flex-1 px-6 py-4">
          {loading ? <Spinner/> : filtrados.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-100 sticky top-0 bg-white z-10">
                  {COLS.map(col => (
                    <th key={col.key} className="text-left pb-2 pr-3 font-extrabold text-gray-400 uppercase text-xs whitespace-nowrap">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                    {COLS.map(col => (
                      <td key={col.key} className="py-2 pr-3 text-gray-700 max-w-xs">
                        <span className="line-clamp-2">{col.fmt(r[col.key]) ?? '—'}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-400">Mostrando até 500 registros</span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-600 transition-all">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function AbaAtendimentos() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('este_ano');
  const [pop,     setPop]     = useState<{titulo:string;campo:string;valor:string}|null>(null);
  const {dataIni,dataFim} = getPeriodo(periodo);

  useEffect(()=>{load();},[periodo]);
  async function load() {
    setLoading(true);
    const {data}=await supabase.from('atendimentos_cesupe')
      .select('sistema,canal,desfecho,nome_setor,usuario,resumo')
      .gte('data',dataIni).lte('data',dataFim).limit(50000);
    setRows(data??[]);
    setLoading(false);
  }
  const abrirPop = (titulo:string, campo:string, valor:string) => setPop({titulo, campo, valor});

  const total=rows.length;
  const ag=(fn:(r:any)=>string,top=10)=>{
    const m:Record<string,number>={};
    rows.forEach(r=>{const k=fn(r)||'N/A'; m[k]=(m[k]||0)+1;});
    return Object.entries(m).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value).slice(0,top);
  };

  // Assuntos por sistema
  const sistMap:Record<string,Record<string,number>>={};
  rows.forEach(r=>{
    const s=normSistema(r.sistema), a=normResumo(r.resumo);
    if(!sistMap[s]) sistMap[s]={};
    sistMap[s][a]=(sistMap[s][a]||0)+1;
  });
  const topSistemas=Object.entries(sistMap).sort((a,b)=>Object.values(b[1]).reduce((s,v)=>s+v,0)-Object.values(a[1]).reduce((s,v)=>s+v,0)).slice(0,6).map(e=>e[0]);

  // Assuntos por setor
  const setorMap:Record<string,Record<string,number>>={};
  rows.forEach(r=>{
    const s=normSetor(r.usuario, r.nome_setor), a=normResumo(r.resumo);
    if(!setorMap[s]) setorMap[s]={};
    setorMap[s][a]=(setorMap[s][a]||0)+1;
  });

  function downloadHtml() {
    const html=gerarHtmlAtendimentos(rows,periodo,dataIni,dataFim);
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`atendimentos-cesupe-${dataIni}-${dataFim}.html`; a.click();
  }

  if (loading) return <Spinner/>;

  const SIST_CORES:Record<string,string>={EPROC:'#f97316',JPE:'#3b82f6',Themis:'#9333ea',PJE:'#14b8a6',SIAP:'#f59e0b','Interno/Geral':'#6366f1'};
  const SETOR_CORES:Record<string,string>={'🏛 Gabinete':'#e11d48','📋 Cartório':'#f59e0b','⚖️ Vara / Juízo':'#06b6d4','📎 Assessoria':'#65a30d'};

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">Período:</span>
          <SelectPeriodo value={periodo} onChange={setPeriodo}/>
        </div>
        <button onClick={downloadHtml}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-blue-700 text-white text-sm font-extrabold shadow hover:shadow-lg transition-all">
          ⬇️ Baixar HTML com Filtros
        </button>
      </div>

      {/* Visão geral */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GrafPieCompClick data={ag(r=>normSistema(r.sistema))} titulo="💻 Por Sistema" total={total} campo="sistema" onSliceClick={(v)=>abrirPop(`💻 Sistema: ${v}`,"sistema",v)}/>
        <GrafPieCompClick data={ag(r=>normCanal(r.canal))} titulo="📡 Por Canal" total={total} campo="canal" onSliceClick={(v)=>abrirPop(`📡 Canal: ${v}`,"canal",v)}/>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GrafBarH data={ag(r=>normSetor(r.usuario, r.nome_setor))} titulo="🏛️ Por Tipo de Setor" cor="#f59e0b" onBarClick={(v)=>abrirPop(`🏛️ Setor: ${v}`,"setor",v)}/>
        <GrafBarH data={ag(r=>normDesfecho(r.desfecho))} titulo="✅ Por Desfecho" cor="#14b8a6" onBarClick={(v)=>abrirPop(`✅ Desfecho: ${v}`,"desfecho",v)}/>
      </div>

      {/* Assuntos por Sistema */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-700 mb-4">📝 Assuntos por Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {topSistemas.map(sist=>(
            <MiniBarras key={sist} titulo={sist} mapa={sistMap[sist]||{}} cor={SIST_CORES[sist]||'#6366f1'}/>
          ))}
        </div>
      </div>

      {/* Assuntos por Setor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-700 mb-4">🏛️ Assuntos por Tipo de Setor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {['🏛 Gabinete','📋 Cartório','⚖️ Vara / Juízo','📎 Assessoria'].filter(s=>setorMap[s]).map(setor=>(
            <MiniBarras key={setor} titulo={setor} mapa={setorMap[setor]||{}} cor={SETOR_CORES[setor]||'#6366f1'}/>
          ))}
        </div>
      </div>
      {pop && (
        <PopoverAtendimento
          titulo={pop.titulo} campo={pop.campo} valor={pop.valor}
          dataIni={dataIni} dataFim={dataFim}
          onClose={()=>setPop(null)}/>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ABA PRESENCIAL
// ════════════════════════════════════════════════════════════════════════════
function AbaPresencial() {
  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('este_ano');
  const {dataIni,dataFim} = getPeriodo(periodo);

  useEffect(()=>{load();},[periodo]);
  async function load() {
    setLoading(true);
    const {data}=await supabase.from('atividades_presenciais')
      .select('consultor,atividade,duracao_min,hora_inicio,hora_fim,data')
      .gte('data',dataIni).lte('data',dataFim).limit(10000);
    setRows(data??[]);
    setLoading(false);
  }

  const porTipo:Record<string,{qtd:number;mins:number;comHora:number}>={};
  rows.forEach(r=>{
    const k=normAtividade(r.atividade);
    if(!porTipo[k]) porTipo[k]={qtd:0,mins:0,comHora:0};
    porTipo[k].qtd++;
    const dm=calcDuracaoMin(r);
    if(dm>0){ porTipo[k].mins+=dm; porTipo[k].comHora++; }
  });
  const tipoData=Object.entries(porTipo).map(([name,v])=>({name,...v})).sort((a,b)=>b.qtd-a.qtd);
  const totalComHora=rows.filter(r=>calcDuracaoMin(r)>0).length;
  const pctComHora=rows.length>0?Math.round(totalComHora/rows.length*100):0;
  const porEq:{[k:string]:{qtd:number;mins:number}}={EPROC:{qtd:0,mins:0},JPE:{qtd:0,mins:0}};
  rows.forEach(r=>{
    const eq=EQUIPE_EPROC.includes(r.consultor)?'EPROC':'JPE';
    porEq[eq].qtd++;
    const dm2=calcDuracaoMin(r); if(dm2>0) porEq[eq].mins+=dm2;
  });

  if (loading) return <Spinner/>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">Período:</span>
          <SelectPeriodo value={periodo} onChange={setPeriodo}/>
        </div>
        {pctComHora<100&&(
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-600 text-xs font-bold">⚠️ Duração preenchida em {pctComHora}% dos registros ({totalComHora}/{rows.length})</span>
          </div>
        )}
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          {label:'EPROC — Atividades',value:porEq.EPROC.qtd,sub:`${fmtMins(porEq.EPROC.mins)} registrado`,from:'from-orange-400',to:'to-orange-600'},
          {label:'EPROC — Horas',value:fmtMins(porEq.EPROC.mins),sub:'duração registrada',from:'from-amber-400',to:'to-amber-500'},
          {label:'JPE — Atividades',value:porEq.JPE.qtd,sub:`${fmtMins(porEq.JPE.mins)} registrado`,from:'from-blue-500',to:'to-blue-700'},
          {label:'JPE — Horas',value:fmtMins(porEq.JPE.mins),sub:'duração registrada',from:'from-blue-300',to:'to-cyan-500'},
        ] as any[]).map(k=>(
          <div key={k.label} className={`rounded-2xl bg-gradient-to-br ${k.from} ${k.to} p-4 text-white shadow-md`}>
            <p className="text-xs font-extrabold uppercase opacity-80 mb-1">{k.label}</p>
            <p className="text-2xl font-black">{typeof k.value==='number'?k.value.toLocaleString('pt-BR'):k.value}</p>
            <p className="text-xs opacity-75 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>
      {/* Gráfico contagem */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-extrabold text-gray-700">🏢 Tipos de Atividades — Contagem</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{rows.length} registros</span>
        </div>
        <div style={{height:Math.max(220,tipoData.length*42)}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tipoData} layout="vertical" margin={{left:8,right:56}}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
              <XAxis type="number" tick={{fontSize:11}} allowDecimals={false}/>
              <YAxis type="category" dataKey="name" width={215} tick={{fontSize:11,fontWeight:'bold',fill:'#374151'}}/>
              <Tooltip contentStyle={{borderRadius:'12px',fontSize:12}} formatter={(v:any)=>[`${v} atividades`,'Quantidade']}/>
              <Bar dataKey="qtd" fill="#f59e0b" radius={[0,4,4,0]} maxBarSize={28}>
                <LabelList dataKey="qtd" position="right" style={{fontSize:12,fontWeight:'bold',fill:'#d97706'}}/>
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Tabela detalhada */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-extrabold text-gray-700 mb-3">📋 Detalhamento por Tipo</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b-2 border-gray-100">
            <th className="text-left pb-2 pr-4 text-xs font-extrabold text-gray-400 uppercase">Tipo</th>
            <th className="text-center pb-2 px-3 text-xs font-extrabold text-amber-500 uppercase">Atividades</th>
            <th className="text-center pb-2 px-3 text-xs font-extrabold text-orange-500 uppercase">Horas registradas</th>
            <th className="text-center pb-2 px-3 text-xs font-extrabold text-gray-300 uppercase">Com duração</th>
            <th className="text-center pb-2 px-3 text-xs font-extrabold text-gray-400 uppercase">Média/ativ.</th>
          </tr></thead>
          <tbody>
            {tipoData.map((r,i)=>{
              const avg=r.comHora>0?Math.round(r.mins/r.comHora):0;
              const pct=r.qtd>0?Math.round(r.comHora/r.qtd*100):0;
              return (
                <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                  <td className="py-2.5 pr-4 font-bold text-gray-700">{r.name}</td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-amber-600">{r.qtd}</td>
                  <td className="py-2.5 px-3 text-center font-extrabold text-orange-500">{fmtMins(r.mins)}</td>
                  <td className="py-2.5 px-3 text-center text-gray-300 text-xs">{r.comHora} ({pct}%)</td>
                  <td className="py-2.5 px-3 text-center text-gray-500 font-semibold">{avg>0?fmtMins(avg):'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════
export function PainelAnalytics({inline=false}:{inline?:boolean}) {
  const ABAS=[
    {id:'erros',        label:'Erros',        icon:'⚠️'},
    {id:'atendimentos', label:'Atendimentos', icon:'💬'},
    {id:'presencial',   label:'Presencial',   icon:'🏢'},
  ];
  const [aba,    setAba]    = useState('erros');
  const [aberto, setAberto] = useState(true);
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 w-full ${inline?'':'mt-4'}`}>
      <button onClick={()=>setAberto(v=>!v)}
        className="w-full flex flex-col md:flex-row justify-between items-center border-b border-gray-200 px-6 py-4 gap-3 hover:bg-gray-50/60 transition-colors text-left">
        <div>
          <h2 className="text-lg font-black text-gray-900">📊 Análise Cesupe</h2>
          <p className="text-xs text-gray-400 mt-0.5">Erros · Atendimentos · Presencial</p>
        </div>
        <div className="flex items-center gap-3">
          {aberto && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl" onClick={e=>e.stopPropagation()}>
              {ABAS.map(a=>(
                <button key={a.id} onClick={()=>setAba(a.id)}
                  className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${aba===a.id?'bg-white shadow-sm text-red-600':'text-gray-500 hover:text-gray-800'}`}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          )}
          <span className={`text-gray-400 transition-transform duration-200 ${aberto?'rotate-180':''}`}>▼</span>
        </div>
      </button>
      {aberto && (
        <div className="p-6">
          {aba==='erros'        && <AbaErros/>}
          {aba==='atendimentos' && <AbaAtendimentos/>}
          {aba==='presencial'   && <AbaPresencial/>}
        </div>
      )}
    </div>
  );
}

export function PainelAtividades({inline=false}:{inline?:boolean}) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <PainelConsultores inline={inline}/>
      <PainelAnalytics   inline={inline}/>
    </div>
  );
}
