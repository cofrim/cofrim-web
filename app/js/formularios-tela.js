// Cofrim — Formulário na tela: abrir (openForm), desenhar os campos, seletor de categoria e ícone, fechar e salvar.
// Depende de formularios.js (FORMS) e dialogos.js.
// Saiu de js/dialogos.js (só mudou de arquivo); carregado logo depois dele no index.html.

// Tipo no formulário: '' avulso, '1' fixo, 'y' anual, 'n' a cada X meses, 'm' meses escolhidos (ver REP_FIELDS).
const tipoForm = x => x.fixed === 'y' ? (Array.isArray(x.rep) ? 'm' : Number.isInteger(x.rep) ? 'n' : 'y') : x.fixed ? '1' : '';
// preset (opcional): {title, vals, asset, id} para abrir um formulário novo já preenchido.
function openForm(col, item, preset = {}){
  // Lançamento num vale (gasto pago com vale ou crédito de vale): formulário enxuto, só com o que importa para vales.
  formVale = !!preset.vale || !!item && (col === 'expenses' ? valeGasto(item) : col === 'incomes' && valeGanho(item));
  formTipo = col === 'installments' ? preset.tipo || item && item.tipo || '' : '';
  const cfg = FORMS[col], fields = typeof cfg.fields === 'function' ? cfg.fields() : cfg.fields;
  const vals = Object.assign(cfg.defaults ? cfg.defaults() : {}, preset.vals);
  if (item) for (const f of fields){ const v = item[f.k]; vals[f.k] = f.type === 'money' ? moneyStr(v) : f.k === 'fixed' ? tipoForm(item) : v == null ? '' : String(v).replace('.', f.type === 'num' ? ',' : '.'); }
  if (item && repete(item)){ vals.cada = Number.isInteger(item.rep) ? String(item.rep) : ''; vals.meses = Array.isArray(item.rep) ? item.rep.join(',') : ''; }
  if (item && cfg.load) cfg.load(vals, item);
  settingsOpen = false;
  F = {col, cfg, fields, id:preset.id || (item && item.id), vals, inicio:{...vals}, touched:{}, asset:preset.asset || null, vale:formVale,
    sug:preset.sug || null};
  // sug: hora da sugestão do banco que abriu o formulário
  // Lançamento rápido: num registro novo, os campos "more" começam recolhidos.
  const hasMore = fields.some(f => f.more);
  F.more = !hasMore || !!F.id || !!preset.more;
  showSheet(`<h3>${preset.title || cfg.fullTitle || (item ? 'Editar ' : (typeof cfg.fem === 'function' ? cfg.fem() : cfg.fem) ? 'Nova ' : 'Novo ') + (formVale ? (col === 'incomes' ? 'crédito de vale' : 'gasto no vale') : typeof cfg.title === 'function' ? cfg.title() : cfg.title)}</h3>` +
    (!F.id && cfg.top ? cfg.top() : '') +
    fields.map(f => `<div id="w_${f.k}"><label for="f_${f.k}"></label>${fieldHtml(f)}</div>`).join('') +
    (cfg.before ? `<div id="w__before">${cfg.before()}</div>` : '') +
    (hasMore && !F.id ? `<button type="button" class="moreBtn" id="moreBtn" data-onclick="if(F){F.more=!F.more;syncForm()}"></button><div class="hint u-centro" id="moreSum"></div>` : '') +
    `<div class="hint" id="fhint"></div><div class="err" id="ferr"></div>
    <div class="btns foot">${F.id && !cfg.noDelete ? '<button class="btn danger" data-onclick="removeItem()">Excluir</button>' : ''}
      <button class="btn" data-onclick="cancelarForm()">Cancelar</button><button class="btn primary" data-onclick="submitForm()">Salvar</button></div>` +
    (cfg.extra ? cfg.extra() : '') + cadastroHtml(col, item) + histHtml(item));
  for (const f of fields){
    const el = document.getElementById('f_' + f.k);
    el.value = vals[f.k] ?? '';
    // Valor atual que não está mais na lista (ex.: categoria escondida): entra como opção para não se perder.
    if (f.type === 'select' && vals[f.k] && el.value !== vals[f.k]){ el.add(new Option(f.k === 'cat' ? ((PREV_GERAIS[vals.cat] || CAT_GASTO[vals.cat] || CAT_GANHO[vals.cat] || [0, vals.cat])[1]) : vals[f.k], vals[f.k])); el.value = vals[f.k]; }
    // Valores em dinheiro: a pessoa digita só os números e a vírgula dos centavos entra sozinha (1 → 0,01; 1234 → 12,34);
    // no teclado do computador, quem digita a vírgula escreve do jeito de sempre (valorDigitado). Vale para o que é
    // digitado; valores postos pelo app (setField, comprovante lido) já chegam prontos.
    if (f.type === 'money') el.addEventListener('input', e => {
      el.value = valorDigitado(el, e); el.setSelectionRange(el.value.length, el.value.length); });
    el.oninput = el.onchange = () => {
      if (!F) return; // formulário já fechado (toque ou valor que chegou depois de fechar)
      F.vals[f.k] = el.value; F.touched[f.k] = true;
      if (ehBanco(f)) bancoNoCampo(f.k);
      if (cfg.onChange) cfg.onChange(f.k, F.vals, !F.id, F.touched);
      syncForm(f.k);
    };

    if (f.sug) sugBind(el, document.getElementById('sug_' + f.k), f.sug(), ehBanco(f));
  }
  // Categoria: em vez da lista suspensa, um botão por categoria (o <select> continua existindo, escondido).
  syncForm();
  if (F.asset) document.getElementById('assetList').innerHTML = assetPicked(F.asset);
}
// Sugestões (bancos, pessoas…) como botões logo abaixo do campo. A lista nativa do navegador (<datalist>)
// cobria a tela inteira no Android e só fechava escolhendo um item. banco: cada sugestão com o logotipo do banco.
function sugBind(el, box, list, banco){
  const draw = () => {
    const q = el.value.trim().toLowerCase();
    const hits = list.filter(s => s.toLowerCase() !== q && s.toLowerCase().includes(q)).slice(0, 8);
    box.hidden = !hits.length;
    box.innerHTML = hits.map(s => `<button type="button">${banco ? bancoMini(s) : ''}${esc(s)}</button>`).join('');
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
    if (ehBanco(f)) bancoNoCampo(f.k);
  }
  document.getElementById('fhint').textContent = F.cfg.hint ? F.cfg.hint(F.vals) : '';
  const bf = document.getElementById('w__before'), mb = document.getElementById('moreBtn');
  if (bf) bf.hidden = !F.more || !!(F.cfg.semBefore && F.cfg.semBefore(F.vals));
  if (mb){
    mb.innerHTML = I(F.more ? 'close' : 'plus', 16) + (F.more ? 'Menos opções' : 'Mais opções');
    document.getElementById('moreSum').textContent = !F.more && F.cfg.summary ? F.cfg.summary(F.vals) : '';
  }

  // Digitando num campo de texto ou de número, os botões das listas e das categorias só são redesenhados se algum valor
  // de lista mudou (o onChange pode mudar um): redesenhar tudo a cada letra deixava a digitação lenta no celular.
  const TEXTO = ['text', 'money', 'int', 'num'], campo = skip && F.fields.find(f => f.k === skip);
  const listas = JSON.stringify(F.fields.filter(f => !TEXTO.includes(f.type)).map(f => F.vals[f.k] ?? ''));
  if (!(campo && TEXTO.includes(campo.type) && listas === F.listas)){ drawPicks(); drawCatPick(); }
  F.listas = listas;
  document.querySelectorAll('.iconGrid button').forEach(b => b.classList.toggle('on', b.dataset.i === F.vals.icon));
  document.querySelectorAll('.colorGrid button').forEach(b => b.classList.toggle('on', b.dataset.c === F.vals.color));
}
// Categoria: em vez da lista suspensa, botões (o <select> continua existindo, escondido, com as opções do campo).
// Nos ganhos, gastos, parceladas e previsões (campo com grupos: 'gasto' ou 'ganho'), a escolha é por grupo (drawCatGrupos).
// Nos outros (investimentos, qual vale), um botão por opção.
function drawCatPick(){
  const cp = document.getElementById('catPick');
  if (!cp) return;
  const f = F.fields.find(x => x.k === 'cat');
  if (f.grupos) return drawCatGrupos(cp, f.grupos);
  const M = F.col === 'investments' ? CAT_INV : CAT_GASTO;
  cp.innerHTML = [...document.getElementById('f_cat').options].map(({value:v, text:t}) => `<button type="button" class="${v === F.vals.cat ? 'on' : ''}" `
    + `data-v="${esc(v)}" data-onclick="pickCat(this.dataset.v)">${I((M[v] || ['tag'])[0], 17)}${esc(t)}</button>`).join('');
}
// Escolha por grupo: a categoria escolhida em "Grupo › Categoria" (tocar abre o grupo dela), as opções gerais das
// previsões (PREV_GERAIS), as recentes, a busca e a grade dos grupos (tocar abre a janela do grupo, catGrupoAbre; segurar
// edita o grupo). Segurar uma categoria (escolhida, recente ou da busca) abre Editar e Excluir (catSegurar). O campo de
// busca é feito uma vez só, para não perder o foco ao redesenhar o resto.
function drawCatGrupos(cp, type){
  const C = CAT_OF[type], cur = F.vals.cat, pode = catPodem(), G = GRUPOS_CAT[type];
  F.catOk = !!(C[cur] && !C[cur][3]);
  if (!cp.dataset.grupos){
    cp.dataset.grupos = type; cp.classList.add('catGrupos');
    cp.innerHTML = `<div id="catTopo"></div><div class="search catBusca">${I('search')}<input id="catBusca" type="search" `
      + `placeholder="Buscar categoria" autocomplete="off" data-oninput="catBuscar(this.value)"></div><div id="catGrade"></div>`;
    seguraNo(cp, b => b.dataset.g ? grupoEditor(type, b.dataset.g, formCatRefaz) : catSegurar(type, b.dataset.v));
  }
  const chip = k => `<button type="button" class="${k === cur ? 'on' : ''}" data-v="${esc(k)}" data-onclick="catBuscaEscolhe(this.dataset.v)">`
    + `${I((C[k] || PREV_GERAIS[k])[0], 17)}${C[k] ? catNomeHtml(type, k) : esc(PREV_GERAIS[k][1])}</button>`;
  const gerais = Object.keys(PREV_GERAIS).filter(k => pode.has(k)), rec = catRecentes(type, pode);
  const g = C[cur] && grupoDe(type, cur), gc = g && grupoInfo(type, g);
  document.getElementById('catTopo').innerHTML = (gc ? `<button type="button" class="catSel" data-v="${esc(cur)}" data-g-abre="${esc(g)}" `
      + `data-onclick="catGrupoAbre(this.dataset.gAbre)"><span class="grpIco" style="background:${gc[2]}">${I(C[cur][0], 17)}</span>`
      + `<span>${catNomeHtml(type, cur)}</span><small>Trocar</small></button>`
    : PREV_GERAIS[cur] ? `<div class="catSel">${I(PREV_GERAIS[cur][0], 17)}<span>${esc(PREV_GERAIS[cur][1])}</span></div>` : '')
    + (gerais.length ? `<div class="catPick">${gerais.map(chip).join('')}</div>` : '')
    + (rec.length ? `<div class="catRot">Recentes</div><div class="catPick">${rec.map(chip).join('')}</div>` : '');
  const q = nomeComparar(F.catBusca || '').split(/\s+/).filter(Boolean);
  if (q.length){
    const achou = Object.keys(C).filter(k => pode.has(k) && (!C[k][3] || k === cur) && q.every(p => catBuscaTexto(type, k).includes(p)));
    document.getElementById('catGrade').innerHTML = achou.length ? `<div class="catPick">${achou.map(chip).join('')}</div>`
      : `<div class="hint">Nenhuma categoria encontrada.</div><div class="catPick"><button type="button" class="more" data-onclick="catBuscaCria()">${I('plus', 17)}`
        + `Criar a categoria "${esc(F.catBusca.trim())}"</button></div>`;
    return;
  }
  const grupos = Object.entries(G).map(([k, c]) => `<button type="button" class="${k === g ? 'on' : ''}" data-g="${esc(k)}" `
    + `data-onclick="catGrupoAbre(this.dataset.g)"><span class="grpIco" style="background:${c[2]}">${I(c[0], 20)}</span><small>${esc(c[1])}</small></button>`);
  const novo = `<button type="button" class="novo" data-onclick="formGrupoNovo()"><span class="grpIco">${I('plus', 20)}</span><small>Novo grupo</small></button>`;
  document.getElementById('catGrade').innerHTML = `<div class="catRot">Grupos</div><div class="grpGrade">${grupos.join('')}${novo}</div>`;
}
const catPodem = () => new Set([...document.getElementById('f_cat').options].map(o => o.value));
// "Grupo › Categoria" com cada nome num texto próprio (a tradução troca um de cada vez).
const catNomeHtml = (type, k) => `${esc(grupoInfo(type, grupoDe(type, k))[1])}<span class="catSep"> › </span>${esc(CAT_OF[type][k][1])}`;
// Texto em que a busca procura: "Grupo Categoria" sem acentos, em português e, com o app em outro idioma, traduzido.
function catBuscaTexto(type, k){
  const nomes = [grupoInfo(type, grupoDe(type, k))[1], CAT_OF[type][k][1]];
  return nomeComparar(nomes.join(' ') + (lang() === 'pt' ? '' : ' ' + nomes.map(trText).join(' ')));
}
// Categorias usadas por último (até 6, sem repetir): do lançamento criado ou editado mais recentemente para o mais
// antigo (sem essas datas, a ordem em que estão guardados). Só as que existem, não estão escondidas e cabem no campo.
function catRecentes(type, pode){
  const C = CAT_OF[type], r = [];
  const L = (type === 'ganho' ? db.incomes : db.expenses.concat(db.installments)).map((x, i) => [Math.max(x.cri || 0, x.u || 0), i, x.cat]);
  L.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  for (const [, , k] of L) if (!r.includes(k) && pode.has(k) && C[k] && !C[k][3] && r.push(k) >= 6) break;
  return r;
}
function catBuscar(q){ if (!F) return; F.catBusca = q; drawCatPick(); }
// Escolha pela busca, pelas recentes ou pelas gerais: escolhe e limpa a busca.
function catBuscaEscolhe(k){
  if (!F) return;
  const b = document.getElementById('catBusca');
  if (b) b.value = '';
  F.catBusca = '';
  pickCat(k);
}
// Busca sem resultado: cria a categoria com o texto digitado, escolhendo o grupo (novaCategoria) e já a escolhe.
function catBuscaCria(){
  if (!F) return;
  novaCategoria(F.fields.find(x => x.k === 'cat').grupos, k => { F.catBusca = ''; document.getElementById('catBusca').value = ''; formCatNova(k); },
    (F.catBusca || '').trim());
}
// Janela de um grupo, por cima do formulário: as categorias dele (tocar escolhe e fecha; segurar abre Editar e Excluir),
// "Nova categoria neste grupo" e "Editar grupo". Fecha no Fechar, no voltar ou tocando fora, sem perder o formulário.
function catGrupoAbre(g){
  if (!F) return;
  const type = F.fields.find(x => x.k === 'cat').grupos, C = CAT_OF[type], cur = F.vals.cat, pode = catPodem();
  if (!GRUPOS_CAT[type][g]) return;
  const [ico, nome, cor] = GRUPOS_CAT[type][g], ks = catsDoGrupo(type, g).filter(k => pode.has(k) && (!C[k][3] || k === cur));
  showPicker(`<h3 class="grpTit"><span class="grpIco" style="background:${cor}">${I(ico, 18)}</span>${esc(nome)}</h3>
    ${ks.length ? `<div class="pickList" id="catGrpLista">${ks.map(k => `<button type="button" class="${k === cur ? 'on' : ''}" data-v="${esc(k)}"
      data-onclick="catGrupoEscolhe(this.dataset.v)"><span>${I(C[k][0], 18)} ${esc(C[k][1])}</span>${k === cur ? I('check') : ''}</button>`).join('')}</div>`
      : '<div class="hint">Nenhuma categoria neste grupo ainda.</div>'}
    <div class="btns col"><button class="btn" data-g="${esc(g)}" data-onclick="novaCategoria('${type}',formCatNova,'','',this.dataset.g)">`
      + `${I('plus', 16)}Nova categoria neste grupo</button></div>
    <div class="btns foot"><button class="btn" data-g="${esc(g)}" data-onclick="grupoEditor('${type}',this.dataset.g,formCatRefaz)">Editar grupo</button>
      <button class="btn primary" data-onclick="closePicker()">Fechar</button></div>`);
  const l = document.getElementById('catGrpLista');
  if (l) seguraNo(l, b => catSegurar(type, b.dataset.v));
}
function catGrupoEscolhe(k){ closePicker(); catBuscaEscolhe(k); }
// Novo grupo sem sair do formulário: ao criar, abre a janela dele (para pôr categorias).
function formGrupoNovo(){
  if (F) grupoEditor(F.fields.find(x => x.k === 'cat').grupos, '', g => { formCatRefaz(); catGrupoAbre(g); });
}
// Refaz as opções do campo de categoria (as categorias mudaram); a escolhida, se escondida, continua como opção.
function catOpcoes(){
  const f = F.fields.find(x => x.k === 'cat'), el = document.getElementById('f_cat'), cur = F.vals.cat, C = f.grupos && CAT_OF[f.grupos];
  el.innerHTML = '';
  for (const [v, t] of typeof f.options === 'function' ? f.options() : f.options) el.add(new Option(t, v));
  if (C && C[cur] && el.querySelector(`option[value="${CSS.escape(cur)}"]`) === null) el.add(new Option(C[cur][1], cur));
}
// Categoria criada pelo "+ Nova categoria" (novaCategoria): refaz a lista do campo e a escolhe; o resto do formulário fica.
function formCatNova(k){
  if (!F) return;
  catOpcoes(); pickCat(k);
}
// Depois de editar ou excluir uma categoria ou um grupo com o formulário aberto: refaz as opções e mantém a escolhida
// (com o grupo novo, se ela mudou de grupo); se ela foi apagada, limpa a escolha e avisa.
function formCatRefaz(){
  if (!F) return;
  const f = F.fields.find(x => x.k === 'cat'), C = f.grupos && CAT_OF[f.grupos], cur = F.vals.cat, sumiu = F.catOk && C && !(C[cur] && !C[cur][3]);
  catOpcoes();
  if (!sumiu) return pickCat(cur);
  pickCat('');
  toast('A categoria escolhida foi apagada. Escolha outra.');
}
// Segurar um botão (meio segundo; no PC, o botão direito) chama aoSegurar(botão), por cima do formulário, sem perder o
// que já foi preenchido. O toque que segue o segurar não vale como toque. Botões de categoria (data-v) e de grupo (data-g).
let catSegurou = 0;
function seguraNo(el, aoSegurar){
  let t = 0, x0 = 0, y0 = 0;
  const solta = () => clearTimeout(t), botao = e => e.target.closest('[data-v],[data-g]');
  const segura = b => { solta(); if (Date.now() - catSegurou > 800) aoSegurar(b); catSegurou = Date.now(); };
  el.onpointerdown = e => { const b = botao(e); solta(); if (b){ x0 = e.clientX; y0 = e.clientY; t = setTimeout(() => segura(b), 500); } };
  el.onpointermove = e => { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 10) solta(); };
  el.onpointerup = el.onpointercancel = el.onpointerleave = solta;
  el.oncontextmenu = e => { const b = botao(e); if (b){ e.preventDefault(); segura(b); } };
  el.onclick = e => { if (Date.now() - catSegurou < 700) e.stopPropagation(); };
}
function catSegurar(type, k){
  const c = CAT_OF[type][k];
  if (!F || !c) return;
  const base = BASE_CATS[type][k], aviso = 'Categoria que já vem no app: dá para editar, mas não para excluir. Para tirá-la da lista, '
    + 'esconda em Configurações › Categorias.';
  showPicker(`<h3>${I(c[0], 22)} ${esc(c[1])}</h3>${base ? `<div class="hint">${aviso}</div>` : ''}
    <div class="btns foot"><button class="btn" data-onclick="closePicker()">Cancelar</button>
      ${base ? '' : `<button class="btn del" data-onclick="catSeguraExclui('${type}','${esc(k)}')">${I('trash', 17)}Excluir</button>`}
      <button class="btn primary" data-onclick="novaCategoria('${type}',formCatRefaz,'','${esc(k)}')">Editar</button></div>`);
}
function catSeguraExclui(type, k){
  closePicker();
  deleteCat(type, k, formCatRefaz);
}
function pickCat(v){ if (!F) return; const el = document.getElementById('f_cat'); el.value = v; el.onchange(); }
function pickIcon(k, v){ const el = document.getElementById('f_' + k); el.value = v; el.oninput(); }
// O que mudou entre duas versões de um lançamento, em texto ("valor R$ 10,00 → R$ 12,00"). '' se nada relevante mudou.
const DIFF_FIELDS = [['value', 'valor', 1], ['total', 'total', 1], ['target', 'meta', 1], ['saved', 'guardado', 1], ['desc', 'descrição'],
  ['name', 'nome'], ['cat', 'categoria'],
  ['bank', 'banco'], ['pay', 'pagamento'], ['start', 'mês'], ['end', 'até'], ['day', 'dia'], ['due', 'vencimento'], ['n', 'parcelas'],
  ['paid', 'pagas'], ['tags', 'etiquetas']];
function diffRec(a, b){
  const show = (k, v, money) => v === '' || v == null ? 'vazio' : money ? shown(() => fmt(v)) : k === 'cat' ? (PREV_GERAIS[v] || CAT_GASTO[v] || CAT_GANHO[v] || CAT_INV[v] || [0, v])[1] : k === 'pay' ? PAY[v] || v : String(v);
  return DIFF_FIELDS.filter(([k]) => (a[k] ?? '') !== (b[k] ?? '')).map(([k, nome, money]) => `${nome} ${show(k, a[k], money)} → ${show(k, b[k], money)}`).join('; ');
}
// Ao abrir um ganho, gasto ou parcelada: quando foi criado no app e editado pela última vez (só o que estiver guardado).
const dataHora = t => new Date(t).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'});
const cadastroHtml = (col, item) => {
  if (!item || !['incomes', 'expenses', 'installments'].includes(col) || !(item.cri || item.edi || item.imp)) return '';
  const imp = item.imp && db.imports.find(x => x.id === item.imp);
  const partes = [item.cri && 'criado em ' + dataHora(item.cri), item.edi && 'editado em ' + dataHora(item.edi), imp && 'importado da planilha ' + esc(imp.nome)];
  return `<div class="hint cadastro">${cap(partes.filter(Boolean).join(' · '))}</div>`;
};
const histHtml = item => item && item.h && item.h.length ? `<label>Histórico de alterações</label>${[...item.h].reverse().map(h =>
  `<div class="hint u-mt4"><b>${dataHora(h.t)}</b> · ${esc(h.d)}</div>`).join('')}` : '';
// "Cancelar" de um formulário aberto pela lista de boas-vindas volta para ela (como o "Salvar").
function cancelarForm(){ const voltar = welcomeOn; closeForm(); if (voltar) openWelcome(); }
// Fechar sem querer (tocar fora, arrastar a folha para baixo, o voltar do Android) não perde o que foi digitado num
// formulário: pergunta antes. O "Cancelar" do formulário fecha direto.
async function fecharFolha(){
  const mudou = F && F.inicio && Object.keys(F.touched).some(k => String(F.vals[k] ?? '') !== String(F.inicio[k] ?? ''));
  if (mudou && !await ask('Descartar o que foi digitado?', 'Descartar', true)) return;
  closeForm();
}
function closeForm(){
  settingsOpen = false;
  if (explorarOrigem && explorarOrigem.raiz !== undefined) explorarOrigem = null;
  // Janela de uma parte de aba (Explorar): fechar ela esquece; fechar um formulário aberto por ela faz a janela voltar.
  if (document.querySelector('#sheet .blocoJanela')) explorarJanela = null; else if (explorarJanela) setTimeout(explorarReabre, 0);
  welcomeOn = false;
  closePicker();
  try { localStorage.removeItem(DRAFT); } catch(e){}
  document.getElementById('sheet').classList.remove('open'); camadaVisivel(document.getElementById('sheet'), false);
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
    if (f.k === 'fixed'){ out.fixed = ['y', 'n', 'm'].includes(raw) ? 'y' : !!raw; if (raw === 'n' || raw === 'm') out.repTipo = raw; continue; }
    if (f.type === 'meses'){ out[f.k] = raw; continue; }
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
  if (velho && velho.id){ const rec = db[F.col].find(x => x.id === F.id); if (rec) rec.edi = Date.now(); } // editado pela pessoa
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
