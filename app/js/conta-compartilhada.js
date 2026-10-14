// Cofrim — Conta compartilhada (casal ou família): pessoas, avisos do que os outros lançaram e a espiada na conta
// pessoal. Depende de sincronizacao.js.
// Saiu de js/sincronizacao.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Conta compartilhada (casal ou família) ----------
// A pasta oculta do app no Drive é de uma conta só. Para duas contas Google verem os mesmos dados, eles ficam numa
// planilha do Google criada por quem convida e compartilhada com a outra pessoa. O JSON dos dados vai na coluna A da
// aba "dados", em pedaços (uma célula aceita até 50 mil caracteres). A junção é a mesma da sincronização normal
// (mergeDb). Fica de cada pessoa, no próprio aparelho e na própria conta: aparência e nome (prefs), cópias diárias e
// comprovantes. sync.shared = {id, owner, with:[e-mails convidados]}.
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
let PEDACO = 40000;
// "Salvar cópia no meu Google Drive": permissão de criar arquivos visíveis (drive.file). Num APK sem driveArquivo
// (anterior à 1.75), vai pelo pedido da conta compartilhada, que também a inclui.
const arq = (method, url, body, ctype) => demoOn ? Promise.resolve({status:-6, text:'demonstração'}) : espera(new Promise(res => { const id = ++driveSeq;
  drivePending[id] = res;
  nativo(temNativo('driveArquivo') ? 'driveArquivo' : 'driveFamilia', id, method, url, body || '', ctype || '', true); }));
const fam = (method, url, body, ctype, interactive) => demoOn ? Promise.resolve({status:-6, text:'demonstração'}) : espera(new Promise(res => { const id = ++driveSeq; drivePending[id] = res; nativo('driveFamilia', id, method, url, body || '', ctype || '', !!interactive); }));
// sync.pessoal = a pessoa está numa conta compartilhada mas escolheu ver, por enquanto, a conta pessoal (trocarConta):
// nesse modo tudo funciona como sem conta compartilhada (os dados vêm do arquivo da conta Google dela).
const shared = () => sync.shared && !sync.pessoal && sync.shared.id;
const rng = r => encodeURIComponent(r);
// Além dos dados (aba "dados"), a aba "leia-me" guarda dois avisos: A4 = "LIMPA" (conta criada do zero: quem entra não
// leva os próprios lançamentos) e A5 = "ENCERRADA|quem|quando" (alguém saiu: a conta acabou para todos). sharedInfo
// guarda o que a última leitura encontrou. Uma conta encerrada vira o erro {status:-4, por}.
let sharedInfo = {limpa:false};
async function sharedRead(id, interactive){
  const r = JSON.parse(ok(await fam('GET',
    `${SHEETS}/${id}/values:batchGet?ranges=${rng('dados!A:A')}&ranges=${rng('leia-me!A4:A5')}&majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE`, '',
    '', interactive)).text).valueRanges || [];
  const v = r[0] && r[0].values, av = (r[1] && r[1].values && r[1].values[0]) || [];
  sharedInfo = {limpa:String(av[0] || '') === 'LIMPA'};
  if (String(av[1] || '').startsWith('ENCERRADA')) throw {status:-4, por:String(av[1]).split('|')[1] || '', text:'encerrada'};
  const txt = v && v[0] ? v[0].join('') : '';
  if (txt.length > DADOS_MAX) throw {status:-9, text:'A planilha da conta compartilhada está grande demais para abrir.'}; // dado de fora: não trava o celular
  return txt ? JSON.parse(txt) : null;
}
async function sharedWrite(id, json){
  const partes = [];
  for (let i = 0; i < json.length; i += PEDACO) partes.push([json.slice(i, i + PEDACO)]);
  ok(await fam('PUT', `${SHEETS}/${id}/values/${rng('dados!A1:A' + partes.length)}?valueInputOption=RAW`, JSON.stringify({values:partes}), 'application/json'));
  ok(await fam('POST', `${SHEETS}/${id}/values/${rng('dados!A' + (partes.length + 1) + ':A')}:clear`, '{}', 'application/json'));
}
// Texto para comparar na conta compartilhada: a aparência (prefs) e as sugestões são de cada um e não contam como diferença.
const canonS = d => canon(shared() ? {...d, prefs:null, sugs:null} : d);
// O que vai para a planilha: tudo menos as sugestões de gasto, que vêm das notificações do celular de cada um.
const paraPlanilha = d => JSON.stringify({...d, sugs:undefined});
const sharedMsg = e => e.status === 403 && /SERVICE_DISABLED|has not been used|not been enabled/i.test(e.text) ? 'A API do Google Sheets não está ativada no projeto do app no Google Cloud.'
  : e.status === 403 || e.status === 404 ? 'Sem acesso à conta compartilhada: confira se o convite foi feito para esta conta Google.' : '';
const codeOf = s => (String(s).match(/\/d\/([\w-]{20,})/) || String(s).trim().match(/^([\w-]{20,})$/) || [])[1] || '';
const inviteText = id => `Te convidei para a nossa conta compartilhada no app Cofrim. No app, abra Configurações › Conta compartilhada › Tenho um convite e cole este código:\n${id}`;
// Quem lançou: registros antigos (sem by) passam a ser desta pessoa ao entrar numa conta compartilhada.
function claimMine(){ const me = myName(); if (me) for (const c of COLS) for (const r of db[c]) if (!r.by){ r.by = me; r.u = Date.now(); } }
// ---------- Pessoas e avisos da conta compartilhada ----------
// db.membros = {chave: {nome, email, desde, t}}: cada aparelho se inscreve ao sincronizar (membroEu), então a lista
// viaja junto com os dados. A chave é o e-mail da conta Google (ou o nome, se o e-mail não estiver disponível).
const membroChave = () => String((temNativo('conta') && nativo('conta')) || myName() || 'eu').toLowerCase();
function membroEu(){
  const k = membroChave(), email = k.includes('@') ? k : '', nome = myName() || email.split('@')[0] || 'Sem nome', m = db.membros[k];
  if (m && m.nome === nome) return false;
  db.membros[k] = {nome, email, desde:(m && m.desde) || Date.now(), t:Date.now()};
  return true;
}
// O app não tem servidor: cada aparelho descobre o que os outros fizeram quando sincroniza. Ao juntar os dados, atividade()
// lista quem entrou e o que outra pessoa adicionou ou editou (gastos, ganhos e investimentos); isso vira um aviso na tela
// e fica guardado neste aparelho (ATIV_KEY). Com o app fechado, quem avisa é o lado nativo (ShareReceiver), de hora em hora.
const ATIV_KEY = 'financas-ativ', ATIV_COLS = {expenses:'o gasto', installments:'a compra parcelada', incomes:'o ganho', investments:'o investimento'};
function atividade(a, m){
  const eu = myName(), out = [];
  for (const [k, p] of Object.entries(m.membros || {})) if (!a.membros[k] && k !== membroChave()) out.push({t:p.desde || Date.now(), quem:p.nome,
    txt:'entrou na conta compartilhada'});
  for (const c in ATIV_COLS){
    const meus = new Map(a[c].map(r => [r.id, r.u || 0]));
    for (const r of m[c]){
      const novo = !meus.has(r.id), quem = (novo ? r.by : r.ed || r.by) || 'Alguém', v = r.value || r.total || 0;
      if ((novo || (r.u || 0) > meus.get(r.id)) && quem !== eu) out.push({t:r.u || Date.now(), quem,
        txt:`${novo ? 'adicionou' : 'editou'} ${ATIV_COLS[c]} ${r.desc || r.name || r.ticker || ''}`.trim() + (v ? ` (${fmt(v)})` : '')});
    }
  }
  return out.sort((x, y) => x.t - y.t);
}
function ativLista(){ try { return JSON.parse(localStorage.getItem(ATIV_KEY)) || []; } catch(e){ return []; } }
const ativGuardar = l => { try { localStorage.setItem(ATIV_KEY, JSON.stringify(l.slice(-40))); } catch(e){} };
const ativNovas = () => ativLista().filter(x => !x.visto).length;
function ativAvisar(novas){
  if (!novas.length) return;
  ativGuardar([...ativLista(), ...novas]);
  if (db.prefs.avisoComp === false) return;
  toast(novas.length === 1 ? `${sync.pessoal ? 'Conta compartilhada: ' : ''}${novas[0].quem} ${novas[0].txt}` : `${novas.length} novidades na conta compartilhada. Veja no Resumo.`, {dest:{k:'compart'}});
}
// Faixa no topo do Resumo enquanto houver novidades não vistas; tocar abre a lista.
const ativHtml = () => { const n = sync.shared && db.prefs.avisoComp !== false ? ativNovas() : 0, u = n && ativLista().pop();
  return n ? `<div class="card avisoComp" data-onclick="openAtividade()"><span>${I('bell', 20)}</span><div><b>${n === 1 ? '1 novidade' : n + ' novidades'} na conta compartilhada</b><small>${esc(u.quem)} ${esc(u.txt)}</small></div>${I('chev', 18)}</div>` : ''; };
const quando = t => new Date(t).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
function openAtividade(){
  settingsOpen = false; F = null;
  const l = ativLista().reverse();
  showSheet(`<h3>Atividade da conta compartilhada</h3>
    ${l.length ? l.map(x => `<div class="semCursor item"><span class="${x.visto ? 'muted' : 'in'}">${I(/entrou/.test(x.txt) ? 'people' : 'bell', 20)}</span><div class="mid"><b class="quebra">${esc(x.quem)} ${esc(x.txt)}</b><small>${quando(x.t)}</small></div></div>`).join('')
      : '<div class="semTopo hint">Nada por aqui ainda. Quando outra pessoa entrar na conta ou lançar algo, aparece nesta lista.</div>'}
    <div class="hint">O app confere as novidades sempre que sincroniza (ao abrir e a cada alteração) e, com ele fechado, mais ou menos de hora em hora.</div>
    <div class="btns foot">${sync.pessoal ? `<button class="btn" data-onclick="closeForm();render();trocarConta()">${I('people')}Ir para a compartilhada</button>` : ''}<button class="btn primary" data-onclick="closeForm();render()">Pronto</button></div>`);
  ativGuardar(ativLista().map(x => ({...x, visto:1})));
}
// Entrega ao lado nativo o que ele precisa para avisar com o app fechado ('' desliga).
// d = os dados da conta compartilhada: os do app ou, na conta pessoal, os que espiarComp acabou de ler da planilha.
function compNativo(d){
  if (demoOn || !(temNativo('compart')) || (sync.shared && sync.pessoal && !d)) return; // na conta pessoal, só espiarComp atualiza o lado nativo
  d = d || db;
  const ligado = sync.shared && db.prefs.avisoComp !== false;
  // A permissão de notificações do Android só é pedida ao ligar os lembretes deste aparelho (ver ligarLembretes);
  // com eles desligados, o lado nativo continua conferindo a conta, mas não mostra notificação.
  nativo('compart', ligado ? JSON.stringify({id:sync.shared.id, eu:myName(),
    t:Math.max(0, ...Object.keys(ATIV_COLS).flatMap(c => d[c].map(r => r.u || 0))), membros:Object.keys(d.membros)}) : '');
}
// ---------- Na conta pessoal: espiar a conta compartilhada ----------
// Quem trocou para a conta pessoal continua sabendo o que acontece na compartilhada: a cada minuto (e a cada
// sincronização) o app lê a planilha, só para leitura, e compara com o que já tinha visto (VISTO_KEY: ids e datas de
// alteração, guardados a cada sincronização na conta compartilhada). As novidades viram o mesmo aviso e a mesma faixa
// do Resumo; nada da planilha entra nos dados pessoais.
const VISTO_KEY = 'financas-comp-visto';
const vistoDe = d => ({membros:Object.fromEntries(Object.keys(d.membros || {}).map(k => [k, 1])),
  ...Object.fromEntries(Object.keys(ATIV_COLS).map(c => [c, d[c].map(r => ({id:r.id, u:r.u || 0}))]))});
function vistoGuardar(d){ try { localStorage.setItem(VISTO_KEY, JSON.stringify(vistoDe(d))); } catch(e){} }
let espiando = false;
async function espiarComp(){
  if (demoOn || !sync.shared || !sync.pessoal || espiando || trocando || !canSync()) return;
  espiando = true;
  try {
    const bruto = await sharedRead(sync.shared.id), remoto = bruto && fixDb(bruto);
    if (!remoto || !sync.shared || !sync.pessoal) return;
    let visto = null;
    try { visto = JSON.parse(localStorage.getItem(VISTO_KEY)); } catch(e){}
    if (visto){ const novas = atividade(visto, remoto); if (novas.length){ ativAvisar(novas); if (!sheetOpen()) render(); } }
    vistoGuardar(remoto); compNativo(remoto);
  } catch(e){
    if (e && (e.status === -4 || e.status === 404)) shareEnded(e.por || ''); // a conta foi encerrada por outra pessoa
  } finally { espiando = false; }
}
// Estado dos avisos com o app fechado (só no app instalado): o que falta liberar no Android, quando foi a última
// conferência e o que ela achou, e os botões para testar.
function avisoNativoHtml(){
  if (!temNativo() || db.prefs.avisoComp === false) return '';
  if (!temNativo('compartLog')) return '<div class="hint warn">Para receber os avisos com o app fechado, instale a atualização do app (Configurações › Atualização).</div>';
  const [t, r] = String(nativo('compartLog')).split('|'), semPerm = !lembLigados(), economia = temNativo('bateriaLivre') && !nativo('bateriaLivre');
  return `${semPerm ? `<div class="hint warn">Os lembretes estão desligados neste aparelho: os avisos não aparecem como notificação.</div><div class="btns u-mt6"><button class="btn primary" data-onclick="ligarLembretes()">Ligar lembretes</button></div>` : ''}
    ${economia ? `<div class="hint warn">O app está na economia de bateria: o Android pode atrasar ou cortar os avisos com ele fechado.</div><div class="btns u-mt6"><button class="btn" data-onclick="nativo('bateria')">Tirar da economia de bateria</button></div>` : ''}
    <div class="hint">Última conferência com o app fechado: ${t ? `${quando(+t)} — ${esc(r || '')}` : 'ainda não aconteceu'}.</div>
    ${temNativo('compartHist') && nativo('compartHist') ? `<details class="grp"><summary>Últimas conferências${I('chev')}</summary><div class="hint" style="margin:0 0 8px">${String(nativo('compartHist')).split('\n').map(l => { const i = l.indexOf('|'); return `${quando(+l.slice(0, i))} — ${esc(l.slice(i + 1))}`; }).join('<br>')}</div></details>` : ''}
    <div class="btns u-mt6"><button class="btn" data-onclick="conferirNativo()">Conferir agora</button></div>`;
}
function conferirNativo(){ if (demoBloqueia()) return; nativo('compartConferir');
  comCarga('Conferindo a conta compartilhada…', () => new Promise(r => setTimeout(r, 6000))).then(() => { if (settingsShown()) openSettings(); }); }
// Fim da conta compartilhada neste aparelho: a lista de pessoas e os avisos dela deixam de valer.
function compFim(){ sync.pessoal = false; saveSync(); db.membros = {};
  try { localStorage.removeItem(ATIV_KEY); localStorage.removeItem(VISTO_KEY); } catch(e){} compNativo(); }
function setAvisoComp(on){ setPref('avisoComp', on); compNativo(); if (on && !lembLigados()) ligarLembretes(); }
const membrosHtml = s => { const eu = membroChave(), ms = Object.entries(db.membros).sort((a, b) => a[1].desde - b[1].desde),
  emails = new Set(ms.map(([, m]) => m.email));
  const falta = (s.with || []).filter(e => !emails.has(e));
  return `<label>Pessoas na conta (${ms.length})</label><div class="card" style="box-shadow:none;background:var(--bg);margin:0">
    ${ms.map(([k, m]) => `<div class="semCursor item">${tile('user')}<div class="mid"><b>${esc(m.nome)}${k === eu ? ' (você)' : ''}</b><small>${m.email ? esc(m.email) + ' · ' : ''}desde ${new Date(m.desde).toLocaleDateString('pt-BR')}</small></div></div>`).join('')}
    ${falta.map(e => `<div class="item" style="cursor:default;opacity:.65">${tile('user')}<div class="mid"><b>${esc(e)}</b><small>convite enviado, ainda não entrou</small></div></div>`).join('')}
    ${ms.length ? '' : '<div class="hint u-m0">A lista aparece depois da próxima sincronização.</div>'}</div>`; };
