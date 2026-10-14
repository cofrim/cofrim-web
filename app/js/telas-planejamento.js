// Cofrim — Telas do planejamento: reserva de emergência, assinaturas, dívidas e simulador de quitação, e o aviso de
// gastos fora do comum. Saíram de js/parcelas.js, que ficou só com as regras (sem HTML). Depende de parcelas.js e telas.js.

const oddHtml = odd => odd.length ? `<div class="card"><b><span class="warn">${I('alert')}</span> Gastos acima do seu padrão</b>${odd.map(r => `
    <div class="hint">${esc((CAT_GASTO[r.cat] || CAT_GASTO.outros)[1])}: ${fmt(r.cur)} neste mês, ${Math.round((r.cur / r.avg - 1) * 100)}% acima da sua média de 6 meses (${fmt(r.avg)}).</div>`).join('')}</div>` : '';
function planHtml(){
  const r = reserve(), meses = r.months == null ? '' : r.months.toLocaleString('pt-BR', {maximumFractionDigits:1});
  return `<h2>Planejamento</h2><div class="card">
    <div class="semTopo catrow"><div class="top"><span>Reserva de emergência</span><b class="${r.months == null ? '' : r.months < 3 ? 'warn' : 'in'}">${r.months == null ? 'sem histórico' : hideVals ? '••' : meses + (r.months >= 1.5 ? ' meses' : ' mês')}</b></div>
    ${r.months == null ? '' : `<div class="bar"><i style="width:${Math.min(100, r.months / 6 * 100)}%"></i></div>`}
    <div class="hint u-mt3">${r.months == null ? 'Depois de um mês de gastos lançados, o app calcula quantos meses suas contas e investimentos cobrem.'
      : `Você tem ${fmt(r.have)} em contas e investimentos e gasta em média ${fmt(r.avg)} por mês. O recomendado é guardar de 3 a 6 meses de gastos.`}</div></div>
    <div class="quick" style="margin:14px 0 0">
      <button data-onclick="openSubs()"><span>${I('calendar', 20)}</span>Assinaturas</button>
      <button data-onclick="openDebts()"><span>${I('coins', 20)}</span>Dívidas</button>
      <button data-onclick="openPayoff()"><span>${I('percent', 20)}</span>Quitação</button></div></div>`;
}
let subsHits = [];
// Assinaturas (isSub: streaming, apps…) e contas fixas (seguro, faculdade, celular… e as anuais), cada parte com o total
// por mês e por ano. As anuais e as de alguns meses contam no ano as vezes em que caem e, no mês, a média (÷ 12). Toque num item para editar ou encerrar.
function openSubs(){
  settingsOpen = false; F = null;
  const mensais = subsList(), assin = mensais.filter(isSub), anuais = db.expenses.filter(x => x.fixed === 'y' && (!x.end || x.end >= curYM));
  const contas = [...mensais.filter(x => !isSub(x)), ...anuais];
  subsHits = [...assin, ...contas];
  const linha = x => { const c = CAT_GASTO[x.cat] || CAT_GASTO.outros, i = subsHits.indexOf(x), anual = x.fixed === 'y';
    return `<div class="item" data-onclick="openForm('expenses', subsHits[${i}])">${ico(c)}<div class="mid"><b>${esc(x.desc)}</b>
      <small>${esc(c[1])} · ${repete(x) ? repTexto(x) : anual ? 'todo ano em ' + MESES[+x.start.slice(5) - 1] : fmt(x.value) + ' por mês'}</small></div>
      <div class="val out">${fmt(x.value * vezesNoAno(x))}<small class="porAno">por ano</small></div></div>`; };
  const parte = (p, titulo, lista, vazio) => { const mes = sum(lista, x => x.value * vezesNoAno(x) / 12), media = lista.some(x => x.fixed === 'y');
    return `<div class="subsParte" data-p="${p}"><label>${titulo}</label>${lista.length ? `<div class="plano card"><div class="grid2">
      <div class="stat"><small>Por mês${media ? ' (média)' : ''}</small><b>${fmt(mes)}</b></div><div class="stat"><small>Por ano</small><b class="out">${fmt(mes * 12)}</b></div></div></div>
      ${lista.map(linha).join('')}` : `<div class="hint">${vazio}</div>`}</div>`; };
  showSheet(`<h3>Assinaturas e contas fixas</h3>
    <div class="semTopo hint">Tudo o que se repete, do mais caro ao mais barato, com o custo em um ano. Assinatura ou conta fixa: pelo nome e pela categoria, ou escolha no gasto, em Mais opções.</div>
    ${subsHits.length ? parte('assin', 'Assinaturas (streaming, apps…)', assin, 'Nenhuma assinatura.')
      + parte('contas', 'Contas fixas (seguro, faculdade, celular…)', contas, 'Nenhuma conta fixa.')
    : empty('calendar', 'Nenhum gasto fixo cadastrado.', ['+ Gasto fixo', "closeForm();openForm('expenses', null, {vals:{fixed:'1'}, more:true})"])}
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
function openDebts(){
  settingsOpen = false; F = null;
  const d = debts(), mes = sum(expensesOf(curYM).filter(x => x.kind === 'installment'), x => x.value);
  showSheet(`<h3>Dívidas e parcelas</h3>
    ${d.list.length ? `<div class="hero u-mt4"><small>Saldo devedor</small>${bigNum(d.total)}
        <div class="row"><div><small>Parcelas deste mês</small><b>${fmt(mes)}</b></div><div><small>Tudo termina em</small><b class="u-capital">${monthName(d.end)}</b></div></div></div>
      ${d.list.map(({p, left, end}) => { const c = CAT_GASTO[p.cat] || CAT_GASTO.outros;
        return `<div class="semCursor item">${ico(c)}<div class="mid"><b>${esc(p.desc)}</b>
        <small>${p.n - p.paid} de ${p.n} parcelas de ${fmt(parcVal(p, p.paid))} · até ${monthName(end)}</small>
        <div class="bar" style="margin:6px 0 0;height:6px"><i style="width:${p.paid / p.n * 100}%"></i></div></div><div class="val out">${fmt(left)}</div></div>`; }).join('')}`
    : empty('checked', 'Nenhuma compra parcelada em aberto.')}
    <div class="btns foot">${d.list.length ? '<button class="btn" data-onclick="openPayoff()">Simular quitação</button>' : ''}<button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
const payoff = {id:'', k:1};
function openPayoff(id){
  settingsOpen = false; F = null;
  const open = db.installments.filter(p => p.paid < p.n);
  if (!open.length) return tell('Nenhuma compra parcelada em aberto para simular.');
  payoff.id = typeof id === 'string' && id ? id : open.some(p => p.id === payoff.id) ? payoff.id : open[0].id;
  const p = open.find(x => x.id === payoff.id);
  payoff.k = Math.max(1, Math.min(payoff.k, p.n - p.paid));
  showSheet(`<h3>Simular quitação</h3>
    <label>Compra</label>
    <button type="button" class="pickBtn" data-onclick="pickList('Compra', payoffOpts(), payoff.id, openPayoff)"><span>${esc(p.desc)}</span>${I('chev')}</button>
    <label for="payK">Parcelas a adiantar (faltam ${p.n - p.paid}, de ${fmt(parcVal(p, p.paid))} cada)</label>
    <input id="payK" type="text" inputmode="numeric" autocomplete="off" value="${payoff.k}" data-oninput="payoff.k=parseInt(this.value)||0;drawPayoff()">
    <div id="payOut"></div>
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
  drawPayoff();
}
function drawPayoff(){
  const p = db.installments.find(x => x.id === payoff.id), r = payoffCalc(p, payoff.k), parc = parcVal(p, p.n - 1), k = p.n - p.paid - r.left;
  document.getElementById('payOut').innerHTML = k < 1 ? '<div class="hint">Digite quantas parcelas você quer adiantar.</div>' : `
    <div class="card" style="background:var(--bg);box-shadow:none;margin-top:12px">
      <div class="semTopo catrow"><div class="top"><span>Você paga agora (${k}x)</span><b class="out">${fmt(r.cost)}</b></div></div>
      <div class="catrow"><div class="top"><span>Última parcela</span><b>${r.left ? cap(monthName(r.newEnd)) : 'quitada'}</b></div>
        <div class="hint u-mt3">Hoje a compra termina em ${monthName(r.oldEnd)}.</div></div>
      <div class="catrow"><div class="top"><span>Sobra por mês depois disso</span><b class="in">${fmt(parc)}</b></div>
        <div class="hint u-mt3">De ${monthName(addMonths(r.newEnd, 1))} a ${monthName(r.oldEnd)} (${k} ${k > 1 ? 'meses' : 'mês'}) você deixa de pagar essa parcela.</div></div></div>
    <div class="hint">Conta feita sem desconto. Se o banco ou a loja der desconto para adiantar, a economia é maior.</div>`;
}
const budgetColor = pct => pct > 100 ? 'var(--out)' : pct >= 80 ? 'var(--yield)' : 'var(--in)';
// Toques: sobra do orçamento e "Pago" de uma conta (saíram de js/parcelas.js).
function setRoll(v){
  db.prefs.rollBudget = v; db.cfgMod = Date.now(); save(); render();
  document.querySelectorAll('#rollPick button').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!v));
}
function togglePaid(id, ym){
  if (window.event) event.stopPropagation();
  const x = db.expenses.find(e => e.id === id);
  if (!x) return tell(ARCH_MSG);
  const pm = x.pm || [], pd = {...x.pd};
  x.pm = pm.includes(ym) ? pm.filter(m => m !== ym) : pm.concat(ym);
  // Dia em que foi marcada como paga (pd: {AAAA-MM: 'AAAA-MM-DD'}), mostrado na lista de Gastos.
  if (pm.includes(ym)) delete pd[ym]; else pd[ym] = new Date().toLocaleDateString('sv');
  if (Object.keys(pd).length) x.pd = pd; else delete x.pd;
  touch(x); save(); render();
  if (db.prefs.fun && !pm.includes(ym)){ confetti(); toast(pick(semPorquinho(FUN_PAID)), {central:false}); } // brincadeira do modo divertido
}
