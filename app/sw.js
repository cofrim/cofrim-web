// Cache para o app abrir sem internet (versão web). Só guarda os arquivos do próprio app: as respostas do Google
// (dados da conta) nunca passam pelo cache.
// A lista precisa ter todos os <script> do index.html: um que falte não abre sem internet (a versão sobe a cada mudança).
const CACHE = 'financas-v20';
const FILES = ['./', './index.html', './app.css', './js/largura.js', './js/abre.js', './js/acoes.js', './js/nativo.js', './js/temas.js', './js/temas2.js', './js/temas-img.js', './js/icones.js', './js/paises.js', './js/util.js', './js/cifra.js', './js/dados.js', './js/aparencia.js', './js/calculos.js', './js/previsoes.js', './js/rendimentos.js', './js/investimentos.js', './js/parcelas.js', './js/lembretes.js', './js/telas.js', './js/telas-previsoes.js', './js/saude.js', './js/telas-gastos.js', './js/telas-invest.js', './js/telas-planejamento.js', './js/telas-explorar.js', './js/noticias.js', './js/sugestoes.js', './js/assistente.js', './js/extrato.js', './js/formularios.js', './js/dialogos.js', './js/formularios-tela.js', './js/comprovantes.js', './js/lixeira.js', './js/erros.js', './js/central.js', './js/novidades.js', './js/novidades-antigas.js', './js/guia.js', './js/temas-baixar.js', './js/mascote-padrao.js', './js/divertido.js', './js/config.js', './js/sincronizacao.js', './js/conta-compartilhada.js', './js/nuvem.js', './js/copias.js', './js/arquivo-antigo.js', './js/entrada.js', './js/arte.js', './js/atos.js', './js/cena.js', './js/planilha.js', './js/exporta.js', './js/idioma.js', './js/web.js', './js/inicio.js', './manifest.json', './icon.svg', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
// Rede primeiro (para pegar atualizações), cache como reserva offline. A volta do login (com # no endereço) vai à rede.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch:true})));
});