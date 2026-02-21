import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { supabase } from '../lib/supabase';

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
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      const strDate = seteDiasAtras.toISOString().split('T')[0];
      const { data, error } = await supabase.from('daily_logs').select('date, consultor, payload').eq('source', 'consolidado').gte('date', strDate).order('date', { ascending: false });
      if (!error && data) {
        const uniqueDates = Array.from(new Set(data.map(d => d.date))).sort().reverse();
        const dataAtual = uniqueDates[0];
        const dadosHoje = data.filter(d => d.date === dataAtual).map(d => {
           const atend = (d.payload as any)?.atendimentos || {};
           const total = (parseInt(atend.chat) || 0) + (parseInt(atend.bastao) || 0) + (parseInt(atend.hp) || 0);
           return { nome: d.consultor, total: total };
        }).filter(d => d.total > 0).sort((a, b) => b.total - a.total).slice(0, 15);
        setDadosDiario(dadosHoje);
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