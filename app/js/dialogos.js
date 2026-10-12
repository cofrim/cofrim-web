// Cofrim — Seletores (listas por cima da folha) e confirmações e avisos do app (ask, tell, toast), no lugar das
// caixas do Android. Depende de formularios.js.
// Saiu de js/formularios.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Seletores do app (abrem por cima da folha) ----------
let pickCb = null, pickOpts = [], pickArgs = [];
const pickerOpen = () => document.getElementById('picker').classList.contains('open');
function showPicker(html){
  const p = document.getElementById('picker');
  p.innerHTML = html; p.scrollTop = 0;
  p.classList.add('open'); document.getElementById('pickBg').classList.add('open');
  a11y(p);
}
function closePicker(){
  document.getElementById('picker').classList.remove('open'); document.getElementById('pickBg').classList.remove('open');
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
let dlgRes = null;
function ask(msg, ok = 'Confirmar', danger = false, only = false){
  return new Promise(res => {
    if (dlgRes) dlgRes(false);
    dlgRes = res;
    document.getElementById('dlgMsg').textContent = msg;
    document.getElementById('dlgBtns').innerHTML = (only ? '' : '<button class="btn" data-onclick="dlgClose(false)">Cancelar</button>') + `<button class="btn ${danger ? 'del' : 'primary'}" data-onclick="dlgClose(true)">${esc(ok)}</button>`;
    document.getElementById('dlg').hidden = false;
  });
}
const tell = msg => ask(msg, 'OK', false, true);
function dlgClose(v){ document.getElementById('dlg').hidden = true; const r = dlgRes; dlgRes = null; if (r) r(v); }
// Avisos vindos do lado nativo ("Arquivo salvo", falha da câmera…) aparecem no aviso de rodapé do app.
function onToast(text){ toast(text); }
