// Cofrim — idiomas (português, inglês e espanhol).
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md).
//
// O app é escrito em português. Em inglês ou espanhol, depois que uma tela é desenhada, tr() troca cada texto pela
// tradução da frase inteira, guardada em js/idioma-en.js e js/idioma-es.js (TR_TEXTOS; carregados só quando o idioma
// não é português). Na tabela, `{}` (ou `{v}`, `{nome}`…) marca o lugar de um número, valor, data ou nome; na tela, o
// que a pessoa digitou (descrições, nomes, bancos…) nunca é traduzido. Os valores continuam em reais, no formato
// brasileiro. O assistente entende perguntas só em português (as respostas passam pela mesma troca).
const LANGS = {pt:'Português', en:'English', es:'Español'};
const LOCALES = {pt:'pt-BR', en:'en-US', es:'es-ES'};
const lang = () => (db && db.prefs && LANGS[db.prefs.lang]) ? db.prefs.lang : 'pt';
const TR_TEXTOS = {};
let trPedido = '', trEsperando = [];
// Carrega as traduções do idioma escolhido (uma vez); ao chegar, traduz a tela de novo. fim (opcional) roda quando
// elas chegam, ou na hora se não precisa carregar; sem o arquivo (erro), roda assim mesmo, em português.
function trCarregar(fim){
  const l = lang();
  if (l === 'pt' || TR_TEXTOS[l]){ if (fim) fim(); return; }
  if (fim) trEsperando.push(fim);
  if (trPedido === l) return;
  trPedido = l;
  const chegou = () => { const f = trEsperando; trEsperando = []; f.forEach(x => x()); };
  const s = document.createElement('script'); s.src = `js/idioma-${l}.js`;
  s.onload = () => { trCache = null; trFeito = new WeakMap(); trAll(); chegou(); };
  s.onerror = () => { trPedido = ''; chegou(); };
  document.head.appendChild(s);
}
// Partes trocáveis de um texto: números e valores (R$ 1.234,56 · 10/04/2026 · +3,5% · 2 mil), níveis em algarismo romano
// no fim ("Nível IV") e os `{…}` da tabela.
const TR_NUM = '(?<![\\p{L}\\p{N}])(?:[+\\-−]\\s?)?(?:R\\$\\s?)?[+\\-−]?(?:\\d+(?:[.,:/]\\d+)*|\\{\\w*\\})(?:\\s?mil(?![\\p{L}]))?%?'
  + '|(?<= )(?:I{1,3}|IV|VI{0,3}|IX|X)(?=[.!]?$)';
const TR_MESES = '(?:' + 'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ')
  .map(m => `[${m[0]}${m[0].toUpperCase()}]${m.slice(1)}`).join('|') + ')';
const TR_MES_CURTO = '(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/\\d{2,4}'; // "mai/2027"
// Montadas uma vez (o trSetup passa por milhares de frases). Com g, cada uso vai até o fim e o lastIndex volta a 0.
const TR_MARCA = new RegExp(`${TR_NUM}|\\{\\w*\\}`, 'gu'), TR_MES_PARTE = new RegExp(`^(${TR_MESES})( (de )?(\\d{4}))?$`, 'u');
// Monta, para o idioma atual: exatos (frase inteira), modelos (frase com `{}`) e trechos (frases sem `{}` com mais de
// uma palavra, usados só quando a frase inteira não está na tabela).
let trCache = null;
function trSetup(){
  const l = lang(), tab = TR_TEXTOS[l];
  if (!tab){ trCarregar(); return null; }
  if (trCache && trCache.l === l) return trCache;
  const exato = new Map(), modelo = new Map(), plurais = [], trecho = new Map();
  const maiuscula = s => s[0].toUpperCase() + s.slice(1);
  const poe = (pt, v) => {
    if (!exato.has(pt)) exato.set(pt, v);
    const m = trModelo(pt, v);
    if (m && m.re) plurais.push(m);
    else if (m && !modelo.has(m.chave)) modelo.set(m.chave, m.partes);
    if (!m && / /.test(pt) && !/[{}]/.test(pt)) trecho.set(pt, v);
    // frase curta com uma parte só ("{} meses"): vale também como trecho de uma frase maior
    else if (m && !m.re && m.partes.length === 3 && m.partes[1].i === 0 && m.chave.split(' ').length <= 3) trecho.set(m.chave, m.partes);
  };
  for (const [pt, v] of Object.entries(tab)){
    poe(pt, v);
    if (pt[0] !== pt[0].toUpperCase()) poe(maiuscula(pt), maiuscula(v)); // trecho em minúscula vale também com maiúscula
    const sem = pt.replace(/^\{\}\s*/, ''), vsem = v.replace(/^\{0?\}\s*/, ''); // "{}Ver o tutorial": o {} é o ícone
    if (sem !== pt && vsem !== v && sem) poe(sem, vsem);
  }
  const chaves = [...trecho.keys()].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  trCache = {l, exato, modelo, plurais, trecho, usu:null,
    re:chaves.length ? new RegExp('(?<![\\p{L}\\p{N}])(?:' + chaves.join('|') + ')(?![\\p{L}])', 'gu') : null};
  return trCache;
}
// Frase da tabela com partes trocáveis → {chave com `{}`, partes da tradução: texto ou {i} (parte da frase) ou {s}
// (final do plural)}. A tradução usa `{}` na mesma ordem, `{0}`, `{1}`… (posição no original) ou o mesmo nome (`{v}`);
// número igual ao do original também vale como parte. Plural montado no código ("categoria${n > 1 ? 's' : ''}"): o `{}`
// colado numa palavra casa com qualquer final curto e, na tradução, vira o plural do idioma (re). Sem partes, null.
function trModelo(pt, v){
  const marca = TR_MARCA, colado = (s, t, i) => t[0] === '{' && /\p{L}/u.test(s[i - 1] || '');
  const tokens = [];
  const chave = pt.replace(marca, (t, i) => { tokens.push({t, colado:colado(pt, t, i)}); return tokens.at(-1).colado ? '\u0001' : '{}'; });
  if (!tokens.length || !/\p{L}{2}/u.test(chave.replace(/\{\}|\u0001/g, ''))) return null;
  let parte = 0, fim = 0;
  tokens.forEach(k => { if (k.colado) k.s = fim++; else k.i = parte++; });
  const comChave = tokens.map((k, j) => k.t.includes('{') ? j : -1).filter(j => j >= 0), partes = [];
  let seq = 0, ultimo = 0, achou;
  while ((achou = marca.exec(v))){
    const t = achou[0], nome = (t.match(/\{(\w*)\}/) || [])[1];
    let j = -1;
    if (nome === '') j = comChave[seq++] ?? -1;
    else if (/^\d+$/.test(nome || '')) j = comChave[+nome] ?? -1;
    else if (nome !== undefined) j = tokens.findIndex(k => k.t.includes(`{${nome}}`));
    else j = tokens.findIndex(k => k.t === t);
    if (j < 0) continue;
    const k = tokens[j];
    partes.push(v.slice(ultimo, achou.index), k.colado ? {s:k.s} : {i:k.i}); ultimo = achou.index + t.length;
  }
  partes.push(v.slice(ultimo));
  const re = fim && new RegExp('^' + chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u0001/g, '(\\p{L}{0,3})') + '$', 'u');
  return {chave, partes, re};
}
// Final do plural na tradução: nada se o original estava no singular; "n" no verbo em espanhol ("faltan"); senão "s"
// (ou "es" depois de consoante, em espanhol).
function trSufixo(pt, antes, l){
  if (!pt) return '';
  if (pt === 'm') return l === 'es' ? 'n' : '';
  return l === 'es' && /[^aeiouáéíóú]$/i.test(antes) ? 'es' : 's';
}
// O que a pessoa digitou (lançamentos, contas, metas, cartões, categorias próprias…) e os nomes das categorias: partes
// da frase que não são traduzidas (as categorias do app são, sozinhas). Refeito quando os dados mudam.
const TR_CODIGOS = /^(id|pid|cat|pay|kind|start|end|month|mes|date|since|regra|ajuste|modo|mode|col|d|ate|autoYM|autoProx|index|tipo|emp|sub|accYM|u|ver|cor|icon|color|lang|g)$/;
function trUsuario(c){
  const marca = [db, db.mod, db.expenses.length, db.incomes.length, myName()].join();
  if (c.usu && c.usuDb === db && c.usuMarca === marca) return c.usu;
  c.usuDb = db; c.usuMarca = marca;
  const lista = new Set([myName()]);
  const junta = (v, k) => {
    if (typeof v === 'string'){ if (!TR_CODIGOS.test(k) && v.trim().length >= 3) lista.add(v.trim()); return; }
    if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) junta(vv, Array.isArray(v) ? k : kk);
  };
  for (const [k, v] of Object.entries(db)) if (!['prefs', 'catMemo'].includes(k)) junta(v, k); // catMemo: descrição → código da categoria
  // Mudar um valor ou uma data não traz texto novo: a expressão (a parte cara, com milhares de nomes) continua a mesma.
  const lida = [...lista].join('\u0001') + '\u0002' + lang();
  if (c.usu && c.usuLida === lida) return c.usu;
  c.usuLida = lida;
  const cats = Object.values({...CAT_GASTO, ...CAT_GANHO, ...CAT_INV}).map(t => t[1]);
  c.usuSet = new Set([...lista].filter(t => !cats.includes(t))); // texto inteiro digitado pela pessoa: fica como está
  cats.forEach(t => lista.add(t));
  const re = [...lista].filter(Boolean).sort((a, b) => b.length - a.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  c.usu = new RegExp(`(?<![\\p{L}\\p{N}])(?:${re.join('|') || '\\b\\B'})(?![\\p{L}\\p{N}])|${TR_MESES}(?: (?:de )?\\d{4})?|${TR_MES_CURTO}|#[0-9a-fA-F]{3,8}\\b|${TR_NUM}`, 'gu');
  return c.usu;
}
// Frases que não estão na tabela (com `{}` no lugar das partes trocáveis), juntadas quando é um Set: o teste de
// cobertura (testes-traducao.js) liga para listar o que falta traduzir.
let trFaltas = null;
// Traduz um texto: a frase inteira; senão o modelo (frase com as partes trocáveis no lugar de `{}`); senão cada pedaço
// separado por " · " ou quebra de linha; por último, os trechos conhecidos, sem mexer no que a pessoa digitou.
function trText(s){
  if (lang() === 'pt' || !s) return s;
  const c = trSetup();
  if (!c) return s;
  // Texto escrito em várias linhas no código (quebra e recuo no meio da frase) vale como a frase numa linha só.
  const t0 = s.trim(), t = t0.replace(/[ \t]*\r?\n[ \t]{2,}/g, ' '); // a quebra sem recuo (lista com •) continua separando
  if (!t) return s;
  const v = trFrase(c, t);
  return v === t ? s : s.replace(t0, () => v);
}
function trFrase(c, t){
  if (trUsuario(c) && c.usuSet.has(t)) return t;
  if (c.exato.has(t)) return c.exato.get(t);
  // marcador na frente ("• ", "+ ", "1. ") ou dois-pontos no fim: traduz o resto
  const ponta = t.match(/^([•·›+=]\s*|\d+\.\s+)(.+)$/su) || t.match(/^()(.+?)(:)$/su);
  if (ponta) return ponta[1] + trFrase(c, ponta[2]) + (ponta[3] || '');
  const partes = [];
  const chave = t.replace(trUsuario(c), p => { partes.push(p); return '{}'; });
  const m = partes.length && c.modelo.get(chave);
  if (m) return trMonta(c, m, partes);
  for (const p of c.plurais){ const f = p.re.exec(chave); if (f) return trMonta(c, p.partes, partes, f.slice(1)); }
  const sep = t.split(/( · |\n)/);
  if (sep.length > 1) return sep.map((p, i) => i % 2 || !p.trim() ? p : p.replace(p.trim(), () => trFrase(c, p.trim()))).join('');
  if (trFaltas && /\p{L}{2}/u.test(chave)) trFaltas.add(chave);
  if (!c.re) return t;
  let i = 0;
  const troca = x => { const v = c.trecho.get(x); return v === undefined ? x : Array.isArray(v) ? v[0] + '{}' + v[2] : v; };
  return chave.replace(c.re, troca).replace(/\{\}/g, () => trParte(c, partes[i++] ?? ''));
}
function trMonta(c, modelo, partes, fins = []){
  let out = '';
  for (const x of modelo) out += typeof x === 'string' ? x : x.s !== undefined ? trSufixo(fins[x.s], out, c.l) : trParte(c, partes[x.i] ?? '');
  return out;
}
// Parte trocável já tirada da frase (depois de trUsuario): categoria do app e mês são traduzidos; número e texto da pessoa
// ficam como estão.
function trParte(c, p){
  if (c.usuSet.has(p)) return p;
  if (c.exato.has(p)) return c.exato.get(p);
  const curto = p.match(/^([a-z]{3})(\/\d+)$/);
  if (curto) return (c.exato.get(curto[1]) || curto[1]) + curto[2];
  const m = p.match(TR_MES_PARTE);
  if (!m) return p;
  let mes = c.exato.get(m[1].toLowerCase()) || m[1];
  if (c.l === 'en' || m[1][0] !== m[1][0].toLowerCase()) mes = mes[0].toUpperCase() + mes.slice(1); // "Outubro" → "Octubre"
  return m[4] ? `${mes}${c.l === 'es' && m[3] ? ' de ' : ' '}${m[4]}` : mes;
}
// Frase montada com partes que são texto, não só números (assistente): tf('Você gastou {} {}', valor, filtro). Em outro
// idioma usa a tradução da frase inteira, com as partes (já traduzidas por quem chama) no lugar de `{}` ou `{0}`, `{1}`…
function tf(pt, ...partes){
  const c = lang() !== 'pt' && trSetup(), v = (c && c.exato.get(pt)) || pt;
  let i = 0;
  return v.replace(/\{(\d?)\}/g, (m, n) => String(partes[n === '' ? i++ : +n] ?? ''));
}
// Textos para o lado nativo (nativo, js/nativo.js): título e texto da notificação; lembretes agendados e widgets vão em
// JSON, e cada texto dele é traduzido, menos os códigos (tema, cor, humor, categoria, banco, ids).
function trNativo(nome, args){
  if (lang() === 'pt' || !['notificar', 'lembretes', 'widget'].includes(nome)) return args;
  if (nome === 'notificar') return args.map(a => typeof a === 'string' ? trText(a) : a);
  try {
    const codigo = /^(skin|cor|fundo|humor|k|c|a|id)$/;
    return [JSON.stringify(JSON.parse(args[0]), (k, v) => typeof v === 'string' && !codigo.test(k) ? trText(v) : v), ...args.slice(1)];
  } catch(e){ return args; }
}
// Texto já traduzido não passa de novo: traduzir a tradução estragava ("Sign out" virava "Sign Oct") e a que contém a
// frase original crescia sem parar, travando a tela.
let trFeito = new WeakMap();
// Traduz uma parte da tela já desenhada: textos e os atributos lidos por leitor de tela e campos vazios.
function tr(root){
  if (lang() === 'pt' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());){
    const p = n.parentElement;
    if (!p || p.closest('script,style,textarea,.notr')) continue;
    trNo(n);
  }
  // o próprio root também (botão refeito por outerHTML, como o sino da central, chega aqui sozinho)
  const comAtrib = root.nodeType === 1 ? [...(root.matches('[placeholder],[aria-label],[title],[alt]') ? [root] : []),
    ...root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')] : [];
  comAtrib.forEach(e => ['placeholder', 'aria-label', 'title', 'alt'].forEach(a => {
    const v = e.getAttribute(a); if (v){ const t = trText(v); if (t !== v) e.setAttribute(a, t); }
  }));
}
function trNo(n){
  if (trFeito.get(n) === n.nodeValue) return;
  const v = trText(n.nodeValue);
  if (v !== n.nodeValue) n.nodeValue = v;
  trFeito.set(n, v);
}
// Tela inteira (troca de idioma e partes fixas do index.html: login, bloqueio, avisos, botões flutuantes, faixas de
// demonstração, rede e carga). O que a pessoa digitou e o que está em .notr ficam como estão (tr e trText).
function trAll(){ tr(document.body); }
// Tudo o que for desenhado depois passa pela troca de trechos (telas, folhas, avisos, rótulos refeitos ao digitar).
const trObs = new MutationObserver(ms => {
  if (lang() === 'pt') return;
  for (const m of ms){
    if (m.type === 'characterData'){ const p = m.target.parentElement;
      if (p && !p.closest('script,style,textarea,.notr')) trNo(m.target); }
    else m.addedNodes.forEach(n => {
      if (n.nodeType === 3){ const p = n.parentElement;
        if (p && !p.closest('script,style,textarea,.notr')) trNo(n); }
      else if (n.nodeType === 1 && !n.closest('script,style')) tr(n);
    });
  }
});
trObs.observe(document.body, {childList:true, subtree:true, characterData:true});
// O lado nativo (APK) mostra alguns textos sozinho (widgets, avisos do banco, desbloqueio): ele guarda o idioma.
const trAvisaNativo = () => { if (temNativo('setIdioma')) nativo('setIdioma', lang()); };
function setLang(l){
  const voltar = lang() !== 'pt' && l === 'pt'; // as partes fixas já traduzidas só voltam ao português recarregando
  db.prefs.lang = l; db.cfgMod = Date.now(); save(); trCache = null; trAvisaNativo();
  document.documentElement.lang = LOCALES[l];
  if (voltar) return temNativo('recarregar') ? nativo('recarregar') : location.reload();
  // no APK, o lado nativo recarrega (a página pode ter vindo de uma atualização)
  // a faixa da demonstração é refeita (em português) para trAll traduzir de novo, também de um idioma para outro
  trCarregar(() => { render(); openSettings(); demoFaixa(); trAll(); later('avisos', () => shown(() => { scheduleReminders(); updateWidget(); })); });
}
// Com os dados já lidos (APK, ou navegador sem cifra) e o app em inglês ou espanhol, as traduções entram aqui mesmo, antes
// dos próximos arquivos do index.html: a abertura segue na mesma ordem, já no idioma certo. Senão, trCarregar (inicio.js).
// A barra invertida em <\/script impede que o fim da tag apareça no texto: no app.html da atualização (empacotar.ps1)
// este código vai embutido numa tag <script>.
if (document.readyState === 'loading' && lang() !== 'pt') document.write(`<script src="js/idioma-${lang()}.js"><\/script>`);
