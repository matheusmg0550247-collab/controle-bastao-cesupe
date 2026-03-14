import { useState, useEffect, useRef } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { supabase } from '../lib/supabase'

interface ItemPortfolio {
  produto_nome: string
  criador: string
  quantidade: number
  preco_compra: number
}

interface Jogador {
  id: string
  consultor: string
  saldo: number
  produto_nome: string | null
  produto_preco: number | null
  portfolio: ItemPortfolio[]
}

export function LojinhaRashid() {
  const { meuLogin } = useBastaoStore()
  const [aberto, setAberto] = useState(false)
  const [jogadores, setJogadores] = useState<Jogador[]>([])
  const [letreiro, setLetreiro] = useState('🧞 Bem-vindo à Lojinha do Sr. Rashid! Nomeie um produto, invista e torça pela valorização!')
  const [nomeProduto, setNomeProduto] = useState('')
  const [loading, setLoading] = useState(false)
  const [qtdCompra, setQtdCompra] = useState<Record<string, number>>({})
  const marqueeRef = useRef<HTMLDivElement>(null)

  const meuJogador = jogadores.find(j => j.consultor === meuLogin)
  const meuPortfolio: ItemPortfolio[] = meuJogador?.portfolio || []

  const carregarDados = async () => {
    const [resJogadores, resResultado] = await Promise.all([
      supabase.from('lojinha_jogadores').select('*').order('consultor'),
      supabase.from('lojinha_resultados').select('letreiro, vencedor').order('data', { ascending: false }).limit(1).maybeSingle()
    ])
    if (resJogadores.data) {
      setJogadores(resJogadores.data.map(j => ({
        ...j,
        portfolio: Array.isArray(j.portfolio) ? j.portfolio : []
      })))
    }
    if (resResultado.data?.letreiro) setLetreiro(resResultado.data.letreiro)
  }

  useEffect(() => {
    carregarDados()
    const channel = supabase.channel('lojinha-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_jogadores' }, () => carregarDados())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lojinha_resultados' }, () => carregarDados())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Preço atual de um produto (busca do jogador que criou)
  const precoAtual = (nomeProd: string): number => {
    const criador = jogadores.find(j => j.produto_nome === nomeProd)
    return criador?.produto_preco || 0
  }

  // Valor total do portfólio
  const valorPortfolio = meuPortfolio.reduce((sum, p) => sum + (precoAtual(p.produto_nome) * p.quantidade), 0)
  const totalInvestido = meuPortfolio.reduce((sum, p) => sum + (p.preco_compra * p.quantidade), 0)

  // Criar produto
  const criarProduto = async () => {
    if (!nomeProduto.trim() || !meuLogin) return
    setLoading(true)
    try {
      const preco = Math.floor(Math.random() * 451) + 50
      await supabase.from('lojinha_jogadores').update({
        produto_nome: nomeProduto.trim(),
        produto_preco: preco,
        updated_at: new Date().toISOString()
      }).eq('consultor', meuLogin)
      setNomeProduto('')
      await carregarDados()
    } catch (e) { console.error('Erro ao criar produto:', e) }
    finally { setLoading(false) }
  }

  // COMPRAR produto
  const comprarProduto = async (vendedor: Jogador, qtd: number) => {
    if (!meuLogin || !meuJogador || !vendedor.produto_nome || !vendedor.produto_preco || qtd < 1) return
    const custoTotal = vendedor.produto_preco * qtd
    if (meuJogador.saldo < custoTotal) return alert('💰 Saldo insuficiente!')

    setLoading(true)
    try {
    const portfolioAtual: ItemPortfolio[] = [...meuPortfolio]
    const existente = portfolioAtual.find(p => p.produto_nome === vendedor.produto_nome)

    if (existente) {
      // Média ponderada do preço de compra
      const totalAntigo = existente.preco_compra * existente.quantidade
      existente.quantidade += qtd
      existente.preco_compra = Math.round((totalAntigo + custoTotal) / existente.quantidade)
    } else {
      portfolioAtual.push({
        produto_nome: vendedor.produto_nome,
        criador: vendedor.consultor,
        quantidade: qtd,
        preco_compra: vendedor.produto_preco
      })
    }

    await supabase.from('lojinha_jogadores').update({
      saldo: meuJogador.saldo - custoTotal,
      portfolio: portfolioAtual,
      updated_at: new Date().toISOString()
    }).eq('consultor', meuLogin)

    // Registrar na lojinha_compra (histórico)
    await supabase.from('lojinha_compra').insert({
      comprador: meuLogin,
      vendedor: vendedor.consultor,
      produto_nome: vendedor.produto_nome,
      preco: vendedor.produto_preco,
      quantidade: qtd
    }).catch(() => {})

    setQtdCompra(prev => ({ ...prev, [vendedor.consultor]: 1 }))
      await carregarDados()
    } catch (e) { console.error('Erro ao comprar:', e) }
    finally { setLoading(false) }
  }

  // VENDER produto do portfólio
  const venderProduto = async (item: ItemPortfolio, qtd: number) => {
    if (!meuLogin || !meuJogador || qtd < 1 || qtd > item.quantidade) return

    setLoading(true)
    try {
    const precoVenda = precoAtual(item.produto_nome)
    const recebido = precoVenda * qtd

    const portfolioAtual: ItemPortfolio[] = meuPortfolio.map(p => {
      if (p.produto_nome === item.produto_nome) {
        return { ...p, quantidade: p.quantidade - qtd }
      }
      return p
    }).filter(p => p.quantidade > 0)

    await supabase.from('lojinha_jogadores').update({
      saldo: meuJogador.saldo + recebido,
      portfolio: portfolioAtual,
      updated_at: new Date().toISOString()
    }).eq('consultor', meuLogin)

    await carregarDados()
    } catch (e) { console.error('Erro ao vender:', e) }
    finally { setLoading(false) }
  }

  const produtos = jogadores.filter(j => j.produto_nome)

  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl shadow-lg border-2 border-amber-200 overflow-hidden">
      {/* MARQUEE */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-700 px-4 py-2 overflow-hidden">
        <div ref={marqueeRef} className="animate-marquee whitespace-nowrap text-yellow-300 font-bold text-sm">
          {letreiro} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {letreiro}
        </div>
      </div>

      {/* HEADER */}
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-100/50 transition-colors cursor-pointer border-0 bg-transparent"
      >
        <div className="flex items-center gap-3">
          <div className="relative group">
            <img
              src="/Nikos.png"
              alt="Sr. Nikos"
              className="w-14 h-14 rounded-full border-2 border-amber-300 shadow-md object-cover cursor-pointer transition-transform duration-200 group-hover:scale-110"
            />
            <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="transform scale-50 group-hover:scale-100 transition-transform duration-500">
                <img
                  src="/Nikos.png"
                  alt="Sr. Nikos"
                  className="w-72 h-72 sm:w-96 sm:h-96 rounded-3xl border-4 border-amber-400 shadow-2xl object-cover"
                />
                <p className="text-center mt-4 text-2xl font-black text-yellow-300 drop-shadow-lg">🧞 Sr. Nikos Rashid 🧞</p>
              </div>
            </div>
          </div>
          <div className="text-left">
            <h2 className="text-xl font-black text-amber-900">Lojinha do Sr. Rashid</h2>
            <p className="text-xs text-amber-600 font-medium">Invista em produtos engraçados e torça pela valorização da noite!</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {meuJogador && (
            <div className="flex items-center gap-3">
              <div className="bg-amber-200/60 px-3 py-1.5 rounded-xl text-center">
                <p className="text-[10px] text-amber-700 font-bold">Saldo</p>
                <p className="font-black text-amber-900">🪙 {meuJogador.saldo}</p>
              </div>
              {meuPortfolio.length > 0 && (
                <div className="bg-blue-100/60 px-3 py-1.5 rounded-xl text-center">
                  <p className="text-[10px] text-blue-700 font-bold">Portfólio</p>
                  <p className="font-black text-blue-900">📦 {meuPortfolio.reduce((s, p) => s + p.quantidade, 0)}</p>
                </div>
              )}
            </div>
          )}
          <span className={`text-2xl transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>

      {/* CONTEÚDO */}
      {aberto && (
        <div className="px-6 pb-6 space-y-5">

          {/* CRIAR PRODUTO */}
          {meuJogador && !meuJogador.produto_nome ? (
            <div className="bg-white rounded-2xl p-5 border-2 border-dashed border-amber-300 shadow-sm">
              <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                <span className="text-xl">🏷️</span> Nomeie seu produto!
              </h3>
              <p className="text-xs text-gray-500 mb-3">Dê um nome engraçado — ele entrará na prateleira com um preço aleatório (50-500). Depois é torcer!</p>
              <div className="flex gap-2">
                <input
                  value={nomeProduto}
                  onChange={e => setNomeProduto(e.target.value)}
                  placeholder="Ex: Tapete Voador Anti-Reunião..."
                  maxLength={60}
                  className="flex-1 border-2 border-amber-200 rounded-xl px-4 py-3 font-medium focus:border-amber-500 focus:outline-none text-sm"
                  onKeyDown={e => e.key === 'Enter' && criarProduto()}
                />
                <button
                  onClick={criarProduto}
                  disabled={loading || !nomeProduto.trim()}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-6 py-3 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 text-sm border-0 cursor-pointer"
                >
                  🎲 Criar!
                </button>
              </div>
            </div>
          ) : meuJogador?.produto_nome ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📦</span>
                  <div>
                    <p className="text-xs text-green-600 font-bold">Seu produto na prateleira:</p>
                    <p className="font-black text-green-900">{meuJogador.produto_nome}</p>
                  </div>
                </div>
                <div className="bg-green-100 px-4 py-2 rounded-xl">
                  <p className="font-black text-green-700 text-xl">🪙 {meuJogador.produto_preco}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* MEU PORTFÓLIO */}
          {meuPortfolio.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm">
              <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span className="text-xl">💼</span> Meu Portfólio
                <span className="ml-auto text-sm font-black text-blue-600">
                  Valor: 🪙 {valorPortfolio}
                  {valorPortfolio - totalInvestido !== 0 && (
                    <span className={`ml-2 text-xs ${valorPortfolio - totalInvestido > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ({valorPortfolio - totalInvestido > 0 ? '+' : ''}{valorPortfolio - totalInvestido})
                    </span>
                  )}
                </span>
              </h3>
              <div className="space-y-2">
                {meuPortfolio.map(p => {
                  const precoAgora = precoAtual(p.produto_nome)
                  const lucroUnit = precoAgora - p.preco_compra
                  return (
                    <div key={p.produto_nome} className="flex items-center justify-between bg-blue-50/60 rounded-xl px-4 py-2.5">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-sm">{p.produto_nome}</p>
                        <p className="text-[11px] text-gray-400">
                          por {p.criador} • {p.quantidade}x • comprou a 🪙{p.preco_compra}
                          {lucroUnit !== 0 && (
                            <span className={`ml-1 font-bold ${lucroUnit > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              ({lucroUnit > 0 ? '↑' : '↓'}{Math.abs(lucroUnit)}/un)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="font-black text-blue-700">🪙 {precoAgora * p.quantidade}</p>
                          <p className="text-[10px] text-gray-400">({precoAgora}/un)</p>
                        </div>
                        <button
                          onClick={() => venderProduto(p, 1)}
                          disabled={loading}
                          className="bg-gradient-to-r from-red-400 to-rose-500 hover:from-red-500 hover:to-rose-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-40 text-xs border-0 cursor-pointer whitespace-nowrap"
                        >
                          Vender 1
                        </button>
                        {p.quantidade > 1 && (
                          <button
                            onClick={() => venderProduto(p, p.quantidade)}
                            disabled={loading}
                            className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-40 text-xs border-0 cursor-pointer whitespace-nowrap"
                          >
                            Vender tudo
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* PRATELEIRA */}
          <div>
            <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
              <span className="text-xl">🛒</span> Prateleira do Sr. Rashid
              <span className="text-xs text-gray-400 font-normal ml-1">({produtos.length} produtos)</span>
            </h3>
            {produtos.length === 0 ? (
              <div className="bg-white/60 rounded-xl p-8 text-center border border-amber-100">
                <span className="text-4xl block mb-2">🏜️</span>
                <p className="text-gray-500 font-medium">As prateleiras estão vazias...</p>
                <p className="text-xs text-gray-400">Seja o primeiro a nomear um produto!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {produtos.map(v => {
                  const qtd = qtdCompra[v.consultor] || 1
                  const custoTotal = (v.produto_preco || 0) * qtd
                  const semSaldo = (meuJogador?.saldo || 0) < custoTotal
                  const maxQtd = Math.max(1, Math.floor((meuJogador?.saldo || 0) / (v.produto_preco || 1)))

                  return (
                    <div key={v.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm hover:shadow-md hover:border-amber-300 transition-all">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-bold text-gray-800 text-sm leading-tight flex-1">{v.produto_nome}</p>
                        <span className="font-black text-amber-700 ml-2 whitespace-nowrap">🪙 {v.produto_preco}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-3">por {v.consultor}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setQtdCompra(prev => ({ ...prev, [v.consultor]: Math.max(1, qtd - 1) }))}
                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-sm border-0 cursor-pointer"
                          >−</button>
                          <span className="px-3 py-1 text-sm font-bold min-w-[32px] text-center">{qtd}</span>
                          <button
                            onClick={() => setQtdCompra(prev => ({ ...prev, [v.consultor]: Math.min(maxQtd, qtd + 1) }))}
                            className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-sm border-0 cursor-pointer"
                          >+</button>
                        </div>
                        <button
                          onClick={() => comprarProduto(v, qtd)}
                          disabled={loading || semSaldo}
                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-40 text-xs border-0 cursor-pointer"
                        >
                          Comprar 🪙{custoTotal}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* REGRAS */}
          <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
            <p className="text-[11px] text-amber-700 text-center">
              🎲 <strong>Como funciona:</strong> Nomeie 1 produto → Invista suas 🪙1000 comprando produtos (seus ou dos colegas) →
              Venda e troque quando quiser → À noite os preços mudam aleatoriamente → Quem tiver o portfólio mais valioso vence! 🏆
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 80s linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
