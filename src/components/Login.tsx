import { useState } from 'react';
import { useBastaoStore } from '../store/useBastaoStore';
import { USUARIOS_SISTEMA } from '../constants';

export function Login() {
  const { setMeuLogin } = useBastaoStore();
  const [nomeSelecionado, setNomeSelecionado] = useState('');
  const [senha, setSenha] = useState('');

  // Identifica se a pessoa tem acesso restrito (Tanto Gestão quanto Projetos têm o perfil Gestor no nosso sistema)
  const userObj = USUARIOS_SISTEMA.find(u => u.nome === nomeSelecionado);
  const isRestrito = userObj?.perfil === 'Gestor';

  const handleEntrar = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRestrito && senha !== '2751') {
      alert('Senha incorreta para acesso restrito!');
      return;
    }
    if (nomeSelecionado) setMeuLogin(nomeSelecionado);
  }

  const gestores = USUARIOS_SISTEMA.filter(u => u.equipe === 'Gestão');
  const projetos = USUARIOS_SISTEMA.filter(u => u.equipe === 'Projetos');
  const secretaria = USUARIOS_SISTEMA.filter(u => u.equipe === 'Secretaria');
  const eproc = USUARIOS_SISTEMA.filter(u => u.equipe === 'Eproc');
  const legados = USUARIOS_SISTEMA.filter(u => u.equipe === 'Legados');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" style={{ backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-8 border border-gray-200">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-indigo-900 mb-2 tracking-tight">Controle Bastão 🎭</h1>
          <p className="text-gray-500 font-medium">Selecione seu perfil para acessar o painel</p>
        </div>
        
        <form onSubmit={handleEntrar} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">Identificação:</label>
            <select value={nomeSelecionado} onChange={(e) => { setNomeSelecionado(e.target.value); setSenha(''); }} className="w-full border-2 border-gray-200 rounded-xl p-4 outline-none focus:border-indigo-500 font-bold text-gray-800 bg-gray-50" required>
              <option value="" disabled>Quem é você?</option>
              
              <optgroup label="👑 Gestão">
                {gestores.map(u => (<option key={u.nome} value={u.nome}>{u.nome}</option>))}
              </optgroup>

              <optgroup label="🎯 Projetos">
                {projetos.map(u => (<option key={u.nome} value={u.nome}>{u.nome}</option>))}
              </optgroup>

              <optgroup label="🌸 Secretaria Cesupe">
                {secretaria.map(u => (<option key={u.nome} value={u.nome}>{u.nome}</option>))}
              </optgroup>

              <optgroup label="🔵 Consultores Eproc">
                {eproc.map(u => (<option key={u.nome} value={u.nome}>{u.nome}</option>))}
              </optgroup>

              <optgroup label="🟠 Consultores Legados">
                {legados.map(u => (<option key={u.nome} value={u.nome}>{u.nome}</option>))}
              </optgroup>
              
            </select>
          </div>

          {/* SÓ MOSTRA SENHA SE FOR GESTOR OU PROJETOS */}
          {isRestrito && (
            <div className="flex flex-col gap-2 animate-pulse">
              <label className="text-sm font-bold text-indigo-700">Senha de Acesso Restrito:</label>
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Digite a senha..." className="w-full border-2 border-indigo-200 rounded-xl p-4 outline-none focus:border-indigo-500 font-bold bg-indigo-50" required />
            </div>
          )}

          <button type="submit" disabled={!nomeSelecionado} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50">Entrar no Sistema</button>
        </form>
      </div>
    </div>
  )
}