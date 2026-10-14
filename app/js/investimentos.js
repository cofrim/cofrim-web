// Cofrim — Investimentos com cotação (ações, moedas) e as taxas de referência pela internet. Depende de dados.js.
// Saiu de js/dados.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Ações e moedas: investimentos com cotação ----------
// Categorias cujo valor vem de cotação: 'b3' = ações/FIIs (brapi.dev), 'fx' = moedas e cripto (AwesomeAPI).
// Cada ativo é um registro só, com lots = lista de compras [{qty, paid, date}]. A partir delas saem
// qty (total), paid (preço médio) e value = qty × quote, então o resto do app o trata como qualquer investimento.
const QUOTE_SRC = {acoes:'b3', fiis:'b3', moeda:'fx', cripto:'fx'};
const BRAPI = 'https://brapi.dev/api', AWESOME = 'https://economia.awesomeapi.com.br';
const FX_POPULAR = ['USD','EUR','GBP','BTC','ETH','JPY','CAD','AUD','CHF','ARS','CNY','SOL'];
const fmtQ = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits: v < 10 ? 4 : 2});
const fmtDate = d => d ? d.split('-').reverse().join('/') : 'sem data';
const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const getJson = async url => { const r = await espera(fetch(url)); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
function recalc(v){
  v.qty = sum(v.lots, l => l.qty);
  v.paid = v.qty ? sum(v.lots, l => l.qty * l.paid) / v.qty : 0;
  v.value = v.qty * v.quote;
}

// Busca na lista completa da B3 por código ou nome; sem texto, traz as mais negociadas.
async function searchB3(q){
  const j = await getJson(`${BRAPI}/quote/list?limit=25&search=${encodeURIComponent(q.trim())}`);
  return j.stocks.map(s => ({code:s.stock, name:s.name, quote:s.close}));
}
let fxList = null; // {USD:'Dólar Americano', ...}, carregada uma vez
async function searchFx(q){
  if (!fxList){ fxList = await getJson(`${AWESOME}/json/available/uniq`); delete fxList.BRL; delete fxList.BRLT; }
  const t = plain(q.trim()), all = Object.entries(fxList);
  const hits = t ? all.filter(([c,n]) => plain(c).includes(t) || plain(n).includes(t)) : FX_POPULAR.filter(c => fxList[c]).map(c => [c, fxList[c]]);
  const rank = c => (FX_POPULAR.indexOf(c) + 1) || 99; // as mais usadas primeiro
  hits.sort((a,b) => rank(a[0]) - rank(b[0]));
  return hits.slice(0, 25).map(([code,name]) => ({code, name, quote:null})); // a cotação é buscada ao escolher
}
async function fxQuotes(codes){
  const j = await getJson(`${AWESOME}/json/last/${codes.map(c => c + '-BRL').join(',')}`);
  return Object.fromEntries(codes.map(c => [c, parseFloat((j[c + 'BRL'] || {}).bid)]));
}
// CDI acumulado (em %) de uma data até hoje, pela taxa atual do CDI. É uma aproximação: a taxa mudou ao longo do tempo.
function cdiSince(date){
  const dias = Math.max(0, (now - new Date(date + 'T00:00:00')) / 864e5);
  return (Math.pow(1 + db.rates.cdi / 100, dias / 365) - 1) * 100;
}
// Alerta de preço: avisa uma vez quando a cotação cruza o valor definido (alertUp / alertDown); alertHit evita repetir.
function checkPriceAlerts(){
  const hits = [];
  for (const v of db.investments){
    if (!v.ticker || !v.quote) continue;
    const lado = v.alertUp && v.quote >= v.alertUp ? 'up' : v.alertDown && v.quote <= v.alertDown ? 'down' : '';
    if (lado && v.alertHit !== lado) hits.push(`${v.ticker} ${lado === 'up' ? 'passou de' : 'caiu abaixo de'} ${fmtQ(lado === 'up' ? v.alertUp : v.alertDown)} (agora ${fmtQ(v.quote)})`);
    v.alertHit = lado;
  }
  if (hits.length){ toast(hits.join(' · '), {dest:{k:'invest'}});
    if (temNativo('notificar') && podeNotificar('preco')) nativo('notificar', 'Alerta de preço', hits.join('\n')); }
  return hits;
}
// Entrega ao lado nativo os alertas de preço, para ele conferir de hora em hora mesmo com o app fechado (só no APK).
let alertsSent = '';
function updateAlerts(){
  if (!(temNativo('alertas')) || demoOn) return;
  const json = JSON.stringify(db.investments.filter(v => v.ticker && (v.alertUp || v.alertDown)).map(v => ({code:v.ticker,
    src:QUOTE_SRC[v.cat] || 'b3', up:+v.alertUp || 0, down:+v.alertDown || 0})));
  if (json !== alertsSent){ alertsSent = json; nativo('alertas', json); }
}
// Atualiza a cotação de tudo o que o usuário tem. Automático no máximo a cada 10 minutos.
let quoting = false;
async function refreshQuotes(force){
  const held = db.investments.filter(v => v.ticker);
  if (!held.length || quoting || demoOn || (!force && Date.now() - (db.quotesAt || 0) < 10*60e3)) return false; // demonstração: cotação fictícia
  quoting = true;
  telaAtualizar(); // mostra os valores "carregando" enquanto as cotações chegam
  let ok = false;
  const set = (list, code, q) => { if (q > 0) list.filter(v => v.ticker === code).forEach(v => { v.quote = q; v.quoteAt = Date.now(); recalc(v); ok = true; });
    };
  const fx = held.filter(v => QUOTE_SRC[v.cat] === 'fx'), b3 = held.filter(v => QUOTE_SRC[v.cat] === 'b3');
  try { if (fx.length){ const qs = await fxQuotes([...new Set(fx.map(v => v.ticker))]); for (const c in qs) set(fx, c, qs[c]); } } catch(e){}
  for (const code of new Set(b3.map(v => v.ticker))){
    try { const hit = (await searchB3(code)).find(a => a.code === code); if (hit) set(b3, code, hit.quote); } catch(e){}
  }
  quoting = false;
  if (ok){ db.quotesAt = Date.now(); checkPriceAlerts(); save(false); }
  else if (force) avisoErro('internet', 'Não foi possível atualizar as cotações agora.'); // pedido pelo botão: diz que não deu
  telaAtualizar();
  return ok;
}

// Lista de resultados dentro do formulário de investimento.
let assetTimer = 0, assetResults = [];
function rateLabel(inv){
  if (inv.index === 'ipca') return 'IPCA + ' + inv.pct.toLocaleString('pt-BR') + '% a.a.';
  if (inv.index === 'pre') return inv.pct.toLocaleString('pt-BR') + '% a.a. prefixado';
  return inv.pct.toLocaleString('pt-BR') + '% ' + (inv.index === 'cdi' ? 'do CDI' : 'da Selic');
}

// ---------- Taxas pela internet (API pública do Banco Central, séries SGS) ----------
// 4389 = CDI anualizado, 432 = meta Selic, 13522 = IPCA acumulado em 12 meses (todas em % a.a.)
async function updateRates(force){
  if (!force && (!db.rates.auto || Date.now() - (db.rates.at || 0) < 12*3600e3)) return false;
  try {
    const get = async code => {
      const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`);
      const v = parseFloat((await r.json())[0].valor);
      if (isNaN(v)) throw new Error('valor inválido');
      return v;
    };
    const [cdi, selic, ipca] = await Promise.all([get(4389), get(432), get(13522)]);
    Object.assign(db.rates, {cdi, selic, ipca, at:Date.now()});
    save(false);
    telaAtualizar();
    return true;
  } catch(e){ return false; } // sem internet: continua com as últimas taxas salvas
}
async function updateRatesNow(){
  document.getElementById('ferr').textContent = 'Buscando taxas…';
  if (await updateRates(true)) openRates();
  else if (F) document.getElementById('ferr').textContent = 'Não foi possível buscar as taxas. Verifique a internet.';
}
const ratesInfo = () => db.rates.at ? 'atualizadas em ' + new Date(db.rates.at).toLocaleDateString('pt-BR') + ' pelo Banco Central' : 'ainda não atualizadas pela internet';
