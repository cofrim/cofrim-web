// Cofrim — Dados: planilha formatada (.xlsx), exclusão por período, e aviso do extrato.
// Carregado pelo index.html depois de planilha.js.

// ---------- Planilha do ano (.xlsx) ----------
// O app monta o arquivo do Excel sozinho, sem biblioteca: um .xlsx é um zip com alguns arquivos XML dentro.
// Estilos (índices de cellXfs em ESTILOS_XLSX): 0 texto, 1 cabeçalho, 2 texto em linha colorida, 3 valor, 4 valor em
// linha colorida, 5 rótulo do total, 6 valor do total, 7 título, 8 subtítulo.
const xlsxMoeda = () => `&quot;${esc(moeda.simbolo)}&quot;\\ #,##0${moeda.casas ? '.' + '0'.repeat(moeda.casas) : ''}`;
// O formato dos valores leva o símbolo e as casas decimais da moeda escolhida (moeda, em util.js).
const ESTILOS_XLSX = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="${xlsxMoeda()};[Red]\\-${xlsxMoeda()}"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF312E81"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF6B7280"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4F46E5"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F2FB"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border><border><left/><right/><top style="medium"><color rgb="FF4F46E5"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="4" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs></styleSheet>`;
const xmlEsc = s => String(s).replace(/[<>&"]/g,
  c => ({'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const colLetra = i => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + i % 26);
// Uma aba: {nome, larguras, titulo, sub, cabecalho, linhas:[[célula…]], total:[célula…]}; número = valor na moeda escolhida, texto = texto.
function abaXlsx(a){
  const cel = (v, r, c, txt, num) => typeof v === 'number'
    ? `<c r="${colLetra(c)}${r}" s="${num}"><v>${round2(v)}</v></c>` : `<c r="${colLetra(c)}${r}" s="${txt}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v ?? '')}</t></is></c>`;
  let r = 0;
  const linha = (cs, txt, num, alt) => { r++;
    return `<row r="${r}"${alt ? ` ht="${alt}" customHeight="1"` : ''}>${cs.map((v, c) => cel(v, r, c, txt, num)).join('')}</row>`; };
  const corpo = linha([a.titulo], 7, 7, 26) + linha([a.sub], 8, 8) + linha([''], 0, 0) + linha(a.cabecalho, 1, 1, 22)
    + a.linhas.map((l, i) => linha(l, i % 2 ? 2 : 0, i % 2 ? 4 : 3)).join('') + (a.total ? linha(a.total, 5, 6, 20) : '');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${a.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${corpo}</sheetData></worksheet>`;
}
// Zip sem compressão (o Excel e o Google Planilhas aceitam): cabeçalho de cada arquivo, os dados e o índice no fim.
const CRC_T = (() => { const t = [];
  for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = ~0; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
function zipSimples(arquivos){
  const enc = new TextEncoder(), partes = [], indice = [];
  let pos = 0;
  const n16 = v => [v & 255, v >>> 8 & 255], n32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  for (const [nome, texto] of arquivos){
    const nb = enc.encode(nome), d = enc.encode(texto), crc = crc32(d);
    const comum = [...n16(20), ...n16(0x0800), ...n16(0), ...n16(0), ...n16(0x21), ...n32(crc), ...n32(d.length), ...n32(d.length), ...n16(nb.length),
      ...n16(0)];
    partes.push(new Uint8Array([0x50, 0x4b, 3, 4, ...comum]), nb, d);
    indice.push(new Uint8Array([0x50, 0x4b, 1, 2, ...n16(20), ...comum, ...n16(0), ...n16(0), ...n16(0), ...n32(0), ...n32(pos)]), nb);
    pos += 30 + nb.length + d.length;
  }
  const tam = indice.reduce((a, p) => a + p.length, 0);
  const tudo = [...partes, ...indice,
    new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...n16(arquivos.length), ...n16(arquivos.length), ...n32(tam), ...n32(pos), 0, 0])];
  const out = new Uint8Array(tudo.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of tudo){ out.set(p, o); o += p.length; }
  return out;
}
function xlsx(abas){
  return zipSimples([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${abas.map((a, i) => `<sheet name="${xmlEsc(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', ESTILOS_XLSX()],
    ...abas.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, abaXlsx(a)])]);
}
// As abas da planilha do ano y: resumo por mês, gastos e ganhos (com os vales, como no CSV) e os investimentos de hoje
// (com a corretora).
function abasDoAno(y){
  const meses = [...Array(12)].map((_, i) => ymOf(+y, i)), sub = `Cofrim · gerado em ${now.toLocaleDateString('pt-BR')}`;
  const tipo = tipoLanc;
  const gastos = meses.flatMap(m => expensesAll(m).map(x => [cap(monthName(m).split(' ')[0]), x.day ? String(x.day) : '', x.desc,
    (CAT_GASTO[x.cat] || CAT_GASTO.outros)[1], x.bank || '', PAY[x.pay] || '', tipo(x), x.value]));
  const ganhos = meses.flatMap(m => incomesAll(m).map(x => [cap(monthName(m).split(' ')[0]), diaGanho(x, m) ? String(diaGanho(x, m)) : '', x.desc,
    (CAT_GANHO[x.cat] || CAT_GANHO.outros)[1], x.bank || '', tipo(x), x.value]));
  const invest = db.investments.map(v => [v.ticker ? v.ticker + (v.assetName ? ' · ' + v.assetName : '') : v.name || '',
    (CAT_INV[v.cat] || CAT_INV.outros)[1], v.broker || '', v.value || 0]);
  const res = meses.map(m => [cap(monthName(m).split(' ')[0]), totalIn(m), totalOut(m), round2(totalIn(m) - totalOut(m))]);
  const tot = (l, c) => round2(sum(l, r => r[c]));
  return [
    {nome:'Resumo', larguras:[16, 16, 16, 16], titulo:`Resumo de ${y}`, sub, cabecalho:['Mês', 'Ganhos', 'Gastos', 'Saldo'], linhas:res,
      total:['Total do ano', tot(res, 1), tot(res, 2), tot(res, 3)]},
    {nome:'Gastos', larguras:[12, 6, 34, 22, 16, 18, 14, 14], titulo:`Gastos de ${y}`, sub,
      cabecalho:['Mês', 'Dia', 'Descrição', 'Categoria', 'Banco', 'Pagamento', 'Tipo', 'Valor'], linhas:gastos,
      total:['Total', '', '', '', '', '', '', tot(gastos, 7)]},
    {nome:'Ganhos', larguras:[12, 6, 34, 22, 16, 14, 14], titulo:`Ganhos de ${y}`, sub,
      cabecalho:['Mês', 'Dia', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Valor'], linhas:ganhos, total:['Total', '', '', '', '', '', tot(ganhos, 6)]},
    {nome:'Investimentos', larguras:[34, 26, 22, 16], titulo:`Investimentos em ${now.toLocaleDateString('pt-BR')}`, sub,
      cabecalho:['Investimento', 'Categoria', 'Corretora', 'Valor hoje'], linhas:invest, total:['Total', '', '', tot(invest, 3)]}];
}
// Em inglês ou espanhol, a planilha sai no idioma do app (títulos, colunas, meses, categorias, tipos); o que a pessoa
// digitou fica como está (trText).
const celTr = v => typeof v === 'string' ? trText(v) : v;
const abasNoIdioma = abas => abas.map(a => ({...a, nome:trText(a.nome), titulo:trText(a.titulo), sub:trText(a.sub), cabecalho:a.cabecalho.map(trText),
  total:a.total.map(celTr), linhas:a.linhas.map(l => l.map(celTr))}));
// Planilha do ano da aba Gastos, já formatada. No APK antigo (sem gravação de arquivo binário), cai no CSV simples.
function exportPlanilha(){
  const y = state.month.slice(0, 4), nome = `financas-${y}.xlsx`;
  if (temNativo() && !temNativo('exportarArquivo')) return exportCsv();
  const bytes = xlsx(abasNoIdioma(abasDoAno(y)));
  if (temNativo()){ let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return nativo('exportarArquivo', btoa(s), nome); }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  a.download = nome; a.click();
}

// ---------- Importar extrato: aviso do formato ----------
// Antes de escolher o arquivo, o app mostra qual formato espera e quais colunas um CSV precisa ter.
function openStatementHelp(){
  settingsOpen = false; F = null;
  showSheet(`<h3>Importar extrato</h3>
    <div class="semTopo hint">O app lê dois formatos de arquivo. Baixe o extrato no app ou no site do seu banco e escolha o arquivo aqui.</div>
    <label>1. OFX (recomendado)</label>
    <div class="semTopo hint">É o formato "OFX" ou "Money" que quase todo banco oferece ao exportar o extrato. Não precisa ajustar nada.</div>
    <label>2. CSV (planilha em texto)</label>
    <div class="semTopo hint">A primeira linha precisa ter os nomes das colunas, separadas por ponto e vírgula ou vírgula:</div>
    <div class="card" style="box-shadow:none;background:var(--bg);padding:10px 12px;margin:8px 0">
      <div class="leg"><span><b class="u-texto">Data</b> (obrigatória)</span><b>31/12/2026 ou 2026-12-31</b></div>
      <div class="leg"><span><b class="u-texto">Valor</b> (obrigatória)</span><b>-45,90 ou 1200.00</b></div>
      <div class="leg"><span><b class="u-texto">Descrição</b> (opcional)</span><b>também Histórico ou Título</b></div></div>
    <div class="semTopo hint">Exemplo:<br><code>Data;Descrição;Valor<br>05/10/2026;Mercado;-182,40<br>06/10/2026;Salário;3500,00</code></div>
    <div class="hint">Valores negativos entram como gastos e positivos como ganhos (numa fatura de cartão é o contrário; você escolhe na próxima tela). Antes de gravar, o app mostra a lista para você conferir e desmarca o que já existe.</div>
    <div class="hint">Dá para escolher vários extratos de uma vez (meses ou bancos diferentes): cada lançamento entra no dia e no mês da data dele, e o que aparece em dois arquivos entra uma vez só.</div>
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button><button class="btn primary" data-onclick="closeForm();document.getElementById('stmt').click()">${I('upload')}Escolher os arquivos</button></div>`);
}

// ---------- Apagar por período ----------
// Em Gastos, Ganhos e Investimentos: apaga tudo, ou só o que é de um ano, de um mês ou de um dia. O que sai vai para a
// lixeira e pode ser desfeito na hora. Um lançamento conta pelo mês em que começa (um gasto fixo que começou antes do
// período continua); o dia é o da compra, o do vencimento ou o do recebimento.
const APAGA = {
  gastos:['gastos', ['expenses', 'installments']], ganhos:['ganhos', ['incomes']], invest:['investimentos', ['investments']]};
let apaga = null; // {aba, modo:'tudo'|'ano'|'mes'|'dia', ano, mes, dia}
const apagaData = (col, x) => col === 'investments' ? (x.date || '') : (x.start || '') + '-' + String(col === 'expenses' && x.fixed ? x.due || 0 : x.day || 0).padStart(2, '0');
function apagaLista(){
  const {aba, modo, ano, mes, dia} = apaga, alvo = modo === 'ano' ? String(ano) : modo === 'mes' ? mes : modo === 'dia' ? dia : '';
  return APAGA[aba][1].flatMap(col => db[col].filter(x => modo === 'tudo' || (modo === 'dia' ? apagaData(col, x) === alvo : apagaData(col, x).startsWith(alvo))).map(x => ({col, x})));
}
function openApagar(aba){
  if (aba) apaga = {aba, modo:'mes', ano:+state.month.slice(0, 4), mes:state.month, dia:now.toLocaleDateString('sv')};
  settingsOpen = false; F = null;
  const a = apaga, lista = apagaLista(), n = lista.length, nome = APAGA[a.aba][0];
  const total = sum(lista, ({x}) => x.value || x.total || 0);
  showSheet(`<h3>Apagar ${nome}</h3>
    <div class="semTopo hint">Escolha o que apagar. Os lançamentos vão para a lixeira (Configurações › Dados e ajustes) e dá para desfazer logo depois.</div>
    <label>Apagar</label>
    <div class="semTopo quebraLinha btns">${[['dia', 'Um dia'], ['mes', 'Um mês'], ['ano', 'Um ano'], ['tudo', 'Tudo']].map(([k, t]) => `<button class="btn ${a.modo === k ? 'primary' : ''}" style="padding:11px 6px" data-onclick="apaga.modo='${k}';openApagar()">${t}</button>`).join('')}</div>
    ${a.modo === 'ano' ? `<label>Ano</label><div class="nav u-m0"><button data-onclick="apaga.ano--;openApagar()">‹</button><b>${a.ano}</b><button data-onclick="apaga.ano++;openApagar()">›</button></div>` : ''}
    ${a.modo === 'mes' ? `<label>Mês</label><button type="button" class="pickBtn" data-onclick="pickMonthP('Mês a apagar',apaga.mes,false,v=>{apaga.mes=v;openApagar()})"><span class="u-capital">${monthName(a.mes)}</span>${I('chev')}</button>` : ''}
    ${a.modo === 'dia' ? `<label>Dia</label><button type="button" class="pickBtn" data-onclick="pickDateP('Dia a apagar',apaga.dia,v=>{apaga.dia=v;openApagar()})"><span>${fmtDate(a.dia)}</span>${I('chev')}</button>` : ''}
    <div class="card" style="box-shadow:none;background:var(--bg);margin:14px 0 0;text-align:center"><b style="font-size:20px" class="${n ? 'out' : ''}">${n} ${n === 1 ? 'lançamento' : 'lançamentos'}</b>
      <div class="hint u-mt2">${n ? 'somando ' + fmt(total) : 'Nada para apagar neste período.'}</div></div>
    ${a.aba !== 'invest' && a.modo !== 'tudo' ? '<div class="hint">Um lançamento fixo conta pelo mês em que começou: os que começaram antes do período continuam.</div>' : ''}
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button><button class="cresce btn danger" ${n ? '' : 'disabled'} data-onclick="apagarAgora()">${I('trash')}Apagar ${n || ''}</button></div>`);
}
async function apagarAgora(){
  const lista = apagaLista(), n = lista.length, a = apaga;
  if (!n) return;
  const oque = a.modo === 'tudo' ? `TODOS os ${APAGA[a.aba][0]}` : `${n} ${n === 1 ? 'lançamento' : 'lançamentos'} de ${a.modo === 'ano' ? a.ano : a.modo === 'mes' ? monthName(a.mes) : fmtDate(a.dia)}`;
  if (!await ask(`Apagar ${oque}?\n\nEles vão para a lixeira e dá para desfazer em seguida.`, 'Apagar', true)) return;
  const antes = JSON.stringify(db), agora = Date.now();
  for (const {col, x} of lista){ db[col].splice(db[col].indexOf(x), 1); db.tomb[x.id] = agora; db.trash.push({col, rec:x, at:agora}); }
  save(); closeForm(); render();
  showUndo(`${n} ${n === 1 ? 'lançamento apagado' : 'lançamentos apagados'}`, () => restoreSnap(antes), {dest:{k:'lixeira'}});
}

// ---------- Puxar para atualizar ----------
// Com a tela no topo, puxar para baixo e soltar recarrega os dados: sincroniza com a conta, atualiza taxas e cotações e
// redesenha a tela. O círculo desce junto com o dedo e gira enquanto atualiza.
let ptr = null; // puxada em andamento: {x, y, d}
const ptrLivre = () => scrollY <= 0 && !sheetOpen() && !pickerOpen() && !document.getElementById('abre')
  && ['gate', 'dlg', 'lockAsk'].every(id => document.getElementById(id).hidden) && document.getElementById('lightbox').hidden;
function ptrDraw(d, girando){
  const el = document.getElementById('ptr');
  el.style.transform = `translate(-50%, ${d - 60}px) rotate(${girando ? 0 : d * 3}deg)`;
  el.style.opacity = girando ? 1 : Math.min(1, d / 50);
  el.classList.toggle('pronto', d >= 64); el.classList.toggle('gira', !!girando);
}
document.addEventListener('touchstart',
  e => { ptr = e.touches.length === 1 && ptrLivre() ? {x:e.touches[0].clientX, y:e.touches[0].clientY, d:0} : null; }, {passive:true});
document.addEventListener('touchmove', e => {
  if (!ptr) return;
  const dy = e.touches[0].clientY - ptr.y, dx = Math.abs(e.touches[0].clientX - ptr.x);
  if (dy <= 0 || scrollY > 0 || (!ptr.d && dx > dy)){ if (ptr.d) ptrDraw(0); ptr = null; return; } // rolando ou deslizando de lado
  ptr.d = Math.min(110, dy * .5); ptrDraw(ptr.d);
}, {passive:true});
document.addEventListener('touchend', () => { if (!ptr) return; const d = ptr.d; ptr = null; if (d >= 64) atualizarTudo(); else if (d) ptrDraw(0); },
  {passive:true});
let atualizando = false;
async function atualizarTudo(){
  if (atualizando) return;
  atualizando = true; ptrDraw(64, true);
  try {
    now = new Date(); curYM = ymOf(now.getFullYear(), now.getMonth());
    rollover(); updateRates(); refreshQuotes();
    if (!needGate()) await syncNow(true);
  } catch(e){} finally { atualizando = false; }
  if (!sheetOpen()) render();
  ptrDraw(0);
  toast(canSync() && sync.on && sync.err ? 'Não deu para sincronizar: ' + sync.err : 'Atualizado');
}
