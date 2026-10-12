// Cofrim — Leitor de planilhas (.xlsx, .ods e .csv) do Importar planilha, sem biblioteca. Carregado sob demanda
// (planilhaCarregar, em extrato.js) junto do planilha-importar.js; os dois ficam no sw.js para funcionar sem internet.
// Um .xlsx e um .ods são zips com XML dentro: o app lê o diretório do zip, descompacta só as partes que usa com o
// DecompressionStream do navegador e monta, para cada aba, uma grade de células {v, t}: t = 'n' (número), 's' (texto),
// 'd' (data, v = AAAA-MM-DD, com fmt = o formato da célula, ex.: "d/m") ou 'b' (sim/não); f = veio de uma fórmula;
// m = cópia de uma célula mesclada. Células vazias ficam null.
// Dado de fora: o tamanho do arquivo, do que sai do zip (contra zip bomba), as abas, as linhas e as colunas têm limite.

const PL_MAX = 10 * 1024 * 1024, PL_ZIP_MAX = 60 * 1024 * 1024, PL_PARTE_MAX = 30 * 1024 * 1024;
const PL_ABAS = 60, PL_LINHAS = 20000, PL_COLS = 60;
// Erro de leitura: aviso = tipo do aviso para a pessoa (ERROS, em erros.js); a mensagem vai para o Diagnóstico.
const plErro = (aviso, motivo) => Object.assign(new Error(motivo || aviso), {aviso});

// ---------- Zip ----------
// Lê o diretório do zip (no fim do arquivo) e devolve {nomes, texto(nome)}: texto descompacta uma parte e a devolve em
// texto (null se a parte não existe). Só "guardado" (0) e "deflate" (8); zip64 e senha não são planilhas comuns.
function plZip(buf){
  const b = new Uint8Array(buf), dv = new DataView(buf), partes = {};
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50){ fim = i; break; }
  if (fim < 0) throw plErro('planilha', 'zip sem diretório');
  let p = dv.getUint32(fim + 16, true), total = 0;
  for (let k = dv.getUint16(fim + 10, true); k > 0; k--){
    if (p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) throw plErro('planilha', 'diretório do zip estragado');
    const ln = dv.getUint16(p + 28, true), nome = new TextDecoder().decode(b.subarray(p + 46, p + 46 + ln));
    partes[nome] = {metodo:dv.getUint16(p + 10, true), senha:dv.getUint16(p + 8, true) & 1, comp:dv.getUint32(p + 20, true),
      tam:dv.getUint32(p + 24, true), local:dv.getUint32(p + 42, true)};
    total += partes[nome].tam;
    p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  if (total > PL_ZIP_MAX) throw plErro('planilhaGrande', `zip com ${Math.round(total / 1048576)} MB descompactado`);
  return {nomes:Object.keys(partes), async texto(nome){
    const e = partes[nome];
    if (!e) return null;
    if (e.senha) throw plErro('planilhaFormato', 'planilha com senha');
    if (e.tam > PL_PARTE_MAX) throw plErro('planilhaGrande', `${nome} com ${Math.round(e.tam / 1048576)} MB`);
    if (e.local + 30 > b.length || dv.getUint32(e.local, true) !== 0x04034b50) throw plErro('planilha', 'parte do zip estragada: ' + nome);
    const ini = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true), dados = b.subarray(ini, ini + e.comp);
    if (e.metodo !== 0 && e.metodo !== 8) throw plErro('planilhaFormato', `compressão ${e.metodo} em ${nome}`);
    return new TextDecoder().decode(e.metodo === 0 ? dados : await plInflar(dados, Math.min(PL_PARTE_MAX, e.tam + 1024)));
  }};
}
// Descompacta (deflate) parando no limite: o tamanho escrito no zip pode mentir.
async function plInflar(dados, limite){
  let ds;
  try { ds = new DecompressionStream('deflate-raw'); } catch(e){ throw plErro('planilhaNavegador', 'sem DecompressionStream deflate-raw'); }
  const leitor = new ReadableStream({start(c){ c.enqueue(dados); c.close(); }}).pipeThrough(ds).getReader(), pedacos = [];
  let n = 0;
  try {
    for (;;){
      const {done, value} = await leitor.read();
      if (done) break;
      n += value.length;
      if (n > limite){ leitor.cancel().catch(() => {}); throw plErro('planilhaGrande', 'parte do zip maior do que diz'); }
      pedacos.push(value);
    }
  } catch(e){ throw e.aviso ? e : plErro('planilha', 'deflate estragado: ' + e.message); }
  const out = new Uint8Array(n);
  let o = 0;
  for (const v of pedacos){ out.set(v, o); o += v.length; }
  return out;
}

// ---------- XML ----------
function plXml(texto){
  const d = new DOMParser().parseFromString(texto, 'application/xml');
  if (d.getElementsByTagName('parsererror').length) throw plErro('planilha', 'XML estragado');
  return d;
}
const plTags = (el, nome) => [...el.getElementsByTagNameNS('*', nome)];
const plFilhos = (el, nome) => [...el.children].filter(e => e.localName === nome);
const plAttr = (el, nome) => { for (const a of el.attributes) if (a.localName === nome) return a.value; return null; };
// Coluna e linha de uma referência ("C12" → [11, 2]).
function plRef(ref){
  const m = /^([A-Z]+)(\d+)$/.exec(ref || '');
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return [+m[2] - 1, c - 1];
}
// Mesclagem: o valor da célula de cima à esquerda vale para a área toda (marcado com m), sem passar dos limites.
function plMesclar(linhas, r0, c0, r1, c1){
  const base = (linhas[r0] || [])[c0];
  if (!base) return;
  for (let r = r0; r <= Math.min(r1, r0 + 200); r++) for (let c = c0; c <= Math.min(c1, PL_COLS - 1); c++){
    if (r === r0 && c === c0) continue;
    const l = linhas[r] = linhas[r] || [];
    if (!l[c]) l[c] = {...base, m:true};
  }
}
const plGrade = linhas => Array.from(linhas, l => Array.from(l || [], c => c || null));
// Contador de linhas do arquivo inteiro (todas as abas).
const plConta = (lidas, n) => { if ((lidas.n += n) > PL_LINHAS) throw plErro('planilhaGrande', `mais de ${PL_LINHAS} linhas`); };

// ---------- .xlsx ----------
// Formatos de data do Excel: os de número fixo (14 a 17, 22, 27 a 36, 50 a 58) e os próprios que têm dia, mês ou ano
// (sem contar texto entre aspas, escapes e colchetes, como a moeda "[$R$-416]"). Hora sozinha não é data.
const PL_DATA_IDS = new Set([14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58]);
const PL_DATA_FMT = {14:'d/m/a', 15:'d/mmm/a', 16:'d/mmm', 17:'mmm/a', 22:'d/m/a h:mm'};
function plFmtData(cod){
  const s = String(cod || '').replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '').toLowerCase();
  return /[dy]/.test(s) || (/m/.test(s) && !/[hs]/.test(s));
}
// Número de série do Excel → AAAA-MM-DD (base de 1900, com o 29/02/1900 que não existiu; ou de 1904, no Mac antigo).
const plSerial = (n, base1904) => new Date((base1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + Math.floor(n) * 864e5).toISOString().slice(0, 10);
async function plXlsx(zip, lidas){
  const wbTexto = await zip.texto('xl/workbook.xml');
  if (!wbTexto) throw plErro('planilha', 'xlsx sem workbook.xml');
  const wb = plXml(wbTexto), rels = {}, relsTexto = await zip.texto('xl/_rels/workbook.xml.rels');
  if (relsTexto) for (const r of plTags(plXml(relsTexto), 'Relationship')) rels[r.getAttribute('Id')] = r.getAttribute('Target') || '';
  const base1904 = plTags(wb, 'workbookPr').some(w => /^(1|true)$/i.test(w.getAttribute('date1904') || ''));
  const textos = [], ssTexto = await zip.texto('xl/sharedStrings.xml');
  // Texto de cada célula de texto; sem a leitura fonética (rPh), que o Excel japonês põe junto.
  if (ssTexto) for (const si of plTags(plXml(ssTexto), 'si'))
    textos.push(plTags(si, 't').filter(t => t.parentNode.localName !== 'rPh').map(t => t.textContent).join(''));
  // Estilo de cada célula (atributo s): o formato de data, ou null.
  const fmts = {}, datas = [], stTexto = await zip.texto('xl/styles.xml');
  if (stTexto){
    const st = plXml(stTexto);
    for (const f of plTags(st, 'numFmt')) fmts[f.getAttribute('numFmtId')] = f.getAttribute('formatCode');
    const xfs = plTags(st, 'cellXfs')[0];
    for (const xf of xfs ? plFilhos(xfs, 'xf') : []){
      const id = +xf.getAttribute('numFmtId') || 0;
      datas.push(fmts[id] != null ? (plFmtData(fmts[id]) ? fmts[id] : null) : PL_DATA_IDS.has(id) ? PL_DATA_FMT[id] || 'd/m/a' : null);
    }
  }
  const abas = [];
  for (const sh of plTags(wb, 'sheet')){
    if (/hidden/i.test(sh.getAttribute('state') || '')) continue; // aba escondida
    if (abas.length >= PL_ABAS) throw plErro('planilhaGrande', `mais de ${PL_ABAS} abas`);
    const rid = [...sh.attributes].find(a => a.localName === 'id' && /relationships/.test(a.namespaceURI || '')), alvo = rid && rels[rid.value];
    if (!alvo) continue;
    const texto = await zip.texto(alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo.replace(/^\.\//, ''));
    if (!texto) continue;
    const d = plXml(texto), linhas = [];
    let r = -1;
    for (const row of plTags(d, 'row')){
      r = row.getAttribute('r') ? +row.getAttribute('r') - 1 : r + 1;
      if (r >= PL_LINHAS) break;
      let c = -1;
      for (const el of plFilhos(row, 'c')){
        const ref = plRef(el.getAttribute('r'));
        c = ref ? ref[1] : c + 1;
        if (c >= PL_COLS) continue;
        const t = el.getAttribute('t') || 'n', v = plFilhos(el, 'v')[0], vt = v ? v.textContent : '', f = plFilhos(el, 'f').length > 0;
        let cel = null;
        if (t === 's'){ const s = textos[+vt]; if (s && s.trim()) cel = {v:s, t:'s'}; }
        else if (t === 'inlineStr'){ const s = plTags(el, 't').map(x => x.textContent).join(''); if (s.trim()) cel = {v:s, t:'s'}; }
        else if (t === 'str'){ if (vt.trim()) cel = {v:vt, t:'s'}; }
        else if (t === 'b'){ if (vt) cel = {v:vt === '1', t:'b'}; }
        else if (t === 'd'){ if (/^\d{4}-\d\d-\d\d/.test(vt)) cel = {v:vt.slice(0, 10), t:'d', fmt:'d/m/a'}; }
        else if (t !== 'e' && vt !== '' && isFinite(+vt)){
          const fmt = datas[+el.getAttribute('s') || 0];
          cel = fmt && +vt > 0 && +vt < 80000 ? {v:plSerial(+vt, base1904), t:'d', fmt} : {v:+vt, t:'n'};
        }
        if (cel){ if (f) cel.f = true; (linhas[r] = linhas[r] || [])[c] = cel; }
      }
    }
    for (const m of plTags(d, 'mergeCell')){
      const [a, b] = (m.getAttribute('ref') || '').split(':').map(plRef);
      if (a && b) plMesclar(linhas, a[0], a[1], b[0], b[1]);
    }
    plConta(lidas, linhas.length);
    abas.push({nome:sh.getAttribute('name') || 'Aba ' + (abas.length + 1), linhas:plGrade(linhas)});
  }
  return abas;
}

// ---------- .ods ----------
// content.xml: uma table:table por aba; linhas e células repetidas (number-rows-repeated, number-columns-repeated);
// mesclagem pela célula principal (number-columns-spanned/rows-spanned), com as cobertas (covered-table-cell) vazias.
// Linhas vazias repetidas no fim da aba (às vezes mais de um milhão) não são criadas.
function plOdsCel(el){
  const tipo = plAttr(el, 'value-type'), f = !!plAttr(el, 'formula');
  let cel = null;
  if (['float', 'currency', 'percentage'].includes(tipo)){ const n = +plAttr(el, 'value'); if (isFinite(n)) cel = {v:n, t:'n'}; }
  else if (tipo === 'date'){ const d = plAttr(el, 'date-value') || ''; if (/^\d{4}-\d\d-\d\d/.test(d)) cel = {v:d.slice(0, 10), t:'d', fmt:'d/m/a'}; }
  else if (tipo === 'boolean') cel = {v:plAttr(el, 'boolean-value') === 'true', t:'b'};
  else { const s = plFilhos(el, 'p').map(p => p.textContent).join('\n'); if (s.trim()) cel = {v:s, t:'s'}; }
  if (cel && f) cel.f = true;
  return cel;
}
async function plOds(zip, lidas){
  const texto = await zip.texto('content.xml');
  if (!texto) throw plErro('planilha', 'ods sem content.xml');
  const abas = [];
  for (const tb of plTags(plXml(texto), 'table').filter(t => /:table:/.test(t.namespaceURI || ''))){
    if (abas.length >= PL_ABAS) throw plErro('planilhaGrande', `mais de ${PL_ABAS} abas`);
    const linhas = [], mesclas = [];
    let vazias = 0;
    for (const row of plTags(tb, 'table-row')){
      const rep = Math.max(1, +plAttr(row, 'number-rows-repeated') || 1), cels = [];
      let c = 0;
      for (const el of [...row.children].filter(e => /^(covered-)?table-cell$/.test(e.localName))){
        const crep = Math.max(1, Math.min(+plAttr(el, 'number-columns-repeated') || 1, PL_COLS)), cel = el.localName === 'table-cell' ? plOdsCel(el) : null;
        const cs = +plAttr(el, 'number-columns-spanned') || 1, rs = +plAttr(el, 'number-rows-spanned') || 1;
        if (cel && (cs > 1 || rs > 1)) mesclas.push([linhas.length + vazias, c, linhas.length + vazias + rs - 1, c + cs - 1]);
        for (let k = 0; k < crep && c < PL_COLS; k++, c++) if (cel) cels[c] = {...cel};
      }
      if (!cels.some(Boolean)){ vazias += rep; continue; }
      if (linhas.length + vazias + rep > PL_LINHAS) throw plErro('planilhaGrande', `mais de ${PL_LINHAS} linhas`);
      for (; vazias; vazias--) linhas.push([]);
      for (let k = 0; k < rep; k++) linhas.push(cels.slice());
    }
    for (const [r0, c0, r1, c1] of mesclas) plMesclar(linhas, r0, c0, r1, c1);
    plConta(lidas, linhas.length);
    abas.push({nome:plAttr(tb, 'name') || 'Aba ' + (abas.length + 1), linhas:plGrade(linhas)});
  }
  return abas;
}

// ---------- .csv ----------
// Texto em UTF-8 (ou Windows-1252, dos programas antigos); separador ; , ou tabulação, o que mais aparece fora de aspas
// nas primeiras linhas; aspas com quebra de linha dentro. Tudo vira texto: a detecção entende números e datas.
function plCsv(buf, nome, lidas){
  let texto;
  try { texto = new TextDecoder('utf-8', {fatal:true}).decode(buf); } catch(e){ texto = new TextDecoder('windows-1252').decode(buf); }
  texto = texto.replace(/^﻿/, '');
  const amostra = texto.slice(0, 4000).replace(/"[^"]*"/g, ''), conta = s => amostra.split(s).length;
  const sep = [';', ',', '\t'].reduce((a, s) => conta(s) > conta(a) ? s : a, ';'), linhas = [];
  let l = [], cel = '', aspas = false;
  const fecha = () => { const v = /^'[=+\-@]/.test(cel) ? cel.slice(1) : cel; l.push(v.trim() ? {v, t:'s'} : null); cel = ''; };
  for (let i = 0; i < texto.length; i++){
    const ch = texto[i];
    if (aspas){ if (ch === '"' && texto[i + 1] === '"'){ cel += '"'; i++; } else if (ch === '"') aspas = false; else cel += ch; continue; }
    if (ch === '"') aspas = true;
    else if (ch === sep) fecha();
    else if (ch === '\n' || ch === '\r'){
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fecha(); linhas.push(l.slice(0, PL_COLS)); l = [];
      if (linhas.length > PL_LINHAS) throw plErro('planilhaGrande', `mais de ${PL_LINHAS} linhas`);
    } else cel += ch;
  }
  if (cel || l.length){ fecha(); linhas.push(l.slice(0, PL_COLS)); }
  plConta(lidas, linhas.length);
  return {nome:String(nome).replace(/\.[^.]*$/, '') || 'Planilha', linhas};
}

// ---------- Entrada ----------
// file: o arquivo escolhido. Devolve {tipo, abas:[{nome, linhas}]} ou lança plErro (aviso = tipo do aviso em ERROS).
// O tipo vem do conteúdo (zip com planilha dentro, arquivo antigo do Excel) e, para o texto, da extensão.
async function lerPlanilha(file){
  const nome = file.name || '', ext = (/\.([a-z0-9]+)$/i.exec(nome) || [])[1] || '', lidas = {n:0};
  if (/^xls$/i.test(ext)) throw plErro('planilhaXls', 'arquivo .xls');
  if (/^numbers$/i.test(ext)) throw plErro('planilhaFormato', 'arquivo .numbers');
  if (file.size > PL_MAX) throw plErro('planilhaGrande', `arquivo de ${Math.round(file.size / 1048576)} MB`);
  const buf = await file.arrayBuffer(), b = new Uint8Array(buf);
  if (b[0] === 0x50 && b[1] === 0x4b){
    const zip = plZip(buf);
    if (zip.nomes.includes('xl/workbook.xml')) return {tipo:'xlsx', abas:await plXlsx(zip, lidas)};
    if (zip.nomes.includes('content.xml') && /spreadsheet/.test(await zip.texto('mimetype') || '')) return {tipo:'ods', abas:await plOds(zip, lidas)};
    throw plErro('planilhaFormato', 'zip que não é planilha (' + (ext || 'sem extensão') + ')');
  }
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) throw plErro('planilhaXls', 'arquivo do Excel antigo (OLE)');
  if (/^(csv|txt|tsv)$/i.test(ext) || /^text\//.test(file.type || '')) return {tipo:'csv', abas:[plCsv(buf, nome, lidas)]};
  throw plErro('planilhaFormato', 'tipo desconhecido (' + (ext || file.type || 'sem extensão') + ')');
}
