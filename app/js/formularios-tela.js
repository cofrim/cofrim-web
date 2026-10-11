// Cofrim — Formulário na tela: abrir (openForm), desenhar os campos, seletor de categoria e ícone, fechar e salvar.
// Depende de formularios.js (FORMS) e dialogos.js.
// Saiu de js/dialogos.js (só mudou de arquivo); carregado logo depois dele no index.html.

// preset (opcional): {title, vals, asset, id} para abrir um formulário novo já preenchido.
function openForm(col, item, preset = {}){
  // Lançamento num vale (gasto pago com vale ou crédito de vale): formulário enxuto, só com o que importa para vales.
  formVale = !!preset.vale || !!item && (col === 'expenses' ? valeGasto(item) : col === 'incomes' && valeGanho(item));
  formTipo = col === 'installments' ? preset.tipo || item && item.tipo || '' : '';
  const cfg = FORMS[col], fields = typeof cfg.fields === 'function' ? cfg.fields() : cfg.fields;
  const vals = Object.assign(cfg.defaults ? cfg.defaults() : {}, preset.vals);
  if (item) for (const f of fields){ const v = item[f.k]; vals[f.k] = f.type === 'money' ? moneyStr(v) : f.k === 'fixed' ? (v === 'y' ? 'y' : v ? '1' : '') : v == null ? '' : String(v).replace('.', f.type === 'num' ? ',' : '.'); }
  if (item && cfg.load) cfg.load(vals, item);
  settingsOpen = false;
  F = {col, cfg, fields, id:preset.id || (item && item.id), vals, touched:{}, asset:preset.asset || null, vale:formVale, sug:preset.sug || null};
  // sug: hora da sugestão do banco que abriu o formulário
  // Lançamento rápido: num registro novo, os campos "more" começam recolhidos.
  const hasMore = fields.some(f => f.more);
  F.more = !hasMore || !!F.id || !!preset.more;
  showSheet(`<h3>${preset.title || cfg.fullTitle || (item ? 'Editar ' : (typeof cfg.fem === 'function' ? cfg.fem() : cfg.fem) ? 'Nova ' : 'Novo ') + (formVale ? (col === 'incomes' ? 'crédito de vale' : 'gasto no vale') : typeof cfg.title === 'function' ? cfg.title() : cfg.title)}</h3>` +
    (!F.id && cfg.top ? cfg.top() : '') +
    fields.map(f => `<div id="w_${f.k}"><label for="f_${f.k}"></label>${fieldHtml(f)}</div>`).join('') +
    (cfg.before ? `<div id="w__before">${cfg.before()}</div>` : '') +
    (hasMore && !F.id ? `<button type="button" class="moreBtn" id="moreBtn" data-onclick="if(F){F.more=!F.more;syncForm()}"></button><div class="hint" id="moreSum" style="text-align:center"></div>` : '') +
    `<div class="hint" id="fhint"></div><div class="err" id="ferr"></div>
    <div class="btns foot">${F.id && !cfg.noDelete ? '<button class="btn danger" data-onclick="removeItem()">Excluir</button>' : ''}
      <button class="btn" data-onclick="closeForm()">Cancelar</button><button class="btn primary" data-onclick="submitForm()">Salvar</button></div>` +
    (cfg.extra ? cfg.extra() : '') + histHtml(item));
  for (const f of fields){
    const el = document.getElementById('f_' + f.k);
    el.value = vals[f.k] ?? '';
    // Valor atual que não está mais na lista (ex.: categoria escondida): entra como opção para não se perder.
    if (f.type === 'select' && vals[f.k] && el.value !== vals[f.k]){ el.add(new Option(f.k === 'cat' ? ((CAT_GASTO[vals.cat] || CAT_GANHO[vals.cat] || [0, vals.cat])[1]) : vals[f.k], vals[f.k])); el.value = vals[f.k]; }
    // Valores em dinheiro: a pessoa digita só os números e a vírgula dos centavos entra sozinha (1 → 0,01; 1234 → 12,34).
    // Vale para o que é digitado; valores postos pelo app (setField, comprovante lido) já chegam prontos.
    if (f.type === 'money') el.addEventListener('input', () => { el.value = centsMask(el.value); el.setSelectionRange(el.value.length, el.value.length); });
    el.oninput = el.onchange = () => {
      if (!F) return; // formulário já fechado (toque ou valor que chegou depois de fechar)
      F.vals[f.k] = el.value; F.touched[f.k] = true;
      if (cfg.onChange) cfg.onChange(f.k, F.vals, !F.id, F.touched);
      syncForm(f.k);
    };

    if (f.sug) sugBind(el, document.getElementById('sug_' + f.k), f.sug());
  }
  // Categoria: em vez da lista suspensa, um botão por categoria (o <select> continua existindo, escondido).
  syncForm();
  if (F.asset) document.getElementById('assetList').innerHTML = assetPicked(F.asset);
}
// Sugestões (bancos, pessoas…) como botões logo abaixo do campo. A lista nativa do navegador (<datalist>)
// cobria a tela inteira no Android e só fechava escolhendo um item.
function sugBind(el, box, list){
  const draw = () => {
    const q = el.value.trim().toLowerCase();
    const hits = list.filter(s => s.toLowerCase() !== q && s.toLowerCase().includes(q)).slice(0, 8);
    box.hidden = !hits.length;
    box.innerHTML = hits.map(s => `<button type="button">${esc(s)}</button>`).join('');
    box.querySelectorAll('button').forEach((b, i) => b.onclick = () => { el.value = hits[i]; el.dispatchEvent(new Event('input')); box.hidden = true; });
  };
  el.addEventListener('focus', draw);
  el.addEventListener('input', draw);
  draw(); // as sugestões já aparecem ao abrir o formulário, sem precisar tocar no campo
}
function syncForm(skip){
  for (const f of F.fields){
    document.getElementById('w_' + f.k).hidden = (!!f.showIf && !f.showIf(F.vals)) || (!!f.more && !F.more);
    document.querySelector(`#w_${f.k} label`).textContent = typeof f.label === 'function' ? f.label(F.vals) : f.label;
    const el = document.getElementById('f_' + f.k);
    if (f.k !== skip && el.value !== (F.vals[f.k] ?? '')) el.value = F.vals[f.k] ?? '';
  }
  document.getElementById('fhint').textContent = F.cfg.hint ? F.cfg.hint(F.vals) : '';
  const bf = document.getElementById('w__before'), mb = document.getElementById('moreBtn');
  if (bf) bf.hidden = !F.more;
  if (mb){
    mb.innerHTML = I(F.more ? 'close' : 'plus', 16) + (F.more ? 'Menos opções' : 'Mais opções');
    document.getElementById('moreSum').textContent = !F.more && F.cfg.summary ? F.cfg.summary(F.vals) : '';
  }

  drawPicks();
  drawCatPick();
  document.querySelectorAll('.iconGrid button').forEach(b => b.classList.toggle('on', b.dataset.i === F.vals.icon));
  document.querySelectorAll('.colorGrid button').forEach(b => b.classList.toggle('on', b.dataset.c === F.vals.color));
}
// Categoria: em vez da lista suspensa, um botão por categoria (o <select> continua existindo, escondido).
// Com muitas categorias, aparecem as mais usadas primeiro e o resto fica atrás de "Mais categorias".
function drawCatPick(){
  const cp = document.getElementById('catPick');
  if (!cp) return;
  const M = F.col === 'incomes' ? CAT_GANHO : F.col === 'investments' ? CAT_INV : CAT_GASTO, LIM = 11, used = {};
  for (const x of F.col === 'incomes' ? db.incomes : F.col === 'investments' ? db.investments : db.expenses.concat(db.installments)) used[x.cat] = (used[x.cat] || 0) + 1;
  let list = [...document.getElementById('f_cat').options].map(o => [o.value, o.text]);
  const cut = list.length > LIM + 1 && !F.allCats;
  if (cut){ const top = [...list].sort((a, b) => (used[b[0]] || 0) - (used[a[0]] || 0)).slice(0, LIM).map(o => o[0]);
    list = list.filter(o => top.includes(o[0]) || o[0] === F.vals.cat); }
  cp.innerHTML = list.map(([v, t]) => `<button type="button" class="${v === F.vals.cat ? 'on' : ''}" data-v="${esc(v)}" data-onclick="pickCat(this.dataset.v)">${I((M[v] || ['tag'])[0], 17)}${esc(t)}</button>`).join('') +
    (cut ? `<button type="button" class="more" data-onclick="F.allCats=true;drawCatPick()">Mais categorias…</button>` : '');
}
function pickCat(v){ if (!F) return; const el = document.getElementById('f_cat'); el.value = v; el.onchange(); }
function pickIcon(k, v){ const el = document.getElementById('f_' + k); el.value = v; el.oninput(); }
// O que mudou entre duas versões de um lançamento, em texto ("valor R$ 10,00 → R$ 12,00"). '' se nada relevante mudou.
const DIFF_FIELDS = [['value', 'valor', 1], ['total', 'total', 1], ['target', 'meta', 1], ['saved', 'guardado', 1], ['desc', 'descrição'],
  ['name', 'nome'], ['cat', 'categoria'],
  ['bank', 'banco'], ['pay', 'pagamento'], ['start', 'mês'], ['end', 'até'], ['day', 'dia'], ['due', 'vencimento'], ['n', 'parcelas'],
  ['paid', 'pagas'], ['tags', 'etiquetas']];
function diffRec(a, b){
  const show = (k, v, money) => v === '' || v == null ? 'vazio' : money ? shown(() => fmt(v)) : k === 'cat' ? (CAT_GASTO[v] || CAT_GANHO[v] || CAT_INV[v] || [0, v])[1] : k === 'pay' ? PAY[v] || v : String(v);
  return DIFF_FIELDS.filter(([k]) => (a[k] ?? '') !== (b[k] ?? '')).map(([k, nome, money]) => `${nome} ${show(k, a[k], money)} → ${show(k, b[k], money)}`).join('; ');
}
const histHtml = item => item && item.h && item.h.length ? `<label>Histórico de alterações</label>${[...item.h].reverse().map(h =>
  `<div class="hint" style="margin-top:4px"><b>${new Date(h.t).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}</b> · ${esc(h.d)}</div>`).join('')}` : '';
function closeForm(){
  settingsOpen = false;
  if (explorarOrigem && explorarOrigem.raiz !== undefined) explorarOrigem = null;
  // Janela de uma parte de aba (Explorar): fechar ela esquece; fechar um formulário aberto por ela faz a janela voltar.
  if (document.querySelector('#sheet .blocoJanela')) explorarJanela = null; else if (explorarJanela) setTimeout(explorarReabre, 0);
  welcomeOn = false;
  closePicker();
  try { localStorage.removeItem(DRAFT); } catch(e){}
  document.getElementById('sheet').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
  F = null;
}
function submitForm(){
  if (!F) return; // segundo toque em "Salvar" depois que o formulário já fechou
  // Erro num campo recolhido abre as "Mais opções", para o campo aparecer.
  // O motivo aparece numa mensagem na tela; depois do OK, o campo que falta fica destacado e à vista.
  const out = {}, err = (m, f) => {
    if (f && f.more && !F.more){ F.more = true; syncForm(); }
    document.getElementById('ferr').textContent = m;
    document.querySelectorAll('#sheet .bad').forEach(w => w.classList.remove('bad'));
    tell('Não foi possível salvar.\n\n' + m).then(() => {
      const w = f && F && document.getElementById('w_' + f.k), campo = w && w.querySelector('input:not([type=hidden]),.pickBtn,.catPick button');
      if (!w) return;
      w.classList.add('bad');
      w.scrollIntoView({block:'center', behavior:'smooth'});
      if (campo && campo.tagName === 'INPUT') campo.focus({preventScroll:true});
      w.addEventListener('input', () => w.classList.remove('bad'), {once:true});
      w.addEventListener('click', () => w.classList.remove('bad'), {once:true});
    });
  };
  for (const f of F.fields){
    const raw = String(F.vals[f.k] ?? '').trim(), name = typeof f.label === 'function' ? f.label(F.vals) : f.label;
    if (f.showIf && !f.showIf(F.vals)){ out[f.k] = ''; continue; }
    if (f.k === 'fixed'){ out.fixed = raw === 'y' ? 'y' : !!raw; continue; }
    if (!raw){ if (f.optional){ out[f.k] = f.type === 'money' ? 0 : ''; continue; } return err('Preencha: ' + name.toLowerCase(), f); }
    if (f.type === 'money' || f.type === 'num' || f.type === 'int'){
      const n = f.type === 'int' ? (/^\d+$/.test(raw) ? parseInt(raw) : NaN) : parseMoney(raw);
      // Campo opcional com 0 (ex.: aporte mensal "0,00" ao editar) vale como não informado.
      if (isNaN(n) || n < 0 || (n === 0 && !f.zero && !f.optional)) return err('Valor inválido em: ' + name.toLowerCase(), f);
      if (f.type === 'money'){ out[f.k] = round2(n); continue; }
      out[f.k] = n;
    } else out[f.k] = raw;
  }
  if (out.end && out.end < out.start) return err('O mês final não pode ser antes do inicial.');
  const msg = F.cfg.check && F.cfg.check(out);
  if (msg === false) return; // o próprio check já perguntou o que fazer (ex.: previsão que já existe)
  if (msg) return err(msg);
  const newId = uid(), after = F.cfg.after, antes = F.id ? JSON.stringify(db) : null, voltar = welcomeOn;
  const velho = F.id && COLS.includes(F.col) ? {...(db[F.col].find(x => x.id === F.id) || {})} : null;
  if (F.cfg.commit) F.cfg.commit(out, F.id, newId);
  else if (F.id) Object.assign(touch(db[F.col].find(x => x.id === F.id)), out);
  else db[F.col].push(touch({id:newId, ...out}));
  if (velho && velho.id){ // histórico: guarda as 6 últimas alterações do lançamento
    const rec = db[F.col].find(x => x.id === F.id), d = rec && diffRec(velho, rec);
    if (d) rec.h = [...(rec.h || []), {t:Date.now(), d}].slice(-6);
  }
  if (F.photo !== undefined){ // comprovante anexado, trocado ou removido neste formulário
    const rec = db[F.col].find(x => x.id === (F.id || newId));
    if (rec){ rec.photo = !!F.photo; if (F.photo) photoSave(rec.id, F.photo); else photoDelete(rec.id); queuePhoto(F.photo ? 'up' : 'del', rec.id); }
  }
  if (F.col === 'expenses' && !F.id) state.month = out.fixed && out.start > state.month ? out.start : (out.fixed ? state.month : out.start);
  rollover(); // marca registros novos com o mês atual
  const done = savedMsg(F.col, !F.id), gastoNovo = F.col === 'expenses' && !F.id ? out.value : 0, sugT = F.sug;
  save(); closeForm(); render();
  if (sugT) sugLancada(sugT); // formulário aberto por uma sugestão do banco: só agora ela vira "Lançada"
  if (gastoNovo) gastoAnim(gastoNovo); // animação de novo gasto, com as formas do tema (js/cena.js)
  if (after) after();
  if (voltar) openWelcome();
  if (antes && done === 'Salvo') showUndo('Alteração salva', () => restoreSnap(antes)); else toast(done, {central:false});
  // confirmação do que acabou de salvar
}
