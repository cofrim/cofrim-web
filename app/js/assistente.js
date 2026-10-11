// Cofrim — Assistente (perguntas sobre os dados), render() e navegação (go, voltar), seletores de mês e ano, gestos e CSV.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md).
// ---------- Assistente: responde perguntas sobre os dados do app ----------
// Não usa IA nem internet: reconhece na pergunta o assunto (gastos, ganhos, saldo, parcelas, investimentos…),
// o período e os filtros (categoria, banco, forma de pagamento, palavra da descrição) e faz a conta nos dados.
const CAT_WORDS = {moradia:['moradia','casa','habitacao'], alimentacao:['alimentacao','comida','alimento'], transporte:['transporte','locomocao'],
  saude:['saude'],
  lazer:['lazer','diversao'], educacao:['educacao','estudo'], compras:['compras'], contas:['assinatura'], emprestimo:['emprestimo']};
const INC_WORDS = {salario:['salario'], freelance:['freela','extra'], rendimentos:['rendimentos'], va:['vale alimentacao'], vr:['vale refeicao'],
  vt:['vale transporte'], vendas:['venda']};
const PAY_WORDS = {credito:['credito'], debito:['debito'], pix:['pix'], dinheiro:['dinheiro','especie'], boleto:['boleto'], va:['vale alimentacao'],
  vr:['vale refeicao'], vt:['vale transporte']};
const CHAT_STOP = new Set(('quanto quantos quais qual gastei gasto gastos gastar ganhei ganho ganhos esse este essa esta nesse neste desse deste mes meses ano com para por que foi meu minha meus minhas tenho total valor ' +
  'passado atual proximo sobre onde mais maior menos como esta estao pagar paguei recebi tive foram reais ultimo ultimos comparado comparando compare media saldo quero saber dizer mostre mostra').split(' '));
const CHAT_HINTS = ['Quanto gastei este mês?', 'Onde gastei mais este ano?', 'Quanto vai sobrar no fim do mês?', 'Quais contas vencem este mês?'];
const chatLog = []; // {me, html} ou {me:false, entry:índice em chatEntries}; fica só na memória, some ao fechar o app
// Lançar pelo assistente: "mercado 45 nubank crédito", "gastei 32,50 no uber", "recebi 200 de freelance".
// Devolve {col, desc, value, cat, bank, pay, q} ou null se a frase não parece um lançamento (perguntas nunca são).
const chatEntries = [];
function parseEntry(q){
  const t = ' ' + plain(q).replace(/\s+/g, ' ').trim() + ' ';
  if (q.includes('?') || /\b(quanto|quanta|qual|quais|onde|como|quando|quem|por que|porque)\b/.test(t)) return null;
  const num = t.match(/(?:r\$ ?)?\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\b(?: ?reais| ?conto)?/);
  if (!num) return null;
  const verbo = t.match(/^ (gastei|gasto|paguei|comprei|lancar|lanca|lance|anota|anotar|registrar|registra|adicionar|adiciona|recebi|ganhei|entrou|caiu) /);
  if (!verbo && (t.trim().split(' ').length > 6 || /\b(saldo|gastos?|ganhos?|parcelas?|investi\w*|orcamento|contas?|proventos?|sobra\w*|20\d\d)\b/.test(t.replace(num[0], ' ')))) return null;
  const value = /^\d{1,3}(\.\d{3})+$/.test(num[1]) ? +num[1].replace(/\./g, '') : parseNum(num[1]);
  if (!(value > 0)) return null;
  const col = verbo && /recebi|ganhei|entrou|caiu/.test(verbo[1]) ? 'incomes' : 'expenses';
  const pay = col === 'expenses' ? findKey(t, PAY_WORDS) || '' : '';
  const bank = bankSuggestions().find(b => t.includes(' ' + plain(b) + ' ')) || '';
  // Descrição: o que sobra da frase sem o verbo, o valor, o banco, a forma de pagamento e as preposições das pontas.
  let d = t.replace(num[0], ' ');
  if (verbo) d = d.replace(verbo[0], ' ');
  if (bank) d = d.replace(' ' + plain(bank) + ' ', ' ');
  d = d.replace(/\b(credito|debito|pix|dinheiro|boleto|especie|vale alimentacao|vale refeicao|cartao|reais|r\$)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const prep = /^(no|na|nos|nas|em|de|do|da|com|pelo|pela|via|um|uma|o|a|pro|pra|para)$/;
  let w = d.split(' ').filter(Boolean);
  while (w.length && prep.test(w[0])) w.shift();
  while (w.length && prep.test(w[w.length - 1])) w.pop();
  // A frase foi comparada sem acentos; a descrição volta com os acentos que a pessoa digitou.
  const orig = q.split(/\s+/).filter(Boolean), desc0 = w.map(p => orig.find(o => plain(o).replace(/[^a-z0-9]/g, '') === p) || p).join(' ');
  const C = col === 'incomes' ? CAT_GANHO : CAT_GASTO, pd = plain(desc0);
  const porNome = Object.keys(C).find(k => !C[k][3] && (plain(C[k][1]) === pd || pd.split(' ').includes(plain(C[k][1]))));
  const memo = col === 'expenses' && db.catMemo[pd];
  const cat = memo && C[memo] ? memo : porNome || (col === 'expenses' ? guessCat(desc0) : 'outros');
  return {col, desc:cap(desc0) || C[cat][1], value:round2(value), cat, bank, pay, q};
}
function entryHtml(i){
  const e = chatEntries[i], C = e.col === 'incomes' ? CAT_GANHO : CAT_GASTO;
  if (e.done) return e.done;
  return `<b>Lançar este ${e.col === 'incomes' ? 'ganho' : 'gasto'}?</b>` +
    chatRows([[e.desc, e.value], ['Categoria', (C[e.cat] || C.outros)[1]], ...(e.bank ? [['Banco', e.bank]] : []),
      ...(e.pay ? [['Pagamento', PAY[e.pay]]] : []), ['Mês', cap(monthName(curYM))]]) +
    `<div class="btns"><button class="btn primary" data-onclick="entryDo(${i},'ok')">Lançar</button><button class="btn" data-onclick="entryDo(${i},'edit')">Editar</button></div>
    <div class="btns" style="margin-top:6px"><button class="btn" data-onclick="entryDo(${i},'no')">Não era isso</button></div>`;
}
function entryDo(i, op){
  const e = chatEntries[i];
  if (op === 'ok'){
    e.id = uid();
    db[e.col].push(touch(e.col === 'incomes' ? {id:e.id, desc:e.desc, value:e.value, cat:e.cat, bank:e.bank, day:'', fixed:false, start:curYM, end:''}
      : {id:e.id, desc:e.desc, value:e.value, cat:e.cat, bank:e.bank, pay:e.pay, tags:'', who:'', share:'', fixed:false, start:curYM, day:'', due:'', end:''}));
    if (e.col === 'expenses') db.catMemo[plain(e.desc)] = e.cat;
    save();
    e.done = `<span class="in">${I('checked', 16)}</span> Lançado: <b>${esc(e.desc)}</b>, ${shown(() => fmt(e.value))}, em ${monthName(curYM)}.<div class="btns"><button class="btn" data-onclick="entryDo(${i},'undo')">Desfazer</button></div>`;
  } else if (op === 'undo'){
    db[e.col] = db[e.col].filter(r => r.id !== e.id); db.tomb[e.id] = Date.now(); save();
    e.done = 'Desfeito: o lançamento foi removido.';
  } else if (op === 'edit'){
    e.done = 'Abri o formulário já preenchido para você conferir e salvar.';
    openForm(e.col, null,
      {vals:{desc:e.desc, value:moneyStr(e.value), cat:e.cat, bank:e.bank, ...(e.col === 'expenses' ? {pay:e.pay} : {fixed:''})}, more:true});
  } else e.done = falaTema(e.q, answer(e.q));
  const log = document.getElementById('chatLog');
  if (log) log.innerHTML = chatHtml();
}
// Texto ditado (botão do microfone, só no APK): vai para o assistente como se tivesse sido digitado.
function onVoz(text){
  if (state.tab !== 'chat'){ state.tab = 'chat'; render(); }
  sendChat(text);
}
const findKey = (t, map) => Object.keys(map).find(k => map[k].some(w => t.includes(w)));
const chatRows = items => items.map(([name, v]) => `<div class="catrow"><div class="top"><span>${esc(name)}</span><b>${typeof v === 'number' ? fmt(v) : v}</b></div></div>`).join('');
const topBy = (items, key, n = 5) => { const g = {}; items.forEach(x => g[key(x)] = (g[key(x)] || 0) + x.value);
  return Object.entries(g).sort((a,b) => b[1] - a[1]).slice(0, n); };
const allBanks = () => [...new Set([...db.expenses, ...db.installments].map(x => x.bank).filter(Boolean))];

// Período citado na pergunta; sem citação, o mês atual.
function parsePeriod(t){
  const y = now.getFullYear(), ym = t.match(/\b(20\d\d)\b/), yr = ym ? +ym[1] : 0;
  const yearOf = Y => ({months:[...Array(12)].map((_,i) => ymOf(Y, i)), label:'em ' + Y});
  const one = m => ({months:[m], label:'em ' + monthName(m).replace(' ', ' de ')});
  if (/mes passado|ultimo mes/.test(t)) return one(addMonths(curYM, -1));
  if (/mes que vem|proximo mes/.test(t)) return one(addMonths(curYM, 1));
  const last = t.match(/ultimos (\d+) meses/);
  if (last){ const n = Math.min(36, Math.max(1, +last[1]));
    return {months:[...Array(n)].map((_,i) => addMonths(curYM, i - n + 1)), label:`nos últimos ${n} meses`}; }
  const mi = MESES.findIndex(n => new RegExp('\\b' + plain(n) + '\\b').test(t));
  if (mi >= 0) return one(ymOf(yr || y, mi));
  if (/ano passado/.test(t)) return yearOf(y - 1);
  if (/ano que vem|proximo ano/.test(t)) return yearOf(y + 1);
  if (yr) return yearOf(yr);
  if (/\bano\b|anual/.test(t)) return yearOf(y);
  return one(curYM);
}
// Gastos do período com os filtros citados na pergunta. Devolve os itens e o texto que descreve o filtro.
function chatExpenses(t, P){
  // Categoria: pelas palavras conhecidas ou pelo nome (inclui as categorias criadas pelo usuário).
  const cat = findKey(t, CAT_WORDS) || Object.keys(CAT_GASTO).find(k => t.includes(' ' + plain(CAT_GASTO[k][1]) + ' '));
  const pay = findKey(t, PAY_WORDS), bank = allBanks().find(b => t.includes(plain(b)));
  let items = P.months.flatMap(m => expensesOf(m));
  // Sem categoria citada: procura uma palavra da pergunta nas descrições (ex.: "mercado", "uber").
  let rest = t;
  for (const w of [...Object.values(PAY_WORDS).flat(), ...MESES.map(plain), ...(bank ? [plain(bank)] : [])]) rest = rest.replace(w, ' ');
  const word = !cat && rest.split(/\s+/).find(w => w.length >= 4 && !CHAT_STOP.has(w) && !/^\d+$/.test(w) && items.some(x => plain(x.desc).includes(w)));
  if (cat) items = items.filter(x => x.cat === cat);
  if (word) items = items.filter(x => plain(x.desc).includes(word));
  if (bank) items = items.filter(x => x.bank === bank);
  if (pay) items = items.filter(x => x.pay === pay);
  const what = [cat && 'com ' + esc(CAT_GASTO[cat][1].toLowerCase()), word && `com "${esc(word)}"`, bank && 'no ' + esc(bank),
    pay && 'em ' + PAY[pay].toLowerCase()].filter(Boolean).join(' ');
  return {items, what, filtered:!!(cat || word || bank || pay)};
}
// Com um tema especial (e o app em português), a resposta ganha uma abertura e um fecho no clima do tema: as falas
// exclusivas dele (FALAS_ASSIST, em js/temas2.js) ou, num tema sem falas próprias, as da categoria. A escolha é fixa para
// cada pergunta: a mesma pergunta recebe sempre as mesmas falas.
function falaTema(q, resp){
  const k = db.prefs.skin, falas = FALAS_ASSIST[k] || FALAS_ASSIST_CAT[temaCat(k)];
  if (!k || lang() !== 'pt' || !falas) return resp;
  let h = 0;
  for (const ch of plain(q).trim()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const [ab, fe] = falas;
  return `<span class="fala">${ab[h % ab.length]}</span>${resp}<span class="fala fim">${fe[(h >>> 4) % fe.length]}</span>`;
}
function answer(q){
  const t = ' ' + plain(q).replace(/[-?!.,;:"']/g, ' ').replace(/\s+/g, ' ') + ' ';
  const P = parsePeriod(t), single = P.months.length === 1, future = P.months.every(m => m > curYM);
  const held = db.investments.filter(v => v.ticker), asset = held.find(v => t.includes(' ' + v.ticker.toLowerCase() + ' '));
  const helpText = 'Posso responder sobre gastos, ganhos, saldo, previsão, contas bancárias, transferências, parcelas, faturas, orçamento, contas a vencer, metas, investimentos, vendas e proventos. Você pode citar um mês, um ano, uma categoria, um banco ou uma forma de pagamento.';

  if (/ajuda|exemplo|o que voce (sabe|faz|pode)/.test(t)) return helpText;
  if (/devo (investir|comprar|vender)|vale a pena|recomenda|melhor investimento|onde investir|em que investir/.test(t))
    return 'Não faço recomendações de investimento. Posso mostrar os números dos investimentos que você cadastrou; para decidir onde aplicar, veja a aba Notícias ou procure um profissional habilitado.';

  if (/vencer|vencimento|\bvence|contas a pagar/.test(t)){
    const m = P.months[0], bills = db.expenses.filter(x => x.fixed && x.due && activeIn(x, m)).sort((a,b) => a.due - b.due);
    if (!bills.length) return `Não há contas com dia de vencimento ${P.label}. Para cadastrar, edite um gasto fixo e informe o dia do vencimento.`;
    const open = bills.filter(x => !isPaid(x, m));
    return `${open.length ? `Faltam pagar <b>${fmt(sum(open, x => x.value))}</b> em ${open.length} conta${open.length > 1 ? 's' : ''} ${P.label}` : `Todas as contas ${P.label} estão pagas`}.` +
      chatRows(bills.map(x => [`${x.desc} · dia ${dueDay(x, m)}`, isPaid(x, m) ? 'paga' : fmt(x.value)]));
  }
  if (/orcamento|limite/.test(t)){
    const b = budgetStatus(P.months[0]);
    if (!b.length) return 'Você ainda não definiu orçamentos. Na aba Gastos, toque em "Definir" ao lado de "Orçamento do mês".';
    const over = b.filter(x => x.pct > 100).length;
    return `${over ? `${over} categoria${over > 1 ? 's' : ''} acima do limite` : 'Nenhuma categoria acima do limite'} ${P.label}.` +
      chatRows(b.map(x => [(CAT_GASTO[x.cat] || CAT_GASTO.outros)[1], `${fmt(x.used)} de ${fmt(x.lim)} (${Math.round(x.pct)}%)`]));
  }
  if (/\bmetas?\b|objetivo/.test(t)){
    if (!db.goals.length) return 'Você ainda não cadastrou metas. Elas ficam na aba Investir.';
    return `Você tem ${db.goals.length} meta${db.goals.length > 1 ? 's' : ''}, com <b>${fmt(sum(db.goals, g => g.saved))}</b> guardados de ${fmt(sum(db.goals, g => g.target))}.` +
      chatRows(db.goals.map(g => [g.name, `${fmt(g.saved)} de ${fmt(g.target)} (${Math.round(g.saved / g.target * 100)}%)`]));
  }
  if (/fatura/.test(t)){
    const m = P.months[0], bank = allBanks().find(b => t.includes(plain(b))), inv = invoices(m).filter(([b]) => !bank || b === bank);
    if (!inv.length) return `Não encontrei compras no crédito ${bank ? 'no ' + esc(bank) + ' ' : ''}${P.label}.`;
    return `As faturas ${P.label} somam <b>${fmt(sum(inv, x => x[1]))}</b>.` + chatRows(inv);
  }
  if (/parcela|falta pagar|quanto devo|divida/.test(t)){
    const open = db.installments.filter(p => p.paid < p.n);
    if (!open.length) return 'Você não tem compras parceladas em aberto.';
    const left = parcFalta;
    return `Falta pagar <b>${fmt(sum(open, left))}</b> em ${open.length} compra${open.length > 1 ? 's' : ''} parcelada${open.length > 1 ? 's' : ''}. Neste mês as parcelas somam ${fmt(sum(expensesOf(curYM).filter(x => x.kind === 'installment'), x => x.value))}.` +
      chatRows(open.map(p => [`${p.desc} · ${p.paid}/${p.n} · até ${monthName(addMonths(p.start, p.n - 1))}`, left(p)]));
  }
  if (/vai sobrar|vou ter no fim|previs(ao|to)|fim do mes/.test(t) && !/invest|projec/.test(t)){
    const rows = [...Array(4)].map((_,i) => addMonths(curYM, i)), net = m => totalIn(m) - totalOutPrev(m), n0 = net(curYM), r0 = reservaPrevisoes(curYM);
    return `Pela previsão, em ${monthName(curYM)} ${n0 < 0 ? 'faltam' : 'sobram'} <b>${fmt(Math.abs(n0))}</b>${db.accounts.length ? `, e o saldo das contas termina o mês em <b>${fmt(sum(db.accounts, a => accountBalance(a, monthEnd(curYM))) - r0)}</b>` : ''}${r0 ? ` (${prevInclui(r0)})` : ''}.` +
      chatRows(rows.map(m => [monthName(m), `${net(m) < 0 ? 'falta' : 'sobra'} ${fmt(Math.abs(net(m)))}`]));
  }
  if (/transfer/.test(t)){
    const list = db.transfers.filter(x => P.months.includes(x.month));
    if (!list.length) return `Não encontrei transferências ${P.label}.`;
    return `Você fez ${list.length} transferência${list.length > 1 ? 's' : ''} ${P.label}, somando <b>${fmt(sum(list, x => x.value))}</b>.` + chatRows(list.map(x => [`${x.from} → ${x.to}`, x.value]));
  }
  const acc = db.accounts.find(a => t.includes(' ' + plain(a.name) + ' '));
  if (db.accounts.length && /saldo|quanto tenho|tenho n|dinheiro/.test(t) && (acc || /\bcontas?\b|\bbanco/.test(t))){
    const list = acc ? [acc] : db.accounts;
    return `${acc ? `O saldo de ${esc(acc.name)} hoje é` : 'Suas contas somam hoje'} <b>${fmt(sum(list, a => accountBalance(a)))}</b>; a previsão para o fim do mês é ${fmt(sum(list, a => accountBalance(a, monthEnd(curYM))) - (acc ? 0 : reservaPrevisoes(curYM)))}${!acc && reservaPrevisoes(curYM) ? `, contando ${fmt(reservaPrevisoes(curYM))} de previsões` : ''}.` +
      (acc ? '' : chatRows(list.map(a => [a.name, accountBalance(a)])));
  }
  if (/provento|dividendo|\bjcp\b/.test(t)){
    // Sem período na pergunta, soma todos os proventos já registrados.
    const dated = /\bmes\b|\bmeses\b|\bano\b|20\d\d/.test(t) || MESES.some(n => t.includes(' ' + plain(n) + ' '));
    const rows = held.map(v => [v.ticker,
      sum((v.divs || []).filter(d => !dated || P.months.includes(d.date.slice(0, 7))), d => d.value)]).filter(r => r[1] > 0);
    if (!rows.length) return 'Não encontrei proventos registrados nesse período. Para registrar, use "Registrar provento" no cartão do ativo, na aba Investir.';
    return `Você recebeu <b>${fmt(sum(rows, r => r[1]))}</b> em proventos ${dated ? P.label : 'até hoje'}.` + chatRows(rows);
  }
  if (/vend(a|as|i|eu|ido)\b|lucr/.test(t) && held.some(v => (v.sales || []).length)){
    const rows = held.map(v => [v.ticker, sum(v.sales || [], s => s.qty * (s.price - s.cost))]).filter(r => r[1] !== 0);
    const total = sum(rows, r => r[1]);
    return `O resultado das suas vendas de ações e moedas é <b>${total < 0 ? '−' : '+'}${fmt(Math.abs(total))}</b>.` + chatRows(rows.map(([n, v]) => [n, `${v < 0 ? '−' : '+'}${fmt(Math.abs(v))}`]));
  }
  if (asset){
    const cost = asset.qty * asset.paid, gain = asset.value - cost;
    return `Você tem <b>${asset.qty.toLocaleString('pt-BR', {maximumFractionDigits:8})}</b> de ${esc(asset.ticker)}, que valem <b>${fmt(asset.value)}</b> hoje.` +
      chatRows([['Preço médio', fmtQ(asset.paid)], ['Cotação atual', fmtQ(asset.quote)], ['Total investido', cost], ['Rendimento', `${gain < 0 ? '−' : '+'}${fmt(Math.abs(gain))} (${(cost ? gain / cost * 100 : 0).toLocaleString('pt-BR', {maximumFractionDigits:2})}%)`]]);
  }
  if (/invest|rend(eu|e|imento|endo)|carteira|patrimonio|acoes|aplicad|aplicac/.test(t)){
    const vs = db.investments, total = sum(vs, v => v.value);
    if (!vs.length) return 'Você ainda não cadastrou investimentos.';
    if (/rend/.test(t)){
      const gain = sum(held, v => v.value - v.qty * v.paid), fixedYield = sum(vs.filter(v => !v.ticker), v => v.value * monthlyRate(v));
      return `${held.length ? `Suas ações e moedas acumulam <b>${gain < 0 ? '−' : '+'}${fmt(Math.abs(gain))}</b> desde as compras. ` : ''}A renda fixa rende cerca de <b>${fmt(fixedYield)}</b> neste mês, pelas taxas atuais.`;
    }
    if (/projec|daqui|vou ter|12 meses|um ano|futuro/.test(t)) return `Pela projeção, seus ${fmt(total)} de hoje chegam a <b>${fmt(sum(vs, projection))}</b> em 12 meses (valor bruto, com as taxas atuais; ações e moedas entram pelo valor de hoje).`;
    return `Você tem <b>${fmt(total)}</b> investidos hoje.` + chatRows(topBy(vs, v => (CAT_INV[v.cat] || CAT_INV.outros)[1], 9));
  }
  if (/\bmedia\b/.test(t)){
    const months = single ? [...Array(now.getMonth() + 1)].map((_,i) => ymOf(now.getFullYear(), i)) : P.months.filter(m => m <= curYM);
    if (!months.length) return 'Só consigo calcular a média de meses que já começaram.';
    const {items, what} = chatExpenses(t, {months});
    return `Sua média de gastos ${what} é de <b>${fmt(sum(items, x => x.value) / months.length)}</b> por mês, considerando ${months.length} ${months.length > 1 ? 'meses' : 'mês'} (${monthName(months[0])} a ${monthName(months[months.length - 1])}).`;
  }
  if (/saldo|sobr(ou|a|ando|ara)|economiz/.test(t)){
    const tin = sum(P.months, totalIn), tout = sum(P.months, totalOut);
    return `Seu saldo ${P.label} é <b>${fmt(tin - tout)}</b>${future ? ' (previsão)' : ''}.` + chatRows([['Ganhos', tin], ['Gastos', tout]]);
  }
  if (/ganh(ei|o|os|ar)|receb|renda|salario|entrou|entrada|\bvale (alimentacao|refeicao)/.test(t) && !/gast|pagu?ei|pago/.test(t)){
    const cat = findKey(t, INC_WORDS);
    const items = P.months.flatMap(m => incomesOf(m)).filter(x => !cat || x.cat === cat);
    if (!items.length) return `Não encontrei ganhos ${cat ? 'de ' + esc(CAT_GANHO[cat][1].toLowerCase()) + ' ' : ''}${P.label}.`;
    return `${future ? 'A previsão é receber' : 'Você recebeu'} <b>${fmt(sum(items, x => x.value))}</b> ${cat ? 'de ' + esc(CAT_GANHO[cat][1].toLowerCase()) + ' ' : ''}${P.label}.` + chatRows(topBy(items, x => x.desc));
  }
  const ex = chatExpenses(t, P);
  if (/onde .*gast|maior(es)? gasto|mais gast|gast\w* mais|categoria/.test(t) && !ex.filtered){
    if (!ex.items.length) return `Não encontrei gastos ${P.label}.`;
    const total = sum(ex.items, x => x.value), top = topBy(ex.items, x => (CAT_GASTO[x.cat] || CAT_GASTO.outros)[1]);
    return `Seu maior gasto ${P.label} foi com <b>${esc(top[0][0].toLowerCase())}</b>: ${fmt(top[0][1])}, ${Math.round(top[0][1] / total * 100)}% do total de ${fmt(total)}.` + chatRows(top);
  }
  if (/gast|pagu?ei|pago|despesa|custo|custa/.test(t) || ex.filtered){
    if (!ex.items.length) return `Não encontrei gastos ${ex.what} ${P.label}.`;
    const total = sum(ex.items, x => x.value);
    let cmp = '';
    if (single && /compar|aumentou|diminuiu|a mais|a menos|mes anterior/.test(t)){ // mesma conta no mês anterior
      const prevM = addMonths(P.months[0], -1),
      prev = sum(chatExpenses(t.replace(/mes passado|ultimo mes/g, ' '), {months:[prevM]}).items, x => x.value), d = total - prev;
      cmp = ` São ${fmt(Math.abs(d))} ${d >= 0 ? 'a mais' : 'a menos'} que em ${monthName(prevM)} (${fmt(prev)}).`;
    }
    return `${future ? 'A previsão é gastar' : 'Você gastou'} <b>${fmt(total)}</b> ${ex.what} ${P.label}, em ${ex.items.length} lançamento${ex.items.length > 1 ? 's' : ''}.${cmp}` +
      chatRows(ex.filtered ? topBy(ex.items, x => x.desc) : topBy(ex.items, x => (CAT_GASTO[x.cat] || CAT_GASTO.outros)[1]));
  }
  return 'Não entendi essa pergunta. ' + helpText;
}
function chatHtml(){
  // A saudação vem em três balões curtos (quem é, o que responde, como lançar), mais fáceis de ler que um texto só.
  const ola = db.prefs.fun ? ['Oinc! Sou o porquinho de plantão.',
    'Pergunte o que quiser sobre os seus números: eu faço as contas aqui mesmo no aparelho, sem contar nada para a internet.']
    : ['Olá! Sou o assistente do app.',
      'Pergunte sobre os dados que você cadastrou. As respostas são calculadas aqui no aparelho, sem enviar nada para a internet.'];
  if (lang() === 'pt' && myName()) ola[0] = ola[0].replace(/^(Oinc|Olá)!/, `$1, ${esc(myName()).replace(/\$/g, '$$$$')}!`);
  // Com um tema especial, quem cumprimenta é o personagem do tema, com a primeira abertura exclusiva dele (falaTema), e
  // não o porquinho.
  const falas = db.prefs.skin && lang() === 'pt' && (FALAS_ASSIST[db.prefs.skin] || FALAS_ASSIST_CAT[temaCat(db.prefs.skin)]);
  if (falas) ola[0] = `${falas[0][0]} Olá${myName() ? ', ' + esc(myName()) : ''}! Estou de plantão para as suas contas.`;
  return [...ola, 'Para lançar um gasto, escreva por exemplo "mercado 45 nubank crédito".'].map(t => `<div class="msg ola">${t}</div>`).join('') +
    // As sugestões vêm logo depois da saudação: aparecem enquanto nada foi enviado e, depois, ficam no começo da
    // conversa (é só rolar para cima). A conversa recomeça cada vez que o app é aberto (ver inicio.js).
    `<div class="chips">${CHAT_HINTS.map(h => `<button data-onclick="sendChat(this.textContent)">${h}</button>`).join('')}</div>` +
    chatLog.map(m => `<div class="msg ${m.me ? 'me' : ''}">${m.entry != null ? entryHtml(m.entry) : m.html}</div>`).join('');
}
function sendChat(text){
  const el = document.getElementById('chatIn'), q = (text || el.value).trim();
  if (!q) return;
  const ent = parseEntry(q);
  chatLog.push({me:true, html:esc(q)}, ent ? {me:false, entry:chatEntries.push(ent) - 1} : {me:false, html:falaTema(q, answer(q))});
  el.value = '';
  document.getElementById('chatLog').innerHTML = chatHtml();
  const msgs = document.querySelectorAll('#chatLog .msg.me');
  msgs[msgs.length - 1].scrollIntoView({block:'start', behavior:db.prefs.anim ? 'smooth' : 'auto'});
}
function viewChat(){
  return `
  <h1><span class="volta"><button class="iconbtn" data-onclick="sairChat()" aria-label="Voltar">‹</button>Assistente</span></h1>${contaPill()}
  <div id="chatLog">${chatHtml()}</div>
  <div style="height:70px"></div>
  <form class="chatbar" data-onsubmit="sendChat();return false">
    <input id="chatIn" placeholder="Pergunte ou lance: mercado 45 pix" autocomplete="off" enterkeyhint="send">
    ${temNativo('ouvir') ? `<button type="button" class="btn" style="flex:none;padding:11px 12px" data-onclick="nativo('ouvir')" aria-label="Falar">${I('mic', 20)}</button>` : ''}
    <button class="btn primary" style="flex:none;padding:11px 14px" aria-label="Enviar">${I('send', 20)}</button>
  </form>`;
}

const VIEWS = {resumo:viewResumo, ganhos:viewGanhos, gastos:viewGastos, invest:viewInvest, noticias:viewNoticias, chat:viewChat, explorar:viewExplorar};
// O botão + some ao rolar para baixo (para não cobrir os valores da lista) e volta ao rolar para cima.
let lastScroll = 0;
addEventListener('scroll', () => {
  const y = scrollY;
  document.getElementById('topbar').classList.toggle('show', y > 110);
  if (Math.abs(y - lastScroll) < 6) return;
  for (const id of ['fab', 'fabChat']) document.getElementById(id).classList.toggle('away', y > lastScroll && y > 80);
  lastScroll = y;
  clearTimeout(fabDesviaT); fabDesviaT = setTimeout(fabDesvia, 150); // parou de rolar: confere de novo
}, {passive:true});
// Os botões flutuantes (o "+" e o do assistente) não ficam por cima de um botão da tela (ex.: o "Pago" das contas a
// vencer): com a tela parada e um botão embaixo, cada um encolhe numa aba na beirada direita, fora do conteúdo (os
// dois juntos, um acima do outro); um toque na aba faz o mesmo que o botão. Volta ao tamanho normal quando a área fica
// livre. Só no celular: na tela larga há espaço dos lados.
let fabDesviaT = 0;
function fabDesvia(){
  const fabs = ['fab', 'fabChat'].map(id => document.getElementById(id)).filter(b => !b.hidden && !b.classList.contains('away'));
  for (const b of fabs) b.classList.remove('aba'); // mede cada um no lugar normal
  if (innerWidth >= 700) return;
  const cobre = fabs.filter(b => { const r = b.getBoundingClientRect(), m = 6;
    const pontos = [[r.left + m, r.top + m], [r.right - m, r.top + m], [r.left + m, r.bottom - m], [r.right - m, r.bottom - m],
      [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
    return pontos.some(([x, y]) => document.elementsFromPoint(x, y)
      .some(el => !el.closest('.fab, .tabs') && el.matches('button, a, input, select, textarea'))); });
  for (const b of cobre) b.classList.add('aba');
}
addEventListener('resize', () => { clearTimeout(fabDesviaT); fabDesviaT = setTimeout(fabDesvia, 150); });
const telaErro = () => `<h1>${esc(TABS[state.tab] ? TABS[state.tab][1] : 'Cofrim')}</h1><div class="card"><b>${I('alert')} Não foi possível abrir esta tela</b>
  <div class="hint">O erro ficou registrado e seus dados continuam salvos. Informe o problema para a equipe do Cofrim: o Diagnóstico vai junto.</div>
  <div class="btns"><button class="btn primary" data-onclick="relatarProblema('Não foi possível abrir esta tela')">Informar o problema</button>${state.tab !== 'resumo' ? '<button class="btn" data-onclick="go(\'resumo\')">Ir para o Resumo</button>' : ''}</div></div>`;
function render(){
  dirty();
  if (archNeeded()) ensureArchive();
  // Erro ao montar a tela (dado inesperado): em vez de deixar o app vazio (ou preso na abertura), mostra o aviso com o
  // caminho para o Diagnóstico, e o erro fica registrado.
  let tela;
  try { tela = VIEWS[state.tab](); } catch(e){ logErr('tela ' + state.tab, e); tela = telaErro(); }
  document.getElementById('app').innerHTML = tela;
  document.getElementById('tabs').innerHTML = visTabs().map(t => `<button class="${t === state.tab ? 'on' : ''}" ${t === state.tab ? 'aria-current="page"' : ''} data-onclick="go('${t}')"><span>${I(TABS[t][0], 23)}</span>${TABS[t][1]}</button>`).join('');
  const noFab = ['resumo', 'noticias', 'chat', 'explorar'].includes(state.tab);
  document.getElementById('fab').hidden = noFab;
  document.getElementById('fab').classList.remove('away');
  // Assistente: botão flutuante em todas as telas, ao lado do "+" quando ele existe; some dentro do próprio assistente e na aba Explorar.
  const fc = document.getElementById('fabChat');
  fc.hidden = state.tab === 'chat' || state.tab === 'explorar'; fc.classList.remove('away'); fc.classList.toggle('alto', !noFab);
  document.getElementById('app').classList.toggle('hasFab', !noFab);
  document.getElementById('app').classList.toggle('cols', state.tab !== 'chat' && state.tab !== 'noticias'); // tela larga: duas colunas
  drawTopbar();
  nuvemAlinhar(document.getElementById('app'));
  a11y(document.getElementById('app'));
  fabDesvia();
  if (db.prefs.fun && !window.TESTE) setTimeout(funCheck, 0); // conquista nova: aviso com confete
}
// As regras avisam quando os dados mudam sozinhos (telaAtualizar, em util.js): redesenha, salvo com uma folha aberta.
function redesenharSeLivre(sempre){ if (sempre || !sheetOpen()) render(); }
aoAtualizar(redesenharSeLivre);
// Barra fina que aparece no topo quando a tela rola: mantém à vista o nome da aba e, em Gastos, o mês.
function drawTopbar(){
  const mes = state.tab === 'gastos' && state.gsub === 'mes';
  document.getElementById('topbar').innerHTML = `<b>${TABS[state.tab][1]}</b>` + (mes
    ? `<span><button data-onclick="state.month=addMonths(state.month,-1);renderIn()" aria-label="Mês anterior">‹</button><em data-onclick="pickMonth()">${cap(monthName(state.month))}</em><button data-onclick="state.month=addMonths(state.month,1);renderIn()" aria-label="Próximo mês">›</button></span>`
    : state.tab === 'resumo' ? `<span><button data-onclick="resMes(-1)" aria-label="Mês anterior">‹</button><em data-onclick="pickResumo()">${cap(monthName(resumoMes()))}</em><button data-onclick="resMes(1)" aria-label="Próximo mês">›</button></span>` : '');
}
// Leitor de tela e teclado: o que é clicável e não é botão passa a se anunciar como botão; setas ganham nome.
function a11y(root){
  root.querySelectorAll('[data-onclick]:not(button):not(a):not(input)').forEach(e => { e.setAttribute('role', 'button'); e.tabIndex = 0; });
  root.querySelectorAll('button:not([aria-label])').forEach(b => { const t = b.textContent.trim();
    if (t === '‹') b.setAttribute('aria-label', 'Anterior'); else if (t === '›') b.setAttribute('aria-label', 'Próximo'); });
}
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button'){ e.preventDefault(); e.target.click(); }
  // Esc (teclado do computador): fecha a camada de cima, como o "voltar" do Android, mas não troca de aba.
  if (e.key === 'Escape' && fecharMenu(true)){ e.preventDefault(); return; }
  if (e.key === 'Escape'){
    const el = id => document.getElementById(id), camada = !el('lightbox').hidden || !el('dlg').hidden || !el('lockAsk').hidden || pickerOpen() || sheetOpen()
      || (state.tab === 'gastos' && (state.parcDet || state.gsub === 'saude'));
    if (camada && onBack()) e.preventDefault();
  }
});
// Redesenha a tela com a animação de entrada (troca de aba, de mês ou de ano).
function renderIn(){
  state.limit = 60; // a lista de lançamentos volta à primeira página
  render();
  const a = document.getElementById('app');
  a.classList.remove('enter', 'fadeIn'); void a.offsetWidth; a.classList.add(state.tab === 'chat' ? 'fadeIn' : 'enter'); // reinicia a animação
  funCount();
}
// antesChat = a tela de onde o assistente foi aberto: é para ela que o "voltar" do assistente leva.
function go(t){ if (t === 'chat' && state.tab !== 'chat') state.antesChat = state.tab; state.tab = t; state.parcDet = ''; renderIn(); scrollTo(0,0);
  if (t === 'invest') refreshQuotes(); }
const sairChat = () => go(visTabs().includes(state.antesChat) ? state.antesChat : visTabs()[0]);
// Botão "voltar" do Android (chamado pelo APK). Retorna false quando o app deve fechar.
function onBack(){
  if (fecharMenu()) return true;
  // Fecha a camada de cima primeiro: foto ampliada, diálogo, convite do bloqueio, seletor, folha, e só então a aba.
  if (!document.getElementById('lightbox').hidden){ document.getElementById('lightbox').hidden = true; return true; }
  if (!document.getElementById('dlg').hidden){ dlgClose(false); return true; }
  if (!document.getElementById('gate').hidden) return false;
  if (!document.getElementById('lockAsk').hidden){ answerLock(false); return true; }
  if (pickerOpen()){ closePicker(); return true; }
  if (sheetOpen()){ closeForm(); return true; }
  if (state.tab === 'gastos' && state.parcDet){ fecharParc(); return true; } // detalhe de uma parcela: volta para a lista
  if (state.tab === 'gastos' && state.gsub === 'saude'){ fecharSaude(); return true; } // detalhe da saúde financeira: volta para Gastos
  if (state.tab === 'chat'){ sairChat(); return true; }
  if (state.tab !== visTabs()[0]){ go(visTabs()[0]); return true; }
  return false;
}
function goMonth(m){ state.month = m; state.gsub = 'mes'; go('gastos'); }
// Seletores abertos ao tocar no mês e ano (Resumo) ou no mês (Gastos).
// Resumo: o filtro é de mês e ano. state.rmes guarda o mês escolhido e state.year acompanha o ano dele.
const resumoMes = () => state.year + (state.rmes || curYM).slice(4);
function setResumoMes(m){ state.rmes = m; state.year = +m.slice(0, 4); state.dia = 0; }
function resMes(d){ setResumoMes(addMonths(resumoMes(), d)); renderIn(); }
function pickResumo(y = state.year){
  settingsOpen = false; F = null;
  const sel = resumoMes();
  showSheet(`<h3>Escolher mês e ano</h3>
    <div class="plano nav"><button data-onclick="pickResumo(${y - 1})" aria-label="Ano anterior">‹</button><b>${y}</b><button data-onclick="pickResumo(${y + 1})" aria-label="Próximo ano">›</button></div>
    <div class="filters">${MESES.map((n,i) => { const m = ymOf(y, i); return `<button class="btn ${m === sel ? 'primary' : ''}" style="text-transform:capitalize${m === curYM ? ';outline:2px solid var(--brand)' : ''}" data-onclick="setResumoMes('${m}');closeForm();render()">${n.slice(0,3)}</button>`; }).join('')}</div>
    <div class="btns"><button class="btn" data-onclick="setResumoMes(curYM);closeForm();render()">Mês atual</button><button class="btn" data-onclick="closeForm()">Cancelar</button></div>`);
}
function pickMonth(y = +state.month.slice(0, 4)){
  settingsOpen = false; F = null;
  showSheet(`<h3>Escolher mês</h3>
    <div class="plano nav"><button data-onclick="pickMonth(${y - 1})">‹</button><b>${y}</b><button data-onclick="pickMonth(${y + 1})">›</button></div>
    <div class="filters">${MESES.map((n,i) => { const m = ymOf(y, i); return `<button class="btn ${m === state.month ? 'primary' : ''}" style="text-transform:capitalize${m === curYM ? ';outline:2px solid var(--brand)' : ''}" data-onclick="state.month='${m}';closeForm();render()">${n.slice(0,3)}</button>`; }).join('')}</div>
    <div class="btns"><button class="btn" data-onclick="state.month=curYM;closeForm();render()">Mês atual</button><button class="btn" data-onclick="closeForm()">Cancelar</button></div>`);
}

// Na aba Gastos, deslizar o dedo para os lados troca o mês.
// Dentro da lista de lançamentos o gesto é do item (ver abaixo), então a troca de mês vale só fora dela.
let touchX = 0, touchY = 0, touchInList = false;
document.addEventListener('touchstart',
  e => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; touchInList = !!e.target.closest('#expList'); }, {passive:true});
document.addEventListener('touchend', e => {
  // Só troca de mês com a tela de Gastos à mostra: nada por cima (folha, seletor, diálogo, foto, login, convite do bloqueio).
  if (touchInList || state.tab !== 'gastos' || state.gsub !== 'mes' || sheetOpen() || pickerOpen()
    || ['gate', 'dlg', 'lightbox', 'lockAsk'].some(id => !document.getElementById(id).hidden)) return;
  const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 40){ state.month = addMonths(state.month, dx < 0 ? 1 : -1); renderIn(); }
}, {passive:true});

// Deslizar um gasto da lista: para a esquerda exclui (com "Desfazer"); para a direita marca a conta como paga.
// Uma sugestão de gasto no Resumo (data-sug): para a esquerda ignora (com "Desfazer"); para a direita lança.
// Uma notificação da central (data-cent): para qualquer lado, apaga (com "Desfazer").
let sw = null, swipedAt = 0;
document.addEventListener('touchstart', e => {
  const it = e.target.closest ? e.target.closest('.item[data-sw], .item[data-sug], .item[data-cent]') : null;
  sw = it && (it.dataset.sw || it.dataset.sug || it.dataset.cent) ? {it, x:e.touches[0].clientX, y:e.touches[0].clientY, dx:0, on:false} : null;
}, {passive:true});
document.addEventListener('touchmove', e => {
  if (!sw) return;
  const dx = e.touches[0].clientX - sw.x, dy = e.touches[0].clientY - sw.y;
  if (!sw.on){ if (Math.abs(dy) > 12) return void (sw = null); if (Math.abs(dx) < 14) return; sw.on = true; }
  sw.dx = dx;
  sw.it.style.transition = 'none'; sw.it.style.transform = `translateX(${dx}px)`;
  sw.it.classList.toggle('swDel', dx < -90 || (dx > 90 && !!sw.it.dataset.cent));
  sw.it.classList.toggle('swPay', dx > 90 && (sw.it.dataset.bill === '1' || !!sw.it.dataset.sug));
}, {passive:true});
document.addEventListener('touchend', () => {
  if (!sw) return;
  const s = sw; sw = null;
  s.it.style.transition = ''; s.it.style.transform = ''; s.it.classList.remove('swDel', 'swPay');
  if (!s.on) return;
  swipedAt = Date.now();
  if (s.it.dataset.cent){ if (Math.abs(s.dx) > 90) centralApagar(+s.it.dataset.cent); return; }
  if (s.it.dataset.sug){ if (Math.abs(s.dx) > 90) noteDeslizou(+s.it.dataset.sug, s.dx); return; }
  if (s.dx < -90) removeRec('expenses', s.it.dataset.sw);
  else if (s.dx > 90 && s.it.dataset.bill === '1') togglePaid(s.it.dataset.sw, state.month);
}, {passive:true});

// Célula do CSV. Texto que começa com =, +, -, @, tab ou \r vira fórmula ao abrir no Excel ou no Planilhas (CSV
// injection): recebe um ' na frente, que o importador (parseStatement) tira de volta. Números continuam números.
const CSV_FORMULA = /^[=+\-@\t\r]/;
const csvCell = v => typeof v === 'number' ? v.toFixed(2).replace('.', ',') : '"' + (CSV_FORMULA.test(String(v)) ? "'" : '') + String(v).replace(/"/g, '""') + '"';
// Planilha (CSV) com todos os ganhos e gastos do ano da aba Gastos; abre no Excel e no Google Planilhas.
function exportCsv(){
  const y = state.month.slice(0, 4), rows = [['Mês', 'Tipo', 'Descrição', 'Categoria', 'Banco', 'Forma de pagamento', 'Detalhe', 'Valor']];
  for (let i = 0; i < 12; i++){
    const m = ymOf(+y, i);
    for (const x of incomesAll(m)) rows.push([m, 'Ganho', x.desc, (CAT_GANHO[x.cat] || CAT_GANHO.outros)[1], '', '',
      x.fixed === 'y' ? 'anual' : x.fixed ? 'fixo' : 'avulso', x.value]);
    for (const x of expensesAll(m)) rows.push([m, 'Gasto', x.desc, (CAT_GASTO[x.cat] || CAT_GASTO.outros)[1], x.bank || '', PAY[x.pay] || '',
      x.kind === 'installment' ? parcTag(x) : x.fixed === 'y' ? 'anual' : x.fixed ? 'fixo' : 'avulso', x.value]);
  }
  const csv = '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'), name = `financas-${y}.csv`;
  if (temNativo('exportar')) return nativo('exportar', csv, name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = name; a.click();
}
