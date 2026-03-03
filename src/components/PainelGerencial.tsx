import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../lib/supabase';
import { TRIAGEM_HP } from '../constants';

export function PainelGerencial() {
  const [abaAtiva, setAbaAtiva] = useState('Ranking');
  const [loading, setLoading] = useState(false);

  const [dadosSemanal, setDadosSemanal] = useState<any[]>([]);
  const [dadosHe, setDadosHe] = useState<any[]>([]);
  const [listaHe, setListaHe] = useState<any[]>([]);
  const [certidoes, setCertidoes] = useState<any[]>([]);
  const [dadosRanking, setDadosRanking] = useState<any[]>([]);
  const [dadosDiario, setDadosDiario] = useState<any[]>([]);

  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [buscaCertidao, setBuscaCertidao] = useState('');
  const [certidaoExpandida, setCertidaoExpandida] = useState<any>(null);
  const [filtroDiario, setFiltroDiario] = useState<string[]>(['chat', 'bastao', 'hp', 'atividade']);
  const [diarioDateIdx, setDiarioDateIdx] = useState(0); // 0 = hoje, 1 = anterior
  const [diarioDatas, setDiarioDatas] = useState<string[]>([]);

  useEffect(() => {
    if (abaAtiva === 'Ranking' && dadosRanking.length === 0) fetchRanking();
    if (abaAtiva === 'Diário' && dadosDiario.length === 0) fetchDiario();
    if (abaAtiva === 'Semanal' && dadosSemanal.length === 0) fetchSemanal();
    if (abaAtiva === 'H. Extras' && dadosHe.length === 0) fetchHorasExtras();
    if (abaAtiva === 'Certidões' && certidoes.length === 0) fetchCertidoes();
  }, [abaAtiva]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('app_state').select('data').in('id', [1, 2]);
      if (!error && data) {
        const hoje = new Date().toISOString().split('T')[0];
        let counts: Record<string, number> = {};
        data.forEach(row => {
          const logs = (row.data as any)?.daily_logs || [];
          logs.forEach((log: any) => {
            const logDate = log.timestamp ? log.timestamp.split('T')[0] : '';
            if (logDate === hoje) {
               const novoStatus = log.new_status || '';
               if (novoStatus.includes('Bastão') && !novoStatus.includes('Fila')) {
                  counts[log.consultor] = (counts[log.consultor] || 0) + 1;
               }
            }
          });
        });
        const rankingArr = Object.keys(counts).map(k => ({ nome: k, bastoes: counts[k] })).sort((a, b) => b.bastoes - a.bastoes).slice(0, 10);
        setDadosRanking(rankingArr);
      }
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  const fetchDiario = async () => {
    setLoading(true);
    try {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 14);
      const strDate = seteDiasAtras.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_logs')
        .select('date, consultor, source, payload')
        .in('source', ['chat', 'bastao_excel', 'bastao_pass', 'hp_erro', 'atividade'])
        .gte('date', strDate)
        .order('date', { ascending: false });
      if (!error && data) {
        const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort().reverse();
        setDiarioDatas(uniqueDates);
        setDadosDiario(data);
      }
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  const fetchSemanal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('atendimentos_resumo').select('*').eq('id', 2).single();
      if (!error && data?.data?.totais_por_relatorio) setDadosSemanal(data.data.totais_por_relatorio);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchHorasExtras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('horas_extras').select('*').order('data', { ascending: false }).limit(500);
      if (!error && data) {
        setListaHe(data);
        const agrupado = data.reduce((acc: any, curr: any) => {
          if (!curr.data) return acc;
          const mesAno = curr.data.substring(0, 7);
          let minutos = 0;
          const tempoStr = curr.tempo_total || '';
          const matchH = tempoStr.match(/(\d+)h/i);
          const matchM = tempoStr.match(/(\d+)m/i);
          if (matchH) minutos += parseInt(matchH[1]) * 60;
          if (matchM) minutos += parseInt(matchM[1]);
          if (!matchH && !matchM && !isNaN(parseInt(tempoStr))) minutos += parseInt(tempoStr);
          if (!acc[mesAno]) acc[mesAno] = { mes: mesAno, horas: 0 };
          acc[mesAno].horas += (minutos / 60);
          return acc;
        }, {});
        setDadosHe(Object.values(agrupado).sort((a: any, b: any) => a.mes.localeCompare(b.mes)));
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchCertidoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('certidoes_registro').select('*').order('data', { ascending: false }).limit(1000);
      if (!error && data) setCertidoes(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const normalizarTipo = (tipoBruto: string) => {
     if (!tipoBruto) return 'Geral';
     const t = tipoBruto.toLowerCase();
     if (t.includes('eletr')) return 'Eletrônica';
     if (t.includes('fís') || t.includes('fis')) return 'Física';
     return 'Geral';
  };

  const certidoesFiltradas = certidoes.filter(c => {
     const tipoNorm = normalizarTipo(c.tipo);
     const matchTipo = filtroTipo === 'Todos' || tipoNorm === filtroTipo;
     const term = buscaCertidao.toLowerCase();
     const matchBusca = term === '' ||
        (c.processo && c.processo.toLowerCase().includes(term)) ||
        (c.incidente && c.incidente.toLowerCase().includes(term)) ||
        (c.nome_parte && c.nome_parte.toLowerCase().includes(term)) ||
        (c.consultor && c.consultor.toLowerCase().includes(term));
     return matchTipo && matchBusca;
  });

  const sourceMap: Record<string, string> = { chat: 'chat', bastao_excel: 'bastao', bastao_pass: 'bastao', hp_erro: 'hp', atividade: 'atividade' };
  const getDiarioParaData = (dateStr: string) => {
    if (!dateStr || dadosDiario.length === 0) return [];
    const registros = dadosDiario.filter((d: any) => d.date === dateStr);
    const agrupado: Record<string, { chat: number; bastao: number; hp: number; atividade: number }> = {};
    registros.forEach((r: any) => {
      const tipo = sourceMap[r.source] || r.source;
      if (!filtroDiario.includes(tipo)) return;
      if (!agrupado[r.consultor]) agrupado[r.consultor] = { chat: 0, bastao: 0, hp: 0, atividade: 0 };
      const p = r.payload as any;
      if (tipo === 'chat') agrupado[r.consultor].chat += (p?.atendimentos_chat || 1);
      else if (tipo === 'bastao') agrupado[r.consultor].bastao += (p?.bastoes_assumidos || 1);
      else if (tipo === 'hp') agrupado[r.consultor].hp += (p?.total || p?.erros?.length || 1);
      else if (tipo === 'atividade') agrupado[r.consultor].atividade += (p?.total || p?.atividades?.length || 1);
    });
    return Object.entries(agrupado).map(([nome, vals]) => ({ nome, ...vals, total: vals.chat + vals.bastao + vals.hp + vals.atividade })).sort((a, b) => b.total - a.total);
  };
  const dataSelecionada = diarioDatas[diarioDateIdx] || '';
  const dadosDiarioProcessados = getDiarioParaData(dataSelecionada);
  const toggleFiltroDiario = (f: string) => setFiltroDiario(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 w-full mt-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 mb-6 gap-4">
        <h2 className="text-2xl font-black text-indigo-900 flex items-center gap-2">📊 Dashboard Gerencial</h2>
        <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-xl">
          {['Ranking', 'Diário', 'Semanal', 'H. Extras', 'Certidões'].map(aba => (
            <button key={aba} onClick={() => setAbaAtiva(aba)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === aba ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}>
              {aba}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[400px] w-full bg-gray-50 rounded-xl border border-gray-200 p-6">
        {loading && <p className="text-center font-bold text-gray-500 mt-10 animate-pulse">Consultando o Supabase...</p>}

        {!loading && abaAtiva === 'Diário' && (
          <div className="w-full">
            <div className="flex flex-wrap justify-between items-center mb-6">
              <div className="flex gap-2">
                {diarioDatas.slice(0, 5).map((d, i) => {
                  const isHoje = d === new Date().toISOString().split('T')[0];
                  return (
                    <button key={d} onClick={() => setDiarioDateIdx(i)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${diarioDateIdx === i ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {isHoje ? '📅 Hoje' : `📁 ${new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2 md:mt-0">
                {[{key:'chat',label:'💬 Chat',color:'green'},{key:'bastao',label:'🔥 Bastão',color:'red'},{key:'hp',label:'🎧 HP',color:'purple'},{key:'atividade',label:'📋 Atividade',color:'blue'}].map(f => (
                  <button key={f.key} onClick={() => toggleFiltroDiario(f.key)} className={`px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all ${filtroDiario.includes(f.key) ? `bg-${f.color}-100 border-${f.color}-400 text-${f.color}-700` : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <h3 className="text-gray-500 font-bold mb-2 uppercase tracking-wider text-center">
              Atendimentos — {dataSelecionada ? new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : ''}
            </h3>

            <div className="flex justify-center mb-4">
              <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-lg text-xs font-black">
                🎧 Triagem HP: {TRIAGEM_HP.join(' e ')}
              </span>
            </div>

            {dadosDiarioProcessados.length > 0 ? (
              <div className="w-full" style={{ height: Math.max(400, dadosDiarioProcessados.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosDiarioProcessados} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="nome" tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 12 }} width={150} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} />
                    {filtroDiario.includes('chat') && <Bar dataKey="chat" stackId="a" fill="#22c55e" name="Chat" radius={[0, 0, 0, 0]} />}
                    {filtroDiario.includes('bastao') && <Bar dataKey="bastao" stackId="a" fill="#ef4444" name="Bastão" radius={[0, 0, 0, 0]} />}
                    {filtroDiario.includes('hp') && <Bar dataKey="hp" stackId="a" fill="#8b5cf6" name="HP" radius={[0, 0, 0, 0]} />}
                    {filtroDiario.includes('atividade') && <Bar dataKey="atividade" stackId="a" fill="#3b82f6" name="Atividade" radius={[0, 4, 4, 0]} />}
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum dado para esta data.</p>}
          </div>
        )}

        {!loading && abaAtiva === 'Ranking' && (
          <div className="w-full h-[400px]">
            <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">Top Bastões Hoje</h3>
            {dadosRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosRanking}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fill: '#6b7280', fontWeight: 'bold' }} />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }}/>
                  <Bar dataKey="bastoes" fill="#D4AF37" radius={[6, 6, 0, 0]} name="Bastões Assumidos" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum bastão assumido hoje ainda.</p>}
          </div>
        )}

        {!loading && abaAtiva === 'H. Extras' && (
          <div className="w-full flex flex-col gap-6">
            <div className="h-[300px] w-full">
              <h3 className="text-gray-500 font-bold mb-4 text-center uppercase tracking-wider">Evolução de Horas Extras (Em Horas)</h3>
              {dadosHe.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosHe}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontWeight: 'bold' }} />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number | string) => typeof value === 'number' ? value.toFixed(1) + 'h' : value} 
                      cursor={{fill: '#f3f4f6'}} 
                      contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="horas" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Total de Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {!loading && abaAtiva === 'Certidões' && (
          <div className="w-full">
            <h3 className="text-gray-500 font-bold mb-4 uppercase tracking-wider">Controle de Certidões</h3>
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex-1">
                <input type="text" value={buscaCertidao} onChange={(e) => setBuscaCertidao(e.target.value)} placeholder="Processo, Chamado, Nome..." className="w-full border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500 text-sm font-bold text-gray-700"/>
              </div>
              <div className="w-full md:w-64">
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-full border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500 text-sm font-bold text-gray-700 bg-white">
                  <option value="Todos">Todos os Tipos</option>
                  <option value="Física">Física</option>
                  <option value="Eletrônica">Eletrônica</option>
                  <option value="Geral">Geral</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {certidoesFiltradas.map((cert, idx) => (
                <div key={idx} onClick={() => setCertidaoExpandida(cert)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-2 cursor-pointer hover:border-indigo-300 transition-colors">
                  <span className="font-bold text-gray-800">{cert.consultor}</span>
                  <span className="text-xs text-gray-500">{new Date(cert.data).toLocaleDateString('pt-BR')}</span>
                  <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-fit uppercase">{normalizarTipo(cert.tipo)}</span>
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
              <p><b>Consultor:</b> {certidaoExpandida.consultor}</p>
              <p><b>Processo:</b> {certidaoExpandida.processo || '-'}</p>
              <p><b>Chamado:</b> {certidaoExpandida.incidente || '-'}</p>
              <p><b>Parte:</b> {certidaoExpandida.nome_parte || '-'}</p>
              <p className="bg-gray-50 p-4 rounded-xl italic">"{certidaoExpandida.motivo || 'Sem motivo'}"</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}