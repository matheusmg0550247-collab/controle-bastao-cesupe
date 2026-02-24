import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'

interface ItemLoja {
  id: string; nome: string; emoji: string; descricao: string; preco: number; cor: string; corBorda: string
}

interface Compra {
  id: number; consultor: string; item_id: string; item_nome: string; preco: number; status: string; created_at: string
}

const WEBHOOK_REGISTRO = "https://matheusgomes12.app.n8n.cloud/webhook/c0a19cc9-2167-4824-a9b1-3672288f0841"

const ITENS_LOJA: ItemLoja[] = [
  { id: 'biscoitin', nome: 'Biscoitin / Lanche', emoji: '🍪', descricao: 'Um lanchinho especial entregue na sua mesa!', preco: 5, cor: 'from-amber-400 to-orange-500', corBorda: 'border-amber-300' },
  { id: 'emoji_video', nome: 'Emoji/Vídeo no Bastão', emoji: '🎬', descricao: 'Um emoji ou vídeo personalizado exibido no painel do bastão!', preco: 5, cor: 'from-pink-400 to-purple-500', corBorda: 'border-pink-300' },
  { id: 'elogio_publico', nome: 'Elogio Público', emoji: '🏆', descricao: 'Um elogio público registrado e compartilhado com toda a equipe!', preco: 15, cor: 'from-yellow-400 to-amber-500', corBorda: 'border-yellow-300' }
]

export function LojinhaVirtual() {
  const meuLogin = useBastaoStore(s => s.meuLogin)
  const [aberto, setAberto] = useState(false)
  const [saldo, setSaldo] = useState(0)
  const [compras, setCompras] = useState<Compra[]>([])
  const [loadingSaldo, setLoadingSaldo] = useState(true)
  const [comprando, setComprando] = useState<string | null>(null)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    if (!meuLogin || !aberto) return
    const fetchDados = async () => {
      setLoadingSaldo(true)
      const { data: saldoData } = await supabase.from('lojinha_saldos').select('moedas').eq('consultor', meuLogin).maybeSingle()
      setSaldo(saldoData?.moedas ?? 0)
      const { data: comprasData } = await supabase.from('lojinha_compras').select('*').eq('consultor', meuLogin).order('created_at', { ascending: false }).limit(20)
      setCompras(comprasData || [])
      setLoadingSaldo(false)
    }
    fetchDados()

    const channel = supabase.channel('lojinha-saldo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_saldos', filter: `consultor=eq.${meuLogin}` }, (payload: any) => {
        if (payload.new?.moedas !== undefined) setSaldo(payload.new.moedas)
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [meuLogin, aberto])

  const comprar = async (item: ItemLoja) => {
    if (!meuLogin) return
    if (saldo < item.preco) {
      setFeedbackMsg({ tipo: 'erro', texto: `Saldo insuficiente! Você precisa de ${item.preco} moedas, mas tem ${saldo}.` })
      setTimeout(() => setFeedbackMsg(null), 4000); return
    }

    setComprando(item.id)
    try {
      const novoSaldo = saldo - item.preco
      await supabase.from('lojinha_saldos').upsert({ consultor: meuLogin, moedas: novoSaldo }, { onConflict: 'consultor' })
      await supabase.from('lojinha_compras').insert({ consultor: meuLogin, item_id: item.id, item_nome: item.nome, preco: item.preco, status: 'pendente' })
      setSaldo(novoSaldo)

      // Atualizar histórico
      const { data: comprasData } = await supabase.from('lojinha_compras').select('*').eq('consultor', meuLogin).order('created_at', { ascending: false }).limit(20)
      setCompras(comprasData || [])

      // ENVIAR WEBHOOK de notificação
      const mensagem = `🛍️ *Lojinha CESUPE*\n\n👤 *Consultor:* ${meuLogin}\n${item.emoji} *Resgate:* ${item.nome}\n🪙 *Custo:* ${item.preco} moedas\n💰 *Saldo restante:* ${novoSaldo} moedas\n\n⏳ _Aguardando entrega pela coordenação._`
      fetch(WEBHOOK_REGISTRO, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "LOJINHA",
          consultor: meuLogin,
          data_envio: new Date().toISOString(),
          dados: { item_id: item.id, item_nome: item.nome, preco: item.preco, saldo_restante: novoSaldo },
          message: mensagem,
          mensagem_formatada: mensagem
        })
      }).catch(() => {})

      setFeedbackMsg({ tipo: 'ok', texto: `${item.emoji} ${item.nome} resgatado! Aguarde a entrega.` })
      setTimeout(() => setFeedbackMsg(null), 5000)
    } catch (err) {
      console.error('Erro na compra:', err)
      setFeedbackMsg({ tipo: 'erro', texto: 'Erro ao processar compra. Tente novamente.' })
      setTimeout(() => setFeedbackMsg(null), 4000)
    }
    setComprando(null)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* HEADER CLICÁVEL */}
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h2 className="text-xl font-bold text-gray-800">🛍️ Lojinha Virtual CESUPE</h2>
        <div className="flex items-center gap-3">
          {!aberto && (
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 text-sm">
              <span>🪙</span>
              <span className="font-black">{loadingSaldo && !aberto ? '...' : saldo}</span>
            </div>
          )}
          {!aberto && <span className="text-xs text-gray-400 font-bold">Clique para expandir</span>}
          <span className={`text-xl transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* CONTEÚDO COLAPSÁVEL */}
      {aberto && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {/* TOPO: Histórico + Saldo */}
          <div className="flex flex-wrap justify-between items-center mt-4 mb-5 gap-3">
            <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${mostrarHistorico ? 'bg-gray-700 text-white border-gray-800' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}>📜 Histórico</button>
            <div className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-4 py-2 rounded-xl shadow-md flex items-center gap-2">
              <span className="text-lg">🪙</span>
              <div className="leading-tight">
                <p className="text-[10px] font-bold text-yellow-100">Seu saldo</p>
                <p className="text-lg font-black">{loadingSaldo ? '...' : saldo} <span className="text-xs font-bold">moedas</span></p>
              </div>
            </div>
          </div>

          {/* FEEDBACK */}
          {feedbackMsg && (
            <div className={`mb-4 p-3 rounded-xl text-sm font-bold border-2 ${feedbackMsg.tipo === 'ok' ? 'bg-green-50 text-green-800 border-green-300' : 'bg-red-50 text-red-800 border-red-300'}`}>{feedbackMsg.texto}</div>
          )}

          {/* ITENS DA LOJA */}
          {!mostrarHistorico && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ITENS_LOJA.map(item => {
                const podePagar = saldo >= item.preco
                const estaComprando = comprando === item.id
                return (
                  <div key={item.id} className={`rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg ${item.corBorda}`}>
                    <div className={`bg-gradient-to-br ${item.cor} p-6 text-center`}>
                      <span className="text-5xl block mb-2">{item.emoji}</span>
                      <h3 className="text-white font-black text-lg drop-shadow-md">{item.nome}</h3>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-500 mb-3 min-h-[32px]">{item.descricao}</p>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg">🪙</span>
                          <span className="text-2xl font-black text-gray-800">{item.preco}</span>
                          <span className="text-xs text-gray-400 font-bold">moedas</span>
                        </div>
                        {!podePagar && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Faltam {item.preco - saldo}</span>}
                      </div>
                      <button onClick={() => comprar(item)} disabled={!podePagar || estaComprando} className={`w-full py-2.5 rounded-xl font-black text-sm transition-all ${estaComprando ? 'bg-gray-200 text-gray-400 cursor-wait' : podePagar ? `bg-gradient-to-r ${item.cor} text-white hover:shadow-lg hover:scale-[1.02] active:scale-95` : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                        {estaComprando ? '⏳ Processando...' : podePagar ? '🛒 Resgatar' : '🔒 Saldo insuficiente'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* HISTÓRICO */}
          {mostrarHistorico && (
            <div>
              <h3 className="text-sm font-black text-gray-600 mb-3">📜 Últimas compras</h3>
              {compras.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Nenhuma compra ainda. Acumule moedas e resgate prêmios!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {compras.map(c => {
                    const item = ITENS_LOJA.find(i => i.id === c.item_id)
                    return (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item?.emoji || '📦'}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{c.item_nome}</p>
                            <p className="text-[11px] text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-gray-600">🪙 {c.preco}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.status === 'entregue' ? 'bg-green-100 text-green-700' : c.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.status === 'entregue' ? '✅ Entregue' : c.status === 'pendente' ? '⏳ Pendente' : c.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">💡 Moedas são conquistadas por bons atendimentos. A gestão adiciona moedas ao seu saldo.</p>
          </div>
        </div>
      )}
    </div>
  )
}
