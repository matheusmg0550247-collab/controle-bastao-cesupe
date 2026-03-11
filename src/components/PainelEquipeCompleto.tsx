import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useBastaoStore } from '../store/useBastaoStore'
import { TODOS_CONSULTORES, EQUIPE_EPROC, EQUIPE_JPE } from '../constants'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AgendaDetalhe { id:string;data:string;nome_sessao:string;modalidade?:string;horario?:string;plenario?:string;descricao?:string;pauta?:number;mesa?:number;consultores:string[];criado_por:string;criado_em:string }
interface AgendaAtividade { id:string;data:string;tipo:string;observacao?:string;consultores:string[];criado_por:string;criado_em:string }
interface Plantao { id:string;tipo_dia:string;date:string;plantonistas:string }
interface Ferias { id:string;consultor:string;ano:number;inicio:string;fim:string;observacao?:string }
interface SalaReserva { id:string;data:string;turno:string;titulo:string;descricao?:string;responsavel?:string }
interface TreinamentoExterno { id:string;data:string;tipo:string;local_nome:string;local_tipo?:string;consultores:string[];observacao?:string }

// ─── Catálogos sessões ────────────────────────────────────────────────────────
const SESSOES_CATALOGO = [
  'SESSÃO 1ª CÍVEL','SESSÃO 2ª CÍVEL','SESSÃO 3ª CÍVEL','SESSÃO 4ª CÍVEL ESP.',
  'SESSÃO 5ª CÍVEL','SESSÃO 6ª CÍVEL','SESSÃO 7ª CÍVEL','SESSÃO 8ª CÍVEL',
  'SESSÃO 8ª CÍVEL ESP.','SESSÃO 8ª CÍVEL ESPECIALIZADA','SESSÃO 9ª CÍVEL',
  'SESSÃO 10ª CÍVEL','SESSÃO 11ª CÍVEL','SESSÃO 12ª CÍVEL','SESSÃO 13ª CÍVEL',
  'SESSÃO 14ª CÍVEL','SESSÃO 15ª CÍVEL','SESSÃO 16ª CÍVEL','SESSÃO 17ª CÍVEL',
  'SESSÃO 18ª CÍVEL','SESSÃO 19ª CÍVEL','SESSÃO 20ª CÍVEL','SESSÃO 21ª CÍVEL',
  'SESSÃO 21ª CÍVEL ESP.','SESSÃO 1ª CRIMINAL','SESSÃO 2ª CRIMINAL','SESSÃO 3ª CRIMINAL',
  'SESSÃO 4ª CRIMINAL','SESSÃO 5ª CRIMINAL','SESSÃO 6ª CRIMINAL','SESSÃO 7ª CRIMINAL',
  'SESSÃO 8ª CRIMINAL','SESSÃO 9ª CRIMINAL ESP.','SESSÃO ÓRGÃO ESPECIAL',
  'SESSÃO TRIBUNAL PLENO','SESSÃO CONSELHO DA MAGISTRATURA',
  'SESSÃO NÚCLEO DE JUSTIÇA 4.0','SESSÃO 1º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 2º NÚCLEO DE JUSTIÇA 4.0','SESSÃO 3º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0','SESSÃO 5º NÚCLEO DE JUSTIÇA 4.0',
  'SESSÃO 6º NÚCLEO DE JUSTIÇA 4.0','SESSÃO 1º GRUPO CRIMINAL',
  'VIRTUAL SESSÃO 1ª CÍVEL','VIRTUAL SESSÃO 2ª CÍVEL','VIRTUAL SESSÃO 3ª CÍVEL',
  'VIRTUAL SESSÃO 4ª CÍVEL ESPECIALIZADA','VIRTUAL SESSÃO 5ª CÍVEL',
  'VIRTUAL SESSÃO 6ª CÍVEL','VIRTUAL SESSÃO 7ª CÍVEL','VIRTUAL SESSÃO 10ª CÍVEL',
  'VIRTUAL SESSÃO 12ª CÍVEL','VIRTUAL SESSÃO 13ª CÍVEL','VIRTUAL SESSÃO 14ª CÍVEL',
  'VIRTUAL SESSÃO 15ª CÍVEL','VIRTUAL SESSÃO 16ª CÍVEL','VIRTUAL SESSÃO 17ª CÍVEL',
  'VIRTUAL SESSÃO 21ª CÍVEL','VIRTUAL SESSÃO 21ª CÍVEL ESP.',
  'VIRTUAL SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0',
].sort()

const HORARIOS_PADRAO:Record<string,string>={'SESSÃO 6ª CÍVEL':'13:30','SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0':'13:30','SESSÃO 17ª CÍVEL':'08:00'}
const PLENARIOS_PADRAO:Record<string,string>={'SESSÃO 6ª CÍVEL':'05','SESSÃO 8ª CÍVEL ESP.':'06','SESSÃO 10ª CÍVEL':'10','SESSÃO 11ª CÍVEL':'10','SESSÃO ÓRGÃO ESPECIAL':'AUDITÓRIO','SESSÃO NÚCLEO DE JUSTIÇA 4.0':'11','SESSÃO 4º NÚCLEO DE JUSTIÇA 4.0':'11'}

// ─── Locais de treinamento (varas + gabinetes do PDF) ─────────────────────────
const LOCAIS_TREINAMENTO = [
  // Varas BH
  {nome:'1ª Vara da Fazenda Pública',tipo:'Vara Fazenda - BH'},
  {nome:'2ª Vara da Fazenda Pública',tipo:'Vara Fazenda - BH'},
  {nome:'3ª Vara da Fazenda Pública',tipo:'Vara Fazenda - BH'},
  {nome:'4ª Vara da Fazenda Pública',tipo:'Vara Fazenda - BH'},
  {nome:'5ª Vara da Fazenda Pública',tipo:'Vara Fazenda - BH'},
  {nome:'7ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'11ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'14ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'18ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'20ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'24ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'28ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'29ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'31ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'32ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'35ª Vara Cível',tipo:'Vara Cível - BH'},
  {nome:'1ª Vara Empresarial',tipo:'Vara Empresarial - BH'},
  {nome:'2ª Vara Empresarial',tipo:'Vara Empresarial - BH'},
  {nome:'1ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'3ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'5ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'7ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'11ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'12ª Vara de Família',tipo:'Vara de Família - BH'},
  {nome:'1ª Vara de Sucessões',tipo:'Vara de Sucessões - BH'},
  {nome:'2ª Vara de Sucessões',tipo:'Vara de Sucessões - BH'},
  {nome:'2ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'3ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'7ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'8ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'9ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'11ª Vara Criminal',tipo:'Vara Criminal - BH'},
  {nome:'Vara de Execuções Criminais',tipo:'VEC - BH'},
  {nome:'1º Juizado de Violência Doméstica',tipo:'JVDFM - BH'},
  {nome:'4º Juizado de Violência Doméstica',tipo:'JVDFM - BH'},
  {nome:'Vara Infracional da Infância e Juventude',tipo:'Infância - BH'},
  {nome:'1ª Vara Cível da Infância e Juventude',tipo:'Infância - BH'},
  {nome:'2ª Vara Cível da Infância e Juventude',tipo:'Infância - BH'},
  {nome:'1ª Vara do Tribunal do Júri',tipo:'Júri - BH'},
  {nome:'2ª Vara do Tribunal do Júri',tipo:'Júri - BH'},
  {nome:'CENTRASE - Cível',tipo:'Central - BH'},
  {nome:'CENTRASE – Fazenda Pública',tipo:'Central - BH'},
  // Betim
  {nome:'2ª Vara Cível - Betim',tipo:'Vara Cível - Betim'},
  {nome:'5ª Vara Cível - Betim',tipo:'Vara Cível - Betim'},
  {nome:'3ª Vara Criminal - Betim',tipo:'Vara Criminal - Betim'},
  // Contagem
  {nome:'2ª Vara Cível - Contagem',tipo:'Vara Cível - Contagem'},
  {nome:'4ª Vara Cível - Contagem',tipo:'Vara Cível - Contagem'},
  {nome:'6ª Vara Cível - Contagem',tipo:'Vara Cível - Contagem'},
  {nome:'3ª Vara Criminal - Contagem',tipo:'Vara Criminal - Contagem'},
  {nome:'4ª Vara Criminal - Contagem',tipo:'Vara Criminal - Contagem'},
  // Gabinetes 2º Grau
  {nome:'Gab. Des. Alberto Vilas Boas',tipo:'1ª Câmara Cível'},
  {nome:'Gab. Des. Marcelo Rodrigues',tipo:'1ª Câmara Cível'},
  {nome:'Gab. Des. Márcio Idalmo Santos Miranda',tipo:'1ª Câmara Cível'},
  {nome:'Gab. Des. Manoel dos Reis Morais',tipo:'1ª Câmara Cível'},
  {nome:'Gab. Desa. Juliana Campos Horta',tipo:'1ª Câmara Cível'},
  {nome:'Gab. Des. Júlio Cezar Guttierrez',tipo:'2ª Câmara Cível'},
  {nome:'Gab. Des. Raimundo Messias Júnior',tipo:'2ª Câmara Cível'},
  {nome:'Gab. Desa. Maria Inês Souza',tipo:'2ª Câmara Cível'},
  {nome:'Gab. Desa. Maria Cristina Cunha Carvalhais',tipo:'2ª Câmara Cível'},
  {nome:'Gab. Desa. Mônica Aragão Martiniano',tipo:'2ª Câmara Cível'},
  {nome:'Gab. Des. Jair Varão',tipo:'3ª Câmara Cível'},
  {nome:'Gab. Des. Alberto Diniz Júnior',tipo:'3ª Câmara Cível'},
  {nome:'Gab. Des. Pedro Aleixo',tipo:'3ª Câmara Cível'},
  {nome:'Gab. Des. Maurício Soares',tipo:'3ª Câmara Cível'},
  {nome:'Gab. Desa. Luzia Divina de Paula Peixôto',tipo:'3ª Câmara Cível'},
  {nome:'Gab. Desa. Ana Paula Caixeta',tipo:'4ª Câmara Cível Esp.'},
  {nome:'Gab. Desa. Alice Birchal',tipo:'4ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Adriano de Mesquita Carneiro',tipo:'4ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Roberto Apolinário de Castro',tipo:'4ª Câmara Cível Esp.'},
  {nome:'Gab. Desa. Fabiana da Cunha Pasqua',tipo:'4ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Carlos Levenhagen',tipo:'5ª Câmara Cível'},
  {nome:'Gab. Desa. Áurea Brasil',tipo:'5ª Câmara Cível'},
  {nome:'Gab. Des. Luís Carlos Gambogi',tipo:'5ª Câmara Cível'},
  {nome:'Gab. Des. Fábio Torres de Sousa',tipo:'5ª Câmara Cível'},
  {nome:'Gab. Juiz Marcelo Paulo Salgado',tipo:'5ª Câmara Cível'},
  {nome:'Gab. Des. Edilson Olímpio Fernandes',tipo:'6ª Câmara Cível'},
  {nome:'Gab. Desa. Sandra Fonseca',tipo:'6ª Câmara Cível'},
  {nome:'Gab. Desa. Yeda Athias',tipo:'6ª Câmara Cível'},
  {nome:'Gab. Des. Leopoldo Mameluque',tipo:'6ª Câmara Cível'},
  {nome:'Gab. Juiz Renan Chaves Carreira Machado',tipo:'6ª Câmara Cível'},
  {nome:'Gab. Des. Arnaldo Maciel',tipo:'7ª Câmara Cível'},
  {nome:'Gab. Des. Peixoto Henriques',tipo:'7ª Câmara Cível'},
  {nome:'Gab. Des. Oliveira Firmo',tipo:'7ª Câmara Cível'},
  {nome:'Gab. Des. Renato Dresch',tipo:'7ª Câmara Cível'},
  {nome:'Gab. Des. Wilson Benevides',tipo:'7ª Câmara Cível'},
  {nome:'Gab. Des. Teresa Cristina da Cunha Peixoto',tipo:'8ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Alexandre Santiago',tipo:'8ª Câmara Cível Esp.'},
  {nome:'Gab. Desa. Ângela de Lourdes Rodrigues',tipo:'8ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Carlos Roberto de Faria',tipo:'8ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Delvan Barcelos Júnior',tipo:'8ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Pedro Bernardes de Oliveira',tipo:'9ª Câmara Cível'},
  {nome:'Gab. Des. Luiz Artur Hilário',tipo:'9ª Câmara Cível'},
  {nome:'Gab. Des. Amorim Siqueira',tipo:'9ª Câmara Cível'},
  {nome:'Gab. Des. José Arthur Filho',tipo:'9ª Câmara Cível'},
  {nome:'Gab. Des. Leonardo de Faria Beraldo',tipo:'9ª Câmara Cível'},
  {nome:'Gab. Des. Claret de Moraes',tipo:'10ª Câmara Cível'},
  {nome:'Gab. Des. Anacleto Rodrigues',tipo:'10ª Câmara Cível'},
  {nome:'Gab. Des. Octávio de Almeida Neves',tipo:'10ª Câmara Cível'},
  {nome:'Gab. Desa. Jaqueline Calábria Albuquerque',tipo:'10ª Câmara Cível'},
  {nome:'Gab. Des. Cavalcante Motta',tipo:'10ª Câmara Cível'},
  {nome:'Gab. Desa. Mônica Libânio',tipo:'11ª Câmara Cível'},
  {nome:'Gab. Desa. Shirley Fenzi Bertão',tipo:'11ª Câmara Cível'},
  {nome:'Gab. Des. Rui de Almeida Magalhães',tipo:'11ª Câmara Cível'},
  {nome:'Gab. Des. Marcelo Pereira da Silva',tipo:'11ª Câmara Cível'},
  {nome:'Gab. Juiz Adilon Cláver de Resende',tipo:'11ª Câmara Cível'},
  {nome:'Gab. Des. José Américo Martins da Costa',tipo:'12ª Câmara Cível'},
  {nome:'Gab. Des. Joemilson Donizetti Lopes',tipo:'12ª Câmara Cível'},
  {nome:'Gab. Desa. Maria Lúcia Cabral Caruso',tipo:'12ª Câmara Cível'},
  {nome:'Gab. Desa. Régia Ferreira de Lima',tipo:'12ª Câmara Cível'},
  {nome:'Gab. Des. Francisco Costa',tipo:'12ª Câmara Cível'},
  {nome:'Gab. Des. José de Carvalho Barbosa',tipo:'13ª Câmara Cível'},
  {nome:'Gab. Des. Newton Teixeira Carvalho',tipo:'13ª Câmara Cível'},
  {nome:'Gab. Des. Lúcio de Brito',tipo:'13ª Câmara Cível'},
  {nome:'Gab. Desa. Maria Luiza Santana Assunção',tipo:'13ª Câmara Cível'},
  {nome:'Gab. Desa. Maria das Graças Rocha Santos',tipo:'13ª Câmara Cível'},
  {nome:'Gab. Desa. Cláudia Maia',tipo:'14ª Câmara Cível'},
  {nome:'Gab. Des. Luiz Carlos Gomes da Mata',tipo:'14ª Câmara Cível'},
  {nome:'Gab. Des. Marco Aurelio Ferenzini',tipo:'14ª Câmara Cível'},
  {nome:'Gab. Des. Nicolau Lupianhes Neto',tipo:'14ª Câmara Cível'},
  {nome:'Gab. Juiz Clayton Rosa de Resende',tipo:'14ª Câmara Cível'},
  {nome:'Gab. Des. Antônio Bispo',tipo:'15ª Câmara Cível'},
  {nome:'Gab. Desa. Ivone Guilarducci',tipo:'15ª Câmara Cível'},
  {nome:'Gab. Des. Monteiro de Castro',tipo:'15ª Câmara Cível'},
  {nome:'Gab. Des. Roberto Ribeiro de Paiva Júnior',tipo:'15ª Câmara Cível'},
  {nome:'Gab. Des. Paulo Fernando Naves de Resende',tipo:'15ª Câmara Cível'},
  {nome:'Gab. Des. José Marcos Vieira',tipo:'16ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Gilson Soares Leme',tipo:'16ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Ramom Tácio',tipo:'16ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Marcos Henrique Caldeira Brant',tipo:'16ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Tiago Gomes de Carvalho Pinto',tipo:'16ª Câmara Cível Esp.'},
  {nome:'Gab. Des. Evandro Lopes da Costa Teixeira',tipo:'17ª Câmara Cível'},
  {nome:'Gab. Desa. Aparecida Grossi',tipo:'17ª Câmara Cível'},
  {nome:'Gab. Des. Roberto Vasconcellos',tipo:'17ª Câmara Cível'},
  {nome:'Gab. Des. Amauri Pinto Ferreira',tipo:'17ª Câmara Cível'},
  {nome:'Gab. Des. Baeta Neves',tipo:'17ª Câmara Cível'},
  {nome:'Gab. Des. João Cancio',tipo:'18ª Câmara Cível'},
  {nome:'Gab. Des. Sérgio André da Fonseca Xavier',tipo:'18ª Câmara Cível'},
  {nome:'Gab. Des. Habib Felippe Jabour',tipo:'18ª Câmara Cível'},
  {nome:'Gab. Desa. Eveline Félix',tipo:'18ª Câmara Cível'},
  {nome:'Gab. Des. Luís Eduardo Alves Pifano',tipo:'18ª Câmara Cível'},
  {nome:'Gab. Des. Wagner Wilson',tipo:'19ª Câmara Cível'},
  {nome:'Gab. Des. Pedro Bitencourt Marcondes',tipo:'19ª Câmara Cível'},
  {nome:'Gab. Des. Leite Praça',tipo:'19ª Câmara Cível'},
  {nome:'Gab. Des. Carlos Henrique Perpétuo Braga',tipo:'19ª Câmara Cível'},
  {nome:'Gab. Juiz Marcus Vinícius Mendes do Valle',tipo:'19ª Câmara Cível'},
  {nome:'Gab. Des. Fernando Caldeira Brant',tipo:'20ª Câmara Cível'},
  {nome:'Gab. Des. Fernando Lins',tipo:'20ª Câmara Cível'},
  {nome:'Gab. Desa. Lílian Maciel',tipo:'20ª Câmara Cível'},
  {nome:'Gab. Des. Luiz Gonzaga Silveira Soares',tipo:'20ª Câmara Cível'},
  {nome:'Gab. Juiz Christian Gomes de Lima',tipo:'20ª Câmara Cível'},
  {nome:'Gab. Des. Alexandre Victor de Carvalho',tipo:'21ª Câmara Cível'},
  {nome:'Gab. Des. José Eustáquio Lucas Pereira',tipo:'21ª Câmara Cível'},
  {nome:'Gab. Des. Marcelo de Oliveira Milagres',tipo:'21ª Câmara Cível'},
  {nome:'Gab. Desa. Luziene Medeiros Barbosa Lima',tipo:'21ª Câmara Cível'},
  {nome:'Gab. Juiz Sidnei Ponce',tipo:'21ª Câmara Cível'},
  {nome:'Gab. Des. Alberto Deodato Neto',tipo:'1ª Câmara Criminal'},
  {nome:'Gab. Des. Eduardo Machado',tipo:'1ª Câmara Criminal'},
  {nome:'Gab. Des. Wanderley Paiva',tipo:'1ª Câmara Criminal'},
  {nome:'Gab. Des. Edison Feital Leite',tipo:'1ª Câmara Criminal'},
  {nome:'Gab. Des. José Luiz de Moura Faleiros',tipo:'1ª Câmara Criminal'},
  {nome:'Gab. Desa. Beatriz Pinheiro Caires',tipo:'2ª Câmara Criminal'},
  {nome:'Gab. Des. Nelson Missias de Morais',tipo:'2ª Câmara Criminal'},
  {nome:'Gab. Des. Matheus Chaves Jardim',tipo:'2ª Câmara Criminal'},
  {nome:'Gab. Des. Glauco Fernandes',tipo:'2ª Câmara Criminal'},
  {nome:'Gab. Desa. Daniela Villani Bonaccorsi',tipo:'2ª Câmara Criminal'},
  {nome:'Gab. Des. Fortuna Grion',tipo:'3ª Câmara Criminal'},
  {nome:'Gab. Des. Octavio Augusto De Nigris Boccalini',tipo:'3ª Câmara Criminal'},
  {nome:'Gab. Desa. Paula Cunha e Silva',tipo:'3ª Câmara Criminal'},
  {nome:'Gab. Des. Franklin Higino Caldeira Filho',tipo:'3ª Câmara Criminal'},
  {nome:'Gab. Des. Paulo de Tarso Tamburini Souza',tipo:'3ª Câmara Criminal'},
  {nome:'Gab. Des. Eduardo Brum',tipo:'4ª Câmara Criminal'},
  {nome:'Gab. Des. Doorgal Borges de Andrada',tipo:'4ª Câmara Criminal'},
  {nome:'Gab. Des. Corrêa Camargo',tipo:'4ª Câmara Criminal'},
  {nome:'Gab. Des. Guilherme de Azeredo Passos',tipo:'4ª Câmara Criminal'},
  {nome:'Gab. Juíza Maria Isabel Fleck',tipo:'4ª Câmara Criminal'},
  {nome:'Gab. Des. Júlio César Lorens',tipo:'5ª Câmara Criminal'},
  {nome:'Gab. Des. Marcos Flávio Lucas Padula',tipo:'5ª Câmara Criminal'},
  {nome:'Gab. Des. Rinaldo Kennedy Silva',tipo:'5ª Câmara Criminal'},
  {nome:'Gab. Des. Danton Soares Martins',tipo:'5ª Câmara Criminal'},
  {nome:'Gab. Des. Enéias Xavier Gomes',tipo:'5ª Câmara Criminal'},
  {nome:'Gab. Des. Jaubert Carneiro Jaques',tipo:'6ª Câmara Criminal'},
  {nome:'Gab. Desa. Valeria Rodrigues',tipo:'6ª Câmara Criminal'},
  {nome:'Gab. Des. Bruno Terra Dias',tipo:'6ª Câmara Criminal'},
  {nome:'Gab. Des. Marco Antônio de Melo',tipo:'6ª Câmara Criminal'},
  {nome:'Gab. Des. Alexandre Magno Mendes do Valle',tipo:'6ª Câmara Criminal'},
  {nome:'Gab. Des. Marcílio Eustáquio Santos',tipo:'7ª Câmara Criminal'},
  {nome:'Gab. Des. Cássio Salomé',tipo:'7ª Câmara Criminal'},
  {nome:'Gab. Des. Agostinho Gomes de Azevedo',tipo:'7ª Câmara Criminal'},
  {nome:'Gab. Des. Sálvio Chaves',tipo:'7ª Câmara Criminal'},
  {nome:'Gab. Des. Paulo Calmon Nogueira da Gama',tipo:'7ª Câmara Criminal'},
  {nome:'Gab. Des. Dirceu Walace Baroni',tipo:'8ª Câmara Criminal'},
  {nome:'Gab. Des. Maurício Pinto Ferreira',tipo:'8ª Câmara Criminal'},
  {nome:'Gab. Des. Henrique Abi-Ackel Torres',tipo:'8ª Câmara Criminal'},
  {nome:'Gab. Desa. Âmalin Aziz Sant\'Ana',tipo:'8ª Câmara Criminal'},
  {nome:'Gab. Desa. Kárin Emmerich',tipo:'9ª Câmara Criminal'},
  {nome:'Gab. Des. Walner Barbosa Milward de Azevedo',tipo:'9ª Câmara Criminal'},
  {nome:'Gab. Des. Edir Guerson de Medeiros',tipo:'9ª Câmara Criminal'},
  {nome:'Gab. Des. Magid Nauef Láuar',tipo:'9ª Câmara Criminal'},
  {nome:'Gab. Des. Élito Almeida',tipo:'9ª Câmara Criminal'},
  {nome:'Outros',tipo:'Outros'},
].sort((a,b)=>a.nome.localeCompare(b.nome))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMonday(d:Date){const dt=new Date(d);const day=dt.getDay();dt.setDate(dt.getDate()-(day===0?6:day-1));dt.setHours(0,0,0,0);return dt}
function getWeekDays(m:Date){return Array.from({length:5},(_,i)=>{const d=new Date(m);d.setDate(m.getDate()+i);return d})}
function fmtLocal(d:Date){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function nomeExib(nome:string){const p=nome.trim().split(' ').filter(Boolean);return p.length<=1?nome:`${p[0]} ${p[p.length-1]}`}
const MESES_PT=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA=['','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira']
const DIAS_CURTOS:Record<number,string>={1:'Seg',2:'Ter',3:'Qua',4:'Qui',5:'Sex'}

// ─── Cor por equipe (com híbrido split) ───────────────────────────────────────
function ChipConsultor({nome}:{nome:string}){
  const isE=EQUIPE_EPROC.includes(nome); const isJ=EQUIPE_JPE.includes(nome)
  const both=isE&&isJ
  if(both) return(
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex overflow-hidden border border-gray-300">
      <span className="bg-green-200 text-green-900 pr-0.5 pl-1">{nomeExib(nome).split(' ')[0]}</span>
      <span className="bg-red-200 text-red-900 pl-0.5 pr-1">{nomeExib(nome).split(' ')[1]||''}</span>
    </span>
  )
  if(isE) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-200 text-green-900">{nomeExib(nome)}</span>
  if(isJ) return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-200 text-red-900">{nomeExib(nome)}</span>
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700">{nomeExib(nome)}</span>
}

function cardBorder(consultores:string[]){
  const e=consultores.some(c=>EQUIPE_EPROC.includes(c))
  const j=consultores.some(c=>EQUIPE_JPE.includes(c))
  if(e&&j) return 'border-l-4 border-l-green-400 border-r-4 border-r-red-400 border-t border-b border-gray-200'
  if(e)    return 'border-2 border-green-300'
  if(j)    return 'border-2 border-red-300'
  return 'border-2 border-gray-200'
}
function cardBg(consultores:string[]){
  const e=consultores.some(c=>EQUIPE_EPROC.includes(c))
  const j=consultores.some(c=>EQUIPE_JPE.includes(c))
  if(e&&j) return 'bg-gradient-to-r from-green-50 to-red-50'
  if(e)    return 'bg-green-50'
  if(j)    return 'bg-red-50'
  return 'bg-gray-50'
}

// Emoji e label por modalidade
const MODAL_INFO:Record<string,{emoji:string;label:string;badge:string}>={
  'PRESENCIAL':       {emoji:'🏛️',label:'Presencial',    badge:'bg-violet-100 text-violet-700'},
  'VIRTUAL':          {emoji:'🖥️',label:'Virtual',       badge:'bg-cyan-100 text-cyan-700'},
  'HÍBRIDA':          {emoji:'🔀',label:'Híbrida',        badge:'bg-indigo-100 text-indigo-700'},
  'VIDEOCONFERÊNCIA': {emoji:'📹',label:'Videoconf.',     badge:'bg-sky-100 text-sky-700'},
}
function getModalInfo(m?:string,nome?:string){
  if(m&&MODAL_INFO[m])return MODAL_INFO[m]
  if(nome?.toUpperCase().startsWith('VIRTUAL'))return MODAL_INFO['VIRTUAL']
  return {emoji:'🏛️',label:'Sessão',badge:'bg-gray-100 text-gray-600'}
}

// Tipos de atividade
const TIPOS_ATIVIDADE_PADRAO=['Atendimento pres.','BNMP','Compensação','DJEN/TH','DJEN/TH/BNMP','Férias','HP','Plantão','Projeto Boas Práticas','Reunião','Reunião ASCOM','TRE','TRE PLANTÃO','Treinamento','Treinamento Boas Práticas','WhatsApp eproc/HP','Atestado','Acompanhar visita no gabinete']
const TIPO_ATIV_CFG:Record<string,{icon:string;badge:string}>={
  'Compensação':{icon:'🌴',badge:'bg-emerald-100 text-emerald-700'},
  'Férias':{icon:'✈️',badge:'bg-sky-100 text-sky-700'},
  'Treinamento':{icon:'🎓',badge:'bg-amber-100 text-amber-700'},
  'Treinamento Boas Práticas':{icon:'🎓',badge:'bg-amber-100 text-amber-700'},
  'Reunião':{icon:'📅',badge:'bg-teal-100 text-teal-700'},
  'HP':{icon:'🎯',badge:'bg-indigo-100 text-indigo-700'},
  'DJEN/TH':{icon:'📋',badge:'bg-blue-100 text-blue-700'},
  'BNMP':{icon:'⚖️',badge:'bg-purple-100 text-purple-700'},
  'TRE':{icon:'🏋️',badge:'bg-orange-100 text-orange-700'},
  'Plantão':{icon:'🔴',badge:'bg-red-100 text-red-700'},
  'WhatsApp eproc/HP':{icon:'💬',badge:'bg-green-100 text-green-700'},
  'Atestado':{icon:'🏥',badge:'bg-rose-100 text-rose-700'},
}
const getCfgAtv=(t:string)=>TIPO_ATIV_CFG[t]??{icon:'📌',badge:'bg-gray-100 text-gray-600'}

// ─── Hook: verifica férias de um consultor em uma data ────────────────────────
function useConsultoresDisponiveis(data:string,ferias:Ferias[]):Set<string>{
  return useMemo(()=>{
    const bloqueados=new Set<string>()
    if(!data)return bloqueados
    const dt=new Date(data+'T12:00:00')
    for(const f of ferias){
      const ini=new Date(f.inicio+'T12:00:00')
      const fim=new Date(f.fim+'T12:00:00')
      if(dt>=ini&&dt<=fim)bloqueados.add(f.consultor)
    }
    return bloqueados
  },[data,ferias])
}

// ─── Seletor de consultores com bloqueio de férias ────────────────────────────
function SeletorConsultores({selecionados,onChange,bloqueados,label='Consultores'}:{
  selecionados:string[];onChange:(v:string[])=>void;bloqueados:Set<string>;label?:string
}){
  return(
    <div>
      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wide mb-1 mt-3">{label} ({selecionados.length})</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50">
        {TODOS_CONSULTORES.map(c=>{
          const sel=selecionados.includes(c)
          const bloq=bloqueados.has(c)
          return(
            <button key={c} disabled={bloq&&!sel}
              onClick={()=>!bloq&&onChange(sel?selecionados.filter(x=>x!==c):[...selecionados,c])}
              className={`text-left text-xs px-2 py-1.5 rounded-lg font-bold border transition-all flex items-center gap-1 ${
                bloq?'border-red-200 bg-red-50 text-red-400 cursor-not-allowed opacity-60':
                sel?'border-violet-500 bg-violet-100 text-violet-700':
                'border-gray-200 bg-white text-gray-600 hover:border-violet-300'
              }`}>
              {bloq&&<span title="Em férias">✈️</span>}
              {sel&&!bloq&&'✓ '}
              {nomeExib(c)}
              {bloq&&<span className="text-[9px] text-red-400 ml-auto">férias</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA SESSÕES (com edição completa)
// ═══════════════════════════════════════════════════════════════════════════════
function AbaSessoes({canEdit,ferias}:{canEdit:boolean;ferias:Ferias[]}){
  const {meuLogin}=useBastaoStore()
  const[offset,setOffset]=useState(0)
  const[sessoes,setSessoes]=useState<AgendaDetalhe[]>([])
  const[loading,setLoading]=useState(false)
  const[copiando,setCopiando]=useState(false)
  const[filtro,setFiltro]=useState('Todos')
  const[modal,setModal]=useState<{data:string;item?:AgendaDetalhe}|null>(null)
  const[popover,setPopover]=useState<AgendaDetalhe|null>(null)
  // form
  const[nomeFiltro,setNomeFiltro]=useState('')
  const[nomeSessao,setNomeSessao]=useState('')
  const[modalidade,setModalidade]=useState('PRESENCIAL')
  const[horario,setHorario]=useState('')
  const[plenario,setPlenario]=useState('')
  const[descricao,setDescricao]=useState('')
  const[pauta,setPauta]=useState('')
  const[mesa,setMesa]=useState('')
  const[consultores,setConsultores]=useState<string[]>([])
  const[dataForm,setDataForm]=useState('')
  const[salvando,setSalvando]=useState(false)

  const monday=useMemo(()=>{const m=getMonday(new Date());m.setDate(m.getDate()+offset*7);return m},[offset])
  const weekDays=useMemo(()=>getWeekDays(monday),[monday])
  const start=fmtLocal(weekDays[0])
  const endSun=useMemo(()=>{const s=new Date(monday);s.setDate(monday.getDate()+6);return fmtLocal(s)},[monday])
  const bloqueados=useConsultoresDisponiveis(dataForm,ferias)

  useEffect(()=>{
    setLoading(true)
    supabase.from('agenda_detalhes').select('*').gte('data',start).lte('data',endSun).order('data').order('horario',{nullsFirst:false})
      .then(({data})=>{setSessoes(data||[]);setLoading(false)})
  },[start,endSun])

  function abrirModal(data:string,item?:AgendaDetalhe){
    setDataForm(item?.data??data); setNomeSessao(item?.nome_sessao??''); setNomeFiltro('')
    setModalidade(item?.modalidade??'PRESENCIAL'); setHorario(item?.horario??'')
    setPlenario(item?.plenario??''); setDescricao(item?.descricao??'')
    setPauta(String(item?.pauta??'')); setMesa(String(item?.mesa??''))
    setConsultores(item?.consultores??[]); setModal({data,item})
  }

  const catFiltrado=useMemo(()=>SESSOES_CATALOGO.filter(s=>s.toLowerCase().includes(nomeFiltro.toLowerCase())),[nomeFiltro])

  function selecionarCat(nome:string){
    setNomeSessao(nome); setNomeFiltro('')
    setModalidade(nome.startsWith('VIRTUAL')?'VIRTUAL':'PRESENCIAL')
    if(!horario)setHorario(HORARIOS_PADRAO[nome]??HORARIOS_PADRAO[nome.replace('VIRTUAL ','')]??'09:00')
    if(!plenario)setPlenario(PLENARIOS_PADRAO[nome]??PLENARIOS_PADRAO[nome.replace('VIRTUAL ','')]??'')
  }

  async function handleSalvar(){
    if(!nomeSessao.trim())return alert('Informe o nome da sessão!')
    setSalvando(true)
    const existe=sessoes.find(i=>i.data===dataForm&&i.nome_sessao===nomeSessao.toUpperCase().trim())
    const payload={data:dataForm,nome_sessao:nomeSessao.toUpperCase().trim(),modalidade,
      horario:horario||undefined,plenario:plenario||undefined,descricao:descricao.trim()||undefined,
      pauta:pauta?Number(pauta):undefined,mesa:mesa?Number(mesa):undefined,
      consultores,criado_por:meuLogin||'',criado_em:new Date().toISOString()}
    if(modal?.item){await supabase.from('agenda_detalhes').update(payload).eq('id',modal.item.id)}
    else if(existe){await supabase.from('agenda_detalhes').update(payload).eq('id',existe.id)}
    else{await supabase.from('agenda_detalhes').insert(payload)}
    setSalvando(false); setModal(null)
    const{data}=await supabase.from('agenda_detalhes').select('*').gte('data',start).lte('data',endSun).order('data').order('horario',{nullsFirst:false})
    setSessoes(data||[])
  }

  async function handleDeletar(id:string){
    if(!confirm('Remover sessão?'))return
    await supabase.from('agenda_detalhes').delete().eq('id',id)
    setSessoes(s=>s.filter(x=>x.id!==id))
  }

  async function copiarSemana(){
    setCopiando(true)
    const antStart=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-7)))
    const antEnd=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-1)))
    const{data:ant}=await supabase.from('agenda_detalhes').select('*').gte('data',antStart).lte('data',antEnd)
    if(!ant?.length){alert('Nenhuma sessão na semana anterior.');setCopiando(false);return}
    const novos:any[]=[]
    for(const old of ant){
      const dw=new Date(old.data+'T12:00:00').getDay()
      if(dw<1||dw>5)continue
      const novaData=fmtLocal(weekDays[dw-1])
      if(!sessoes.some(i=>i.data===novaData&&i.nome_sessao===old.nome_sessao))
        novos.push({...old,id:undefined,data:novaData,criado_em:new Date().toISOString()})
    }
    if(novos.length>0){await supabase.from('agenda_detalhes').insert(novos)}
    else alert('Todas as sessões já existem.')
    const{data}=await supabase.from('agenda_detalhes').select('*').gte('data',start).lte('data',endSun).order('data').order('horario',{nullsFirst:false})
    setSessoes(data||[]); setCopiando(false)
  }

  const sessoesPorDia=useMemo(()=>{
    const map:Record<string,AgendaDetalhe[]>={}
    for(const d of weekDays)map[fmtLocal(d)]=[]
    for(const s of sessoes){
      if(!map[s.data])continue
      if(filtro!=='Todos'&&!s.consultores.includes(filtro))continue
      map[s.data].push(s)
    }
    return map
  },[sessoes,weekDays,filtro])

  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white"

  return(
    <div>
      {/* Nav + legenda */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <button onClick={()=>setOffset(v=>v-1)} className="w-8 h-8 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center font-bold">←</button>
          <span className="text-sm font-black text-gray-700">{weekDays[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – {weekDays[4].toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span>
          <button onClick={()=>setOffset(v=>v+1)} className="w-8 h-8 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center font-bold">→</button>
          {offset!==0&&<button onClick={()=>setOffset(0)} className="text-xs text-violet-600 bg-violet-50 px-2 py-1 rounded-lg font-bold">Hoje</button>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit&&<>
            <button onClick={copiarSemana} disabled={copiando} className="text-xs bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold px-3 py-1.5 rounded-xl border border-violet-200 disabled:opacity-50">
              {copiando?'⏳':'📋'} Copiar sem. ant.
            </button>
            <button onClick={()=>abrirModal(fmtLocal(new Date()))} className="text-xs bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-1.5 rounded-xl">+ Sessão</button>
          </>}
          <select value={filtro} onChange={e=>setFiltro(e.target.value)} className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold bg-white outline-none">
            <option value="Todos">Todos</option>
            {TODOS_CONSULTORES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-3 flex-wrap mb-3">
        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full border border-green-200">🟢 EPROC</span>
        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200">🔴 Themis/JPE</span>
        <div className="text-[10px] font-bold flex items-center overflow-hidden rounded-full border border-gray-300">
          <span className="bg-green-200 text-green-900 px-2 py-1">⚪ Híbrido</span>
          <span className="bg-red-200 text-red-900 px-2 py-1">EPROC+JPE</span>
        </div>
        {Object.entries(MODAL_INFO).map(([k,v])=>(
          <span key={k} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${v.badge}`}>{v.emoji} {v.label}</span>
        ))}
      </div>

      {loading?<div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"/></div>
      :<div className="space-y-3">
        {weekDays.map(d=>{
          const ds=fmtLocal(d); const isToday=ds===fmtLocal(new Date()); const dias=sessoesPorDia[ds]||[]
          return(
            <div key={ds} className={`rounded-2xl border-2 overflow-hidden ${isToday?'border-violet-400 shadow-md':'border-gray-200'}`}>
              <div className={`px-4 py-2.5 flex items-center justify-between ${isToday?'bg-violet-600 text-white':'bg-gray-50 text-gray-700'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm">{DIAS_SEMANA[d.getDay()]}</span>
                  <span className={`text-xs ${isToday?'text-violet-200':'text-gray-400'}`}>{d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</span>
                  {isToday&&<span className="text-[10px] font-black bg-white text-violet-700 px-2 py-0.5 rounded-full">HOJE</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isToday?'bg-white/20 text-white':'bg-violet-100 text-violet-700'}`}>{dias.length} sessão(ões)</span>
                  {canEdit&&<button onClick={()=>abrirModal(ds)} className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${isToday?'bg-white/20 hover:bg-white/30 text-white':'bg-violet-50 hover:bg-violet-100 text-violet-600 border border-violet-100'}`}>+ Sessão</button>}
                </div>
              </div>
              <div className="p-4">
                {dias.length===0?<p className="text-xs text-gray-300 italic">Nenhuma sessão{canEdit?' — clique em + para adicionar':''}</p>
                :<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {dias.map(s=>{
                    const mi=getModalInfo(s.modalidade,s.nome_sessao)
                    return(
                      <div key={s.id} className={`rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-md border border-gray-200 bg-white`}
                        onClick={()=>canEdit?abrirModal(s.data,s):setPopover(s)}>
                        {/* Barra de cor no topo */}
                        {(()=>{
                          const e=s.consultores.some(c=>EQUIPE_EPROC.includes(c))
                          const j=s.consultores.some(c=>EQUIPE_JPE.includes(c))
                          if(e&&j) return <div className="h-1.5 flex"><div className="flex-1 bg-green-400"/><div className="flex-1 bg-red-400"/></div>
                          if(e)    return <div className="h-1.5 bg-green-400"/>
                          if(j)    return <div className="h-1.5 bg-red-400"/>
                          return   <div className="h-1.5 bg-gray-300"/>
                        })()}
                        <div className="p-2.5">
                        <div className="flex items-start justify-between mb-1.5">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${mi.badge}`}>{mi.emoji} {mi.label}</span>
                          {canEdit&&<button onClick={e=>{e.stopPropagation();handleDeletar(s.id)}} className="w-5 h-5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center text-[10px] text-red-400 flex-shrink-0">✕</button>}
                        </div>
                        <p className="text-xs font-black leading-snug mb-1.5 text-gray-800">{s.nome_sessao}</p>
                        {s.horario&&<p className="text-[10px] text-gray-500 mb-1.5">🕐 {s.horario}{s.plenario?` · Pl.${s.plenario}`:''}</p>}
                        <div className="flex flex-wrap gap-0.5">
                          {s.consultores.map(c=><ChipConsultor key={c} nome={c}/>)}
                        </div>
                        </div>
                      </div>
                    )
                  })}
                </div>}
              </div>
            </div>
          )
        })}
      </div>}

      {/* Modal edição */}
      {modal&&(
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-white flex justify-between items-start flex-shrink-0">
              <div>
                <h3 className="text-base font-black">{modal.item?'✏️ Editar sessão':'➕ Nova sessão'}</h3>
                <p className="text-xs text-white/60">{new Date((dataForm||modal.data)+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p>
              </div>
              <button onClick={()=>setModal(null)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Data</label>
              <input type="date" value={dataForm} onChange={e=>setDataForm(e.target.value)} className={inp}/>

              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Sessão</label>
              <input type="text" value={nomeFiltro||nomeSessao} onChange={e=>{setNomeFiltro(e.target.value);setNomeSessao(e.target.value)}} placeholder="Buscar ou digitar..." className={inp} autoFocus/>
              {nomeFiltro&&catFiltrado.length>0&&(
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto shadow-md mt-1">
                  {catFiltrado.map(s=>(
                    <button key={s} onClick={()=>selecionarCat(s)} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-violet-50 hover:text-violet-700 border-b border-gray-50 last:border-0">
                      {s.startsWith('VIRTUAL')?'🖥️ ':'🏛️ '}{s}
                    </button>
                  ))}
                </div>
              )}

              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Modalidade</label>
              <div className="flex gap-2">
                {['PRESENCIAL','VIRTUAL','HÍBRIDA','VIDEOCONFERÊNCIA'].map(m=>(
                  <button key={m} onClick={()=>setModalidade(m)} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border-2 transition-all ${modalidade===m?'border-violet-500 bg-violet-50 text-violet-700':'border-gray-200 text-gray-400'}`}>
                    {MODAL_INFO[m]?.emoji||'🏛️'} {m==='VIDEOCONFERÊNCIA'?'VIDEO':m}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Horário</label><input type="time" value={horario} onChange={e=>setHorario(e.target.value)} className={inp}/></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Plenário</label><input type="text" value={plenario} onChange={e=>setPlenario(e.target.value)} className={inp} placeholder="Ex: 05"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Pauta</label><input type="number" value={pauta} onChange={e=>setPauta(e.target.value)} className={inp} min="0"/></div>
                <div><label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Mesa</label><input type="number" value={mesa} onChange={e=>setMesa(e.target.value)} className={inp} min="0"/></div>
              </div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Observações</label>
              <textarea value={descricao} onChange={e=>setDescricao(e.target.value)} rows={2} className={`${inp} resize-none`} placeholder="Detalhes, link, local..."/>

              <SeletorConsultores selecionados={consultores} onChange={setConsultores} bloqueados={bloqueados}/>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-violet-600 hover:bg-violet-700 text-white font-black py-3 rounded-xl disabled:opacity-50">
                {salvando?'Salvando...':'💾 Salvar'}
              </button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Popover read-only */}
      {popover&&(
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4" onClick={()=>setPopover(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className={`p-4 ${cardBg(popover.consultores)} border-b`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${getModalInfo(popover.modalidade,popover.nome_sessao).badge}`}>{getModalInfo(popover.modalidade,popover.nome_sessao).emoji} {getModalInfo(popover.modalidade,popover.nome_sessao).label}</span>
                  <h3 className="text-sm font-black text-gray-800 mt-1">{popover.nome_sessao}</h3>
                  <div className="flex gap-3 text-xs text-gray-500 mt-1">{popover.horario&&<span>🕐 {popover.horario}</span>}{popover.plenario&&<span>🏛️ Pl. {popover.plenario}</span>}</div>
                </div>
                <button onClick={()=>setPopover(null)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {(popover.pauta||popover.mesa)&&<div className="flex gap-2">{popover.pauta?<span className="text-xs bg-violet-50 text-violet-700 font-bold px-2 py-1 rounded-lg">📋 Pauta: {popover.pauta}</span>:null}{popover.mesa?<span className="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-lg">🪑 Mesa: {popover.mesa}</span>:null}</div>}
              {popover.descricao&&<p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-xl p-2">{popover.descricao}</p>}
              <div className="flex flex-wrap gap-1">{popover.consultores.map(c=><ChipConsultor key={c} nome={c}/>)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA ATIVIDADES (com edição completa)
// ═══════════════════════════════════════════════════════════════════════════════
function AbaAtividades({canEdit,ferias}:{canEdit:boolean;ferias:Ferias[]}){
  const{meuLogin}=useBastaoStore()
  const[offset,setOffset]=useState(0)
  const[itens,setItens]=useState<AgendaAtividade[]>([])
  const[loading,setLoading]=useState(false)
  const[copiando,setCopiando]=useState(false)
  const[filtro,setFiltro]=useState('Todos')
  const[modal,setModal]=useState<{data:string;item?:AgendaAtividade}|null>(null)
  const[tipoFiltro,setTipoFiltro]=useState('')
  const[tipoSel,setTipoSel]=useState('')
  const[tipoCustom,setTipoCustom]=useState('')
  const[observacao,setObservacao]=useState('')
  const[horarioAtv,setHorarioAtv]=useState('')
  const[consultores,setConsultores]=useState<string[]>([])
  const[dataForm,setDataForm]=useState('')
  const[salvando,setSalvando]=useState(false)

  const monday=useMemo(()=>{const m=getMonday(new Date());m.setDate(m.getDate()+offset*7);return m},[offset])
  const weekDays=useMemo(()=>getWeekDays(monday),[monday])
  const start=fmtLocal(weekDays[0])
  const endSun=useMemo(()=>{const s=new Date(monday);s.setDate(monday.getDate()+6);return fmtLocal(s)},[monday])
  const bloqueados=useConsultoresDisponiveis(dataForm,ferias)

  useEffect(()=>{
    setLoading(true)
    supabase.from('agenda_atividades').select('*').gte('data',start).lte('data',endSun).order('data').order('tipo')
      .then(({data})=>{setItens(data||[]);setLoading(false)})
  },[start,endSun])

  function abrirModal(data:string,item?:AgendaAtividade){
    setDataForm(item?.data??data); setTipoSel(item?.tipo??''); setTipoFiltro('')
    setTipoCustom(''); setObservacao(item?.observacao??'')
    setHorarioAtv((item as any)?.horario??'')
    setConsultores(item?.consultores??[]); setModal({data,item})
  }

  const tipoFinal=tipoCustom.trim()||tipoSel

  async function handleSalvar(){
    if(!tipoFinal)return alert('Informe o tipo de atividade!')
    setSalvando(true)
    const existe=itens.find(i=>i.data===dataForm&&i.tipo===tipoFinal)
    const payload={data:dataForm,tipo:tipoFinal,observacao:observacao.trim()||undefined,horario:horarioAtv||undefined,consultores,criado_por:meuLogin||'',criado_em:new Date().toISOString()}
    if(modal?.item){await supabase.from('agenda_atividades').update(payload).eq('id',modal.item.id)}
    else if(existe){await supabase.from('agenda_atividades').update(payload).eq('id',existe.id)}
    else{await supabase.from('agenda_atividades').insert(payload)}
    setSalvando(false); setModal(null)
    const{data}=await supabase.from('agenda_atividades').select('*').gte('data',start).lte('data',endSun).order('data').order('tipo')
    setItens(data||[])
  }

  async function handleDeletar(id:string){
    if(!confirm('Remover?'))return
    await supabase.from('agenda_atividades').delete().eq('id',id)
    setItens(i=>i.filter(x=>x.id!==id))
  }

  async function copiarSemana(){
    setCopiando(true)
    const antStart=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-7)))
    const antEnd=fmtLocal(new Date(new Date(monday).setDate(monday.getDate()-1)))
    const{data:ant}=await supabase.from('agenda_atividades').select('*').gte('data',antStart).lte('data',antEnd)
    if(!ant?.length){alert('Nenhuma atividade na semana anterior.');setCopiando(false);return}
    const novos:any[]=[]
    for(const old of ant){
      const dw=new Date(old.data+'T12:00:00').getDay()
      if(dw<1||dw>5)continue
      const novaData=fmtLocal(weekDays[dw-1])
      if(!itens.some(i=>i.data===novaData&&i.tipo===old.tipo))
        novos.push({...old,id:undefined,data:novaData,criado_em:new Date().toISOString()})
    }
    if(novos.length>0)await supabase.from('agenda_atividades').insert(novos)
    else alert('Todas já existem.')
    const{data}=await supabase.from('agenda_atividades').select('*').gte('data',start).lte('data',endSun).order('data').order('tipo')
    setItens(data||[]); setCopiando(false)
  }

  const itensPorDia=useMemo(()=>{
    const map:Record<string,AgendaAtividade[]>={}
    for(const d of weekDays)map[fmtLocal(d)]=[]
    for(const it of itens){
      if(!map[it.data])continue
      if(filtro!=='Todos'&&!it.consultores.includes(filtro))continue
      map[it.data].push(it)
    }
    return map
  },[itens,weekDays,filtro])

  const tiposFiltrados=TIPOS_ATIVIDADE_PADRAO.filter(t=>t.toLowerCase().includes(tipoFiltro.toLowerCase()))
  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 bg-white"

  return(
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={()=>setOffset(v=>v-1)} className="w-8 h-8 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center font-bold">←</button>
          <span className="text-sm font-black text-gray-700">{weekDays[0].toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} – {weekDays[4].toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span>
          <button onClick={()=>setOffset(v=>v+1)} className="w-8 h-8 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center font-bold">→</button>
          {offset!==0&&<button onClick={()=>setOffset(0)} className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-bold">Hoje</button>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit&&<>
            <button onClick={copiarSemana} disabled={copiando} className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-xl border border-blue-200 disabled:opacity-50">
              {copiando?'⏳':'📋'} Copiar sem. ant.
            </button>
            <button onClick={()=>abrirModal(fmtLocal(new Date()))} className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl">+ Atividade</button>
          </>}
          <select value={filtro} onChange={e=>setFiltro(e.target.value)} className="border border-gray-200 rounded-xl px-2.5 py-1 text-xs font-bold bg-white outline-none">
            <option value="Todos">Todos</option>
            {TODOS_CONSULTORES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading?<div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/></div>
      :<div className="space-y-3">
        {weekDays.map(d=>{
          const ds=fmtLocal(d); const isToday=ds===fmtLocal(new Date()); const atvs=itensPorDia[ds]||[]
          return(
            <div key={ds} className={`rounded-2xl border-2 overflow-hidden ${isToday?'border-blue-400':'border-gray-200'}`}>
              <div className={`px-4 py-2.5 flex items-center justify-between ${isToday?'bg-blue-600 text-white':'bg-gray-50 text-gray-700'}`}>
                <span className="font-black text-sm">{DIAS_SEMANA[d.getDay()]} <span className={`font-normal text-xs ${isToday?'text-blue-200':'text-gray-400'}`}>{d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'})}</span></span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${isToday?'bg-white/20 text-white':'bg-blue-100 text-blue-700'}`}>{atvs.length}</span>
                  {canEdit&&<button onClick={()=>abrirModal(ds)} className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isToday?'bg-white/20 hover:bg-white/30 text-white':'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100'}`}>+ Ativ.</button>}
                </div>
              </div>
              <div className="p-4">
                {atvs.length===0?<p className="text-xs text-gray-300 italic">Nenhuma atividade</p>
                :<div className="flex flex-wrap gap-2">
                  {atvs.map(a=>{
                    const cfg=getCfgAtv(a.tipo)
                    return(
                      <div key={a.id} className={`bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm ${canEdit?'cursor-pointer hover:border-blue-300':''}`}
                        onClick={()=>canEdit&&abrirModal(a.data,a)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.icon} {a.tipo}</span>
                          {(a as any).horario&&<span className="text-[10px] font-bold bg-white border border-gray-200 px-1.5 py-0.5 rounded-full text-gray-600">🕐 {(a as any).horario}</span>}
                        </div>
                          {canEdit&&<button onClick={e=>{e.stopPropagation();handleDeletar(a.id)}} className="w-4 h-4 rounded text-[9px] text-red-400 hover:text-red-600 flex items-center justify-center">✕</button>}
                        </div>
                        {a.observacao&&<p className="text-[10px] text-gray-500 mt-1 italic">{a.observacao}</p>}
                        <div className="flex flex-wrap gap-0.5 mt-1">{a.consultores.map(c=><ChipConsultor key={c} nome={c}/>)}</div>
                      </div>
                    )
                  })}
                </div>}
              </div>
            </div>
          )
        })}
      </div>}

      {modal&&(
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex justify-between items-start flex-shrink-0">
              <h3 className="text-base font-black">{modal.item?'✏️ Editar':'➕ Nova'} atividade</h3>
              <button onClick={()=>setModal(null)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Data</label>
              <input type="date" value={dataForm} onChange={e=>setDataForm(e.target.value)} className={inp}/>

              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Tipo de atividade</label>
              <input type="text" value={tipoFiltro||tipoSel} onChange={e=>{setTipoFiltro(e.target.value);setTipoSel(e.target.value);setTipoCustom('')}}
                placeholder="Buscar ou digitar..." className={inp} autoFocus/>
              {tipoFiltro&&tiposFiltrados.length>0&&(
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto shadow-md mt-1">
                  {tiposFiltrados.map(t=>{
                    const cfg=getCfgAtv(t)
                    return <button key={t} onClick={()=>{setTipoSel(t);setTipoFiltro('');setTipoCustom('')}}
                      className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0 flex items-center gap-2">
                      {cfg.icon} {t}
                    </button>
                  })}
                </div>
              )}
              {/* Tipo personalizado */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold">Ou tipo personalizado:</span>
                <input type="text" value={tipoCustom} onChange={e=>setTipoCustom(e.target.value)}
                  className="flex-1 border border-dashed border-blue-300 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Ex: Mutirão, Projeto X..."/>
              </div>
              {tipoFinal&&<div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 ${getCfgAtv(tipoFinal).badge}`}>
                {getCfgAtv(tipoFinal).icon} {tipoFinal}
              </div>}

              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Horário (opcional)</label>
              <input type="time" value={horarioAtv} onChange={e=>setHorarioAtv(e.target.value)} className={inp}/>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1 mt-3">Observação</label>
              <textarea value={observacao} onChange={e=>setObservacao(e.target.value)} rows={2}
                className={`${inp} resize-none`} placeholder="Detalhes..."/>

              <SeletorConsultores selecionados={consultores} onChange={setConsultores} bloqueados={bloqueados}/>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl disabled:opacity-50">
                {salvando?'Salvando...':'💾 Salvar'}
              </button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA PLANTÕES
// ═══════════════════════════════════════════════════════════════════════════════
function AbaPlantoes({canEdit,meuLogin}:{canEdit:boolean;meuLogin:string}){
  const[plantoes,setPlantoes]=useState<Plantao[]>([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState<Plantao|null>(null)
  const[form,setForm]=useState({tipo_dia:'',date:'',plantonistas:''})
  const[salvando,setSalvando]=useState(false)

  useEffect(()=>{load()},[])
  async function load(){
    setLoading(true)
    const hoje=new Date().toISOString().split('T')[0]
    const{data}=await supabase.from('plantonistas_fds').select('*').gte('date',hoje).order('date').limit(30)
    setPlantoes(data||[]); setLoading(false)
  }
  async function handleSalvar(){
    if(!form.tipo_dia||!form.date||!form.plantonistas)return alert('Preencha todos os campos!')
    setSalvando(true)
    if(modal?.id){await supabase.from('plantonistas_fds').update({...form}).eq('id',modal.id)}
    else{await supabase.from('plantonistas_fds').insert({...form})}
    setSalvando(false); setModal(null); await load()
  }
  async function handleDeletar(id:string){
    if(!confirm('Remover?'))return
    await supabase.from('plantonistas_fds').delete().eq('id',id); await load()
  }
  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-3 outline-none"
  return(
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-black text-gray-700">🚨 Próximos Plantões e Feriados</h3>
        {canEdit&&<button onClick={()=>{setModal({id:'',tipo_dia:'',date:'',plantonistas:''});setForm({tipo_dia:'',date:'',plantonistas:''})}}
          className="bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm">+ Plantão</button>}
      </div>
      {loading?<div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-red-400 border-t-transparent rounded-full animate-spin"/></div>
      :<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plantoes.length===0&&<p className="text-sm text-gray-400 italic">Nenhum plantão cadastrado.</p>}
        {plantoes.map(p=>{
          const dt=new Date(p.date+'T12:00:00'); const isHoje=p.date===fmtLocal(new Date())
          const isFeriado=p.tipo_dia.toLowerCase().includes('feriado')||p.tipo_dia.toLowerCase().includes('carnaval')
          return(
            <div key={p.id} className={`p-4 rounded-2xl border-2 ${isHoje?'border-red-500 bg-red-50':'border-gray-200 bg-white'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[11px] font-black px-2 py-1 rounded-lg ${isFeriado?'bg-amber-200 text-amber-900':'bg-gray-100 text-gray-600'}`}>{isFeriado?'🎉':'📅'} {p.tipo_dia}</span>
                <div className="flex gap-1">
                  {isHoje&&<span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full">HOJE</span>}
                  {canEdit&&<button onClick={()=>{setModal(p);setForm({tipo_dia:p.tipo_dia,date:p.date,plantonistas:p.plantonistas})}} className="text-xs text-gray-400 hover:text-blue-500 px-1">✏️</button>}
                  {canEdit&&<button onClick={()=>handleDeletar(p.id)} className="text-xs text-gray-400 hover:text-red-500 px-1">✕</button>}
                </div>
              </div>
              <p className="text-sm font-black text-gray-800 mb-1">{dt.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</p>
              <p className="text-sm font-bold text-indigo-700">👥 {p.plantonistas}</p>
            </div>
          )
        })}
      </div>}
      {modal!==null&&(
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black mb-4">{modal.id?'✏️ Editar':'➕ Novo'} plantão</h3>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Tipo / Nome</label>
            <input value={form.tipo_dia} onChange={e=>setForm(f=>({...f,tipo_dia:e.target.value}))} className={inp} placeholder="Ex: Plantão, Carnaval..."/>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data</label>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} className={inp}/>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Plantonistas</label>
            <input value={form.plantonistas} onChange={e=>setForm(f=>({...f,plantonistas:e.target.value}))} className={inp} placeholder="Nomes..."/>
            <div className="flex gap-2 mt-1">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl disabled:opacity-50">💾 Salvar</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA FÉRIAS
// ═══════════════════════════════════════════════════════════════════════════════
function AbaFerias({canEdit,meuLogin,onFeriasUpdate}:{canEdit:boolean;meuLogin:string;onFeriasUpdate:(f:Ferias[])=>void}){
  const anoAtual=new Date().getFullYear()
  const[ano,setAno]=useState(anoAtual)
  const[ferias,setFerias]=useState<Ferias[]>([])
  const[modal,setModal]=useState<{consultor:string;item?:Ferias}|null>(null)
  const[form,setForm]=useState({inicio:'',fim:'',observacao:''})
  const[salvando,setSalvando]=useState(false)

  useEffect(()=>{load()},[ano])
  async function load(){
    const{data}=await supabase.from('ferias_consultores').select('*').eq('ano',ano).order('inicio')
    const d=data||[]; setFerias(d); onFeriasUpdate(d)
  }
  function isDiaFerias(consultor:string,mes:number,dia:number){
    const dt=new Date(ano,mes,dia)
    return ferias.some(f=>f.consultor===consultor&&dt>=new Date(f.inicio+'T12:00:00')&&dt<=new Date(f.fim+'T12:00:00'))
  }
  async function handleSalvar(){
    if(!form.inicio||!form.fim||!modal?.consultor)return alert('Preencha todos os campos!')
    setSalvando(true)
    const payload={consultor:modal.consultor,ano,inicio:form.inicio,fim:form.fim,observacao:form.observacao||null,criado_por:meuLogin}
    if(modal.item){await supabase.from('ferias_consultores').update(payload).eq('id',modal.item.id)}
    else{await supabase.from('ferias_consultores').insert(payload)}
    setSalvando(false); setModal(null); await load()
  }
  async function handleDeletar(id:string){
    if(!confirm('Remover?'))return
    await supabase.from('ferias_consultores').delete().eq('id',id); await load()
  }
  const consultoresFerias=useMemo(()=>ferias.reduce((acc,f)=>{if(!acc[f.consultor])acc[f.consultor]=[];acc[f.consultor].push(f);return acc},{}as Record<string,Ferias[]>),[ferias])
  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-3 outline-none"
  return(
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={()=>setAno(a=>a-1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50">←</button>
          <span className="text-base font-black text-gray-700">✈️ Férias {ano}</span>
          <button onClick={()=>setAno(a=>a+1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50">→</button>
        </div>
        {canEdit&&<button onClick={()=>{setModal({consultor:TODOS_CONSULTORES[0]});setForm({inicio:`${ano}-01-01`,fim:`${ano}-01-15`,observacao:''})}}
          className="bg-sky-500 hover:bg-sky-600 text-white font-bold px-4 py-2 rounded-xl text-sm">+ Férias</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-black text-gray-500 py-2 pr-3 sticky left-0 bg-white z-10 min-w-28">Consultor</th>
              {MESES_PT.map((m,i)=><th key={i} className="font-black text-gray-400 px-1 text-center">{m}</th>)}
              {canEdit&&<th></th>}
            </tr>
          </thead>
          <tbody>
            {TODOS_CONSULTORES.map(consultor=>{
              const mf=consultoresFerias[consultor]||[]
              return(
                <tr key={consultor} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 font-bold text-gray-700 sticky left-0 bg-white z-10 text-[11px]">{nomeExib(consultor)}</td>
                  {Array.from({length:12},(_,m)=>{
                    const total=new Date(ano,m+1,0).getDate()
                    const qtd=Array.from({length:total},(_,d)=>isDiaFerias(consultor,m,d+1)).filter(Boolean).length
                    const pct=qtd/total
                    return(
                      <td key={m} className="px-0.5 py-1.5">
                        <div className="relative h-5 w-full rounded overflow-hidden bg-gray-100 min-w-[24px]">
                          {pct>0&&<div className="absolute inset-y-0 left-0 bg-sky-400 rounded" style={{width:`${pct*100}%`}}/>}
                          {qtd>0&&<span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-sky-900">{qtd}d</span>}
                        </div>
                      </td>
                    )
                  })}
                  {canEdit&&<td className="pl-2"><button onClick={()=>{setModal({consultor});setForm({inicio:`${ano}-01-01`,fim:`${ano}-01-15`,observacao:''})}} className="text-[10px] text-sky-500 hover:text-sky-700 font-bold">+ Add</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(consultoresFerias).length>0&&(
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(consultoresFerias).map(([consultor,fList])=>(
            <div key={consultor} className="bg-sky-50 border border-sky-200 rounded-xl p-3">
              <p className="text-xs font-black text-sky-700 mb-2">✈️ {nomeExib(consultor)}</p>
              {fList.map(f=>(
                <div key={f.id} className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-700">{new Date(f.inicio+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})} → {new Date(f.fim+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</span>
                  {canEdit&&<div className="flex gap-1">
                    <button onClick={()=>{setModal({consultor,item:f});setForm({inicio:f.inicio,fim:f.fim,observacao:f.observacao||''})}} className="text-gray-400 hover:text-blue-500">✏️</button>
                    <button onClick={()=>handleDeletar(f.id)} className="text-gray-400 hover:text-red-500">✕</button>
                  </div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {modal&&(
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black mb-3">✈️ Férias — {modal.consultor}</h3>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Consultor</label>
            <select value={modal.consultor} onChange={e=>setModal(m=>m?{...m,consultor:e.target.value}:null)} className={inp}>
              {TODOS_CONSULTORES.map(c=><option key={c}>{c}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">Início</label><input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value}))} className={inp}/></div>
              <div><label className="block text-xs font-black text-gray-400 uppercase mb-1">Fim</label><input type="date" value={form.fim} onChange={e=>setForm(f=>({...f,fim:e.target.value}))} className={inp}/></div>
            </div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Observação</label>
            <input value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} className={inp} placeholder="Opcional..."/>
            <div className="flex gap-2">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-sky-500 hover:bg-sky-600 text-white font-black py-3 rounded-xl disabled:opacity-50">💾 Salvar</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA SALA DE TREINAMENTO
// ═══════════════════════════════════════════════════════════════════════════════
function AbaSalaTreinamento({canEdit,meuLogin}:{canEdit:boolean;meuLogin:string}){
  const hoje=new Date(); const[mesOffset,setMesOffset]=useState(0)
  const ano=useMemo(()=>{const d=new Date(hoje);d.setMonth(d.getMonth()+mesOffset);return d.getFullYear()},[mesOffset])
  const mes=useMemo(()=>{const d=new Date(hoje);d.setMonth(d.getMonth()+mesOffset);return d.getMonth()},[mesOffset])
  const[reservas,setReservas]=useState<SalaReserva[]>([])
  const[modal,setModal]=useState<{data:string;turno:string;item?:SalaReserva}|null>(null)
  const[form,setForm]=useState({titulo:'',descricao:'',responsavel:''})
  const[salvando,setSalvando]=useState(false)
  const start=`${ano}-${String(mes+1).padStart(2,'0')}-01`
  const end=`${ano}-${String(mes+1).padStart(2,'0')}-${new Date(ano,mes+1,0).getDate()}`
  useEffect(()=>{supabase.from('sala_treinamento').select('*').gte('data',start).lte('data',end).then(({data})=>setReservas(data||[]))},[start,end])
  const reservaMap=useMemo(()=>{const m:Record<string,SalaReserva>={};for(const r of reservas)m[`${r.data}_${r.turno}`]=r;return m},[reservas])
  const diasMes=useMemo(()=>{const dias=[];const total=new Date(ano,mes+1,0).getDate();for(let d=1;d<=total;d++){const dt=new Date(ano,mes,d);if(dt.getDay()>0&&dt.getDay()<6)dias.push(dt)}return dias},[ano,mes])
  async function handleSalvar(){
    if(!form.titulo||!modal)return alert('Informe o título!')
    setSalvando(true)
    const payload={data:modal.data,turno:modal.turno,titulo:form.titulo,descricao:form.descricao||null,responsavel:form.responsavel||null,criado_por:meuLogin}
    if(modal.item){await supabase.from('sala_treinamento').update(payload).eq('id',modal.item.id)}
    else{await supabase.from('sala_treinamento').insert(payload)}
    const{data}=await supabase.from('sala_treinamento').select('*').gte('data',start).lte('data',end)
    setReservas(data||[]); setSalvando(false); setModal(null)
  }
  async function handleDeletar(id:string){
    if(!confirm('Remover?'))return
    await supabase.from('sala_treinamento').delete().eq('id',id); setReservas(r=>r.filter(x=>x.id!==id))
  }
  const TURNOS=[{key:'manha',label:'Manhã 🌅'},{key:'tarde',label:'Tarde 🌆'},{key:'dia_todo',label:'Dia todo'}]
  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold mb-3 outline-none"
  return(
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={()=>setMesOffset(v=>v-1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50">←</button>
          <span className="text-base font-black text-gray-700">🏫 {MESES_FULL[mes]} {ano}</span>
          <button onClick={()=>setMesOffset(v=>v+1)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-50">→</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead><tr className="bg-gray-50"><th className="text-left font-black text-gray-500 py-2 px-3 border border-gray-200 min-w-20">Data</th>{TURNOS.map(t=><th key={t.key} className="font-black text-gray-500 py-2 px-3 border border-gray-200 text-center">{t.label}</th>)}</tr></thead>
          <tbody>
            {diasMes.map(d=>{
              const ds=fmtLocal(d); const isToday=ds===fmtLocal(new Date())
              return(
                <tr key={ds} className={isToday?'bg-indigo-50':''}>
                  <td className={`py-2 px-3 border border-gray-100 font-bold ${isToday?'text-indigo-700':'text-gray-600'}`}>
                    {DIAS_CURTOS[d.getDay()]} {d.getDate()}{isToday&&<span className="ml-1 text-[9px] bg-indigo-600 text-white px-1 py-0.5 rounded-full">HOJE</span>}
                  </td>
                  {TURNOS.map(t=>{
                    const key=`${ds}_${t.key}`; const r=reservaMap[key]
                    return(
                      <td key={t.key} className="py-1.5 px-2 border border-gray-100">
                        {r?(
                          <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-2 py-1.5">
                            <p className="font-black text-indigo-800 text-[11px]">{r.titulo}</p>
                            {r.responsavel&&<p className="text-[10px] text-indigo-500">👤 {r.responsavel}</p>}
                            {canEdit&&<div className="flex gap-1 mt-1">
                              <button onClick={()=>{setModal({data:ds,turno:t.key,item:r});setForm({titulo:r.titulo,descricao:r.descricao||'',responsavel:r.responsavel||''})}} className="text-[10px] text-gray-400 hover:text-blue-500">✏️</button>
                              <button onClick={()=>handleDeletar(r.id)} className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
                            </div>}
                          </div>
                        ):canEdit?(
                          <button onClick={()=>{setModal({data:ds,turno:t.key});setForm({titulo:'',descricao:'',responsavel:''})}}
                            className="w-full h-8 rounded-xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-indigo-400 transition-all text-lg flex items-center justify-center">+</button>
                        ):<span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {modal&&(
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-black mb-4">🏫 Reserva — {new Date(modal.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})} · {TURNOS.find(t=>t.key===modal.turno)?.label}</h3>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Título *</label>
            <input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} className={inp} placeholder="Ex: Treinamento EPROC..." autoFocus/>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Responsável</label>
            <input value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} className={inp} placeholder="Nome do responsável..."/>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Descrição</label>
            <textarea value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} rows={2} className={`${inp} resize-none`} placeholder="Detalhes..."/>
            <div className="flex gap-2">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-xl disabled:opacity-50">💾 Salvar</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ABA TREINAMENTOS EXTERNOS
// ═══════════════════════════════════════════════════════════════════════════════
function AbaTreinamentosExternos({canEdit,meuLogin,ferias}:{canEdit:boolean;meuLogin:string;ferias:Ferias[]}){
  const[itens,setItens]=useState<TreinamentoExterno[]>([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState<TreinamentoExterno|'new'|null>(null)
  const[form,setForm]=useState({data:'',tipo:'EPROC',tipoCustom:'',local_nome:'',local_tipo:'',localFiltro:'',consultores:[] as string[],observacao:'',horario:''})
  const[salvando,setSalvando]=useState(false)
  const[filtroTipo,setFiltroTipo]=useState('Todos')

  useEffect(()=>{load()},[])
  async function load(){
    setLoading(true)
    const hoje=new Date().toISOString().split('T')[0]
    const{data}=await supabase.from('treinamentos_externos').select('*').gte('data',hoje).order('data').limit(50)
    setItens(data||[]); setLoading(false)
  }

  const tipoFinal=form.tipoCustom.trim()||form.tipo
  const bloqueados=useConsultoresDisponiveis(form.data,ferias)
  const locaisFiltrados=useMemo(()=>LOCAIS_TREINAMENTO.filter(l=>l.nome.toLowerCase().includes(form.localFiltro.toLowerCase())),[form.localFiltro])

  async function handleSalvar(){
    if(!form.data||!form.local_nome)return alert('Preencha data e local!')
    setSalvando(true)
    const payload={data:form.data,tipo:tipoFinal,local_nome:form.local_nome,local_tipo:form.local_tipo||null,consultores:form.consultores,observacao:form.observacao||null,horario:form.horario||null,criado_por:meuLogin}
    if(modal&&modal!=='new'&&(modal as TreinamentoExterno).id){await supabase.from('treinamentos_externos').update(payload).eq('id',(modal as TreinamentoExterno).id)}
    else{await supabase.from('treinamentos_externos').insert(payload)}
    setSalvando(false); setModal(null); await load()
  }
  async function handleDeletar(id:string){
    if(!confirm('Remover?'))return
    await supabase.from('treinamentos_externos').delete().eq('id',id); await load()
  }

  const itensFiltrados=itens.filter(i=>filtroTipo==='Todos'||i.tipo===filtroTipo)
  const inp="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-green-400 bg-white"

  return(
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black text-gray-700">📚 Treinamentos</h3>
          <div className="flex gap-1 flex-wrap">
            {['Todos','EPROC','BNMP',...new Set(itens.filter(i=>i.tipo!=='EPROC'&&i.tipo!=='BNMP').map(i=>i.tipo))].map(t=>(
              <button key={t} onClick={()=>setFiltroTipo(t)} className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all ${filtroTipo===t?t==='EPROC'?'bg-green-100 text-green-700 border-green-300':t==='BNMP'?'bg-purple-100 text-purple-700 border-purple-300':'bg-gray-700 text-white border-gray-700':'bg-white text-gray-500 border-gray-200'}`}>{t}</button>
            ))}
          </div>
        </div>
        {canEdit&&<button onClick={()=>{setModal('new');setForm({data:'',tipo:'EPROC',tipoCustom:'',local_nome:'',local_tipo:'',localFiltro:'',consultores:[],observacao:'',horario:''})}}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm">+ Treinamento</button>}
      </div>
      {loading?<div className="flex justify-center py-8"><div className="w-7 h-7 border-4 border-green-400 border-t-transparent rounded-full animate-spin"/></div>
      :<div className="space-y-2">
        {itensFiltrados.length===0&&<p className="text-sm text-gray-400 italic text-center py-8">Nenhum treinamento agendado.</p>}
        {itensFiltrados.map(it=>{
          const isE=it.tipo==='EPROC'; const isB=it.tipo==='BNMP'
          const cor=isE?'border-green-200 bg-green-50':isB?'border-purple-200 bg-purple-50':'border-blue-200 bg-blue-50'
          const badge=isE?'bg-green-200 text-green-800':isB?'bg-purple-200 text-purple-800':'bg-blue-200 text-blue-800'
          return(
            <div key={it.id} className={`border-2 rounded-2xl p-4 ${cor}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge}`}>{it.tipo}</span>
                    <span className="text-[10px] font-bold text-gray-500">{new Date(it.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})}</span>
                  </div>
                  <p className="text-sm font-black text-gray-800">{it.local_nome}</p>
                  {it.local_tipo&&<p className="text-xs text-gray-500">{it.local_tipo}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    {(it as any).horario&&<span className="text-[10px] font-bold bg-white border border-gray-200 px-2 py-0.5 rounded-full">🕐 {(it as any).horario}</span>}
                    {it.observacao&&<p className="text-xs text-gray-500 italic">💬 {it.observacao}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(it.consultores||[]).length===0?<span className="text-[10px] text-gray-400 italic">Sem consultor</span>
                    :(it.consultores||[]).map(c=><ChipConsultor key={c} nome={c}/>)}
                  </div>
                </div>
                {canEdit&&<div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>{setModal(it);setForm({data:it.data,tipo:it.tipo,tipoCustom:'',local_nome:it.local_nome,local_tipo:it.local_tipo||'',localFiltro:'',consultores:it.consultores||[],observacao:it.observacao||'',horario:(it as any).horario||''})}} className="text-xs text-gray-400 hover:text-blue-500 p-1">✏️</button>
                  <button onClick={()=>handleDeletar(it.id)} className="text-xs text-gray-400 hover:text-red-500 p-1">✕</button>
                </div>}
              </div>
            </div>
          )
        })}
      </div>}

      {modal&&(
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black mb-4">📚 {modal==='new'?'Novo':'Editar'} Treinamento</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Data *</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} className={inp}/>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase mb-1">Tipo *</label>
                <div className="flex gap-1 flex-wrap">
                  {['EPROC','BNMP'].map(t=>(
                    <button key={t} onClick={()=>setForm(f=>({...f,tipo:t,tipoCustom:''}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-all ${form.tipo===t&&!form.tipoCustom?t==='EPROC'?'border-green-500 bg-green-50 text-green-700':'border-purple-500 bg-purple-50 text-purple-700':'border-gray-200 text-gray-400'}`}>{t}</button>
                  ))}
                </div>
                <input type="text" value={form.tipoCustom} onChange={e=>setForm(f=>({...f,tipoCustom:e.target.value}))}
                  className="mt-2 w-full border border-dashed border-green-300 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Ou tipo personalizado..."/>
              </div>
            </div>

            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Local / Vara / Gabinete *</label>
            <input type="text" value={form.localFiltro||form.local_nome}
              onChange={e=>setForm(f=>({...f,localFiltro:e.target.value,local_nome:e.target.value,local_tipo:''}))}
              className={inp+' mb-1'} placeholder="Buscar vara ou gabinete..."/>
            {form.localFiltro&&locaisFiltrados.length>0&&(
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-44 overflow-y-auto shadow-md mb-3">
                {locaisFiltrados.slice(0,20).map(l=>(
                  <button key={l.nome} onClick={()=>setForm(f=>({...f,local_nome:l.nome,local_tipo:l.tipo,localFiltro:''}))}
                    className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-green-50 hover:text-green-700 border-b border-gray-50 last:border-0">
                    <span className="font-black">{l.nome}</span>
                    <span className="text-gray-400 ml-2">({l.tipo})</span>
                  </button>
                ))}
              </div>
            )}

            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Horário (opcional)</label>
            <input type="time" value={form.horario} onChange={e=>setForm(f=>({...f,horario:e.target.value}))} className={inp+' mb-3'}/>
            <label className="block text-xs font-black text-gray-400 uppercase mb-1">Observação</label>
            <textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} rows={2}
              className={`${inp} resize-none mb-3`} placeholder="Detalhes, link, instruções..."/>

            <SeletorConsultores selecionados={form.consultores} onChange={c=>setForm(f=>({...f,consultores:c}))} bloqueados={bloqueados}/>

            <div className="flex gap-2 mt-4">
              <button onClick={handleSalvar} disabled={salvando} className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl disabled:opacity-50">💾 Salvar</button>
              <button onClick={()=>setModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const ABAS=[
  {id:'sessoes',label:'🏛️ Sessões'},
  {id:'atividades',label:'📋 Atividades'},
  {id:'plantoes',label:'🚨 Plantões'},
  {id:'ferias',label:'✈️ Férias'},
  {id:'sala',label:'🏫 Sala Treinamento'},
  {id:'treinamentos',label:'📚 Treinamentos'},
]

export function PainelEquipeCompleto(){
  const{meuLogin}=useBastaoStore()
  const[aberto,setAberto]=useState(false)
  const[aba,setAba]=useState('sessoes')
  const[ferias,setFerias]=useState<Ferias[]>([])

  const canEdit=meuLogin==='Brenda'||meuLogin==='Farley'

  // Carrega férias do ano atual ao abrir (para bloqueio em todas as abas)
  useEffect(()=>{
    if(!aberto)return
    const ano=new Date().getFullYear()
    supabase.from('ferias_consultores').select('*').eq('ano',ano).then(({data})=>setFerias(data||[]))
  },[aberto])

  if(!aberto)return(
    <button onClick={()=>setAberto(true)}
      className="group flex items-center justify-between w-full px-6 py-3 rounded-2xl font-bold text-sm shadow-sm border transition-all bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 cursor-pointer">
      <span className="flex items-center gap-2"><span className="text-lg">👥</span>Painel Equipe</span>
      <span className="text-xs text-gray-400 font-bold">Clique para expandir ▼</span>
    </button>
  )

  return(
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2">
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl border border-gray-200 h-[95vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white">📅 Painel da Equipe</h2>
            <p className="text-xs text-white/60">Sessões · Atividades · Plantões · Férias · Sala · Treinamentos</p>
          </div>
          <button onClick={()=>setAberto(false)} className="text-white/60 hover:text-white text-2xl px-2">✕</button>
        </div>
        <div className="border-b border-gray-200 px-4 flex gap-1 flex-shrink-0 overflow-x-auto bg-gray-50">
          {ABAS.map(a=>(
            <button key={a.id} onClick={()=>setAba(a.id)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${aba===a.id?'border-indigo-600 text-indigo-700 bg-white':'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {aba==='sessoes'     &&<AbaSessoes canEdit={canEdit} ferias={ferias}/>}
          {aba==='atividades'  &&<AbaAtividades canEdit={canEdit} ferias={ferias}/>}
          {aba==='plantoes'    &&<AbaPlantoes canEdit={canEdit} meuLogin={meuLogin||''}/>}
          {aba==='ferias'      &&<AbaFerias canEdit={canEdit} meuLogin={meuLogin||''} onFeriasUpdate={setFerias}/>}
          {aba==='sala'        &&<AbaSalaTreinamento canEdit={canEdit} meuLogin={meuLogin||''}/>}
          {aba==='treinamentos'&&<AbaTreinamentosExternos canEdit={canEdit} meuLogin={meuLogin||''} ferias={ferias}/>}
        </div>
      </div>
    </div>
  )
}
