// Cofrim — Planilha do Google ligada ao app.
// Carregado pelo index.html depois do sincronizacao.js (usa fam(), SHEETS e a sincronização de lá).
// A pessoa cria, pelo app, uma planilha na própria conta Google com as abas Gastos e Ganhos. A cada sincronização
// (sheetSync, chamada pelo syncNow) o app lê a planilha, traz para o app o que foi mexido nela e regrava as abas com
// o estado do app. Assim dá para lançar no app ou na planilha, e o lançamento aparece nos dois lugares.
// Como o app sabe o que foi mexido na planilha:
// - linha sem ID (coluna A, escondida): lançamento novo, digitado na planilha;
// - linha com ID cujo conteúdo não bate com a marca da última coluna (escondida): foi editada na planilha;
// - ID que estava na planilha na última gravação (lista na aba escondida _app) e sumiu: a linha foi apagada lá,
//   e o lançamento vai para a lixeira do app (dá para restaurar por 30 dias).
// Se o mesmo lançamento mudou nos dois lados, vale a planilha. Compras parceladas, investimentos e contas não vão
// para a planilha. O endereço dela fica em db.prefs.sheet (acompanha a conta da pessoa em todos os aparelhos).
const SHEET_TIPOS = [['', 'Só neste mês'], ['1', 'Fixo (todo mês)'], ['y', 'Anual']];
// Em alguns meses (repete, em calculos.js): na planilha, "A cada 6 meses" ou "Meses: jan, fev, mar" (a lista da coluna
// sugere os intervalos mais comuns; outro valor também vale).
const SHEET_REP = ['A cada 2 meses', 'A cada 3 meses', 'A cada 4 meses', 'A cada 6 meses'];
const sheetTipo = x => repete(x) ? (Array.isArray(x.rep) ? 'Meses: ' + x.rep.map(m => MESES[m - 1].slice(0, 3)).join(', ') : `A cada ${x.rep} meses`)
  : SHEET_TIPOS.find(t => t[0] === (x.fixed === 'y' ? 'y' : x.fixed ? '1' : ''))[1];
// rep do texto da coluna Tipo (tp já sem acentos e em minúsculas); undefined se não é de alguns meses.
function sheetRep(tp){
  const n = tp.match(/^a cada (\d+) mes/);
  if (n) return +n[1];
  const l = tp.match(/^meses?\s*:\s*(.+)$/);
  if (!l) return undefined;
  const ms = l[1].split(/[\s,;]+/).map(t => MESES.findIndex(m => plain(m).slice(0, 3) === t.slice(0, 3)) + 1).filter(m => m > 0);
  return ms.length ? [...new Set(ms)].sort((a, b) => a - b) : undefined;
}
const SHEET_TABS = {
  expenses:{nome:'Gastos', pay:true, cats:() => CAT_GASTO},
  incomes:{nome:'Ganhos', pay:false, cats:() => CAT_GANHO}};
const sheetCols = T => ['ID', 'Mês (AAAA-MM)', 'Dia', 'Descrição', 'Categoria', 'Valor', 'Banco / conta', ...(T.pay ? ['Pagamento'] : []), 'Tipo',
  'Até (AAAA-MM)', 'app'];
const colLetter = n => String.fromCharCode(64 + n);
const sheetId = () => (db.prefs && db.prefs.sheet) || '';
const sheetUrl = () => 'https://docs.google.com/spreadsheets/d/' + sheetId();

// Células de um lançamento (sem o ID e sem a marca), como o app as grava.
function sheetCells(x, col){
  const T = SHEET_TABS[col], c = T.cats()[x.cat];
  return [x.start || '', String((col === 'expenses' && x.fixed ? x.due : x.day) || ''), x.desc || '', c ? c[1] : '', round2(x.value || 0), x.bank || '',
    ...(T.pay ? [PAY[x.pay] || ''] : []), sheetTipo(x), x.end || ''];
}
// Marca do conteúdo de uma linha: números e textos em forma única, para "5" e 5 ou "45,9" e 45.9 darem o mesmo.
function sheetHash(cells){
  const s = cells.map(v => typeof v === 'number' || /^-?\d+([.,]\d+)?$/.test(String(v).trim()) ? String(round2(typeof v === 'number' ? v : parseMoney(v))) : String(v ?? '').trim()).join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
// Mês digitado na planilha: 2026-10, 10/2026, 03/10/2026 ou uma data do Sheets (número). Sem nada: o mês atual.
function sheetMonth(v){
  const s = String(v ?? '').trim(), ym = (y, m) => +m >= 1 && +m <= 12 ? `${y}-${String(+m).padStart(2, '0')}` : '';
  let m;
  if (typeof v === 'number' && v > 20000){ const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5);
    return {ym:ym(d.getUTCFullYear(), d.getUTCMonth() + 1), day:d.getUTCDate()}; }
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/))) return {ym:ym(m[1], m[2]), day:+m[3] || 0};
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return {ym:ym(m[3], m[2]), day:+m[1]};
  if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return {ym:ym(m[2], m[1])};
  return {ym:''};
}
// Campos de um lançamento a partir de uma linha da planilha (c = células sem o ID e sem a marca). null = linha vazia.
function sheetRead(c, col){
  const T = SHEET_TABS[col], [mes, dia, desc, cat, valor, banco] = c, p = T.pay ? 1 : 0, pay = T.pay ? c[6] : '', tipo = c[6 + p], ate = c[7 + p];
  const value = typeof valor === 'number' ? valor : parseMoney(valor);
  if (!String(desc).trim() && !(value > 0)) return null;
  const cats = T.cats(), t = plain(String(cat).trim());
  const key = Object.keys(cats).find(k => plain(cats[k][1]) === t) || (cats[t] ? t : col === 'expenses' && desc ? guessCat(String(desc)) : 'outros');
  const quando = sheetMonth(mes), tp = plain(String(tipo)), rep = sheetRep(tp);
  const fixed = tp.startsWith('fix') ? true : tp.startsWith('anual') || rep ? 'y' : false;
  const d = parseInt(dia) || quando.day || 0, dOk = d >= 1 && d <= 31 ? d : '';
  const out = {desc:String(desc).trim() || (cats[key] || [0, 'Lançamento'])[1], cat:cats[key] ? key : 'outros', fixed, start:quando.ym || curYM,
    end:fixed ? sheetMonth(ate).ym : '', bank:String(banco).trim()};
  if (value > 0) out.value = round2(value);
  if (rep) out.rep = rep;
  if (T.pay) out.pay = Object.keys(PAY).find(k => plain(PAY[k]) === plain(String(pay).trim())) || '';
  if (col === 'expenses' && fixed){ out.due = dOk; out.day = ''; } else out.day = dOk;
  return out;
}

let sheetBusy = false;
// Lê a planilha, traz as mudanças para o app e regrava as abas. Devolve quantas alterações vieram da planilha.
async function sheetSync(interactive){
  if (demoOn) return 0;
  const id = sheetId();
  if (!id || !canSync() || !temNativo('driveFamilia') || sheetBusy) return 0;
  sheetBusy = true;
  try {
    const tabs = Object.keys(SHEET_TABS), faixa = col => `${SHEET_TABS[col].nome}!A2:${colLetter(sheetCols(SHEET_TABS[col]).length)}`;
    const r = JSON.parse(ok(await fam('GET',
      `${SHEETS}/${id}/values:batchGet?${tabs.map(c => 'ranges=' + rng(faixa(c))).join('&')}&ranges=${rng('_app!A:A')}&valueRenderOption=UNFORMATTED_VALUE`, '',
      '', interactive)).text).valueRanges;
    let antes = [];
    try { antes = JSON.parse(((r[2] || {}).values || []).map(v => v[0]).join('') || '[]'); } catch(e){}
    let veio = 0;
    const vistos = new Set(), lido = {}, pend = {};
    tabs.forEach((col, ci) => {
      const n = sheetCols(SHEET_TABS[col]).length;
      lido[col] = []; pend[col] = [];
      for (const raw of (r[ci] || {}).values || []){
        const c = [...raw, ...Array(n).fill('')].slice(0, n).map(v => typeof v === 'string' ? v.trim() : v);
        const rid = String(c[0] || ''), dados = c.slice(1, n - 1), d = sheetRead(dados, col);
        if (!rid && dados.every(v => v === '')) continue; // linha em branco
        lido[col].push([rid, sheetHash(dados)]);
        if (rid) vistos.add(rid);
        const rec = rid && db[col].find(x => x.id === rid);
        if (!rid){
          if (d && d.value > 0){ db[col].push(touch({id:uid(), ...d})); veio++; }
          else pend[col].push(dados); // linha nova ainda sem valor (a pessoa está digitando): fica como está
        } else if (d && rec && sheetHash(dados) !== String(c[n - 1])){ Object.assign(touch(rec), d, {edi:Date.now()}); if (!d.rep) delete rec.rep; veio++; }
      }
    });
    // Linhas apagadas na planilha: o lançamento vai para a lixeira. Trava: nunca mais da metade de uma vez (aba apagada, erro).
    const sumiram = antes.filter(i => !vistos.has(i) && tabs.some(col => db[col].some(x => x.id === i)));
    if (sumiram.length && (sumiram.length <= 20 || sumiram.length < antes.length / 2)) for (const i of sumiram) for (const col of tabs){
      const k = db[col].findIndex(x => x.id === i);
      if (k >= 0){ db.trash.push({col, rec:db[col][k], at:Date.now()}); db[col].splice(k, 1); db.tomb[i] = Date.now(); veio++; }
    }
    if (veio){ save(); if (!sheetOpen()) render();
      toast(`Planilha: ${veio} ${veio > 1 ? 'alterações vieram' : 'alteração veio'} para o app.`, {dest:{k:'cfg', s:'dados'}}); }
    // Regrava as abas com o estado do app (só se algo mudou em relação ao que está lá).
    const data = [], limpar = [], ids = [];
    let igual = true;
    for (const col of tabs){
      const T = SHEET_TABS[col], L = colLetter(sheetCols(T).length);
      const linhas = [...db[col]].sort((a, b) => (b.start || '').localeCompare(a.start || '') || (a.desc || '').localeCompare(b.desc || '')).map(x => { const cells = sheetCells(x, col); ids.push(x.id); return [x.id, ...cells, sheetHash(cells)]; });
      for (const dados of pend[col]) linhas.push(['', ...dados, sheetHash(dados)]);
      if (JSON.stringify(linhas.map(l => [l[0], l[l.length - 1]])) !== JSON.stringify(lido[col])) igual = false;
      if (linhas.length) data.push({range:`${T.nome}!A2:${L}${linhas.length + 1}`, values:linhas});
      limpar.push(`${T.nome}!A${linhas.length + 2}:${L}`);
    }
    if (!igual || JSON.stringify(ids) !== JSON.stringify(antes)){
      const txt = JSON.stringify(ids), partes = [];
      for (let i = 0; i < txt.length; i += 40000) partes.push([txt.slice(i, i + 40000)]);
      data.push({range:`_app!A1:A${partes.length}`, values:partes});
      limpar.push(`_app!A${partes.length + 1}:A`);
      ok(await fam('POST', `${SHEETS}/${id}/values:batchUpdate`, JSON.stringify({valueInputOption:'RAW', data}), 'application/json'));
      ok(await fam('POST', `${SHEETS}/${id}/values:batchClear`, JSON.stringify({ranges:limpar}), 'application/json'));
    }
    sync.sheetAt = Date.now(); sync.sheetErr = '';
    return veio;
  } catch(e){
    if (e.status === undefined) logErr('planilha', e);
    sync.sheetErr = e.status === 404 ? 'A planilha não foi encontrada (foi apagada?).' : e.status === 403 ? 'Sem acesso à planilha com esta conta Google.'
      : e.status === -1 || e.status === -5 ? 'É preciso autorizar o acesso às planilhas (toque em "Sincronizar com a planilha").' : e.status === 0 ? 'Sem conexão com a internet.' : 'Não foi possível sincronizar com a planilha.';
    return 0;
  } finally { sheetBusy = false; saveSync(); }
}

// Cria a planilha na conta Google da pessoa, com cabeçalhos, formatos e listas de escolha, e liga ao app.
const sheetCreate = umaVez(async function(semPerguntar){
  if (demoBloqueia()) return;
  if (!semPerguntar && !await famPrepare()) return;
  try {
    const tabs = Object.keys(SHEET_TABS);
    const corpo = {properties:{title:'Cofrim (planilha ligada ao app)', locale:'pt_BR'}, sheets:[
      ...tabs.map((col, i) => ({properties:{sheetId:i + 1, title:SHEET_TABS[col].nome, gridProperties:{frozenRowCount:1}}})),
      {properties:{sheetId:8, title:'Como usar'}}, {properties:{sheetId:9, title:'_app', hidden:true}}]};
    const id = JSON.parse(ok(await fam('POST', SHEETS, JSON.stringify(corpo), 'application/json', true)).text).spreadsheetId;
    sync.famOk = true;
    const ajuda = ['Esta planilha está ligada ao app Cofrim.',
      'Para lançar por aqui, escreva numa linha vazia das abas Gastos ou Ganhos: mês, descrição e valor bastam.',
      'Mês no formato AAAA-MM (ex.: 2026-10); em branco, vale o mês atual. Categoria, Pagamento e Tipo têm lista de escolha.',
      'Você pode editar e apagar linhas: a mudança chega ao app na próxima sincronização (o que for apagado vai para a lixeira do app).',
      'O app regrava as abas a cada sincronização: não mude a ordem das colunas nem os títulos; fórmulas e anotações ficam melhor em outra aba.'];
    ok(await fam('POST', `${SHEETS}/${id}/values:batchUpdate`, JSON.stringify({valueInputOption:'RAW', data:[
      ...tabs.map(col => ({range:`${SHEET_TABS[col].nome}!A1`, values:[sheetCols(SHEET_TABS[col])]})),
      {range:'Como usar!A1', values:ajuda.map(t => [t])}]}), 'application/json'));
    const lista = v => ({condition:{type:'ONE_OF_LIST', values:v.map(t => ({userEnteredValue:t}))}, showCustomUi:true, strict:false});
    const req = [];
    tabs.forEach((col, i) => {
      const T = SHEET_TABS[col], sid = i + 1, n = sheetCols(T).length, p = T.pay ? 1 : 0;
      const colRange = (a, b) => ({sheetId:sid, startRowIndex:1, startColumnIndex:a, endColumnIndex:b});
      const fmt = (a, b, numberFormat) => req.push({repeatCell:{range:colRange(a, b), cell:{userEnteredFormat:{numberFormat}},
        fields:'userEnteredFormat.numberFormat'}});
      req.push({repeatCell:{range:{sheetId:sid, startRowIndex:0, endRowIndex:1}, cell:{userEnteredFormat:{textFormat:{bold:true}}},
        fields:'userEnteredFormat.textFormat.bold'}});
      fmt(1, 3, {type:'TEXT'}); fmt(8 + p, 9 + p, {type:'TEXT'}); fmt(5, 6, {type:'NUMBER', pattern:'#,##0.00'});
      req.push({setDataValidation:{range:colRange(4, 5), rule:lista(Object.values(T.cats()).map(c => c[1]))}});
      if (T.pay) req.push({setDataValidation:{range:colRange(7, 8), rule:lista(Object.values(PAY))}});
      req.push({setDataValidation:{range:colRange(7 + p, 8 + p), rule:lista([...SHEET_TIPOS.map(t => t[1]), ...SHEET_REP])}});
      for (const k of [0, n - 1]) req.push({updateDimensionProperties:{range:{sheetId:sid, dimension:'COLUMNS', startIndex:k, endIndex:k + 1},
        properties:{hiddenByUser:true}, fields:'hiddenByUser'}});
      req.push({updateDimensionProperties:{range:{sheetId:sid, dimension:'COLUMNS', startIndex:3, endIndex:4}, properties:{pixelSize:240},
        fields:'pixelSize'}});
    });
    await fam('POST', `${SHEETS}/${id}:batchUpdate`, JSON.stringify({requests:req}), 'application/json'); // formatos: se falhar, a planilha funciona igual
    db.prefs.sheet = id; db.cfgMod = Date.now(); save();
    await sheetSync();
    openSheetLink();
    toast('Planilha criada e ligada ao app.', {dest:{k:'cfg', s:'dados'}});
  } catch(e){
    logErr('criar planilha', e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e);
    if (e.status === -1 || e.status === -5) return famNegado();
    tell(/Sheets/.test(sharedMsg(e)) ? sharedMsg(e) : e.status === 0 ? 'Sem conexão com a internet.' : 'Não foi possível criar a planilha agora.');
  }
});
function sheetOpenUrl(){ if (temNativo('abrir')) nativo('abrir', sheetUrl()); else window.open(sheetUrl(), '_blank', 'noopener'); }
async function sheetNow(){
  if (demoBloqueia()) return;
  const n = await comCarga('Sincronizando com a planilha…', () => sheetSync(true));
  if (sync.sheetErr) tell(sync.sheetErr); else if (!n) toast('Planilha e app estão iguais.');
  if (sheetOpen() && document.getElementById('shLink')) openSheetLink();
}
async function sheetUnlink(){
  if (demoBloqueia()) return;
  if (!await ask('Desligar a planilha do app?\n\nA planilha continua no seu Google Drive, mas deixa de ser atualizada, e o que for escrito nela não vem mais para o app.', 'Desligar', true)) return;
  db.prefs.sheet = ''; db.cfgMod = Date.now(); save(); openSheetLink();
}
function openSheetLink(){
  settingsOpen = false; F = null;
  const on = !!sheetId();
  showSheet(`<h3 id="shLink">Planilha do Google</h3>
    ${!canSync() ? '<div class="semTopo hint warn">Prévia no PC: a planilha ligada só funciona no app instalado no celular ou na versão web.</div>' : on ? `
    <div class="semTopo hint in">${I('check', 14)} Ligada ao app${sync.sheetAt ? ' · sincronizada em ' + new Date(sync.sheetAt).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : ''}.</div>
    ${sync.sheetErr ? `<div class="hint warn">${I('alert', 13)} ${esc(sync.sheetErr)}</div>` : ''}
    <div class="hint">Lance, edite ou apague gastos e ganhos na planilha ou no app: aparece nos dois. A planilha é atualizada a cada sincronização do app (ao abrir e depois de cada lançamento); o que você escrever nela chega ao app quando ele for aberto ou em "Sincronizar com a planilha".</div>
    <div class="btns"><button class="btn primary" data-onclick="sheetOpenUrl()">${I('doc')}Abrir a planilha</button><button class="btn" data-onclick="sheetNow()">${I('refresh')}Sincronizar com a planilha</button></div>
    <div class="btns"><button class="cresce btn danger" data-onclick="sheetUnlink()">Desligar a planilha</button></div>` : `
    <div class="semTopo hint">O app cria uma planilha na sua conta Google com as abas Gastos e Ganhos e a mantém ligada: o que você lançar no app aparece na planilha, e o que escrever na planilha aparece no app.</div>
    <div class="hint">Compras parceladas, investimentos e contas ficam só no app. O Google vai pedir sua autorização para o app criar e editar a planilha.</div>
    <div class="btns"><button class="btn primary" id="shCreate" data-onclick="sheetCreate()">${I('doc')}Criar a planilha ligada</button></div>`}
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Fechar</button></div>`);
}
