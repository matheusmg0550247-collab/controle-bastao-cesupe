export const EQUIPE_EPROC = [
  "Barbara Mara", "Bruno Glaicon", "Claudia Luiza", "Douglas Paiva", "Fábio Alves",
  "Glayce Torres", "Isabela Dias", "Isac Candido", "Ivana Bastos", "Leonardo Damaceno",
  "Marcelo Pena Guerra", "Michael Douglas", "Morôni", "Pablo Mol", "Ranyer Segal",
  "Sarah Leal", "Victoria Lisboa"
].sort();

export const EQUIPE_JPE = [
  "Alex Paulo", "Dirceu Gonçalves", "Douglas De Souza", "Farley", "Gleis",
  "Hugo Leonardo", "Igor Dayrell", "Jerry Marcos", "Jonatas", "Leandro",
  "Luiz Henrique", "Marcelo dos Santos Dutra", "Marina Marques",
  "Marina Torres", "Vanessa Ligiane"
].sort();

export const TODOS_CONSULTORES = [...EQUIPE_EPROC, ...EQUIPE_JPE].sort();

export const RAMAIS: Record<string, string> = {
  "Alex": "2650", "Barbara": "4201", "Bruno": "2644", "Claudia": "2667",
  "Dirceu": "2666", "Douglas": "4210", "Douglas Paiva": "2663", "Fabio": "2665", "Fábio": "2665",
  "Farley": "2651", "Gilberto": "2645", "Gleis": "4212", "Gleyce": "2647", "Glayce": "2647",
  "Hugo": "4207", "Igor": "4203", "Isabela": "4205", "Isac": "2517",
  "Ivana": "2653", "Ivana Bastos": "2653", "Jerry": "2654", "Jonatas": "2656", "Juliana": "4209",
  "Larissa": "2661", "Leandro": "2652", "Leonardo": "4204", "Luiz": "4202",
  "Marcelo": "2655", "Marcelo Pena": "4208", "Marcelo Pena Guerra": "4208", "Marina Amaral": "4211",
  "Marina Marques": "2607", "Matheus": "2664", "Michael": "2516", "Michael Douglas": "2516",
  "Morôni": "4206", "Pablo": "2658", "Ranyer": "2669", "Sarah": "2643",
  "Vanessa": "2510", "Victória": "2660", "Victoria": "2660",
  "Brenda": "", "Marina Torres": ""
};

export interface UsuarioSistema {
  nome: string;
  perfil: 'Gestor' | 'Secretaria' | 'Consultor';
}

export const USUARIOS_SISTEMA: UsuarioSistema[] = [
  { nome: 'Matheus', perfil: 'Gestor' },
  { nome: 'Gilberto', perfil: 'Gestor' },
  { nome: 'Juliana', perfil: 'Secretaria' },
  { nome: 'Brenda', perfil: 'Secretaria' },
  { nome: 'Larissa', perfil: 'Secretaria' },
  ...EQUIPE_EPROC.map(nome => ({ nome, perfil: 'Consultor' as const })),
  ...EQUIPE_JPE.map(nome => ({ nome, perfil: 'Consultor' as const })),
];

export function getRamal(nome: string): string {
  if (RAMAIS[nome]) return RAMAIS[nome];
  const primeiroNome = nome.split(" ")[0];
  return RAMAIS[primeiroNome] || "S/R";
}

export function getEquipe(nome: string): "EPROC" | "JPE" | null {
  if (EQUIPE_EPROC.includes(nome)) return "EPROC";
  if (EQUIPE_JPE.includes(nome)) return "JPE";
  return null;
}
