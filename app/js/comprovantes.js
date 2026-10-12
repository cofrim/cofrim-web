// Cofrim — Comprovantes: a foto anexada a um gasto (tirar, escolher, ver, guardar no Drive). Depende de
// formularios.js.
// Saiu de js/formularios.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Comprovantes (foto anexada a um gasto) ----------
// A foto é reduzida e guardada neste aparelho (no APK, em arquivo; na prévia do PC, no armazenamento do navegador);
// o lançamento guarda apenas photo:true. Na sincronização ela é enviada para a conta Google como foto-<id>.json
// (fila em sync.up / sync.del), e outro aparelho a baixa na primeira vez em que o comprovante é aberto.
const photoFile = id => `foto-${id}.json`;
function queuePhoto(kind, id){
  if (!canSync()) return;
  sync.up = sync.up.filter(i => i !== id); sync.del = sync.del.filter(i => i !== id);
  sync[kind].push(id); saveSync();
}
// Cada comprovante é tentado em separado. Um que falha 5 vezes sai da fila (e vai para o Diagnóstico),
// para não ser reenviado para sempre; sem internet não conta como tentativa.
async function syncPhotos(){
  const tries = sync.tries = sync.tries || {};
  const run = async (kind, id, fn) => {
    try { await fn(); delete tries[id]; sync[kind] = sync[kind].filter(i => i !== id); }
    catch(e){
      if (e && e.status === 0) return false;
      tries[id] = (tries[id] || 0) + 1;
      if (tries[id] >= 5){ delete tries[id]; sync[kind] = sync[kind].filter(i => i !== id);
        logErr('comprovante', `desisti de ${kind === 'up' ? 'enviar' : 'apagar'} ${id}: ${e && e.status || e}`); }
    }
    saveSync();
    return true;
  };
  for (const id of [...sync.up]) if (!await run('up', id, async () => {
    const data = photoLoad(id);
    if (data){ const f = (await driveList(`name='${photoFile(id)}'`))[0]; await driveWrite(f && f.id, photoFile(id), JSON.stringify(data)); }
  })) return;
  for (const id of [...sync.del]) if (!await run('del', id, async () => {
    const f = (await driveList(`name='${photoFile(id)}'`))[0];
    if (f) ok(await drive('DELETE', `${DRIVE}/drive/v3/files/${f.id}`));
  })) return;
}
const photoKey = id => 'financas-foto-' + id;
const nativePhotos = () => temNativo('fotoSalvar');
function photoLoad(id){ if (nativePhotos()) return nativo('fotoLer', id); try { return localStorage.getItem(photoKey(id)) || ''; } catch(e){ return ''; } }
function photoSave(id, data){ if (demoOn) return; if (nativePhotos()) nativo('fotoSalvar', id, data);
  else try { localStorage.setItem(photoKey(id), data); } catch(e){} }
function photoDelete(id){ if (demoOn) return; if (nativePhotos()) nativo('fotoApagar', id); else try { localStorage.removeItem(photoKey(id)); } catch(e){} }
// No celular há dois caminhos: a câmera (aberta pelo app, ver tirarFoto em MainActivity) e a galeria (seletor de arquivos).
const canCam = () => temNativo('tirarFoto');
function photoSection(){
  const has = !F.pick && (F.photo !== undefined ? !!F.photo : !!(F.id && (db.expenses.find(x => x.id === F.id) || {}).photo));
  const gallery = `document.getElementById('photoIn').click()`;
  return `<div id="photoBox"><label>Comprovante</label><div class="semTopo btns">${has
    ? `<button class="btn" data-onclick="photoView()">Ver</button><button class="btn" data-onclick="photoSwap()">Trocar</button><button class="btn danger" data-onclick="photoSet('')">Remover</button>`
    : canCam() ? `<button class="btn" data-onclick="photoCam()">Tirar foto</button><button class="btn" data-onclick="${gallery}">${I('upload')}Galeria</button>`
    : `<button class="btn" data-onclick="${gallery}">${I('upload')}Anexar foto do comprovante</button>`}</div>
    ${has ? '' : '<div class="hint">Tire a foto na hora ou escolha uma da galeria.</div>'}</div>`;
}
function photoDraw(){ document.getElementById('photoBox').outerHTML = photoSection(); }
function photoSet(v){
  if (!F) return;
  F.photo = v; F.pick = false; photoDraw();
  if (v && temNativo('lerTexto')) nativo('lerTexto', v); // o texto lido chega em onTextoFoto
}
// Do texto de um comprovante, tira o valor (o da linha de "total"/"valor"; senão, o maior), a data e o nome da loja (a
// primeira linha com cara de nome, nas primeiras do cupom: sem números de documento, data ou valor).
function readReceipt(text){
  const valores = l => [...l.matchAll(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})(?![\d,])/g)].map(m => parseNum(/,/.test(m[1]) ? m[1] : m[1].replace('.', ',')));
  const linhas = String(text).split(/\n/), comTotal = linhas.filter(l => /total|valor|pagar|pago/i.test(l)).flatMap(valores);
  const todos = linhas.flatMap(valores), value = comTotal.length ? comTotal[comTotal.length - 1] : todos.length ? Math.max(...todos) : 0;
  const d = String(text).match(/\b(\d{2})\/(\d{2})\/(\d{4}|\d{2})\b/);
  const date = d && +d[2] >= 1 && +d[2] <= 12 && +d[1] >= 1 && +d[1] <= 31 ? `${d[3].length === 2 ? '20' + d[3] : d[3]}-${d[2]}-${d[1]}` : '';
  const loja = linhas.slice(0, 6).map(l => l.trim()).find(l => (l.match(/\p{L}/gu) || []).length >= 3 && l.length <= 40
    && !/cnpj|cpf|cupom|nota|fiscal|extrato|comprovante|data|hora|total|valor|pix|transfer|pagamento|r\$|\d{3}|\d[.,]\d{2}|www|http|@/i.test(l)) || '';
  const desc = loja.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase()).replace(/\s+(Ltda|Me|Eireli|S\.?a\.?)\.?$/i, '');
  return {value, date, desc};
}
// Chamado pelo app com o texto lido da foto: preenche o valor (se estiver vazio) e, num gasto novo, a descrição (com a
// categoria que ela sugere), o mês e o dia. Texto vazio: não deu para ler, e o app avisa.
function onTextoFoto(text){
  if (!F || F.col !== 'expenses') return;
  const r = readReceipt(text), partes = [];
  if (r.value > 0 && !(parseMoney(F.vals.value) > 0)){ F.vals.value = moneyStr(r.value); partes.push(shown(() => fmt(r.value))); }
  if (r.desc && (r.value > 0 || r.date) && !F.id && !String(F.vals.desc || '').trim()){ // nome só num comprovante de verdade
    F.vals.desc = r.desc; partes.push(r.desc);
    const c = db.catMemo[plain(r.desc)] || guessCat(r.desc); if (c && CAT_GASTO[c] && !F.touched.cat) F.vals.cat = c;
  }
  if (r.date && !F.id && !F.touched.start && !F.vals.fixed){ F.vals.start = r.date.slice(0, 7); F.vals.day = String(+r.date.slice(8));
    partes.push(fmtDate(r.date)); }
  if (!partes.length) return toast('Não consegui ler o comprovante. A foto ficou anexada; preencha o valor à mão.');
  syncForm();
  toast(`Li no comprovante: ${partes.join(', ')}. Confira antes de salvar.`);
}
// Atalho "Lançar pelo comprovante" (Explorar): um gasto novo já com a câmera aberta (ou a galeria, sem câmera).
function lerComprovante(){
  openForm('expenses'); F.more = true; syncForm();
  if (canCam()) photoCam(); else document.getElementById('photoIn').click();
}
function photoSwap(){ if (canCam()){ F.pick = true; photoDraw(); } else document.getElementById('photoIn').click(); }
// Rascunho do formulário: o Android pode fechar o app enquanto a câmera está aberta; na volta, o formulário é remontado.
const DRAFT = 'financas-rascunho';
function photoCam(){
  if (demoBloqueia()) return;
  try { localStorage.setItem(DRAFT, JSON.stringify({col:F.col, id:F.id || null, vals:F.vals, touched:F.touched, tab:state.tab, month:state.month}));
    } catch(e){}
  nativo('tirarFoto');
}
// Chamado pelo app quando a foto da câmera fica pronta (e na abertura, caso o app tenha sido fechado no meio).
function onFoto(){
  const data = canCam() && temNativo('fotoCapturada') ? nativo('fotoCapturada') : '';
  if (!data) return;
  if (!document.getElementById('photoBox') || !document.getElementById('sheet').classList.contains('open')){
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT)); } catch(e){}
    if (!d || !FORMS[d.col]) return;
    state.tab = d.tab; state.month = d.month; render();
    openForm(d.col, d.id ? db[d.col].find(x => x.id === d.id) : null);
    Object.assign(F.vals, d.vals); F.touched = d.touched || {}; F.more = true;
    for (const f of F.fields){ const el = document.getElementById('f_' + f.k); if (el) el.value = F.vals[f.k] ?? ''; }
    syncForm();
  }
  photoSet(data);
}
function photoChosen(input){
  if (demoOn){ input.value = ''; return demoBloqueia(); }
  const file = input.files[0]; input.value = '';
  if (!file) return;
  const img = new Image();
  img.onload = () => { // reduz para no máximo 1280 px no lado maior, em JPEG
    const k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(img.src);
    photoSet(c.toDataURL('image/jpeg', .72));
  };
  img.onerror = () => avisoErro('imagem');
  img.src = URL.createObjectURL(file);
}
async function photoView(){
  const id = F.id, box = document.getElementById('lightbox');
  let src = F.photo || photoLoad(id);
  if (!src && canSync() && sync.on){ // foto anexada em outro aparelho: busca na conta e guarda aqui
    document.getElementById('ferr').textContent = 'Baixando o comprovante…';
    try { const f = (await driveList(`name='${photoFile(id)}'`))[0]; if (f){ src = await driveGet(f.id); photoSave(id, src); } } catch(e){}
    if (F) document.getElementById('ferr').textContent = '';
  }
  if (!src) return tell('Não encontrei a foto deste comprovante. Se ela foi anexada em outro aparelho, abra o app nele com internet para enviá-la.');
  box.querySelector('img').src = src; box.hidden = false;
}
