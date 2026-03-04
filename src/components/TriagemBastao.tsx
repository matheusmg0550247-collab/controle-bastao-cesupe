import { useState, useRef } from 'react'
import { useBastaoStore } from '../store/useBastaoStore'
import { TRIAGEM_HP } from '../constants'

const WEBHOOK_TRIAGEM = "https://matheusgomes12.app.n8n.cloud/webhook/b23e961a-3cd1-4a3e-8677-dc78c8bd0e73"

export function TriagemBastao() {
  const { meuLogin } = useBastaoStore()
  const isTriagem = TRIAGEM_HP.some(nome => meuLogin?.toLowerCase().includes(nome.toLowerCase()))

  const [modalAberto, setModalAberto] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isTriagem) return null

  const handleEnviar = async () => {
    if (!arquivo) return
    setLoading(true)
    setStatus('idle')
    try {
      const formData = new FormData()
      formData.append('file', arquivo, arquivo.name)
      formData.append('consultor', meuLogin || '')
      const res = await fetch(WEBHOOK_TRIAGEM, { method: 'POST', body: formData })
      if (res.ok) {
        setStatus('ok')
        setTimeout(() => {
          setModalAberto(false)
          setArquivo(null)
          setStatus('idle')
        }, 2000)
      } else {
        setStatus('erro')
      }
    } catch {
      setStatus('erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setModalAberto(true)}
        className="group flex items-center justify-center gap-3 w-full px-6 py-4 bg-gradient-to-r from-green-500 via-green-500 to-emerald-500 hover:from-green-600 hover:via-green-600 hover:to-emerald-600 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-0"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform duration-300">📋</span>
        <span className="tracking-wide">Triagem Chamados</span>
        <span className="text-white/70 group-hover:translate-x-1 transition-transform duration-300">→</span>
      </button>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-green-200">
            <h3 className="text-xl font-extrabold text-green-700 mb-1 flex items-center gap-2">📋 Triagem Chamados</h3>
            <p className="text-sm text-gray-500 mb-5">Envie o PDF da triagem para processamento automático no n8n.</p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors
                ${arquivo ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-green-400 hover:bg-green-50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              />
              {arquivo ? (
                <>
                  <span className="text-3xl mb-2">📄</span>
                  <span className="font-bold text-green-700 text-center break-all">{arquivo.name}</span>
                  <span className="text-xs text-gray-400 mt-1">{(arquivo.size / 1024).toFixed(1)} KB · clique para trocar</span>
                </>
              ) : (
                <>
                  <span className="text-3xl mb-2">⬆️</span>
                  <span className="font-bold text-gray-600">Clique para selecionar o PDF</span>
                  <span className="text-xs text-gray-400 mt-1">Somente arquivos .pdf</span>
                </>
              )}
            </div>

            {status === 'ok' && (
              <div className="mt-3 text-center text-green-600 font-bold">✅ PDF enviado com sucesso!</div>
            )}
            {status === 'erro' && (
              <div className="mt-3 text-center text-red-600 font-bold">❌ Falha ao enviar. Tente novamente.</div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                disabled={!arquivo || loading}
                onClick={handleEnviar}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md transition-all"
              >
                {loading ? '⏳ Enviando...' : '📤 Enviar para n8n'}
              </button>
              <button
                onClick={() => { setModalAberto(false); setArquivo(null); setStatus('idle') }}
                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
