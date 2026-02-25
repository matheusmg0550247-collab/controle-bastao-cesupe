import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

export function PainelGerencial() {
  const [abaAtiva, setAbaAtiva] = useState('Ranking');
  const [loading, setLoading] = useState(false);
  const [dadosSemanal, setDadosSemanal] = useState<any[]>([]);
  const [dadosHe, setDadosHe] = useState<any[]>([]);
  const [certidoes, setCertidoes] = useState<any[]>([]);
  const [dadosRanking, setDadosRanking] = useState<any[]>([]);
  const [diario, setDiario] = useState<{ hoje: any[]; ontem: any[]; dataHoje: string; dataOntem: string }>({ hoje: [], ontem: [], dataHoje: '', dataOntem: '' });
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [buscaCertidao, setBuscaCertidao] = useState('');
  const [certidaoExpandida, setCertidaoExpandida] = useState<any>(null);
  const [diaAtivo, setDiaAtivo] = useState<'hoje' | 'ontem' | 'ambos'>('hoje');

  useEffect(() => {
    if (abaAtiva === 'Ranking' && dadosRanking.length === 0) fetchRanking();
    if (abaAtiva === 'Diário' && diario.dataHoje === '') fetchDiario();
    if (abaAtiva === 'Semanal' && dadosSemanal.length === 0) fetchSemanal();
    if (abaAtiva === 'H. Extras' && dadosHe.length === 0) fetchHorasExtras();
    if (abaAtiva === 'Certidões' && certidoes.length === 0) fetchCertidoes();
  }, [abaAtiva]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const { data } = await supabase.from('daily_logs').select('consultor, payload').eq('source', 'bastao_pass').eq('date', hoje);
      if (data) setDadosRanking(data.map((d: any) => ({ nome: d.consultor, bastoes: (d.payload as any)?.bastoes_assumidos || 0 })).filter((d: any) => d.bastoes > 0).sort((a: any, b: any) => b.bastoes - a.bastoes).slice(0, 15));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchDiario = async () => {
    setLoading(true);
    try {
      const d14 = new Date(); d14.setDate(d14.getDate() - 14);
      const { data } = await supabase.from('daily_logs').select('date, consultor, payload').eq('source', 'consolidado').gte('date', d14.toISOString().split('T')[0]).order('date', { ascending: false });
      if (data) {
        const datas = [...new Set(data.map(d => d.date))].sort().reverse();
        const parseDia = (dt: string) => data.filter(d => d.date === dt).map(d => {
          const a = (d.payload as any)?.atendimentos || {};
          const c = parseInt(a.chat) || 0, b = parseInt(a.bastao) || 0, h = parseInt(a.hp) || 0, at = parseInt(a.atividade) || 0;
          return { nome: d.consultor, chat: c, bastao: b, hp: h, atividade: at, total: c + b + h + at };
        }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
        setDiario({ hoje: parseDia(datas[0] || ''), ontem: parseDia(datas[1] || ''), dataHoje: datas[0] || '', dataOntem: datas[1] || '' });
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchSemanal = async () => {
    setLoading(true);
    try { const { data } = await supabase.from('atendimentos_resumo').select('*').eq('id', 2).single(); if (data?.data?.totais_por_relatorio) setDadosSemanal(data.data.totais_por_relatorio); } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchHorasExtras = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('horas_extras').select('*').order('data', { ascending: false }).limit(500);
      if (data) {
        const ag = data.reduce((acc: any, c: any) => {
          if (!c.data) return acc; const m = c.data.substring(0, 7); let min = 0; const t = c.tempo_total || '';
          const mH = t.match(/(\d+)h/i); const mM = t.match(/(\d+)m/i);
          if (mH) min += parseInt(mH[1]) * 60; if (mM) min += parseInt(mM[1]);
          if (!mH && !mM && !isNaN(parseInt(t))) min += parseInt(t);
          if (!acc[m]) acc[m] = { mes: m, horas: 0 }; acc[m].horas += (min / 60); return acc;
        }, {});
        setDadosHe(Object.values(ag).sort((a: any, b: any) => a.mes.localeCompare(b.mes)));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCertidoes = async () => {
    setLoading(true);
    try { const { data } = await supabase.from('certidoes_registro').select('*').order('data', { ascending: false }).limit(1000); if (data) setCertidoes(data); } catch (err) { console.error(err); }
    setLoading(false);
  };

  const normTipo = (t: string) => { if (!t) return 'Geral'; const l = t.toLowerCase(); if (l.includes('eletr')) return 'Eletrônica'; if (l.includes('fís') || l.includes('fis')) return 'Física'; return 'Geral'; };
  const certFiltradas = certidoes.filter(c => { const ok1 = filtroTipo === 'Todos' || normTipo(c.tipo) === filtroTipo; const term = buscaCertidao.toLowerCase(); return ok1 && (term === '' || [c.processo, c.incidente, c.nome_parte, c.consultor].some(f => f?.toLowerCase().includes(term))); });
  const fmtBR = (d: string) => { if (!d) return ''; const [, m, day] = d.split('-'); return `${day}/${m}`; };

  const dadosGrafico = (diaAtivo === 'ontem' ? diario.ontem : diario.hoje).slice(0, 15).reverse();

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 w-full mt-6">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 mb-6 gap-4">
        <h2 className="text-2xl font-black text-indigo-900">📊 Dashboard Gerencial</h2>
        <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl">
          {['Ranking', 'Diário', 'Semanal', 'H. Extras', 'Certidões'].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === aba ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>{aba}</button>
          ))}
        </div>
      </div>

      <div className="min-h-[400px] w-full bg-gray-50 rounded-xl border border-gray-200 p-6">
        {loading && <p className="text-center font-bold text-gray-500 mt-10 animate-pulse">Consultando...</p>}

        {/* RANKING */}
        {!loading && abaAtiva === 'Ranking' && (
          <div className="w-full h-[400px]">
            <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">Top Bastões Hoje</h3>
            {dadosRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosRanking}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nome" tick={{ fill: '#6b7280', fontWeight: 'bold', fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={70} /><YAxis /><Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} /><Bar dataKey="bastoes" fill="#D4AF37" radius={[6, 6, 0, 0]} name="Bastões" /></BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum bastão hoje.</p>}
          </div>
        )}

        {/* DIÁRIO - 2 DIAS */}
        {!loading && abaAtiva === 'Diário' && (
          <div className="w-full">
            <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
              <div className="flex gap-2">
                <button onClick={() => setDiaAtivo('hoje')} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${diaAtivo === 'hoje' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-600 border-gray-200'}`}>📅 Hoje ({fmtBR(diario.dataHoje)})</button>
                <button onClick={() => setDiaAtivo('ontem')} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${diaAtivo === 'ontem' ? 'bg-gray-700 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>📅 Anterior ({fmtBR(diario.dataOntem)})</button>
                <button onClick={() => setDiaAtivo('ambos')} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${diaAtivo === 'ambos' ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-gray-600 border-gray-200'}`}>🔄 Comparar</button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-[11px] font-black border border-green-200">💬 Chat</span>
                <span className="px-2 py-1 rounded bg-orange-100 text-orange-800 text-[11px] font-black border border-orange-200">🔥 Bastão</span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-[11px] font-black border border-blue-200">🎧 HP</span>
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 text-[11px] font-black border border-purple-200">📋 Atividade</span>
              </div>
            </div>

            {diaAtivo !== 'ambos' && (
              <div style={{ height: Math.max(450, dadosGrafico.length * 38) }} className="w-full">
                <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">
                  Atendimentos — {diaAtivo === 'hoje' ? fmtBR(diario.dataHoje) : fmtBR(diario.dataOntem)}
                </h3>
                {dadosGrafico.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <YAxis
                        dataKey="nome"
                        type="category"
                        tick={{ fill: '#374151', fontWeight: 700, fontSize: 12 }}
                        width={140}
                      />
                      <XAxis type="number" />
                      <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} />
                      <Legend />
                      <Bar dataKey="chat" stackId="a" fill="#22c55e" name="💬 Chat" />
                      <Bar dataKey="bastao" stackId="a" fill="#f97316" name="🔥 Bastão" />
                      <Bar dataKey="hp" stackId="a" fill="#3b82f6" name="🎧 HP" />
                      <Bar dataKey="atividade" stackId="a" fill="#a855f7" name="📋 Atividade" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-gray-400 mt-20">Nenhum dado.</p>}
              </div>
            )}

            {/* TABELA COMPARATIVA */}
            {diaAtivo === 'ambos' && (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left p-3 font-black text-gray-600 text-xs">Consultor</th>
                      <th className="p-2 text-center" colSpan={5}><span className="text-xs font-black text-gray-500">📅 {fmtBR(diario.dataOntem)}</span></th>
                      <th className="p-2 text-center border-l-2 border-gray-300" colSpan={5}><span className="text-xs font-black text-indigo-600">📅 {fmtBR(diario.dataHoje)}</span></th>
                    </tr>
                    <tr className="bg-gray-50 text-[10px] font-black">
                      <th></th><th className="p-1 text-green-700">💬</th><th className="p-1 text-orange-700">🔥</th><th className="p-1 text-blue-700">🎧</th><th className="p-1 text-purple-700">📋</th><th className="p-1 text-gray-600">Tot</th>
                      <th className="p-1 text-green-700 border-l-2 border-gray-300">💬</th><th className="p-1 text-orange-700">🔥</th><th className="p-1 text-blue-700">🎧</th><th className="p-1 text-purple-700">📋</th><th className="p-1 text-gray-600">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const nomes = new Set([...diario.hoje.map(d => d.nome), ...diario.ontem.map(d => d.nome)]);
                      const oM = Object.fromEntries(diario.ontem.map(d => [d.nome, d]));
                      const hM = Object.fromEntries(diario.hoje.map(d => [d.nome, d]));
                      return [...nomes].sort((a, b) => ((hM[b]?.total || 0) + (oM[b]?.total || 0)) - ((hM[a]?.total || 0) + (oM[a]?.total || 0))).map((nome, i) => {
                        const o = oM[nome] || { chat: 0, bastao: 0, hp: 0, atividade: 0, total: 0 };
                        const h = hM[nome] || { chat: 0, bastao: 0, hp: 0, atividade: 0, total: 0 };
                        const diff = h.total - o.total;
                        const cell = (v: number, cor: string) => <td className="p-1 text-center"><span className={`px-1 py-0.5 rounded text-[11px] font-black ${v > 0 ? cor : 'text-gray-300'}`}>{v || '-'}</span></td>;
                        return (
                          <tr key={nome} className={`border-b border-gray-100 hover:bg-indigo-50/30 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                            <td className="p-2 font-bold text-gray-800 text-xs whitespace-nowrap">{nome}</td>
                            {cell(o.chat, 'bg-green-100 text-green-800')}{cell(o.bastao, 'bg-orange-100 text-orange-800')}{cell(o.hp, 'bg-blue-100 text-blue-800')}{cell(o.atividade, 'bg-purple-100 text-purple-800')}
                            <td className="p-1 text-center font-black text-xs text-gray-600">{o.total || '-'}</td>
                            <td className="p-1 text-center border-l-2 border-gray-200"><span className={`px-1 py-0.5 rounded text-[11px] font-black ${h.chat > 0 ? 'bg-green-100 text-green-800' : 'text-gray-300'}`}>{h.chat || '-'}</span></td>
                            {cell(h.bastao, 'bg-orange-100 text-orange-800')}{cell(h.hp, 'bg-blue-100 text-blue-800')}{cell(h.atividade, 'bg-purple-100 text-purple-800')}
                            <td className="p-1 text-center">
                              <span className="font-black text-xs text-gray-800">{h.total || '-'}</span>
                              {diff !== 0 && o.total > 0 && <span className={`ml-1 text-[10px] font-black ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>{diff > 0 ? `▲${diff}` : `▼${Math.abs(diff)}`}</span>}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SEMANAL */}
        {!loading && abaAtiva === 'Semanal' && (
          <div className="w-full h-[400px]">
            <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">Resumo Semanal</h3>
            {dadosSemanal.length > 0 ? (<ResponsiveContainer width="100%" height="100%"><BarChart data={dadosSemanal}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nome" tick={{ fill: '#6b7280', fontWeight: 'bold' }} /><YAxis /><Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} /><Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} name="Total" /></BarChart></ResponsiveContainer>) : <p className="text-center text-gray-400 mt-20">Nenhum dado.</p>}
          </div>
        )}

        {/* H. EXTRAS */}
        {!loading && abaAtiva === 'H. Extras' && (
          <div className="w-full h-[300px]">
            <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">Horas Extras</h3>
            {dadosHe.length > 0 && (<ResponsiveContainer width="100%" height="100%"><BarChart data={dadosHe}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" tick={{ fill: '#6b7280', fontWeight: 'bold' }} /><YAxis /><Tooltip formatter={(v: number | string) => typeof v === 'number' ? v.toFixed(1) + 'h' : v} cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} /><Bar dataKey="horas" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Horas" /></BarChart></ResponsiveContainer>)}
          </div>
        )}

        {/* CERTIDÕES */}
        {!loading && abaAtiva === 'Certidões' && (
          <div className="w-full">
            <h3 className="text-gray-500 font-bold mb-4 uppercase tracking-wider">Certidões</h3>
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex-1"><input type="text" value={buscaCertidao} onChange={(e) => setBuscaCertidao(e.target.value)} placeholder="Processo, Nome..." className="w-full border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500 text-sm font-bold" /></div>
              <div className="w-full md:w-64"><select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500 text-sm font-bold bg-white"><option value="Todos">Todos</option><option value="Física">Física</option><option value="Eletrônica">Eletrônica</option><option value="Geral">Geral</option></select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {certFiltradas.map((c, i) => (
                <div key={i} onClick={() => setCertidaoExpandida(c)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-indigo-300 transition-colors">
                  <span className="font-bold text-gray-800">{c.consultor}</span>
                  <span className="text-xs text-gray-500">{new Date(c.data).toLocaleDateString('pt-BR')}</span>
                  <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-fit uppercase">{normTipo(c.tipo)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {certidaoExpandida && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setCertidaoExpandida(null)} className="absolute top-4 right-5 text-gray-400 hover:text-red-500 text-3xl font-bold">✖</button>
            <h3 className="text-2xl font-black text-indigo-900 mb-6">Detalhes da Certidão</h3>
            <div className="flex flex-col gap-3">
              <p><b>Consultor:</b> {certidaoExpandida.consultor}</p><p><b>Processo:</b> {certidaoExpandida.processo || '-'}</p>
              <p><b>Chamado:</b> {certidaoExpandida.incidente || '-'}</p><p><b>Parte:</b> {certidaoExpandida.nome_parte || '-'}</p>
              <p className="bg-gray-50 p-4 rounded-xl italic">"{certidaoExpandida.motivo || 'Sem motivo'}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
