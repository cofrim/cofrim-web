// Cofrim — Previsões de gastos nas telas: o bloco da aba Gastos e o detalhe de uma previsão. Depende de dados.js e
// previsoes.js (cálculos).
// Saiu de js/telas.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Previsões (bloco da aba Gastos e detalhe) ----------
// Barra: verde até 80% do previsto, amarela até 100%, vermelha acima (cheia, com o excesso escrito).
const prevCor = pct => pct > 100 ? 'var(--out)' : pct >= 80 ? 'var(--yield)' : 'var(--in)';
const prevCat = cat => PREV_GERAIS[cat] || CAT_GASTO[cat] || CAT_GASTO.outros, prevNome = cat => prevCat(cat)[1];
function prevPrazo(it){
  const g = prevGasto(it), dif = round2(g - it.value), hoje = today();
  if (!prevAtiva(it) && it.m <= hoje[0]) return dif > 0 ? `encerrada · ${fmt(dif)} acima` : dif < 0 ? `encerrada · sobraram ${fmt(-dif)}` : 'encerrada · exatamente o previsto';
  const falta = it.m === hoje[0] ? it.dia - hoje[1] : null;
  return `até dia ${it.dia}${falta == null ? '' : falta === 0 ? ' · termina hoje' : ` · falta${falta > 1 ? 'm' : ''} ${falta} dia${falta > 1 ? 's' : ''}`}`;
}
function prevBloco(m){
  const l = previsoesDoMes(m);
  return `<h2>Previsões <button data-onclick="novaPrevisao()">Nova previsão</button></h2>${l.length ? `<div class="card">${l.map(it => {
    const g = prevGasto(it), pct = g / it.value * 100, dif = round2(g - it.value);
    return `<div class="catrow prevItem" data-id="${it.p.id}" data-m="${m}" data-onclick="abrirPrevisao(this.dataset.id,this.dataset.m)"><div class="top"><span>${catName(prevCat(it.cat))}</span><b>${fmt(g)} de ${fmt(it.value)}</b></div>
      <div class="bar" style="margin:6px 0"><i style="width:${Math.min(100, pct)}%;background:${prevCor(pct)}"></i></div>
      <div class="semTopo hint">${prevPrazo(it)}${dif > 0 && prevAtiva(it) ? ` · <span class="out">${fmt(dif)} acima do previsto</span>` : ''}${it.p.rep ? ' · todo mês' : ''}</div></div>`; }).join('')}</div>`
    : `<div class="card"><div class="hint u-m0">Previsão é um gasto que você espera ter até um dia do mês, numa categoria (ex.: R$ 300 de combustível até o dia 25), em todos os gastos ou no cartão de crédito. Diferente do orçamento, que é um limite, ela já entra no saldo previsto do mês.</div>
      <div class="btns"><button class="btn" data-onclick="novaPrevisao()">${I('plus')}Nova previsão</button></div></div>`}`;
}
// Detalhe: os lançamentos que contaram, editar e excluir.
function abrirPrevisao(id, m){
  const it = previsoesDoMes(m).find(x => x.p.id === id);
  if (!it) return;
  settingsOpen = false; F = null;
  const l = prevLanc(it), g = prevGasto(it);
  showSheet(`<h3>Previsão de ${esc(prevNome(it.cat))}</h3>
    <div class="semTopo hint">${monthName(m)} · ${fmt(g)} de ${fmt(it.value)} · ${prevPrazo(it)}${it.p.rep ? ' · repete todo mês' : ''}</div>
    <label>Lançamentos que contaram (do dia 1 ao dia ${it.dia})</label>
    ${l.length ? `<div class="plano card">${l.map(x => `<div class="semCursor item"><div class="mid"><b>${esc(x.desc || prevNome(x.cat))}</b><small>dia ${diaDe(x, m) || '—'}</small></div><div class="val out">${fmt(x.value)}</div></div>`).join('')}</div>`
      : `<div class="hint">${PREV_GERAIS[it.cat] ? 'Nenhum gasto até o dia final.' : 'Nenhum gasto desta categoria até o dia final.'}</div>`}
    <div class="btns"><button class="btn danger" data-id="${id}" data-m="${m}" data-onclick="excluirPrevisao(this.dataset.id,this.dataset.m)">Excluir</button><button class="btn" data-id="${id}" data-m="${m}" data-onclick="editarPrevisao(this.dataset.id,this.dataset.m)">Editar</button></div>
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Gravação do formulário. Nova: vale a partir do mês aberto. Numa que se repete, "Só este mês" guarda a mudança em ex
// (com outra categoria, sai deste mês e vira uma previsão só deste mês); "Este e os próximos" fecha a antiga no mês
// anterior e começa outra daqui (no primeiro mês dela, muda a própria).
function prevSalvar(v, id, novoId){
  const m = prevCtx.m, dados = {cat:v.cat, value:v.value, dia:v.dia || 31}, p = id && db.previsoes.find(x => x.id === id);
  if (!p) return db.previsoes.push(touch({id:novoId, mes:m, ...dados, rep:!!v.rep, ex:{}}));
  if (p.rep && prevCtx.modo === 'este'){
    if (v.cat !== p.cat){ p.ex[m] = {del:1}; db.previsoes.push(touch({id:novoId, mes:m, ...dados, rep:false, ex:{}})); }
    else p.ex[m] = {value:dados.value, dia:dados.dia};
    return touch(p);
  }
  if (p.rep && m > p.mes){ p.ate = addMonths(m, -1); touch(p); return db.previsoes.push(touch({id:novoId, mes:m, ...dados, rep:!!v.rep, ex:{}})); }
  Object.assign(touch(p), dados, {rep:!!v.rep});
}
function prevJaExiste(it){
  ask(`Já existe uma previsão de ${prevNome(it.cat)} em ${monthName(it.m)}. Editar a que existe?`,
    'Editar').then(sim => { if (sim) editarPrevisao(it.p.id, it.m); });
}
// Uma que se repete: perguntar se a mudança vale só para este mês ou para este e os próximos.
function prevModo(it, titulo, cb){
  if (!it.p.rep) return cb('');
  pickList(titulo, [['este', 'Só este mês'], ['prox', 'Este e os próximos']], '', cb);
}
function novaPrevisao(){
  prevCtx = {m:state.month, modo:''};
  openForm('previsoes', null, {vals:{dia:String(daysIn(state.month)), rep:''}});
}
function editarPrevisao(id, m){
  const it = previsoesDoMes(m).find(x => x.p.id === id);
  if (it) prevModo(it, 'Editar a previsão', modo => {
    prevCtx = {m, modo};
    openForm('previsoes', null,
      {id, title:'Editar previsão', vals:{cat:it.cat, value:moneyStr(it.value), dia:String(it.dia), rep:it.p.rep && modo !== 'este' ? '1' : ''}});
  });
}
function excluirPrevisao(id, m){
  const it = previsoesDoMes(m).find(x => x.p.id === id);
  if (it) prevModo(it, 'Excluir a previsão', async modo => {
    if (!await ask(`Excluir a previsão de ${prevNome(it.cat)}${modo === 'este' ? ` só em ${monthName(m)}` : modo === 'prox' ? ` de ${monthName(m)} em diante` : ''}?`, 'Excluir', true)) return;
    const p = it.p;
    closeForm();
    if (!p.rep || (modo !== 'este' && m <= p.mes)) return removeRec('previsoes', id);
    const antes = JSON.stringify(db);
    if (modo === 'este') (p.ex = p.ex || {})[m] = {del:1}; else p.ate = addMonths(m, -1);
    touch(p); save(); render();
    showUndo('Previsão excluída', () => restoreSnap(antes));
  });
}
