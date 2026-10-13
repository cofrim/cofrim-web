// Cofrim — Aparelhos ligados à conta (Configurações › Conta e sincronização). Sem servidor: cada aparelho escreve a
// própria linha num arquivo da pasta oculta do app no Google Drive (aparelhos.json), na primeira sincronização de cada
// abertura e depois no máximo a cada 30 min, e lê as dos outros. Tirar outro aparelho marca a linha dele (sair): ele
// sai sozinho na próxima sincronização. O local (cidade, estado e país) é aproximado, pelo endereço de internet
// (ipapi.co), e só é pedido uma vez por abertura do app. Depende de sincronizacao.js (driveList, driveWrite) e de
// copias.js (sairDaqui).
const APARELHO_KEY = 'financas-aparelho', APARELHOS_ARQ = 'aparelhos.json';
let aparelhos = null, aparelhoGravado = 0, aparelhoSessao = false, aparelhoLocal = null, aparelhosPedido = 0;
// Identidade deste aparelho (só dele, não vai para a conta junto com os dados).
function aparelhoId(){
  let id = '';
  try { id = localStorage.getItem(APARELHO_KEY) || ''; } catch(e){}
  if (!/^[a-z0-9]{6,20}$/.test(id)){ id = uid(); try { localStorage.setItem(APARELHO_KEY, id); } catch(e){} }
  return id;
}
// Nome a partir do navegador: no app do Android, o modelo (ex.: SM-A145M); na web, o navegador e o sistema.
function aparelhoNome(){
  const ua = navigator.userAgent, m = /Android [\d.]+; ([^;)]+?)(?: Build|\))/.exec(ua);
  if (temNativo() && !WEB_APP) return 'Android · ' + (m ? m[1].trim() : 'Cofrim');
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Web';
  const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : '';
  return nav + (so ? ' · ' + so : '');
}
// Cidade, estado e país aproximados (pelo endereço de internet), uma vez por abertura; sem internet ou sem resposta, nada.
async function aparelhoOnde(){
  if (aparelhoLocal) return aparelhoLocal;
  try {
    const r = await Promise.race([fetch('https://ipapi.co/json/'), new Promise((_, falha) => setTimeout(() => falha(new Error('sem resposta')), 6000))]);
    const j = await r.json(), t = v => String(v || '').slice(0, 60);
    if (j && !j.error) aparelhoLocal = {cidade:t(j.city), estado:t(j.region), pais:t(j.country_name)};
  } catch(e){}
  return aparelhoLocal;
}
// Linhas lidas do arquivo, conferidas (o arquivo vem da conta, mas pode ter sido gravado por uma versão antiga).
function aparelhosLimpos(d){
  const lista = {}, l = d && d.aparelhos && typeof d.aparelhos === 'object' ? d.aparelhos : {}, num = v => +v > 0 ? +v : 0;
  const lugar = o => o && typeof o === 'object' ? {cidade:String(o.cidade || '').slice(0, 60), estado:String(o.estado || '').slice(0, 60),
    pais:String(o.pais || '').slice(0, 60)} : null;
  for (const [k, x] of Object.entries(l)) if (/^[a-z0-9]{6,20}$/.test(k) && x && typeof x === 'object')
    lista[k] = {nome:String(x.nome || '').slice(0, 60), app:String(x.app || '').slice(0, 10), prim:num(x.prim), primLocal:lugar(x.primLocal),
      ult:num(x.ult), ultLocal:lugar(x.ultLocal), sinc:num(x.sinc), sair:num(x.sair)};
  return lista;
}
async function aparelhosLer(){
  const f = (await driveList(`name='${APARELHOS_ARQ}'`))[0];
  return {f, lista:aparelhosLimpos(f ? await driveGet(f.id) : null)};
}
const aparelhosGravar = (f, lista) => driveWrite(f && f.id, APARELHOS_ARQ, JSON.stringify({ver:1, aparelhos:lista}));
// Depois de sincronizar (copias.js): grava a linha deste aparelho. Se outro aparelho pediu, sai da conta aqui.
async function aparelhosAtualizar(forcar){
  if (demoOn || !canSync() || !sync.on || (!forcar && Date.now() - aparelhoGravado < 30 * 60e3)) return;
  const {f, lista} = await aparelhosLer(), id = aparelhoId(), eu = lista[id], agora = Date.now();
  if (eu && eu.sair) return aparelhoSaiuDeLonge(f, lista);
  const novo = !eu || !aparelhoSessao, onde = novo ? await aparelhoOnde() : null;
  lista[id] = {...(eu || {}), nome:aparelhoNome(), app:APP_VERSION, prim:eu && eu.prim || agora, primLocal:eu && eu.prim ? eu.primLocal : onde,
    ult:novo ? agora : eu.ult, ultLocal:novo ? onde || (eu && eu.ultLocal) : eu.ultLocal, sinc:sync.at || agora, sair:0};
  for (const [k, x] of Object.entries(lista)) if (k !== id && Math.max(x.ult, x.sinc) < agora - 365 * 864e5) delete lista[k]; // sem notícia há 1 ano
  await aparelhosGravar(f, lista);
  aparelhos = lista; aparelhoGravado = agora; aparelhoSessao = true;
}
// Outro aparelho pediu para este sair: tira a própria linha, sai da conta Google e apaga os dados daqui (eles
// continuam na conta), sem perguntar.
async function aparelhoSaiuDeLonge(f, lista){
  delete lista[aparelhoId()];
  await aparelhosGravar(f, lista).catch(() => {});
  await sairNativo().catch(() => {});
  sairDaqui();
  tell('Este aparelho saiu da sua conta Google a pedido de outro aparelho. Os dados continuam na conta: entre de novo para vê-los.');
}
// Ao sair da conta por aqui (logout): a linha deste aparelho sai da lista.
async function aparelhoEsquecer(){
  if (demoOn || !canSync() || !sync.on) return;
  const {f, lista} = await aparelhosLer();
  if (lista[aparelhoId()]){ delete lista[aparelhoId()]; await aparelhosGravar(f, lista); }
  aparelhos = null; aparelhoSessao = false; aparelhoGravado = 0;
}
// Tirar outro aparelho da conta: marca a linha dele; ele sai na próxima vez que sincronizar.
async function aparelhoTirar(k){
  if (demoBloqueia()) return;
  const x = aparelhos && aparelhos[k];
  if (!x || !await ask(`Tirar "${x.nome || 'Aparelho'}" da sua conta?\n\nNa próxima vez que o app abrir nesse aparelho, ele sai da conta Google e `
    + 'apaga os dados de lá. Os dados continuam na sua conta.', 'Tirar da conta', true)) return;
  try {
    const {f, lista} = await aparelhosLer();
    if (lista[k]){ lista[k].sair = Date.now(); await aparelhosGravar(f, lista); }
    aparelhos = lista;
  } catch(e){ logErr('tirar aparelho', e); return avisoErro('internet', 'Não foi possível tirar o aparelho agora.'); }
  if (settingsOpen) openSettings('conta');
}
// Na tela da conta: busca a lista (no máximo a cada minuto) e redesenha a seção se ela continuar aberta.
function aparelhosPedir(){
  if (demoOn || !canSync() || !sync.on || Date.now() - aparelhosPedido < 60e3) return;
  aparelhosPedido = Date.now();
  aparelhosAtualizar(true).catch(e => { logErr('aparelhos', e); if (!aparelhos) aparelhos = {}; })
    .finally(() => { if (settingsOpen && setSec === 'conta') openSettings('conta'); });
}
function aparelhosHtml(){
  if (!canSync() || !sync.on) return '';
  aparelhosPedir();
  if (!aparelhos) return '<label>Aparelhos ligados à conta</label><div class="semTopo hint">Buscando os aparelhos…</div>';
  const id = aparelhoId(), quando = t => t ? new Date(t).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : '—';
  const onde = l => l && (l.cidade || l.estado || l.pais) ? ' · ' + esc([l.cidade, l.estado, l.pais].filter(Boolean).join(', ')) : '';
  const lista = Object.entries(aparelhos).sort(([a, x], [b, y]) => (a === id ? -1 : b === id ? 1 : y.sinc - x.sinc));
  return `<label>Aparelhos ligados à conta</label>${lista.map(([k, x]) => `<div class="plano card aparelho">
    <b>${esc(x.nome || 'Aparelho')}</b>${k === id ? '<small class="in">Este aparelho</small>' : ''}
    <small><span>Primeiro acesso:</span> ${quando(x.prim)}${onde(x.primLocal)}</small>
    <small><span>Último acesso:</span> ${quando(x.ult)}${onde(x.ultLocal)}</small>
    <small><span>Última sincronização:</span> ${quando(x.sinc)}</small>
    ${k === id ? '' : x.sair ? '<small class="warn">Saída pedida: o aparelho sai da conta quando abrir o app.</small>'
      : `<div class="btns"><button class="btn danger" data-onclick="aparelhoTirar('${k}')">Tirar da conta</button></div>`}</div>`).join('')}
    <div class="hint">O local é aproximado, pelo endereço de internet de cada aparelho (serviço ipapi.co).</div>`;
}
