// Cofrim — Aba Gastos: gastos do mês, busca e filtros, compras parceladas (detalhe, pagar, abater, PDF).
// Depende de dados.js, telas.js e saude.js (saudeBloco).
// Saiu de js/telas.js (só mudou de arquivo); carregado logo depois de saude.js no index.html.

// A aba Gastos tem duas partes: os gastos do mês e as compras parceladas.
const gastosSeg = () => `<div class="seg">${[['mes','Do mês'],['parc','Parceladas'],['vale','Vales']].map(([k,t]) => `<button class="${state.gsub === k ? 'on' : ''}" data-onclick="state.gsub='${k}';state.parcDet='';renderIn()">${t}</button>`).join('')}</div>`;
function viewGastos(){
  if (state.gsub === 'parc') return `${head('Gastos', 'gastos')}${gastosSeg()}${viewParcelas()}`;
  if (state.gsub === 'vale') return `${head('Gastos', 'gastos')}${gastosSeg()}${viewVales('gastos')}`;
  if (state.gsub === 'saude') return viewSaude();
  const m = state.month, list = expensesOf(m), tin = totalIn(m), tout = sum(list, x => x.value);
  const budgets = budgetStatus(m), inv = invoices(m), cmp = compareMonths(m), resPrev = reservaPrevisoes(m); // previsões: só no saldo projetado
  const owed = owedList(); // de qualquer mês
  const uniq = f => [...new Set(list.map(f).filter(Boolean))];
  // Um filtro que não existe neste mês (ex.: depois de trocar de mês) é desfeito, para não esconder tudo sem aviso.
  for (const [k, f] of [['fcat', x => x.cat], ['fbank', x => x.bank], ['fpay', x => x.pay]]) if (state[k] && !list.some(x => f(x) === state[k])) state[k] = '';
  const tags = [...new Set(list.flatMap(tagsOf))];
  if (state.ftag && !tags.includes(state.ftag)) state.ftag = '';
  const sel = (key, label, options) => { filterOpts[key] = [['', 'Todos'], ...options]; const cur = options.find(o => o[0] === state[key]);
    return `<button type="button" class="pickBtn sm ${cur ? 'on' : ''}" data-onclick="pickFilter('${key}','${label}')"><span>${esc(cur ? cur[1] : label)}</span>${I('chev', 14)}</button>`; };
  const B = {
  saude: () => saudeBloco(m),
  previsoes: () => prevBloco(m),
  // O mesmo cartão de destaque das outras abas (Ganhos, Investir, Resumo): o total do mês em cima, o resto embaixo.
  mes: () => `<div class="hero"><small>Gastos em ${monthName(m)}</small>${bigNum(tout)}
    <div class="row"><div><small>Ganhos</small><b>${fmt(tin)}</b></div><div><small>Saldo</small><b>${fmt(tin - tout - resPrev)}</b></div><div><small>Lançamentos</small><b>${list.length}</b></div></div>${resPrev ? `<small class="prevInc">Saldo ${prevInclui(resPrev)}</small>` : ''}</div>`,
  orcamento: () => `<h2>Orçamento do mês <button data-onclick="openForm('budgets', db.budgets)">${budgets.length ? 'Alterar' : 'Definir'}</button></h2>
  ${budgets.length ? `<div class="card">${budgets.map(b => { const c = CAT_GASTO[b.cat] || CAT_GASTO.outros; return `
    <div class="catrow"><div class="top"><span>${catName(c)}</span><b>${fmt(b.used)} de ${fmt(b.lim)}</b></div>${b.extra ? `<div class="hint u-mt2">inclui ${fmt(b.extra)} que sobraram do mês anterior</div>` : ''}
    <div class="bar"><i style="width:${Math.min(b.pct, 100)}%;background:${budgetColor(b.pct)}"></i></div>
    ${b.pct >= 80 ? `<div class="hint" style="margin-top:4px;color:${budgetColor(b.pct)}">${b.pct > 100 ? `Estourou em ${fmt(b.used - b.lim)}` : `${I('alert', 14)} ${Math.round(b.pct)}% do limite usado`}</div>` : ''}</div>`; }).join('')}</div>`
  : vazioParte('Defina um limite mensal por categoria para acompanhar quanto já foi usado.', ['Definir orçamento', "openForm('budgets', db.budgets)"])}`,
  comparativo: () => cmp.length ? `<h2>Comparativo por categoria</h2>
  <div class="card">${cmp.map(r => { const c = CAT_GASTO[r.cat] || CAT_GASTO.outros, d = r.prev ? (r.cur - r.prev) / r.prev * 100 : null; return `
    <div class="catrow"><div class="top"><span>${catName(c)}</span><b>${fmt(r.cur)}</b></div>
    <div class="hint u-mt3">${monthName(addMonths(m, -1)).split(' ')[0]}: ${fmt(r.prev)}${d == null || !Math.round(d) ? '' : ` <b class="${d > 0 ? 'out' : 'in'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d))}%</b>`} · média de 6 meses: ${fmt(r.avg)}</div></div>`; }).join('')}</div>` : '',
  receber: () => owed.length ? `<h2>A receber de gastos divididos</h2>
  <div class="card">${Object.entries(owed.reduce((g, {x}) => (g[x.who] = (g[x.who] || 0) + x.share, g), {})).map(([who, v]) => `<div class="hint" style="margin:0 0 6px">${esc(who)} te deve <b>${fmt(v)}</b></div>`).join('')}
    ${owed.map(({x, m: om}) => `<div class="semCursor item"><div class="mid"><b>${esc(x.desc)}</b><small>${esc(x.who)} · ${monthName(om)}</small></div>
      <div class="val in">${fmt(x.share)}</div><button class="btn" style="flex:none;padding:8px 10px" data-onclick="settle('${x.id}','${om}')">${I('check', 15)}Recebi</button></div>`).join('')}</div>` : '',
  // Gastos avulsos que se repetem todo mês (recorrentes): virar fixo ou dizer que não é. Some quando não há nenhum.
  recorrentes: () => { const rs = recorrentes(); return rs.length ? `<h2>Parecem gastos fixos</h2><div class="card">${rs.slice(0, 5).map(r => `
    <div class="item semCursor">${ico(CAT_GASTO[r.ult.cat] || CAT_GASTO.outros)}<div class="mid"><b>${esc(r.ult.desc)}</b>
      <small>${r.meses} dos últimos 6 meses · cerca de ${fmt(r.valor)}${r.dia ? ' · dia ' + r.dia : ''}</small></div></div>
    <div class="btns semTopo recorrBtns"><button class="btn" data-onclick="recorrIgnorar('${r.k}')">Não é fixo</button>
      <button class="btn primary" data-onclick="recorrFixar('${r.k}')">Virar fixo</button></div>`).join('')}</div>` : ''; },
  // Contas bancárias (antes no Resumo): saldo de hoje e no fim do mês, transferências.
  contas: () => `<h2>Contas <span>${db.accounts.length > 1 ? `<button data-onclick="openForm('transfers')">Transferir</button> · ` : ''}
    <button data-onclick="openForm('accounts')">+ Conta</button></span></h2>
  ${db.accounts.length ? `<div class="card">${db.accounts.map(a => { const b = accountBalance(a); return `
    <div class="item" data-onclick="edit('accounts','${a.id}')">${bancoSelo(a.name)}<div class="mid"><b>${esc(a.name)}</b>
      <small>saldo de hoje · fim do mês: ${fmt(accountBalance(a, monthEnd(curYM)))}${bySmall(a)}</small></div>
      <div class="val ${b < 0 ? 'out' : ''}">${fmt(b)}</div></div>`; }).join('')}
    <div class="semCursor item"><div class="mid"><b>Total nas contas</b></div><div class="val">${fmt(sum(db.accounts, accountBalance))}</div></div></div>
    ${db.transfers.length ? `<div class="card"><b>Transferências</b>${[...db.transfers].sort((a,b) => b.month.localeCompare(a.month)).slice(0, 5).map(t => `
    <div class="item" data-onclick="edit('transfers','${t.id}')"><div class="mid"><b class="u-peso5">${esc(t.from)} → ${esc(t.to)}</b>
      <small>${monthName(t.month)}${bySmall(t)}</small></div><div class="val">${fmt(t.value)}</div></div>`).join('')}</div>` : ''}`
  : vazioParte('Cadastre suas contas para acompanhar o saldo de cada uma.', ['+ Cadastrar conta', "openForm('accounts')"])}`,
  faturas: () => inv.length ? `<h2>Faturas do cartão <button data-onclick="openForm('cardClose', db.cardClose)">Configurar cartões</button></h2>
  <div class="card">${inv.map(([bank, v]) => `<div class="semCursor item">${bancoSelo(bank)}<div class="mid"><b>${esc(bank)}</b>
    ${[db.cardClose[bank] ? 'Fecha no dia ' + db.cardClose[bank] : 'Sem dia de fechamento definido',
      db.cardLimit[bank] && 'Limite: ' + fmt(db.cardLimit[bank]),
      db.cardLimit[bank] && `Comprometido: ${fmt(cardUsed(bank))} (${Math.round(cardUsed(bank) / db.cardLimit[bank] * 100)}%)`,
      db.accounts.length && cardAccount(bank) && 'Paga pela conta ' + esc(cardAccount(bank))].filter(Boolean).map(t => `<small class="u-bloco">${t}</small>`).join('')}
    ${db.accounts.length && !cardAccount(bank) ? `<small class="warn u-bloco">${I('alert', 13)} Escolha a conta que paga esta fatura; sem isso ela não é descontada de nenhuma conta.</small>` : ''}</div><div class="val out">${fmt(v)}</div></div>`).join('')}
    ${inv.some(([bank]) => db.accounts.length && !cardAccount(bank)) ? `<div class="btns"><button class="btn primary" data-onclick="openForm('cardClose', db.cardClose)">Escolher a conta que paga</button></div>` : ''}</div>` : '',
  lancamentos: () => `<h2>Lançamentos <span>${ordemBtn()} · <button data-onclick="openGrpOrder()">Grupos</button></span></h2>
  <div class="card" style="padding:12px">
    <div class="search">${I('search')}<input id="q" type="text" placeholder="Buscar por descrição" value="${esc(state.q)}" autocomplete="off" data-oninput="state.q=this.value;this.nextElementSibling.hidden=!this.value;drawExpList()"><button type="button" class="iconbtn" ${state.q ? '' : 'hidden'} data-onclick="clearSearch()" aria-label="Limpar busca">${I('close')}</button></div>
    <div class="filters">
      ${sel('fcat', 'Categoria', uniq(x => x.cat).map(k => [k, (CAT_GASTO[k] || CAT_GASTO.outros)[1]]))}
      ${sel('fbank', 'Banco', uniq(x => x.bank).map(b => [b, b]))}
      ${sel('fpay', 'Pagamento', uniq(x => x.pay).map(p => [p, PAY[p] || p]))}
      ${tags.length ? sel('ftag', 'Etiqueta', tags.map(t => [t, '#' + t])) : ''}
    </div>
    <button type="button" class="moreBtn" style="margin-top:10px;padding:10px" data-onclick="openSearch()">${I('search', 16)}Buscar em todos os meses</button>
  </div>
  <div id="expList">${expListHtml()}</div>`,
  acoes: () => `<div class="btns"><button class="btn" data-onclick="openStatementHelp()">${I('upload')}Importar extrato</button></div>
  <div class="btns"><button class="btn" data-onclick="shown(printReport)">${I('doc')}Relatório (PDF)</button></div>
  <div class="btns"><button class="btn" data-onclick="openSheetLink()">${I('doc')}${sheetId() ? 'Planilha do Google (ligada)' : 'Ligar uma planilha do Google'}</button></div>
  <div class="btns"><button class="btn" data-onclick="shown(exportPlanilha)">${I('download')}Exportar planilha de ${m.slice(0,4)} (Excel)</button></div>
  <div class="btns u-mb12"><button class="cresce btn danger" data-onclick="openApagar('gastos')">${I('trash')}Apagar gastos por dia, mês ou ano</button></div>`
  };
  return `${head('Gastos', 'gastos')}${gastosSeg()}
  ${navMes()}
  ${archBanner(m.slice(0, 4))}${blocks('gastos', B)}
  <div class="hint u-centro">Deslize a tela para os lados para trocar de mês. Num lançamento, deslize para a esquerda para excluir e, numa conta com vencimento, para a direita para marcar como paga.</div>`;
}
// Lista de lançamentos do mês com busca e filtros, em grupos (GRUPOS: assinaturas, fixos e anuais, parceladas e ocasionais),
// na ordem escolhida em db.prefs.grpOrder. A busca e os filtros valem para todos. Fica separada da tela para o campo
// de busca não perder o foco.
function expListHtml(){
  const m = state.month, all = expensesOf(m), q = plain(state.q.trim());
  const list = all.filter(x => (!q || plain(x.desc + ' ' + (x.tags || '') + ' ' + (x.by || '')).includes(q)) && (!state.fcat || x.cat === state.fcat) && (!state.fbank || x.bank === state.fbank) && (!state.fpay || x.pay === state.fpay) && (!state.ftag || tagsOf(x).includes(state.ftag)));
  if (!all.length) return empty('receipt', 'Nenhum gasto em ' + monthName(m) + '.', ['+ Adicionar gasto', "openForm('expenses')"]);
  if (!list.length) return empty('search','Nenhum lançamento com esses filtros.');
  const filt = q || state.fcat || state.fbank || state.fpay || state.ftag, open = state.gopen || (state.gopen = {});
  // Dentro de cada grupo, pela data: mais recente ou mais antigo primeiro (db.prefs.ordem); os sem dia ficam no fim.
  // Quando dois não têm dia (contas fixas sem vencimento, parcelas), vale o mês em que começaram e, por fim, quando
  // foram lançados: assim o botão sempre inverte a lista, mesmo num mês só de contas fixas.
  const sinal = db.prefs.ordem === 'ant' ? -1 : 1, quando = x => [diaDe(x, m), x.start || '', x.u || 0];
  const porDia = l => [...l].sort((a, b) => { const qa = quando(a), qb = quando(b), i = qa.findIndex((v, j) => v !== qb[j]);
    return i < 0 ? 0 : sinal * (qb[i] > qa[i] ? 1 : -1); });
  const gs = db.prefs.grpOrder.map(k => [k, GRUPOS[k][0], porDia(list.filter(GRUPOS[k][1]))]);
  // Todos os grupos começam abertos; tocar no título fecha (fica só o total). Numa busca ou filtro, todo grupo com resultado abre.
  return gs.map(([k, t, g]) => { if (!g.length) return ''; const on = filt ? true : open[k] ?? true; return `
    <button type="button" class="grpHead ${on ? 'on' : ''}" ${filt ? 'disabled' : `data-onclick="state.gopen.${k}=${!on};drawExpList()"`} aria-expanded="${on}"><b>${t}</b><small>${g.length} · ${fmt(sum(g, x => x.value))}</small>${filt ? '' : I('chev', 16)}</button>
    ${on ? `<div class="card">${(k === 'avu' ? g.slice(0, state.limit) : g).map(x => expRow(x, m)).join('')}</div>
    ${k === 'avu' && g.length > state.limit ? `<button type="button" class="moreBtn" style="margin:0 0 12px" data-onclick="state.limit+=60;drawExpList()">Mostrar mais ${Math.min(60, g.length - state.limit)} de ${g.length - state.limit} restantes</button>` : ''}` : ''}`; }).join('')
    + (list.length < all.length ? `<div class="hint" style="text-align:center;margin-bottom:12px">${list.length} de ${all.length} lançamentos · ${fmt(sum(list, x => x.value))}</div>` : '');
}
// Uma linha da lista de lançamentos do mês m.
function expRow(x, m){ const c = CAT_GASTO[x.cat] || CAT_GASTO.outros, inst = x.kind === 'installment', bill = !inst && x.fixed && x.due,
  paid = bill && isPaid(x, m); return `
    <div class="item" ${inst ? '' : `data-sw="${x.id}" data-bill="${bill ? 1 : ''}"`} data-onclick="edit('${inst ? 'installments' : 'expenses'}','${x.id}')">${ico(c)}<div class="mid"><b>${esc(x.desc)}</b>
    <small>${esc(c[1])}${whereLabel(x)}${x.emp ? `<span class="tag">${esc(x.emp)}</span>` : ''}${inst ? `<span class="tag">${parcTag(x)}${x.paid ? ' paga' : ''}</span>` : x.fixed ? `<span class="tag">${repete(x) ? repTexto(x) : x.fixed === 'y' ? 'anual' : isSub(x) ? 'assinatura' : 'fixo'}</span>` : x.day ? `<span class="tag">dia ${x.day}</span>` : ''}${bill ? `<span class="tag">${paid ? 'pago' : 'vence dia ' + dueDay(x, m)}</span>` : ''}${tagsOf(x).map(t => `<span class="tag">#${esc(t)}</span>`).join('')}${x.share ? `<span class="tag">dividido com ${esc(x.who)}${x.got ? ', recebido' : ''}</span>` : ''}${x.photo ? `<span class="tag">${I('doc', 11)} comprovante</span>` : ''}${byTag(x)}</small></div>
    <div class="val out">${fmt(x.value)}</div>${bill ? `<button class="iconbtn ${paid ? 'in' : 'muted'}" data-onclick="togglePaid('${x.id}','${m}')" aria-label="Marcar como pago">${I(paid ? 'checked' : 'unchecked', 24)}</button>` : ''}</div>`; }
// Busca em todos os meses: ganhos, gastos e compras parceladas, pela descrição, etiqueta ou banco.
let searchHits = [];
function searchAll(q){
  q = plain(String(q).trim());
  if (q.length < 2) return [];
  const hit = (col, x) => plain([x.desc, x.tags, x.bank, x.who].filter(Boolean).join(' ')).includes(q) ? [{col, x}] : [];
  return [...db.expenses.flatMap(x => hit('expenses', x)), ...db.installments.flatMap(x => hit('installments', x)),
    ...db.incomes.flatMap(x => hit('incomes', x))]
    .sort((a, b) => (b.x.start || '').localeCompare(a.x.start || '')).slice(0, 80);
}
function openSearch(){
  settingsOpen = false; F = null;
  showSheet(`<h3>Buscar em todos os meses</h3>
    <div class="search">${I('search')}<input id="qAll" type="text" placeholder="Descrição, etiqueta ou banco" autocomplete="off" data-oninput="drawSearch()"></div>
    <div id="searchOut"></div>
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
  drawSearch();
  document.getElementById('qAll').focus();
}
function drawSearch(){
  const q = document.getElementById('qAll').value;
  searchHits = searchAll(q);
  document.getElementById('searchOut').innerHTML = q.trim().length < 2 ? '<div class="hint">Digite pelo menos duas letras.</div>'
    : !searchHits.length ? '<div class="hint">Nada encontrado.</div>'
    : searchHits.map(({col, x}, i) => `<div class="item" data-onclick="openHit(${i})"><div class="mid"><b>${esc(x.desc)}</b>
        <small>${COL_NAMES[col]} · ${x.fixed ? 'desde ' : ''}${cap(monthName(x.start))}${x.bank ? ' · ' + esc(x.bank) : ''}${tagsOf(x).map(t => ' · #' + esc(t)).join('')}</small></div>
        <div class="val ${col === 'incomes' ? 'in' : 'out'}">${fmt(col === 'installments' ? x.total : x.value)}</div></div>`).join('');
}
function openHit(i){ const h = searchHits[i]; if (h.col === 'expenses' && !h.x.fixed) state.month = h.x.start; openForm(h.col, h.x); }
const filterOpts = {};
function pickFilter(key, label){ pickList(label, filterOpts[key], state[key], v => { state[key] = v; render(); }, false, key === 'fbank' && bancoMini); }
function clearSearch(){ const i = document.getElementById('q'); state.q = i.value = ''; i.nextElementSibling.hidden = true; drawExpList(); i.focus(); }
function drawExpList(){ const el = document.getElementById('expList'); if (el) el.innerHTML = expListHtml(); }

// Parceladas: lista (financiamentos e empréstimos primeiro) e, com state.parcDet, a tela de detalhe de um deles.
function viewParcelas(){
  const det = state.parcDet && db.installments.find(p => p.id === state.parcDet);
  if (det) return viewParcDet(det);
  state.parcDet = '';
  const ps = db.installments, fins = ps.filter(isFin), compras = ps.filter(p => !isFin(p));
  const falta = sum(ps, parcFalta), pago = sum(ps, p => parcPago(p) + abatido(p));
  return `
  <div class="hero"><small>Falta pagar</small>${bigNum(falta)}
    <div class="row"><div><small>Valor total</small><b>${fmt(falta + pago)}</b></div><div><small>Já pago</small><b>${fmt(pago)}</b></div></div></div>
  ${fins.length ? `<h2>Financiamentos e empréstimos</h2><div class="card">${fins.map(parcItem).join('')}</div>` : ''}
  ${compras.length ? `${fins.length ? '<h2>Compras parceladas</h2>' : ''}<div class="card">${compras.map(parcItem).join('')}</div>` : ''}
  ${ps.length ? '<div class="hint u-centro">A contagem avança sozinha quando o mês vira: as parcelas dos meses que já passaram contam como pagas. Toque num item para ver as parcelas.</div>'
    : empty('card', 'Nenhuma compra parcelada, financiamento ou empréstimo.<br>As parcelas entram sozinhas nos gastos de cada mês.',
      ['+ Compra parcelada', "openForm('installments')"])}`;
}
// Um item da lista: nome, credor (ou banco e pagamento), "parcela X de N", valor da parcela, próximo vencimento e a barra.
function parcItem(p){
  const c = CAT_GASTO[p.cat] || CAT_GASTO.outros, done = p.paid >= p.n, j = Math.min(p.paid, p.n - 1);
  const onde = isFin(p) ? esc(p.credor || PARC_TIPOS[p.tipo]) : esc(c[1]) + whereLabel(p);
  return `<div class="item" data-onclick="abrirParc('${p.id}')">${ico(c)}<div class="mid"><b>${esc(p.desc)}</b>
      <small class="u-bloco">${onde}${bySmall(p)}</small>
      <small class="u-bloco">${done ? 'quitado' : `parcela ${p.paid + 1} de ${p.n} · vence ${vencTxt(parcVenc(p, p.paid))}`}</small>
      <div class="bar" style="margin:6px 0 0;height:6px"><i style="width:${p.paid / p.n * 100}%"></i></div></div>
    <div class="val ${done ? 'in' : 'out'}">${fmt(parcVal(p, j))}</div></div>`;
}
function abrirParc(id){ state.parcDet = id; state.parcTodas = false; state.parcPagas = false; renderIn(); scrollTo(0, 0); }
function fecharParc(){ state.parcDet = ''; renderIn(); }
// Tela de detalhe: topo com o saldo devedor e o progresso, a próxima parcela, o que já foi pago e todas as parcelas
// (geradas na hora: nada é gravado por parcela).
function viewParcDet(p){
  const c = CAT_GASTO[p.cat] || CAT_GASTO.outros, fin = isFin(p), n = p.n, pagas = Math.min(p.paid, n), rest = n - pagas;
  const saldo = saldoDevedor(p), linhas = parcLinhas(p), prox = rest ? linhas[pagas] : null;
  const onde = fin ? [p.credor && esc(p.credor),
    (p.conta ? `debita na ${esc(p.conta)} · ` : '') + esc(c[1])] : [[p.bank && esc(p.bank), PAY[p.pay], esc(c[1])].filter(Boolean).join(' · ')];
  const progresso = n <= 36 ? `<div class="segs">${linhas.map(l => `<i class="${l.st === 'paga' ? 'on' : ''}"></i>`).join('')}</div>`
    : `<div class="bar" style="background:rgba(255,255,255,.25)"><i style="width:${pagas / n * 100}%;background:#fff"></i></div>`;
  const venc = linhas.filter(l => l.st === 'vencida'), aVencer = linhas.filter(l => l.st === 'avencer');
  const pagasL = [...linhas.filter(l => l.st === 'paga').map(l => ({...l, ord:(vencData(l.v) || l.v.ym + '-28') + String(l.j).padStart(4, '0')})),
    ...(p.ab || []).map((a, k) => ({ab:a, ord:a.d + 'z' + k}))].sort((a, b) => b.ord.localeCompare(a.ord));
  const quando = l => l.dias < 0 ? `vencida há ${plural(-l.dias, 'dia', 'dias')}` : l.dias === 0 ? 'vence hoje' : `vence em ${plural(l.dias, 'dia', 'dias')}`;
  const linha = l => { const paga = l.st === 'paga', vencida = l.st === 'vencida';
    return `<div class="item parcRow" data-onclick="tocarParc('${p.id}',${l.j})"><span class="stIco ${l.st}">${I(paga ? 'check' : vencida ? 'alert' : 'clock', 16)}</span>${ico(c)}
      <div class="mid"><b>${esc(p.desc)}</b><small>Parcela ${l.j + 1}/${n}${fin ? (p.conta ? ' · ' + esc(p.conta) : '') : PAY[p.pay] ? ' · ' + PAY[p.pay] : p.bank ? ' · ' + esc(p.bank) : ''}</small></div>
      <div class="val ${paga ? 'in' : 'out'}"><small class="${vencida ? 'out' : ''}">${l.j + 1}/${n} · ${vencTxt(l.v)}</small>${fmt(l.val)}</div></div>`; };
  const linhaAb = a => `<div class="semCursor item parcRow"><span class="stIco paga">${I('coins', 16)}</span>${ico(c)}
      <div class="mid"><b>Abatimento</b><small>${fmtDate(a.d)} · ${a.modo === 'parcela' ? 'reduziu a parcela' : 'reduziu o prazo'}</small></div>
      <div class="val in"><small>${fmtDate(a.d)}</small>${fmt(a.v)}</div></div>`;
  const verAV = state.parcTodas ? aVencer : aVencer.slice(0, 12), verPg = pagasL.length <= 3 || state.parcPagas;
  const pend = venc.length + aVencer.length, concl = pagasL.length;
  return `
  <div class="detTop"><button class="btn" data-onclick="fecharParc()">‹ Parceladas</button><button class="iconbtn" data-onclick="parcMenu('${p.id}')" aria-label="Opções">⋯</button></div>
  <div class="hero">
    <b style="font-size:19px;display:block">${esc(p.desc)}</b>
    ${onde.filter(Boolean).map(t => `<small>${t}</small>`).join('')}
    <small class="u-mt12">Saldo devedor hoje</small>${bigNum(saldo)}
    ${p.taxa && rest ? '<small>Valor aproximado; o valor oficial é o informado pelo banco.</small>' : ''}
    ${progresso}
    <div class="row ponta"><small>${plural(pagas, 'paga', 'pagas')}</small><small>${rest ? `${plural(rest, 'restante', 'restantes')} · até ${MESES[+addMonths(p.start, n - 1).slice(5) - 1].slice(0, 3)}/${addMonths(p.start, n - 1).slice(0, 4)}` : 'quitado'}</small></div>
  </div>
  <div class="grid2">
    <div class="card u-m0">${prox ? `<small class="muted">Parcela ${prox.j + 1} de ${n}</small><b style="display:block;font-size:18px">${fmt(prox.val)}</b>
      <small class="${prox.dias < 0 ? 'out' : 'muted'} u-bloco">${vencTxt(prox.v)} · ${quando(prox)}</small>
      <div class="btns"><button class="btn primary" data-onclick="pagarParc('${p.id}',1)">${I('check', 16)}Pagar</button></div>`
      : `<small class="muted">Próxima parcela</small><b style="display:block;font-size:18px" class="in">Quitado</b>`}</div>
    <div class="card u-m0"><small class="muted">Já pago</small><b style="display:block;font-size:18px" class="in">${fmt(parcPago(p) + abatido(p))}</b>
      <small class="muted u-bloco">${plural(pagas, 'parcela', 'parcelas')}${p.ab ? ' e ' + plural(p.ab.length, 'abatimento', 'abatimentos') : ''}</small>
      ${fin && rest ? `<div class="btns"><button class="btn" data-onclick="openAbater('${p.id}')">${I('coins', 16)}Abater</button></div>` : ''}</div>
  </div>
  <h2 class="u-bloco">Lançamentos<small style="display:block;text-transform:none;letter-spacing:0;font-weight:400;margin-top:2px">${plural(pend, 'pendente', 'pendentes')} · ${plural(concl, 'concluída', 'concluídas')}</small></h2>
  <div class="card">
    ${venc.length ? `<div class="pGrp out">VENCIDAS</div>${venc.map(linha).join('')}` : ''}
    ${aVencer.length ? `<div class="pGrp">A VENCER</div>${verAV.map(linha).join('')}
      ${aVencer.length > verAV.length ? `<div class="btns"><button class="btn" data-onclick="state.parcTodas=true;render()">Ver todas (${aVencer.length})</button></div>` : ''}` : ''}
    ${pagasL.length ? `<div class="pGrp">PAGAS</div>${verPg ? pagasL.map(l => l.ab ? linhaAb(l.ab) : linha(l)).join('')
      : `<div class="btns"><button class="btn" data-onclick="state.parcPagas=true;render()">Ver pagas (${pagasL.length})</button></div>`}` : ''}
  </div>`;
}
// Tocar numa parcela: a próxima pode ser marcada como paga; a última paga pode ser desfeita. Sempre em ordem.
async function tocarParc(id, j){
  const p = db.installments.find(x => x.id === id);
  if (!p) return;
  if (j < p.paid){
    if (j !== p.paid - 1) return tell(`Para desfazer, comece pela última parcela paga (${p.paid}/${p.n}).`);
    if (await ask(`Desfazer o pagamento da parcela ${j + 1}/${p.n}?`, 'Desfazer pagamento')) pagarParc(id, -1);
    return;
  }
  if (j !== p.paid) return tell(`Pague primeiro a parcela ${p.paid + 1}/${p.n}.`);
  if (await ask(`Marcar parcela ${j + 1}/${p.n} como paga?`, 'Marcar como paga')) pagarParc(id, 1);
}
// Pagar (d = 1) ou desfazer (d = −1) a próxima parcela. Só muda o status: a parcela já está nos gastos do mês dela.
function pagarParc(id, d){
  const p = db.installments.find(x => x.id === id);
  if (!p) return;
  const antes = p.paid;
  p.paid = Math.max(0, Math.min(p.n, p.paid + d));
  if (p.paid === antes) return;
  touch(p); save(); render();
  showUndo(d > 0 ? `Parcela ${p.paid}/${p.n} paga` : 'Pagamento desfeito', () => { p.paid = antes; touch(p); save(); render(); },
    {dest:{k:'gastos', sub:'parc'}});
}
function parcMenu(id){
  pickList('Opções', [['editar', 'Editar'], ['pdf', 'Exportar PDF'], ['excluir', 'Excluir']], null, async v => {
    const p = db.installments.find(x => x.id === id);
    if (!p) return;
    if (v === 'editar') openForm('installments', p);
    else if (v === 'pdf') parcPdf(id);
    else if (v === 'excluir' && await ask(`Excluir "${p.desc}"?\nAs parcelas saem também dos gastos de cada mês.`, 'Excluir',
      true)){ state.parcDet = ''; removeRec('installments', id); }
  });
}
// Abater (amortização antecipada): valor e o que diminuir, com a prévia do resultado antes de confirmar.
const abat = {id:'', modo:'prazo'};
function openAbater(id){
  const p = db.installments.find(x => x.id === id);
  if (!p) return;
  settingsOpen = false; F = null; abat.id = id;
  showSheet(`<h3>Abater</h3>
    <div class="semTopo hint">${esc(p.desc)} · saldo devedor hoje ${fmt(saldoDevedor(p))}${p.taxa ? ' (aproximado)' : ''}.</div>
    <label for="abV">Valor do abatimento</label>
    <div class="bigVal out"><span>${esc(moeda.simbolo)}</span><input id="abV" type="text" inputmode="numeric" placeholder="${moneyStr(0)}" autocomplete="off" data-oninput="this.value=centsMask(this.value);drawAbater()"></div>
    <label>O que diminuir</label><div class="optPick" id="abModo"></div>
    <div class="hint" id="abOut"></div>
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button><button class="btn primary" data-onclick="confirmarAbater()">Abater</button></div>`);
  drawAbater();
}
function drawAbater(){
  const p = db.installments.find(x => x.id === abat.id), A = parseMoney(document.getElementById('abV').value) || 0;
  document.getElementById('abModo').innerHTML = [['prazo', 'Reduzir o prazo'], ['parcela', 'Reduzir o valor da parcela']].map(([k, t]) =>
    `<button type="button" class="${abat.modo === k ? 'on' : ''}" data-onclick="abat.modo='${k}';drawAbater()">${t}</button>`).join('');
  const S = saldoDevedor(p), c = A > 0 && A < S - .005 && abaterCalc(p, A, abat.modo);
  document.getElementById('abOut').textContent = !A ? 'Digite o valor que você vai pagar a mais.' : !c ? `O abatimento precisa ser menor que o saldo devedor (${fmt(S)}). Para quitar, marque as parcelas restantes como pagas.`
    : `Novo saldo: ${fmt(c.saldo)} · parcelas restantes: ${c.r} · parcela: ${fmt(c.parc)} (valores aproximados)`;
}
function confirmarAbater(){
  const p = db.installments.find(x => x.id === abat.id), A = parseMoney(document.getElementById('abV').value) || 0;
  if (!p || !(A > 0) || A >= saldoDevedor(p) - .005) return drawAbater();
  const antes = JSON.stringify(db);
  abater(p, A, abat.modo, now.toLocaleDateString('sv'));
  save(); closeForm(); render();
  showUndo('Abatimento registrado', () => restoreSnap(antes), {dest:{k:'gastos', sub:'parc'}});
}
// PDF de um parcelamento: pela tela de impressão (no Android, "Salvar como PDF"), como o relatório do mês.
function parcPdf(id){
  const p = db.installments.find(x => x.id === id);
  if (!p) return;
  const c = CAT_GASTO[p.cat] || CAT_GASTO.outros, linhas = parcLinhas(p), fin = isFin(p);
  const table = (head, rows) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</table>`;
  const sit = {paga:'paga', vencida:'vencida', avencer:'a vencer'};
  const dados = [['Tipo', fin ? PARC_TIPOS[p.tipo] : 'Compra parcelada'], fin && ['Credor', esc(p.credor || '')],
    fin && ['Conta de débito', esc(p.conta || '')],
    !fin && ['Banco / pagamento', [p.bank && esc(p.bank), PAY[p.pay]].filter(Boolean).join(' · ')], ['Categoria', esc(c[1])],
    ['Parcelas', `${p.n} (${Math.min(p.paid, p.n)} pagas)`],
    ['Valor da próxima parcela', p.paid < p.n ? fmt(parcVal(p, p.paid)) : 'quitado'],
    p.taxa && ['Taxa de juros', String(p.taxa).replace('.', ',') + '% ao mês'],
    ['Primeira e última parcela', `${monthName(p.start)} a ${monthName(addMonths(p.start, p.n - 1))}`],
    p.due && ['Dia do vencimento', 'dia ' + p.due]].filter(Boolean);
  const pg = linhas.filter(l => l.st === 'paga'), av = linhas.filter(l => l.st !== 'paga');
  document.getElementById('report').innerHTML = `
    <div class="capa"><h1>${esc(p.desc)}</h1><small>Cofrim${myName() ? ' · ' + esc(myName()) : ''} · gerado em ${now.toLocaleDateString('pt-BR')}</small></div>
    <div class="boxes"><div class="out"><small>Saldo devedor${p.taxa ? ' (aproximado)' : ''}</small><b>${fmt(saldoDevedor(p))}</b></div><div class="in"><small>Já pago</small><b>${fmt(parcPago(p) + abatido(p))}</b></div><div><small>Parcelas restantes</small><b>${p.n - Math.min(p.paid, p.n)}</b></div></div>
    <h2>Dados</h2>${table(['', ''], dados)}
    <h2>Parcelas a vencer</h2>${av.length ? table(['Parcela', 'Vencimento', 'Situação', 'Valor'],
      av.map(l => [`${l.j + 1}/${p.n}`, vencTxt(l.v), sit[l.st], fmt(l.val)])) : '<small>Nenhuma.</small>'}
    <h2>Parcelas pagas</h2>${pg.length ? table(['Parcela', 'Vencimento', 'Valor'],
      pg.map(l => [`${l.j + 1}/${p.n}`, vencTxt(l.v), fmt(l.val)])) : '<small>Nenhuma.</small>'}
    ${p.ab ? `<h2>Abatimentos</h2>${table(['Data', 'Efeito', 'Valor'], p.ab.map(a => [fmtDate(a.d), a.modo === 'parcela' ? 'reduziu a parcela' : 'reduziu o prazo', fmt(a.v)]))}` : ''}
    <div class="rodape">Gerado pelo app Cofrim${p.taxa ? '. Saldo devedor calculado pela tabela Price; o valor oficial é o informado pelo banco.' : ''}</div>`;
  const name = 'parcelas-' + plain(p.desc).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  tr(document.getElementById('report')); // no idioma do app já na hora de imprimir (a troca automática viria depois)
  if (temNativo('imprimir')) nativo('imprimir', name); else window.print();
}

// Gasto que se repete vira fixo: começa neste mês ou, se ele já foi lançado neste mês, no próximo (sem contar duas vezes).
// Os avulsos dos meses de antes ficam como estão.
function recorrFixar(k){
  const r = recorrentes().find(x => x.k === k); if (!r) return render();
  const jaEsteMes = db.expenses.some(x => !x.fixed && x.start === curYM && recorrChave(x.desc) === k), u = r.ult;
  const rec = touch({id:uid(), desc:u.desc, cat:u.cat, value:r.valor, fixed:true, start:jaEsteMes ? addMonths(curYM, 1) : curYM, end:'',
    due:r.dia || '', bank:u.bank || '', pay:u.pay || ''});
  db.expenses.push(rec); save(); render();
  showUndo(`${u.desc} agora é um gasto fixo`, () => {
    db.expenses = db.expenses.filter(x => x.id !== rec.id); db.tomb[rec.id] = Date.now(); save(); render(); });
}
function recorrIgnorar(k){
  db.prefs.recorrIgnorados = [...(db.prefs.recorrIgnorados || []), k]; db.cfgMod = Date.now(); save(); render();
  showUndo('Não vai mais aparecer como gasto fixo', () => { db.prefs.recorrIgnorados = db.prefs.recorrIgnorados.filter(x => x !== k); save(); render(); });
}
