// Cofrim — Sincronização com a conta Google (só no APK): enviar, baixar, juntar e os conflitos de edição.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md).
// ---------- Sincronização com a conta Google (só no APK) ----------
// Os dados vão para o arquivo financas.json na pasta oculta do app no Google Drive do usuário.
// O login e as chamadas de rede são feitos pelo lado nativo (Android.drive); aqui fica a lógica.
// A cada sincronização o app baixa o arquivo, junta com os dados locais registro por registro (mergeDb)
// e envia o resultado. Uma cópia por dia fica guardada por 30 dias (backup-AAAA-MM-DD.json).
const SYNC_KEY = 'financas-sync', DRIVE = 'https://www.googleapis.com';
const canSync = () => !!(temNativo('drive'));
let sync = {on:false, linked:false, at:0, err:'', bk:'', demo:false, lockAsked:false, up:[], del:[]}; // estado só deste aparelho, não vai para a conta
try { Object.assign(sync, JSON.parse(localStorage.getItem(SYNC_KEY))); } catch(e){}
const saveSync = () => { if (demoOn) return; try { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); } catch(e){} };
let syncing = false, syncAgain = false, syncTimer = 0, driveSeq = 0;
const drivePending = {};

function drive(method, url, body, ctype, interactive){
  if (demoOn) return Promise.resolve({status:-6, text:'demonstração'}); // nada vai para a conta Google
  return espera(new Promise(res => { const id = ++driveSeq; drivePending[id] = res; nativo('drive', id, method, url, body || '', ctype || '', !!interactive); }));
}
// Chamado pelo lado nativo. status: código HTTP; 0 = sem conexão; -1 = precisa entrar na conta; -2 = outro erro;
// -5 = a pessoa não deu ao app uma permissão pedida (desmarcou a caixa na tela do Google).
function onDrive(id, status, text){ const res = drivePending[id]; delete drivePending[id]; if (res) res({status, text}); }
// Erro do Google em palavras para quem usa o app. A resposta do Google (JSON) nunca vai para a tela: fica só no
// registro de erros do Diagnóstico (logErr).
const MSG_ESCOPO = 'Para guardar seus dados, o app precisa da permissão do Google Drive. Toque em "Entrar com Google" e deixe todas as caixas marcadas.';
const MSG_ESCOPO_CONTA = 'Para guardar seus dados, o app precisa da permissão do Google Drive. Toque em "Sincronizar agora" (Configurações › Conta e sincronização) e deixe todas as caixas marcadas.';
const semPermissao = e => e.status === -5 || (e.status === 403 && !/rate ?limit|quota/i.test(String(e.text)));
const erroAmigavel = e => semPermissao(e) ? 'O Google não deu ao app todas as permissões. Entre de novo com sua conta Google e deixe todas as caixas marcadas.'
  : e.status === 401 ? 'Sua sessão do Google expirou. Entre de novo com sua conta Google.'
  : e.status === 0 ? 'Sem conexão com a internet.'
  : e.status === -9 ? e.text
  : 'Não foi possível sincronizar. Tente de novo.';
const ok = r => { if (r.status !== 200 && r.status !== 204) throw r; return r; };
const driveList = async (q, interactive, campos = '') => JSON.parse(ok(await drive('GET',
  `${DRIVE}/drive/v3/files?spaces=appDataFolder&pageSize=100&orderBy=name%20desc&q=${encodeURIComponent(q)}&fields=files(id,name${campos})`, '', '',
  interactive)).text).files;
const driveGet = async id => abreGz(JSON.parse(ok(await drive('GET', `${DRIVE}/drive/v3/files/${id}?alt=media`)).text));
// ---------- Dados comprimidos na conta ----------
// O financas.json pode ir comprimido (gzip) em base64 dentro de um JSON: {"ver":3,"gz":"..."}. A ponte do Android leva
// texto, por isso o base64. O "ver":3 faz as versões antigas do app (desde a 1.38, pelo newerDb) pedirem para atualizar
// em vez de lerem um arquivo vazio e gravarem por cima. A leitura aceita os dois formatos em qualquer arquivo; só o
// financas.json é gravado comprimido (as cópias diárias e a planilha da conta compartilhada continuam em JSON).
// Ganho medido com dados de teste: 1.240 lançamentos, de 198 KB para 35 KB.
const GZ_GRAVAR = true;
const gzTem = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
async function gzPassa(dados, stream){ return new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(stream)).arrayBuffer()); }
async function fechaGz(json){
  if (!GZ_GRAVAR || !gzTem()) return json;
  const b = await gzPassa(new TextEncoder().encode(json), new CompressionStream('gzip'));
  let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return JSON.stringify({ver:3, gz:btoa(bin)});
}
async function abreGz(d){
  if (!d || typeof d.gz !== 'string') return d;
  if (!gzTem()) throw new Error('este navegador não abre dados comprimidos');
  const bin = atob(d.gz), b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(await gzPassa(b, new DecompressionStream('gzip'))));
}
// props: etiquetas guardadas junto do arquivo no Drive (appProperties), só na criação; as cópias levam a quantidade de
// lançamentos (n), para a tela "Versões salvas" mostrar sem baixar cada uma.
async function driveWrite(id, name, json, props){
  if (id) return ok(await drive('PATCH', `${DRIVE}/upload/drive/v3/files/${id}?uploadType=media&fields=id,version`, json, 'application/json'));
  const b = 'financas-boundary';
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name, parents:['appDataFolder'], ...(props ? {appProperties:props} : {})})}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`;
  return ok(await drive('POST', `${DRIVE}/upload/drive/v3/files?uploadType=multipart&fields=id,version`, body, 'multipart/related; boundary=' + b));
}

// ---------- Trocar entre a conta pessoal e a compartilhada ----------
// Quem está numa conta compartilhada continua tendo os dados pessoais guardados na própria conta Google. trocarConta()
// alterna o que este aparelho mostra: envia o que falta da conta atual, baixa os dados da outra e marca sync.pessoal.
// Enquanto troca (trocando), nenhuma sincronização roda: senão os dados de uma conta poderiam ser gravados na outra.
let trocando = false;
// Faixa no topo de todas as telas (só para quem tem conta compartilhada): diz qual conta está em uso; tocar troca.
const contaPill = () => !sync.shared ? '' : `<div class="contaPill ${sync.pessoal ? 'pes' : 'comp'}" data-onclick="trocarConta()">${I(sync.pessoal ? 'user' : 'people', 14)}Você está na <b>conta ${sync.pessoal ? 'pessoal' : 'compartilhada'}</b><span>Trocar</span></div>`;
// Botão do Resumo: as duas contas lado a lado, com a atual marcada.
const trocaContaHtml = () => !sync.shared ? '' : `<div class="trocaConta">${[[true, 'user', 'Pessoal'], [false, 'people', 'Compartilhada']].map(([p, ic, t]) =>
  `<button class="${!!sync.pessoal === p ? 'on' : ''}" data-onclick="${!!sync.pessoal === p ? '' : 'trocarConta()'}">${I(ic, 16)}${t}</button>`).join('')}</div>`;
let trocaOcupada = false; // toque duplo não troca duas vezes
async function trocarConta(semPerguntar){
  if (demoBloqueia()) return;
  if (!sync.shared || !canSync() || trocaOcupada) return;
  trocaOcupada = true;
  try { await trocarContaJa(semPerguntar); } finally { trocaOcupada = false; }
}
async function trocarContaJa(semPerguntar){
  const paraPessoal = !sync.pessoal, destino = paraPessoal ? 'pessoal' : 'compartilhada';
  if (!semPerguntar && !await ask(paraPessoal ? 'Trocar para a sua conta pessoal?\n\nVocê passa a ver e lançar só nos seus dados. A conta compartilhada continua ligada e dá para voltar quando quiser.'
    : 'Trocar para a conta compartilhada?\n\nVocê volta a ver e lançar nos dados que divide com as outras pessoas.', 'Trocar')) return;
  await comCarga(`Abrindo a conta ${destino}…`, async () => {
    clearTimeout(syncTimer);
    while (syncing) await new Promise(r => setTimeout(r, 100));
    await syncNow(); // o que foi lançado na conta atual precisa estar guardado antes de sair dela
    if (!sync.shared) return; // a conta compartilhada foi encerrada enquanto isso (shareEnded já avisou)
    if (sync.err) return avisoErro('internet', 'Não consegui guardar os dados da conta atual, então não dá para trocar de conta agora.');
    trocando = true;
    const antes = canonS(db);
    try {
      let novo;
      if (paraPessoal){ const file = (await driveList("name='financas.json'", true))[0]; novo = file ? fixDb(await driveGet(file.id)) : fixDb({}); }
      else novo = await sharedReadDireto(sync.shared.id);
      if (!novo) throw {status:404, text:'vazia'};
      if (demoOn) return; // a demonstração foi ligada no meio
      if (newerDb(novo)) return tell('Os dados dessa conta foram gravados por uma versão mais nova do app. Atualize o app neste aparelho.');
      if (canonS(db) !== antes) return tell('Você lançou ou alterou algo enquanto a troca acontecia. Para não perder nada, a troca foi cancelada: tente de novo.');
      loadDb({...novo, prefs:db.prefs}); // nome e aparência continuam os deste aparelho
      sync.pessoal = paraPessoal; saveSync();
      rollover(); save(false); state.dia = 0;
    } catch(e){
      if (e.status === undefined) throw e;
      logErr('trocar conta', e.status + ' ' + String(e.text).slice(0, 200));
      if (!paraPessoal && (e.status === -4 || e.status === 404)){ trocando = false; sync.pessoal = false; return shareEnded(e.por || ''); }
      return tell(e.status === 0 ? 'Sem conexão com a internet: não deu para abrir a outra conta.' : semPermissao(e) || e.status === 401 ? erroAmigavel(e) : `Não foi possível abrir a conta ${destino} agora (${e.status}).`);
    } finally { trocando = false; }
    closeForm(); render(); scrollTo(0, 0);
    toast(`Agora você está na conta ${destino}.`, {dest:{k:'cfg', s:'compart'}});
    syncNow();
  });
}
// Lê a planilha compartilhada mesmo com sync.pessoal ligado (shared() devolve vazio nesse modo).
const sharedReadDireto = async id => { const d = await sharedRead(id, true); return d && fixDb(d); };
// Tudo numa tela só: sem conta, as três formas de começar (cada uma com uma linha explicando); com conta, o estado,
// o código do convite à vista e as ações.
// sync.limpaProx = a conta que está sendo criada é "do zero" (fica em sync para sobreviver à ida ao Google na versão web).
function shareHtml(){
  const s = sync.shared;
  if (s && sync.pessoal) return `<div class="semTopo hint">${I('user', 14)} Você está vendo a sua <b>conta pessoal</b>. A conta compartilhada continua ligada: troque para ela para ver as pessoas, os avisos e as outras opções.</div>
    <div class="btns"><button class="btn primary" data-onclick="trocarConta()">${I('people')}Trocar para a conta compartilhada</button></div>`;
  const opcao = (ic, t, d, acao) => `<button class="setTile" style="width:100%;text-align:left;margin-bottom:8px" data-onclick="${acao}"><span>${I(ic, 22)}</span><b>${t}</b><small>${d}</small></button>`;
  if (!s) return `<div class="semTopo hint">Duas contas Google vendo e lançando nos mesmos dados, cada pessoa no próprio celular. Cada lançamento mostra quem fez; nome e aparência continuam de cada um.</div>
    ${!canSync() ? '<div class="hint warn">Prévia no PC: a conta compartilhada só funciona no app instalado no celular.</div>' : `
    <label>Como você quer começar?</label>
    ${opcao('people', 'Compartilhar os meus lançamentos', 'A outra pessoa passa a ver e lançar nos dados que você já tem.', "openShare('convidar')")}
    ${opcao('sparkle', 'Criar uma conta compartilhada do zero', 'Começa vazia, sem os lançamentos de ninguém. Os seus ficam guardados na sua conta.',
      "openShare('zero')")}
    ${opcao('download', 'Tenho um código de convite', 'Entre na conta que outra pessoa criou.', "openShare('entrar')")}`}`;
  return `<div class="semTopo hint in">${I('people', 14)} Conta compartilhada ligada${s.limpa ? ' (criada do zero)' : ''}. ${s.owner ? (s.with && s.with.length ? 'Você criou e convidou ' + s.with.map(esc).join(', ') + '.' : 'Você criou; falta convidar alguém.') : 'Você entrou por convite.'}</div>
    ${membrosHtml(s)}
    <label>Avisos</label>
    <div class="semTopo btns">${[[true, 'Avisar'], [false, 'Não avisar']].map(([v, t]) => `<button class="btn ${(db.prefs.avisoComp !== false) === v ? 'primary' : ''}" data-onclick="setAvisoComp(${v})">${t}</button>`).join('')}</div>
    <div class="hint">Avisa quando outra pessoa entra na conta ou adiciona/edita um gasto, ganho ou investimento: na tela do app e, com ele fechado, por notificação do celular. O celular confere a cada 15 minutos, mais ou menos (o app não tem servidor para avisar na hora).</div>
    ${avisoNativoHtml()}
    <div class="btns"><button class="btn" data-onclick="openAtividade()">${I('bell')}Atividade recente${ativNovas() ? ` (${ativNovas()})` : ''}</button></div>
    <label>Código do convite</label>
    <div class="semTopo btns"><input readonly value="${esc(s.id)}" style="flex:3;min-width:0;font-size:12px" data-onclick="this.select()"><button class="cresce btn" data-onclick="shareCopy()">Copiar</button></div>
    ${s.owner ? `<div class="btns"><button class="btn" data-onclick="openShare('convidar')">${I('people')}Convidar mais alguém</button></div>` : ''}
    <div class="hint">Os lançamentos ficam numa planilha do Google compartilhada entre vocês (não edite a planilha à mão). Cópias diárias e comprovantes continuam de cada um.</div>
    <div class="btns"><button class="cresce btn danger" data-onclick="shareLeave()">Sair e encerrar a conta compartilhada</button></div>
    <div class="hint">Sair encerra a conta para todos: a outra pessoa também volta para a conta individual e a planilha é apagada. Cada um pode ficar com uma cópia dos lançamentos.</div>`;
}
function openShare(modo){
  settingsOpen = false; F = null;
  if (modo === 'zero' || modo === 'convidar'){ sync.limpaProx = modo === 'zero'; saveSync(); }
  const shareLimpa = !!sync.limpaProx;
  showSheet(modo !== 'entrar' ? `<h3>${sync.shared ? 'Convidar para a conta compartilhada' : shareLimpa ? 'Conta compartilhada do zero' : 'Compartilhar os meus lançamentos'}</h3>
    <div class="semTopo hint">${sync.shared ? 'A pessoa recebe um e-mail do Google com o convite.' : shareLimpa ? 'O app cria uma planilha vazia na sua conta Google e a compartilha com a outra pessoa. Os seus lançamentos de hoje não entram: continuam guardados na sua conta. Depois, ela abre o app e cola o código do convite.' : 'O app cria uma planilha na sua conta Google com os seus lançamentos e a compartilha com a outra pessoa, que recebe um e-mail do Google. Depois, ela abre o app, entra com a conta convidada e cola o código do convite.'}</div>
    <label for="shEmail">E-mail da conta Google da outra pessoa</label>
    <input id="shEmail" type="email" autocomplete="off" placeholder="nome@gmail.com">
    <div class="hint">O Google vai pedir sua autorização para o app criar e compartilhar a planilha.</div>
    <div class="err" id="shErr"></div>
    <div class="btns foot"><button class="btn" data-onclick="shareBack()">Cancelar</button><button class="btn primary" data-onclick="${sync.shared ? 'shareInvite' : 'shareStart'}(document.getElementById('shEmail').value)">Convidar</button></div>`
  : `<h3>Entrar numa conta compartilhada</h3>
    <div class="semTopo hint">Cole o código (ou o link da planilha) que a outra pessoa te mandou. Você precisa estar com a conta Google que foi convidada${temNativo('conta') && nativo('conta') ? ` (agora: <b>${esc(nativo('conta'))}</b>)` : ''}.</div>
    <label for="shCode">Código do convite</label>
    <input id="shCode" type="text" autocomplete="off">
    <div class="err" id="shErr"></div>
    <div class="btns foot"><button class="btn" data-onclick="shareBack()">Cancelar</button><button class="btn primary" data-onclick="shareJoin(document.getElementById('shCode').value)">Entrar</button></div>`);
}
const shErr = m => { const e = document.getElementById('shErr'); if (e) e.textContent = m; else tell(m); };
// Aberta pela pergunta do primeiro acesso (askShare): ao terminar ou cancelar, segue para as próximas telas de início.
let shareFromStart = false;
function shareBack(){ if (shareFromStart){ shareFromStart = false; closeForm(); startSheets(); } else openSettings('compart'); }
// Tela de permissão do Google: o app abre sozinho, mas o aviso de "app não verificado" e o "Permitir" são da pessoa.
// Antes da primeira vez, explica o que tocar; se a autorização não for concluída, mostra como fazer.
const PASSOS_GOOGLE = '1. Se aparecer "O Google não verificou este app", toque em "Avançado" e depois em "Acessar Cofrim (não seguro)". O aviso aparece porque o app ainda não passou pela verificação do Google; os dados ficam só na sua conta.\n2. Marque as caixas de permissão (Planilhas e arquivos do Drive criados pelo app).\n3. Toque em "Continuar".';
async function famPrepare(){
  if (sync.famOk) return true;
  return ask(`Agora o Google vai pedir sua permissão para o app criar e ler a planilha da conta compartilhada.\n\n${PASSOS_GOOGLE}`, 'Abrir a tela do Google');
}
function famNegado(){ tell(`A permissão do Google não foi concluída, então a conta compartilhada não foi ligada.\n\nPara tentar de novo, toque outra vez no botão e, na tela do Google:\n${PASSOS_GOOGLE}`); }
// Toque duplo num botão que fala com o Google (criar, convidar, entrar, sair) não roda a ação duas vezes.
const umaVez = fn => { let ocupado = false;
  return async (...a) => { if (ocupado) return; ocupado = true; try { return await fn(...a); } finally { ocupado = false; } }; };
const shareInvite = umaVez(async function(email, quieto){
  if (demoBloqueia()) return;
  email = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return shErr('Digite um e-mail válido.');
  const r = await fam('POST',
    `${DRIVE}/drive/v3/files/${shared()}/permissions?sendNotificationEmail=true&emailMessage=${encodeURIComponent(inviteText(shared()))}`,
    JSON.stringify({role:'writer', type:'user', emailAddress:email}), 'application/json', true);
  if (r.status !== 200){
    logErr('convidar', r.status + ' ' + String(r.text).slice(0, 300));
    if (!quieto){ if (r.status === -5 || r.status === -1) famNegado(); else shErr('Não consegui enviar o convite pelo Google (' + r.status + '). Copie o convite e compartilhe a planilha com essa pessoa pelo app do Google Planilhas.'); }
    return false;
  }
  sync.shared.with = [...new Set([...(sync.shared.with || []), email])]; saveSync();
  if (!quieto){ toast('Convite enviado para ' + email, {dest:{k:'cfg', s:'compart'}}); shareBack(); }
  return true;
});
// Cria a conta compartilhada com os dados deste aparelho e convida a outra pessoa.
// limpa = conta criada do zero: começa vazia, sem os lançamentos de ninguém (os pessoais continuam guardados na conta
// de cada um e voltam ao sair).
const shareStart = umaVez(async function(email, semPerguntar, limpa = !!sync.limpaProx){
  if (demoBloqueia()) return;
  email = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return shErr('Digite um e-mail válido.');
  if (!limpa && db.archUntil) return shErr('Antes de compartilhar, traga de volta os anos arquivados (Configurações › Dados e ajustes › Anos antigos).');
  if (!semPerguntar && !await ask(limpa ? `Criar uma conta compartilhada do zero com ${email}?\n\nEla começa vazia, numa planilha na sua conta Google que ${email} poderá ver e editar pelo app. Os seus lançamentos de hoje continuam guardados na sua conta e voltam se a conta compartilhada for encerrada.`
    : `Criar a conta compartilhada com ${email}?\n\nOs seus lançamentos vão para uma planilha na sua conta Google, que ${email} poderá ver e editar pelo app.`,
    'Criar e convidar')) return;
  if (!semPerguntar && !await famPrepare()) return;
  const fimCarga = cargaOn('Criando a conta compartilhada…');
  try {
    await syncNow(); // os dados pessoais ficam em dia na sua conta antes de passar a usar a planilha
    if (limpa && sync.err) return shErr('Não consegui guardar os seus dados pessoais na sua conta antes de criar a conta do zero. Confira a internet e tente de novo.');
    const corpo = {properties:{title:'Cofrim (conta compartilhada)'}, sheets:[{properties:{title:'leia-me'}}, {properties:{title:'dados'}}]};
    const id = JSON.parse(ok(await fam('POST', SHEETS, JSON.stringify(corpo), 'application/json', true)).text).spreadsheetId;
    sync.famOk = true;
    await fam('PUT', `${SHEETS}/${id}/values/${rng('leia-me!A1:A3')}?valueInputOption=RAW`,
      JSON.stringify({values:[['Esta planilha guarda os dados do app Cofrim compartilhados entre contas Google.'],
      ['Não edite nem apague: o app lê e grava a aba "dados".'], ['Para parar de compartilhar, use "Sair da conta compartilhada" no app.']]}),
      'application/json');
    const vazio = limpa ? {...fixDb({}), prefs:db.prefs} : null;
    if (limpa) ok(await fam('PUT', `${SHEETS}/${id}/values/${rng('leia-me!A4')}?valueInputOption=RAW`, JSON.stringify({values:[['LIMPA']]}),
      'application/json'));
    else { claimMine(); save(false); }
    await sharedWrite(id, paraPlanilha(vazio || db));
    sync.shared = {id, owner:true, with:[], limpa:!!limpa}; saveSync();
    // Só depois de a planilha estar gravada o aparelho passa a mostrar a conta vazia (os dados pessoais já estão na conta).
    if (vazio){ loadDb(vazio); rollover(); save(false); render(); }
    const convidou = await shareInvite(email, true);
    await syncNow();
    showSheet(`<h3>Conta compartilhada criada</h3>
      <div class="semTopo hint">${convidou ? `${esc(email)} vai receber um e-mail do Google.` : `Não consegui enviar o convite pelo Google. Abra a planilha "Cofrim (conta compartilhada)" no Google Planilhas e compartilhe com ${esc(email)} como editor.`} Mande também o código abaixo: no app, a pessoa abre Configurações › Conta compartilhada › Tenho um convite.</div>
      <textarea readonly style="min-height:70px">${esc(id)}</textarea>
      <div class="btns foot"><button class="btn" data-onclick="shareCopy()">Copiar convite</button><button class="btn primary" data-onclick="shareBack()">Pronto</button></div>`);
  } catch(e){
    logErr('compartilhar', e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e);
    sync.shared = null; saveSync();
    if (e.status === -1 || e.status === -5) return famNegado();
    shErr(sharedMsg(e) || (e.status === 0 ? 'Sem conexão com a internet.' : e.status === -1 ? 'É preciso autorizar o acesso na conta Google.' : 'Não foi possível criar a conta compartilhada agora.'));
  } finally { fimCarga(); }
});
function shareCopy(){
  const t = inviteText(shared());
  if (temNativo('copiar')) nativo('copiar', t); else navigator.clipboard && navigator.clipboard.writeText(t);
  toast('Convite copiado. Mande para a outra pessoa.');
}
// Entra na conta compartilhada de outra pessoa. escolha: 'juntar' (leva os seus lançamentos junto) ou 'so' (usa só os de lá).
const shareJoin = umaVez(async function(code, escolha){
  if (demoBloqueia()) return;
  const id = codeOf(code);
  if (!id) return shErr('Código inválido. Cole o código inteiro que a outra pessoa mandou.');
  let remote;
  if (!escolha && !await famPrepare()) return;
  const fimCarga = cargaOn('Abrindo a conta compartilhada…');
  try {
    await syncNow();
    remote = await sharedRead(id, true);
    sync.famOk = true;
    if (!remote) throw {status:404, text:'vazia'};
    remote = fixDb(remote);
    if (newerDb(remote)) return shErr('Os dados compartilhados foram gravados por uma versão mais nova do app. Atualize o app neste aparelho.');
  } catch(e){
    if (e.status === undefined) throw e;
    logErr('entrar compartilhada', e.status + ' ' + String(e.text).slice(0, 300));
    if (e.status === -1 || e.status === -5) return famNegado();
    if (e.status === -4) return shErr('Esta conta compartilhada já foi encerrada. Peça para a outra pessoa criar uma nova e mandar o novo código.');
    return shErr(sharedMsg(e) || (e.status === 0 ? 'Sem conexão com a internet.' : 'Não foi possível abrir a conta compartilhada (' + e.status + ').'));
  } finally { fimCarga(); }
  if (!escolha){
    const temMeus = COLS.some(c => db[c].length);
    if (!temMeus || sharedInfo.limpa) escolha = 'so'; // conta criada do zero: ninguém leva os próprios lançamentos
    else return pickList('E os lançamentos que já estão neste app?',
      [['juntar', 'Juntar aos da conta compartilhada'], ['so', 'Usar só os da conta compartilhada (os meus continuam guardados na minha conta)']], '',
      v => shareJoin(id, v));
  }
  const prefs = db.prefs;
  if (escolha === 'juntar'){ claimMine(); loadDb({...mergeDb(db, remote), prefs}); }
  else loadDb({...remote, prefs});
  rollover(); save(false);
  sync.shared = {id, owner:false, limpa:sharedInfo.limpa}; saveSync();
  await syncNow();
  closeForm(); render();
  toast(comNome('Pronto, {nome}! Agora vocês veem os mesmos lançamentos.'), {dest:{k:'cfg', s:'compart'}});
  if (shareFromStart){ shareFromStart = false; startSheets(); }
});

// Logo depois do login (antes do nome e do tutorial): pergunta se a pessoa vai usar uma conta compartilhada.
function askShare(){
  settingsOpen = false; F = null;
  showSheet(`<div class="tour"><span class="tourIco">${I('people', 40)}</span>
    <h3>Você vai usar uma conta compartilhada?</h3>
    <p>Casal ou família: duas contas Google vendo e lançando nos mesmos ganhos, gastos e investimentos, cada pessoa no próprio celular. Dá para ligar depois em Configurações › Conta compartilhada.</p></div>
    <div class="btns" style="flex-direction:column">
      <button class="btn primary" data-onclick="askShareAns('entrar')">${I('people')}Sim, recebi um código de convite</button>
      <button class="btn" data-onclick="askShareAns('convidar')">Sim, quero convidar alguém</button>
      <button class="btn" data-onclick="askShareAns('')">Não, vou usar só eu</button></div>`);
}
function askShareAns(modo){
  sync.askedShare = true; saveSync();
  if (!modo){ closeForm(); return startSheets(); }
  shareFromStart = true; openShare(modo);
}
// Sair encerra a conta compartilhada para todos: a planilha recebe o aviso "ENCERRADA", a outra pessoa é desligada na
// próxima sincronização dela (shareEnded) e a planilha é apagada (por quem a criou: só o dono consegue apagar o arquivo).
// escolha: 'copia' = este aparelho fica com uma cópia dos lançamentos compartilhados, juntada aos dados pessoais;
// 'so' = volta só aos dados pessoais, como estavam antes de compartilhar.
const apagarPlanilha = id => fam('DELETE', `${DRIVE}/drive/v3/files/${id}`).catch(() => ({status:0}));
const shareLeave = umaVez(async function(escolha){
  if (demoBloqueia()) return;
  if (!escolha){
    if (!await ask('Sair e ENCERRAR a conta compartilhada?\n\nIsto vale para todos: a outra pessoa também é desligada e volta para a conta individual dela, e a planilha compartilhada é apagada. Não dá para desfazer.\n\nNinguém perde os lançamentos: cada pessoa pode ficar com uma cópia na própria conta.', 'Encerrar para todos', true)) return;
    return pickList('O que fazer com os lançamentos compartilhados neste aparelho?',
      [['copia', 'Ficar com uma cópia, junto com os meus dados'], ['so', 'Não ficar: voltar só aos meus dados de antes']], '', v => shareLeave(v));
  }
  return comCarga('Encerrando a conta compartilhada…', async () => {
  const id = shared(), dono = sync.shared.owner;
  await syncNow(); // as últimas alterações deste aparelho vão para a planilha antes do aviso
  let pessoal = null;
  try {
    // 'so': primeiro baixa os dados pessoais; sem eles (sem internet), não sai: senão os compartilhados iriam para a conta pessoal.
    if (escolha === 'so'){ const file = (await driveList("name='financas.json'", true))[0]; pessoal = file ? fixDb(await driveGet(file.id)) : fixDb({}); }
    ok(await fam('PUT', `${SHEETS}/${id}/values/${rng('leia-me!A5')}?valueInputOption=RAW`,
      JSON.stringify({values:[[`ENCERRADA|${myName() || (temNativo('conta') && nativo('conta')) || ''}|${Date.now()}`]]}), 'application/json', true));
  } catch(e){
    // A planilha já não existe ou já foi encerrada: segue saindo. Outro erro (sem internet): não sai, para a outra pessoa não ficar numa conta que só
    // um lado abandonou.
    if (e.status !== 404 && e.status !== -4){ logErr('sair compartilhada', e.status ? e.status + ' ' + String(e.text).slice(0, 200) : e);
      return avisoErro('internet', 'Não consegui encerrar a conta compartilhada agora.'); }
  }
  if (dono) await apagarPlanilha(id);
  sync.shared = null; saveSync(); compFim();
  if (pessoal){ loadDb({...pessoal, prefs:db.prefs}); rollover(); save(false); }
  await syncNow();
  closeForm(); render();
  tell(`Conta compartilhada encerrada. ${escolha === 'so' ? 'Este aparelho voltou aos seus dados pessoais.' : 'Você ficou com uma cópia dos lançamentos na sua conta.'}\n\nA outra pessoa será desligada assim que o app dela sincronizar.`);
  });
});
// A conta compartilhada foi encerrada por outra pessoa (ou a planilha sumiu): este aparelho volta à conta individual,
// guardando os lançamentos compartilhados como uma cópia junto aos dados pessoais. Quem criou a planilha a apaga.
async function shareEnded(por){
  const s = sync.shared; if (!s) return;
  sync.shared = null; sync.err = ''; saveSync(); compFim(); save(false);
  if (s.owner) await apagarPlanilha(s.id);
  if (!sheetOpen()) render(); else if (settingsShown()) openSettings();
  tell(`A conta compartilhada foi encerrada${por ? ' por ' + por : ''}.\n\nVocê voltou para a sua conta individual e ficou com uma cópia dos lançamentos compartilhados.`);
  setTimeout(syncNow, 300); // junta a cópia com os dados pessoais da sua conta
}

// Junta os dados deste aparelho (a) com os da conta (b):
// - lançamentos: um a um pelo id, valendo a versão alterada por último (u); excluídos (tomb) não voltam;
// - configurações (tema, abas, orçamentos, fechamento do cartão): vale o lado que mexeu nelas por último (cfgMod);
// - históricos mensais: soma dos dois lados, preferindo o deste aparelho.
function mergeDb(a, b){
  // As datas de alteração vêm de cada aparelho (e da planilha, que qualquer pessoa da conta pode editar). Uma data no
  // futuro faria o registro vencer todas as edições seguintes: ficam limitadas a agora + 5 minutos (folga de relógio).
  const max = Date.now() + 5 * 60e3;
  for (const d of [a, b]){
    if (d.cfgMod > max) d.cfgMod = max;
    for (const c of COLS) for (const r of d[c] || []) if (r.u > max) r.u = max;
    for (const id in d.tomb || {}) if (d.tomb[id] > max) d.tomb[id] = max;
  }
  const tomb = {...b.tomb};
  for (const [id, t] of Object.entries(a.tomb || {})) tomb[id] = Math.max(t, tomb[id] || 0);
  for (const id in tomb) if (tomb[id] < Date.now() - 90*864e5) delete tomb[id]; // 90 dias bastam para todos os aparelhos saberem
  const out = {...b, ...a, tomb, mod:Math.max(a.mod || 0, b.mod || 0)};
  for (const c of COLS){
    const byId = new Map((b[c] || []).map(r => [r.id, r]));
    for (const r of a[c] || []){ const o = byId.get(r.id); if (!o || (r.u || 0) >= (o.u || 0)) byId.set(r.id, r); }
    out[c] = [...byId.values()].filter(r => !(tomb[r.id] >= (r.u || 0)));
  }
  // Empate sem nenhuma alteração deste lado (aparelho novo, com o Resumo enxuto de primeira abertura): valem as da conta.
  const cfg = (b.cfgMod || 0) > (a.cfgMod || 0) || (!a.cfgMod && a.prefs && a.prefs.resumoEnxuto && b.prefs && Array.isArray(b.prefs.resumo)) ? b : a;
  Object.assign(out, {prefs:cfg.prefs, budgets:cfg.budgets, cardClose:cfg.cardClose, cardDue:cfg.cardDue, cardAcc:cfg.cardAcc,
    cardLimit:cfg.cardLimit, archUntil:cfg.archUntil || '', cats:cfg.cats, cfgMod:cfg.cfgMod});
  // Categorias criadas no outro lado não somem só porque este mexeu numa configuração depois (o tema, por exemplo): as
  // próprias (fora as de fábrica) que só existem no lado perdedor entram também, menos as excluídas (tomb "cat:tipo:chave").
  const outro = cfg === a ? b : a;
  out.cats = {gasto:{...(cfg.cats || {}).gasto}, ganho:{...(cfg.cats || {}).ganho}};
  for (const t of ['gasto', 'ganho']) for (const [k, v] of Object.entries(((outro.cats || {})[t]) || {}))
    if (!out.cats[t][k] && !BASE_CATS[t][k] && !tomb['cat:' + t + ':' + k]) out.cats[t][k] = v;
  out.conq = {...b.conq}; // datas das conquistas: todas as dos dois lados, a mais antiga de cada nível
  for (const [k, t] of Object.entries(a.conq || {})) out.conq[k] = Math.min(t, out.conq[k] || t);
  // Importações de planilha: as dos dois lados; da mesma, a alterada por último (desfeita ou restaurada).
  const imps = new Map((b.imports || []).map(x => [x.id, x]));
  for (const x of a.imports || []) if (!imps.has(x.id) || (x.u || 0) >= (imps.get(x.id).u || 0)) imps.set(x.id, x);
  out.imports = [...imps.values()].sort((x, y) => x.at - y.at);
  out.membros = {...b.membros};
  for (const [k, m] of Object.entries(a.membros || {})) if (!out.membros[k] || (m.t || 0) >= (out.membros[k].t || 0)) out.membros[k] = m;
  // Última versão do app vista nesta conta (novidades depois de reinstalar): a mais nova dos dois lados.
  const vs = [a.verVista, b.verVista].filter(v => typeof v === 'string' && /^\d+\.\d+$/.test(v));
  if (vs.length) out.verVista = vs.reduce((x, y) => verNum(y) > verNum(x) ? y : x); else delete out.verVista;
  out.catMemo = {...b.catMemo, ...a.catMemo};
  out.yieldLog = {...b.yieldLog, ...a.yieldLog};
  out.netLog = {...b.netLog, ...a.netLog};
  out.sugs = sugsJuntar(a.sugs, b.sugs);
  return out;
}
// Texto para comparar dois estados sem depender da ordem das chaves.
// Aparelho que ficou mais de 90 dias sem sincronizar: as marcas de exclusão (tomb) dessa época já foram descartadas
// (mergeDb guarda 90 dias), então um lançamento que só existe aqui e não mudou desde a última sincronização foi excluído
// (ou arquivado) em outro aparelho: ele não volta. O que foi criado ou mudado aqui depois da última sincronização fica.
function semExcluidosVelhos(a, b, desde){
  if (!desde || desde > Date.now() - 90*864e5) return a;
  const out = {...a};
  for (const c of COLS){ const la = new Set(b[c].map(r => r.id)); out[c] = a[c].filter(r => la.has(r.id) || (r.u || 0) > desde); }
  return out;
}
const SYNCED = [...COLS, 'tomb', 'prefs', 'budgets', 'cardClose', 'cardDue', 'cardAcc', 'cardLimit', 'archUntil', 'cats', 'catMemo', 'yieldLog',
  'netLog', 'membros', 'sugs'];
const canon = d => JSON.stringify(SYNCED.map(k => d[k]),
  (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x],[y]) => x < y ? -1 : 1)) : v);

let retryTimer = 0;
const retryDelay = n => Math.min(30e3 * 2 ** (n - 1), 30 * 60e3);
// Quantas alterações a junção trouxe para este aparelho: registros novos, mais recentes ou excluídos em outro lugar.
function incoming(a, m){
  let n = 0;
  for (const c of COLS){
    const meus = new Map(a[c].map(r => [r.id, r.u || 0])), ids = new Set(m[c].map(r => r.id));
    for (const r of m[c]) if (!meus.has(r.id) || (r.u || 0) > meus.get(r.id)) n++;
    for (const r of a[c]) if (!ids.has(r.id)) n++;
  }
  return n;
}
const BEFORE_KEY = 'financas-antes';
// Na versão web (CIFRA_ATIVA), a cópia vai cifrada como o banco (só a hora e o motivo ficam à vista, para o botão).
function keepBefore(motivo){
  const o = {at:Date.now(), motivo:motivo || ''}, txt = JSON.stringify(db);
  const guarda = d => { try { localStorage.setItem(BEFORE_KEY, JSON.stringify({...o, db:d})); } catch(e){} };
  if (CIFRA_ATIVA) gravarCifrado(txt, guarda); else guarda(txt);
}
function beforeInfo(){ try { return JSON.parse(localStorage.getItem(BEFORE_KEY)); } catch(e){ return null; } }
async function restoreBefore(){
  if (demoBloqueia()) return;
  const o = beforeInfo();
  if (!o) return;
  const quando = new Date(o.at).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'});
  if (!await ask(o.motivo === 'importar' ? `Voltar este aparelho ao estado de ${quando}, antes da importação do arquivo?\nO que veio do arquivo será desfeito em todos os aparelhos.`
    : `Voltar este aparelho ao estado de ${quando}, antes da última junção com a conta?\nO que veio de outros aparelhos nessa junção será desfeito em todos eles.`, 'Voltar', true)) return;
  applySnapshot(fixDb(JSON.parse(ehCifrado(o.db) ? await decifrarTexto(o.db) : o.db)));
  try { localStorage.removeItem(BEFORE_KEY); } catch(e){}
  syncNow();
}
const beforeHtml = () => { const o = beforeInfo(); return o ? `<div class="btns"><button class="btn" data-onclick="restoreBefore()">${I('history')}${o.motivo === 'importar' ? 'Desfazer a importação' : 'Desfazer a última junção'} (${new Date(o.at).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})})</button></div>` : ''; };
// Troca os dados pelos de uma cópia, de modo que a troca valha em todos os aparelhos: tudo o que veio da cópia fica
// como "alterado agora", e o que existe hoje mas não existia nela é marcado como excluído.
function applySnapshot(snap){
  const t = Date.now(), ids = new Set();
  for (const c of COLS) for (const r of snap[c]){ r.u = t; ids.add(r.id); }
  snap.tomb = {};
  for (const c of COLS) for (const r of db[c]) if (!ids.has(r.id)) snap.tomb[r.id] = t;
  snap.cfgMod = t;
  loadDb(snap); rollover(); save(); closeForm(); render();
}
// ---------- Mesmo lançamento editado em dois aparelhos ----------
// A junção fica com a edição mais recente. Quando os dois lados mudaram o registro depois da última sincronização deste
// aparelho (desde) e a versão descartada tem descrição, valor, data ou categoria diferentes, ela é guardada aqui (só
// neste aparelho, até 20) para a pessoa ver as duas e, se quiser, trocar pela outra.
const CONFLITO_KEY = 'financas-conflitos',
CONFLITO_CAMPOS = [['desc', 'Descrição'], ['name', 'Nome'], ['value', 'Valor'], ['total', 'Valor total'], ['start', 'Mês'], ['day', 'Dia'],
  ['due', 'Vencimento'], ['date', 'Data'], ['cat', 'Categoria']];
function conflitos(a, b, desde){
  const out = [];
  if (!desde) return out; // primeira sincronização deste aparelho: não há o que comparar
  for (const c of COLS){
    const meus = new Map(a[c].map(r => [r.id, r]));
    for (const rb of b[c]){
      const ra = meus.get(rb.id);
      if (!ra || (ra.u || 0) <= desde || (rb.u || 0) <= desde || ra.u === rb.u) continue;
      if (!CONFLITO_CAMPOS.some(([k]) => String(ra[k] ?? '') !== String(rb[k] ?? ''))) continue;
      if ((b.tomb || {})[rb.id] >= rb.u || (a.tomb || {})[ra.id] >= ra.u) continue;
      out.push({col:c, id:rb.id, t:Date.now(), outra:JSON.parse(JSON.stringify((ra.u || 0) >= (rb.u || 0) ? rb : ra))}); // mesma regra do mergeDb
    }
  }
  return out;
}
// Na versão web, a lista fica cifrada no localStorage e decifrada aqui (conflitosMem), lida na abertura (conflitosDecifrar).
let conflitosMem = null;
function conflitoLista(){
  if (conflitosMem) return conflitosMem.slice();
  let t = null; try { t = localStorage.getItem(CONFLITO_KEY); } catch(e){}
  try { return t && !ehCifrado(t) ? JSON.parse(t) || [] : []; } catch(e){ return []; }
}
const conflitoGuardar = l => { l = l.slice(-20);
  const guarda = t => { try { localStorage.setItem(CONFLITO_KEY, t); } catch(e){} };
  if (CIFRA_ATIVA){ conflitosMem = l; gravarCifrado(JSON.stringify(l), guarda); } else guarda(JSON.stringify(l)); };
// Abertura da versão web: decifra a lista de conflitos e a cópia de antes da junção guardadas em texto por versões
// antigas passam a ficar cifradas; o arquivo de anos antigos deixa de ficar no aparelho (vem da conta quando precisa).
async function locaisCifrar(){
  if (!CIFRA_ATIVA) return;
  let t = null; try { t = localStorage.getItem(CONFLITO_KEY); } catch(e){}
  if (t && ehCifrado(t)) try { conflitosMem = JSON.parse(await decifrarTexto(t)); } catch(e){ conflitosMem = []; }
  else if (t) conflitoGuardar(conflitoLista());
  const o = beforeInfo();
  if (o && o.db && !ehCifrado(o.db)) gravarCifrado(o.db, d => { try { localStorage.setItem(BEFORE_KEY, JSON.stringify({...o, db:d})); } catch(e){} });
  try { localStorage.removeItem(ARCH_KEY); } catch(e){}
}
function conflitoAvisar(novos){
  conflitoGuardar([...conflitoLista().filter(x => !novos.some(n => n.id === x.id)), ...novos]);
  showAcao(novos.length === 1 ? '1 lançamento foi editado em dois aparelhos. Mantivemos a edição mais recente.'
    : `${novos.length} lançamentos foram editados em dois aparelhos. Mantivemos a edição mais recente.`, 'Ver', openConflitos,
    {tipo:'aviso', dest:{k:'conflito'}});
}
const conflitoCats = c => c === 'incomes' ? CAT_GANHO : c === 'investments' ? CAT_INV : CAT_GASTO;
function conflitoValor(c, k, v){
  if (v == null || v === '') return '—';
  if (k === 'value' || k === 'total') return fmt(+v || 0);
  if (k === 'start') return monthName(String(v));
  if (k === 'date') return fmtDate(String(v));
  if (k === 'cat') return esc((conflitoCats(c)[v] || [, String(v)])[1]);
  return esc(String(v));
}
function openConflitos(){
  settingsOpen = false; F = null;
  const l = conflitoLista().map((x, i) => [x, i, (db[x.col] || []).find(r => r.id === x.id)]).filter(([, , r]) => r).reverse();
  showSheet(`<h3>Editados em dois aparelhos</h3>
    <div class="semTopo hint">O app ficou com a edição mais recente de cada lançamento. Se a outra estava certa, toque em "Usar a outra".</div>
    ${l.length ? l.map(([x, i, r]) => { const difs = CONFLITO_CAMPOS.filter(([k]) => String(r[k] ?? '') !== String(x.outra[k] ?? ''));
      return `<div class="plano card"><b>${esc(r.desc || r.name || r.ticker || 'Lançamento')}</b><small style="display:block;color:var(--muted)">${quando(x.t)}</small>
        <table class="conflito"><tr><th></th><th>Ficou</th><th>A outra</th></tr>${difs.map(([k, nome]) => `<tr><td>${nome}</td><td>${conflitoValor(x.col, k, r[k])}</td><td>${conflitoValor(x.col, k, x.outra[k])}</td></tr>`).join('')}</table>
        <div class="btns"><button class="btn" data-onclick="conflitoDispensar(${i})">Manter</button><button class="btn primary" data-onclick="conflitoUsar(${i})">Usar a outra</button></div></div>`; }).join('')
      : '<div class="hint">Nenhuma edição em dois aparelhos para conferir.</div>'}
    <div class="btns foot"><button class="btn" data-onclick="closeForm();render()">Fechar</button></div>`);
}
function conflitoDispensar(i){ const l = conflitoLista(); l.splice(i, 1); conflitoGuardar(l); openConflitos(); }
// Trocar pela outra vale como uma edição feita agora: ela passa a vencer em todos os aparelhos. A que ficava antes
// passa a ser "a outra", para dar para voltar.
function conflitoUsar(i){
  if (demoBloqueia()) return;
  const l = conflitoLista(), x = l[i], lista = x && db[x.col], j = lista ? lista.findIndex(r => r.id === x.id) : -1;
  if (j < 0) return tell('Esse lançamento não existe mais neste aparelho.');
  const atual = lista[j];
  lista[j] = touch(Object.assign({}, x.outra, {id:x.id, u:atual.u}));
  x.outra = JSON.parse(JSON.stringify(atual)); x.t = Date.now();
  conflitoGuardar(l);
  save(); render(); openConflitos();
}
// ---------- Dados incompletos: a sincronização pausa em vez de gravar ----------
// Rede de segurança contra gravar na conta um estado ruim. Com o arquivo da conta (conta), a junção só tira um registro
// que tem marca de exclusão (tomb): sumir mais da metade dos registros da conta sem essa marca é sinal de erro. Sem o
// arquivo, num aparelho que já sincronizou (sync.nConta = registros na última vez), gravar dados com menos da metade
// criaria um segundo arquivo, quase vazio, na conta. Nos dois casos a pessoa escolhe: baixar os dados da conta ou enviar.
const PAUSA_MSG = 'Seus dados neste aparelho parecem incompletos. Para proteger sua conta, a sincronização foi pausada.';
const nRegs = d => COLS.reduce((t, c) => t + ((d && d[c]) || []).length, 0);
function incompleto(conta, d){
  if (!conta) return !!sync.linked && (sync.nConta || 0) >= 10 && nRegs(d) < sync.nConta / 2;
  const n = nRegs(conta), tem = new Set(COLS.flatMap(c => d[c].map(r => r.id)));
  const sumiram = COLS.reduce((t, c) => t + conta[c].filter(r => !tem.has(r.id) && !((d.tomb || {})[r.id] >= (r.u || 0))).length, 0);
  return n >= 10 && sumiram > n / 2;
}
const pausaHtml = () => sync.pausa ? `<div class="btns"><button class="btn primary" data-onclick="pausaBaixar()">${I('download')}Baixar os dados da conta</button><button class="btn" data-onclick="pausaEnviar()">Enviar mesmo assim</button></div>` : '';
function openPausa(){
  settingsOpen = false; F = null;
  showSheet(`<h3>${I('alert', 22)} Sincronização pausada</h3><div class="hint" style="margin-top:0;color:var(--out)">${PAUSA_MSG}</div>
    <div class="hint">"Baixar os dados da conta" troca os dados deste aparelho pelos da sua conta Google (dá para desfazer em Configurações › Conta e sincronização). "Enviar mesmo assim" grava os dados deste aparelho na conta.</div>
    ${pausaHtml()}<div class="btns foot"><button class="btn" data-onclick="closeForm()">Decidir depois</button></div>`);
}
function pausaBaixar(){ closeForm(); Object.assign(sync, {pausa:false, baixar:true}); syncNow(true); }
async function pausaEnviar(){
  if (!await ask('Enviar os dados deste aparelho para a sua conta Google, mesmo parecendo incompletos?', 'Enviar', true)) return;
  closeForm(); Object.assign(sync, {pausa:false, forcar:true}); syncNow(true);
}
