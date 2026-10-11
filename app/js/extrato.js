// Cofrim — Relatório do mês em PDF e importar extrato do banco (OFX ou CSV). Depende de dados.js e formularios.js.
// Saiu de js/assistente.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Relatório do mês (PDF) ----------
// Monta o relatório em #report e manda imprimir; na tela de impressão do Android escolhe-se "Salvar como PDF".
function printReport(){
  const m = state.month, ins = incomesOf(m), outs = expensesOf(m), tin = sum(ins, x => x.value), tout = sum(outs, x => x.value);
  const table = (head, rows, total) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
    ${total != null ? `<tr class="sum"><td colspan="${head.length - 1}">Total</td><td>${fmt(total)}</td></tr>` : ''}</table>`;
  const kind = x => x.kind === 'installment' ? parcTag(x) : x.fixed === 'y' ? 'anual' : x.fixed ? 'fixo' : x.day ? 'dia ' + x.day : 'avulso';
  const cats = topBy(outs, x => (CAT_GASTO[x.cat] || CAT_GASTO.outros)[1], 99), budgets = budgetStatus(m), inv = invoices(m);
  const title = monthName(m);
  document.getElementById('report').innerHTML = `
    <div class="capa"><h1>Relatório de ${title.replace(' ', ' de ')}</h1>
    <small>Cofrim${myName() ? ' · ' + esc(myName()) : ''} · gerado em ${now.toLocaleDateString('pt-BR')}</small></div>
    <div class="boxes"><div class="in"><small>Ganhos</small><b>${fmt(tin)}</b></div><div class="out"><small>Gastos</small><b>${fmt(tout)}</b></div><div class="${tin - tout < 0 ? 'out' : 'in'}"><small>Saldo</small><b>${fmt(tin - tout)}</b></div></div>
    <h2>Gastos por categoria</h2>${cats.length ? table(['Categoria', '% do total', 'Valor'],
      cats.map(([n, v]) => [esc(n), Math.round(v / tout * 100) + '%', fmt(v)]), tout) : '<small>Nenhum gasto.</small>'}
    ${budgets.length ? `<h2>Orçamento</h2>${table(['Categoria', 'Limite', 'Usado'], budgets.map(b => [esc((CAT_GASTO[b.cat] || CAT_GASTO.outros)[1]), fmt(b.lim), `${fmt(b.used)} (${Math.round(b.pct)}%)`]))}` : ''}
    ${inv.length ? `<h2>Faturas do cartão</h2>${table(['Banco', 'Valor'], inv.map(([b, v]) => [esc(b), fmt(v)]), sum(inv, x => x[1]))}` : ''}
    <h2>Ganhos</h2>${ins.length ? table(['Descrição', 'Categoria', 'Valor'],
      ins.map(x => [esc(x.desc), esc((CAT_GANHO[x.cat] || CAT_GANHO.outros)[1]), fmt(x.value)]), tin) : '<small>Nenhum ganho.</small>'}
    <h2>Gastos</h2>${outs.length ? table(['Descrição', 'Categoria', 'Banco / pagamento', 'Tipo', 'Valor'],
      outs.map(x => [esc(x.desc), esc((CAT_GASTO[x.cat] || CAT_GASTO.outros)[1]), [x.bank && esc(x.bank), PAY[x.pay]].filter(Boolean).join(' · '),
      kind(x), fmt(x.value)]), tout) : '<small>Nenhum gasto.</small>'}
    ${db.accounts.length && m === curYM ? `<h2>Saldo das contas hoje</h2>${table(['Conta', 'Saldo'], db.accounts.map(a => [esc(a.name), fmt(accountBalance(a))]), sum(db.accounts, accountBalance))}` : ''}
    ${db.investments.length && m === curYM ? `<h2>Investimentos hoje</h2>${table(['Investimento', 'Valor'], db.investments.map(v => [esc(v.name), fmt(v.value)]), sum(db.investments, v => v.value))}` : ''}
    <div class="rodape">Relatório gerado pelo app Cofrim</div>`;
  const name = 'relatorio-' + m;
  if (temNativo('imprimir')) nativo('imprimir', name); else window.print();
}

// ---------- Importar extrato do banco (OFX ou CSV) ----------
// Palavras comuns na descrição → categoria sugerida (o usuário pode trocar antes de importar).
const GUESS = [['alimentacao', /mercado|supermerc|padaria|restaur|ifood|lanch|pizza|acougue|hortifruti|burger|cafe/],
  ['transporte', /uber|\b99 ?(app|pop|taxi)|posto|combust|gasolina|estacion|pedagio|metro|onibus/],
  ['saude', /farmac|drog|hospital|clinica|medic|dentist|laborat/], ['moradia', /aluguel|condomin|iptu/],
  ['contas', /energia|\bluz\b|\bagua\b|internet|telefon|netflix|spotify|claro|vivo|\btim\b|assinatura/],
  ['lazer', /cinema|teatro|\bbar\b|viagem|hotel|steam|ingresso/], ['educacao', /curso|escola|faculdade|livr|udemy/],
  ['compras', /amazon|mercado ?livre|magalu|shopee|\bloja|shopping|americanas/]];
// db.catMemo lembra a categoria que o usuário já escolheu para cada descrição; tem prioridade sobre o palpite.
const guessCat = d => { const t = plain(d), g = GUESS.find(([, re]) => re.test(t));
  if (db.catMemo[t] && CAT_GASTO[db.catMemo[t]]) return db.catMemo[t];
  return g && !(g[0] === 'alimentacao' && /mercado ?(livre|pago)/.test(t)) ? g[0] : /mercado ?livre/.test(t) ? 'compras' : 'outros'; };
const parseNum = s => { s = String(s).replace(/[R$\s"]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s); };
function parseDate(s){
  let m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = String(s).trim().match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
// Devolve [{date:'AAAA-MM-DD', desc, amount}] (amount negativo = saída) ou null se o formato não foi reconhecido.
function parseStatement(text){
  const rows = [];
  if (/<STMTTRN>/i.test(text)){ // OFX: um bloco <STMTTRN> por lançamento
    for (const blk of text.split(/<STMTTRN>/i).slice(1)){
      const tag = n => { const m = blk.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const date = parseDate(tag('DTPOSTED')), amount = parseFloat(tag('TRNAMT').replace(',', '.'));
      if (date && !isNaN(amount)) rows.push({date, desc:tag('MEMO') || tag('NAME') || 'Sem descrição', amount});
    }
    return rows;
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = l => { const out = []; let cur = '', q = false;
    for (const ch of l){ if (ch === '"') q = !q; else if (ch === delim && !q){ out.push(cur); cur = ''; } else cur += ch; } out.push(cur);
    return out.map(c => c.trim()).map(c => /^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c); }; // ' posto por csvCell
  const head = split(lines[0]).map(plain), col = (...names) => head.findIndex(h => names.some(n => h.includes(n)));
  const ci = {date:col('data', 'date'), desc:col('descri', 'histor', 'title', 'titulo', 'estabelecimento', 'lancamento', 'memo'),
    amount:col('valor', 'amount', 'quantia')};
  if (ci.date < 0 || ci.amount < 0) return null;
  for (const l of lines.slice(1)){
    const c = split(l), date = parseDate(c[ci.date] || ''), amount = parseNum(c[ci.amount] || '');
    if (date && !isNaN(amount) && amount !== 0) rows.push({date, desc:(ci.desc >= 0 && c[ci.desc]) || 'Sem descrição', amount});
  }
  return rows;
}
// Extratos em revisão: arqs = um por arquivo {nome, flip (fatura de cartão), bank, de, ate, n}; rows = os lançamentos de
// todos, por data {date, desc, amount, on, cat, dup, rep, a (o arquivo)}; pay = forma de pagamento dos gastos.
let stmt = null;
// O extrato precisa ser texto (OFX ou CSV). PDF, planilhas do Excel e fotos não são lidos, nem arquivos grandes demais
// (o celular pode ficar sem memória). Qualquer erro vira aviso e vai para o Diagnóstico: a importação nunca derruba a tela.
const STMT_MAX = 5 * 1024 * 1024, LER_ERRO = 'Não foi possível ler este arquivo.';
const stmtLog = (onde, e) => logErr('importar extrato', onde + ': ' + ((e && (e.stack || e.message)) || e));
// Antes de ler: tipo e tamanho. Devolve o aviso ou ''.
function stmtRecusa(file){
  if (/\.(pdf|xlsx?|ods|docx?|zip|rar|jpe?g|png|gif|heic|webp)$/i.test(file.name || '') || /^(image|video|audio)\/|pdf|zip|spreadsheet|excel|officedocument/i.test(file.type || ''))
    return LER_ERRO + '\n\nO extrato precisa estar em OFX ou CSV (no app ou no site do banco, procure "exportar extrato"). PDF, planilhas do Excel e fotos não são lidos.';
  if (file.size > STMT_MAX) return LER_ERRO + '\n\nEle é grande demais (mais de 5 MB). Exporte um período menor, como um mês.';
  return '';
}
// Banco do extrato, pelo <ORG> do OFX ou pelo nome do arquivo ("nubank-outubro.ofx"); '' se não reconhecer.
function stmtBanco(text, nome){
  const org = (String(text).match(/<ORG>([^<\r\n]*)/i) || [])[1] || '', s = ' ' + plain(org + ' ' + nome).replace(/[^a-z0-9]+/g, ' ') + ' ';
  if (s.includes(' nu pagamentos ')) return 'Nubank';
  return BANKS.find(b => s.includes(' ' + plain(b).replace(/[^a-z0-9]+/g, ' ') + ' ')) || '';
}
// Lê um arquivo já aceito: devolve {rows, bank} ou {erro}.
function stmtLer(file){
  return new Promise(ok => {
    const falhou = (onde, e) => { stmtLog(onde, e); ok({erro:erroTexto('arquivo')}); };
    const r = new FileReader();
    r.onerror = () => falhou('leitura', r.error);
    r.onload = () => {
      try {
        let text;
        try { text = new TextDecoder('utf-8', {fatal:true}).decode(r.result); } catch(e){ text = new TextDecoder('windows-1252').decode(r.result); } // extratos antigos não usam UTF-8
        const rows = parseStatement(text);
        if (!rows) return ok({erro:'Não reconheci o formato deste arquivo. Use o extrato em OFX, ou um CSV com colunas de data e valor.'});
        if (!rows.length) return ok({erro:'Não encontrei lançamentos neste arquivo.'});
        ok({rows, bank:stmtBanco(text, file.name || '')});
      } catch(e){ falhou('arquivo ' + (file.type || String(file.name).split('.').pop()) + ' de ' + Math.round(file.size / 1024) + ' KB', e); }
    };
    try { r.readAsArrayBuffer(file); } catch(e){ falhou('leitura', e); }
  });
}
// Um ou vários extratos de uma vez (de meses ou bancos diferentes): cada lançamento vai para o mês e o dia da data dele.
// O mesmo lançamento em dois arquivos (períodos que se cruzam) vem desmarcado no segundo.
async function importStatement(input){
  const files = [...(input.files || [])];
  input.value = ''; // deixa escolher os mesmos arquivos de novo
  if (!files.length) return; // escolha cancelada
  const nome = (f, k) => f.name || 'arquivo ' + (k + 1), recusas = files.map(stmtRecusa);
  if (recusas.every(Boolean)) return tell(files.length === 1 ? recusas[0] : 'Não consegui ler nenhum dos arquivos.\n\n'
    + files.map((f, k) => `${nome(f, k)}: ${recusas[k].replace(LER_ERRO + '\n\n', '')}`).join('\n'));
  const lidos = await Promise.all(files.map((f, k) => recusas[k] ? {erro:recusas[k]} : stmtLer(f)));
  const bons = [], ruins = [];
  lidos.forEach((l, k) => (l.erro ? ruins : bons).push({...l, nome:nome(files[k], k)}));
  if (!bons.length) return tell(files.length === 1 ? ruins[0].erro : 'Não consegui ler nenhum dos arquivos.\n\n'
    + ruins.map(l => `${l.nome}: ${l.erro.replace(LER_ERRO + '\n\n', '')}`).join('\n'));
  const visto = new Map(), rows = [];
  bons.forEach((l, a) => l.rows.forEach(x => {
    const k = x.date + '|' + x.desc + '|' + x.amount, rep = visto.has(k) && visto.get(k) !== a;
    if (!visto.has(k)) visto.set(k, a);
    rows.push({...x, on:!rep, rep, a, cat:guessCat(x.desc)});
  }));
  rows.sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
  const datas = l => l.rows.map(x => x.date).sort();
  stmt = {arqs:bons.map(l => ({nome:l.nome, flip:false, bank:l.bank, n:l.rows.length, de:datas(l)[0], ate:datas(l).pop()})), rows, pay:'',
    ruins:ruins.map(l => `${l.nome}: ${l.erro.replace(LER_ERRO + '\n\n', '')}`)};
  openStatement();
}
const stmtIsExpense = x => (stmt.arqs[x.a].flip ? -x.amount : x.amount) < 0;
// Pagamento da fatura do cartão: no extrato da conta é a saída que paga compras que já são gastos (as da fatura); na
// fatura é o crédito desse pagamento, que parecia um ganho. Não é gasto nem ganho: vem desmarcado.
const STMT_FATURA = /\bpag(amento|to|\.)?\s*(d[aeo]\s+)?fatura|\bpagamento recebido\b|\bfatura (d[oe] )?cart|\bpgto\.? (d[aeo] )?cart/;
const stmtFatura = x => STMT_FATURA.test(plain(x.desc));
// Gasto do extrato que já está no app como gasto fixo ou parcela do mesmo mês: valor igual (até 2% ou R$ 1 de diferença)
// e uma palavra da descrição do app no começo de uma palavra da do banco ("Netflix" e "NETFLIX.COM"). Devolve o texto
// para a tela ("gasto fixo Netflix", "parcela 3/10 de Geladeira") ou ''.
function stmtCadastrado(x){
  if (!stmtIsExpense(x)) return '';
  const v = Math.abs(x.amount), d = ' ' + plain(x.desc).replace(/[^a-z0-9]+/g, ' ') + ' ';
  const e = expensesAll(x.date.slice(0, 7)).find(e => (e.kind === 'installment' || e.fixed) && Math.abs((e.full ?? e.value) - v) <= Math.max(1, v * .02)
    && plain(e.desc).split(/[^a-z0-9]+/).some(w => w.length >= 4 && d.includes(' ' + w)));
  return !e ? '' : e.kind === 'installment' ? `parcela ${e.num}/${e.n} de ${e.desc}` : `gasto fixo ${e.desc}`;
}
// Já existe um lançamento igual (mesma descrição, valor e mês)? Vem desmarcado para não duplicar.
const stmtDup = x => (stmtIsExpense(x) ? db.expenses : db.incomes).some(e => e.desc === x.desc && Math.abs(e.value - Math.abs(x.amount)) < .005 && e.start === x.date.slice(0, 7) && (!e.day || e.day === +x.date.slice(8)));
// Período de um arquivo: "05/10/2026" ou "01/09/2026 a 31/10/2026".
const stmtPeriodo = a => a.de === a.ate ? fmtDate(a.de) : `${fmtDate(a.de)} a ${fmtDate(a.ate)}`;
function openStatement(){
  settingsOpen = false; F = null;
  // Pagamento de fatura, gasto fixo ou parcela já cadastrados e lançamento igual vêm desmarcados (uma vez: depois vale a
  // escolha da pessoa); trocar entre extrato e fatura refaz a conta.
  stmt.rows.forEach(x => {
    const fat = stmtFatura(x), cad = fat ? '' : stmtCadastrado(x), d = !fat && !cad && stmtDup(x), fora = fat || !!cad || d;
    if (fora && !x.fora) x.on = false;
    Object.assign(x, {fora, fat, cad, dup:d});
  });
  const nFat = stmt.rows.filter(x => x.fat).length, nCad = stmt.rows.filter(x => x.cad).length;
  const varios = stmt.arqs.length > 1, shown = stmt.rows.slice(0, 300), meses = [...new Set(stmt.rows.map(x => x.date.slice(0, 7)))];
  const arqHtml = (a, k) => `${varios ? `<div class="stmtArq"><b>${esc(a.nome)}</b><span class="muted">${a.n} lançamentos · ${stmtPeriodo(a)}</span></div>` : ''}
    <label>${varios ? 'Este extrato é' : 'Este arquivo é'}</label>
    <div class="semTopo btns">${[[false,'Extrato da conta'],[true,'Fatura de cartão']].map(([v,t]) => `<button class="btn ${a.flip === v ? 'primary' : ''}" data-onclick="stmt.arqs[${k}].flip=${v};openStatement()">${t}</button>`).join('')}</div>
    ${a.flip ? '<div class="hint">Na fatura, os valores positivos são compras: eles entram como gastos.</div>' : ''}
    <label>Banco / conta (opcional)</label>
    <input value="${esc(a.bank)}" id="stmtBank${k}" placeholder="Ex.: Nubank" data-oninput="stmt.arqs[${k}].bank=this.value"><div class="chips sug" id="sug_stmt${k}" hidden></div>`;
  let mesAntes = '';
  showSheet(`<h3>${varios ? `Importar ${stmt.arqs.length} extratos` : 'Importar extrato'}</h3>
    <div class="semTopo hint">${stmt.rows.length} lançamentos encontrados${varios ? ` em ${stmt.arqs.length} arquivos` : ''}${meses.length > 1 ? `, de ${meses.length} meses` : ''}. Cada um entra no dia e no mês da data dele. Valores negativos entram como gastos e positivos como ganhos.</div>
    ${stmt.ruins.length ? `<div class="hint warn">Não li: ${stmt.ruins.map(esc).join('; ')}</div>` : ''}
    ${nFat || nCad ? `<div class="hint">Vêm desmarcados: ${[nFat && `${nFat} pagamento${nFat > 1 ? 's' : ''} da fatura do cartão (não é gasto nem ganho)`,
      nCad && `${nCad} gasto${nCad > 1 ? 's' : ''} que já ${nCad > 1 ? 'estão' : 'está'} no app como gasto fixo ou parcela`].filter(Boolean).join(' e ')}.
      Toque para importar mesmo assim.</div>` : ''}
    ${stmt.arqs.map(arqHtml).join('')}
    <label>Forma de pagamento dos gastos (opcional)</label>
    <button type="button" class="pickBtn" data-onclick="pickList('Forma de pagamento',[['','Não informar'],...Object.entries(PAY)],stmt.pay,v=>{stmt.pay=v;openStatement()})"><span>${PAY[stmt.pay] || 'Não informar'}</span>${I('chev')}</button>
    <label>Lançamentos</label>
    ${shown.map((x, i) => { const exp = stmtIsExpense(x), m = x.date.slice(0, 7), cab = meses.length > 1 && m !== mesAntes ? `<div class="stmtMes">${cap(monthName(m))}</div>` : ''; mesAntes = m;
      return `${cab}<div class="stmt"><button type="button" class="iconbtn ${x.on ? 'in' : 'muted'}" data-onclick="stmtToggle(${i},this)" aria-label="Importar este lançamento">${I(x.on ? 'checked' : 'unchecked', 24)}</button>
      <div class="mid"><b>${esc(x.desc)}</b><span class="muted">${fmtDate(x.date)}${varios ? ' · ' + esc(stmt.arqs[x.a].bank || stmt.arqs[x.a].nome) : ''}${x.fat ? ' · pagamento da fatura' : x.cad ? ' · já no app: ' + esc(x.cad) : x.dup ? ' · já existe' : x.rep ? ' · repetido em outro extrato' : ''}</span>
      ${exp ? `<button type="button" class="pickBtn sm" style="margin-top:4px;width:auto;max-width:100%" data-onclick="pickList('Categoria',opts(CAT_GASTO),stmt.rows[${i}].cat,v=>{stmt.rows[${i}].cat=v;openStatement()})"><span>${esc((CAT_GASTO[x.cat] || CAT_GASTO.outros)[1])}</span>${I('chev', 14)}</button>` : ''}</div>
      <b class="${exp ? 'out' : 'in'}">${fmt(Math.abs(x.amount))}</b></div>`; }).join('')}
    ${stmt.rows.length > shown.length ? `<div class="hint">Mostrando os primeiros ${shown.length}; os demais também serão importados.</div>` : ''}
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button><button class="btn primary" id="stmtGo" data-onclick="commitStatement()">${stmtLabel()}</button></div>`);
  stmt.arqs.forEach((a, k) => sugBind(document.getElementById('stmtBank' + k), document.getElementById('sug_stmt' + k), bankSuggestions()));
}
function stmtToggle(i, b){
  const x = stmt.rows[i];
  x.on = !x.on;
  b.className = 'iconbtn ' + (x.on ? 'in' : 'muted'); b.innerHTML = I(x.on ? 'checked' : 'unchecked', 24);
  document.getElementById('stmtGo').textContent = stmtLabel();
}
const stmtLabel = () => `Importar ${stmt.rows.filter(x => x.on).length} lançamentos`;
function commitStatement(){
  const added = [], meses = new Set(); // added: [coleção, id] para o "Desfazer"
  for (const x of stmt.rows.filter(r => r.on)){
    const exp = stmtIsExpense(x),
    base = {id:uid(), desc:x.desc, value:Math.abs(x.amount), fixed:false, start:x.date.slice(0, 7), end:'', bank:stmt.arqs[x.a].bank.trim()};
    const rec = exp ? {...base, cat:x.cat, pay:stmt.pay, day:+x.date.slice(8), due:''} : {...base, cat:'outros'};
    db[exp ? 'expenses' : 'incomes'].push(touch(rec));
    if (exp) db.catMemo[plain(x.desc)] = x.cat;
    added.push([exp ? 'expenses' : 'incomes', rec.id]); meses.add(rec.start);
  }
  if (!added.length) return closeForm();
  state.month = [...meses].sort().pop(); // mostra o mês mais recente importado
  save(); closeForm(); render();
  showUndo(`${added.length} lançamentos importados${meses.size > 1 ? ` em ${meses.size} meses` : ''}`, () => {
    for (const [col, id] of added){ db[col] = db[col].filter(r => r.id !== id); db.tomb[id] = Date.now(); }
    save(); render();
  }, {dest:{k:'gastos', m:state.month}});
}
