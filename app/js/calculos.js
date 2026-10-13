// Cofrim — Regras de cálculo (sem HTML): o que vale em cada mês, ganhos e gastos do mês, vales,
// arquivo de anos antigos e saldo das contas bancárias.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md e ARCHITECTURE.md).

// ---------- Regras ----------
// Vale para ganhos e gastos. fixed: false = só no mês start; true = todo mês a partir de start;
// 'y' = anual, todo ano no mesmo mês de start. Os dois últimos param em end, se houver.
// Em alguns meses (2.60): fixed 'y' com rep. rep número = a cada rep meses, a partir de start; rep lista = os meses do
// ano marcados (1 a 12), de start em diante. rep só vale com fixed 'y': um APK antigo vê um anual (só no mês de start).
const repete = x => x.fixed === 'y' && (Number.isInteger(x.rep) || Array.isArray(x.rep));
function activeIn(x, ym){
  if (!x.fixed) return x.start === ym;
  if (x.start > ym || (x.end && ym > x.end)) return false;
  if (x.fixed !== 'y') return true;
  if (Array.isArray(x.rep)) return x.rep.includes(+ym.slice(5));
  if (Number.isInteger(x.rep)) return monthDiff(ym, x.start) % x.rep === 0;
  return ym.slice(5) === x.start.slice(5);
}
// Vezes por ano que um lançamento cai (para a média por mês das contas que não são mensais).
const vezesNoAno = x => !x.fixed ? 0 : x.fixed !== 'y' ? 12 : Array.isArray(x.rep) ? x.rep.length : Number.isInteger(x.rep) ? 12 / x.rep : 1;
// Próximo mês, depois de m, em que o lançamento cai (até 25 anos à frente); '' se não cai mais.
function proximoMes(x, m){
  for (let i = 1; i <= 300; i++){ const n = addMonths(m, i); if (x.end && n > x.end) return ''; if (activeIn(x, n)) return n; }
  return '';
}
const isMonthly = x => x.fixed && x.fixed !== 'y';
// Assinatura: gasto fixo mensal marcado como tal (sub '1'); sem escolha (sub ''), o nome de um serviço conhecido ou a
// categoria (SUB_CATS: streaming e jogos). Marcado como conta fixa (sub '0') nunca é. O resto dos fixos é conta fixa.
const SUB_RX = /netflix|spotify|stream|stremm|disney|prime video|amazon prime|\bhbo\b|\bmax\b|globoplay|paramount|youtube|apple|icloud|google one|deezer|crunchyroll|star\+|telecine|xbox|playstation|\bpsn\b|game ?pass|chatgpt|openai|claude|canva|adobe|microsoft 365|office 365|dropbox|academia|smart ?fit|gympass|wellhub|totalpass|kindle|audible|duolingo|uber one|mubi|assinatura/;
const SUB_CATS = ['cinema', 'jogos'];
const isSub = x => !!isMonthly(x) && (x.sub === '1' || (x.sub !== '0' && (SUB_RX.test(plain(x.desc || '')) || SUB_CATS.includes(x.cat))));
// Arquivo de anos antigos (ver archiveUntil em sincronizacao.js): os lançamentos até o ano db.archUntil saem dos dados do dia a dia
// e ficam num arquivo à parte, na conta Google (arquivo.json) e neste aparelho (ARCH_KEY). arch = o conteúdo do arquivo,
// carregado quando a tela mostra um período arquivado; os cálculos desses meses somam os lançamentos dele.
let arch = null, archTried = false;
const ARCH_KEY = 'financas-arquivo';
const archRecs = (col, ym) => arch && db.archUntil && ym.slice(0, 4) <= db.archUntil ? (arch[col] || []).filter(r => !db[col].some(x => x.id === r.id)) : [];
const archNeeded = () => !!db.archUntil && (String(state.year) <= db.archUntil || state.month.slice(0, 4) <= db.archUntil);
// Carrega o arquivo: primeiro a cópia deste aparelho; se não houver, busca na conta (uma vez por abertura do app).
function ensureArchive(){
  if (arch || !db.archUntil) return true;
  try { const a = JSON.parse(localStorage.getItem(ARCH_KEY) || 'null'); if (a && a.until >= db.archUntil){ arch = a; dirty(); return true; } } catch(e){}
  if (!archTried && canSync() && sync.on){
    archTried = true;
    driveList("name='arquivo.json'").then(f => f[0] ? driveGet(f[0].id) : null)
      .then(a => { if (a){ arch = a; if (!CIFRA_ATIVA) try { localStorage.setItem(ARCH_KEY, JSON.stringify(a)); } catch(e){} } }) // web: só na memória
      .catch(() => {}).finally(() => telaAtualizar());
  }
  return false;
}
// ---------- Dia útil e o dia em que um ganho cai ----------
// Dia útil = fora do fim de semana e dos feriados nacionais do país escolhido (db.prefs.pais; Configurações › Aparência).
// Brasil (o padrão): calculado aqui, sem internet, com os dias sem expediente nos bancos (Carnaval, Sexta-feira Santa e
// Corpus Christi, que mudam com a Páscoa), porque é quando o salário cai na conta. Outros países: a lista oficial de
// feriados nacionais vem da Nager.Date (date.nager.at, pública e sem conta) uma vez por ano e por país e fica guardada
// neste aparelho; enquanto não chega (ou se o país não estiver lá), contam só os fins de semana. O fim de semana também
// é o do país (sexta e sábado em alguns). Feriados estaduais e municipais ficam de fora (o app não sabe a cidade).
const FERIADOS_FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
const FERIADOS_KEY = 'financas-feriados'; // {"<país>-<ano>": ["MM-DD", …]}, só neste aparelho
const feriadosCache = {}, feriadosPedidos = new Set();
const paisDia = () => (db.prefs && db.prefs.pais) || 'BR';
function feriadosBR(ano){
  // Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451), mes = Math.floor((h + l - 7 * m + 114) / 31), dia = (h + l - 7 * m + 114) % 31 + 1;
  const pascoa = new Date(ano, mes - 1, dia);
  const mais = n => { const x = new Date(pascoa); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv').slice(5); };
  return new Set([...FERIADOS_FIXOS, mais(-48), mais(-47), mais(-2), mais(60)]); // Carnaval (seg e ter), Sexta Santa, Corpus Christi
}
function feriadosGuardados(){ try { return JSON.parse(localStorage.getItem(FERIADOS_KEY)) || {}; } catch(e){ return {}; } }
function feriados(ano, pais = paisDia()){
  const k = pais + '-' + ano;
  if (feriadosCache[k]) return feriadosCache[k];
  if (pais === 'BR') return (feriadosCache[k] = feriadosBR(ano));
  const g = feriadosGuardados()[k];
  if (Array.isArray(g)) return (feriadosCache[k] = new Set(g.filter(d => /^\d\d-\d\d$/.test(d))));
  feriadosBaixar(pais, ano);
  return new Set(); // por enquanto, só o fim de semana
}
// Baixa os feriados nacionais de um país e ano (uma vez por abertura do app, se falhar); ao chegar, as telas refazem as contas.
async function feriadosBaixar(pais, ano){
  const k = pais + '-' + ano;
  if (feriadosPedidos.has(k) || window.TESTE || !/^[A-Z]{2}$/.test(pais)) return;
  feriadosPedidos.add(k);
  try {
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${pais}`);
    if (r.status !== 200 && r.status !== 204 && r.status !== 404) return;
    const l = r.status === 200 ? await r.json() : [];
    const dias = (Array.isArray(l) ? l : []).filter(x => x && x.global !== false && /^\d{4}-\d\d-\d\d$/.test(x.date)).map(x => x.date.slice(5));
    const todos = feriadosGuardados(); todos[k] = [...new Set(dias)];
    const chaves = Object.keys(todos); for (const c of chaves.slice(0, Math.max(0, chaves.length - 30))) delete todos[c]; // até 30 países e anos
    try { localStorage.setItem(FERIADOS_KEY, JSON.stringify(todos)); } catch(e){}
    delete feriadosCache[k]; dirty(); telaAtualizar();
  } catch(e){ /* sem internet: tenta de novo na próxima abertura */ }
}
// Dias do fim de semana do país (0 = domingo … 6 = sábado), pelo próprio navegador; sem a informação, sábado e domingo.
const fimSemanaCache = {};
function fimDeSemana(pais = paisDia()){
  if (fimSemanaCache[pais]) return fimSemanaCache[pais];
  let dias = [6, 0];
  try { const loc = new Intl.Locale('und-' + pais), w = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo;
    if (w && Array.isArray(w.weekend) && w.weekend.length) dias = w.weekend.map(d => d % 7); } catch(e){}
  return (fimSemanaCache[pais] = dias);
}
const diaUtil = (ym, d) => { const [a, m] = ym.split('-').map(Number), w = new Date(a, m - 1, d).getDay();
  return !fimDeSemana().includes(w) && !feriados(a).has(`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`); };
// Regras do dia de um ganho fixo ou anual (x.regra): '' = o dia escolhido (x.day); 'ult' = último dia útil do mês;
// 'prim' = primeiro dia útil; 'nutil' = o x.day-ésimo dia útil (ex.: 5º dia útil). Com o dia escolhido caindo em fim de
// semana ou feriado, x.ajuste diz o que a empresa faz: 'antes' = paga no dia útil anterior; 'depois' = no próximo dia
// útil; '' = no próprio dia. O dia fica sempre dentro do mês do ganho (sem dia útil antes, vai para o seguinte, e
// vice-versa).
const REGRAS_DIA = {ult:'último dia útil', prim:'primeiro dia útil', nutil:'dia útil'};
function diaGanho(x, ym){
  const n = daysIn(ym), util = d => diaUtil(ym, d), antes = d => { while (d > 1 && !util(d)) d--; return d; },
    depois = d => { while (d < n && !util(d)) d++; return d; };
  const regra = x.fixed ? x.regra : '', ajuste = x.fixed ? x.ajuste : ''; // as regras valem só para ganho fixo ou anual
  if (regra === 'ult') return antes(n);
  if (regra === 'prim') return depois(1);
  if (regra === 'nutil'){ let k = 0; for (let d = 1; d <= n; d++) if (util(d) && ++k === (+x.day || 5)) return d; return antes(n); }
  const d = Math.min(+x.day || 0, n);
  if (!d || util(d) || !ajuste) return d;
  const r = ajuste === 'antes' ? antes(d) : depois(d);
  return util(r) ? r : ajuste === 'antes' ? depois(d) : antes(d);
}
// Texto curto do dia de um ganho: "último dia útil", "5º dia útil", "dia 31 (ou o dia útil antes)".
const diaGanhoTexto = x => { const regra = x.fixed ? x.regra : '', ajuste = x.fixed ? x.ajuste : '';
  return regra === 'nutil' ? `${+x.day || 5}º dia útil` : REGRAS_DIA[regra]
    || (x.day ? `dia ${x.day}${ajuste === 'antes' ? ' (ou o dia útil antes)' : ajuste === 'depois' ? ' (ou o próximo dia útil)' : ''}` : ''); };
// Vale-alimentação e vale-refeição ficam separados do resto: não entram nos ganhos, nos gastos nem no saldo do mês.
// Crédito de vale = ganho com a categoria va ou vr; gasto no vale = gasto (ou parcela) com a forma de pagamento va ou vr.
// incomesOf/expensesOf devolvem o mês SEM os vales; incomesAll/expensesAll, com eles; valeIn/valeOut, só eles.
const VALES = {va:'Vale-alimentação', vr:'Vale-refeição', vt:'Vale-transporte'};
// Gastos avulsos que se repetem como uma conta: a mesma descrição (sem números nem acento) em 3 meses ou mais dos últimos 6,
// uma vez por mês e com valor quase igual (até 5% da mediana), fora das categorias do dia a dia (RECORR_FORA), sem um
// gasto fixo igual e sem a pessoa ter dito que não é fixo. Sugere virar fixo.
const RECORR_FORA = ['alimentacao', 'mercado', 'restaurante', 'cafe', 'combustivel', 'estacionamento', 'conducao', 'transporte', 'farmacia',
  'compras', 'roupas', 'bares', 'presentes', 'lazer', 'shows', 'viagem'];
const recorrChave = d => plain(String(d || '')).replace(/[^a-z]+/g, ' ').trim();
function recorrentes(){
  const desde = addMonths(curYM, -5), ign = db.prefs.recorrIgnorados || [], grupos = {};
  const fixos = new Set(db.expenses.filter(x => x.fixed && (!x.end || x.end >= curYM)).map(x => recorrChave(x.desc)));
  for (const x of db.expenses){
    const k = recorrChave(x.desc);
    if (x.fixed || !x.start || x.start < desde || x.start > curYM || VALES[x.pay] || RECORR_FORA.includes(x.cat) || k.length < 3 || fixos.has(k)
      || ign.includes(k)) continue;
    (grupos[k] = grupos[k] || []).push(x);
  }
  const mediana = l => { const v = l.map(x => x.value).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  return Object.entries(grupos).map(([k, l]) => {
    const m = mediana(l), perto = l.filter(x => Math.abs(x.value - m) <= Math.max(.5, m * .05)), meses = [...new Set(perto.map(x => x.start))];
    if (l.length > meses.length + 1) return {meses:0}; // várias vezes no mesmo mês: compra do dia a dia, não conta
    const ult = perto.reduce((a, x) => x.start >= a.start ? x : a, perto[0]), dias = perto.map(x => +x.day).filter(Boolean);
    return {k, meses:meses.length, valor:m, ult, dia:dias.length ? dias.sort((a, b) => a - b)[Math.floor(dias.length / 2)] : 0};
  }).filter(r => r.meses >= 3).sort((a, b) => b.meses - a.meses || b.valor - a.valor);
}
// Empresas de vale mais comuns no Brasil (campo "Empresa do vale"); a última usada em cada vale já vem escolhida.
const VALE_EMPRESAS = ['Alelo', 'Pluxee', 'Sodexo', 'Ticket', 'VR', 'iFood Benefícios', 'Ben', 'Flash', 'Caju', 'Swile', 'Up Brasil', 'Greencard', 'Outra'];
const valeEmp = k => ([...db.incomes.filter(x => x.cat === k && x.emp),
  ...db.expenses.filter(x => x.pay === k && x.emp)].sort((a, b) => (b.u || 0) - (a.u || 0))[0] || {}).emp || '';
const temVales = () => Object.keys(VALES).some(temVale);
const valeGanho = x => !!VALES[x.cat], valeGasto = x => !!VALES[x.pay];
const incomesAll = ym => cached('I' + ym, () => [...db.incomes, ...archRecs('incomes', ym)].filter(x => activeIn(x, ym)));
const incomesOf = ym => cached('i' + ym, () => incomesAll(ym).filter(x => !valeGanho(x)));
const expensesAll = ym => cached('E' + ym, () => expensesRaw(ym));
const expensesOf = ym => cached('e' + ym, () => expensesAll(ym).filter(x => !valeGasto(x)));
const valeIn = (ym, k) => incomesAll(ym).filter(x => k ? x.cat === k : valeGanho(x));
const valeOut = (ym, k) => expensesAll(ym).filter(x => k ? x.pay === k : valeGasto(x));
const temVale = k => db.incomes.some(x => x.cat === k) || db.expenses.some(x => x.pay === k) || db.installments.some(x => x.pay === k);
// Saldo de um vale no fim do mês ym: tudo o que entrou menos tudo o que saiu, desde o primeiro lançamento dele.
const valeSaldo = (k, ym = curYM) => cached('vs' + k + ym, () => {
  const ini = [...db.incomes.filter(x => x.cat === k), ...db.expenses.filter(x => x.pay === k),
    ...db.installments.filter(x => x.pay === k)].reduce((a, x) => x.start < a ? x.start : a, ym);
  let s = 0;
  for (let m = ini, i = 0; m <= ym && i < 240; m = addMonths(m, 1), i++) s += sum(valeIn(m, k), x => x.value) - sum(valeOut(m, k), x => x.value);
  return round2(s);
});
function expensesRaw(ym){
  // Gasto dividido: value passa a ser só a sua parte; full guarda o total que saiu da sua conta;
  // got diz se a parte da outra pessoa já foi recebida (nos gastos fixos, mês a mês, em x.sm).
  const list = [...db.expenses, ...archRecs('expenses', ym)].filter(x => activeIn(x, ym)).map(x => ({...x, kind:'expense', full:x.value,
    value:x.value - (x.share || 0), got:x.fixed ? (x.sm || []).includes(ym) : !!x.settled}));
  // Parcelas: cada uma no mês dela, paga ou não ("Pagar" só muda o status). Financiamento e empréstimo saem da conta de
  // débito. Os abatimentos entram como gasto no mês em que foram feitos.
  for (const p of [...db.installments, ...archRecs('installments', ym)]){
    const i = monthDiff(ym, p.start), onde = isFin(p) ? {bank:p.conta || '', pay:'debito'} : {bank:p.bank, pay:p.pay};
    if (i >= 0 && i < p.n) list.push({id:p.id, kind:'installment', desc:p.desc, cat:p.cat, ...onde, by:p.by, value:parcVal(p, i), num:i+1, n:p.n,
      paid:i < p.paid});
    for (const a of p.ab || []) if (a.d.slice(0, 7) === ym) list.push({id:p.id, kind:'installment', abat:true, desc:p.desc, cat:p.cat, ...onde,
      by:p.by, value:a.v, day:+a.d.slice(8)});
  }
  return list;
}
const totalIn = ym => sum(incomesOf(ym), x => x.value);
const totalOut = ym => sum(expensesOf(ym), x => x.value);
// ---------- Contas bancárias ----------
// db.accounts = [{name, initial, since}]: initial é o saldo no começo do mês since. O saldo de hoje soma, de since
// até o mês atual, os ganhos que caem na conta e as transferências recebidas, menos os gastos e parcelas feitos
// nesse banco (qualquer forma de pagamento) e as transferências enviadas. A ligação é pelo nome do banco/conta.
// Regras do saldo:
// - conta até a data-limite `until` = [mês, dia] (padrão: hoje). Lançamento com dia depois do limite, no mês do limite,
//   ainda não entrou; sem dia informado, conta desde o começo do mês. Gasto fixo usa o dia do vencimento.
// - compras no crédito não saem da conta na hora: a fatura do mês M sai no mês seguinte, no dia de pagamento do
//   cartão (db.cardDue), da conta escolhida em db.cardAcc (ou da conta com o mesmo nome do banco do cartão).
// - gasto dividido: sai o valor cheio; a parte da outra pessoa volta quando marcada como recebida.
const today = () => [curYM, now.getDate()];
const monthEnd = ym => [ym, 31];
const reached = (ym, day, [uy, ud]) => ym < uy || (ym === uy && (day || 1) <= ud);
// Conta que paga a fatura de um cartão: a escolhida; senão a de mesmo nome; senão a única conta que existir.
// Com várias contas e nenhuma escolhida, devolve '' e a tela de Gastos avisa que falta escolher.
const cardAccount = bank => db.cardAcc[bank] || (db.accounts.some(a => a.name === bank) ? bank : db.accounts.length === 1 ? db.accounts[0].name : '');
function accountBalance(a, until = today()){
  let b = a.initial || 0;
  for (let m = a.since; m <= until[0]; m = addMonths(m, 1)){
    for (const x of incomesOf(m)) if (x.bank === a.name && reached(m, diaGanho(x, m), until)) b += x.value;
    for (const x of expensesOf(m)){
      if (x.bank !== a.name) continue;
      if (x.share && x.got) b += x.share;
      if (x.pay !== 'credito' && reached(m, x.kind === 'expense' ? (x.fixed ? x.due : x.day) : 0, until)) b -= x.full || x.value;
    }
    // faturas dos cartões pagos por esta conta: a de M-1 vence em M
    for (const [bank, v] of invoices(addMonths(m, -1))) if (cardAccount(bank) === a.name && reached(m, db.cardDue[bank], until)) b -= v;
  }
  for (const t of db.transfers) if (t.month >= a.since && reached(t.month, t.day, until)) b += (t.to === a.name ? t.value : 0) - (t.from === a.name ? t.value : 0);
  return b;
}
