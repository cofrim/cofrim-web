// Cofrim — Ações das telas sem código embutido no HTML.
// Carregado pelo index.html antes dos outros arquivos de js/ (só define funções; nada roda antes de um toque).
// As telas são montadas como texto (innerHTML) e levavam os comandos em atributos onclick="…", oninput="…" etc. Isso
// obrigava a CSP a aceitar código embutido ('unsafe-inline'), e um texto que escapasse do esc() viraria código. Agora os
// comandos vão em data-onclick="…", data-oninput="…" (o mesmo texto de antes), e este arquivo os executa com um
// interpretador pequeno de um pedaço do JavaScript, sem eval nem new Function (que a CSP também bloqueia):
//   chamadas e acesso a propriedades (fn('a', 1), Android.icone(), document.getElementById('x').click()),
//   atribuições (=, +=, -=, ++, --), if/else, return, const, operadores (! - + * / % === !== == != < > <= >= && || ?:),
//   listas e objetos ([1, ...lista], {id:'x'}) e funções curtas (v => {…}, x => x.id === 'a').
// "this" é o elemento do atributo e "event" o evento, como nos atributos on…; "return false" cancela a ação padrão.
// Nomes: variáveis das funções curtas, depois as variáveis globais declaradas com let/const (ACAO_GLOBAIS, que o
// navegador não deixa achar pelo nome) e por fim as propriedades de window (funções e o window.Android do APK).

// Globais declaradas com let/const usadas nos comandos das telas: [ler, gravar]. Só são lidas na hora do toque, quando
// todos os arquivos já carregaram.
const ACAO_GLOBAIS = {
  state:[() => state], db:[() => db], apaga:[() => apaga], pickArgs:[() => pickArgs], pickCb:[() => pickCb],
  curYM:[() => curYM], F:[() => F], payoff:[() => payoff], catsOpen:[() => catsOpen], PAY:[() => PAY],
  CAT_GASTO:[() => CAT_GASTO], pickOpts:[() => pickOpts], undoFn:[() => undoFn], GRUPOS:[() => GRUPOS], abat:[() => abat],
  SUG_KEY:[() => SUG_KEY], subsHits:[() => subsHits], ERR_KEY:[() => ERR_KEY], stmt:[() => stmt],
  newsTab:[() => newsTab, v => { newsTab = v; }], nameGreet:[() => nameGreet, v => { nameGreet = v; }],
  openResumoEdit:[() => openResumoEdit], sairChat:[() => sairChat], opts:[() => opts], save:[() => save], newsPh:[() => newsPh],
  payoffOpts:[() => payoffOpts], shareLeave:[() => shareLeave], shareJoin:[() => shareJoin], sheetCreate:[() => sheetCreate],
  tell:[() => tell], demoBloqueia:[() => demoBloqueia], grupoEd:[() => grupoEd]
};
const ACAO_PROIBIDO = new Set(['constructor', '__proto__', 'prototype', 'eval', 'Function']);

// ---------- Leitura do texto em partes ----------
function acaoPartes(src){
  const t = [], P = ['...', '===', '!==', '=>', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-='];
  let i = 0;
  while (i < src.length){
    const c = src[i];
    if (/\s/.test(c)){ i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))){
      const m = /^[0-9]*\.?[0-9]+(e[+-]?[0-9]+)?/i.exec(src.slice(i)); t.push({k:'num', v:Number(m[0])}); i += m[0].length; continue;
    }
    if (c === "'" || c === '"' || c === '`'){
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c){
        if (src[j] === '\\'){ const n = src[j + 1]; s += n === 'n' ? '\n' : n === 't' ? '\t' : n; j += 2; } else s += src[j++];
      }
      if (j >= src.length) throw new SyntaxError('texto sem fim');
      t.push({k:'str', v:s}); i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(c)){ const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); t.push({k:'id', v:m[0]}); i += m[0].length; continue; }
    const p = P.find(p => src.startsWith(p, i));
    if (p){ t.push({k:'p', v:p}); i += p.length; continue; }
    if ('()[]{}.,;:?!=<>+-*/%'.includes(c)){ t.push({k:'p', v:c}); i++; continue; }
    throw new SyntaxError('caractere inesperado: ' + c);
  }
  t.push({k:'fim'});
  return t;
}

// ---------- Montagem (árvore) ----------
function acaoMontar(src){
  const t = acaoPartes(src);
  let i = 0;
  const ve = () => t[i], e = v => t[i].k === 'p' && t[i].v === v, pega = v => { if (!e(v)) throw new SyntaxError('esperava ' + v); i++; };
  const palavra = v => t[i].k === 'id' && t[i].v === v;
  function bloco(fim){
    const l = [];
    while (!(fim ? e(fim) : t[i].k === 'fim')){ if (e(';')){ i++; continue; } l.push(comando()); }
    return l;
  }
  function comando(){
    if (palavra('if')){
      i++; pega('('); const se = expr(); pega(')'); const entao = comando();
      let senao = null; if (e(';') && t[i + 1].k === 'id' && t[i + 1].v === 'else') i++;
      if (palavra('else')){ i++; senao = comando(); }
      return {k:'if', se, entao, senao};
    }
    if (palavra('return')){ i++; return {k:'ret', v:e(';') || e('}') || t[i].k === 'fim' ? null : expr()}; }
    if (palavra('const') || palavra('let')){ i++; const n = t[i++].v; pega('='); return {k:'decl', n, v:expr()}; }
    if (e('{')){ i++; const l = bloco('}'); pega('}'); return {k:'bloco', l}; }
    return {k:'expr', v:expr()};
  }
  const expr = () => atrib();
  function atrib(){
    if (t[i].k === 'id' && t[i + 1].k === 'p' && t[i + 1].v === '=>') return seta([t[i++].v]);
    if (e('(')){ // (a, b) => … : só nomes separados por vírgula, e "=>" logo depois do ")"
      let j = i + 1; const ps = [];
      while (t[j].k === 'id'){ ps.push(t[j].v); j++; if (t[j].k === 'p' && t[j].v === ',') j++; else break; }
      if (t[j].k === 'p' && t[j].v === ')' && t[j + 1].k === 'p' && t[j + 1].v === '=>'){ i = j + 2; return seta(ps, true); }
    }
    const a = cond();
    if (e('=') || e('+=') || e('-=')){
      const op = t[i++].v;
      if (a.k !== 'nome' && a.k !== 'membro') throw new SyntaxError('atribuição inválida');
      return {k:'atrib', op, alvo:a, v:atrib()};
    }
    return a;
  }
  function seta(ps, jaPassou){
    if (!jaPassou) pega('=>');
    if (e('{')){ i++; const l = bloco('}'); pega('}'); return {k:'seta', ps, l}; }
    return {k:'seta', ps, v:atrib()};
  }
  function cond(){
    const c = binario(0);
    if (!e('?')) return c;
    i++; const a = atrib(); pega(':'); const b = atrib();
    return {k:'cond', c, a, b};
  }
  const NIVEIS = [['||'], ['&&'], ['===', '!==', '==', '!='], ['<', '>', '<=', '>='], ['+', '-'], ['*', '/', '%']];
  function binario(n){
    if (n === NIVEIS.length) return unario();
    let a = binario(n + 1);
    while (t[i].k === 'p' && NIVEIS[n].includes(t[i].v)){ const op = t[i++].v; a = {k:'bin', op, a, b:binario(n + 1)}; }
    return a;
  }
  function unario(){
    if (e('!') || e('-') || e('+')){ const op = t[i++].v; return {k:'un', op, v:unario()}; }
    if (e('++') || e('--')){ const op = t[i++].v; return {k:'inc', op, alvo:posfixo(), pre:true}; }
    return posfixo();
  }
  function posfixo(){
    let a = primario();
    for (;;){
      if (e('.')){ i++; const n = t[i++]; if (n.k !== 'id') throw new SyntaxError('nome esperado'); a = {k:'membro', o:a, p:{k:'lit', v:n.v}}; }
      else if (e('[')){ i++; const p = expr(); pega(']'); a = {k:'membro', o:a, p}; }
      else if (e('(')){ i++; const args = lista(')'); a = {k:'chama', f:a, args}; }
      else if (e('++') || e('--')){ a = {k:'inc', op:t[i++].v, alvo:a, pre:false}; }
      else return a;
    }
  }
  function lista(fim){
    const l = [];
    while (!e(fim)){
      if (e('...')){ i++; l.push({k:'espalha', v:atrib()}); } else l.push(atrib());
      if (!e(fim)) pega(',');
    }
    i++;
    return l;
  }
  function primario(){
    const k = ve();
    if (k.k === 'num' || k.k === 'str'){ i++; return {k:'lit', v:k.v}; }
    if (e('(')){ i++; const a = expr(); pega(')'); return a; }
    if (e('[')){ i++; return {k:'lista', l:lista(']')}; }
    if (e('{')){
      i++; const ps = [];
      while (!e('}')){
        const n = t[i++]; if (n.k !== 'id' && n.k !== 'str' && n.k !== 'num') throw new SyntaxError('chave esperada');
        if (e(':')){ i++; ps.push([n.v, atrib()]); } else ps.push([n.v, {k:'nome', n:n.v}]);
        if (!e('}')) pega(',');
      }
      i++; return {k:'obj', ps};
    }
    if (k.k === 'id'){
      i++;
      if (k.v === 'true' || k.v === 'false') return {k:'lit', v:k.v === 'true'};
      if (k.v === 'null') return {k:'lit', v:null};
      if (k.v === 'undefined') return {k:'lit', v:undefined};
      if (k.v === 'this') return {k:'este'};
      return {k:'nome', n:k.v};
    }
    throw new SyntaxError('trecho inesperado');
  }
  const l = bloco(null);
  return l;
}

// ---------- Execução ----------
const ACAO_RET = {};
function acaoNome(n, esc){
  for (let s = esc; s; s = s.pai) if (Object.prototype.hasOwnProperty.call(s.v, n)) return s.v[n];
  if (n === 'event') return esc.raiz.ev;
  if (ACAO_GLOBAIS[n]) return ACAO_GLOBAIS[n][0]();
  if (ACAO_PROIBIDO.has(n)) throw new Error('nome não permitido: ' + n);
  if (n in window) return window[n];
  throw new ReferenceError(n + ' is not defined');
}
function acaoGravarNome(n, v, esc){
  for (let s = esc; s; s = s.pai) if (Object.prototype.hasOwnProperty.call(s.v, n)) return s.v[n] = v;
  if (ACAO_GLOBAIS[n]){ if (!ACAO_GLOBAIS[n][1]) throw new TypeError(n + ' não pode mudar'); return ACAO_GLOBAIS[n][1](v); }
  if (n in window && typeof window[n] !== 'function') return window[n] = v;
  throw new ReferenceError(n + ' is not defined');
}
const acaoProp = p => { if (ACAO_PROIBIDO.has(String(p))) throw new Error('propriedade não permitida: ' + p); return p; };
function acaoValor(n, esc){
  switch (n.k){
    case 'lit': return n.v;
    case 'este': return esc.raiz.este;
    case 'nome': return acaoNome(n.n, esc);
    case 'membro': { const o = acaoValor(n.o, esc); return o[acaoProp(acaoValor(n.p, esc))]; }
    case 'chama': {
      let este, f;
      if (n.f.k === 'membro'){ este = acaoValor(n.f.o, esc); f = este[acaoProp(acaoValor(n.f.p, esc))]; }
      else f = acaoValor(n.f, esc);
      if (typeof f !== 'function') throw new TypeError('não é uma função');
      return f.apply(este, acaoArgs(n.args, esc));
    }
    case 'lista': return acaoArgs(n.l, esc);
    case 'obj': return Object.fromEntries(n.ps.map(([k, v]) => [acaoProp(k), acaoValor(v, esc)]));
    case 'un': { const v = acaoValor(n.v, esc); return n.op === '!' ? !v : n.op === '-' ? -v : +v; }
    case 'bin': {
      if (n.op === '&&'){ const a = acaoValor(n.a, esc); return a ? acaoValor(n.b, esc) : a; }
      if (n.op === '||'){ const a = acaoValor(n.a, esc); return a ? a : acaoValor(n.b, esc); }
      const a = acaoValor(n.a, esc), b = acaoValor(n.b, esc);
      switch (n.op){
        case '===': return a === b; case '!==': return a !== b; case '==': return a == b; case '!=': return a != b;
        case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
        case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return a / b; case '%': return a % b;
      }
      break;
    }
    case 'cond': return acaoValor(n.c, esc) ? acaoValor(n.a, esc) : acaoValor(n.b, esc);
    case 'atrib': {
      const atual = () => acaoValor(n.alvo, esc), v = acaoValor(n.v, esc);
      const novo = n.op === '=' ? v : n.op === '+=' ? atual() + v : atual() - v;
      return acaoGravar(n.alvo, novo, esc);
    }
    case 'inc': { const antes = acaoValor(n.alvo, esc); acaoGravar(n.alvo, n.op === '++' ? antes + 1 : antes - 1, esc);
      return n.pre ? (n.op === '++' ? antes + 1 : antes - 1) : antes; }
    case 'seta': return (...args) => {
      const s = {pai:esc, raiz:esc.raiz, v:Object.fromEntries(n.ps.map((p, i) => [p, args[i]]))};
      if (!n.l) return acaoValor(n.v, s);
      const r = acaoRodarLista(n.l, s);
      return r === ACAO_RET ? s.ret : undefined;
    };
  }
  throw new Error('trecho desconhecido: ' + n.k);
}
function acaoGravar(alvo, v, esc){
  if (alvo.k === 'nome') return acaoGravarNome(alvo.n, v, esc);
  if (alvo.k === 'membro'){ const o = acaoValor(alvo.o, esc); return o[acaoProp(acaoValor(alvo.p, esc))] = v; }
  throw new SyntaxError('atribuição inválida');
}
function acaoArgs(l, esc){
  const out = [];
  for (const a of l) if (a.k === 'espalha') out.push(...acaoValor(a.v, esc)); else out.push(acaoValor(a, esc));
  return out;
}
function acaoRodarLista(l, esc){
  for (const c of l){
    if (c.k === 'ret'){ esc.ret = c.v ? acaoValor(c.v, esc) : undefined; return ACAO_RET; }
    if (c.k === 'if'){
      const r = acaoValor(c.se, esc) ? acaoRodarLista([c.entao], esc) : c.senao ? acaoRodarLista([c.senao], esc) : null;
      if (r === ACAO_RET) return r;
    } else if (c.k === 'decl') esc.v[c.n] = acaoValor(c.v, esc);
    else if (c.k === 'bloco'){ const r = acaoRodarLista(c.l, esc); if (r === ACAO_RET) return r; }
    else acaoValor(c.v, esc);
  }
}
// Os comandos se repetem muito (cada item de uma lista tem o seu): a árvore de cada texto fica guardada.
const acaoCache = new Map();
function acaoArvore(src){
  let a = acaoCache.get(src);
  if (!a){ a = acaoMontar(src); if (acaoCache.size > 3000) acaoCache.clear(); acaoCache.set(src, a); }
  return a;
}
// Roda um comando como o atributo on… rodaria: devolve o valor do return (false cancela a ação padrão).
function acaoRodar(src, este, ev){
  const raiz = {este, ev}, esc = {pai:null, raiz, v:{}};
  raiz.raiz = raiz; esc.raiz = raiz;
  return acaoRodarLista(acaoArvore(src), esc) === ACAO_RET ? esc.ret : undefined;
}

// ---------- Eventos ----------
// Um ouvinte por tipo de evento, no documento. Como nos atributos on…, o comando do elemento tocado roda primeiro e depois
// os dos elementos de fora, até alguém chamar event.stopPropagation(). "error" (imagens) e "toggle" (details) não sobem
// pela página: são pegos na descida e só valem no próprio elemento.
const ACAO_EVENTOS = ['click', 'input', 'change', 'submit', 'keydown', 'toggle', 'error'];
for (const tipo of ACAO_EVENTOS){
  const naDescida = tipo === 'error' || tipo === 'toggle';
  document.addEventListener(tipo, ev => {
    const caminho = ev.composedPath ? ev.composedPath() : [];
    for (const el of caminho){
      if (!el || !el.getAttribute) continue;
      if (naDescida && el !== ev.target) continue;
      const src = el.getAttribute('data-on' + tipo);
      if (src == null) continue;
      let r;
      try { r = acaoRodar(src, el, ev); }
      catch(e){ console.error(e); if (typeof logErr === 'function') logErr('ação na tela', (e && e.message || e) + ' | ' + src.slice(0, 120)); }
      if (r === false) ev.preventDefault();
      if (ev.cancelBubble || naDescida) break;
    }
  }, naDescida);
}

// Confere um comando sem rodar: entende o texto e acha cada nome usado (fora os parâmetros das funções curtas). Devolve
// a lista de problemas ([] = tudo certo). Usada nos testes, que passam por todos os botões das telas.
function acaoConferir(src){
  let arv;
  try { arv = acaoArvore(src); } catch(e){ return ['não entendi: ' + e.message]; }
  const probs = [];
  const nome = (n, locais) => {
    if (locais.has(n) || n === 'event' || ACAO_GLOBAIS[n]) return;
    if (ACAO_PROIBIDO.has(n) || !(n in window)) probs.push('nome desconhecido: ' + n);
  };
  const anda = (x, locais) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(y => anda(y, locais));
    if (x.k === 'nome') return nome(x.n, locais);
    if (x.k === 'seta'){ const l = new Set([...locais, ...x.ps]); return x.l ? anda(x.l, l) : anda(x.v, l); }
    if (x.k === 'decl'){ locais.add(x.n); return anda(x.v, locais); }
    for (const [k, v] of Object.entries(x)) if (k !== 'k') anda(v, locais);
  };
  anda(arv, new Set());
  return probs;
}
