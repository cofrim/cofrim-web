// Cofrim — Sincronizar agora, cópias de segurança (diárias e antes de restaurar), sair da conta e apagar os dados.
// Depende de sincronizacao.js e nuvem.js.
// Saiu de js/nuvem.js (só mudou de arquivo); carregado logo depois dele no index.html.

function scheduleSync(){ if (demoOn || !canSync() || !sync.on) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 3000); }
async function syncNow(interactive){
  if (demoOn){ if (interactive) tell(DEMO_MSG); return; }
  if (!canSync() || !sync.on || trocando) return;
  if (sync.pausa && !interactive) return; // dados incompletos: espera a pessoa escolher (pausaHtml)
  if (syncing){ syncAgain = true; return; } // houve alteração durante a sincronização: repete ao terminar
  syncing = true; nuvemDraw();
  const pend0 = sync.pend || 0, forcar = sync.forcar, baixar = sync.baixar;
  sync.forcar = sync.baixar = false;
  try {
    // Na conta compartilhada, os dados vêm da planilha (sharedRead); senão, do arquivo na pasta oculta do Drive.
    const sid = shared(), file = sid ? null : (await driveList("name='financas.json'", interactive, ',version'))[0];
    // Conta pessoal: arquivo na mesma versão do Drive da última sincronização deste aparelho = os dados dele são os que
    // este aparelho já juntou. Não precisa baixar; só envia se algo mudou aqui (sync.hash). Com bem menos registros que
    // da última vez, baixa e confere como sempre (incompleto).
    const mesma = !!(file && file.version && !baixar && file.id === sync.idConta && String(file.version) === sync.verConta && nRegs(db) >= (sync.nConta || 0) / 2);
    const bruto = sid ? await sharedRead(sid, interactive) : file && !mesma ? await driveGet(file.id) : null, remote = bruto && fixDb(bruto);
    if (demoOn) return; // a demonstração foi ligada no meio: os dados reais não podem entrar na tela
    if (newerDb(remote)) throw {status:-3};
    if (sid && membroEu()) save(false); // este aparelho entra na lista de pessoas da conta
    if (baixar && !remote) throw {status:-8};
    if (baixar){ keepBefore(); loadDb(sid ? {...remote, prefs:db.prefs, sugs:db.sugs} : remote); rollover(); save(false); if (!sheetOpen()) render();
      } // "Baixar os dados da conta"
    if (!forcar && !remote && !mesma && incompleto(null, db)) throw {status:-7};
    if (remote){
      const aqui = semExcluidosVelhos(db, remote, sync.at), cf = conflitos(aqui, remote, sync.at), merged = mergeDb(aqui, remote);
      if (!forcar && incompleto(remote, merged)) throw {status:-7};
      if (sid) Object.assign(merged, {prefs:db.prefs, sugs:db.sugs}); // nome, aparência e sugestões são de cada pessoa
      if (canonS(merged) !== canonS(db)){
        const veio = incoming(db, merged), novas = sid ? atividade(db, merged) : [];
        keepBefore(); // cópia deste aparelho antes de juntar, para poder desfazer
        loadDb(merged); rollover(); save(false);
        sugDaConta(); // celular: o que a versão web fez com as sugestões
        if (novas.length) ativAvisar(novas); // conta compartilhada: diz quem fez o quê
        else if (veio && !cf.length) toast(`Sincronizado: ${veio} ${veio > 1 ? 'alterações vieram' : 'alteração veio'} de outro aparelho.`, {dest:{k:'sync'}});
        if (cf.length) conflitoAvisar(cf); // por cima do aviso de cima: este pede atenção
        if (!sheetOpen()) render();
      }
    }
    compNativo();
    if (sid) vistoGuardar(db); else espiarComp(); // na conta pessoal, aproveita para espiar a compartilhada
    let ver = file && file.version, idc = file && file.id;
    // O texto canônico e a marca do que vai ser enviado, calculados uma vez (com muitos lançamentos, cada canonS custa caro);
    // a marca guardada é a do que foi enviado, mesmo que algo mude aqui durante o envio (isso vai na próxima).
    const cDb = canonS(db), hDb = hashId(cDb);
    if (mesma ? hDb !== sync.hash : !remote || cDb !== canonS(remote)){
      if (sid) await sharedWrite(sid, paraPlanilha(db));
      else { const r = await driveWrite(file && file.id, 'financas.json', await fechaGz(JSON.stringify(db)));
        try { ({id:idc, version:ver} = JSON.parse(r.text)); } catch(e){ ver = ''; } }
    }
    if (!sid) Object.assign(sync, {idConta:idc || '', verConta:ver ? String(ver) : '', hash:hDb});
    centralAdd('Sincronização efetuada', 'sucesso', 0, {k:'sync'});
    Object.assign(sync, {linked:true, at:Date.now(), err:'', errTipo:'', retry:0, pend:Math.max(0, (sync.pend || 0) - pend0), pausa:false, nConta:nRegs(db)});
    // o que foi salvo durante a sincronização continua pendente
    clearTimeout(retryTimer);
    await dailyBackup().catch(() => {}); // a cópia diária não pode derrubar a sincronização
    await syncPhotos().catch(() => {});  // comprovantes pendentes: se falhar, ficam na fila para a próxima vez
    await sheetSync().catch(() => {});   // planilha do Google ligada ao app (se houver)
    aparelhosAtualizar().catch(e => logErr('aparelhos', e)); // a linha deste aparelho na lista da conta (js/aparelhos.js)
  } catch(e){
    // Conta compartilhada encerrada pela outra pessoa (aviso na planilha) ou planilha apagada: este aparelho volta sozinho
    // para a conta individual, ficando com uma cópia dos lançamentos.
    if (shared() && (e.status === -4 || e.status === 404)){ shareEnded(e.por || ''); return; }
    if (e.status !== 0 && e.status !== -1) logErr('sincronizar', e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e);
    if (e.status === -7){ sync.pausa = true; if (interactive || !sheetOpen()) openPausa(); }
    if (e.status === -8) tell('Não encontramos os dados na sua conta Google. Se precisar, restaure uma cópia em "Versões salvas".');
    sync.errTipo = erroTipo(e); // para a folha da nuvem mostrar as causas e soluções certas
    sync.err = sync.errTipo === 'espaco' ? 'O seu Google Drive está cheio.' : sync.errTipo === 'google' ? 'O Google está instável no momento.' : e.status === -7 ? PAUSA_MSG : e.status === -8 ? 'Não encontramos os dados na sua conta Google.' : e.status === -3 ? 'Os dados da conta foram gravados por uma versão mais nova do app. Atualize o app neste aparelho.'
      : shared() && sharedMsg(e) ? sharedMsg(e)
      : e.status === -1 ? 'É preciso entrar na conta Google.' : e.status === -5 && !shared() ? (sync.linked ? MSG_ESCOPO_CONTA : MSG_ESCOPO) : erroAmigavel(e);
    centralAdd('Erro ao sincronizar: ' + sync.err, 'erro', 0, {k:'sync'});
    // Permissão desmarcada na tela do Google, num pedido da pessoa: oferece tentar de novo (na tela de entrada, o próprio
    // botão "Entrar com Google" faz isso).
    if (e.status === -5 && interactive && sync.linked) ask(sync.err, 'Tentar de novo').then(sim => { if (sim) syncNow(true); });
    // Sem internet ou falha do servidor: tenta de novo sozinho, esperando cada vez mais (30 s, 1 min, 2 min… até 30 min).
    if (e.status === 0 || e.status >= 500 || e.status === undefined){
      sync.retry = Math.min((sync.retry || 0) + 1, 8);
      clearTimeout(retryTimer); retryTimer = setTimeout(syncNow, retryDelay(sync.retry));
    }
  } finally {
    syncing = false;
    saveSync(); nuvemDraw();
    if (settingsShown()) openSettings();
    if (syncAgain){ syncAgain = false; scheduleSync(); }
  }
}
// Uma cópia por dia na conta, guardada por 30 dias, para desfazer um erro ou uma importação errada.
const dayStr = t => new Date(t).toLocaleDateString('sv'); // AAAA-MM-DD
async function dailyBackup(){
  const today = dayStr(Date.now());
  if (sync.bk === today) return;
  const files = await driveList("name contains 'backup-'");
  if (!files.some(f => f.name === `backup-${today}.json`)){ await driveWrite(null, `backup-${today}.json`, JSON.stringify(db), {n:String(nLanc(db))});
    centralAdd('Cópia do dia salva na sua conta Google (Versões salvas).', 'sucesso', 0, {k:'sync'}); }
  const oldest = `backup-${dayStr(Date.now() - 30*864e5)}.json`;
  for (const f of files) if (f.name < oldest) await drive('DELETE', `${DRIVE}/drive/v3/files/${f.id}`);
  sync.bk = today;
}
// Lançamentos (ganhos, gastos e compras parceladas), para a tela "Versões salvas" ajudar a escolher.
const nLanc = d => ['incomes', 'expenses', 'installments'].reduce((t, c) => t + ((d && d[c]) || []).length, 0);
// Cópia feita antes de restaurar: backup-AAAA-MM-DD-antes-HHMM.json. Começa com a data, como as diárias: a limpeza de 30
// dias e as versões antigas do app (que mostram a data do nome) continuam funcionando com ela.
const backupData = n => n.slice(7, 17), backupAntes = n => /-antes-(\d\d)(\d\d)/.exec(n);
function backupNome(f){
  const a = backupAntes(f.name), t = f.modifiedTime ? new Date(f.modifiedTime) : null;
  const hora = a ? `${a[1]}:${a[2]}` : t ? t.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}) : '';
  return (a ? (f.appProperties && f.appProperties.antes === 'importar' ? 'Antes de importar – ' : 'Antes de restaurar – ') : '') + fmtDate(backupData(f.name)) + (hora ? ', ' + hora : '');
}
async function openBackups(){
  if (demoBloqueia()) return;
  settingsOpen = false; F = null;
  showSheet('<h3>Versões salvas na conta</h3><div class="hint">Carregando…</div>');
  let files;
  try { files = await comCarga('Buscando as versões salvas…', () => driveList("name contains 'backup-'", false, ',modifiedTime,appProperties')); }
  catch(e){ return showSheet('<h3>Versões salvas na conta</h3><div class="hint">Não foi possível carregar. Verifique a internet.</div><div class="btns"><button class="btn" data-onclick="openSettings(\'conta\')">Voltar</button></div>'); }
  showSheet(`<h3>Versões salvas na conta</h3>
    <div class="semTopo hint">O app guarda uma cópia por dia de uso, por 30 dias. Restaurar troca todos os dados atuais pelos daquele dia, em todos os aparelhos.</div>
    ${files.length ? files.map(f => { const n = f.appProperties && +f.appProperties.n;
      return `<div class="item" data-id="${esc(f.id)}" data-name="${esc(f.name)}" data-onclick="restoreBackup(this.dataset.id,this.dataset.name)"><div class="mid"><b>${esc(backupNome(f))}</b>${n >= 0 && f.appProperties.n !== '' ? `<small>${n} ${n === 1 ? 'lançamento' : 'lançamentos'}</small>` : ''}</div><div class="muted">Restaurar ›</div></div>`; }).join('') : '<div class="hint">Ainda não há cópias. A primeira é criada na próxima sincronização.</div>'}
    <div class="btns"><button class="btn" data-onclick="openSettings('conta')">Voltar</button></div>`);
}
// Grava os dados atuais em "Versões salvas" como backup-AAAA-MM-DD-antes-HHMM.json (motivo: '1' = restaurar, 'importar').
async function copiaAntes(motivo){
  const t = new Date(), hhmm = t.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}).replace(':', '');
  await comCarga('Guardando uma cópia dos dados atuais…',
    () => driveWrite(null, `backup-${dayStr(t)}-antes-${hhmm}.json`, JSON.stringify(db), {n:String(nLanc(db)), antes:motivo}));
}
async function restoreBackup(id, name){
  if (demoBloqueia()) return;
  if (!await ask(`Restaurar os dados de ${backupNome({name})}?\nOs dados atuais serão substituídos. Antes, o app guarda uma cópia deles em "Versões salvas", para dar para desfazer.`, 'Restaurar', true)) return;
  let snap;
  try { snap = fixDb(await comCarga('Baixando a versão escolhida…', () => driveGet(id))); } catch(e){ return avisoErro('internet', 'Não foi possível baixar essa versão.'); }
  // Cópia do estado atual antes de trocar ("antes de restaurar"): restaurar essa cópia desfaz a restauração.
  try { await copiaAntes('1'); }
  catch(e){ logErr('cópia antes de restaurar', e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e);
    return avisoErro('internet', 'Não foi possível guardar a cópia dos dados atuais, então nada foi restaurado.'); }
  // Para a restauração valer em todos os aparelhos: tudo o que veio da cópia fica como "alterado agora",
  // e o que existe hoje mas não existia nela é marcado como excluído.
  applySnapshot(snap);
  syncNow();
}
// Sai da conta Google no lado nativo. Com o bloqueio ligado, o Android pede antes a senha ou a biometria e responde
// em onSair(true/false); a promessa diz se saiu. Sem o lado nativo, não há o que confirmar.
function sairNativo(){
  if (!(temNativo('sair'))) return Promise.resolve(true);
  return new Promise(res => { window.onSair = ok => { window.onSair = null; res(ok !== false); }; nativo('sair'); });
}
// O que este aparelho guarda da conta fora do banco: a cópia de antes da junção, o arquivo de anos antigos, os conflitos,
// a atividade da conta compartilhada, os avisos do sino, as sugestões do banco, o rascunho e o histórico da nuvem. Sai
// junto com os dados ao sair da conta ou apagar tudo: quem entrar depois não pode ver nem "desfazer a junção" com eles.
function apagarDaConta(){
  for (const k of [BEFORE_KEY, ARCH_KEY, FILE_OK, CONFLITO_KEY, ATIV_KEY, VISTO_KEY, CENTRAL_KEY, SUG_KEY, DRAFT, NUVEM_LOG_KEY])
    try { localStorage.removeItem(k); } catch(e){}
  arch = null; archTried = false; conflitosMem = null;
}
// Sair da conta (para trocar de conta): envia o que falta, apaga os dados deste aparelho e volta ao login.
// Os dados precisam sair do aparelho; senão, ao entrar com outra conta, eles seriam misturados aos dela.
async function logout(){
  if (demoBloqueia()) return;
  if (!await ask('Sair da conta Google?\n\nOs dados deste aparelho serão apagados. Eles continuam salvos na sua conta e voltam quando você entrar de novo com ela.', 'Sair', true)) return;
  if (canSync()){
    await syncNow();
    if (sync.err && !await ask(`Não foi possível sincronizar agora (${sync.err})\n\nSe sair mesmo assim, as alterações ainda não enviadas serão perdidas. Sair?`, 'Sair mesmo assim', true)) return;
    await aparelhoEsquecer().catch(e => logErr('aparelhos', e)); // sai da lista de aparelhos da conta
    // O próximo login volta a perguntar qual conta usar. Sem a senha ou a biometria (bloqueio ligado), nada muda.
    if (!await sairNativo()) return;
  }
  sairDaqui();
}
// Apaga os dados deste aparelho e volta ao login (logout, ou outro aparelho que pediu: aparelhoSaiuDeLonge).
function sairDaqui(){
  clearTimeout(syncTimer);
  db.expenses.filter(x => x.photo).forEach(x => photoDelete(x.id)); // as fotos continuam na conta; aqui saem junto com os dados
  // Tema, cores, abas e o resto das preferências voltam ao padrão (fica só o idioma): a tela de login e quem entrar depois
  // não herdam o jeito de quem saiu. As preferências de cada conta voltam com ela, da conta Google.
  apagarDaConta();
  db = fixDb({rates:db.rates, prefs:db.prefs.lang ? {lang:db.prefs.lang} : {}});
  ensurePrefs(); applyCats(); applyTheme();
  chatLog.length = 0;
  Object.assign(sync, {on:false, linked:false, demo:false, err:'', at:0, bk:'', up:[], del:[], shared:null});
  saveSync(); save(false); closeForm(); render(); showGate();
  iconePadrao();
}
// Ícone do app (só no Android) de volta ao padrão: o do Cofrim (cor índigo, desenho b). Pode fechar o app no Android,
// por isso fica por último, com os dados já apagados e a tela de login à mostra.
function iconePadrao(){
  if (!(temNativo('setIconeApp') && temNativo('icone'))) return;
  if (nativo('icone') !== 'indigo' || nativo('iconeDesenho') !== 'b') nativo('setIconeApp', 'indigo', 'b', 0);
}
// Apaga tudo: os arquivos do app na conta Google e os dados deste aparelho; depois volta à tela de login.
async function wipeAll(semPerguntar){
  if (demoBloqueia()) return;
  // Na conta compartilhada, apagar tudo apagaria os dados da outra pessoa também.
  if (shared()){ tell('Você está numa conta compartilhada. Saia dela antes (Configurações › Conta compartilhada) para apagar os seus dados.'); return; }
  if (!semPerguntar){
    if (!await ask('Apagar todos os seus dados?\n\nSomem os lançamentos deste aparelho e os da sua conta Google, com as cópias diárias e os comprovantes. Outros aparelhos com esta conta também ficam sem os dados.', 'Apagar tudo', true)) return;
    if (!await ask('Tem certeza? Isso não pode ser desfeito.', 'Sim, apagar', true)) return;
  }
  if (canSync() && sync.on){
    try {
      for (let volta = 0; volta < 20; volta++){
        const files = await driveList('trashed=false');
        if (!files.length) break;
        for (const f of files) ok(await drive('DELETE', `${DRIVE}/drive/v3/files/${f.id}`));
      }
    } catch(e){ return avisoErro('internet', 'Não consegui apagar os dados da conta Google. Nada foi apagado neste aparelho.'); }
    await sairNativo(); // os dados da conta já foram apagados: os deste aparelho saem mesmo se a senha não for confirmada
  }
  clearTimeout(syncTimer); clearTimeout(retryTimer);
  db.expenses.filter(x => x.photo).forEach(x => photoDelete(x.id));
  for (const k of [KEY, ERR_KEY, FUN_KEY, HIDE_KEY, VER_KEY]) try { localStorage.removeItem(k); } catch(e){}
  apagarDaConta();
  if (!fileStore()) idbWrite('').catch(() => {});
  if (temNativo('dadosApagar')) nativo('dadosApagar');
  db = fixDb({});
  ensurePrefs(); applyCats(); applyTheme();
  chatLog.length = 0; hideVals = false;
  Object.assign(sync,
    {on:false, linked:false, demo:false, err:'', at:0, bk:'', up:[], del:[], tries:{}, retry:0, welcomed:false, lockAsked:sync.lockAsked, shared:null,
    tour:false, account:'', askedShare:false, famOk:false});
  saveSync(); save(false); closeForm(); render(); showGate();
}
