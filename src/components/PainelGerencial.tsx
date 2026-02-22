import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList, Cell } from 'recharts';
import { supabase } from '../lib/supabase';

// =============================================
// Label customizado para dentro/acima das barras
// =============================================
const BarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0) return null;
  const isSmall = height < 20;
  return (
    <text
      x={x + width / 2}
      y={isSmall ? y - 6 : y + height / 2}
      fill={isSmall ? '#374151' : '#fff'}
      textAnchor="middle"
      dominantBaseline={isSmall ? 'auto' : 'central'}
      fontWeight="bold"
      fontSize={12}
    >
      {value}
    </text>
  );
};

// Label para barras horizontais (valor à direita da barra)
const HBarLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (!value || value === 0) return null;
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="#374151"
      textAnchor="start"
      dominantBaseline="central"
      fontWeight="bold"
      fontSize={12}
    >
      {value}
    </text>
  );
};

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
      const hoje = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_logs')
        .select('consultor, payload')
        .eq('source', 'bastao_pass')
        .eq('date', hoje);

      if (!error && data && data.length > 0) {
        const rankingArr = data
          .map(row => ({ nome: row.consultor, bastoes: (row.payload as any)?.bastoes_assumidos || 0 }))
          .filter(d => d.bastoes > 0)
          .sort((a, b) => b.bastoes - a.bastoes)
          .slice(0, 15);
        setDadosRanking(rankingArr);
      } else { setDadosRanking([]); }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchDiario = async () => {
    setLoading(true);
    try {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const strDate = trintaDiasAtras.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('daily_logs')
        .select('date, consultor, payload')
        .eq('source', 'consolidado')
        .gte('date', strDate)
        .order('date', { ascending: false });

      if (!error && data && data.length > 0) {
        const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort().reverse();
        const dataAtual = uniqueDates[0];

        const dadosHoje = data
          .filter(d => d.date === dataAtual)
          .map(d => {
            const p = d.payload as any;
            if (!p) return { nome: d.consultor, total: 0, chat: 0, bastao: 0, hp: 0 };
            const chat = parseInt(p.atendimentos?.chat) || 0;
            const bastao = parseInt(p.atendimentos?.bastao) || 0;
            const hp = parseInt(p.atendimentos?.hp) || 0;
            return { nome: d.consultor, total: chat + bastao + hp, chat, bastao, hp };
          })
          .filter(d => d.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 20);

        setDadosDiario(dadosHoje);
      } else { setDadosDiario([]); }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchSemanal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('atendimentos_resumo').select('*').eq('id', 2).single();
      if (!error && data?.data?.totais_por_relatorio) {
        // Encurta os nomes dos relatórios para o gráfico
        const dados = data.data.totais_por_relatorio.map((item: any) => {
          let label = item.relatorio || '';
          if (label.includes('Chat')) label = 'Chat';
          else if (label.includes('HP')) label = 'HP / Chamados';
          else if (label.includes('Atendimento')) label = 'Atendimentos';
          else if (label.includes('Bastão') || label.includes('Bastao')) label = 'Bastão';
          return { ...item, label };
        });
        setDadosSemanal(dados);
      }
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const fetchHorasExtras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('horas_extras').select('*').order('data', { ascending: false }).limit(500);
      if (!error && data) {
        setListaHe(data);
        const meses: Record<string, string> = {
          '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
          '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez'
        };
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
          const [ano, mes] = mesAno.split('-');
          const label = `${meses[mes] || mes}/${ano}`;
          if (!acc[mesAno]) acc[mesAno] = { mes: mesAno, label, horas: 0 };
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

  const formatarTempo = (tempo: string) => tempo || '-';

  // Cores para o gráfico diário (degradê azul)
  const coresDiario = ['#3b82f6', '#4f8ff7', '#60a5fa', '#6bb3fb', '#7cc2fc', '#93c5fd', '#a5d0fd', '#b8dcfe', '#cae6fe', '#dbeffe'];

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

        {/* =============================================
            RANKING — Barras horizontais
            ============================================= */}
        {!loading && abaAtiva === 'Ranking' && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-bold uppercase tracking-wider">🏆 Top Bastões Hoje</h3>
              <button onClick={() => { setDadosRanking([]); fetchRanking(); }} className="text-xs bg-indigo-100 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors">🔄 Atualizar</button>
            </div>
            {dadosRanking.length > 0 ? (
              <div style={{ height: Math.max(300, dadosRanking.length * 45) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosRanking} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="nome" type="category" width={150} tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }} />
                    <Bar dataKey="bastoes" fill="#D4AF37" radius={[0, 6, 6, 0]} name="Bastões">
                      <LabelList dataKey="bastoes" position="right" fill="#374151" fontWeight="bold" fontSize={13} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum bastão registrado hoje ainda.<br /><span className="text-xs">Os dados aparecem a partir das próximas passagens de bastão.</span></p>}
          </div>
        )}

        {/* =============================================
            DIÁRIO — Barras horizontais (nomes legíveis)
            ============================================= */}
        {!loading && abaAtiva === 'Diário' && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-bold uppercase tracking-wider">📋 Atendimentos — Dia Mais Recente</h3>
              <button onClick={() => { setDadosDiario([]); fetchDiario(); }} className="text-xs bg-indigo-100 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors">🔄 Atualizar</button>
            </div>
            {dadosDiario.length > 0 ? (
              <div style={{ height: Math.max(400, dadosDiario.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosDiario} layout="vertical" margin={{ left: 20, right: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="nome" type="category" width={160} tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }} />
                    <Tooltip
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }}
                      formatter={(_: any, name: string, props: any) => {
                        const d = props.payload;
                        return [`Chat: ${d.chat} | Bastão: ${d.bastao} | HP: ${d.hp} → Total: ${d.total}`, ''];
                      }}
                    />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} name="Total">
                      {dadosDiario.map((_: any, idx: number) => (
                        <Cell key={idx} fill={coresDiario[Math.min(idx, coresDiario.length - 1)]} />
                      ))}
                      <LabelList dataKey="total" position="right" fill="#374151" fontWeight="bold" fontSize={13} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum dado de atendimento encontrado nos últimos 30 dias.</p>}
          </div>
        )}

        {/* =============================================
            SEMANAL — Labels curtos + rótulos dentro das barras
            ============================================= */}
        {!loading && abaAtiva === 'Semanal' && (
          <div className="w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-500 font-bold uppercase tracking-wider">📊 Resumo Semanal por Relatório</h3>
              <button onClick={() => { setDadosSemanal([]); fetchSemanal(); }} className="text-xs bg-indigo-100 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors">🔄 Atualizar</button>
            </div>
            {dadosSemanal.length > 0 ? (
              <>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosSemanal} margin={{ bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: '#f3f4f6' }}
                        contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }}
                        labelFormatter={(label: string) => {
                          const item = dadosSemanal.find((d: any) => d.label === label);
                          return item?.relatorio || label;
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Eproc" fill="#f97316" radius={[0, 0, 0, 0]} name="Eproc" stackId="stack">
                        <LabelList dataKey="Eproc" content={BarLabel} />
                      </Bar>
                      <Bar dataKey="Legados" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Legados (JPE)" stackId="stack">
                        <LabelList dataKey="Legados" content={BarLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Cards de totais */}
                <div className="flex flex-wrap gap-3 mt-4">
                  {dadosSemanal.map((item: any, idx: number) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex-1 min-w-[180px]">
                      <p className="text-xs text-gray-400 font-bold uppercase truncate" title={item.relatorio}>{item.relatorio}</p>
                      <p className="text-2xl font-black text-indigo-900">{item.total_geral || 0}</p>
                      <div className="flex gap-3 text-xs mt-1">
                        <span className="text-orange-600 font-bold">Eproc: {item.Eproc || 0}</span>
                        <span className="text-blue-600 font-bold">Legados: {item.Legados || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-center text-gray-400 mt-20">Nenhum dado semanal disponível.</p>}
          </div>
        )}

        {/* =============================================
            HORAS EXTRAS — Gráfico + Lista
            ============================================= */}
        {!loading && abaAtiva === 'H. Extras' && (
          <div className="w-full flex flex-col gap-6">
            <div className="h-[300px] w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-gray-500 font-bold uppercase tracking-wider">⏰ Evolução de Horas Extras</h3>
                <button onClick={() => { setDadosHe([]); setListaHe([]); fetchHorasExtras(); }} className="text-xs bg-indigo-100 text-indigo-600 font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors">🔄 Atualizar</button>
              </div>
              {dadosHe.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={dadosHe}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#374151', fontWeight: 'bold', fontSize: 13 }} />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number | string) => typeof value === 'number' ? value.toFixed(1) + 'h' : value}
                      labelFormatter={(label: string) => `Mês: ${label}`}
                      cursor={{ fill: '#f3f4f6' }}
                      contentStyle={{ borderRadius: '10px', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="horas" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Total de Horas">
                      <LabelList dataKey="horas" content={(props: any) => {
                        const { x, y, width, value } = props;
                        if (!value) return null;
                        return <text x={x + width / 2} y={y - 8} fill="#6b21a8" textAnchor="middle" fontWeight="bold" fontSize={13}>{typeof value === 'number' ? value.toFixed(1) + 'h' : value}</text>;
                      }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-center text-gray-400 mt-10">Nenhuma hora extra registrada.</p>}
            </div>

            {/* Tabela de registros */}
            {listaHe.length > 0 && (
              <div>
                <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-3">📋 Registros de Horas Extras ({listaHe.length})</h3>
                <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-black text-gray-600">Data</th>
                        <th className="text-left px-4 py-3 font-black text-gray-600">Consultor</th>
                        <th className="text-left px-4 py-3 font-black text-gray-600">Início</th>
                        <th className="text-left px-4 py-3 font-black text-gray-600">Tempo</th>
                        <th className="text-left px-4 py-3 font-black text-gray-600">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaHe.map((he, idx) => (
                        <tr key={idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}>
                          <td className="px-4 py-2.5 font-bold text-gray-700">
                            {he.data ? new Date(he.data + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-gray-800">{he.consultor}</td>
                          <td className="px-4 py-2.5 text-gray-600">{he.hora_inicio || '-'}</td>
                          <td className="px-4 py-2.5">
                            <span className="bg-purple-100 text-purple-700 font-black px-2 py-1 rounded-lg text-xs">{formatarTempo(he.tempo_total)}</span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate" title={he.motivo || ''}>{he.motivo || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CERTIDÕES */}
        {!loading && abaAtiva === 'Certidões' && (
          <div className="w-full">
            <h3 className="text-gray-500 font-bold mb-4 uppercase tracking-wider">Controle de Certidões</h3>
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex-1">
                <input type="text" value={buscaCertidao} onChange={(e) => setBuscaCertidao(e.target.value)} placeholder="Processo, Chamado, Nome..." className="w-full border-2 border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500 text-sm font-bold text-gray-700" />
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

      {/* Modal Certidão */}
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
