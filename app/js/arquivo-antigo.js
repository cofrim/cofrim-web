// Cofrim — Arquivo de anos antigos: os lançamentos de anos fechados saem dos dados do dia a dia e ficam num arquivo à
// parte. No fim, a parte "Conta Google" das Configurações (syncSection). Depende de sincronizacao.js.
// Saiu de js/sincronizacao.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Arquivo de anos antigos ----------
// Tira dos dados do dia a dia os lançamentos até o ano Y (inclusive) e guarda num arquivo na conta Google, para a
// sincronização não crescer para sempre. Vão para o arquivo: ganhos e gastos avulsos do período, fixos que já terminaram,
// compras parceladas já encerradas e transferências. Ordem segura: grava o arquivo, confere lendo de volta e só então tira.
const ARCH_COLS = ['incomes', 'expenses', 'installments', 'transfers'];
function archPick(Y){
  const ate = ym => ym && ym.slice(0, 4) <= Y;
  return {
    incomes:db.incomes.filter(x => x.fixed ? ate(x.end) : ate(x.start)),
    expenses:db.expenses.filter(x => x.fixed ? ate(x.end) : ate(x.start)),
    installments:db.installments.filter(p => ate(addMonths(p.start, p.n - 1))),
    transfers:db.transfers.filter(t => ate(t.month))};
}
async function archiveUntil(Y, semPerguntar){
  if (demoBloqueia()) return;
  if (!(canSync() && sync.on)) return tell('O arquivo fica na sua conta Google: entre com a conta para usar.');
  if (shared()) return tell('Na conta compartilhada ainda não dá para arquivar anos antigos (o arquivo ficaria só na sua conta).');
  const pick = archPick(Y), n = ARCH_COLS.reduce((t, c) => t + pick[c].length, 0);
  if (!n) return tell(`Não há lançamentos até ${Y} para arquivar.`);
  if (!semPerguntar && !await ask(`Arquivar ${n} lançamentos de ${Y} e antes?\n\nEles saem dos dados do dia a dia (a sincronização fica mais leve) e vão para um arquivo na sua conta Google. Os resumos desses anos continuam aparecendo, mas os lançamentos não podem ser editados enquanto estiverem arquivados. Dá para trazer de volta.`, 'Arquivar')) return;
  try {
    const f = (await driveList("name='arquivo.json'"))[0], velho = f ? await driveGet(f.id) : {};
    const novo = {until:[Y, velho.until || ''].sort().pop()};
    for (const c of ARCH_COLS){ const m = new Map((velho[c] || []).map(r => [r.id, r])); for (const r of pick[c]) m.set(r.id, r); novo[c] = [...m.values()]; }
    await driveWrite(f && f.id, 'arquivo.json', JSON.stringify(novo));
    const g = (await driveList("name='arquivo.json'"))[0], conf = g ? await driveGet(g.id) : {};
    if (ARCH_COLS.some(c => (conf[c] || []).length !== novo[c].length)) throw new Error('a conferência do arquivo não bateu');
    // Contas acompanhadas desde o período arquivado: o saldo do fim dele vira o saldo inicial, e os saldos não mudam.
    for (const a of db.accounts) if (a.since.slice(0, 4) <= Y) Object.assign(touch(a),
      {initial:round2(accountBalance(a, monthEnd(Y + '-12'))), since:(+Y + 1) + '-01'});
    const t = Date.now();
    for (const c of ARCH_COLS){ const ids = new Set(pick[c].map(r => r.id)); db[c] = db[c].filter(r => !ids.has(r.id)); ids.forEach(id => db.tomb[id] = t); }
    db.archUntil = novo.until; db.cfgMod = t;
    arch = novo; if (!CIFRA_ATIVA) try { localStorage.setItem(ARCH_KEY, JSON.stringify(novo)); } catch(e){} // web: só na memória e na conta
    save(); closeForm(); render();
    await syncNow();
    toast(`${n} lançamentos arquivados.`, {dest:{k:'cfg', s:'dados'}});
  } catch(e){ logErr('arquivar', e); avisoErro('internet', 'Não foi possível arquivar agora. Nada foi tirado dos seus dados.'); }
}
async function archiveRestore(semPerguntar){
  if (demoBloqueia()) return;
  if (!semPerguntar && !await ask('Trazer de volta todos os lançamentos arquivados?\nEles voltam a ser editáveis e a sincronizar normalmente.',
    'Trazer de volta')) return;
  if (!arch && canSync() && sync.on) try { const f = (await driveList("name='arquivo.json'"))[0]; if (f) arch = await driveGet(f.id); } catch(e){}
  if (!arch) return avisoErro('internet', 'Não consegui abrir o arquivo de anos antigos.');
  const t = Date.now();
  for (const c of ARCH_COLS) for (const r of arch[c] || []) if (!db[c].some(x => x.id === r.id)){ db[c].push({...r, u:t}); delete db.tomb[r.id]; }
  db.archUntil = ''; db.cfgMod = t; arch = null;
  try { localStorage.removeItem(ARCH_KEY); } catch(e){}
  save(); closeForm(); render();
  await syncNow();
  try { const f = (await driveList("name='arquivo.json'"))[0]; if (f) ok(await drive('DELETE', `${DRIVE}/drive/v3/files/${f.id}`)); } catch(e){}
  toast('Lançamentos trazidos de volta.', {dest:{k:'cfg', s:'dados'}});
}
function archHtml(){
  const ultimo = String(now.getFullYear() - 1),
  anos = [...new Set([...db.incomes, ...db.expenses].map(x => x.start.slice(0, 4)))].filter(y => y <= ultimo).sort();
  if ((!db.archUntil && !anos.length) || shared()) return '';
  return `<label>Anos antigos</label>
    ${db.archUntil ? `<div class="semTopo hint">Arquivado até ${db.archUntil}.</div>` : ''}
    <div class="btns" style="margin-top:${db.archUntil ? 8 : 0}px">${anos.length ? `<button class="btn" data-onclick="archivePick()">${I('box')}Arquivar anos antigos</button>` : ''}${db.archUntil ? '<button class="btn" data-onclick="archiveRestore()">Trazer de volta</button>' : ''}</div>
    <div class="hint">Tira da sincronização do dia a dia os lançamentos de anos que já passaram e guarda num arquivo na sua conta Google. Os resumos desses anos continuam aparecendo.</div>`;
}
function archivePick(){
  const ultimo = String(now.getFullYear() - 1),
  anos = [...new Set([...db.incomes, ...db.expenses].map(x => x.start.slice(0, 4)))].filter(y => y <= ultimo).sort().reverse();
  pickList('Arquivar até o ano (inclusive)', anos.map(y => [y, y]), '', y => archiveUntil(y));
}
function syncSection(){
  if (!canSync()) return !isPreview ? '' : `<label>Conta Google</label><div class="semTopo hint in">${I('check', 14)} Conectado (demonstração)</div>
    <div class="btns"><button class="btn" disabled style="opacity:.5">${I('history')}Versões salvas</button><button class="cresce btn danger" data-onclick="logout()">Sair ou trocar de conta</button></div>`;
  const status = syncing ? 'Sincronizando…' : sync.err ? `<span class="warn">${I('alert', 14)}</span> ` + esc(sync.err)
    : sync.at ? `<span class="in">${I('check', 14)}</span> Sincronizado em ` + new Date(sync.at).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : 'Ainda não sincronizado.';
  const email = temNativo('conta') ? nativo('conta') : '';
  return `<label>Conta Google</label>${email ? `<div class="semTopo hint">Conectado como <b>${esc(email)}</b></div>` : ''}<div class="hint" style="margin-top:${email ? 4 : 0}px">${status}</div>
    <div class="btns"><button class="btn" data-onclick="syncNow(true)">${I('refresh')}Sincronizar agora</button><button class="btn" data-onclick="openBackups()">${I('history')}Versões salvas</button></div>
    ${pausaHtml()}${beforeHtml()}${conflitoLista().length ? `<div class="btns"><button class="btn" data-onclick="openConflitos()">${I('alert')}Editados em dois aparelhos (${conflitoLista().length})</button></div>` : ''}
    ${aparelhosHtml()}
    <div class="btns"><button class="cresce btn danger" data-onclick="logout()">Sair ou trocar de conta</button></div>`;
}
