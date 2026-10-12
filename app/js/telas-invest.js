// Cofrim — Aba Investir: carteira, metas, dividendos, comprar e vender. Depende de dados.js e telas.js.
// Saiu de js/telas.js (só mudou de arquivo); carregado logo depois de telas-gastos.js no index.html.

function viewInvest(){
  const vs = db.investments, hoje = sum(vs, v => v.value), fut = sum(vs, projection), r = db.rates;
  // Evolução: últimos 12 meses do histórico (db.netLog), com o mês atual ao vivo.
  const hist = [...Array(12)].map((_,i) => addMonths(curYM, i - 11)).map(m => [m, m === curYM ? hoje : db.netLog[m]]);
  const known = hist.filter(h => h[1] != null), hmax = Math.max(1, ...known.map(h => h[1]));
  const B = {
  total: () => `<div class="hero"><small>Total investido hoje</small>${bigNum(hoje)}
    <div class="row"><div><small>Projeção em 12 meses</small><b>${fmt(fut)}</b></div><div><small>Aportes do ano</small><b>${fmt(sum(vs, v => (v.monthly||0)*12))}</b></div></div></div>`,
  evolucao: () => vs.length ? `<div class="card"><b>Evolução do total investido</b>
    <div class="chart" style="height:110px">${chartGrid(hmax)}${hist.map(([m, v]) => `<div class="semCursor col"><div class="bars"><i style="height:${v == null ? 0 : v/hmax*100}%;width:70%;max-width:16px;background:${v == null ? 'transparent' : 'linear-gradient(var(--brand),var(--brand2))'}"></i></div><small>${MESES[+m.slice(5)-1].slice(0,3)}</small></div>`).join('')}</div>
    <div class="hint">${known.length > 1 ? `De ${fmt(known[0][1])} em ${monthName(known[0][0])} para ${fmt(hoje)} hoje.` : 'O histórico começa neste mês e ganha uma barra a cada mês de uso.'}</div></div>` : '',
  metas: () => `<h2>Metas <button data-onclick="openForm('goals')">+ Nova meta</button></h2>
  ${db.goals.length ? db.goals.map(g => { const pct = Math.min(100, g.saved / g.target * 100), left = Math.max(0, g.target - g.saved),
    months = g.date ? monthDiff(g.date, curYM) : 0; return `
    <div class="card">
      <div class="item" data-onclick="edit('goals','${g.id}')">${tile('target')}<div class="mid"><b>${esc(g.name)}</b>
        <small>${g.date ? 'até ' + monthName(g.date) : 'sem prazo'}
        ${g.auto ? ` · guarda ${fmt(g.auto)} todo dia ${g.autoDia || 1}` : ''}${bySmall(g)}</small></div><div class="val">${Math.round(pct)}%</div></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="grid3"><div class="stat"><small>Guardado</small><b class="in u-fs14">${fmt(g.saved)}</b></div>
        <div class="stat"><small>Meta</small><b class="u-fs14">${fmt(g.target)}</b></div>
        <div class="stat"><small>Falta</small><b class="u-fs14">${fmt(left)}</b></div></div>
      ${left <= 0 ? `<div class="hint in">${I('checked', 15)} Meta alcançada</div>` : g.date ? `<div class="hint">${months > 0 ? `Guardando ${fmt(left / months)} por mês você chega lá no prazo (${months} ${months > 1 ? 'meses' : 'mês'}).` : 'O prazo desta meta já chegou.'}</div>` : ''}
      <div class="btns"><button class="btn primary" data-onclick="openForm('goalAdd', null, {id:'${g.id}'})">+ Guardar dinheiro</button></div>
    </div>`; }).join('') : vazioParte('Crie uma meta (viagem, reserva de emergência…) e acompanhe quanto falta.', ['+ Criar meta', "openForm('goals')"])}`,
  carteira: () => `<h2>Meus investimentos ${vs.some(v => v.ticker) ? `<button data-onclick="refreshQuotes(true)">${quoting ? 'Atualizando…' : I('refresh', 14) + 'Atualizar cotações'}</button>` : ''}</h2>
  ${vs.length ? vs.map(v => { const c = CAT_INV[v.cat] || CAT_INV.outros, p = projection(v), ap = (v.monthly||0)*12;
    if (v.ticker){ const cost = v.qty*v.paid, gain = v.value - cost, cls = gain < 0 ? 'out' : 'in', sign = gain < 0 ? '−' : '+';
      const sales = v.sales || [], divs = v.divs || [], realized = sum(sales, s => s.qty * (s.price - s.cost)), divTotal = sum(divs, d => d.value);
      const signed = x => `<b class="${x < 0 ? 'out' : 'in'}">${x < 0 ? '−' : '+'}${fmt(Math.abs(x))}</b>`; return `
    <div class="card">
      <div class="semCursor item">${ico(c)}<div class="mid"><b>${esc(v.ticker)}</b>
        <small>${esc(v.assetName || c[1])}${v.broker ? ' · ' + esc(v.broker) : ''}</small></div>
        <div class="val ${cls}">${sign}${Math.abs(cost ? gain/cost*100 : 0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</div></div>
      <div class="grid2" style="margin-top:12px;row-gap:10px">
        <div class="stat"><small>Quantidade</small><b>${v.qty.toLocaleString('pt-BR',{maximumFractionDigits:8})}</b></div>
        <div class="stat"><small>Valor hoje</small><b>${quoting ? '<span class="sk skTxt"></span>' : fmt(v.value)}</b></div>
        <div class="stat"><small>Preço médio</small><b>${fmtQ(v.paid)}</b></div>
        <div class="stat"><small>Cotação atual</small><b>${quoting ? '<span class="sk skTxt"></span>' : fmtQ(v.quote)}</b></div>
        <div class="stat"><small>Total investido</small><b>${fmt(cost)}</b></div>
        <div class="stat"><small>Rendimento</small><b class="${cls}">${sign}${fmt(Math.abs(gain))}</b></div>
      </div>
      ${(d0 => d0 && cost ? (c => `<div class="hint">Desde ${fmtDate(d0)}: você ${gain < 0 ? '−' : '+'}${Math.abs(gain / cost * 100).toLocaleString('pt-BR', {maximumFractionDigits:1})}% · CDI ≈ +${c.toLocaleString('pt-BR', {maximumFractionDigits:1})}%. <b class="${gain / cost * 100 >= c ? 'in' : 'out'}">${gain / cost * 100 >= c ? 'Rendeu mais' : 'Rendeu menos'} que o CDI.</b></div>`)(cdiSince(d0)) : '')(v.lots.map(l => l.date).filter(Boolean).sort()[0])}
      ${v.alertUp || v.alertDown ? `<div class="hint">${I('alert', 13)} Alerta de preço: ${[v.alertUp && 'acima de ' + fmtQ(v.alertUp), v.alertDown && 'abaixo de ' + fmtQ(v.alertDown)].filter(Boolean).join(' · ')}</div>` : ''}
      <label>Compras (${v.lots.length})</label>
      ${v.lots.map((l,i) => `<div class="item u-linha"><div class="mid"><b class="u-peso5">${l.qty.toLocaleString('pt-BR',{maximumFractionDigits:8})} × ${fmtQ(l.paid)}</b><small>${fmtDate(l.date)} · ${fmt(l.qty*l.paid)}</small></div>
        <button class="iconbtn" data-onclick="removeLot('${v.id}',${i})" aria-label="Excluir compra">${I('close', 18)}</button></div>`).join('')}
      ${sales.length ? `<label>Vendas (${sales.length})</label>${sales.map(s => `<div class="item u-linha"><div class="mid"><b class="u-peso5">${s.qty.toLocaleString('pt-BR',{maximumFractionDigits:8})} × ${fmtQ(s.price)}</b><small>${fmtDate(s.date)} · custo médio ${fmtQ(s.cost)}</small></div><div class="val">${signed(s.qty * (s.price - s.cost))}</div></div>`).join('')}` : ''}
      ${divs.length ? `<label>Proventos (${divs.length})</label>${divs.map(d => `<div class="item u-linha"><div class="mid"><small>${fmtDate(d.date)}</small></div><div class="val in">+${fmt(d.value)}</div></div>`).join('')}` : ''}
      ${sales.length || divs.length ? `<div class="grid3 u-mt12">
        <div class="stat"><small>Lucro das vendas</small>${signed(realized)}</div>
        <div class="stat"><small>Proventos</small>${signed(divTotal)}</div>
        <div class="stat"><small>Retorno total</small>${signed(gain + realized + divTotal)}</div></div>` : ''}
      <div class="btns"><button class="btn primary" data-onclick="buyMore('${v.id}')">${I('plus', 16)}Nova compra</button><button class="btn" data-onclick="sellAsset('${v.id}')" ${v.qty > 0 ? '' : 'disabled style="opacity:.4"'}>Vender</button></div>
      <div class="btns"><button class="btn" data-onclick="openDiv('${v.id}')">${I('coins', 16)}Registrar provento</button><button class="btn danger" data-onclick="removeRec('investments','${v.id}')">Excluir</button></div>
      <div class="btns"><button class="btn" data-onclick="openForm('priceAlert', db.investments.find(x => x.id === '${v.id}'))">${I('alert', 16)}Alerta de preço</button></div>
      <div class="hint">Cotação de ${new Date(v.quoteAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</div>
    </div>`; }
    return `
    <div class="card">
      <div class="item" data-onclick="edit('investments','${v.id}')">${ico(c)}<div class="mid"><b>${esc(v.name)}</b>
        <small>${esc(c[1])}${v.broker ? ' · ' + esc(v.broker) : ''} · ${rateLabel(v)}${bySmall(v)}</small></div>
        <div class="val muted">≈ ${(annualRate(v)*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}% a.a.</div></div>
      <div class="grid3 u-mt12">
        <div class="stat"><small>Hoje</small><b class="u-fs14">${fmt(v.value)}</b></div>
        <div class="stat"><small>Em 12 meses</small><b class="u-fs14">${fmt(p)}</b></div>
        <div class="stat"><small>Rendimento</small><b class="in u-fs14">+${fmt(p - v.value - ap)}</b></div>
      </div>
      <div class="btns"><button class="btn primary" data-onclick="openForm('invAdd', null, {id:'${v.id}'})">${I('plus', 16)}Fazer um aporte</button></div>
      <div class="hint">O valor é atualizado sozinho a cada virada de mês com o rendimento${v.monthly ? ` e o aporte mensal de ${fmt(v.monthly)}` : ''}.</div>
    </div>`; }).join('')
  : empty('trend', 'Cadastre seus investimentos para ver<br>quanto você terá daqui a um ano.', ['+ Cadastrar investimento', "openForm('investments')"])}`,
  taxas: () => `<div class="hint" style="text-align:center;padding:0 10px">Projeção bruta (sem IR), com as taxas: CDI ${r.cdi}% · Selic ${r.selic}% · IPCA ${r.ipca}% a.a. (${ratesInfo()}).
    <a class="u-marca" href="#" data-onclick="openRates();return false">Ver taxas</a>
    ${vs.some(v => v.ticker) ? '<br>Ações e moedas entram pelo valor atual, sem projeção. As cotações podem ter alguns minutos de atraso.' : ''}</div>`
  };
  return head('Investimentos', 'invest') + blocks('invest', B)
    + (vs.length ? `<div class="btns u-mb12"><button class="cresce btn danger" data-onclick="openApagar('invest')">${I('trash')}Apagar investimentos por dia, mês ou ano</button></div>` : '');
}
function openDiv(id){ const v = db.investments.find(x => x.id === id); openForm('div', null, {id, title:'Provento de ' + v.ticker}); }
function buyMore(id){
  const v = db.investments.find(x => x.id === id);
  openForm('investments', null,
    {title:'Nova compra de ' + v.ticker, vals:{cat:v.cat, ticker:v.ticker, paid:String(v.quote).replace('.', ','), broker:v.broker || ''},
    asset:{code:v.ticker, name:v.assetName, quote:v.quote}});
}
function sellAsset(id){
  const v = db.investments.find(x => x.id === id);
  openForm('sell', null, {id, title:'Vender ' + v.ticker, vals:{price:String(v.quote).replace('.', ','), date:now.toLocaleDateString('sv'), toIncome:'1'}});
}
function removeLot(id, i){
  const v = db.investments.find(x => x.id === id);
  if (v.lots.length === 1) return removeRec('investments', id);
  const lot = v.lots.splice(i, 1)[0];
  recalc(v); touch(v); save(); render();
  showUndo('Compra excluída', () => { v.lots.splice(i, 0, lot); recalc(v); touch(v); save(); render(); });
}

// ---------- Busca de ações e moedas (saiu de js/investimentos.js, que ficou só com as regras) ----------
function searchAssets(q){
  clearTimeout(assetTimer);
  assetTimer = setTimeout(async () => {
    const src = F && QUOTE_SRC[F.vals.cat], box = document.getElementById('assetList');
    if (!src || !box) return;
    let items;
    try { items = await (src === 'b3' ? searchB3(q) : searchFx(q)); }
    catch(e){ box.innerHTML = '<div class="hint">Não foi possível buscar. Verifique a internet.</div>'; return; }
    if (!F || document.getElementById('assetList') !== box) return;
    assetResults = items;
    box.innerHTML = items.length ? items.map((a,i) => `<div class="item" style="padding:9px 2px" data-onclick="pickAsset(${i})"><div class="mid"><b>${esc(a.code)}</b><small>${esc(a.name)}</small></div><div class="val">${a.quote != null ? fmtQ(a.quote) : ''}</div></div>`).join('')
      : '<div class="hint">Nada encontrado.</div>';
  }, 350);
}
const assetPicked = a => `<div class="hint in">${I('check', 14)} ${esc(a.code)} — ${esc(a.name || '')} · cotação atual ${fmtQ(a.quote)}</div>`;
async function pickAsset(i){
  const a = assetResults[i], box = document.getElementById('assetList');
  if (a.quote == null){
    try { a.quote = (await fxQuotes([a.code]))[a.code]; } catch(e){}
    if (!(a.quote > 0)){ box.innerHTML = `<div class="hint">Não há cotação em reais para ${esc(a.code)}.</div>`; return; }
  }
  if (!F) return;
  F.asset = a;
  F.vals.ticker = a.code;
  if (!F.touched.paid) F.vals.paid = String(a.quote).replace('.', ',');
  syncForm();
  box.innerHTML = assetPicked(a);
}
