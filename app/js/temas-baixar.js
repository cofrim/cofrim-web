// Cofrim — Imagens dos temas especiais (personagem nos três humores, cenário e objeto). Carregado pelo index.html antes
// de arte.js e cena.js.
// - No APK (desde a 2.31) todas vêm dentro do app (assets/temas, copiadas pelo build.gradle): o tema usa direto
//   temas/<tema>-<parte>.webp, sem baixar nem esperar (temasNoApp).
// - Na web e nas telas novas (web.zip) num APK mais antigo, baixa só as do tema em uso de temas/ do cofrim-updater (o
//   Updater recusa web.zip acima de 8 MB). Cada uma só é usada depois de conferida com o SHA-256 de js/temas-img.js; a
//   que não bate é descartada. As conferidas ficam no IndexedDB (TEMAS_DB) e funcionam sem internet depois do primeiro
//   uso. Enquanto não chegam, o tema usa os desenhos de sempre (cena e mascote em SVG) e, quando ficam prontas, a tela
//   troca com um esmaecer curto (temaImgsChegaram).
const TEMAS_BASE = 'https://raw.githubusercontent.com/cofrim/cofrim-updater/main/temas/';
const TEMAS_DB = 'financas-temas'; // IndexedDB: {k:"<tema>-<parte>", b:Blob, h:sha256, u:hora do último uso}
const TEMAS_GUARDA = 6; // temas guardados no aparelho (os de uso mais recente); o resto é apagado
const temaImgUrls = {}; // "<tema>-<parte>" -> endereço blob: da imagem já conferida (só as do tema em uso)
const temaImgPedidos = {}; // tema -> promessa do carregamento em andamento
const temaHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const temasNoApp = () => nativo('temasNoApp') === true; // as imagens vêm dentro do APK (Ponte.temasNoApp)
// Endereço da imagem: a do APK ou a baixada e conferida ('' = ainda não está pronta: use o desenho de reserva).
const temaImg = (k, parte) => TEMAS_IMG[k] && temasNoApp() ? `temas/${k}-${parte}.webp` : temaImgUrls[k + '-' + parte] || '';
const temaImgsProntas = k => !!TEMAS_IMG[k] && (temasNoApp() || TEMA_PARTES.every(p => temaImgUrls[k + '-' + p]));
// Miniatura do personagem na lista de temas (Configurações › Temas especiais) de um tema cujas imagens não estão no
// aparelho (versão web e APK antigo): só para ver, direto de temas/ do cofrim-updater e só quando aparece na tela
// (loading="lazy"). Por baixo fica o desenho de sempre; quando a imagem chega, ela o cobre (classe foto, abaixo). Usar o
// tema continua passando pela conferência do SHA-256 (temaImgsCarregar).
const temaMiniatura = k => !TEMAS_IMG[k] || temaImg(k, 'ok') ? '' : `<img class="temaMini" loading="lazy" src="${TEMAS_BASE}${k}-ok.webp" alt="">`;
document.addEventListener('load', e => {
  if (e.target.classList && e.target.classList.contains('temaMini')) e.target.parentElement.classList.add('foto');
}, true);
// Banco das imagens. Se o IndexedDB não responder em 2 s (há navegadores que nunca respondem em algumas origens), segue
// sem guardar: as imagens são baixadas e usadas do mesmo jeito.
function temasBanco(){
  return new Promise((ok, erro) => {
    if (!window.indexedDB) return erro(new Error('sem IndexedDB'));
    let esgotou = false;
    const r = indexedDB.open(TEMAS_DB, 1), t = setTimeout(() => { esgotou = true; erro(new Error('IndexedDB não respondeu')); }, 2000);
    r.onupgradeneeded = () => r.result.createObjectStore('img', {keyPath:'k'});
    r.onsuccess = () => { clearTimeout(t); if (esgotou) r.result.close(); else ok(r.result); };
    r.onerror = () => { clearTimeout(t); erro(r.error); };
  });
}
const temasPasso = (db, modo, f) => new Promise((ok, erro) => {
  const t = db.transaction('img', modo), r = f(t.objectStore('img'));
  t.oncomplete = () => ok(r && r.result); t.onerror = () => erro(t.error); t.onabort = () => erro(t.error);
});
// Baixa uma imagem e só devolve se o SHA-256 bater com o anotado (senão, null: a imagem é descartada).
async function temaBaixar(k, parte, hash){
  const r = await fetch(TEMAS_BASE + k + '-' + parte + '.webp', {cache:'no-cache'});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  if (buf.byteLength > 2e6 || temaHex(await crypto.subtle.digest('SHA-256', buf)) !== hash) return null;
  return new Blob([buf], {type:'image/webp'});
}
// Traz as cinco imagens do tema (do aparelho ou da internet) e as deixa prontas para a tela. Uma vez por tema de cada vez.
function temaImgsCarregar(k){
  if (!TEMAS_IMG[k] || temaImgsProntas(k) || !(window.crypto && crypto.subtle)) return Promise.resolve(temaImgsProntas(k));
  return temaImgPedidos[k] || (temaImgPedidos[k] = temaImgsBuscar(k).finally(() => delete temaImgPedidos[k]));
}
async function temaImgsBuscar(k){
  const hashes = TEMAS_IMG[k][1];
  let banco = null;
  try { banco = await temasBanco(); } catch(e){ /* sem IndexedDB: baixa e usa, sem guardar */ }
  const blobs = {};
  try {
    for (const [i, p] of TEMA_PARTES.entries()){
      const g = banco && await temasPasso(banco, 'readonly', s => s.get(k + '-' + p));
      if (g && g.h === hashes[i] && g.b) { blobs[p] = g.b; continue; }
      const b = await temaBaixar(k, p, hashes[i]);
      if (!b) { logErr('imagem do tema', `${k}-${p}: SHA-256 não confere, imagem descartada`); return false; }
      blobs[p] = b;
    }
    if (banco) await temasGuardar(banco, k, blobs);
  } catch(e){ return false; } // sem internet: fica a reserva em SVG e tenta de novo na próxima vez
  finally { if (banco) banco.close(); }
  if (db.prefs.skin !== k) return false; // trocou de tema no meio do caminho
  for (const u of Object.keys(temaImgUrls)) { URL.revokeObjectURL(temaImgUrls[u]); delete temaImgUrls[u]; } // só as do tema em uso
  const urls = Object.fromEntries(TEMA_PARTES.map(p => [p, URL.createObjectURL(blobs[p])]));
  // Decodifica antes de mostrar (sem piscar nem travar a troca); a que não abrir deixa o tema na reserva.
  try { await Promise.all(Object.values(urls).map(u => { const i = new Image(); i.src = u; return i.decode(); })); }
  catch(e){ Object.values(urls).forEach(u => URL.revokeObjectURL(u)); return false; }
  for (const p of TEMA_PARTES) temaImgUrls[k + '-' + p] = urls[p];
  temaImgsChegaram(k);
  return true;
}
// Grava as imagens do tema com a hora de uso e apaga as dos temas que não são usados há mais tempo.
async function temasGuardar(banco, k, blobs){
  const agora = Date.now(), hashes = TEMAS_IMG[k][1];
  await temasPasso(banco, 'readwrite', s => { TEMA_PARTES.forEach((p, i) => s.put({k:k + '-' + p, b:blobs[p], h:hashes[i], u:agora})); });
  const todos = await temasPasso(banco, 'readonly', s => s.getAll());
  const uso = {};
  for (const r of todos) { const t = r.k.split('-')[0]; uso[t] = Math.max(uso[t] || 0, r.u || 0); }
  const fora = Object.keys(uso).sort((a, b) => uso[b] - uso[a]).slice(TEMAS_GUARDA);
  if (fora.length) await temasPasso(banco, 'readwrite', s => { for (const r of todos) if (fora.includes(r.k.split('-')[0])) s.delete(r.k); });
}
// As imagens do tema em uso ficaram prontas: a cena e o mascote trocam do desenho para a imagem, esmaecendo.
function temaImgsChegaram(k){
  if (db.prefs.skin !== k) return;
  cenaAplicar(); // a cena em imagem já entra esmaecendo (.cenaImg, no app.css)
  telaAtualizar();
  const p = document.querySelector('.pigBox');
  if (p) { p.classList.add('chegou'); setTimeout(() => p.classList.remove('chegou'), 320); }
}
