// Cofrim — Banco de dados: db, gravar e ler (localStorage, arquivo do app, IndexedDB), abertura e
// conserto dos dados (fixDb), diagnóstico de erros, versão, categorias e listas fixas. Sem HTML.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md e ARCHITECTURE.md).

// ---------- Dados ----------
// window.TESTE: página de testes automáticos (ver testes.js); usa outra chave para não tocar nos dados de verdade.
const KEY = window.TESTE ? 'financas-teste' : 'financas-v1';
// Versão do formato dos dados. Sobe quando um campo muda de significado; um backup ou uma conta com versão
// maior que esta foi gravado por um app mais novo e é recusado, para não estragar o que este app não entende.
// Tamanho máximo de dados vindos de fora (arquivo de backup, planilha da conta compartilhada): bem acima de anos de uso
// (um ano com milhares de lançamentos fica abaixo de 2 MB), mas barra um arquivo enorme que travaria o celular.
const DADOS_MAX = 30 * 1024 * 1024;
const DB_VER = 2;
// Modo demonstração (ver demoLigar em entrada.js): dados fictícios só na memória. demoOn nunca é gravado, então o app
// sempre abre com os dados reais. Com ele ligado nada é gravado neste aparelho nem enviado à conta Google; como rede de
// segurança, o localStorage não aceita gravações.
let demoOn = false;
const DEMO_MSG = 'Disponível ao entrar com sua conta Google.';
const demoBloqueia = () => { if (!demoOn) return false; tell(DEMO_MSG); return true; };
{
  let ls = null; try { ls = localStorage; } catch(e){}
  const grava = Storage.prototype.setItem, apaga = Storage.prototype.removeItem;
  Storage.prototype.setItem = function(k, v){ if (demoOn && this === ls) return; return grava.call(this, k, v); };
  Storage.prototype.removeItem = function(k){ if (demoOn && this === ls) return; return apaga.call(this, k); };
}
// Registro de erros (tela Diagnóstico): os últimos 60, só neste aparelho.
const ERR_KEY = 'financas-erros';
// O registro de erros vai para o Diagnóstico (que a pessoa pode copiar e mandar para o suporte): nada de dados nele.
// Resposta do Google (JSON) vira só o código e o motivo; e-mail vira "g***@gmail.com"; token, cabeçalho Authorization,
// valores em dinheiro (R$ e a moeda escolhida) e códigos longos (id de planilha, de arquivo) são escondidos. Vale também para o que já estava guardado.
function limpaDiag(texto){
  let s = String(texto == null ? '' : texto);
  s = s.replace(/\{[\s\S]*"error"[\s\S]*\}/, j => { try { const e = JSON.parse(j).error || {}, r = (e.errors && e.errors[0]) || {};
    return `Google: ${[e.code, e.status, r.reason || e.message && String(e.message).slice(0, 80)].filter(Boolean).join(' · ')}`;
    } catch(x){ return 'Google: resposta com dados (omitida)'; } });
  return s.replace(/Bearer\s+[^\s"',]+/gi, 'Bearer •••').replace(/(Authorization:?\s+)(?!Bearer)[^\s"',]+/gi, '$1•••').replace(/\bya29\.[\w.-]+/g, '•••')
    .replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1***@$2')
    .replace(/R\$[\s ]?-?\d[\d.]*(,\d{1,2})?/g, 'R$ •••')
    .replace(new RegExp(moeda.simbolo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\u00A0]?-?\\d[\\d.]*(,\\d{1,3})?', 'g'), MASK) // valor na moeda escolhida
    .replace(/[A-Za-z0-9_-]{28,}/g, m => m.slice(0, 4) + '…');
}
function logErr(onde, e){
  try {
    const list = JSON.parse(localStorage.getItem(ERR_KEY) || '[]');
    list.push({t:Date.now(), v:APP_VERSION, onde, msg:limpaDiag(String((e && (e.stack || e.message || e.text)) || e)).slice(0, 600)});
    localStorage.setItem(ERR_KEY, JSON.stringify(list.slice(-60)));
  } catch(x){}
}
addEventListener('error', e => logErr('erro na tela', (e.error && e.error.stack) || (e.message || '') + ' @' + (e.lineno || 0) + ':' + (e.colno || 0)));
addEventListener('unhandledrejection', e => logErr('promessa', e.reason));
const APP_VERSION = '2.40'; // manter igual ao versionName do build.gradle
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const I = (name, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
// Categorias: [ícone, nome, cor]
const CAT_GASTO = {
  moradia:['home','Moradia','#6366f1'], alimentacao:['food','Alimentação','#f59e0b'], transporte:['car','Transporte','#0ea5e9'],
  saude:['health','Saúde','#ef4444'], lazer:['star','Lazer','#ec4899'], educacao:['book','Educação','#8b5cf6'],
  compras:['bag','Compras','#14b8a6'], contas:['bolt','Contas e assinaturas','#eab308'],
  mercado:['cart','Mercado','#16a34a'], restaurante:['pizza','Restaurantes e delivery','#f97316'], cafe:['coffee','Café e lanches','#a16207'],
  combustivel:['fuel','Combustível','#dc2626'], estacionamento:['pin','Estacionamento e pedágio','#0284c7'],
  conducao:['bus','Ônibus, metrô e apps','#0891b2'], oficina:['wrench','Manutenção do carro','#475569'],
  farmacia:['cross','Farmácia','#e11d48'], academia:['dumbbell','Academia e esportes','#7c3aed'], beleza:['scissors','Beleza e cuidados','#db2777'],
  roupas:['shirt','Roupas e calçados','#9333ea'], eletronicos:['phone','Eletrônicos','#2563eb'], presentes:['gift','Presentes','#e879f9'],
  pets:['paw','Pets','#b45309'], filhos:['people','Filhos e família','#0d9488'],
  cinema:['film','Cinema e streaming','#be123c'], shows:['ticket','Shows e eventos','#c026d3'], bares:['cup','Bares e festas','#ea580c'],
  jogos:['game','Jogos','#4f46e5'], viagem:['plane','Viagens','#0ea5e9'],
  casa:['brush','Casa e manutenção','#65a30d'], luz:['drop','Água, luz e gás','#06b6d4'], internet:['wifi','Internet e celular','#3b82f6'],
  seguros:['shield','Seguros','#64748b'], impostos:['doc','Impostos e taxas','#78716c'], doacoes:['heart','Doações','#f43f5e'],
  emprestimo:['coins','Empréstimo','#b45309'], // só oferecida na aba Parcelas
  outros:['box','Outros','#64748b']
};
const CAT_GANHO = {
  salario:['briefcase','Salário','#059669'], freelance:['laptop','Freelance / extra','#0ea5e9'], rendimentos:['trend','Rendimentos','#8b5cf6'],
  va:['bag','Vale-alimentação','#16a34a'], vr:['food','Vale-refeição','#ea580c'], vt:['bus','Vale-transporte','#0ea5e9'],
  vendas:['tag','Vendas','#f59e0b'], outros:['wallet','Outros','#64748b']
};
const CAT_INV = {
  rendafixa:['bank','Renda fixa (CDB, LCI, LCA)','#4f46e5'], tesouro:['shield','Tesouro Direto','#0ea5e9'], poupanca:['stack','Poupança','#ec4899'],
  acoes:['chart','Ações','#059669'], fiis:['building','Fundos imobiliários','#f59e0b'], moeda:['exchange','Moedas (dólar, euro…)','#0d9488'],
  cripto:['coin','Cripto','#eab308'],
  previdencia:['umbrella','Previdência','#8b5cf6'], outros:['diamond','Outros','#64748b']
};
// Tipos de parcelamento além da compra parcelada (campo tipo em db.installments; ver Financiamentos mais abaixo).
const PARC_TIPOS = {financiamento:'Financiamento', emprestimo:'Empréstimo'};
const PAY = {credito:'Crédito', debito:'Débito', pix:'Pix', dinheiro:'Dinheiro', boleto:'Boleto', va:'Vale-alimentação', vr:'Vale-refeição',
  vt:'Vale-transporte', outro:'Outro'};
const BANKS = ['Nubank','Itaú','Bradesco','Banco do Brasil','Caixa','Santander','Inter','C6 Bank','PicPay','Mercado Pago',
  'Alelo','Pluxee (Sodexo)','Ticket','VR','Flash','Caju','iFood Benefícios','Swile','Ben Visa Vale']; // os últimos são cartões de vale-alimentação/refeição
// Sugestões do campo "Banco / conta": os que você já usou primeiro, depois os mais comuns.
// Corretora dos investimentos (texto livre, até 40 letras): as já usadas viram sugestões, e um nome que só muda nas
// maiúsculas ("Xp" com "XP" já cadastrada) fica com a grafia que já existe, para não duplicar.
const brokerSuggestions = () => [...new Map(db.investments.map(v => String(v.broker || '').trim()).filter(Boolean).map(b => [b.toLowerCase(), b])).values()];
const normBroker = s => { const t = String(s ?? '').trim().slice(0, 40); return brokerSuggestions().find(b => b.toLowerCase() === t.toLowerCase()) || t; };
const bankSuggestions = () => [...new Set([...db.accounts.map(a => a.name), ...[...db.expenses, ...db.installments].map(x => x.bank).filter(Boolean),
  ...BANKS])];
// Trecho " · Nubank · Crédito" mostrado nas listas.
const whereLabel = x => [x.bank && esc(x.bank), PAY[x.pay]].filter(Boolean).map(s => ' · ' + s).join('');
const WHERE_FIELDS = () => [
  {k:'bank', label:'Banco / conta (opcional)', type:'text', ph:'Ex.: Nubank', optional:true, sug:bankSuggestions},
  {k:'pay', label:'Forma de pagamento', type:'select', optional:true, options:[['','Não informar'], ...Object.entries(PAY)]}];
const INDEX = {cdi:'CDI', selic:'Selic', ipca:'IPCA +', pre:'Prefixado'};

// Listas de lançamentos. Cada registro tem id e u (momento da última alteração); a sincronização
// junta os aparelhos registro por registro usando u, e db.tomb guarda o que foi excluído (id → momento).
const COLS = ['incomes', 'expenses', 'installments', 'investments', 'goals', 'accounts', 'transfers', 'previsoes'];
// Completa campos que versões antigas do app (ou um backup antigo) não tinham.
// Categoria personalizada com valores seguros (usada pelo fixDb e pelo formulário catEdit). Só corrige o que veio:
// sem ícone ou cor, a categoria de fábrica continua com os dela.
function catLimpa(c){
  if (c.icon != null && !Object.hasOwn(ICONS, c.icon)) c.icon = 'tag';
  if (c.color && !/^#[0-9a-f]{6}$/i.test(c.color)) c.color = '#64748b';
  if (c.name != null) c.name = String(c.name).slice(0, 40);
  return c;
}
// Pontos de aviso das previsões de gastos (Configurações › Lembretes; db.prefs.prevPontos, para todos os aparelhos da
// conta). Antes do fixDb, que os confere ao abrir o app: só valores conhecidos; lista inválida = os padrões, os mesmos
// avisos de antes da 1.90 (80%, passou do previsto e encerramento). [] = nenhum ponto: as previsões não avisam.
const PREV_PONTOS = {'50':'50% do previsto', '80':'80% do previsto', '90':'90% do previsto', chegou:'Chegou no previsto', passou:'Passou do previsto',
  fim:'Encerramento'};
const PREV_PONTOS_PADRAO = ['80', 'passou', 'fim'];
// Sugestões de gasto da conta (db.sugs = {limpas, lista}): o celular copia para cá as que leu das notificações (e a
// situação de cada uma), e elas vão pela sincronização para a versão web, que lança e ignora como no app. Cada uma:
// {t (hora do aviso, a chave), app, nome, texto, titulo, oculto, tipo, st, u (hora da última mudança: na junção, vale a
// mais nova)}. limpas = hora do último "Limpar todas" (o que é de antes não volta). Ficam as de 90 dias, até 500.
const SUG_ST = ['nova', 'aberta', 'lancada', 'ignorada'], SUGS_DIAS = 90, SUGS_MAX = 500;
function sugsLimpas(s){
  const o = s && typeof s === 'object' ? s : {}, limpas = Number(o.limpas) > 0 ? Number(o.limpas) : 0;
  const desde = Date.now() - SUGS_DIAS * 864e5, txt = (v, n) => v == null ? '' : String(v).slice(0, n), porT = new Map();
  for (const x of Array.isArray(o.lista) ? o.lista : []){
    const t = Number(x && x.t);
    if (!Number.isFinite(t) || t <= limpas || t < desde || !SUG_ST.includes(x.st)) continue;
    const n = {t, app:txt(x.app, 120), nome:txt(x.nome, 60), texto:txt(x.texto, 400), titulo:txt(x.titulo, 120), st:x.st, u:Number(x.u) || t};
    if (x.oculto) n.oculto = true;
    if (x.tipo === 'vale' || x.tipo === 'carteira') n.tipo = x.tipo;
    const a = porT.get(t);
    if (!a || n.u >= a.u) porT.set(t, n);
  }
  return {limpas, lista:[...porT.values()].sort((a, b) => a.t - b.t).slice(-SUGS_MAX)};
}
// Junta as sugestões de dois lados (sincronização): de cada uma, a mudança mais recente; o "Limpar todas" mais novo vale.
const sugsJuntar = (a, b) => sugsLimpas({limpas:Math.max((a && a.limpas) || 0, (b && b.limpas) || 0),
  lista:[...((b && b.lista) || []), ...((a && a.lista) || [])]});
function fixDb(d){
  for (const c of COLS) if (!Array.isArray(d[c])) d[c] = [];
  for (const k of ['tomb', 'budgets', 'cardClose', 'cardDue', 'cardAcc', 'cardLimit', 'yieldLog', 'netLog', 'catMemo', 'cats',
    'membros']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
  for (const t of ['gasto', 'ganho']) if (!d.cats[t] || typeof d.cats[t] !== 'object') d.cats[t] = {};
  // Os dados chegam também da planilha da conta compartilhada e de backups importados, que qualquer um pode editar.
  // Ids e chaves de categoria entram em data-onclick="...('id')" nas telas: ficam só com letras, números, _ e -.
  // Categorias: ícone conhecido, cor #rrggbb e nome de até 40 letras (sem tirar caracteres: "Bares & Restaurantes").
  const limpaId = v => typeof v === 'string' && /[^\w-]/.test(v) ? v.replace(/[^\w-]/g, '') : v;
  for (const c of COLS) d[c] = d[c].filter(r => r && typeof r === 'object');
  for (const c of COLS) for (const r of d[c]){ r.id = limpaId(r.id); if (r.pid) r.pid = limpaId(r.pid); if (r.cat) r.cat = limpaId(r.cat); }
  for (const t of ['gasto', 'ganho']){
    const cs = d.cats[t];
    for (const k of Object.keys(cs)){
      const c = cs[k] && typeof cs[k] === 'object' ? catLimpa(cs[k]) : {}, nk = limpaId(k);
      if (nk !== k) delete cs[k];
      if (nk) cs[nk] = c;
    }
  }
  if (typeof d.archUntil !== 'string') d.archUntil = '';
  // Regra do dia dos ganhos (diaGanho, em calculos.js): só valores conhecidos.
  for (const r of d.incomes){
    if (r.regra != null && !['ult', 'prim', 'nutil'].includes(r.regra)) delete r.regra;
    if (r.ajuste != null && !['antes', 'depois'].includes(r.ajuste)) delete r.ajuste;
  }
  d.sugs = sugsLimpas(d.sugs);
  // Moeda e país (Aparência): só códigos das listas de js/paises.js.
  if (d.prefs && typeof d.prefs === 'object'){
    if ('moeda' in d.prefs && !MOEDAS.includes(d.prefs.moeda)) delete d.prefs.moeda;
    if ('pais' in d.prefs && !PAISES.includes(d.prefs.pais)) delete d.prefs.pais;
  }
  if (d.prefs && typeof d.prefs === 'object' && 'prevPontos' in d.prefs){
    const l = d.prefs.prevPontos, ok = Array.isArray(l) ? Object.keys(PREV_PONTOS).filter(k => l.includes(k)) : [];
    if (!Array.isArray(l) || (l.length && !ok.length)) delete d.prefs.prevPontos; else d.prefs.prevPontos = ok;
  }
  // Lixeira: o que foi excluído fica 30 dias, só neste aparelho. [{col, rec, at}]
  d.trash = (Array.isArray(d.trash) ? d.trash : []).filter(t => t.at > Date.now() - 30*864e5);
  d.rates = Object.assign({cdi:14.9, selic:15, ipca:4.5, auto:'1'}, d.rates);
  for (const v of d.investments) if (v.ticker && !v.lots) v.lots = [{qty:v.qty, paid:v.paid, date:v.date || ''}];
  for (const v of d.investments) if (v.broker != null) v.broker = String(v.broker).slice(0, 40); // corretora: texto, até 40 letras
  // Previsões: categoria, mês AAAA-MM, valor maior que zero, dia final de 1 a 31, se repete, fim (ate) e as mudanças de
  // um mês só (ex: {AAAA-MM: {value, dia} ou {del:1}}).
  const ehMes = v => typeof v === 'string' && /^\d{4}-\d\d$/.test(v), diaOk = v => Math.min(31, Math.max(1, parseInt(v) || 31));
  d.previsoes = d.previsoes.filter(p => p.cat && ehMes(p.mes) && +p.value > 0);
  for (const p of d.previsoes){
    Object.assign(p, {value:round2(+p.value), dia:diaOk(p.dia), rep:!!p.rep});
    if (!ehMes(p.ate)) delete p.ate;
    p.ex = Object.fromEntries(Object.entries(p.ex && typeof p.ex === 'object' ? p.ex : {}).filter(([k, e]) => ehMes(k) && e && typeof e === 'object' && (e.del || +e.value > 0))
      .map(([k, e]) => [k, e.del ? {del:1} : {value:round2(+e.value), dia:diaOk(e.dia)}]));
  }
  // Parcelas: tipo (financiamento ou empréstimo; sem ele, compra parcelada), credor e conta de débito (texto), dia do
  // vencimento (1 a 31), taxa de juros ao mês (até 20%), seg = valor das parcelas a partir de cada uma (depois de um
  // abatimento) e ab = abatimentos [{d:'AAAA-MM-DD', v, modo}]. Vêm também da conta compartilhada e de backups.
  for (const p of d.installments){
    if (!PARC_TIPOS[p.tipo]) delete p.tipo;
    for (const k of ['credor', 'conta']) if (p[k] != null) p[k] = String(p[k]).slice(0, 60);
    const due = Number(p.due);
    if (Number.isInteger(due) && due >= 1 && due <= 31) p.due = due; else delete p.due;
    const taxa = Number(p.taxa);
    if (taxa > 0 && taxa <= 20) p.taxa = taxa; else delete p.taxa;
    const seg = (Array.isArray(p.seg) ? p.seg : []).filter(s => s && Number.isInteger(s.de) && s.de >= 0 && Number(s.v) > 0).map(s => ({de:s.de, v:Number(s.v)})).sort((a, b) => a.de - b.de);
    if (seg.length && seg[0].de === 0) p.seg = seg; else delete p.seg;
    const ab = (Array.isArray(p.ab) ? p.ab : []).filter(a => a && /^\d{4}-\d{2}-\d{2}$/.test(a.d) && Number(a.v) > 0).map(a => ({d:a.d, v:Number(a.v),
      modo:a.modo === 'parcela' ? 'parcela' : 'prazo'}));
    if (ab.length) p.ab = ab; else delete p.ab;
  }
  return d;
}
// Onde os dados ficam:
// - no APK, num arquivo do próprio app (Android.dadosSalvar/dadosLer), sem o limite de tamanho do armazenamento da página.
//   Na primeira gravação o app lê o arquivo de volta para conferir; estando igual, o armazenamento antigo (localStorage)
//   deixa de ser usado neste aparelho (FILE_OK). Se um dia o arquivo falhar, a gravação cai de volta no armazenamento antigo;
// - no navegador (prévia do PC), no localStorage, com uma cópia no IndexedDB que cobre o caso de ele encher.
// Ao abrir, vale a cópia alterada por último.
const FILE_OK = 'financas-arquivo-ok';
const fileStore = () => (!window.TESTE || window.TESTE_ARQ) && temNativo('dadosSalvar') && temNativo('dadosLer') ? Android : null;
let fileChecked = false;
try { fileChecked = localStorage.getItem(FILE_OK) === '1'; } catch(e){}
// Versão web: os dados ficam cifrados (js/cifra.js). Aqui só se guarda o texto; decifrarAoAbrir() o abre depois.
let textoCifrado = '';
function readDb(){
  let a = null, arq = null;
  try { const t = localStorage.getItem(KEY); if (ehCifrado(t)) textoCifrado = t; else a = JSON.parse(t) || null; } catch(e){}
  const st = fileStore();
  if (st) try { arq = JSON.parse(st.dadosLer() || 'null'); } catch(e){}
  if (arq && !Array.isArray(arq.expenses)) arq = null;
  return arq && (!a || (arq.mod || 0) >= (a.mod || 0)) ? arq : a || {};
}
// Grava o texto dos dados; devolve true se ficou guardado em algum lugar.
function writeDb(json){
  if (demoOn) return true; // demonstração: nada vai para o arquivo do app nem para o IndexedDB
  if (dadosPendentes) return true; // dados cifrados ainda abrindo: não grava por cima deles
  if (CIFRA_ATIVA) return writeDbCifrado(json);
  const st = fileStore();
  if (st && st.dadosSalvar(json)){
    if (fileChecked) return true;
    if (st.dadosLer() === json){ // conferido: o arquivo passa a ser o lugar dos dados
      fileChecked = true;
      try { localStorage.setItem(FILE_OK, '1'); localStorage.removeItem(KEY); } catch(e){}
      return true;
    }
  }
  try { localStorage.setItem(KEY, json); if (!st) idbPut(json); return true; } catch(e){ if (!saveFailed) logErr('gravar dados', e); }
  if (!st) idbPut(json, true); // navegador com o armazenamento cheio: tenta o IndexedDB, que tira o aviso se der certo
  return false;
}
// Versão web: grava o texto cifrado no localStorage e no IndexedDB (a cópia sem o limite de 5 MB). Como cifrar leva
// um instante, o aviso de "não deu para gravar" aparece quando a gravação termina.
function writeDbCifrado(json){
  gravarCifrado(json, c => {
    let ok = false;
    try { localStorage.setItem(KEY, c); ok = true; } catch(e){ if (!saveFailed) logErr('gravar dados', e); }
    return idbWrite(c).then(() => true, () => ok).then(gravou => { if (saveFailed !== !gravou){ saveFailed = !gravou; saveWarn(); } });
  }).catch(e => logErr('cifrar dados', e));
  return true;
}
// IndexedDB (só no navegador): uma cópia dos dados que não tem o limite de 5 MB.
let idb = null;
function idbOpen(){
  if (!idb) idb = new Promise((res, rej) => { try {
    setTimeout(() => rej(new Error('IndexedDB não respondeu')), 3000); // alguns navegadores deixam o pedido parado
    const r = indexedDB.open('financas', 1);
    r.onblocked = () => rej(new Error('IndexedDB bloqueado'));
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  } catch(e){ rej(e); } });
  return idb;
}
// Toda operação no IndexedDB tem limite de tempo: em alguns navegadores o pedido fica parado sem responder.
const idbTimed = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('IndexedDB não respondeu')), 3000))]);
const idbWrite = json => idbTimed(idbOpen().then(d => new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite');
  t.objectStore('kv').put(json, KEY); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); })));
const idbRead = () => idbTimed(idbOpen().then(d => new Promise((res, rej) => { const r = d.transaction('kv').objectStore('kv').get(KEY);
  r.onsuccess = () => res(r.result || ''); r.onerror = () => rej(r.error); })));
function idbPut(json, salva){
  later('idb', () => idbWrite(json).then(() => { if (salva && saveFailed){ saveFailed = false; saveWarn(); } }).catch(() => {}));
}
// Ao abrir no navegador: se a cópia do IndexedDB for mais nova que a do localStorage (ele estava cheio), vale ela.
function restoreFromIdb(){
  if (fileStore() || window.TESTE) return Promise.resolve(false);
  return idbRead().then(t => ehCifrado(t) ? decifrarTexto(t) : t).then(json => {
    const d = json ? JSON.parse(json) : null;
    if (!d || !Array.isArray(d.expenses) || (d.mod || 0) <= (db.mod || 0)) return false;
    loadDb(d); rollover(); telaAtualizar(true);
    return true;
  }).catch(() => false);
}
let db = {};
// Resultados de expensesOf/incomesOf por mês, guardados até a próxima alteração (o Resumo pede cada mês dezenas de vezes).
let memo = {};
const dirty = () => { memo = {}; };
const cached = (k, fn) => k in memo ? memo[k] : (memo[k] = fn());
// Trabalho que pode esperar um instante (lembretes, widget, arquivo): várias gravações seguidas viram uma só.
const laterT = {}, laterF = {};
function later(k, fn, ms = 400){
  if (window.TESTE) return fn();
  clearTimeout(laterT[k]); laterF[k] = fn;
  laterT[k] = setTimeout(() => { delete laterF[k]; fn(); }, ms);
}
function flushLater(){ for (const k of Object.keys(laterF)){ clearTimeout(laterT[k]); const fn = laterF[k]; delete laterF[k]; fn(); } }
document.addEventListener('visibilitychange', () => { if (document.hidden) flushLater(); }); // saindo do app: grava o que estava esperando
db = readDb();
// Havia dados guardados neste aparelho antes desta abertura: é atualização, não instalação nova (ver lembMigrar).
const dadosNoAparelho = Object.keys(db).length > 0 || !!textoCifrado;
fixDb(db);
// Categorias personalizadas: db.cats = {gasto:{chave:{name, icon, hidden}}, ganho:{...}} renomeia ou esconde as
// categorias de fábrica e acrescenta novas. applyCats() refaz CAT_GASTO/CAT_GANHO a partir das de fábrica + db.cats;
// o 4º item de cada categoria (c[3]) indica que ela está escondida (some das listas de escolha, mas não dos lançamentos).
const BASE_CATS = {gasto:JSON.parse(JSON.stringify(CAT_GASTO)), ganho:JSON.parse(JSON.stringify(CAT_GANHO))};
const plainName = s => String(s).trim().toLowerCase();
function applyCats(){
  for (const [type, target] of [['gasto', CAT_GASTO], ['ganho', CAT_GANHO]]){
    for (const k in target) delete target[k];
    Object.assign(target, JSON.parse(JSON.stringify(BASE_CATS[type])));
    for (const [k, c] of Object.entries(db.cats[type])){
      const base = target[k] || ['tag', c.name, '#64748b'];
      target[k] = [c.icon || base[0], c.name || base[1], c.color || base[2], !!c.hidden];
    }
    // Categoria criada pelo usuário com o mesmo nome de uma de fábrica (ex.: "Pets"): fica só a do usuário.
    const proprias = Object.keys(db.cats[type]).filter(k => !BASE_CATS[type][k]).map(k => plainName(target[k][1]));
    for (const k of Object.keys(BASE_CATS[type])) if (!db.cats[type][k] && proprias.includes(plainName(target[k][1]))) delete target[k];
  }
}
applyCats();
// touch = false para gravações que não são alteração do usuário (abrir o app, atualizar taxas e cotações).
const save = (touch = true) => {
  if (demoOn){ dirty(); return; } // demonstração: só na memória
  dirty();
  resumoAutoLiga();
  db.yieldLog[curYM] = yieldOf(curYM);                    // histórico do rendimento estimado, mês a mês
  db.netLog[curYM] = sum(db.investments, v => v.value);   // histórico do total investido, mês a mês
  if (touch){ db.mod = Date.now(); if (sync.on){ sync.pend = (sync.pend || 0) + 1; saveSync(); nuvemDraw(); } scheduleSync(); autoFile(); }
  db.ver = DB_VER;
  const ok = writeDb(JSON.stringify(db));
  if (saveFailed !== !ok){ saveFailed = !ok; saveWarn(); }
  later('avisos', () => shown(() => { scheduleReminders(); updateWidget(); updateAlerts(); if (touch) prevAvisos(); }));
};
// Resumo ainda no padrão enxuto: o primeiro vale liga o bloco Vales e o primeiro parcelamento liga o bloco Parcelas,
// uma vez cada, enquanto a pessoa não tiver mexido nesses blocos em Personalizar.
function resumoAutoLiga(){
  const p = db.prefs;
  if (!Array.isArray(p.resumoAuto) || !p.resumoAuto.length) return;
  for (const [k, tem] of [['vales', temVales], ['parcelas', () => db.installments.length > 0]]){
    if (!p.resumoAuto.includes(k) || !tem()) continue;
    const b = p.resumo.find(x => x.k === k);
    if (b) b.on = true;
    p.resumoAuto = p.resumoAuto.filter(x => x !== k);
  }
}
// A gravação pode falhar (armazenamento cheio). O aviso fica na tela até uma gravação dar certo.
let saveFailed = false;
function saveWarn(){
  const el = document.getElementById('saveWarn');
  if (el) el.hidden = !saveFailed;
}
const newerDb = d => (d && d.ver || 1) > DB_VER;
// Marca o registro como alterado agora. Registro novo (ainda sem u) guarda quem o criou (by), para a conta compartilhada.
const myName = () => (db.prefs && db.prefs.name) || '';
// Conta compartilhada: by = quem lançou; ed = quem alterou por último (usado nos avisos "fulano editou…").
const touch = r => { if (!r.u && !r.by && myName()) r.by = myName();
  else if (r.u && typeof shared === 'function' && shared() && myName()) r.ed = myName(); r.u = Date.now(); return r; };
// Cópia de segurança automática em arquivo, uma vez por semana, na pasta do app no celular (só no APK).
function autoFile(){
  if (!(temNativo('backupArquivo')) || Date.now() - (sync.fileAt || 0) < 7*864e5) return;
  const dir = nativo('backupArquivo', JSON.stringify(db));
  if (dir){ sync.fileAt = Date.now(); sync.fileDir = dir; saveSync();
    centralAdd('Cópia semanal dos dados salva neste celular.', 'sucesso', 0, {k:'cfg', s:'dados'}); }
}
// Troca todos os dados pelos de um backup ou pelos que vieram da conta Google.
function loadDb(d){
  db = fixDb(Object.assign({}, d, {rates:d.rates || db.rates}));
  dirty();
  applyCats(); ensurePrefs(); applyTheme();
}
// Versão web com os dados cifrados: abre (decifra) logo depois de todos os arquivos carregarem; a abertura do app
// (inicio.js) espera por esperarDados. Se não der para decifrar (chave apagada junto com parte dos dados do site), o
// texto fica guardado à parte e o app abre vazio: com a conta Google, os dados voltam pela sincronização.
if (textoCifrado){
  dadosPendentes = true;
  addEventListener('DOMContentLoaded', () => decifrarTexto(textoCifrado).then(json => { loadDb(JSON.parse(json)); if (!visTabs().includes(state.tab)) state.tab = visTabs()[0]; })
    .catch(e => {
      logErr('decifrar dados', e);
      try { localStorage.setItem(KEY + '-ilegivel', textoCifrado); } catch(x){}
      setTimeout(() => avisoErro('decifrar'), 1500);
    }).finally(dadosProntos));
}
