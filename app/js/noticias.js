// Cofrim — Aba Notícias: manchetes de sites de notícias por RSS (só no APK; a versão web não tem a aba). Depende de
// telas.js.
// Saiu de js/telas.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Notícias (manchetes de sites de notícias, via RSS) ----------
const gnews = q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
// Bing Notícias e Exame trazem foto; o Google Notícias não traz, mas tem mais volume.
// interval "7" = últimas 24 horas, "8" = última semana.
const bnews = (q, interval) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&qft=${encodeURIComponent(`interval="${interval}"`)}&format=rss&cc=br&setlang=pt-br`;
const NEWS = {
  dia:{label:'Principais do dia',
    feeds:[['https://exame.com/invest/feed/', 'Exame'], [bnews('mercado financeiro ibovespa', 7), ''], [bnews('investimentos dólar selic', 7), ''],
    [gnews('"mercado financeiro" OR ibovespa OR "bolsa de valores" when:1d'), '']]},
  rec:{label:'Onde investir', feeds:[[bnews('onde investir', 8), ''], [bnews('carteira recomendada ações', 8), ''],
    [gnews('"onde investir" OR "carteira recomendada" OR "recomendações de investimento" when:7d'), '']]}
};
const NEWS_KEY = 'financas-news';
let newsTab = 'dia', newsCache = {}; // {dia:{at, items:[{title, link, date, source, img}], err}}
try { newsCache = JSON.parse(localStorage.getItem(NEWS_KEY)) || {}; } catch(e){}
const newsLoading = {};

// Baixa um texto de outro site. No APK passa pelo lado nativo (sites de notícia não permitem acesso direto do WebView);
// no navegador do PC, pelo /proxy do serve.ps1.
function httpGet(url){
  if (temNativo('get')) return espera(new Promise((res, rej) => { const id = ++driveSeq;
    drivePending[id] = r => r.status === 200 ? res(r.text) : rej(r); nativo('get', id, url); }));
  return espera(fetch(location.hostname === 'localhost' ? '/proxy?u=' + encodeURIComponent(url) : url)).then(r => { if (!r.ok) throw r; return r.text(); });
}
// Os <style> que alguns feeds trazem no conteúdo saem antes de ler: a CSP só aceita os do app e avisaria a cada leitura.
function parseRss(xml, source){
  xml = xml.replace(/<([\w-]+:)?style\b[\s\S]*?<\/([\w-]+:)?style\s*>/gi, '');
  return [...new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('item')].map(it => {
    const get = t => ((it.getElementsByTagName(t)[0] || {}).textContent || '').trim(), src = get('News:Source') || get('source') || source;
    let title = get('title'), link = get('link'), img = get('News:Image') || get('mediaurl');
    if (src && title.endsWith(' - ' + src)) title = title.slice(0, -src.length - 3); // o Google repete a fonte no título
    if (link.includes('bing.com/news/apiclick')) try { link = new URL(link).searchParams.get('url') || link; } catch(e){} // endereço real da matéria
    if (img.includes('bing.com/th')) img += '&w=160&h=160&c=7'; // miniatura quadrada
    // Fotos só do Bing: a CSP (img-src) só deixa a tela pedir imagens a ele e às miniaturas dos temas (outro site seria
    // um caminho para dados saírem do app).
    img = img.replace(/^http:/, 'https:');
    if (!/^https:\/\/([\w-]+\.)*bing\.(com|net)\//.test(img)) img = '';
    return {title, link, date:Date.parse(get('pubDate')) || 0, source:src, img};
  }).filter(n => n.title && /^https?:\/\//.test(n.link));
}
async function loadNews(k, force){
  const c = newsCache[k];
  if (newsLoading[k] || (!force && c && Date.now() - c.at < 30*60e3)) return;
  newsLoading[k] = true;
  const results = await Promise.all(NEWS[k].feeds.map(([url, src]) => httpGet(url).then(x => parseRss(x, src)).catch(() => null)));
  newsLoading[k] = false;
  const seen = new Set(), byDate = (a,b) => b.date - a.date;
  const all = results.filter(Boolean).flat()
    .sort((a,b) => !!b.img - !!a.img) // entre repetidas, fica a que tem foto
    .filter(n => !seen.has(n.title) && seen.add(n.title)).sort(byDate);
  // Até 30 com foto; as sem foto (Google, que vem em volume bem maior) só completam a lista até 40.
  const withImg = all.filter(n => n.img).slice(0, 30);
  const items = withImg.concat(all.filter(n => !n.img).slice(0, 40 - withImg.length)).sort(byDate);
  newsCache[k] = items.length ? {at:Date.now(), items} : {at:Date.now() - 29*60e3, items:(c && c.items) || [], err:true}; // falhou: tenta de novo em 1 min
  try { localStorage.setItem(NEWS_KEY, JSON.stringify(newsCache)); } catch(e){}
  if (state.tab === 'noticias' && !sheetOpen()) render();
}
function ago(ts){
  const m = Math.round((Date.now() - ts) / 60e3);
  return !ts ? '' : m < 60 ? `há ${Math.max(m,1)} min` : m < 1440 ? `há ${Math.round(m/60)} h` : `há ${Math.round(m/1440)} d`;
}
function openNews(i){
  const url = newsCache[newsTab].items[i].link;
  if (temNativo('abrir')) nativo('abrir', url); else window.open(url, '_blank', 'noopener');
}
// Quadro com a inicial da fonte, para notícias sem foto (ou cuja foto não carregou).
const newsPh = s => `<div class="thumb ph">${esc((s || 'N').trim()[0].toUpperCase())}</div>`;
function viewNoticias(){
  const c = newsCache[newsTab], items = (c && c.items) || [];
  const top = items.findIndex(n => n.img); // a primeira com foto vira o destaque
  loadNews(newsTab);
  return `
  ${head('Notícias', 'noticias')}
  <div class="btns" style="margin:0 0 12px">${Object.entries(NEWS).map(([k,n]) => `<button class="btn ${newsTab === k ? 'primary' : ''}" data-onclick="newsTab='${k}';render();scrollTo(0,0)">${n.label}</button>`).join('')}</div>
  ${newsTab === 'rec' ? '<div class="hint u-vazio">Matérias e análises publicadas por sites de notícias. Não são uma recomendação deste app: avalie seu perfil e seus objetivos antes de investir.</div>' : ''}
  ${items.length ? `${top < 0 ? '' : `<div class="newsHero" data-onclick="openNews(${top})">
      <img src="${esc(items[top].img.replace('w=160&h=160', 'w=640&h=360'))}" alt="" referrerpolicy="no-referrer" data-onerror="this.remove()">
      <div><span class="src">${esc(items[top].source || 'Destaque')}</span><b>${esc(items[top].title)}</b><small>${ago(items[top].date)}</small></div></div>`}
    <div class="card news">${items.map((n,i) => i === top ? '' : `<div class="item" data-onclick="openNews(${i})">
      ${n.img ? `<img class="thumb" src="${esc(n.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-onerror="this.outerHTML=newsPh(this.dataset.s)" data-s="${esc(n.source)}">` : newsPh(n.source)}
      <div class="mid"><b>${esc(n.title)}</b><span class="src">${esc(n.source || 'Notícia')}</span> <small>${ago(n.date)}</small></div></div>`).join('')}</div>`
  : newsLoading[newsTab] ? skel(4) : empty('signal','Não foi possível carregar as notícias.<br>Verifique a internet e toque em Atualizar.')}
  <div class="btns u-mb12"><button class="btn" data-onclick="loadNews(newsTab,true);render()">${newsLoading[newsTab] ? 'Atualizando…' : I('refresh') + 'Atualizar'}</button></div>
  ${c && c.err && items.length ? '<div class="hint u-centro">Sem conexão: mostrando as últimas notícias salvas.</div>' : ''}`;
}
