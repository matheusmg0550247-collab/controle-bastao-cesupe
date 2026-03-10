import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LineChart, Line, Cell, PieChart, Pie, LabelList
} from 'recharts';
import { supabase } from '../lib/supabase';
import { EQUIPE_EPROC, EQUIPE_JPE, USUARIOS_SISTEMA } from '../constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hoje   = (): string => new Date().toISOString().split('T')[0];
const ontem  = (): string => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; };
const tsIni  = (d: string) => d + 'T00:00:00+00:00';
const tsFim  = (d: string) => d + 'T23:59:59+00:00';
const fmtMin = (m: number): string => { if (!m || m <= 0) return '—'; const h = Math.floor(m/60), r = m%60; return h > 0 ? `${h}h ${r}m` : `${r}m`; };
const ptDate = (iso: string): string => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const mesLabel = (ym: string): string => {
  const [y, m] = ym.split('-');
  return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][+m-1]}/${y.slice(2)}`;
};

const COR_EPROC = '#f97316';
const COR_JPE   = '#3b82f6';
const COR_BAST  = '#ef4444';

const Spinner = () => (
  <div className="flex items-center justify-center h-52">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// Card KPI reutilizável
function KpiCard({ label, value, sub, from, to, icon }: {
  label: string; value: string | number; sub?: string; from: string; to: string; icon: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${from} ${to} rounded-2xl p-4 text-white shadow-lg`}>
      <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">{icon} {label}</p>
      <p className="text-3xl font-black">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA AUDITORIA — bastões e status com filtro de período (dia/semana/mês)
// ─────────────────────────────────────────────────────────────────────────────
function AbaAuditoria() {
  const [loading, setLoading]         = useState(true);
  const [periodoTipo, setPeriodoTipo] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [dataCustom, setDataCustom]   = useState(hoje());
  const [statusMap, setStatusMap]     = useState<Record<string, { status: string; duracoes: Record<string, number> }>>({});
  const [bastoes, setBastoes]         = useState<{ h: Record<string, number>; o: Record<string, number> }>({ h: {}, o: {} });
  const [mediaBastao, setMediaBastao] = useState(0);
  const [eqTotais, setEqTotais]       = useState({ eproc: { h: 0, o: 0 }, jpe: { h: 0, o: 0 } });
  const [expandEq, setExpandEq]       = useState<string | null>(null);
  const consultores = USUARIOS_SISTEMA.filter(u => u.perfil === 'Consultor').map(u => u.nome).sort();

  const STATUS_COR: Record<string, string> = {
    'Treinamento': '#8b5cf6', 'Reunião': '#14b8a6', 'Sessão': '#f43f5e',
    'Atend. Presencial': '#f97316', 'Projeto': '#6366f1', 'Atividades': '#3b82f6',
    'Almoço': '#f59e0b', 'Bastão': '#ef4444', 'Indisponível': '#9ca3af',
  };

  // ── Calcular ranges de datas baseado no período selecionado ──────────────
  const { rangeAtual, rangeAnt, labelAtual, labelAnt } = useMemo(() => {
    const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    // fmt local: evita o bug do toISOString() que converte para UTC e avança o dia no fuso BR (UTC-3)
    const fmtLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    if (periodoTipo === 'dia') {
      const d = new Date(dataCustom + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const ant = fmtLocal(d);
      return {
        rangeAtual: { ini: dataCustom, fim: dataCustom },
        rangeAnt:   { ini: ant,        fim: ant },
        labelAtual: dataCustom === hoje() ? 'Hoje' : ptDate(dataCustom),
        labelAnt:   ptDate(ant),
      };
    }

    if (periodoTipo === 'semana') {
      // Semana sempre segunda → domingo, sem bug de timezone
      const now = new Date();
      const day = now.getDay(); // 0=Dom, 1=Seg ... 6=Sab
      const diffToMon = day === 0 ? -6 : 1 - day; // quantos dias até a segunda anterior
      const semIni    = new Date(now); semIni.setDate(now.getDate() + diffToMon);
      const semFim    = new Date(semIni); semFim.setDate(semIni.getDate() + 6); // domingo
      const semIniAnt = new Date(semIni); semIniAnt.setDate(semIni.getDate() - 7);
      const semFimAnt = new Date(semIniAnt); semFimAnt.setDate(semIniAnt.getDate() + 6);
      return {
        rangeAtual: { ini: fmtLocal(semIni),    fim: fmtLocal(semFim)    },
        rangeAnt:   { ini: fmtLocal(semIniAnt), fim: fmtLocal(semFimAnt) },
        labelAtual: `Seg ${ptDate(fmtLocal(semIni))} → Dom ${ptDate(fmtLocal(semFim))}`,
        labelAnt:   `Seg ${ptDate(fmtLocal(semIniAnt))} → Dom ${ptDate(fmtLocal(semFimAnt))}`,
      };
    }

    // mês
    const now = new Date(); const ano = now.getFullYear(), mes = now.getMonth() + 1;
    const mesStr    = String(mes).padStart(2, '0');
    const anoAnt    = mes === 1 ? ano - 1 : ano;
    const mesAntNum = mes === 1 ? 12 : mes - 1;
    const mesAntStr = String(mesAntNum).padStart(2, '0');
    const diasMes    = new Date(ano,    mes,       0).getDate();
    const diasMesAnt = new Date(anoAnt, mesAntNum, 0).getDate();
    return {
      rangeAtual: { ini: `${ano}-${mesStr}-01`,       fim: `${ano}-${mesStr}-${diasMes}`           },
      rangeAnt:   { ini: `${anoAnt}-${mesAntStr}-01`, fim: `${anoAnt}-${mesAntStr}-${diasMesAnt}` },
      labelAtual: `${MESES_PT[mes-1]}/${ano}`,
      labelAnt:   `${MESES_PT[mesAntNum-1]}/${anoAnt}`,
    };
  }, [periodoTipo, dataCustom]);

  useEffect(() => { load(); }, [rangeAtual.ini, rangeAtual.fim, rangeAnt.ini, rangeAnt.fim]);

  async function load() {
    setLoading(true);
    await Promise.all([loadStatus(), loadBastoes()]);
    setLoading(false);
  }

  async function loadStatus() {
    const { data } = await supabase.from('registros_status')
      .select('consultor,status,inicio,fim,duracao_min')
      .gte('data', rangeAtual.ini).lte('data', rangeAtual.fim);
    if (!data) return;

    const mapa: Record<string, { status: string; duracoes: Record<string, number> }> = {};
    const todasDurs: number[] = [];

    data.forEach(r => {
      if (!mapa[r.consultor]) mapa[r.consultor] = { status: '', duracoes: {} };
      const dur = r.duracao_min ?? (r.fim
        ? Math.max(0, Math.round((new Date(r.fim).getTime()  - new Date(r.inicio).getTime()) / 60000))
        : Math.max(0, Math.round((Date.now()                 - new Date(r.inicio).getTime()) / 60000)));
      const s = r.status || 'Bastão';
      mapa[r.consultor].duracoes[s] = (mapa[r.consultor].duracoes[s] || 0) + dur;
      if (!r.fim) mapa[r.consultor].status = s;
      // Tempo médio: usa TODOS os registros com duração > 0 (bastão pode não ter status explícito)
      if (dur > 0) todasDurs.push(dur);
    });
    setStatusMap(mapa);
    setMediaBastao(todasDurs.length > 0 ? Math.round(todasDurs.reduce((s, v) => s + v, 0) / todasDurs.length) : 0);
  }

  async function loadBastoes() {
    // Busca tanto em bastao_historico (dados antigos) quanto bastao_rotacoes (dados novos)
    const [{ data: hist }, { data: rt }] = await Promise.all([
      supabase.from('bastao_historico')
        .select('consultor, equipe, bastoes, data')
        .gte('data', rangeAnt.ini).lte('data', rangeAtual.fim).limit(10000),
      supabase.from('bastao_rotacoes')
        .select('para_consultor, data_hora')
        .gte('data_hora', tsIni(rangeAnt.ini)).lte('data_hora', tsFim(rangeAtual.fim)).limit(10000),
    ]);

    const bh: Record<string, number> = {}, bo: Record<string, number> = {};
    const eq = { eproc: { h: 0, o: 0 }, jpe: { h: 0, o: 0 } };

    hist?.forEach(r => {
      const isAtual = r.data >= rangeAtual.ini && r.data <= rangeAtual.fim;
      const isEproc = r.equipe === 'EPROC';
      const qtd = r.bastoes || 1;
      if (isAtual) {
        bh[r.consultor] = (bh[r.consultor] || 0) + qtd;
        isEproc ? (eq.eproc.h += qtd) : (eq.jpe.h += qtd);
      } else {
        bo[r.consultor] = (bo[r.consultor] || 0) + qtd;
        isEproc ? (eq.eproc.o += qtd) : (eq.jpe.o += qtd);
      }
    });

    rt?.forEach(r => {
      const d = r.data_hora.split('T')[0], c = r.para_consultor;
      const isEproc = EQUIPE_EPROC.includes(c);
      const isAtual = d >= rangeAtual.ini && d <= rangeAtual.fim;
      // Evita duplicar com bastao_historico: só usa rotacoes se não há hist para esse consultor+dia
      if (isAtual) { bh[c] = (bh[c] || 0) + 1; isEproc ? eq.eproc.h++ : eq.jpe.h++; }
      else         { bo[c] = (bo[c] || 0) + 1; isEproc ? eq.eproc.o++ : eq.jpe.o++; }
    });

    setBastoes({ h: bh, o: bo }); setEqTotais(eq);
  }

  const totalH = Object.values(bastoes.h).reduce((s, v) => s + v, 0);
  const totalO = Object.values(bastoes.o).reduce((s, v) => s + v, 0);
  const diff   = totalH - totalO;

  const bastaoChart = consultores
    .map(n => ({ nome: n.split(' ')[0], nomeCompleto: n, hoje: bastoes.h[n] || 0, ontem: bastoes.o[n] || 0 }))
    .filter(d => d.hoje > 0 || d.ontem > 0)
    .sort((a, b) => b.hoje - a.hoje);

  const pieData = Object.entries(
    Object.values(statusMap).reduce((acc, { status }) => {
      const s = status || 'Bastão'; acc[s] = (acc[s] || 0) + 1; return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Filtro de período ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['dia', 'semana', 'mes'] as const).map(p => {
            const labels = { dia: '📅 Dia', semana: '📆 Semana', mes: '🗓️ Mês' };
            return (
              <button key={p} onClick={() => setPeriodoTipo(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  periodoTipo === p ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {labels[p]}
              </button>
            );
          })}
        </div>
        {periodoTipo === 'dia' && (
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-bold text-gray-400">Data</label>
            <input type="date" value={dataCustom} max={hoje()}
              onChange={e => setDataCustom(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-400 bg-white" />
          </div>
        )}
        {periodoTipo !== 'dia' && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2 border border-gray-100 text-sm font-bold">
            <span className="text-red-500">{labelAtual}</span>
            <span className="text-gray-300">vs</span>
            <span className="text-gray-400">{labelAnt}</span>
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={`Bastões — ${labelAtual}`} value={totalH}
          sub={`${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} vs ${labelAnt} (${totalO})`}
          from="from-red-500" to="to-rose-700" icon="🔥" />
        <div onClick={() => setExpandEq(expandEq === 'EPROC' ? null : 'EPROC')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <KpiCard label={`EPROC — ${labelAtual}`} value={eqTotais.eproc.h}
            sub={`${labelAnt}: ${eqTotais.eproc.o}`}
            from="from-orange-400" to="to-orange-600" icon="🔥" />
        </div>
        <div onClick={() => setExpandEq(expandEq === 'JPE' ? null : 'JPE')} className="cursor-pointer hover:scale-[1.02] transition-transform">
          <KpiCard label={`Legados — ${labelAtual}`} value={eqTotais.jpe.h}
            sub={`${labelAnt}: ${eqTotais.jpe.o}`}
            from="from-blue-500" to="to-blue-700" icon="🔥" />
        </div>
        <KpiCard label="Tempo Médio" value={fmtMin(mediaBastao)}
          sub={`por bastão — ${labelAtual}`}
          from="from-pink-500" to="to-purple-700" icon="⏱" />
      </div>

      {/* ── Gráfico bastões: período atual vs anterior ───────────────────── */}
      {bastaoChart.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-700 mb-1">🔥 Registros por Consultor</h3>
          <p className="text-xs text-gray-400 mb-4">
            <span className="font-black text-red-500">{labelAtual}</span>
            {' '}<span className="text-gray-300">vs</span>{'  '}
            <span className="font-black text-gray-400">{labelAnt}</span>
          </p>
          <div style={{ height: Math.max(220, bastaoChart.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bastaoChart} layout="vertical" margin={{ left: 0, right: 36 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 12 }} width={80} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
                    <p className="font-black text-gray-800 mb-1">{d.nomeCompleto}</p>
                    <p className="text-red-500 font-bold">{labelAtual}: {d.hoje}</p>
                    <p className="text-gray-400">{labelAnt}: {d.ontem}</p>
                  </div>;
                }} />
                <Legend />
                <Bar dataKey="hoje"  fill={COR_BAST} radius={[0,4,4,0]} name={labelAtual} maxBarSize={18}>
                  <LabelList dataKey="hoje"  position="right" style={{fontSize:11,fontWeight:'bold',fill:'#ef4444'}} formatter={(v:any)=>v>0?v:''} />
                </Bar>
                <Bar dataKey="ontem" fill="#fecaca" radius={[0,4,4,0]} name={labelAnt}    maxBarSize={18}>
                  <LabelList dataKey="ontem" position="right" style={{fontSize:10,fill:'#fca5a5'}}              formatter={(v:any)=>v>0?v:''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Pizza status + Tabela tempo — apenas no modo Dia ────────────── */}
      {periodoTipo === 'dia' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-extrabold text-gray-700 mb-3">📍 Equipe Agora</h3>
            {pieData.length > 0 ? <>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={66} dataKey="value" paddingAngle={3}>
                      {pieData.map(e => <Cell key={e.name} fill={STATUS_COR[e.name] || '#94a3b8'} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {pieData.map(d => <span key={d.name} className="flex items-center gap-1 text-xs font-bold text-gray-600">
                  <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COR[d.name] || '#94a3b8' }} />{d.name} ({d.value})
                </span>)}
              </div>
            </> : <p className="text-gray-400 text-sm text-center mt-8">Sem dados hoje.</p>}
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
            <h3 className="text-sm font-extrabold text-gray-700 mb-3">⏱ Tempo por Status — {labelAtual}</h3>
            <table className="w-full text-xs min-w-[480px]">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left font-extrabold text-gray-400 uppercase pb-2 pr-3">Consultor</th>
                {['Bastão','Reunião','Treinamento','Sessão','Pres.','Projeto','Ativ.','Almoço'].map(s => (
                  <th key={s} className="text-center font-extrabold pb-2 px-1 whitespace-nowrap text-gray-500">{s}</th>
                ))}
              </tr></thead>
              <tbody>
                {consultores.filter(n => statusMap[n]).map(nome => {
                  const { duracoes } = statusMap[nome];
                  const STATUS_KEYS: Record<string,string> = { 'Bastão':'Bastão','Reunião':'Reunião','Treinamento':'Treinamento','Sessão':'Sessão','Pres.':'Atend. Presencial','Projeto':'Projeto','Ativ.':'Atividades','Almoço':'Almoço' };
                  return <tr key={nome} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 font-bold text-gray-700 whitespace-nowrap">
                      {nome.split(' ')[0]} {nome.split(' ').slice(-1)[0]}
                    </td>
                    {Object.entries(STATUS_KEYS).map(([label, key]) => (
                      <td key={label} className="py-1.5 px-1 text-center">
                        {duracoes[key]
                          ? <span className="font-bold px-1 py-0.5 rounded text-[10px]"
                              style={{ background: (STATUS_COR[key] || '#94a3b8') + '22', color: STATUS_COR[key] || '#94a3b8' }}>
                              {fmtMin(duracoes[key])}
                            </span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    ))}
                  </tr>;
                })}
              </tbody>
            </table>
            {Object.keys(statusMap).length === 0 && <p className="text-center text-gray-400 text-sm mt-6">Nenhum registro ainda.</p>}
          </div>
        </div>
      )}

      {/* ── Detalhe equipe expandida ─────────────────────────────────────── */}
      {expandEq && (
        <div className="bg-white rounded-2xl border-2 border-red-200 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold text-gray-700">
              {expandEq === 'EPROC' ? '🔥 EPROC' : '🔥 Legados'} — Detalhe {labelAtual}
            </h3>
            <button onClick={() => setExpandEq(null)} className="text-gray-400 hover:text-red-500 text-xl">✖</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
            {(expandEq === 'EPROC' ? EQUIPE_EPROC : EQUIPE_JPE).map(nome => {
              const h = bastoes.h[nome] || 0, o = bastoes.o[nome] || 0, dif = h - o;
              return <div key={nome} className={`rounded-xl p-3 border-2 text-center ${h > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                <p className="text-[10px] font-bold text-gray-500 mb-1 truncate">{nome.split(' ')[0]}</p>
                <p className="text-2xl font-black text-red-600">{h}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  {dif !== 0 ? (dif > 0 ? `+${dif}` : `${dif}`) : '='} ({o})
                </p>
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA GERAL — bastões históricos por mês/ano
// Usa bastao_historico (dados Excel) + bastao_rotacoes (dados sistema)
// ─────────────────────────────────────────────────────────────────────────────
function AbaGeral({ perfil = 'Gestor' }: { perfil?: string }) {
  const [loading, setLoading] = useState(true);
  const [ano, setAno]         = useState(new Date().getFullYear());
  const [porMes, setPorMes]   = useState<any[]>([]);
  const [porConsultor, setPorConsultor] = useState<any[]>([]);
  const [totais, setTotais]   = useState({ total: 0, eproc: 0, jpe: 0, atd: 0, chat: 0, hp: 0, pres: 0 });
  const anos = [new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2];

  useEffect(() => { load(); }, [ano]);

  async function load() {
    setLoading(true);
    try {
      const ini = `${ano}-01-01`, fim = `${ano}-12-31`;

      // Busca bastões em paralelo
      const [{ data: hist }, { data: rt }] = await Promise.all([
        supabase.from('bastao_historico')
          .select('data, consultor, equipe, bastoes')
          .gte('data', ini).lte('data', fim).limit(20000),
        supabase.from('bastao_rotacoes')
          .select('data_hora, para_consultor')
          .gte('data_hora', tsIni(ini)).lte('data_hora', tsFim(fim)).limit(50000),
      ]);

      // Atendimentos e Chat: 1 query por mês cada (evita limite 1000)
      const mesesNums = Array.from({length:12},(_,i)=>i+1);
      const atdPorMes:  Record<string, number> = {};
      const chatPorMes: Record<string, number> = {};
      const hpPorMes:   Record<string, number> = {};
      const presPorMes: Record<string, number> = {};
      await Promise.all(mesesNums.flatMap((mm) => {
        const mIni = `${ano}-${String(mm).padStart(2,'0')}-01`;
        const mFim = `${ano}-${String(mm).padStart(2,'0')}-${mm===2?28:mm===4||mm===6||mm===9||mm===11?30:31}`;
        const k = `${ano}-${String(mm).padStart(2,'0')}`;
        return [
          supabase.from('atendimentos_cesupe').select('*',{count:'exact',head:true}).gte('data',mIni).lte('data',mFim)
            .then(({count}) => { atdPorMes[k] = count ?? 0; }),
          supabase.from('dados_chat').select('atendimentos').gte('data',mIni).lte('data',mFim).limit(5000)
            .then(({data:dc}) => { chatPorMes[k] = dc?.reduce((s,r)=>s+(r.atendimentos||0),0) ?? 0; }),
          supabase.from('atendimentos_hp').select('*',{count:'exact',head:true}).gte('data',mIni).lte('data',mFim)
            .then(({count}) => { hpPorMes[k] = count ?? 0; }),
          supabase.from('atividades_presenciais').select('*',{count:'exact',head:true}).gte('data',mIni).lte('data',mFim)
            .then(({count}) => { presPorMes[k] = count ?? 0; }),
        ];
      }));

      // Meses base
      const meses: Record<string, { mes: string; eproc: number; jpe: number; atd: number; chat: number; hp: number; pres: number }> = {};
      for (let m = 1; m <= 12; m++) {
        const k = `${ano}-${String(m).padStart(2, '0')}`;
        meses[k] = { mes: mesLabel(k), eproc: 0, jpe: 0, atd: atdPorMes[k] ?? 0, chat: 0, hp: hpPorMes[k] ?? 0, pres: presPorMes[k] ?? 0 };
      }

      // Por consultor
      const consMap: Record<string, { equipe: string; total: number }> = {};

      hist?.forEach(r => {
        const k = r.data.substring(0, 7);
        if (!meses[k]) return;
        if (r.equipe === 'EPROC') meses[k].eproc += r.bastoes;
        else meses[k].jpe += r.bastoes;
        if (!consMap[r.consultor]) consMap[r.consultor] = { equipe: r.equipe, total: 0 };
        consMap[r.consultor].total += r.bastoes;
      });

      rt?.forEach(r => {
        const data = r.data_hora.split('T')[0];
        const k = data.substring(0, 7);
        if (!meses[k]) return;
        const cn = r.para_consultor;
        const eq = EQUIPE_EPROC.includes(cn) ? 'EPROC' : 'JPE';
        if (eq === 'EPROC') meses[k].eproc++; else meses[k].jpe++;
        if (!consMap[cn]) consMap[cn] = { equipe: eq, total: 0 };
        consMap[cn].total++;
      });

      // Preencher chat nos meses
      Object.entries(chatPorMes).forEach(([k, v]) => { if (meses[k]) meses[k].chat = v; });

      const mesArr = Object.values(meses).map(m => ({ ...m, total: m.eproc + m.jpe }));
      const totalEproc = mesArr.reduce((s, m) => s + m.eproc, 0);
      const totalJpe   = mesArr.reduce((s, m) => s + m.jpe,   0);
      const totalAtd   = Object.values(atdPorMes).reduce((s, v) => s + v, 0);
      const totalChat  = Object.values(chatPorMes).reduce((s, v) => s + v, 0);
      const totalHp    = Object.values(hpPorMes).reduce((s, v) => s + v, 0);
      const totalPres  = Object.values(presPorMes).reduce((s, v) => s + v, 0);

      setPorMes(mesArr);
      setTotais({ total: totalEproc + totalJpe, eproc: totalEproc, jpe: totalJpe, atd: totalAtd, chat: totalChat, hp: totalHp, pres: totalPres });
      setPorConsultor(
        Object.entries(consMap)
          .map(([nome, { equipe, total }]) => ({ nome, equipe, total, primeiroNome: nome.split(' ')[0] }))
          .sort((a, b) => b.total - a.total)
      );
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      {/* Seletor de ano */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-bold text-gray-500">Ano:</span>
        {anos.map(a => (
          <button key={a} onClick={() => setAno(a)}
            className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${ano === a ? 'bg-red-500 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {a}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Bastões" value={totais.total} sub={`em ${ano}`} from="from-red-500" to="to-rose-700" icon="🔥" />
        <KpiCard label="EPROC"  value={totais.eproc} sub={`${totais.total > 0 ? Math.round(totais.eproc/totais.total*100) : 0}% bastões`} from="from-orange-400" to="to-orange-600" icon="🔥" />
        <KpiCard label="Legados" value={totais.jpe}  sub={`${totais.total > 0 ? Math.round(totais.jpe/totais.total*100) : 0}% bastões`} from="from-blue-500" to="to-blue-700" icon="🔥" />
        <KpiCard label="Atendimentos" value={totais.atd}  sub={`em ${ano}`} from="from-emerald-500" to="to-green-700" icon="💬" />
        <KpiCard label="Chat"         value={totais.chat} sub={`em ${ano}`} from="from-pink-500"  to="to-purple-700" icon="💬" />
        <KpiCard label="HP"           value={totais.hp}   sub={`em ${ano}`} from="from-indigo-500"  to="to-indigo-700" icon="🎯" />
        <KpiCard label="Presencial"   value={totais.pres} sub={`em ${ano}`} from="from-lime-500"    to="to-lime-700"   icon="🏢" />
      </div>

      {/* Barras mensais — EPROC vs Legados */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-700 mb-4">📈 Registros Gerais por Mês — {ano}</h3>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porMes} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }} cursor={{ fill: '#f8fafc' }} />
              <Legend />
              <Bar dataKey="eproc" fill={COR_EPROC}  name="Bastão EPROC"   radius={[4,4,0,0]} maxBarSize={22}><LabelList dataKey="eproc" position="top" style={{fontSize:9,fontWeight:'bold',fill:COR_EPROC}} formatter={(v:any)=>v>0?v:''} /></Bar>
              <Bar dataKey="jpe"   fill={COR_JPE}    name="Bastão Legados" radius={[4,4,0,0]} maxBarSize={22}><LabelList dataKey="jpe"   position="top" style={{fontSize:9,fontWeight:'bold',fill:COR_JPE}}   formatter={(v:any)=>v>0?v:''} /></Bar>
              <Bar dataKey="atd"   fill="#22c55e"    name="Atendimentos"   radius={[4,4,0,0]} maxBarSize={22}><LabelList dataKey="atd"   position="top" style={{fontSize:9,fontWeight:'bold',fill:'#16a34a'}} formatter={(v:any)=>v>0?v:''} /></Bar>
              <Bar dataKey="chat"  fill="#8b5cf6"    name="💬 Chat"           radius={[4,4,0,0]} maxBarSize={22}><LabelList dataKey="chat"  position="top" style={{fontSize:9,fontWeight:'bold',fill:'#be185d'}} formatter={(v:any)=>v>0?v:''} /></Bar>
              <Bar dataKey="hp"    fill="#6366f1"    name="🎯 HP"             radius={[4,4,0,0]} maxBarSize={18}><LabelList dataKey="hp"    position="top" style={{fontSize:9,fontWeight:'bold',fill:'#4338ca'}} formatter={(v:any)=>v>0?v:''} /></Bar>
              <Bar dataKey="pres"  fill="#65a30d"    name="🏢 Presencial"     radius={[4,4,0,0]} maxBarSize={18}><LabelList dataKey="pres"  position="top" style={{fontSize:9,fontWeight:'bold',fill:'#3f6212'}} formatter={(v:any)=>v>0?v:''} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Linha de tendência + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Tendência */}
        <div className={`${perfil === 'Consultor' ? 'lg:col-span-5' : 'lg:col-span-3'} bg-white rounded-2xl border border-gray-200 p-5 shadow-sm`}>
          <h3 className="text-sm font-extrabold text-gray-700 mb-4">📉 Tendência — {ano}</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={porMes} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }} />
                <Legend />
                <Line type="monotone" dataKey="eproc" stroke={COR_EPROC} strokeWidth={2} dot={false} name="EPROC" />
                <Line type="monotone" dataKey="jpe"   stroke={COR_JPE}   strokeWidth={2} dot={false} name="Legados" />
                <Line type="monotone" dataKey="total" stroke={COR_BAST}  strokeWidth={2} dot={false} name="Total" strokeDasharray="4 2" />
                <Line type="monotone" dataKey="atd"   stroke="#22c55e"   strokeWidth={2} dot={false} name="Atendimentos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking consultores — apenas Gestor */}
        {perfil !== 'Consultor' && (
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-y-auto" style={{ maxHeight: 320 }}>
          <h3 className="text-sm font-extrabold text-gray-700 mb-3">🏆 Ranking — {ano}</h3>
          <div className="flex flex-col gap-1.5">
            {porConsultor.map((c, i) => (
              <div key={c.nome} className="flex items-center gap-2">
                <span className={`text-[10px] font-black w-5 text-center ${i < 3 ? 'text-yellow-500' : 'text-gray-300'}`}>
                  {i + 1}
                </span>
                <span className={`text-[9px] px-1 py-0.5 rounded font-black ${c.equipe === 'EPROC' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {c.equipe === 'EPROC' ? 'EP' : 'JP'}
                </span>
                <span className="text-xs font-bold text-gray-700 flex-1 truncate">{c.nome}</span>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 rounded-full bg-red-400" style={{ width: `${Math.round((c.total / (porConsultor[0]?.total || 1)) * 80)}px` }} />
                  <span className="text-xs font-black text-red-500 w-8 text-right">{c.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* Tabela mensal */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-extrabold text-gray-700 mb-3">📋 Tabela Mensal — {ano}</h3>
        <table className="w-full text-sm min-w-[440px]">
          <thead><tr className="border-b-2 border-gray-100">
            <th className="text-left text-xs font-extrabold text-gray-400 uppercase pb-2 pr-4">Mês</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: COR_EPROC }}>🔥 EPROC</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: COR_JPE }}>🔥 Legados</th>
            <th className="text-xs font-extrabold text-gray-600 uppercase pb-2 px-4">Bastões</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: '#22c55e' }}>💬 Atend.</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: '#8b5cf6' }}>💬 Chat</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: '#6366f1' }}>🎯 HP</th>
            <th className="text-xs font-extrabold pb-2 px-4" style={{ color: '#65a30d' }}>🏢 Pres.</th>
          </tr></thead>
          <tbody>
            {porMes.map((m, i) => (
              <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${m.total === 0 ? 'opacity-30' : ''}`}>
                <td className="py-2 pr-4 font-black text-gray-700">{m.mes}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: COR_EPROC }}>{m.eproc || '—'}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: COR_JPE }}>{m.jpe || '—'}</td>
                <td className="py-2 px-4 text-center font-black text-gray-800">{m.total || '—'}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: '#22c55e' }}>{m.atd || '—'}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: '#8b5cf6' }}>{(m as any).chat || '—'}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: '#6366f1' }}>{(m as any).hp   || '—'}</td>
                <td className="py-2 px-4 text-center font-bold" style={{ color: '#65a30d' }}>{(m as any).pres || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50">
            <td className="py-2 pr-4 text-xs font-extrabold text-gray-500 uppercase">Total {ano}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: COR_EPROC }}>{totais.eproc.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: COR_JPE }}>{totais.jpe.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black text-gray-900">{totais.total.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: '#22c55e' }}>{totais.atd.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: '#8b5cf6' }}>{totais.chat.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: '#6366f1' }}>{totais.hp.toLocaleString('pt-BR')}</td>
            <td className="py-2 px-4 text-center font-black" style={{ color: '#65a30d' }}>{totais.pres.toLocaleString('pt-BR')}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA DIÁRIO — bastões por consultor, comparando 2 datas
// ─────────────────────────────────────────────────────────────────────────────
function AbaDiario() {
  const [loading, setLoading] = useState(true);
  const [data1, setData1]     = useState(hoje());
  const [data2, setData2]     = useState(ontem());
  const [filtEq, setFiltEq]   = useState<'todos' | 'eproc' | 'jpe'>('todos');
  const [rows, setRows]       = useState<any[]>([]);

  useEffect(() => { load(); }, [data1, data2]);

  // Busca bastões de uma data — tenta primeiro bastao_historico, fallback bastao_rotacoes
  // Retorna { bastoes: {consultor: n}, atd: {consultor: n} }
  async function buscarDia(data: string): Promise<{ bastoes: Record<string,number>; atd: Record<string,number>; chat: Record<string,number>; hp: Record<string,number>; pres: Record<string,number> }> {
    const bMap: Record<string, number> = {};
    const aMap: Record<string, number> = {};
    const cMap: Record<string, number> = {};
    const hMap: Record<string, number> = {};
    const pMap: Record<string, number> = {};

    // Bastões: tenta histórico, fallback rotacoes
    const [
      { data: hist },
      { data: rt },
      { data: atd },
      { data: chatd },
      { data: hpd },
      { data: presd },
    ] = await Promise.all([
      supabase.from('bastao_historico').select('consultor, bastoes').eq('data', data).limit(2000),
      supabase.from('bastao_rotacoes').select('para_consultor').gte('data_hora', tsIni(data)).lte('data_hora', tsFim(data)).limit(2000),
      supabase.from('atendimentos_cesupe').select('consultor').eq('data', data).limit(2000),
      supabase.from('dados_chat').select('consultor, atendimentos').eq('data', data).limit(2000),
      supabase.from('atendimentos_hp').select('consultor').eq('data', data).limit(2000),
      supabase.from('atividades_presenciais').select('consultor').eq('data', data).limit(2000),
    ]);
    hist?.forEach(r => { bMap[r.consultor] = (bMap[r.consultor] || 0) + r.bastoes; });
    rt?.forEach(r => { bMap[r.para_consultor] = (bMap[r.para_consultor] || 0) + 1; });
    atd?.forEach(r => { if (r.consultor) aMap[r.consultor] = (aMap[r.consultor] || 0) + 1; });
    chatd?.forEach(r => { if (r.consultor) cMap[r.consultor] = (cMap[r.consultor] || 0) + (r.atendimentos || 0); });
    hpd?.forEach(r => { if (r.consultor) hMap[r.consultor] = (hMap[r.consultor] || 0) + 1; });
    presd?.forEach(r => { if (r.consultor) pMap[r.consultor] = (pMap[r.consultor] || 0) + 1; });

    return { bastoes: bMap, atd: aMap, chat: cMap, hp: hMap, pres: pMap };
  }

  async function load() {
    setLoading(true);
    const [r1, r2] = await Promise.all([buscarDia(data1), buscarDia(data2)]);

    const consultores = USUARIOS_SISTEMA.filter(u => u.perfil === 'Consultor');
    const result = consultores.map(u => {
      const v1 = r1.bastoes[u.nome] || 0, v2 = r2.bastoes[u.nome] || 0;
      const a1 = r1.atd[u.nome]    || 0, a2 = r2.atd[u.nome]    || 0;
      const c1 = r1.chat[u.nome] || 0, c2 = r2.chat[u.nome] || 0;
      const h1 = r1.hp[u.nome]   || 0, h2 = r2.hp[u.nome]   || 0;
      const p1 = r1.pres[u.nome] || 0, p2 = r2.pres[u.nome] || 0;
      return {
        nome: u.nome,
        nomeC: u.nome.split(' ')[0] + ' ' + u.nome.split(' ').slice(-1)[0],
        equipe: EQUIPE_EPROC.includes(u.nome) ? 'EPROC' : 'JPE',
        v1, v2, diff: v1 - v2,
        a1, a2, c1, c2, h1, h2, p1, p2,
      };
    });

    setRows(result);
    setLoading(false);
  }

  const filtrar = (arr: any[]) => arr.filter(d =>
    filtEq === 'todos' || (filtEq === 'eproc' && d.equipe === 'EPROC') || (filtEq === 'jpe' && d.equipe === 'JPE')
  );

  const comDados = filtrar(rows).filter(d => d.v1>0||d.v2>0||d.a1>0||d.c1>0||d.h1>0||d.p1>0).sort((a,b)=>(b.v1+b.a1+b.c1+b.h1+b.p1)-(a.v1+a.a1+a.c1+a.h1+a.p1));
  const semDados = filtrar(rows).filter(d => d.v1===0&&d.v2===0&&d.a1===0&&d.c1===0&&d.h1===0&&d.p1===0);
  const todos    = [...comDados, ...semDados];
  const T        = (k: string) => filtrar(rows).reduce((s: number, d: any) => s + (d[k] || 0), 0);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        {[{ l: 'Data principal', v: data1, fn: setData1 }, { l: 'Comparar com', v: data2, fn: setData2 }].map(f => (
          <div key={f.l} className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400">{f.l}</label>
            <input type="date" value={f.v} onChange={e => f.fn(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-400 bg-white" />
          </div>
        ))}
        <div className="flex gap-2">
          {[{ v: 'todos', l: '🌐 Todos' }, { v: 'eproc', l: '🔥 EPROC' }, { v: 'jpe', l: '💧 Legados' }].map(b => (
            <button key={b.v} onClick={() => setFiltEq(b.v as any)}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${filtEq === b.v ? 'bg-red-500 text-white' : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
              {b.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(() => {
          const t1 = T('v1'), t2 = T('v2'), dif = t1 - t2;
          const ep1 = filtrar(rows).filter(d=>d.equipe==='EPROC').reduce((s,d)=>s+d.v1,0);
          const jp1 = filtrar(rows).filter(d=>d.equipe==='JPE').reduce((s,d)=>s+d.v1,0);
          return <>
            <KpiCard label={ptDate(data1)} value={t1} sub={`${dif>=0?'▲':'▼'} ${Math.abs(dif)} vs ${ptDate(data2)} (${t2})`} from="from-red-500" to="to-rose-700" icon="🔥" />
            <KpiCard label="EPROC"  value={ep1} sub={ptDate(data1)} from="from-orange-400" to="to-orange-600" icon="🔥" />
            <KpiCard label="Legados" value={jp1} sub={ptDate(data1)} from="from-blue-500" to="to-blue-700" icon="🔥" />
            <KpiCard label={ptDate(data2)} value={t2} sub="bastões comparação" from="from-gray-500" to="to-gray-700" icon="📅" />
            <KpiCard label="Atend. Cesupe" value={filtrar(rows).reduce((s:number,d:any)=>s+d.a1,0)} sub={ptDate(data1)} from="from-emerald-500" to="to-green-700"  icon="💬" />
            <KpiCard label="Chat"          value={filtrar(rows).reduce((s:number,d:any)=>s+d.c1,0)} sub={ptDate(data1)} from="from-pink-500"  to="to-purple-700" icon="💬" />
          </>;
        })()}
      </div>

      {/* Gráfico — só quem tem dado */}
      {comDados.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-700 mb-1">📊 Registros por Consultor</h3>
          <p className="text-xs text-gray-400 mb-4">
            <span className="font-black text-red-500">{ptDate(data1)}</span> vs <span className="font-black text-gray-400">{ptDate(data2)}</span>
          </p>
          {/* Barra stacked: data1 (sólido) + data2 (claro), cada segmento com rótulo */}
          <div style={{ height: Math.max(200, comDados.length * 52) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comDados} layout="vertical" barCategoryGap="30%" margin={{ left: 0, right: 50 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nomeC"
                  tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 11 }} width={110} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const tot1 = d.v1 + d.a1 + d.c1;
                  const tot2 = d.v2 + d.a2 + d.c2;
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
                      <p className="font-black text-gray-800 border-b pb-1 mb-1">{d.nome}</p>
                      <p className="font-bold text-gray-700">{ptDate(data1)} — total: <span className="text-red-500">{tot1}</span></p>
                      {d.v1 > 0 && <p style={{color:'#ef4444'}}>🔥 Bastão: {d.v1}</p>}
                      {d.a1 > 0 && <p style={{color:'#16a34a'}}>💬 Atend.: {d.a1}</p>}
                      {d.c1 > 0 && <p style={{color:'#be185d'}}>💬 Chat: {d.c1}</p>}
                      {tot2 > 0 && <>
                        <p className="font-bold text-gray-400 border-t pt-1 mt-1">{ptDate(data2)} — total: {tot2}</p>
                        {d.v2 > 0 && <p className="text-red-200">🔥 Bastão: {d.v2}</p>}
                        {d.a2 > 0 && <p style={{color:'#bbf7d0', filter:'brightness(0.7)'}}>💬 Atend.: {d.a2}</p>}
                        {d.c2 > 0 && <p style={{color:'#14b8a6'}}>💬 Chat: {d.c2}</p>}
                      </>}
                    </div>
                  );
                }} />
                <Legend
                  formatter={(value: string) => {
                    const cor =
                      value === '🔥 Bastão'      ? '#ef4444' :
                      value === '💬 Atend.'       ? '#16a34a' :
                      value === '💬 Chat'         ? '#be185d' :
                      value === '🔥 Bastão (ant)' ? '#fca5a5' :
                      value === '💬 Atend. (ant)' ? '#86efac' :
                      value === '💬 Chat (ant)'   ? '#ddd6fe' : '#9ca3af';
                    return <span style={{fontSize:11, fontWeight:'bold', color: cor}}>{value}</span>;
                  }}
                />
                {/* data1 — barras sólidas empilhadas */}
                <Bar dataKey="v1" stackId="d1" fill="#ef4444" name="🔥 Bastão"      maxBarSize={18}>
                  <LabelList dataKey="v1" position="insideRight"
                    style={{fontSize:10,fontWeight:'bold',fill:'#fff'}}
                    formatter={(v:any) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="a1" stackId="d1" fill="#22c55e" name="💬 Atend."      maxBarSize={18}>
                  <LabelList dataKey="a1" position="insideRight"
                    style={{fontSize:10,fontWeight:'bold',fill:'#fff'}}
                    formatter={(v:any) => v > 0 ? v : ''} />
                </Bar>
                <Bar dataKey="c1" stackId="d1" fill="#8b5cf6" name="💬 Chat"        maxBarSize={18} radius={[0,4,4,0]}>
                <Bar dataKey="h1" fill="#6366f1"   name={`🎯 HP ${ptDate(data1)}`}        stackId="d1" radius={[0,0,0,0]} maxBarSize={18}><LabelList dataKey="h1" position="insideRight" style={{fontSize:9,fontWeight:'bold',fill:'#fff'}} formatter={(v:any)=>v>0?v:''} /></Bar>
                <Bar dataKey="p1" fill="#65a30d"   name={`🏢 Pres. ${ptDate(data1)}`}     stackId="d1" radius={[0,4,4,0]}  maxBarSize={18}><LabelList dataKey="p1" position="insideRight" style={{fontSize:9,fontWeight:'bold',fill:'#fff'}} formatter={(v:any)=>v>0?v:''} /></Bar>
                  <LabelList dataKey="c1" position="insideRight"
                    style={{fontSize:10,fontWeight:'bold',fill:'#fff'}}
                    formatter={(v:any) => v > 0 ? v : ''} />
                </Bar>
                {/* data2 — barras claras empilhadas (comparação) */}
                <Bar dataKey="v2" stackId="d2" fill="#fca5a5" name="🔥 Bastão (ant)" maxBarSize={18} />
                <Bar dataKey="a2" stackId="d2" fill="#86efac" name="💬 Atend. (ant)" maxBarSize={18} />
                <Bar dataKey="c2" stackId="d2" fill="#ddd6fe" name="💬 Chat (ant)"   maxBarSize={18} radius={[0,4,4,0]}>
                <Bar dataKey="h2" fill="#c7d2fe"   name={`🎯 HP ${ptDate(data2)}`}        stackId="d2" radius={[0,0,0,0]} maxBarSize={18} />
                <Bar dataKey="p2" fill="#d9f99d"   name={`🏢 Pres. ${ptDate(data2)}`}     stackId="d2" radius={[0,4,4,0]}  maxBarSize={18} />
                  <LabelList dataKey={(d:any) => d.v2+d.a2+d.c2} position="right"
                    style={{fontSize:10,fontWeight:'bold',fill:'#9ca3af'}}
                    formatter={(v:any) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela completa — todos os consultores */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-extrabold text-gray-700 mb-3">📋 Todos os Consultores</h3>
        <table className="w-full text-sm min-w-[420px]">
          <thead><tr className="border-b-2 border-gray-100 text-xs">
            <th className="text-left font-extrabold text-gray-400 uppercase pb-2 pr-4">Consultor</th>
            <th className="font-extrabold text-red-500 pb-2 px-2 text-center">🔥 Bastão {ptDate(data1)}</th>
            <th className="font-extrabold text-gray-300 pb-2 px-2 text-center border-l border-gray-100">🔥 {ptDate(data2)}</th>
            <th className="font-extrabold pb-2 px-2 text-center" style={{color:'#22c55e'}}>💬 Atd. {ptDate(data1)}</th>
            <th className="font-extrabold text-gray-300 pb-2 px-2 text-center border-l border-gray-100">💬 {ptDate(data2)}</th>
            <th className="font-extrabold pb-2 px-2 text-center" style={{color:'#8b5cf6'}}>💬 Chat {ptDate(data1)}</th>
            <th className="font-extrabold text-gray-300 pb-2 px-2 text-center border-l border-gray-100">💬 {ptDate(data2)}</th>
            <th className="font-extrabold pb-2 px-2 text-center" style={{color:'#6366f1'}}>🎯 HP {ptDate(data1)}</th>
            <th className="font-extrabold text-gray-300 pb-2 px-2 text-center border-l border-gray-100">🎯 {ptDate(data2)}</th>
            <th className="font-extrabold pb-2 px-2 text-center" style={{color:'#65a30d'}}>🏢 Pres. {ptDate(data1)}</th>
            <th className="font-extrabold text-gray-300 pb-2 px-2 text-center border-l border-gray-100">🏢 {ptDate(data2)}</th>
          </tr></thead>
          <tbody>
            {todos.map(d => (
              <tr key={d.nome} className={`border-b border-gray-50 hover:bg-gray-50 ${d.v1 === 0 && d.v2 === 0 ? 'opacity-25' : ''}`}>
                <td className="py-1.5 pr-4 whitespace-nowrap">
                  <span className={`text-[9px] mr-1 px-1 py-0.5 rounded font-black ${d.equipe === 'EPROC' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {d.equipe === 'EPROC' ? 'EP' : 'JP'}
                  </span>
                  <span className="font-bold text-gray-700 text-xs">{d.nomeC}</span>
                </td>
                <td className="py-1.5 px-2 text-center font-black text-red-500">{d.v1 || '—'}</td>
                <td className="py-1.5 px-2 text-center text-gray-300 border-l border-gray-100">{d.v2 || '—'}</td>
                <td className="py-1.5 px-2 text-center font-bold" style={{color:'#22c55e'}}>{d.a1 || '—'}</td>
                <td className="py-1.5 px-2 text-center text-gray-300 border-l border-gray-100">{d.a2 || '—'}</td>
                <td className="py-1.5 px-2 text-center font-bold" style={{color:'#8b5cf6'}}>{(d as any).c1 || '—'}</td>
                <td className="py-1.5 px-2 text-center text-gray-300 border-l border-gray-100">{(d as any).c2 || '—'}</td>
                <td className="py-1.5 px-2 text-center font-bold" style={{color:'#6366f1'}}>{(d as any).h1 || '—'}</td>
                <td className="py-1.5 px-2 text-center text-gray-300 border-l border-gray-100">{(d as any).h2 || '—'}</td>
                <td className="py-1.5 px-2 text-center font-bold" style={{color:'#65a30d'}}>{(d as any).p1 || '—'}</td>
                <td className="py-1.5 px-2 text-center text-gray-300 border-l border-gray-100">{(d as any).p2 || '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-gray-200 bg-gray-50 text-sm font-extrabold">
            <td className="py-2 pr-4 text-gray-600 uppercase text-xs">Total</td>
            <td className="py-2 px-2 text-center font-black text-red-600">{T('v1') || '—'}</td>
            <td className="py-2 px-2 text-center text-gray-300 border-l border-gray-200">{T('v2') || '—'}</td>
            <td className="py-2 px-2 text-center font-black" style={{color:'#22c55e'}}>{T('a1') || '—'}</td>
            <td className="py-2 px-2 text-center text-gray-300 border-l border-gray-200">{T('a2') || '—'}</td>
            <td className="py-2 px-2 text-center font-black" style={{color:'#8b5cf6'}}>{T('c1') || '—'}</td>
            <td className="py-2 px-2 text-center text-gray-300 border-l border-gray-200">{T('c2') || '—'}</td>
            <td className="py-2 px-2 text-center font-black" style={{color:'#6366f1'}}>{T('h1') || '—'}</td>
            <td className="py-2 px-2 text-center text-gray-300 border-l border-gray-200">{T('h2') || '—'}</td>
            <td className="py-2 px-2 text-center font-black" style={{color:'#65a30d'}}>{T('p1') || '—'}</td>
            <td className="py-2 px-2 text-center text-gray-300 border-l border-gray-200">{T('p2') || '—'}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABA SEMANAL — bastões EPROC vs Legados por semana
// ─────────────────────────────────────────────────────────────────────────────
function AbaSemanal() {
  const METRICAS = [
    { key: 'eproc',      label: 'Bastão EPROC',    cor: '#f97316', gradFrom: 'from-orange-400', gradTo: 'to-orange-600' },
    { key: 'jpe',        label: 'Bastão Legados',  cor: '#3b82f6', gradFrom: 'from-blue-500',   gradTo: 'to-blue-700'   },
    { key: 'eproc_atd',  label: 'Atend. EPROC',   cor: '#06b6d4', gradFrom: 'from-cyan-500',   gradTo: 'to-cyan-700'   },
    { key: 'jpe_atd',    label: 'Atend. Legados',  cor: '#f59e0b', gradFrom: 'from-amber-400',  gradTo: 'to-amber-600'  },
    { key: 'eproc_chat', label: 'Chat EPROC',      cor: '#ec4899', gradFrom: 'from-pink-500',   gradTo: 'to-pink-700'   },
    { key: 'jpe_chat',   label: 'Chat Legados',    cor: '#14b8a6', gradFrom: 'from-teal-500',   gradTo: 'to-teal-700'   },
    { key: 'eproc_hp',   label: 'HP EPROC',        cor: '#6366f1', gradFrom: 'from-indigo-500', gradTo: 'to-indigo-700' },
    { key: 'jpe_hp',     label: 'HP Legados',      cor: '#e11d48', gradFrom: 'from-rose-500',   gradTo: 'to-rose-700'   },
    { key: 'eproc_pres', label: 'Pres. EPROC',     cor: '#65a30d', gradFrom: 'from-lime-500',   gradTo: 'to-lime-700'   },
    { key: 'jpe_pres',   label: 'Pres. Legados',   cor: '#9333ea', gradFrom: 'from-purple-500', gradTo: 'to-purple-700' },
  ];

  const getSem = (data: string) => {
    const d = new Date(data + 'T12:00:00'), day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  // Gerar lista de semanas dos últimos 6 meses para o seletor
  const semanasDisponiveis = (() => {
    const hoje = new Date();
    const sems: string[] = [];
    for (let i = 0; i < 26; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - i * 7);
      const k = getSem(d.toISOString().split('T')[0]);
      if (!sems.includes(k)) sems.push(k);
    }
    return sems.sort((a, b) => b.localeCompare(a));
  })();

  const [sem1, setSem1] = useState(semanasDisponiveis[1] ?? semanasDisponiveis[0]);
  const [sem2, setSem2] = useState(semanasDisponiveis[0]);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => { load(); }, [sem1, sem2]);

  async function carregarSemana(semIni: string): Promise<Record<string, number>> {
    const d = new Date(semIni + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    const semFim = d.toISOString().split('T')[0];
    const res: Record<string, number> = { eproc: 0, jpe: 0, eproc_atd: 0, jpe_atd: 0, eproc_chat: 0, jpe_chat: 0, eproc_hp: 0, jpe_hp: 0, eproc_pres: 0, jpe_pres: 0 };

    const [{ data: hist }, { data: rt }, { data: atdSem }, { data: chatSem }, { data: hpSem }, { data: presSem }] = await Promise.all([
      supabase.from('bastao_historico').select('equipe, bastoes').gte('data', semIni).lte('data', semFim).limit(5000),
      supabase.from('bastao_rotacoes').select('para_consultor').gte('data_hora', tsIni(semIni)).lte('data_hora', tsFim(semFim)).limit(5000),
      supabase.from('atendimentos_cesupe').select('consultor').gte('data', semIni).lte('data', semFim).limit(5000),
      supabase.from('dados_chat').select('consultor, atendimentos').gte('data', semIni).lte('data', semFim).limit(5000),
      supabase.from('atendimentos_hp').select('consultor, sistema').gte('data', semIni).lte('data', semFim).limit(5000),
      supabase.from('atividades_presenciais').select('consultor').gte('data', semIni).lte('data', semFim).limit(5000),
    ]);

    hist?.forEach(r => { if (r.equipe === 'EPROC') res.eproc += r.bastoes; else res.jpe += r.bastoes; });
    rt?.forEach(r => { if (EQUIPE_EPROC.includes(r.para_consultor)) res.eproc++; else res.jpe++; });
    atdSem?.forEach(r => { if (EQUIPE_EPROC.includes(r.consultor)) res.eproc_atd++; else res.jpe_atd++; });
    chatSem?.forEach(r => { const q = r.atendimentos || 0; if (EQUIPE_EPROC.includes(r.consultor)) res.eproc_chat += q; else res.jpe_chat += q; });
    hpSem?.forEach(r => { const isEproc = r.sistema?.toLowerCase().includes('eproc'); if (isEproc) res.eproc_hp++; else res.jpe_hp++; });
    presSem?.forEach(r => { if (EQUIPE_EPROC.includes(r.consultor)) res.eproc_pres++; else res.jpe_pres++; });

    return res;
  }

  async function load() {
    setLoading(true);
    const [d1, d2] = await Promise.all([carregarSemana(sem1), carregarSemana(sem2)]);
    setDados({ [sem1]: d1, [sem2]: d2 });
    setLoading(false);
  }

  const d1 = dados[sem1] ?? {};
  const d2 = dados[sem2] ?? {};
  const semLabel = (k: string) => `Sem ${ptDate(k)}`;

  // Dados para o gráfico
  const grafData = [
    { sem: semLabel(sem1), ...d1 },
    { sem: semLabel(sem2), ...d2 },
  ];

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">

      {/* Seletores de semana */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-6 items-end">
        {[{ l: 'Semana 1', v: sem1, fn: setSem1 }, { l: 'Semana 2', v: sem2, fn: setSem2 }].map(f => (
          <div key={f.l} className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-400">{f.l}</label>
            <select value={f.v} onChange={e => f.fn(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-400 bg-white">
              {semanasDisponiveis.map(s => (
                <option key={s} value={s}>Sem {ptDate(s)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Cards — 1 por métrica, total + valor por semana */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {METRICAS.map(m => {
          const v1 = d1[m.key] || 0, v2 = d2[m.key] || 0;
          const tot = v1 + v2;
          return (
            <div key={m.key} className={`rounded-2xl bg-gradient-to-br ${m.gradFrom} ${m.gradTo} p-4 text-white shadow-md`}>
              <p className="text-xs font-extrabold uppercase tracking-wide opacity-80 mb-1">{m.label}</p>
              <p className="text-3xl font-black leading-none mb-2">{tot.toLocaleString('pt-BR')}</p>
              <div className="flex flex-col gap-0.5 text-xs font-bold opacity-90 border-t border-white/20 pt-2">
                <span>{semLabel(sem1)}: {v1.toLocaleString('pt-BR')}</span>
                <span>{semLabel(sem2)}: {v2.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gráfico de colunas — 2 semanas lado a lado */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-gray-700 mb-4">📆 Registros Diários por Semana</h3>
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafData} margin={{ left: 0, right: 10, bottom: 10 }} barCategoryGap="30%" barGap={3}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="sem" tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold', fontSize: 12 }} cursor={{ fill: '#f8fafc' }} />
              <Legend
                wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                formatter={(value: string) => {
                  const m = METRICAS.find(x => x.label === value);
                  return <span style={{ fontWeight: 'bold', color: m?.cor ?? '#374151' }}>{value}</span>;
                }}
              />
              {METRICAS.map(m => (
                <Bar key={m.key} dataKey={m.key} fill={m.cor} name={m.label} radius={[4,4,0,0]} maxBarSize={36}>
                  <LabelList dataKey={m.key} position="top"
                    style={{ fontSize: 11, fontWeight: 'bold', fill: m.cor }}
                    formatter={(v: any) => v > 0 ? v : ''} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela visual */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="text-left pb-3 pr-6 w-44">
                <span className="text-xs font-extrabold text-gray-400 uppercase">Métrica</span>
              </th>
              <th className="text-center pb-3 px-6 whitespace-nowrap">
                <span className="text-sm font-extrabold text-gray-700">{semLabel(sem1)}</span>
              </th>
              <th className="text-center pb-3 px-6 whitespace-nowrap">
                <span className="text-sm font-extrabold text-gray-700">{semLabel(sem2)}</span>
              </th>
              <th className="text-center pb-3 px-6 bg-gray-50 rounded-t-lg">
                <span className="text-sm font-extrabold text-gray-500">Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m, ri) => {
              const v1 = d1[m.key] || 0, v2 = d2[m.key] || 0;
              return (
                <tr key={m.key} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${ri === 2 ? 'border-t-2 border-gray-200' : ''} ${ri === 4 ? 'border-t border-dashed border-gray-200' : ''}`}>
                  <td className="py-3 pr-6">
                    <div className="flex items-center gap-2">
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: m.cor, display: 'inline-block', flexShrink: 0 }} />
                      <span className="text-sm font-semibold" style={{ color: m.cor }}>{m.label}</span>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-center">
                    {v1 ? <span className="text-base font-extrabold" style={{ color: m.cor }}>{v1.toLocaleString('pt-BR')}</span>
                         : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="py-3 px-6 text-center">
                    {v2 ? <span className="text-base font-extrabold" style={{ color: m.cor }}>{v2.toLocaleString('pt-BR')}</span>
                         : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="py-3 px-6 text-center bg-gray-50">
                    <span className="text-base font-extrabold" style={{ color: m.cor }}>
                      {(v1+v2) > 0 ? (v1+v2).toLocaleString('pt-BR') : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ABA CERTIDÕES
// ─────────────────────────────────────────────────────────────────────────────
function AbaCertidoes({ perfil }: { perfil: string }) {
  const TIPOS     = ['Todos', 'Eletrônico', 'Físico', 'Geral'];
  const PETICOES  = ['Todas', 'Inicial', 'Recursal'];
  const VIEWS     = ['Mês', 'Semana', 'Dia'];
  const CONSULTOR_LIST = ['Todos', ...USUARIOS_SISTEMA.filter(u => u.perfil === 'Consultor').map(u => u.nome).sort()];

  const [view,        setView]        = useState<string>('Mês');
  const [filtTipo,    setFiltTipo]    = useState('Todos');
  const [filtPeticao, setFiltPeticao] = useState('Todas');
  const [filtConsult, setFiltConsult] = useState('Todos');
  const [busca,       setBusca]       = useState('');
  const [periodo, setPeriodo] = useState('Este ano');

  const { dataIni, dataFim } = (() => {
    const now = new Date();
    const ano = now.getFullYear();
    if (periodo === 'Este mês')   return { dataIni: `${ano}-${String(now.getMonth()+1).padStart(2,'0')}-01`, dataFim: hoje() };
    if (periodo === 'Este ano')   return { dataIni: `${ano}-01-01`, dataFim: hoje() };
    if (periodo === 'Ano passado') return { dataIni: `${ano-1}-01-01`, dataFim: `${ano-1}-12-31` };
    return { dataIni: '2024-01-01', dataFim: hoje() }; // Tudo
  })();

  const [rows,    setRows]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { load(); setPage(0); }, [periodo, filtTipo, filtPeticao, filtConsult]);

  async function load() {
    setLoading(true);
    let q = supabase.from('certidoes_registro')
      .select('*')
      .gte('data', dataIni).lte('data', dataFim)
      .order('data', { ascending: false })
      .limit(5000);
    if (filtTipo    !== 'Todos')  q = q.eq('tipo', filtTipo);
    if (filtPeticao !== 'Todas')  q = q.eq('peticao', filtPeticao);
    if (filtConsult !== 'Todos')  q = q.eq('consultor', filtConsult);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }

  // Busca local por processo, nome_parte, incidente, motivo
  const filtradas = rows.filter(r => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (r.processo   ?? '').toLowerCase().includes(b)
        || (r.nome_parte ?? '').toLowerCase().includes(b)
        || (r.incidente  ?? '').toLowerCase().includes(b)
        || (r.motivo     ?? '').toLowerCase().includes(b);
  });

  // Agrupamento para o gráfico
  const grafData = (() => {
    const m: Record<string, number> = {};
    filtradas.forEach(r => {
      let k = '';
      const d = new Date(r.data + 'T12:00:00');
      if (view === 'Dia')    k = ptDate(r.data);
      if (view === 'Semana') {
        const day = d.getDay(), diff = d.getDate() - day + (day===0?-6:1);
        k = ptDate(new Date(new Date(r.data+'T12:00:00').setDate(diff)).toISOString().split('T')[0]);
      }
      if (view === 'Mês')   k = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      m[k] = (m[k]||0) + 1;
    });
    return Object.entries(m).map(([label, total]) => ({ label, total }))
      .sort((a, b) => a.label.localeCompare(b.label));
  })();

  // KPIs
  const total    = filtradas.length;
  const eletr    = filtradas.filter(r => r.tipo?.toLowerCase().includes('eletr')).length;
  const fis      = filtradas.filter(r => r.tipo?.toLowerCase().includes('fis')).length;
  const inicial  = filtradas.filter(r => r.peticao === 'Inicial').length;
  const recursal = filtradas.filter(r => r.peticao === 'Recursal').length;

  // Paginação
  const paginated = filtradas.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtradas.length / PAGE_SIZE);

  const SelectFilt = ({ label, value, onChange, options }: any) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-400">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-red-400">
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-red-400">
            <option>Este mês</option>
            <option>Este ano</option>
            <option>Ano passado</option>
            <option>Tudo</option>
          </select>
        </div>
        <SelectFilt label="Tipo"      value={filtTipo}    onChange={setFiltTipo}    options={TIPOS} />
        <SelectFilt label="Petição"   value={filtPeticao} onChange={setFiltPeticao} options={PETICOES} />
        {perfil !== 'Consultor' &&
          <SelectFilt label="Consultor" value={filtConsult} onChange={setFiltConsult} options={CONSULTOR_LIST} />
        }
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Buscar</label>
          <input type="text" placeholder="Processo, parte, incidente, motivo…" value={busca} onChange={e => { setBusca(e.target.value); setPage(0); }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-red-400 w-72" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Total"     value={total}    sub={`${ptDate(dataIni)} → ${ptDate(dataFim)}`} from="from-red-500"    to="to-rose-700"   icon="📋" />
        <KpiCard label="Eletrônico" value={eletr}   sub="no período"    from="from-blue-500"   to="to-blue-700"   icon="💻" />
        <KpiCard label="Físico"    value={fis}      sub="no período"    from="from-orange-400" to="to-orange-600" icon="📄" />
        <KpiCard label="Inicial"   value={inicial}  sub="petições"      from="from-teal-500"   to="to-teal-700"   icon="📝" />
        <KpiCard label="Recursal"  value={recursal} sub="petições"      from="from-violet-500" to="to-violet-700" icon="⚖️" />
      </div>

      {/* Gráfico com seletor de visualização */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-extrabold text-gray-700">📆 Certidões por {view}</h3>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${view===v ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {grafData.length === 0
          ? <p className="text-center text-gray-400 py-8 text-sm">Sem dados no período.</p>
          : <div style={{ height: Math.max(200, grafData.length > 12 ? 280 : 240) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="total" fill="#ef4444" name="Certidões" radius={[4,4,0,0]} maxBarSize={40}>
                    <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 'bold', fill: '#ef4444' }} formatter={(v: any) => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
        }
      </div>

      {/* Tabela de registros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-extrabold text-gray-700">📋 Registros ({filtradas.length})</h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                className="px-3 py-1 rounded-lg bg-gray-100 font-bold text-gray-600 disabled:opacity-30">←</button>
              <span className="font-bold text-gray-500">{page+1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1}
                className="px-3 py-1 rounded-lg bg-gray-100 font-bold text-gray-600 disabled:opacity-30">→</button>
            </div>
          )}
        </div>
        {filtradas.length === 0
          ? <p className="text-center text-gray-400 py-8 text-sm">Nenhum registro encontrado.</p>
          : <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left">
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Data</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Consultor</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Processo</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Nome Parte</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Incidente</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Tipo</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Petição</th>
                  <th className="pb-2 font-extrabold text-gray-400 uppercase">Prazo Final</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap">{ptDate(r.data)}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-700 whitespace-nowrap">{r.consultor}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600 whitespace-nowrap">{r.processo}</td>
                    <td className="py-2 pr-3 text-gray-600 max-w-[200px] truncate" title={r.nome_parte}>{r.nome_parte}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600 whitespace-nowrap">{r.incidente}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.tipo?.toLowerCase().includes('eletr') ? 'bg-blue-100 text-blue-700' :
                        r.tipo?.toLowerCase().includes('fis')   ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{r.tipo}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.peticao === 'Inicial' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700'
                      }`}>{r.peticao}</span>
                    </td>
                    <td className="py-2 whitespace-nowrap font-semibold text-gray-600">{r.data_prazo_final ? ptDate(r.data_prazo_final) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ABA HORAS EXTRAS  (somente Gestor)
// ─────────────────────────────────────────────────────────────────────────────
function AbaHorasExtras() {
  const CONSULTOR_LIST = ['Todos', ...USUARIOS_SISTEMA.filter(u => u.perfil === 'Consultor').map(u => u.nome).sort()];

  const [periodo,     setPeriodo]     = useState('Este ano');
  const [filtConsult, setFiltConsult] = useState('Todos');
  const [busca,       setBusca]       = useState('');
  const [rows,        setRows]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(0);
  const PAGE_SIZE = 20;

  const { dataIni, dataFim } = (() => {
    const now = new Date(), ano = now.getFullYear();
    if (periodo === 'Este mês')    return { dataIni: `${ano}-${String(now.getMonth()+1).padStart(2,'0')}-01`, dataFim: hoje() };
    if (periodo === 'Este ano')    return { dataIni: `${ano}-01-01`, dataFim: hoje() };
    if (periodo === 'Ano passado') return { dataIni: `${ano-1}-01-01`, dataFim: `${ano-1}-12-31` };
    return { dataIni: '2024-01-01', dataFim: hoje() };
  })();

  useEffect(() => { load(); setPage(0); }, [periodo, filtConsult]);

  async function load() {
    setLoading(true);
    let q = supabase.from('horas_extras')
      .select('*').gte('data', dataIni).lte('data', dataFim)
      .order('data', { ascending: false }).limit(5000);
    if (filtConsult !== 'Todos') q = q.eq('consultor', filtConsult);
    const { data } = await q;
    setRows(data ?? []);
    setLoading(false);
  }

  // Parse "1h23" ou "0h45" → minutos
  const parseMins = (t: string): number => {
    if (!t) return 0;
    const comHora = t.match(/(\d+)h(\d+)/);
    if (comHora) return parseInt(comHora[1]) * 60 + parseInt(comHora[2]);
    const soHora = t.match(/^(\d+)h$/);
    if (soHora) return parseInt(soHora[1]) * 60;
    const soMin = t.match(/(\d+)m/);
    if (soMin) return parseInt(soMin[1]);
    return parseInt(t) || 0;
  };
  const fmtMins = (mins: number): string => {
    const h = Math.floor(mins / 60), m = mins % 60;
    return `${h}h${String(m).padStart(2,'0')}`;
  };

  const filtradas = rows.filter(r => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (r.consultor ?? '').toLowerCase().includes(b)
        || (r.motivo    ?? '').toLowerCase().includes(b);
  });

  // KPIs
  const totalMins    = filtradas.reduce((s, r) => s + parseMins(r.tempo_total), 0);
  const totalRegistros = filtradas.length;

  // Ranking por consultor
  const porConsultor: Record<string, { qtd: number; mins: number }> = {};
  filtradas.forEach(r => {
    if (!porConsultor[r.consultor]) porConsultor[r.consultor] = { qtd: 0, mins: 0 };
    porConsultor[r.consultor].qtd++;
    porConsultor[r.consultor].mins += parseMins(r.tempo_total);
  });
  const ranking = Object.entries(porConsultor)
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.mins - a.mins);

  // Gráfico por mês
  const porMes: Record<string, number> = {};
  filtradas.forEach(r => {
    const d = new Date(r.data + 'T12:00:00');
    const k = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    porMes[k] = (porMes[k] || 0) + parseMins(r.tempo_total);
  });
  const grafData = Object.entries(porMes)
    .map(([label, mins]) => ({ label, horas: parseFloat((mins/60).toFixed(1)) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const paginated  = filtradas.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtradas.length / PAGE_SIZE);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-amber-400">
            <option>Este mês</option>
            <option>Este ano</option>
            <option>Ano passado</option>
            <option>Tudo</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Consultor</label>
          <select value={filtConsult} onChange={e => { setFiltConsult(e.target.value); setPage(0); }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-amber-400">
            {CONSULTOR_LIST.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Buscar</label>
          <input type="text" placeholder="Consultor ou motivo…" value={busca}
            onChange={e => { setBusca(e.target.value); setPage(0); }}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-amber-400 w-64" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total Horas"    value={fmtMins(totalMins) as any} sub={`${ptDate(dataIni)} → ${ptDate(dataFim)}`} from="from-amber-400"  to="to-amber-600"   icon="⏰" />
        <KpiCard label="Registros"      value={totalRegistros}             sub="ocorrências"                               from="from-orange-400" to="to-orange-600"  icon="📋" />
        <KpiCard label="Consultores"    value={ranking.length}             sub="com horas extras"                          from="from-rose-500"   to="to-rose-700"    icon="👥" />
        <KpiCard label="Média/Registro" value={totalRegistros > 0 ? fmtMins(Math.round(totalMins/totalRegistros)) as any : '—'} sub="por ocorrência" from="from-indigo-500" to="to-indigo-700" icon="📊" />
      </div>

      {/* Gráfico por mês */}
      {grafData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-700 mb-4">⏰ Horas Extras por Mês</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafData} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', fontWeight: 'bold' }}
                  formatter={(v: any) => [`${v}h`, 'Horas extras']}
                  cursor={{ fill: '#fef9f0' }} />
                <Bar dataKey="horas" fill="#f59e0b" name="Horas extras" radius={[4,4,0,0]} maxBarSize={44}>
                  <LabelList dataKey="horas" position="top"
                    style={{ fontSize: 11, fontWeight: 'bold', fill: '#d97706' }}
                    formatter={(v: any) => v > 0 ? `${v}h` : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ranking por consultor */}
      {ranking.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-extrabold text-gray-700 mb-3">🏆 Ranking por Consultor</h3>
          <div className="flex flex-col gap-2">
            {ranking.map((r, i) => {
              const pct = Math.round((r.mins / totalMins) * 100);
              const equipe = EQUIPE_EPROC.includes(r.nome) ? 'EPROC' : 'JPE';
              return (
                <div key={r.nome} className="flex items-center gap-3">
                  <span className="text-xs font-extrabold text-gray-400 w-5 text-right">{i+1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-700">
                        {r.nome.split(' ')[0]} {r.nome.split(' ').slice(-1)[0]}
                        <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${equipe==='EPROC' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{equipe}</span>
                      </span>
                      <span className="text-sm font-extrabold text-amber-600">{fmtMins(r.mins)} <span className="text-xs text-gray-400 font-normal">({r.qtd} reg.)</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela de registros */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-extrabold text-gray-700">📋 Registros ({filtradas.length})</h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                className="px-3 py-1 rounded-lg bg-gray-100 font-bold text-gray-600 disabled:opacity-30">←</button>
              <span className="font-bold text-gray-500">{page+1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1}
                className="px-3 py-1 rounded-lg bg-gray-100 font-bold text-gray-600 disabled:opacity-30">→</button>
            </div>
          )}
        </div>
        {filtradas.length === 0
          ? <p className="text-center text-gray-400 py-8 text-sm">Nenhum registro encontrado.</p>
          : <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left">
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Data</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Consultor</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Início</th>
                  <th className="pb-2 pr-3 font-extrabold text-gray-400 uppercase">Total</th>
                  <th className="pb-2 font-extrabold text-gray-400 uppercase">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                    <td className="py-2 pr-3 font-bold text-gray-700 whitespace-nowrap">{ptDate(r.data)}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-700 whitespace-nowrap">
                      {r.consultor?.split(' ')[0]} {r.consultor?.split(' ').slice(-1)[0]}
                    </td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{r.hora_inicio?.slice(0,5)}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-extrabold">{r.tempo_total}</span>
                    </td>
                    <td className="py-2 text-gray-500 max-w-xs truncate" title={r.motivo}>{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}




// ─────────────────────────────────────────────────────────────────────────────
// ABA STATUS DETALHADO — tempo por status + complemento por consultor
// Cruza registros_status (detalhes) + atividades_presenciais (atividade)
// ─────────────────────────────────────────────────────────────────────────────
function AbaStatusDetalhado() {
  // hojeLocal: evita bug do toISOString() que converte para UTC e avança o dia no fuso BR
  const hojeLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const STATUS_COR: Record<string, string> = {
    'Bastão':            '#ef4444',
    'Projeto':           '#6366f1',
    'Atividades':        '#3b82f6',
    'Sessão':            '#f43f5e',
    'Treinamento':       '#8b5cf6',
    'Reunião':           '#14b8a6',
    'Atend. Presencial': '#f97316',
    'Almoço':            '#f59e0b',
    'Lanche':            '#84cc16',
    'Indisponível':      '#9ca3af',
  };

  const CONSULTOR_LIST = ['Todos', ...USUARIOS_SISTEMA.filter(u => u.perfil === 'Consultor').map(u => u.nome).sort()];

  const [loading,      setLoading]      = useState(true);
  const [periodoTipo,  setPeriodoTipo]  = useState<'dia' | 'semana' | 'mes'>('dia');
  const [dataCustom,   setDataCustom]   = useState(hoje());
  const [filtConsult,  setFiltConsult]  = useState('Todos');
  const [expandidos,   setExpandidos]   = useState<Set<string>>(new Set());

  // Estrutura: { [consultor]: { [status]: { total: number, itens: { label: string, min: number }[] } } }
  const [dados, setDados] = useState<Record<string, Record<string, { total: number; itens: { label: string; min: number }[] }>>>({});
  const [totaisStatus, setTotaisStatus] = useState<Record<string, number>>({});

  // ── Calcular range de datas ──────────────────────────────────────────────
  const { dataIni, dataFim, labelPeriodo } = useMemo(() => {
    const fmtLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    if (periodoTipo === 'dia') {
      return { dataIni: dataCustom, dataFim: dataCustom, labelPeriodo: dataCustom === hoje() ? 'Hoje' : ptDate(dataCustom) };
    }
    if (periodoTipo === 'semana') {
      const now = new Date(); const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const semIni = new Date(now); semIni.setDate(now.getDate() + diffToMon);
      const semFim = new Date(semIni); semFim.setDate(semIni.getDate() + 6);
      return { dataIni: fmtLocal(semIni), dataFim: fmtLocal(semFim), labelPeriodo: `Seg ${ptDate(fmtLocal(semIni))} → Dom ${ptDate(fmtLocal(semFim))}` };
    }
    // mês
    const now = new Date(); const ano = now.getFullYear(), mes = now.getMonth() + 1;
    const mesStr = String(mes).padStart(2, '0');
    const diasMes = new Date(ano, mes, 0).getDate();
    return { dataIni: `${ano}-${mesStr}-01`, dataFim: `${ano}-${mesStr}-${diasMes}`, labelPeriodo: `${MESES_PT[mes-1]}/${ano}` };
  }, [periodoTipo, dataCustom]);

  useEffect(() => { load(); }, [dataIni, dataFim, filtConsult]);

  async function load() {
    setLoading(true);
    try {
      // Usa filtro por timestamp (inicio) em vez de coluna "data" para evitar bug de timezone UTC
      // A coluna "data" pode estar um dia à frente para registros criados após 21h no Brasil (UTC-3)
      const tsIniLocal = dataIni + 'T00:00:00';
      const tsFimLocal = dataFim + 'T23:59:59';

      // Query 1: registros_status — ORDENADO por consultor + inicio para calcular gaps
      let q1 = supabase.from('registros_status')
        .select('consultor, status, detalhes, duracao_min, inicio, fim')
        .gte('inicio', tsIniLocal).lte('inicio', tsFimLocal)
        .order('consultor').order('inicio')
        .limit(10000);
      if (filtConsult !== 'Todos') q1 = q1.eq('consultor', filtConsult);
      const { data: statusData } = await q1;

      // Query 2: atividades_presenciais — Sessão, Treinamento, Reunião, Presencial com detalhe
      let q2 = supabase.from('atividades_presenciais')
        .select('consultor, atividade, duracao_min')
        .gte('data', dataIni).lte('data', dataFim).limit(10000);
      if (filtConsult !== 'Todos') q2 = q2.eq('consultor', filtConsult);
      const { data: ativData } = await q2;

      // ── Montar estrutura agrupada ────────────────────────────────────────
      const mapa: Record<string, Record<string, { total: number; itens: Record<string, number> }>> = {};

      const addEntry = (consultor: string, status: string, label: string, min: number) => {
        if (!mapa[consultor]) mapa[consultor] = {};
        if (!mapa[consultor][status]) mapa[consultor][status] = { total: 0, itens: {} };
        mapa[consultor][status].total += min;
        const key = label.trim() || '(sem detalhe)';
        mapa[consultor][status].itens[key] = (mapa[consultor][status].itens[key] || 0) + min;
      };

      // ── Agrupar registros por consultor e processar com janela 08h–20h ──
      // Regra: só considera registros entre 08:00 e 20:00.
      // A partir do PRIMEIRO registro do consultor, computa até 8 horas à frente (teto da sessão).
      // Gaps entre registros = Indisponível.
      const porConsultor: Record<string, typeof statusData> = {};
      statusData?.forEach(r => {
        // Filtra apenas registros que COMEÇAM entre 08:00 e 20:00 (horário local)
        const iniDate  = new Date(r.inicio);
        const iniHora  = iniDate.getHours() + iniDate.getMinutes() / 60;
        if (iniHora < 8 || iniHora >= 20) return;
        if (!porConsultor[r.consultor]) porConsultor[r.consultor] = [];
        porConsultor[r.consultor].push(r);
      });

      Object.entries(porConsultor).forEach(([consultor, registros]) => {
        if (!registros || registros.length === 0) return;

        // Teto da sessão: inicio do primeiro registro + 8 horas
        const iniSessao  = new Date(registros[0].inicio).getTime();
        const tetoSessao = iniSessao + 8 * 60 * 60 * 1000; // +8h em ms
        const tetoMs     = Math.min(tetoSessao, new Date(`${dataFim}T20:00:00`).getTime());

        registros.forEach((r, idx) => {
          const iniMs = new Date(r.inicio).getTime();
          // Fim real: usa r.fim se existir, senão agora — mas nunca passa do teto
          const fimMs = Math.min(
            r.fim ? new Date(r.fim).getTime() : Date.now(),
            tetoMs
          );
          if (fimMs <= iniMs) return;

          const dur = Math.round((fimMs - iniMs) / 60000);
          if (dur > 0) {
            addEntry(consultor, r.status || 'Bastão', r.detalhes || '', dur);
          }

          // Gap até o próximo registro = Indisponível
          const prox = registros[idx + 1];
          if (prox) {
            const iniProxMs = Math.min(new Date(prox.inicio).getTime(), tetoMs);
            const gapMin    = Math.round((iniProxMs - fimMs) / 60000);
            if (gapMin > 1) {
              addEntry(consultor, 'Indisponível', '', gapMin);
            }
          }
        });
      });

      // Processa atividades_presenciais — complementa/substitui o detalhe dos status presenciais
      // Determina o status pai a partir do texto da atividade
      const STATUS_PRESENCIAIS = ['Sessão', 'Treinamento', 'Reunião', 'Atend. Presencial'];
      ativData?.forEach(r => {
        if (!r.duracao_min || r.duracao_min <= 0) return;
        const atv = r.atividade || '';
        // Detecta qual status pai é
        let statusPai = 'Atend. Presencial';
        if (/sess[aã]/i.test(atv))      statusPai = 'Sessão';
        else if (/treina/i.test(atv))   statusPai = 'Treinamento';
        else if (/reuni[aã]/i.test(atv)) statusPai = 'Reunião';

        if (!mapa[r.consultor]?.[statusPai]) return; // só enriquece se o status já existe via registros_status
        // Substitui "(sem detalhe)" pelo texto da atividade
        const itensPai = mapa[r.consultor][statusPai].itens;
        if (itensPai['(sem detalhe)']) {
          const semDet = itensPai['(sem detalhe)'];
          delete itensPai['(sem detalhe)'];
          itensPai[atv] = (itensPai[atv] || 0) + semDet;
        } else {
          itensPai[atv] = (itensPai[atv] || 0) + r.duracao_min;
        }
      });

      // Converte para array e ordena
      const final: Record<string, Record<string, { total: number; itens: { label: string; min: number }[] }>> = {};
      Object.entries(mapa).forEach(([cons, statuses]) => {
        final[cons] = {};
        Object.entries(statuses).forEach(([st, { total, itens }]) => {
          final[cons][st] = {
            total,
            itens: Object.entries(itens)
              .map(([label, min]) => ({ label, min }))
              .sort((a, b) => b.min - a.min),
          };
        });
      });

      // Totais globais por status (para KPIs)
      const tots: Record<string, number> = {};
      Object.values(final).forEach(statuses => {
        Object.entries(statuses).forEach(([st, { total }]) => {
          tots[st] = (tots[st] || 0) + total;
        });
      });

      setDados(final);
      setTotaisStatus(tots);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const toggleExpandido = (nome: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  };

  const consultoresComDados = Object.keys(dados).sort();
  const totalMinGeral = Object.values(totaisStatus).reduce((s, v) => s + v, 0);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['dia', 'semana', 'mes'] as const).map(p => {
            const labels = { dia: '📅 Dia', semana: '📆 Semana', mes: '🗓️ Mês' };
            return (
              <button key={p} onClick={() => setPeriodoTipo(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  periodoTipo === p ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {labels[p]}
              </button>
            );
          })}
        </div>
        {periodoTipo === 'dia' && (
          <input type="date" value={dataCustom} max={hoje()}
            onChange={e => setDataCustom(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-400 bg-white" />
        )}
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
          📅 {labelPeriodo}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-400">Consultor</label>
          <select value={filtConsult} onChange={e => setFiltConsult(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-indigo-400">
            {CONSULTOR_LIST.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPIs por status ──────────────────────────────────────────────── */}
      {Object.keys(totaisStatus).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(totaisStatus)
            .sort((a, b) => b[1] - a[1])
            .map(([st, min]) => (
              <div key={st} className="rounded-2xl p-4 text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${STATUS_COR[st] || '#64748b'}dd, ${STATUS_COR[st] || '#64748b'})` }}>
                <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-80 mb-1">{st}</p>
                <p className="text-2xl font-black leading-none">{fmtMin(min)}</p>
                <p className="text-xs opacity-70 mt-1">{Math.round((min / totalMinGeral) * 100)}% do total</p>
              </div>
            ))}
        </div>
      )}

      {/* ── Cards por Consultor ───────────────────────────────────────────── */}
      {consultoresComDados.length === 0
        ? <p className="text-center text-gray-400 py-12 text-sm">Nenhum registro encontrado para este período.</p>
        : (
          <div className="flex flex-col gap-3">
            {consultoresComDados.map(consultor => {
              const statuses = dados[consultor];
              const totalConsultor = Object.values(statuses).reduce((s, v) => s + v.total, 0);
              const isExpand = expandidos.has(consultor);
              const equipe = EQUIPE_EPROC.includes(consultor) ? 'EPROC' : 'JPE';

              // Ordena status por tempo total (maior primeiro)
              const statusOrdenados = Object.entries(statuses).sort((a, b) => b[1].total - a[1].total);

              return (
                <div key={consultor} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Header do consultor */}
                  <button
                    onClick={() => toggleExpandido(consultor)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${equipe === 'EPROC' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {equipe}
                      </span>
                      <span className="font-extrabold text-gray-800">{consultor}</span>
                      <span className="text-xs text-gray-400 font-bold">{fmtMin(totalConsultor)} total</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Mini barras de status */}
                      <div className="hidden sm:flex items-center gap-1">
                        {statusOrdenados.slice(0, 5).map(([st, { total }]) => (
                          <span key={st} className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: (STATUS_COR[st] || '#94a3b8') + '22', color: STATUS_COR[st] || '#94a3b8' }}>
                            {st.split(' ')[0]}: {fmtMin(total)}
                          </span>
                        ))}
                      </div>
                      <span className={`text-gray-400 transition-transform duration-200 ${isExpand ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </button>

                  {/* Detalhe expandido */}
                  {isExpand && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {statusOrdenados.map(([st, { total, itens }]) => (
                          <div key={st} className="rounded-xl border p-4"
                            style={{ borderColor: (STATUS_COR[st] || '#94a3b8') + '44', background: (STATUS_COR[st] || '#94a3b8') + '08' }}>
                            {/* Header do status */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-extrabold" style={{ color: STATUS_COR[st] || '#374151' }}>
                                {st}
                              </span>
                              <span className="text-sm font-black px-2 py-0.5 rounded-lg"
                                style={{ background: (STATUS_COR[st] || '#94a3b8') + '22', color: STATUS_COR[st] || '#374151' }}>
                                {fmtMin(total)}
                              </span>
                            </div>
                            {/* Itens com complemento */}
                            <div className="flex flex-col gap-1.5">
                              {itens.map(({ label, min }) => {
                                const pct = Math.round((min / total) * 100);
                                return (
                                  <div key={label}>
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-xs text-gray-600 font-semibold truncate max-w-[70%]" title={label}>
                                        {label === '(sem detalhe)' ? <span className="text-gray-300 italic">sem detalhe</span> : label}
                                      </span>
                                      <span className="text-xs font-extrabold" style={{ color: STATUS_COR[st] || '#374151' }}>
                                        {fmtMin(min)}
                                      </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-1.5 rounded-full transition-all"
                                        style={{ width: `${pct}%`, background: STATUS_COR[st] || '#94a3b8' }} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Tabela consolidada ───────────────────────────────────────────── */}
      {consultoresComDados.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-x-auto">
          <h3 className="text-sm font-extrabold text-gray-700 mb-4">📋 Resumo Consolidado — {labelPeriodo}</h3>
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left pb-2 pr-4 font-extrabold text-gray-400 uppercase">Consultor</th>
                {Object.keys(totaisStatus).sort((a,b) => (totaisStatus[b]||0)-(totaisStatus[a]||0)).map(st => (
                  <th key={st} className="pb-2 px-2 text-center font-extrabold whitespace-nowrap"
                    style={{ color: STATUS_COR[st] || '#64748b' }}>
                    {st}
                  </th>
                ))}
                <th className="pb-2 px-2 text-center font-extrabold text-gray-600 uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {consultoresComDados.map(consultor => {
                const statuses = dados[consultor];
                const totalCons = Object.values(statuses).reduce((s, v) => s + v.total, 0);
                const equipe = EQUIPE_EPROC.includes(consultor) ? 'EPROC' : 'JPE';
                return (
                  <tr key={consultor} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className={`text-[9px] mr-1.5 px-1 py-0.5 rounded font-black ${equipe === 'EPROC' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {equipe === 'EPROC' ? 'EP' : 'JP'}
                      </span>
                      <span className="font-bold text-gray-700">{consultor.split(' ')[0]} {consultor.split(' ').slice(-1)[0]}</span>
                    </td>
                    {Object.keys(totaisStatus).sort((a,b) => (totaisStatus[b]||0)-(totaisStatus[a]||0)).map(st => (
                      <td key={st} className="py-2 px-2 text-center">
                        {statuses[st]
                          ? <span className="font-bold text-xs px-1.5 py-0.5 rounded"
                              style={{ background: (STATUS_COR[st]||'#94a3b8')+'18', color: STATUS_COR[st]||'#374151' }}>
                              {fmtMin(statuses[st].total)}
                            </span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    ))}
                    <td className="py-2 px-2 text-center font-black text-gray-700">{fmtMin(totalCons)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="py-2 pr-4 text-xs font-extrabold text-gray-500 uppercase">Total</td>
                {Object.keys(totaisStatus).sort((a,b) => (totaisStatus[b]||0)-(totaisStatus[a]||0)).map(st => (
                  <td key={st} className="py-2 px-2 text-center font-black"
                    style={{ color: STATUS_COR[st] || '#374151' }}>
                    {fmtMin(totaisStatus[st] || 0)}
                  </td>
                ))}
                <td className="py-2 px-2 text-center font-black text-gray-900">{fmtMin(totalMinGeral)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}



export function PainelGerencial({ inline = false, perfil = 'Gestor' }: { inline?: boolean; perfil?: string }) {
  const isConsultor = perfil === 'Consultor';
  const abas = isConsultor
    ? ['Geral', 'Semanal', 'Certidões']
    : ['Auditoria', 'Geral', 'Diário', 'Semanal', 'Certidões', 'Horas Extras', 'Status'];
  const icons: Record<string, string> = { 'Auditoria': '🔍', 'Geral': '📊', 'Diário': '📅', 'Semanal': '📆', 'Certidões': '📋', 'Horas Extras': '⏰', 'Status': '⏱️' };
  const [aba, setAba] = useState(isConsultor ? 'Geral' : 'Auditoria');

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 w-full ${inline ? '' : 'mt-6'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 px-6 py-4 gap-3">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">📊 Dados Cesupe</h2>
          <p className="text-xs text-gray-400 mt-0.5">Bastões · Atendimentos · Equipe</p>
        </div>
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl">
          {abas.map(a => (
            <button key={a} onClick={() => setAba(a)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${aba === a ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-800'}`}>
              {icons[a]} {a}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="p-6">
        {aba === 'Auditoria' && <AbaAuditoria />}
        {aba === 'Geral'     && <AbaGeral perfil={perfil} />}
        {aba === 'Diário'    && <AbaDiario />}
        {aba === 'Semanal'   && <AbaSemanal />}
        {aba === 'Certidões'    && <AbaCertidoes perfil={perfil} />}
        {aba === 'Horas Extras' && <AbaHorasExtras />}
        {aba === 'Status'       && <AbaStatusDetalhado />}
      </div>
    </div>
  );
}
