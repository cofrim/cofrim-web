// Cofrim — Orçamento, contas a vencer, fatura do cartão, planejamento e financiamentos, empréstimos e compras
// parceladas. Depende de dados.js.
// Saiu de js/dados.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Orçamento, contas a vencer e fatura do cartão ----------
// Orçamento: db.budgets = {categoria: limite mensal}. Aviso a partir de 80% do limite.
// Com db.prefs.rollBudget, o que sobrou do limite no mês anterior soma ao limite deste mês (base = limite simples).
function budgetStatus(ym){
  const spentOf = m => { const s = {}; expensesOf(m).forEach(e => s[e.cat] = (s[e.cat] || 0) + e.value); return s; };
  const spent = spentOf(ym), prev = db.prefs.rollBudget ? spentOf(addMonths(ym, -1)) : null;
  return Object.entries(db.budgets).filter(([,lim]) => lim > 0).map(([cat, base]) => {
    const extra = prev ? Math.max(0, base - (prev[cat] || 0)) : 0, lim = base + extra;
    return {cat, lim, base, extra, used:spent[cat] || 0, pct:(spent[cat] || 0) / lim * 100};
  });
}
// Gastos avulsos fora do padrão: categorias em que o mês atual passou 30% (e pelo menos R$ 50) da média dos 6 meses anteriores.
// Fixos e parcelas ficam de fora: são esperados.
function unusual(){
  const by = ym => { const g = {}; expensesOf(ym).forEach(x => { if (x.kind === 'expense' && !x.fixed) g[x.cat] = (g[x.cat] || 0) + x.value; }); return g; };
  const cur = by(curYM), past = [...Array(6)].map((_, i) => by(addMonths(curYM, -1 - i)));
  return Object.keys(cur).map(cat => ({cat, cur:cur[cat], avg:sum(past, g => g[cat] || 0) / 6}))
    .filter(r => r.avg > 0 && r.cur > r.avg * 1.3 && r.cur - r.avg >= 50).sort((a, b) => b.cur - a.cur);
}
// Limite do cartão (db.cardLimit): quanto já está comprometido = parcelas que ainda faltam + compras no crédito deste mês.
function cardUsed(bank){
  return sum(db.installments.filter(p => !isFin(p) && p.bank === bank && p.pay === 'credito'), parcFalta)
    + sum(expensesOf(curYM).filter(e => e.kind === 'expense' && e.bank === bank && e.pay === 'credito'), e => e.full || e.value);
}

// ---------- Planejamento: reserva de emergência, assinaturas, dívidas e simulador de quitação ----------
// Reserva: quantos meses de gastos (média dos últimos 6 meses com gasto) as contas e os investimentos cobrem.
function reserve(){
  const outs = [...Array(6)].map((_, i) => totalOut(addMonths(curYM, -1 - i))).filter(v => v > 0);
  const avg = outs.length ? sum(outs, v => v) / outs.length : 0;
  const have = sum(db.accounts, a => Math.max(0, accountBalance(a))) + sum(db.investments, v => v.value || 0);
  return {have, avg, months:avg ? have / avg : null};
}
// ---------- Financiamentos, empréstimos e compras parceladas ----------
// Tudo em db.installments; financiamento e empréstimo têm tipo. As parcelas não são gravadas uma a uma: saem de total,
// n, paid, start, seg e due. j = índice da parcela (0 = a primeira).
const isFin = p => !!PARC_TIPOS[p.tipo];
// Etiqueta de uma parcela na lista do mês: "parcela 3/10" ou "abatimento".
const parcTag = x => x.abat ? 'abatimento' : `parcela ${x.num}/${x.n}`;
// Valor da parcela j: total/n em centavos, com a última fechando o total (100 em 3x: 33,33 + 33,33 + 33,34); depois de
// um abatimento, seg diz o valor a partir de cada parcela (as já passadas não mudam).
function parcVal(p, j){
  const base = round2(p.total / p.n);
  let v = j === p.n - 1 ? round2(p.total - base * (p.n - 1)) : base;
  for (const s of p.seg || []) if (s.de <= j) v = s.v;
  return v;
}
const parcSoma = (p, de, ate) => { let s = 0; for (let j = Math.max(0, de); j < ate; j++) s += parcVal(p, j); return s; };
const parcFalta = p => parcSoma(p, p.paid, p.n);          // soma das parcelas que faltam (sem juros)
const parcPago = p => parcSoma(p, 0, Math.min(p.paid, p.n));
const abatido = p => sum(p.ab || [], a => a.v);
// Saldo devedor hoje: sem taxa, a soma das parcelas que faltam; com taxa i ao mês, o valor presente delas (tabela Price:
// com parcelas iguais, P × (1 − (1+i)^−n) ÷ i).
function saldoDevedor(p){
  const i = (+p.taxa || 0) / 100;
  if (!i) return parcFalta(p);
  let s = 0;
  for (let j = p.paid, k = 1; j < p.n; j++, k++) s += parcVal(p, j) / Math.pow(1 + i, k);
  return s;
}
// Vencimento da parcela j: {ym, dia}. Dia cadastrado; senão, numa compra no crédito, o vencimento da fatura do banco;
// senão só o mês (dia 0). Em meses mais curtos, o último dia do mês.
function parcVenc(p, j){
  const ym = addMonths(p.start, j), d = +p.due || (!isFin(p) && p.pay === 'credito' && +db.cardDue[p.bank]) || 0;
  return {ym, dia:d ? Math.min(d, daysIn(ym)) : 0};
}
const vencData = v => v.dia ? v.ym + '-' + String(v.dia).padStart(2, '0') : '';
const vencTxt = v => v.dia ? fmtDate(vencData(v)) : MESES[+v.ym.slice(5) - 1].slice(0, 3) + '/' + v.ym.slice(0, 4);
// Dias até o vencimento (negativo = vencida). Só com o mês, conta até o último dia dele.
function diasAte(v){
  const [y, m] = v.ym.split('-').map(Number), hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, v.dia || daysIn(v.ym)) - hoje) / 864e5);
}
// Situação de cada parcela: paga, vencida (data passou e não foi paga) ou a vencer.
const parcLinhas = p => [...Array(p.n)].map((_, j) => { const v = parcVenc(p, j), dias = diasAte(v);
  return {j, v, dias, val:parcVal(p, j), st:j < p.paid ? 'paga' : dias < 0 ? 'vencida' : 'avencer'}; });
// Abater A (amortização antecipada, só financiamento e empréstimo). modo 'prazo': a parcela fica igual e o número de
// parcelas que faltam diminui (arredondado para cima: todas as parcelas continuam iguais); 'parcela': o prazo fica igual e
// a parcela diminui. Com taxa, pela tabela Price; sem taxa, na proporção do saldo. Devolve {saldo, r, parc} depois do abatimento.
function abaterCalc(p, A, modo){
  const i = (+p.taxa || 0) / 100, r = p.n - p.paid, P = parcVal(p, p.paid), saldo = Math.max(0, saldoDevedor(p) - A);
  if (modo === 'prazo'){
    const nr = i ? -Math.log(1 - saldo * i / P) / Math.log(1 + i) : saldo / P;
    return {saldo, r:Math.min(r, Math.max(1, Math.ceil(nr - 1e-9))), parc:P};
  }
  return {saldo, r, parc:round2(i ? saldo * i / (1 - Math.pow(1 + i, -r)) : saldo / r)};
}
// Grava o abatimento: as parcelas pagas guardam o valor que tinham; as restantes passam ao valor novo.
function abater(p, A, modo, dia){
  const c = abaterCalc(p, A, modo), seg = (p.seg || [{de:0, v:p.total / p.n}]).filter(s => s.de < p.paid);
  seg.push({de:p.paid, v:c.parc});
  p.seg = seg; p.n = p.paid + c.r;
  p.total = round2(parcSoma(p, 0, p.n));
  p.ab = [...(p.ab || []), {d:dia, v:round2(A), modo}];
  touch(p);
  return c;
}
const subsList = () => db.expenses.filter(x => isMonthly(x) && activeIn(x, curYM)).sort((a, b) => b.value - a.value);
function debts(){
  const list = db.installments.filter(p => p.paid < p.n).map(p => ({p, left:parcFalta(p), end:addMonths(p.start, p.n - 1)})).sort((a, b) => a.end.localeCompare(b.end));
  return {list, total:sum(list, d => d.left), end:list.length ? list[list.length - 1].end : ''};
}
// Adiantar k parcelas: quanto custa agora, quando a compra termina e quantas parcelas ainda ficam.
function payoffCalc(p, k){
  const rem = p.n - p.paid, oldEnd = addMonths(p.start, p.n - 1);
  k = Math.max(0, Math.min(parseInt(k) || 0, rem));
  return {cost:round2(parcSoma(p, p.n - k, p.n)), oldEnd, newEnd:addMonths(oldEnd, -k), left:rem - k};
}
const payoffOpts = () => db.installments.filter(p => p.paid < p.n).map(p => [p.id, p.desc]);
// Contas a vencer: gastos fixos/anuais com dia de vencimento (due) e ainda não marcados como pagos no mês (pm).
const isPaid = (x, ym) => (x.pm || []).includes(ym);
const dueDay = (x, ym) => Math.min(x.due, daysIn(ym));
function upcomingBills(){
  const today = now.getDate();
  return db.expenses.filter(x => x.fixed && x.due && activeIn(x, curYM) && !isPaid(x, curYM))
    .map(x => ({x, diff:dueDay(x, curYM) - today})).filter(b => b.diff <= 7).sort((a,b) => a.diff - b.diff);
}
// Fatura do cartão: compras no crédito por banco. db.cardClose = {banco: dia de fechamento}.
// Um gasto avulso com dia da compra depois do fechamento cai na fatura do mês seguinte.
function invoices(ym){
  const tot = {};
  for (const m of [addMonths(ym, -1), ym]) for (const e of expensesOf(m)){
    if (e.pay !== 'credito' || !e.bank) continue;
    const close = db.cardClose[e.bank], late = e.kind === 'expense' && !e.fixed && e.day && close && e.day > close;
    if ((late ? addMonths(m, 1) : m) === ym) tot[e.bank] = (tot[e.bank] || 0) + (e.full || e.value); // a fatura cobra o valor cheio, mesmo em gasto dividido
  }
  return Object.entries(tot).sort((a,b) => b[1] - a[1]);
}
const creditBanks = () => [...new Set([...db.expenses, ...db.installments].filter(x => x.pay === 'credito' && x.bank).map(x => x.bank))];

// Lembretes no celular (só no APK): monta a lista de avisos dos próximos meses e entrega ao lado nativo,
// que agenda as notificações. db.prefs.remind = quantos dias antes avisar (0 = desligado).
// Laço por índice (o for…of em texto grande era lento); um emoji (par de surrogates) conta só a 1ª metade, como antes.
const hashId = s => { let h = 0; for (let i = 0; i < s.length; i++){ const c = s.charCodeAt(i); h = (h * 31 + c) | 0;
  if (c >= 0xD800 && c < 0xDC00 && (s.charCodeAt(i + 1) & 0xFC00) === 0xDC00) i++; } return Math.abs(h); };
