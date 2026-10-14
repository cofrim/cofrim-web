// Cofrim — Seletores (listas por cima da folha) e confirmações e avisos do app (ask, tell, toast), no lugar das
// caixas do Android. Depende de formularios.js.
// Saiu de js/formularios.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Seletores do app (abrem por cima da folha) ----------
let pickCb = null, pickOpts = [], pickArgs = [];
const pickerOpen = () => document.getElementById('picker').classList.contains('open');
function showPicker(html){
  const p = document.getElementById('picker');
  p.innerHTML = html; p.scrollTop = 0;
  p.classList.add('open'); document.getElementById('pickBg').classList.add('open'); camadaVisivel(p, true);
  a11y(p);
}
function closePicker(){
  document.getElementById('picker').classList.remove('open'); document.getElementById('pickBg').classList.remove('open');
  camadaVisivel(document.getElementById('picker'), false);
  pickCb = null;
}
function picked(v){ const cb = pickCb; closePicker(); if (cb) cb(v); }
// busca: lista longa (moedas, países) com um campo de busca no topo; abre já rolada até a opção escolhida.
// icone(valor): HTML antes do nome de cada opção (ex.: o logotipo do banco, bancoMini).
function pickList(title, options, cur, cb, busca, icone){
  pickCb = cb; pickOpts = options;
  showPicker(`<h3>${esc(title)}</h3>${busca ? '<input id="pickBusca" type="search" placeholder="Buscar" autocomplete="off" data-oninput="pickFiltrar(this.value)">' : ''}<div class="pickList">${options.map(([v, t], i) => `<button type="button" class="${v === cur ? 'on' : ''}" data-onclick="picked(pickOpts[${i}][0])"><span>${icone ? icone(v) : ''}${esc(t)}</span>${v === cur ? I('check') : ''}</button>`).join('')}</div>
    <div class="btns foot"><button class="btn" data-onclick="closePicker()">Cancelar</button></div>`);
  if (busca){ const on = document.querySelector('#picker .pickList .on'); if (on) on.scrollIntoView({block:'center'}); }
}
function pickFiltrar(q){
  const t = plain(q.trim());
  for (const b of document.querySelectorAll('#picker .pickList button')) b.hidden = !!t && !plain(b.textContent).includes(t);
}
function pickMonthP(title, cur, optional, cb, y){
  pickCb = cb; pickArgs = [title, cur, optional];
  y = y || +(cur || curYM).slice(0, 4);
  showPicker(`<h3>${esc(title)}</h3>
    <div class="plano nav"><button data-onclick="pickMonthP(pickArgs[0],pickArgs[1],pickArgs[2],pickCb,${y - 1})" aria-label="Ano anterior">‹</button><b>${y}</b><button data-onclick="pickMonthP(pickArgs[0],pickArgs[1],pickArgs[2],pickCb,${y + 1})" aria-label="Próximo ano">›</button></div>
    <div class="filters">${MESES.map((n, i) => { const m = ymOf(y, i); return `<button class="btn ${m === cur ? 'primary' : ''}" style="text-transform:capitalize${m === curYM ? ';outline:2px solid var(--brand)' : ''}" data-onclick="picked('${m}')">${n.slice(0, 3)}</button>`; }).join('')}</div>
    <div class="btns foot">${optional ? `<button class="btn" data-onclick="picked('')">Sem data</button>` : ''}<button class="btn" data-onclick="closePicker()">Cancelar</button></div>`);
}
function pickDateP(title, cur, cb, ym){
  pickCb = cb; pickArgs = [title, cur];
  const hoje = now.toLocaleDateString('sv');
  ym = ym || (cur || hoje).slice(0, 7);
  const [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1).getDay();
  showPicker(`<h3>${esc(title)}</h3>
    <div class="plano nav"><button data-onclick="pickDateP(pickArgs[0],pickArgs[1],pickCb,'${addMonths(ym, -1)}')" aria-label="Mês anterior">‹</button><b>${monthName(ym)}</b><button data-onclick="pickDateP(pickArgs[0],pickArgs[1],pickCb,'${addMonths(ym, 1)}')" aria-label="Próximo mês">›</button></div>
    <div class="cal">${['dom','seg','ter','qua','qui','sex','sáb'].map(d => `<small>${d}</small>`).join('')}${'<i></i>'.repeat(first)}${[...Array(daysIn(ym))].map((_, i) => { const d = ym + '-' + String(i + 1).padStart(2, '0'); return `<button type="button" class="${d === cur ? 'on' : ''} ${d === hoje ? 'today' : ''}" data-onclick="picked('${d}')">${i + 1}</button>`; }).join('')}</div>
    <div class="btns foot"><button class="btn" data-onclick="picked('${hoje}')">Hoje</button><button class="btn" data-onclick="closePicker()">Cancelar</button></div>`);
}

// ---------- Confirmações e avisos do app (no lugar das caixas do Android) ----------
// ask() devolve uma promessa: true se confirmou. tell() só avisa.
// dlgFoco: o que tinha o foco antes da janela abrir (teclado e leitor de tela voltam para lá ao fechar).
let dlgRes = null, dlgFoco = null;
function ask(msg, ok = 'Confirmar', danger = false, only = false){
  return new Promise(res => {
    if (dlgRes) dlgRes(false);
    else dlgFoco = document.activeElement;
    dlgRes = res;
    document.getElementById('dlgMsg').textContent = msg;
    document.getElementById('dlgBtns').innerHTML = (only ? '' : '<button class="btn" data-onclick="dlgClose(false)">Cancelar</button>') + `<button class="btn ${danger ? 'del' : 'primary'}" data-onclick="dlgClose(true)">${esc(ok)}</button>`;
    document.getElementById('dlg').hidden = false;
    document.querySelector('#dlgBtns button:last-child').focus();
  });
}
const tell = msg => ask(msg, 'OK', false, true);
function dlgClose(v){
  document.getElementById('dlg').hidden = true; const r = dlgRes, f = dlgFoco; dlgRes = null; dlgFoco = null;
  if (f && f.focus && document.contains(f)) f.focus({preventScroll:true});
  if (r) r(v);
}
// Avisos vindos do lado nativo ("Arquivo salvo", falha da câmera…) aparecem no aviso de rodapé do app.
function onToast(text){ toast(text); }

// ---------- Escolher ícone e cor (categorias e grupos) ----------
// Janela por cima com todos os ícones, as cores do app e uma cor personalizada (tom e claridade, em barras que funcionam
// em qualquer celular). pronto(ícone, cor) recebe a escolha; voltar() roda no Cancelar (quem abriu redesenha a sua tela).
let iconeEsc = null; // {icon, color, pronto, voltar}
function escolherIcone(icon, color, pronto, voltar){
  iconeEsc = {icon, color, pronto, voltar};
  showPicker(`<h3>Escolher ícone</h3><div class="icoPrevia" id="iePrevia"></div>
    <label>Ícone</label><div class="iconGrid">${Object.entries(ICON_NAMES).map(([k, n]) => `<button type="button" data-i="${k}" aria-label="${n}"
      title="${n}" data-onclick="iconeEscMuda('icon',this.dataset.i)">${I(k, 23)}</button>`).join('')}</div>
    <label>Cor</label><div class="swatches colorGrid">${CAT_COLORS.map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}"
      aria-label="Cor ${c}" data-onclick="iconeEscMuda('color',this.dataset.c)"></button>`).join('')}</div>
    <label>Cor personalizada</label><div class="corLivre">
      <span class="sw" id="ieLivre"></span><div>
      <small>Tom</small><input id="ieTom" type="range" min="0" max="359" aria-label="Tom" data-oninput="iconeEscLivre()">
      <small>Claridade</small><input id="ieLuz" type="range" min="25" max="70" aria-label="Claridade" data-oninput="iconeEscLivre()"></div></div>
    <div class="btns foot"><button class="btn" data-onclick="iconeEscFim(false)">Cancelar</button>
      <button class="btn primary" data-onclick="iconeEscFim(true)">Pronto</button></div>`);
  const [h, l] = corTomLuz(color);
  document.getElementById('ieTom').value = h; document.getElementById('ieLuz').value = l;
  iconeEscDesenha();
}
function iconeEscMuda(campo, v){ if (iconeEsc){ iconeEsc[campo] = v; iconeEscDesenha(); } }
function iconeEscLivre(){ iconeEscMuda('color', hslHex(+document.getElementById('ieTom').value, 72, +document.getElementById('ieLuz').value)); }
function iconeEscDesenha(){
  const {icon, color} = iconeEsc, livre = !CAT_COLORS.includes(color);
  document.getElementById('iePrevia').innerHTML = `<span class="grpIco" style="background:${color}">${I(icon, 26)}</span>`;
  document.querySelectorAll('#picker .iconGrid button').forEach(b => b.classList.toggle('on', b.dataset.i === icon));
  document.querySelectorAll('#picker .colorGrid button').forEach(b => b.classList.toggle('on', b.dataset.c === color));
  const l = document.getElementById('ieLivre'), tom = +document.getElementById('ieTom').value;
  document.getElementById('ieLuz').style.background = `linear-gradient(90deg,${hslHex(tom, 72, 25)},${hslHex(tom, 72, 70)})`;
  l.style.background = livre ? color : hslHex(+document.getElementById('ieTom').value, 72, +document.getElementById('ieLuz').value);
  l.classList.toggle('on', livre);
}
function iconeEscFim(ok){
  const e = iconeEsc; iconeEsc = null;
  if (e) (ok ? () => e.pronto(e.icon, e.color) : e.voltar || closePicker)();
}
// Tom (0 a 359) e claridade (25 a 70) de uma cor #rrggbb, para as barras da cor personalizada começarem perto dela.
function corTomLuz(hex){
  const [r, g, b] = [1, 3, 5].map(i => parseInt(String(hex).slice(i, i + 2), 16) / 255);
  if ([r, g, b].some(isNaN)) return [250, 50];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2 * 100;
  const h = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60) % 360, Math.round(Math.min(70, Math.max(25, l)))];
}
// Botão "Escolher ícone" das telas de categoria e de grupo: o ícone escolhido, na cor dele.
const iconeBtn = (icon, color, acao) => `<button type="button" class="pickBtn icoBtn" data-onclick="${acao}"><span class="grpIco"
  style="background:${color}">${I(icon, 18)}</span><span>Escolher ícone</span>${I('chev', 14)}</button>`;

