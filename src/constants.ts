export const USUARIOS_SISTEMA = [
  // 🌸 Secretaria
  { nome: 'Brenda', perfil: 'Secretaria', equipe: 'Secretaria' },
  { nome: 'Larissa', perfil: 'Secretaria', equipe: 'Secretaria' },

  // 👑 Gestores
  { nome: 'Gilberto', perfil: 'Gestor', equipe: 'Gestão' },
  { nome: 'Matheus', perfil: 'Gestor', equipe: 'Gestão' },

  // 🎯 Projetos (Tem o perfil Gestor para acessar o painel e pedir senha)
  { nome: 'Juliana', perfil: 'Gestor', equipe: 'Projetos' },

  // 🔵 Consultores Eproc
  { nome: 'Barbara Mara', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Bruno Glaicon', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Claudia Luiza', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Douglas Paiva', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Fábio Alves', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Glayce Torres', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Isabela Dias', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Isac Candido', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Ivana Guimarães', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Leonardo Damaceno', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Marcelo Pena Guerra', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Michael Douglas', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Morôni', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Pablo Mol', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Ranyer Segal', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Sarah Leal', perfil: 'Consultor', equipe: 'Eproc' },
  { nome: 'Victoria Lisboa', perfil: 'Consultor', equipe: 'Eproc' },

  // 🟠 Consultores Legados
  { nome: 'Alex Paulo', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Dirceu Gonçalves', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Douglas De Souza', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Farley', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Gleis', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Hugo Leonardo', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Igor Dayrell', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Jerry Marcos', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Jonatas', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Leandro', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Luiz Henrique', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Marcelo dos Santos Dutra', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Marina Amaral', perfil: 'Consultor', equipe: 'Legados' }, // Padronizado!
  { nome: 'Marina Marques', perfil: 'Consultor', equipe: 'Legados' },
  { nome: 'Vanessa Ligiane', perfil: 'Consultor', equipe: 'Legados' }
].sort((a, b) => a.nome.localeCompare(b.nome));

export function getEquipe(nome: string): "EPROC" | "JPE" | null {
  const user = USUARIOS_SISTEMA.find(u => u.nome === nome);
  if (user?.equipe === 'Eproc') return "EPROC";
  if (user?.equipe === 'Legados') return "JPE";
  return null;
}

const RAMAIS: Record<string, string> = {
  'Alex Paulo': '2650', 'Barbara Mara': '4201', 'Bruno Glaicon': '2644',
  'Claudia Luiza': '2667', 'Dirceu Gonçalves': '2666', 'Douglas De Souza': '4210',
  'Douglas Paiva': '2663', 'Fábio Alves': '2665', 'Farley': '2651',
  'Gilberto': '2645', 'Gleis': '4212', 'Glayce Torres': '2647',
  'Hugo Leonardo': '4207', 'Igor Dayrell': '4203', 'Isabela Dias': '4205',
  'Isac Candido': '2517', 'Ivana Guimarães': '2653', 'Jerry Marcos': '2654',
  'Jonatas': '2656', 'Juliana': '4209', 'Larissa': '2661',
  'Leandro': '2652', 'Leonardo Damaceno': '4204', 'Luiz Henrique': '4202',
  'Marcelo dos Santos Dutra': '2655', 'Marcelo Pena Guerra': '4208', 'Marina Amaral': '4211',
  'Marina Marques': '2607', 'Matheus': '2664', 'Michael Douglas': '2516',
  'Morôni': '4206', 'Pablo Mol': '2658', 'Ranyer Segal': '2669',
  'Sarah Leal': '2643', 'Vanessa Ligiane': '2510', 'Victoria Lisboa': '2660'
};

export function getRamal(nome: string): string { return RAMAIS[nome] || '----'; }