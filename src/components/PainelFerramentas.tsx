import { useState } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'

export function PainelFerramentas() {
  const { meuLogin, enviarRegistroN8n, salvarCertidaoSupabase } = useBastaoStore()
  const [modalAberto, setModalAberto] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const hoje = new Date().toISOString().split('T')[0]
  const formatarDataBR = (dataIso: string) => {
    if (!dataIso) return '';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  // Estados dos Formulários
  const [sugestaoTexto, setSugestaoTexto] = useState('')
  const [chamadoTexto, setChamadoTexto] = useState('')
  const [erroTitulo, setErroTitulo] = useState('')
  const [erroObjetivo, setErroObjetivo] = useState('')
  const [erroRelato, setErroRelato] = useState('')
  const [erroResultado, setErroResultado] = useState('')

  const [atdData, setAtdData] = useState(hoje)
  const [atdUsuario, setAtdUsuario] = useState('Cartório')
  const [atdSetor, setAtdSetor] = useState('')
  const [atdSistema, setAtdSistema] = useState('Conveniados')
  const [atdDescricao, setAtdDescricao] = useState('')
  const [atdCanal, setAtdCanal] = useState('Presencial')
  const [atdDesfecho, setAtdDesfecho] = useState('Resolvido - Cesupe')
  const [atdJira, setAtdJira] = useState('')

  const usuarioOptions = ["Cartório", "Magistrado", "Público Externo", "Interno", "Outros"]
  const sistemaOptions = ["Eproc", "JPE", "PJe", "SEI", "Conveniados", "Outros"]
  const canalOptions = ["Whatsapp", "Telefone", "Presencial", "E-mail", "Jira", "Outros"]
  const desfechoOptions = ["Resolvido - Cesupe", "Encaminhado N2", "Encaminhado N3", "Aguardando Usuário", "Outros"]

  const [heData, setHeData] = useState(hoje)
  const [heInicio, setHeInicio] = useState('')
  const [heTempoTotal, setHeTempoTotal] = useState('')
  const [heMotivo, setHeMotivo] = useState('')

  // ESTADOS DA CERTIDÃO
  const [certData, setCertData] = useState(hoje)
  const [certTipo, setCertTipo] = useState('Geral')
  const [certMotivo, setCertMotivo] = useState('')
  const [certProcesso, setCertProcesso] = useState('')
  const [certIncidente, setCertIncidente] = useState('')
  const [certParte, setCertParte] = useState('')
  const [certPeticao, setCertPeticao] = useState('Inicial')

  const btnClass = "bg-gradient-to-b from-white to-gray-50 border border-gray-200 text-gray-800 font-bold py-3 px-2 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 active:shadow-inner active:scale-95 active:translate-y-0.5 transition-all duration-150"
  const labelClass = "block text-xs font-bold text-gray-500 mb-1 mt-3"
  const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 bg-gray-50 text-gray-800 transition-shadow"

  const dispararN8n = async (tipo: string, dados: any, mensagemFormatada: string, resetFn: () => void) => {
    setLoading(true)
    const sucesso = await enviarRegistroN8n(tipo, dados, mensagemFormatada)
    setLoading(false)
    if (sucesso) {
      alert(`✅ ${tipo} registrado com sucesso!`)
      setModalAberto(null)
      resetFn()
    } else {
      alert("❌ Falha ao enviar para o n8n. Verifique a configuração.")
    }
  }

  // MOTOR GERADOR DE WORD
  const criarBlobDocx = async () => {
    const dataFormatada = formatarDataBR(certData);
    let paragrafosCorpo: Paragraph[] = [];

    if (certTipo === 'Física') {
      paragrafosCorpo = [
        new Paragraph({ children: [new TextRun({ text: `Informamos que no dia ${dataFormatada}, houve indisponibilidade específica do sistema para o peticionamento do processo nº ${certProcesso}.`, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `O Chamado de número ${certIncidente}, foi aberto e encaminhado à DIRTEC (Diretoria Executiva de Tecnologia da Informação e Comunicação).`, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `Diante da indisponibilidade específica, não havendo um prazo para solução do problema, a Primeira Vice-Presidência recomenda o ingresso dos autos físicos, nos termos do § 2º, do artigo 14º, da Resolução nº 780/2014, do Tribunal de Justiça do Estado de Minas Gerais.`, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `Colocamo-nos à disposição para outras informações que se fizerem necessárias.`, size: 24 })], spacing: { after: 400 } }),
      ];
    } else if (certTipo === 'Eletrônica') {
      paragrafosCorpo = [
        new Paragraph({ children: [new TextRun({ text: `Informamos que em ${dataFormatada}, houve indisponibilidade específica do sistema para o peticionamento do processo nº ${certProcesso}.`, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `O Chamado de número ${certIncidente}, foi aberto e encaminhado à DIRTEC (Diretoria Executiva de Tecnologia da Informação e Comunicação).`, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `Esperamos ter prestado as informações solicitadas e colocamo-nos à disposição para outras que se fizerem necessárias.`, size: 24 })], spacing: { after: 400 } }),
      ];
    } else {
      paragrafosCorpo = [
        new Paragraph({ children: [new TextRun({ text: `Para fins de cumprimento dos artigos 13 e 14 da Resolução nº 780/2014 do Tribunal de Justiça do Estado de Minas Gerais, informamos que em ${dataFormatada} houve indisponibilidade do portal JPe, `, size: 24 }), new TextRun({ text: certMotivo, size: 24 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: `Colocamo-nos à disposição para outras que se fizerem necessárias.`, size: 24 })], spacing: { after: 400 } }),
      ];
    }

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PODER JUDICIÁRIO DO ESTADO DE MINAS GERAIS", bold: true, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TRIBUNAL DE JUSTIÇA", bold: true, size: 24 })] }),
          new Paragraph({ text: "", spacing: { after: 400 } }),
          new Paragraph({ children: [new TextRun({ text: "Parecer Técnico GEJUD/DIRTEC/TJMG", bold: true, size: 24 })], spacing: { after: 100 } }),
          new Paragraph({ children: [new TextRun({ text: "Assunto: Notifica erro no “JPe – 2ª Instância” ao peticionar.", bold: true, size: 24 })], spacing: { after: 400 } }),
          new Paragraph({ children: [new TextRun({ text: `Belo Horizonte, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, size: 24 })], spacing: { after: 400 } }),
          new Paragraph({ children: [new TextRun({ text: "Exmo(a). Senhor(a) Relator(a),", size: 24 })], spacing: { after: 200 } }),
          ...paragrafosCorpo,
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Respeitosamente,", size: 24 })], spacing: { after: 600 } }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Waner Andrade Silva", bold: true, size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "0-009020-9", size: 24 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Coordenação de Análise e Integração de Sistemas Judiciais Informatizados - COJIN", size: 20 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Gerência de Sistemas Judiciais - GEJUD", size: 20 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Diretoria Executiva de Tecnologia da Informação e Comunicação - DIRTEC", size: 20 })] })
        ],
      }],
    });
    return await Packer.toBlob(doc);
  }

  const handleGerarWord = async () => {
    if (!certProcesso) return alert("Preencha ao menos o número do processo!")
    try {
      const blob = await criarBlobDocx();
      saveAs(blob, `Certidao_${certProcesso.replace(/[^a-zA-Z0-9]/g, '')}.docx`);
    } catch (error) { alert("❌ Erro ao gerar Word."); }
  }

  const handleSalvarENotificar = async () => {
    if (!certProcesso) return alert("Preencha ao menos o número do processo!")
    setLoading(true)

    try {
      const payloadSupabase = {
        processo: certProcesso,
        nome_parte: certParte,
        consultor: meuLogin,
        data: certData, 
        tipo: certTipo,
        peticao: certPeticao,
        incidente: certIncidente,
        motivo: certMotivo
      };
      
      const salvoNoBanco = await salvarCertidaoSupabase(payloadSupabase);
      if (!salvoNoBanco) throw new Error("Falha ao salvar no banco");

      const blob = await criarBlobDocx();
      
      // Converte o arquivo para o texto gigante que o seu n8n aceitou (Base64)
      const base64: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Anexa na mensagem comum de JSON
      const payloadN8n = { ...payloadSupabase, arquivo_docx_base64: base64 };
      const msg = `🖨️ **Certidão Gerada**\n👤 **Autor:** ${meuLogin}\n📄 **Processo:** ${certProcesso}\n🏷️ **Tipo:** ${certTipo}`;
      
      const n8nSucesso = await enviarRegistroN8n("CERTIDAO", payloadN8n, msg);
      
      if (n8nSucesso) {
        alert("✅ Certidão salva no Supabase e enviada para o n8n com sucesso!");
        setModalAberto(null);
        setCertProcesso(''); setCertMotivo(''); setCertIncidente(''); setCertParte('');
      } else {
        alert("⚠️ Salvo no banco, mas falhou ao enviar pro n8n.");
      }
    } catch (error) {
      console.error(error);
      alert("❌ Ocorreu um erro na operação. Verifique o console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 relative">
      <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">🛠️ Ferramentas da Equipe</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <button onClick={() => setModalAberto('chamados')} className={btnClass}>🆘 Chamados</button>
        <button onClick={() => setModalAberto('atendimentos')} className={btnClass}>📝 Atendimentos</button>
        <button onClick={() => setModalAberto('hextras')} className={btnClass}>⏰ H. Extras</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button onClick={() => setModalAberto('erro_novidade')} className={btnClass}>🐛 Erro/Novidade</button>
        <button onClick={() => setModalAberto('certidao')} className={btnClass}>🖨️ Certidão</button>
        <button onClick={() => setModalAberto('sugestao')} className={btnClass}>💡 Sugestão</button>
      </div>

      {/* --- MODAIS DE FERRAMENTAS --- */}

      {modalAberto === 'sugestao' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-extrabold text-gray-800 mb-4 flex items-center gap-2">💡 Enviar Sugestão</h3>
            <textarea value={sugestaoTexto} onChange={(e) => setSugestaoTexto(e.target.value)} className={`${inputClass} h-32 resize-none focus:ring-yellow-500`} placeholder="Descreva sua sugestão..." />
            <div className="flex gap-2 mt-4">
              <button disabled={loading || !sugestaoTexto} onClick={() => dispararN8n("SUGESTAO", { texto: sugestaoTexto }, `💡 **Nova Sugestão**\n👤 **Autor:** ${meuLogin}\n\n📝 **Sugestão:**\n${sugestaoTexto}`, () => setSugestaoTexto(''))} className="flex-1 bg-yellow-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50">Enviar</button>
              <button onClick={() => setModalAberto(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'chamados' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-extrabold text-rose-600 mb-4">🆘 Rascunho de Chamado/Jira</h3>
            <textarea value={chamadoTexto} onChange={(e) => setChamadoTexto(e.target.value)} className={`${inputClass} h-48 focus:ring-rose-500`} placeholder="Cole os dados do erro, prints, links..." />
            <div className="flex gap-2 mt-4">
              <button disabled={loading || !chamadoTexto} onClick={() => dispararN8n("CHAMADOS", { texto: chamadoTexto }, `🆘 **Chamado/Jira**\n👤 **Autor:** ${meuLogin}\n\n📝 **Texto:**\n${chamadoTexto}`, () => setChamadoTexto(''))} className="flex-1 bg-rose-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50">Enviar Chamado</button>
              <button onClick={() => setModalAberto(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'erro_novidade' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-emerald-600 mb-4 flex items-center gap-2">🐛 Erro/Novidade</h3>
            <label className={labelClass}>Título:</label>
            <input type="text" value={erroTitulo} onChange={(e) => setErroTitulo(e.target.value)} className={`${inputClass} focus:ring-emerald-500`} />
            <label className={labelClass}>Objetivo:</label>
            <textarea value={erroObjetivo} onChange={(e) => setErroObjetivo(e.target.value)} className={`${inputClass} h-20 focus:ring-emerald-500`} />
            <label className={labelClass}>Relato:</label>
            <textarea value={erroRelato} onChange={(e) => setErroRelato(e.target.value)} className={`${inputClass} h-24 focus:ring-emerald-500`} />
            <label className={labelClass}>Resultado:</label>
            <textarea value={erroResultado} onChange={(e) => setErroResultado(e.target.value)} className={`${inputClass} h-20 focus:ring-emerald-500`} />
            <div className="flex gap-2 mt-6">
              <button disabled={loading || !erroTitulo} onClick={() => dispararN8n("ERRO_NOVIDADE", { titulo: erroTitulo, objetivo: erroObjetivo, relato: erroRelato, resultado: erroResultado }, `🐛 **Erro/Novidade**\n👤 **Autor:** ${meuLogin}\n\n🏷️ **Título:** ${erroTitulo}\n🎯 **Objetivo:** ${erroObjetivo}\n📝 **Relato:** ${erroRelato}\n✅ **Resultado:** ${erroResultado}`, () => { setErroTitulo(''); setErroObjetivo(''); setErroRelato(''); setErroResultado(''); })} className="flex-1 bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50">Enviar Relato</button>
              <button onClick={() => setModalAberto(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'atendimentos' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-blue-600 mb-4 flex items-center gap-2">📝 Registro de Atendimentos</h3>
            <label className={labelClass}>Data:</label>
            <input type="date" value={atdData} onChange={(e) => setAtdData(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
            <label className={labelClass}>Usuário:</label>
            <select value={atdUsuario} onChange={(e) => setAtdUsuario(e.target.value)} className={`${inputClass} focus:ring-blue-500`}>{usuarioOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
            <label className={labelClass}>Setor:</label>
            <input type="text" value={atdSetor} onChange={(e) => setAtdSetor(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
            <label className={labelClass}>Sistema:</label>
            <select value={atdSistema} onChange={(e) => setAtdSistema(e.target.value)} className={`${inputClass} focus:ring-blue-500`}>{sistemaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
            <label className={labelClass}>Descrição:</label>
            <input type="text" value={atdDescricao} onChange={(e) => setAtdDescricao(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
            <label className={labelClass}>Canal:</label>
            <select value={atdCanal} onChange={(e) => setAtdCanal(e.target.value)} className={`${inputClass} focus:ring-blue-500`}>{canalOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
            <label className={labelClass}>Desfecho:</label>
            <select value={atdDesfecho} onChange={(e) => setAtdDesfecho(e.target.value)} className={`${inputClass} focus:ring-blue-500`}>{desfechoOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
            <label className={labelClass}>Jira:</label>
            <input type="text" value={atdJira} onChange={(e) => setAtdJira(e.target.value)} className={`${inputClass} focus:ring-blue-500`} />
            <div className="flex gap-2 mt-6">
              <button disabled={loading || !atdDescricao} onClick={() => dispararN8n("ATENDIMENTOS", { data: formatarDataBR(atdData), usuario: atdUsuario, setor: atdSetor, sistema: atdSistema, descricao: atdDescricao, canal: atdCanal, desfecho: atdDesfecho, jira: atdJira }, `📝 **Novo Atendimento**\n👤 **Consultor:** ${meuLogin}\n📅 **Data:** ${formatarDataBR(atdData)}\n🧑‍💼 **Usuário:** ${atdUsuario}\n🏢 **Setor:** ${atdSetor}\n💻 **Sistema:** ${atdSistema}\n📋 **Descrição:** ${atdDescricao}\n📞 **Canal:** ${atdCanal}\n✅ **Desfecho:** ${atdDesfecho}\n🎫 **Jira:** ${atdJira}`, () => { setAtdDescricao(''); setAtdSetor(''); setAtdJira(''); })} className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50">Registrar Atendimento</button>
              <button onClick={() => setModalAberto(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'hextras' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-extrabold text-orange-600 mb-4 flex items-center gap-2">⏰ Horas Extras</h3>
            <label className={labelClass}>Data:</label>
            <input type="date" value={heData} onChange={(e) => setHeData(e.target.value)} className={`${inputClass} focus:ring-orange-500`} />
            <label className={labelClass}>Início:</label>
            <input type="time" value={heInicio} onChange={(e) => setHeInicio(e.target.value)} className={`${inputClass} focus:ring-orange-500`} />
            <label className={labelClass}>Tempo Total (Mins ou Horas):</label>
            <input type="text" value={heTempoTotal} onChange={(e) => setHeTempoTotal(e.target.value)} className={`${inputClass} focus:ring-orange-500`} placeholder="Ex: 45 min, 1h30m..." />
            <label className={labelClass}>Motivo:</label>
            <input type="text" value={heMotivo} onChange={(e) => setHeMotivo(e.target.value)} className={`${inputClass} focus:ring-orange-500`} />
            <div className="flex gap-2 mt-6">
              <button disabled={loading || !heInicio || !heTempoTotal} onClick={() => dispararN8n("HORAS_EXTRAS", { data: formatarDataBR(heData), inicio: heInicio, tempo_total: heTempoTotal, motivo: heMotivo }, `⏰ **Horas Extras**\n👤 **Consultor:** ${meuLogin}\n📅 **Data:** ${formatarDataBR(heData)}\n🕒 **Início:** ${heInicio}\n⌛ **Tempo Total:** ${heTempoTotal}\n📝 **Motivo:** ${heMotivo}`, () => { setHeInicio(''); setHeTempoTotal(''); setHeMotivo(''); })} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl shadow-md disabled:opacity-50">Registrar</button>
              <button onClick={() => setModalAberto(null)} className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalAberto === 'certidao' && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-extrabold text-indigo-700 mb-6 flex items-center gap-2">🖨️ Registro de Certidão (2026)</h3>
            
            <label className={labelClass}>Data do Evento:</label>
            <input type="date" value={certData} onChange={(e) => setCertData(e.target.value)} className={`${inputClass} mb-3 focus:ring-indigo-500`} />
            
            <label className={labelClass}>Tipo do Modelo:</label>
            <select value={certTipo} onChange={(e) => setCertTipo(e.target.value)} className={`${inputClass} mb-3 focus:ring-indigo-500 font-bold text-indigo-800`}>
              <option value="Geral">Geral (Indisponibilidade)</option>
              <option value="Física">Física (Recomenda autos físicos)</option>
              <option value="Eletrônica">Eletrônica (Peticionamento comum)</option>
            </select>
            
            <label className={labelClass}>Motivo/Detalhes (Necessário para a certidão "Geral"):</label>
            <textarea value={certMotivo} onChange={(e) => setCertMotivo(e.target.value)} className={`${inputClass} h-20 mb-3 focus:ring-indigo-500 resize-none`} placeholder="Detalhes do erro, ex: superior a uma hora, a partir de 20:30h..." />

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelClass}>Processo (Com pontuação):</label>
                <input type="text" value={certProcesso} onChange={(e) => setCertProcesso(e.target.value)} className={`${inputClass} focus:ring-indigo-500`} placeholder="Ex: 5001234-56..." />
              </div>
              <div>
                <label className={labelClass}>Incidente/Chamado:</label>
                <input type="text" value={certIncidente} onChange={(e) => setCertIncidente(e.target.value)} className={`${inputClass} focus:ring-indigo-500`} placeholder="Ex: CH321..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={labelClass}>Nome da Parte/Advogado:</label>
                <input type="text" value={certParte} onChange={(e) => setCertParte(e.target.value)} className={`${inputClass} focus:ring-indigo-500`} placeholder="Nome completo..." />
              </div>
              <div>
                <label className={labelClass}>Tipo de Petição:</label>
                <select value={certPeticao} onChange={(e) => setCertPeticao(e.target.value)} className={`${inputClass} focus:ring-indigo-500`}>
                  <option value="Inicial">Inicial</option>
                  <option value="Recursal">Recursal</option>
                  <option value="Intermediária">Intermediária</option>
                </select>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={handleGerarWord} 
                className="flex-1 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-4 rounded-xl shadow-sm transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                📄 Apenas Baixar Word
              </button>
              
              <button 
                disabled={loading} 
                onClick={handleSalvarENotificar} 
                className="flex-[2] bg-[#FF4B4B] hover:bg-red-600 text-white font-bold py-4 rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Salvando...' : '💾 Salvar e Mandar pro n8n'}
              </button>
            </div>
            
            <button onClick={() => setModalAberto(null)} className="mt-4 px-6 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-sm transition-colors border border-gray-300">
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  )
}