// Cofrim — Utilidades sem estado de tela: meses e datas, dinheiro (fmt, parseMoney), esc() e somas.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md e ARCHITECTURE.md).

// ---------- Utilidades ----------
function ymOf(y, m0){ return y + '-' + String(m0+1).padStart(2,'0'); }
function addMonths(ym, n){ const [y,m] = ym.split('-').map(Number); const t = y*12 + (m-1) + n; return ymOf(Math.floor(t/12), t%12); }
function monthDiff(a, b){ const [ya,ma] = a.split('-').map(Number), [yb,mb] = b.split('-').map(Number); return (ya-yb)*12 + (ma-mb); }
function monthName(ym){ const [y,m] = ym.split('-').map(Number); return MESES[m-1] + ' ' + y; }
const daysIn = ym => { const [y,m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
// Moeda dos valores (db.prefs.moeda, ISO 4217; quem escolhe é applyTheme, com definirMoeda): o formatador, o símbolo
// ("R$", "US$", "€") e as casas decimais (0 no iene, 3 no dinar do Kuwait). O jeito de escrever o número continua o do
// português (1.234,56), em qualquer moeda.
let moeda = null;
// Esconder valores (botão do olho): todo valor em dinheiro vira "R$ ••••" (com o símbolo da moeda). Fica só neste aparelho.
const HIDE_KEY = 'financas-olho';
let MASK = 'R$ ••••';
function definirMoeda(cod){
  const formato = c => new Intl.NumberFormat('pt-BR', {style:'currency', currency:c});
  let nf;
  try { nf = formato(cod); } catch(e){ cod = 'BRL'; nf = formato(cod); } // código que este navegador não conhece: fica o real
  const simbolo = (nf.formatToParts(1).find(p => p.type === 'currency') || {}).value || cod;
  moeda = {cod, simbolo, casas:nf.resolvedOptions().maximumFractionDigits, nf};
  MASK = simbolo + ' ••••';
}
definirMoeda('BRL');
// Valor com o símbolo da moeda e um formato próprio do número (as formas curtas: "R$ 5,2 mil").
const comMoeda = (v, o) => moeda.simbolo + ' ' + v.toLocaleString('pt-BR', o);
let hideVals = false;
try { hideVals = localStorage.getItem(HIDE_KEY) === '1'; } catch(e){}
const fmt = v => hideVals ? MASK : fmtTexto(v);
// Sem a máscara de "Esconder valores": para textos guardados (central de notificações) e notificações do Android.
const fmtTexto = v => moeda.nf.format(v || 0);
// Roda fn com os valores à mostra (lembretes, widget e relatório não podem sair mascarados).
function shown(fn){ const h = hideVals; hideVals = false; try { return fn(); } finally { hideVals = h; } }
// Etiquetas livres de um lançamento ("viagem SP, trabalho" -> ['viagem SP', 'trabalho']).
const tagsOf = x => String(x.tags || '').split(',').map(s => s.trim()).filter(Boolean);
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
// Texto em dinheiro → número ("R$ 1.234,56" → 1234.56). Na moeda sem centavos, o ponto só separa os milhares ("1.235").
function parseMoney(s){
  s = String(s).replace(/[\s\u00A0]/g,'').replace(moeda.simbolo,'').replace('R$',''); // só o símbolo sai: "120/3" não vira conta
  if (s.includes(',') || (moeda.casas === 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s))) s = s.replace(/\./g,'').replace(',','.');
  return parseFloat(s);
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// Valor para um campo de dinheiro, no mesmo formato da máscara do campo (centsMask): milhar com ponto e centavos com
// vírgula ("13.300,00"); parseMoney lê de volta.
const moneyStr = v => v == null || v === '' ? ''
  : Number(v).toLocaleString('pt-BR', {minimumFractionDigits:moeda.casas, maximumFractionDigits:moeda.casas});
const sum = (a, f) => a.reduce((t,x) => t + f(x), 0);
// Número escrito com milhar e decimais de qualquer dos dois jeitos ("1.234,56", "1,234.56", "1234,5", "1.500"): o
// separador decimal é o que vem antes de 1 ou 2 dígitos no fim; sem ele, pontos e vírgulas são de milhar.
function numEscrito(s){
  s = String(s);
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(/[.,]/g, '');
  return parseFloat(s);
}
// Data AAAA-MM-DD que existe no calendário (31/02 não existe).
const dataExiste = iso => { const [y, m, d] = String(iso).split('-').map(Number), t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
// Arredonda um valor de dinheiro: centavos (2 casas), ou 3 casas nas moedas que têm (dinar do Kuwait, do Bahrein…).
// Função (e não const): o fixDb a usa ao abrir o app, antes desta linha.
function round2(v){ const f = moeda && moeda.casas > 2 ? 1000 : 100; return Math.round(v*f)/f; }
const sheetOpen = () => document.getElementById('sheet').classList.contains('open');
// Regras avisam a tela sem conhecê-la (padrão observador): depois de mudar dados sozinhas (cotação nova, arquivo de
// anos antigos, conta trocada…), chamam telaAtualizar(); a tela se inscreve com aoAtualizar(fn) (ver assistente.js).
// sempre = redesenha mesmo com uma folha aberta.
const ouvintesTela = [];
function aoAtualizar(fn){ ouvintesTela.push(fn); }
function telaAtualizar(sempre = false){ for (const fn of ouvintesTela) fn(sempre); }
