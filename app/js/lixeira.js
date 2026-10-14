// Cofrim — Excluir lançamentos, lixeira (restaurar, esvaziar) e o aviso com "Desfazer". Depende de formularios.js.
// Saiu de js/comprovantes.js (só mudou de arquivo); carregado logo depois dele no index.html.

function removeItem(){ if (!F) return; const {col, id} = F; closeForm(); removeRec(col, id); } // segundo toque em "Excluir" depois que o formulário fechou
// Exclui um lançamento e oferece "Desfazer" por alguns segundos. Ganho ou gasto que repete e já valia antes do mês na
// tela: pergunta se encerra (some a partir deste mês, os anteriores ficam) ou se sai de todos os meses (tudo).
function removeRec(col, id, tudo){
  const i = db[col].findIndex(x => x.id === id), rec = db[col][i], mes = mesNovo();
  if (i < 0) return tell(ARCH_MSG); // lançamento do arquivo de anos antigos
  if (!tudo && (col === 'incomes' || col === 'expenses') && rec.fixed && rec.start < mes && !(rec.end && rec.end < mes))
    return pickList(`Excluir "${rec.desc}"`, [['fim', `Só a partir de ${monthName(mes)} (os meses anteriores ficam)`], ['tudo', 'De todos os meses']], '',
      v => v === 'fim' ? encerrarRec(rec, mes) : removeRec(col, id, true));
  db[col].splice(i, 1);
  db.tomb[id] = Date.now();
  db.trash.push({col, rec, at:Date.now()});
  save(); render();
  showUndo('Excluído', () => { db[col].splice(i, 0, touch(rec)); delete db.tomb[id]; db.trash = db.trash.filter(t => t.rec !== rec); save(); render(); },
    {dest:{k:'lixeira'}});
}
function encerrarRec(rec, mes){
  const antes = rec.end;
  rec.end = addMonths(mes, -1); touch(rec); save(); render();
  showUndo(`Encerrado: some a partir de ${monthName(mes)}`, () => { if (antes) rec.end = antes; else delete rec.end; touch(rec); save(); render(); });
}
// Lixeira: lançamentos excluídos nos últimos 30 dias (neste aparelho), com opção de restaurar.
const COL_NAMES = {incomes:'Ganho', expenses:'Gasto', installments:'Compra parcelada', investments:'Investimento', goals:'Meta', accounts:'Conta',
  transfers:'Transferência', previsoes:'Previsão'};
function openTrash(){
  settingsOpen = false; F = null;
  const list = db.trash.map((t, i) => ({t, i})).reverse();
  showSheet(`<h3>Lixeira</h3>
    <div class="semTopo hint">O que você exclui fica aqui por 30 dias, só neste aparelho.</div>
    ${list.length ? list.map(({t, i}) => { const r = t.rec || {}, v = r.value ?? r.total ?? r.target;
      const dias = Math.max(0, Math.floor((Date.now() - t.at) / 864e5)); // relógio adiantado em outro aparelho: nunca "há -2 dias"
      const quando = 'excluído ' + (dias ? 'há ' + dias + ' dia' + (dias > 1 ? 's' : '') : 'hoje');
      if (t.col === 'lote') return `<div class="semCursor item"><div class="mid"><b>Planilha ${esc(t.lote.nome)}</b>
        <small>Importação desfeita · ${plural(t.recs.length, 'lançamento', 'lançamentos')} · ${quando}</small></div>
        <button class="btn" style="flex:none;padding:8px 12px" data-onclick="trashRestore(${i});openTrash()">Restaurar</button></div>`;
      return `
      <div class="semCursor item"><div class="mid"><b>${esc(r.desc || r.name || r.ticker || (r.from ? r.from + ' → ' + r.to : t.col === 'previsoes' ? prevNome(r.cat) : 'Sem nome'))}</b>
        <small>${COL_NAMES[t.col] || ''}${v ? ' · ' + fmt(v) : ''} · ${quando}</small></div>
        <button class="btn" style="flex:none;padding:8px 12px" data-onclick="trashRestore(${i});openTrash()">Restaurar</button></div>`; }).join('') : empty('trash', 'A lixeira está vazia.')}
    <div class="btns foot">${list.length ? '<button class="btn danger" data-onclick="trashEmpty()">Esvaziar</button>' : ''}<button class="btn primary" data-onclick="openSettings('dados')">Voltar</button></div>`);
}
function trashRestore(i){
  const t = db.trash.splice(i, 1)[0];
  // Uma importação de planilha desfeita volta inteira, e a importação deixa de estar marcada como desfeita.
  for (const {col, rec} of t.col === 'lote' ? t.recs : [t]){
    if (!db[col].some(r => r.id === rec.id)) db[col].push(touch(rec));
    delete db.tomb[rec.id];
  }
  if (t.col === 'lote'){ const imp = db.imports.find(x => x.id === t.lote.id); if (imp){ delete imp.desfeito; imp.u = Date.now(); } }
  save(); render();
}
// ---------- Importações de planilha (Importar planilha, em planilha-importar.js) ----------
// db.imports = [{id, nome, at, n, u, desfeito?}]; cada lançamento importado guarda imp = o id. Desfazer tira todos de uma
// vez: pelo aviso logo depois de importar (some também a importação) ou depois, pela lista, indo para a Lixeira como
// um item só, que se restaura inteiro.
const IMP_COLS = ['expenses', 'incomes', 'installments'];
function loteTira(id){
  const recs = [], t = Date.now();
  for (const col of IMP_COLS){
    for (const rec of db[col].filter(r => r.imp === id)){ recs.push({col, rec}); db.tomb[rec.id] = t; }
    db[col] = db[col].filter(r => r.imp !== id);
  }
  return recs;
}
async function loteDesfazer(id){
  const imp = db.imports.find(x => x.id === id), n = IMP_COLS.reduce((a, c) => a + db[c].filter(r => r.imp === id).length, 0);
  const sai = n === 1 ? '1 lançamento sai do app e vai para a Lixeira, de onde dá para restaurar por 30 dias.'
    : `${n.toLocaleString('pt-BR')} lançamentos saem do app e vão juntos para a Lixeira, de onde dá para restaurar por 30 dias.`;
  if (!imp || !await ask(`Desfazer a importação da planilha ${imp.nome}?` + '\n' + sai, 'Desfazer importação', true)) return;
  db.trash.push({col:'lote', lote:{id, nome:imp.nome}, recs:loteTira(id), at:Date.now()});
  Object.assign(imp, {desfeito:Date.now(), u:Date.now()});
  save(); render();
  // Refaz a tela de onde veio: a do Importar planilha ou as Configurações › Dados e ajustes.
  if (sheetOpen()) document.querySelector('#sheet h3').textContent === 'Importar planilha' ? planAjuda() : openSettings('dados');
  toast('Importação desfeita: está na Lixeira', {dest:{k:'lixeira'}});
}
// Lista das importações (Configurações › Dados e ajustes e a tela do Importar planilha).
const importacoesHtml = () => !db.imports.length ? '' : `<label>Importações de planilha</label>${[...db.imports].reverse().map(x => `
  <div class="semCursor item"><div class="mid"><b>${esc(x.nome)}</b><small>${new Date(x.at).toLocaleDateString('pt-BR')} · ${plural(x.n, 'lançamento',
    'lançamentos')}${x.desfeito ? ' · desfeita (na Lixeira)' : ''}</small></div>${x.desfeito ? '' : `<button class="btn" style="flex:none;padding:8px 12px"
    data-onclick="loteDesfazer('${x.id}')">Desfazer</button>`}</div>`).join('')}`;
async function trashEmpty(){
  if (!await ask('Esvaziar a lixeira?\nOs lançamentos excluídos não poderão mais ser restaurados.', 'Esvaziar', true)) return;
  db.trash = []; save(); openTrash();
}
// Desfaz uma edição: volta ao estado guardado antes dela. O que mudou fica marcado como "alterado agora"
// (e o que não existia, como excluído), para a volta valer também nos outros aparelhos.
function restoreSnap(json){
  const old = fixDb(JSON.parse(json)), t = Date.now();
  for (const c of COLS){
    const cur = new Map(db[c].map(r => [r.id, JSON.stringify(r)])), ids = new Set(old[c].map(r => r.id));
    for (const r of old[c]) if (cur.get(r.id) !== JSON.stringify(r)) r.u = t;
    for (const r of db[c]) if (!ids.has(r.id)) old.tomb[r.id] = t;
  }
  old.cfgMod = t; old.trash = db.trash;
  loadDb(old); save(); render();
  if (sheetOpen() && !F) closeForm();
}
let snackTimer = 0, undoFn = null;
const showUndo = (text, fn, o) => showAcao(text, 'Desfazer', fn, o);
// Aviso embaixo com um botão (Desfazer, Ver…); some sozinho depois de alguns segundos. Vai para a central de
// notificações (o.central === false não vai); desfazer registra "Desfeito: …" quando o aviso foi registrado.
function showAcao(text, botao, fn, o = {}){
  const s = document.getElementById('snack'), foi = centralRegistra(text, o);
  undoFn = foi && botao === 'Desfazer' ? () => { centralAdd('Desfeito: ' + text, 'info'); fn(); } : fn;
  s.innerHTML = `${esc(text)} <button data-onclick="const f=undoFn;hideSnack();f()">${botao}</button>`; // text pode trazer dado digitado
  s.hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, 6000);
}
// Aviso curto no rodapé, sem botão.
