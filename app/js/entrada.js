// Cofrim — Modo demonstração, primeiro uso (login e bloqueio), nome, tutorial e backup em arquivo.
// Carregado pelo index.html, nesta ordem: dados.js, telas.js, assistente.js, formularios.js, divertido.js, config.js, sincronizacao.js, entrada.js, inicio.js.
// ---------- Modo demonstração ----------
// Para conhecer o app antes de entrar com a conta Google (botão na tela de entrada) ou, já logado, pelo Diagnóstico.
// Os dados fictícios ficam só na memória: demoOn (dados.js) bloqueia gravação, sincronização e escrita nativa. Os dados
// reais ficam guardados em demoReal (texto) e voltam exatamente iguais ao sair; fechar o app também os traz de volta,
// porque nada da demonstração é gravado.
let demoReal = null;
// ~3 meses de lançamentos com datas relativas ao mês atual, nomes genéricos (sem pessoas reais), passando por fixDb.
// Em inglês ou espanhol, a demonstração vem com as descrições e os nomes no idioma do app (os bancos ficam como estão).
function demoIdioma(o){
  for (const col of ['incomes', 'expenses', 'installments', 'goals', 'investments'])
    for (const r of o[col]) for (const k of ['desc', 'name', 'credor', 'assetName']) if (r[k] && !r.ticker) r[k] = trText(r[k]);
  for (const t of o.trash) t.rec.desc = trText(t.rec.desc);
  return o;
}
function demoDados(){
  let n = 0;
  const id = () => 'demo' + (++n), m = k => addMonths(curYM, k), hoje = Math.min(now.getDate(), 28);
  const dia = (k, d) => k === 0 ? Math.min(d, hoje) : d; // no mês atual, só até hoje
  const g = (desc, cat, value, k, d, mais = {}) => ({id:id(), desc, cat, value, start:m(k), day:dia(k, d), fixed:false, end:'', u:1, ...mais});
  const fixo = (desc, cat, value, due, mais = {}) => ({id:id(), desc, cat, value, start:m(-2), fixed:true, end:'', due, u:1, ...mais});
  const expenses = [
    fixo('Aluguel', 'moradia', 1450, 10, {bank:'Banco Verde', pay:'boleto'}), fixo('Internet', 'internet', 99.9, 15, {bank:'Banco Azul', pay:'credito'}),
    fixo('Streaming de filmes', 'contas', 39.9, 8, {bank:'Banco Azul', pay:'credito'}),
    fixo('Streaming de música', 'contas', 21.9, 20, {bank:'Banco Azul', pay:'credito'}),
    fixo('Academia', 'academia', 89.9, 5, {bank:'Banco Verde', pay:'debito'})];
  for (const k of [-2, -1, 0]) expenses.push(
    g('Mercado do Bairro', 'mercado', 412.35 + k * 18, k, 6, {bank:'Banco Azul', pay:'credito'}),
    g('Supermercado Central', 'mercado', 238.6 - k * 11, k, 20, {bank:'Banco Verde', pay:'debito'}),
    g('Padaria Central', 'alimentacao', 46.8, k, 3, {bank:'Banco Verde', pay:'pix'}),
    g('Combustível', 'combustivel', 180 + k * 12, k, 12, {bank:'Banco Azul', pay:'credito'}),
    g('Transporte por app', 'transporte', 64.5, k, 17, {bank:'Banco Azul', pay:'credito'}),
    g('Cinema', 'cinema', 58, k, 22, {bank:'Banco Azul', pay:'credito'}),
    g('Restaurante Sabor', 'restaurante', 96.4, k, 14, {bank:'Banco Azul', pay:'credito'}),
    g('Farmácia', 'farmacia', 37.9, k, 9, {bank:'Banco Verde', pay:'debito'}),
    g('Mercado do Bairro', 'mercado', 186.4 + k * 9, k, 11, {pay:'va', emp:'Pluxee'}),
    g('Almoço no centro', 'restaurante', 38.5, k, 8, {pay:'vr', emp:'Alelo'}));
  // Um lançamento com histórico de alterações (o que mudou ao editar).
  expenses[0].h = [{t:Date.now() - 20 * 864e5, d:'valor R$ 1.390,00 → R$ 1.450,00'}];
  return demoIdioma({
    incomes:[{id:id(), desc:'Salário', cat:'salario', value:5200, fixed:true, start:m(-2), end:'', bank:'Banco Verde', day:5, u:1},
      {id:id(), desc:'Trabalho extra', cat:'freelance', value:650, fixed:false, start:m(-1), end:'', bank:'Banco Verde', day:18, u:1},
      {id:id(), desc:'Crédito VA', cat:'va', value:800, fixed:true, start:m(-2), end:'', day:1, emp:'Pluxee', u:1},
      {id:id(), desc:'Crédito VR', cat:'vr', value:600, fixed:true, start:m(-2), end:'', day:1, emp:'Alelo', u:1}],
    expenses,
    installments:[{id:id(), desc:'Geladeira', cat:'casa', total:2400, n:10, paid:2, start:m(-2), bank:'Banco Azul', pay:'credito', u:1},
      {id:id(), tipo:'financiamento', desc:'Financiamento do carro', credor:'Financeira Exemplo', conta:'Banco Azul', cat:'transporte', total:28800,
        n:24, paid:12, start:m(-12), due:15, taxa:1.2, u:1}],
    accounts:[{id:id(), name:'Banco Verde', initial:2300, since:m(-2), u:1}, {id:id(), name:'Banco Azul', initial:800, since:m(-2), u:1}],
    goals:[{id:id(), name:'Reserva de emergência', target:15000, saved:6200, date:m(12), u:1},
      {id:id(), name:'Viagem de férias', target:6000, saved:1800, date:m(8), u:1}],
    investments:[{id:id(), name:'CDB Banco Verde', cat:'rendafixa', value:6200, index:'cdi', pct:105, monthly:300, broker:'Corretora Alfa', accYM:m(-2), u:1},
      {id:id(), name:'Tesouro Selic', cat:'tesouro', value:3500, index:'selic', pct:100, monthly:0, broker:'Corretora Beta', accYM:m(-2), u:1},
      {id:id(), name:'LCI Banco Azul', cat:'rendafixa', value:2000, index:'cdi', pct:92, monthly:0, broker:'Corretora Alfa', accYM:m(-2), u:1},
      {id:id(), cat:'acoes', ticker:'EXMP3', name:'EXMP3', assetName:'Empresa Exemplo', quote:27.4, quoteAt:Date.now(),
        lots:[{qty:40, paid:24.1, date:m(-6) + '-10'}, {qty:20, paid:26.3, date:m(-2) + '-05'}],
        index:'pre', pct:0, monthly:0, broker:'Corretora Beta', u:1}].map(v => (v.ticker && recalc(v), v)), // ação: quantidade, preço médio e valor
    quotesAt:Date.now(), // cotação fictícia: não procura na internet
    // Lixeira: um gasto excluído há dois dias (dá para restaurar).
    trash:[{col:'expenses', rec:{id:id(), desc:'Lanche duplicado', cat:'alimentacao', value:23.9, start:m(0), day:hoje, fixed:false, end:'', u:1},
      at:Date.now() - 2 * 864e5}],
    transfers:[{id:id(), from:'Banco Verde', to:'Banco Azul', value:500, month:m(-1), day:6, u:1}],
    previsoes:[{id:id(), cat:'combustivel', mes:m(0), value:300, dia:25, rep:true, ex:{}, u:1},
      {id:id(), cat:'farmacia', mes:m(0), value:80, dia:31, rep:false, ex:{}, u:1}],
    budgets:{mercado:700, restaurante:250, transporte:1500, cinema:100},
    cardClose:{'Banco Azul':25}, cardDue:{'Banco Azul':5}, cardAcc:{'Banco Azul':'Banco Azul'}, cardLimit:{'Banco Azul':4000}});
}
async function demoLigar(){
  if (demoOn) return;
  closeForm();
  clearTimeout(syncTimer);
  // Espera a sincronização ou a troca de conta em andamento (no máximo 15 s; se ainda estiverem rodando, elas desistem ao ver
  // demoOn, ver syncNow e trocarContaJa).
  for (let i = 0; i < 150 && (syncing || trocando); i++) await new Promise(r => setTimeout(r, 100));
  flushLater(); // o que estava esperando para ser gravado é dos dados reais: grava antes
  demoReal = JSON.stringify(db);
  demoOn = true;
  // Na demonstração, o Resumo completo: todos os blocos, para mostrar tudo o que o app oferece.
  loadDb({...demoDados(), prefs:{...db.prefs, name:'', greet:'', resumo:Object.keys(RESUMO).map(k => ({k, on:true})), resumoEnxuto:false, resumoAuto:[]}});
  rollover();
  chatLog.length = 0; state.tab = 'resumo'; state.month = curYM; state.year = +curYM.slice(0, 4);
  document.getElementById('gate').hidden = true;
  demoCentral(); // a central da demonstração (só na memória) já com alguns avisos
  demoFaixa(); render(); scrollTo(0, 0);
  openTour(0); // o tutorial, toda vez que entra na demonstração (dá para pular)
}
// Sugestões pelas notificações do banco na demonstração: só na memória, nada vai para o lado nativo.
let demoNotas = [];
function demoCentral(){
  const t = Date.now(), h = 3600e3;
  demoNotas = [{t:t - 2 * h, app:'br.exemplo.bancoazul.bank', nome:'Banco Azul', texto:'Compra aprovada — Compra de R$ 32,90 APROVADA em PADARIA CENTRAL'},
    {t:t - 26 * h, app:'br.exemplo.bancoverde.bank', nome:'Banco Verde', texto:'Pix recebido — Você recebeu um Pix de R$ 120,00'}];
  centralDemo = [];
  centralAdd('Sincronização efetuada', 'sucesso', t - 3 * h, {k:'sync'});
  centralAdd('Orçamento de Mercado: 93% do limite usado (R$ 650,95 de R$ 700,00).', 'aviso', t - 5 * h, {k:'orc', m:curYM});
  centralAdd('Cópia do dia salva na sua conta Google (Versões salvas).', 'sucesso', t - 28 * h, {k:'sync'});
  centralAdd('Nova sugestão de gasto pela notificação do Banco Azul.', 'info', t - 2 * h, {k:'resumo'});
}
// Volta aos dados reais, exatamente como estavam (sem gravar nada: eles nunca saíram do aparelho).
function demoSair(){
  if (!demoOn) return;
  const real = JSON.parse(demoReal);
  demoReal = null; demoOn = false; prevAvisosDemo = {}; centralDemo = []; demoNotas = []; // a central da demonstração some junto
  loadDb(real);
  chatLog.length = 0; state.tab = 'resumo'; state.month = curYM; state.year = +curYM.slice(0, 4);
  closeForm(); demoFaixa(); render(); scrollTo(0, 0);
  if (needGate()) return showGate();
  scheduleReminders(); updateWidget(); syncNow();
}
// "Entrar com Google" na faixa: os dados fictícios são descartados antes; nada deles vai para a conta.
function demoEntrar(){ demoSair(); if (needGate()) loginGoogle(); }
// Faixa fixa no topo enquanto durar a demonstração.
function demoFaixa(){
  const el = document.getElementById('demo');
  document.documentElement.classList.toggle('demo', demoOn);
  el.hidden = !demoOn;
  el.innerHTML = !demoOn ? '' : `<span>Modo demonstração – dados fictícios</span>${canSync() && sync.linked ? '<button data-onclick="demoSair()">Sair da demonstração</button>' : '<button data-onclick="demoEntrar()">Entrar com Google</button>'}`;
}

// ---------- Primeiro uso: login obrigatório e convite para ligar o bloqueio ----------
const needGate = () => demoOn ? false : canSync() ? !sync.linked : isPreview && !sync.demo;
function showGate(){
  document.getElementById('gateMsg').textContent = WEB_APP && !WEB_CLIENT_ID ? 'O login da versão web ainda não foi configurado.'
    : iosNoBrowser() ? 'Dica: para usar como app, toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".'
    : isPreview && !canSync() ? 'Prévia no PC: o login de verdade só acontece no celular.' : '';
  document.getElementById('gate').hidden = false;
}
async function loginGoogle(){
  const msg = document.getElementById('gateMsg');
  if (canSync()){
    msg.textContent = 'Entrando…';
    sync.on = true;
    await syncNow(true);
    if (!sync.linked){ msg.textContent = sync.err || 'Não foi possível entrar. Tente de novo.'; return; }
    // Conta diferente da última usada neste aparelho: boas-vindas, tutorial e novidades de novo.
    const conta = temNativo('conta') ? nativo('conta') : '';
    if (conta && conta !== sync.account) Object.assign(sync, {account:conta, tour:false, welcomed:false, forceNews:true, askedShare:false, famOk:false});
    // Quem nunca usou o app (conta sem nenhum dado): sem a tela de novidades, que só faz sentido para quem já usava.
    if (sync.forceNews && contaVazia()) semNovidades();
    saveSync();
  } else { sync.demo = true; saveSync(); }
  document.getElementById('gate').hidden = true;
  render();
  startSheets(); // termina no convite do bloqueio, depois das outras telas (nunca duas de uma vez)
}
// Boas-vindas: três passos no primeiro uso (app sem nenhum dado). Depois de salvar cada passo, volta a esta tela.
let welcomeOn = false;
const WELCOME = [
  ['briefcase', 'Cadastre seu salário', 'Ele entra sozinho em todos os meses.', () => db.incomes.some(x => x.fixed), () => openForm('incomes')],
  ['home', 'Cadastre um gasto fixo', 'Aluguel, internet, academia…', () => db.expenses.some(x => x.fixed),
    () => openForm('expenses', null, {vals:{fixed:'1', cat:'moradia'}, more:true})],
  ['bank', 'Cadastre uma conta do banco', 'Para acompanhar o saldo dela.', () => db.accounts.length > 0, () => openForm('accounts')]];
function maybeWelcome(){
  if (sync.welcomed || db.incomes.length || db.expenses.length || db.accounts.length || db.installments.length) return false;
  openWelcome();
  return true;
}
function openWelcome(){
  settingsOpen = false; F = null;
  const feitos = WELCOME.filter(s => s[3]()).length;
  showSheet(`<h3>${greeting() || 'Boas-vindas!'}</h3>
    <div class="semTopo hint">Três passos para o app começar a mostrar o seu mês. Dá para pular e fazer depois.</div>
    ${WELCOME.map(([ic, t, s, ok], i) => `<div class="item" data-onclick="welcomeGo(${i})">${tile(ic)}<div class="mid"><b>${i + 1}. ${t}</b><small>${s}</small></div><span class="${ok() ? 'in' : 'muted'}">${I(ok() ? 'checked' : 'unchecked', 26)}</span></div>`).join('')}
    <div class="item planConvite" data-onclick="abrirImportarPlanilha()">${tile('doc')}<div class="mid"><b>Tem uma planilha? Traga seus gastos</b>
      <small>Importe de uma planilha .xlsx, .ods ou .csv: o app entende o jeito dela e mostra tudo antes de importar.</small></div>${I('chev', 18)}</div>
    <div class="btns foot"><button class="btn primary" data-onclick="welcomeDone()">${feitos === WELCOME.length ? 'Concluir' : 'Pular por agora'}</button></div>`);
  welcomeOn = true;
}
function welcomeGo(i){ WELCOME[i][4](); welcomeOn = true; }
function welcomeDone(){ sync.welcomed = true; saveSync(); closeForm(); startSheets(); }

// ---------- Nome e tutorial ----------
// O nome fica nas preferências (db.prefs.name), que acompanham a conta pessoal; na conta compartilhada elas não são
// trocadas entre as pessoas, então cada uma vê o próprio nome. greet: 'o' bem-vindo, 'a' bem-vinda, 'e' boas-vindas.
let nameGreet = '';
function askName(daConfig){
  settingsOpen = false; F = null;
  const sugestao = db.prefs.name || (temNativo('nome') ? nativo('nome') : '');
  nameGreet = db.prefs.greet || 'e';
  // A saudação do topo sai do sexo informado: "Bem-vindo", "Bem-vinda" ou, sem informar, "Boas-vindas".
  const opcoes = () => [['o', 'Masculino'], ['a', 'Feminino'], ['e', 'Prefiro não dizer']].map(([k, t]) => `<button type="button" class="btn ${nameGreet === k ? 'primary' : ''}" style="padding:11px 4px" data-onclick="nameGreet='${k}';this.parentNode.querySelectorAll('.btn').forEach(b=>b.classList.toggle('primary',b===this))">${t}</button>`).join('');
  showSheet(`<h3>Como você quer ser chamado?</h3>
    <div class="semTopo hint">O nome aparece no topo do Resumo e nas mensagens do app. Fica só neste app: numa conta compartilhada, cada pessoa vê o próprio nome no seu celular.</div>
    <label for="nmIn">Seu nome</label>
    <input id="nmIn" type="text" maxlength="30" autocomplete="given-name" value="${esc(sugestao)}" data-onkeydown="if(event.key==='Enter')nameSave(${!!daConfig})">
    <label>Sexo</label>
    <div class="semTopo btns">${opcoes()}</div>
    <div class="err" id="nmErr"></div>
    <div class="btns foot">${daConfig ? `<button class="btn" data-onclick="openSettings('perfil')">Cancelar</button>` : ''}<button class="btn primary" data-onclick="nameSave(${!!daConfig})">${daConfig ? 'Salvar' : 'Continuar'}</button></div>`);
}
function nameSave(daConfig){
  const n = document.getElementById('nmIn').value.trim().replace(/\s+/g, ' ');
  if (!n) return document.getElementById('nmErr').textContent = 'Digite o seu nome (ou um apelido).';
  Object.assign(db.prefs, {name:n, greet:nameGreet}); db.cfgMod = Date.now();
  if (shared()) claimMine(); // na conta compartilhada, o que foi lançado sem nome passa a ser seu
  save(); render();
  if (daConfig) openSettings('perfil'); else { closeForm(); startSheets(); }
}
// Tutorial: boas-vindas e um passeio rápido pelas funções. Abre sozinho uma vez por conta; dá para rever no Perfil.
const TOUR = [
  ['piggy', () => `${greeting() || 'Boas-vindas!'}`,
    'Este é o Cofrim: seus ganhos, gastos, contas e investimentos num lugar só, salvos na sua conta Google. Veja em um minuto como usar.'],
  ['plus', 'Lançar é rápido',
    'Toque no + (ou nos atalhos do Resumo) e informe só o valor e a categoria; o resto fica em "Mais opções". Os gastos que você mais repete viram botões. '
    + 'Num salário, escolha em Mais opções o dia em que cai, como o 5º dia útil.'],
  ['chart', 'Resumo', 'Gastos do mês e do ano, contas a vencer, gastos por categoria e contas bancárias. Há muito mais (previsão, gráficos, metas, investimentos): toque em "Ver mais informações no resumo", no fim da tela, ou no menu (três barras), no topo › Reorganizar esta tela.'],
  ['receipt', 'Gastos do mês', 'Separados em Assinaturas, Fixos e anuais, Parceladas e Ocasionais, com busca e filtros. Deslize um lançamento para a esquerda para excluir; numa conta com vencimento, para a direita marca como paga. Na mesma aba ficam o orçamento, as previsões de gastos e a saúde financeira do mês.'],
  ['sparkle', 'Lançamento automático e extratos', 'No Android, as compras e os Pix avisados pelo banco viram sugestões de gasto no Resumo: um toque lança. Em Gastos › Importar extrato, escolha um ou vários arquivos OFX ou CSV do banco e confira antes de importar.'],
  ['card', 'Parcelas e financiamentos', 'Em Gastos › Parceladas, cadastre compras parceladas, financiamentos e empréstimos. Toque num item para ver o saldo devedor e todas as parcelas, pagar, abater ou exportar em PDF.'],
  ['trend', 'Investimentos e metas',
    'Cadastre aplicações, ações e metas. O app projeta quanto vão render com CDI, Selic e IPCA e mostra quanto falta para cada meta.'],
  ['chat', 'Assistente',
    'Pergunte "quanto gastei com mercado este mês?" ou escreva (ou fale) "gastei 30 no almoço" para lançar sem abrir formulário. '
    + 'Com um tema especial, quem responde é o personagem do tema, com as falas dele.'],
  ['calendar', 'Lembretes', 'Começam desligados neste aparelho. Ligue em Configurações › Lembretes (o Android pede a permissão de notificações) e escolha os tipos: contas a vencer, antes e no dia, parcelas de financiamentos e os avisos das previsões de gastos. Desligue a economia de bateria do app para os avisos chegarem na hora.'],
  ['people', 'Sua conta e a conta compartilhada',
    'Tudo sincroniza com a sua conta Google, com uma cópia por dia. Em Configurações > Conta compartilhada, dá para dividir os dados com outra pessoa.'],
  ['gear', 'Do seu jeito',
    'Mais de 160 temas especiais, cada um com personagem, cenário animado e estilo de interface próprios, além de cores, moeda e país, '
    + 'abas do menu, bloqueio com senha, widgets na tela inicial (com ou sem os valores) e o modo divertido, com mais de 100 conquistas. Tudo em Configurações.']];
let tourAt = null; // página aberta do tutorial: {i, daConfig}, para o deslizar (tourLado)
function openTour(i, daConfig){
  settingsOpen = false; F = null; tourAt = {i, daConfig:!!daConfig};
  const [ic, t, s] = TOUR[i], ult = i === TOUR.length - 1;
  showSheet(`<div class="tour"><span class="tourIco">${I(ic, 40)}</span>
    <h3>${typeof t === 'function' ? t() : t}</h3><p>${s}</p>
    <div class="dots">${TOUR.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="btns foot">${i ? `<button class="btn" data-onclick="openTour(${i - 1},${!!daConfig})">Voltar</button>` : `<button class="btn" data-onclick="tourDone(${!!daConfig})">Pular</button>`}
      <button class="btn primary" data-onclick="${ult ? `tourDone(${!!daConfig})` : `openTour(${i + 1},${!!daConfig})`}">${ult ? 'Começar' : 'Próximo'}</button></div>`);
}
// Deslizar no tutorial (detector único ALVOS_LADO, em assistente.js): para a esquerda vai para a próxima página e para a
// direita volta. A página acompanha o dedo; ao soltar, sai para o lado e a nova entra do outro, ou volta ao lugar. Na
// primeira não volta e na última não fecha (só o botão Começar): ali o arrasto só cede um pouco e volta.
const TOUR_ANIM = 220;
function tourLado(t){
  const box = tourAt && sheetOpen() && t.closest('#sheet') && document.querySelector('#sheet .tour');
  if (!box) return null;
  const {i, daConfig} = tourAt, pode = dx => dx < 0 ? i < TOUR.length - 1 : i > 0;
  const anim = document.documentElement.dataset.anim !== 'off', por = (x, ms) => {
    box.style.transition = ms && anim ? `transform ${ms}ms ease-out, opacity ${ms}ms ease-out` : 'none';
    box.style.transform = x ? `translateX(${x}px)` : ''; box.style.opacity = x ? String(Math.max(.3, 1 - Math.abs(x) / box.offsetWidth)) : ''; };
  return {
    move(dx){ por(pode(dx) ? dx : dx / 4, 0); }, // sem página para aquele lado: o arrasto só cede um pouco
    fim(dx, valeu){
      if (!valeu || !pode(dx)) return por(0, TOUR_ANIM);
      const lado = dx < 0 ? -1 : 1;
      por(lado * box.offsetWidth, TOUR_ANIM);
      setTimeout(() => {
        if (!tourAt || tourAt.i !== i) return; // o tutorial já mudou (botão) ou fechou
        openTour(i - lado, daConfig);
        const nova = document.querySelector('#sheet .tour');
        if (!nova || !anim) return;
        nova.style.transition = 'none'; nova.style.transform = `translateX(${-lado * 40}px)`; nova.style.opacity = '0';
        void nova.offsetWidth;
        nova.style.transition = `transform ${TOUR_ANIM}ms ease-out, opacity ${TOUR_ANIM}ms ease-out`; nova.style.transform = ''; nova.style.opacity = '';
      }, anim ? TOUR_ANIM : 0);
    }};
}
ALVOS_LADO.push(tourLado);
function tourDone(daConfig){
  tourAt = null;
  if (demoOn) return closeForm(); // na demonstração não marca o tutorial como visto na conta real
  sync.tour = true; saveSync();
  if (daConfig) openSettings('perfil'); else { closeForm(); startSheets(); }
}
// Novidades: mostradas uma vez quando o app abre numa versão diferente da última usada neste aparelho.
const VER_KEY = 'financas-versao';
// Última versão publicada antes de a versão vista ir também para os dados da conta (db.verVista): quem reinstala vindo
// dela ou de antes não tem registro em lugar nenhum e vê as novidades a partir daqui.
const NOV_SEM_REGISTRO = '1.66';
// Atualização automática (só no APK; ver Updater no lado nativo). tipo: 'web' = telas novas baixadas, entram na próxima
// abertura; 'apk' = é preciso instalar um APK novo (mudou a parte nativa); 'nada' e 'erro' = resposta à busca manual.
// Um aviso de cada vez: se outra tela estiver aberta (novidades, tutorial, login, bloqueio), o aviso de versão nova
// espera ela fechar (updPend/updFlush) em vez de aparecer por cima. Com um formulário aberto, só um recado curto.
// updManual = a pessoa tocou em "Procurar atualizações": aí a resposta aparece sempre, mesmo que seja "já está em dia".
let updManual = false, updPend = null;
function procurarAtualizacao(){
  if (!(temNativo('atualizar'))) return webProcurar();
  updManual = true; toast('Procurando atualização…'); nativo('atualizar');
}
function onAtualizacao(tipo, versao, url, novas){
  const manual = updManual; updManual = false;
  if (tipo === 'nada') return tell(`Você já está na versão mais recente (${APP_VERSION}).`);
  if (tipo === 'erro') return avisoErro('atualizacao');
  if (tipo !== 'web' && tipo !== 'apk') return;
  // A procura roda a cada abertura (e na volta depois de 30 min fora); "Depois" vale só até a próxima, sem guardar nada.
  if (tipo === 'web' && !manual && F) return toast(`Versão ${versao} baixada. Ela entra na próxima vez que você abrir o app.`);
  updPend = {versao, novas, url:tipo === 'apk' ? url : ''};
  updFlush(manual);
}
const updOcupado = () => sheetOpen() || ['gate', 'lockAsk'].some(id => !document.getElementById(id).hidden) || !!document.getElementById('abre');
// Mostra o aviso pendente quando a tela estiver livre (agora = pedido pela pessoa: troca a tela das Configurações).
function updFlush(agora){
  clearTimeout(updFlush.t);
  if (!updPend) return;
  if (agora !== true && updOcupado()){ updFlush.t = setTimeout(updFlush, 1200); return; }
  const u = updPend; updPend = null;
  openUpdate(u.versao, u.novas, u.url);
}
// Versão web, sozinha: ao abrir e na volta depois de 30 min fora, confere em segundo plano a versão publicada (um arquivo
// pequeno, sem guardar no cache); se for mais nova, mostra o mesmo aviso do APK, com "Atualizar agora" (recarrega e o
// service worker busca os arquivos novos). Sem internet ou sem novidade, nada aparece.
async function webVerificar(){
  if (!WEB_APP || window.TESTE) return;
  try {
    const j = await (await fetch('https://raw.githubusercontent.com/cofrim/cofrim-updater/main/versao.json?t=' + Date.now(), {cache:'no-store'})).json();
    if (verNum(j.versao) > verNum(APP_VERSION)) onAtualizacao('web', j.versao, '', Array.isArray(j.novidades) ? j.novidades : []);
  } catch(e){}
}
// Versão web: confere a versão publicada; se for mais nova, recarrega (o app busca os arquivos novos na rede).
async function webProcurar(){
  try {
    const j = await comCarga('Procurando atualização…',
      async () => (await fetch('https://raw.githubusercontent.com/cofrim/cofrim-updater/main/versao.json?t=' + Date.now(), {cache:'no-store'})).json());
    if (verNum(j.versao) <= verNum(APP_VERSION)) return tell(`Você já está na versão mais recente (${APP_VERSION}).`);
    if (await ask(`Saiu a versão ${j.versao}. Atualizar agora? Seus dados não mudam.`, 'Atualizar')) location.reload();
  } catch(e){ avisoErro('atualizacao'); }
}
const newsHtml = lista => lista.map(([t, s]) => `<div class="semCursor item"><span class="in">${I('sparkle', 22)}</span><div class="mid"><b class="quebra">${esc(t)}</b><small>${esc(s)}</small></div></div>`).join('');
// Aviso de versão nova, com a prévia do que vem nela. url vazio: as telas já foram baixadas e basta recarregar;
// com url: é preciso baixar e instalar o APK.
function openUpdate(versao, novas, url){
  settingsOpen = false; F = null;
  updUrl = url; updVer = versao;
  showSheet(`<h3>Nova versão ${esc(versao)} disponível</h3>
    <div class="semTopo hint">${url ? 'Esta atualização precisa ser instalada: o app baixa o arquivo e o Android pede sua confirmação. Seus dados continuam no aparelho e na sua conta.' : 'A atualização já foi baixada. Seus dados não mudam.'}</div>
    ${updNews(novas)}
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Depois</button><button class="btn primary" data-onclick="updateNow()">${url ? 'Baixar e instalar' : 'Atualizar agora'}</button></div>`);
}
let updUrl = '', updVer = '';
// Prévia das novidades: cada item pode trazer a versão ([título, texto, versão]); mostra só as das versões que a
// pessoa ainda não tem, separadas por versão quando são várias.
function updNews(novas){
  if (!Array.isArray(novas)) return '';
  const faltam = novas.filter(n => !n[2] || verNum(n[2]) > verNum(APP_VERSION)), vs = [...new Set(faltam.map(n => n[2] || ''))];
  if (!faltam.length) return '';
  return vs.length < 2 ? `<label>O que vem nesta versão</label>${newsHtml(faltam)}` : vs.map(v => `<label>Versão ${esc(v)}</label>${newsHtml(faltam.filter(n => (n[2] || '') === v))}`).join('');
}
function updateNow(){
  closeForm();
  if (updUrl) return temNativo('instalarApk') ? nativo('instalarApk', updUrl) : nativo('abrir', updUrl);
  try { localStorage.setItem(VER_KEY, updVer); } catch(e){} // a prévia já mostrou as novidades: não repete ao recarregar
  if (temNativo('recarregar')) nativo('recarregar'); else location.reload(); // na web, o service worker busca os arquivos novos
}
// Andamento do APK novo baixado pelo próprio app (Android.instalarApk): baixando, permissao (a pessoa precisa liberar
// "instalar apps desconhecidos" na tela que abriu), pronto (abriu a instalação do Android) ou erro.
let apkCarga = null;
function onApkEstado(e){
  if (apkCarga){ apkCarga(); apkCarga = null; }
  if (e === 'baixando') apkCarga = cargaOn('Baixando a atualização…');
  else if (e === 'permissao') tell('Para instalar, o Android pede uma permissão: na tela que abriu, ligue "Permitir desta fonte" para o Cofrim e volte ao app.');
  else if (e === 'erro') ask('Não foi possível baixar a atualização agora. Quer baixar pelo navegador?',
    'Abrir no navegador').then(sim => { if (sim) nativo('abrir', updUrl); });
}
// Conta sem nada lançado nem versão vista: é a primeira vez da pessoa no app.
const contaVazia = () => !db.verVista && COLS.every(c => !db[c].length);
// Marca a versão atual como vista, sem mostrar as novidades (primeira entrada de quem nunca usou o app).
function semNovidades(){
  sync.forceNews = false; saveSync();
  try { localStorage.setItem(VER_KEY, APP_VERSION); } catch(e){}
  if (db.verVista !== APP_VERSION && !demoOn){ db.verVista = APP_VERSION; save(); }
}
// Número de uma versão, para comparar ("1.9" < "1.40").
const verNum = v => String(v).split('.').reduce((a, n) => a * 1000 + (+n || 0), 0);
// sempre = aberta pelas Configurações; sync.forceNews = conta nova neste aparelho (mostra mesmo sem versão nova).
function maybeNews(sempre){
  let last = null;
  try { last = localStorage.getItem(VER_KEY); localStorage.setItem(VER_KEY, APP_VERSION); } catch(e){}
  // Reinstalação ou celular novo: este aparelho não sabe a versão anterior, mas os dados da conta (que voltam do Drive)
  // guardam a última que a pessoa viu. Sem esse registro e com dados, ela vem da 1.66 ou de antes.
  if (!last) last = db.verVista || (db.expenses.length || db.incomes.length ? NOV_SEM_REGISTRO : null);
  if (db.verVista !== APP_VERSION && !demoOn){ db.verVista = APP_VERSION; save(); }
  if (!sempre && !sync.forceNews && (last === APP_VERSION || (!last && !db.expenses.length && !db.incomes.length))) return false;
  if (!sempre && last && last !== APP_VERSION) centralAdd(`Cofrim atualizado para a versão ${APP_VERSION}.`, 'sucesso', 0, {k:'novidades'});
  if (sync.forceNews){ sync.forceNews = false; saveSync(); }
  settingsOpen = false; F = null;
  // Só o que é novo para esta pessoa: as versões depois da última que ela usou (numa conta nova ou pelas
  // Configurações, só a versão atual).
  const desde = !sempre && last && verNum(last) < verNum(APP_VERSION) ? verNum(last) : verNum(APP_VERSION) - 1;
  const novas = Object.entries(NOVIDADES).filter(([v]) => verNum(v) > desde && verNum(v) <= verNum(APP_VERSION)).sort((a, b) => verNum(b[0]) - verNum(a[0]));
  showSheet(`<h3>Novidades da versão ${APP_VERSION}</h3>
    ${novas.length ? novas.map(([v, lista]) => (novas.length > 1 ? `<label>Versão ${v}</label>` : '') + newsHtml(lista)).join('') : '<div class="semTopo hint">Correções e pequenas melhorias.</div>'}
    <div class="btns foot"><button class="btn primary" data-onclick="${sempre ? "openSettings('perfil')" : 'closeForm();askLock()'}">Entendi</button></div>`);
  return true;
}
// Folhas que abrem sozinhas ao iniciar, uma depois da outra: nome, tutorial (uma vez por conta), primeiros passos
// (app vazio) e novidades (versão nova ou conta nova).
function startSheets(){
  if (window.TESTE) return;
  if (canSync() && !sync.askedShare && !sync.shared) return askShare();
  if (!db.prefs.name) return askName();
  if (!sync.tour) return openTour(0);
  if (!maybeWelcome() && !maybeNews() && !avisoLembretes()) askLock();
}
// Mostrado uma vez, depois do login: convida a ligar o bloqueio por senha/biometria.
function askLock(){
  const N = nativeOpts();
  if (sync.lockAsked || !N || N.bloqueio()) return;
  document.getElementById('lockAsk').hidden = false;
}
function answerLock(on){
  document.getElementById('lockAsk').hidden = true;
  sync.lockAsked = true; saveSync();
  if (on) nativeOpts().setBloqueio(true);
}

// ---------- Backup em arquivo ----------
// Arquivo JSON legível (indentado): cofrim-backup-AAAA-MM-DD.json. "Salvar no aparelho" baixa o arquivo; "Salvar cópia no
// meu Google Drive" grava numa pasta "Cofrim" visível no Drive, criada pelo app com a permissão drive.file (só os
// arquivos que o próprio app cria; nada do resto do Drive), pedida no primeiro toque.
const backupArquivo = () => `cofrim-backup-${dayStr(Date.now())}.json`;
function exportData(){
  // No APK, o salvamento do arquivo é feito pelo lado nativo (MainActivity).
  if (temNativo('exportar')) return nativo('exportar', JSON.stringify(db, null, 2), backupArquivo());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], {type:'application/json'}));
  a.download = backupArquivo(); a.click();
}
const MSG_COPIA = 'Para salvar a cópia, o app precisa da permissão de criar arquivos no seu Google Drive (ele só vê os arquivos que ele mesmo cria). Toque de novo em "Salvar cópia no meu Google Drive" e deixe a caixa marcada.';
async function salvarCopiaDrive(){
  if (demoBloqueia()) return;
  if (!(canSync() && sync.on)) return tell('Entre com a sua conta Google para salvar uma cópia no Drive.');
  const nome = backupArquivo(), PASTA = 'application/vnd.google-apps.folder';
  const lista = async q => JSON.parse(ok(await arq('GET',
    `${DRIVE}/drive/v3/files?spaces=drive&q=${encodeURIComponent(q + ' and trashed=false')}&fields=files(id)`)).text).files;
  try {
    await comCarga('Salvando a cópia no seu Google Drive…', async () => {
      let pasta = (await lista(`name='Cofrim' and mimeType='${PASTA}'`))[0];
      if (!pasta) pasta = JSON.parse(ok(await arq('POST', `${DRIVE}/drive/v3/files?fields=id`, JSON.stringify({name:'Cofrim', mimeType:PASTA}),
        'application/json')).text);
      const f = (await lista(`name='${nome}' and '${pasta.id}' in parents`))[0], json = JSON.stringify(db, null, 2), b = 'cofrim-boundary';
      if (f) ok(await arq('PATCH', `${DRIVE}/upload/drive/v3/files/${f.id}?uploadType=media`, json, 'application/json'));
      else ok(await arq('POST', `${DRIVE}/upload/drive/v3/files?uploadType=multipart`,
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:nome, parents:[pasta.id]})}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`, 'multipart/related; boundary=' + b));
    });
    tell(`Cópia salva no seu Google Drive, na pasta Cofrim, com o nome ${nome}.`);
  } catch(e){
    if (e.status === -6) return demoBloqueia();
    if (e.status !== 0 && e.status !== -1) logErr('salvar cópia no Drive', e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e);
    tell(semPermissao(e) ? MSG_COPIA : e.status === 0 ? 'Sem conexão com a internet. Tente de novo quando a conexão voltar.'
      : e.status === -1 ? 'É preciso entrar na conta Google.' : 'Não foi possível salvar a cópia no Google Drive. Tente de novo.');
  }
}
// Importar: valida (fixDb), mostra um resumo e pergunta se substitui os dados atuais ou junta com eles. Antes, guarda
// os dados atuais (neste aparelho, para "Desfazer a importação", e em "Versões salvas" quando há conta).
let importando = null;
const mesAbrev = ym => MESES[+ym.slice(5) - 1].slice(0, 3) + '/' + ym.slice(0, 4);
function importResumo(d){
  const n = nLanc(d), meses = ['incomes', 'expenses', 'installments'].flatMap(c => d[c].map(r => r.start)).filter(m => /^\d{4}-\d\d$/.test(m || '')).sort();
  return `Este arquivo tem ${n.toLocaleString('pt-BR')} ${n === 1 ? 'lançamento' : 'lançamentos'}` + (meses.length ? (meses[0] === meses[meses.length - 1] ? `, de ${mesAbrev(meses[0])}` : `, de ${mesAbrev(meses[0])} a ${mesAbrev(meses[meses.length - 1])}`) : '') + '.';
}
function importPerguntar(d){
  importando = d;
  settingsOpen = false; F = null;
  showSheet(`<h3>${I('upload', 22)} Importar backup</h3>
    <div class="semTopo hint">${esc(importResumo(d))} Substituir os dados atuais ou juntar com eles?</div>
    <div class="hint"><b>Substituir</b>: os dados passam a ser exatamente os do arquivo, em todos os aparelhos. <b>Juntar</b>: entra o que só está no arquivo; num lançamento que está nos dois, fica a alteração mais recente. Antes, o app guarda uma cópia dos dados atuais para dar para desfazer.</div>
    <div class="btns"><button class="btn danger" data-onclick="importarComo('substituir')">Substituir</button><button class="btn primary" data-onclick="importarComo('juntar')">Juntar</button></div>
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button></div>`);
}
async function importarComo(modo){
  const d = importando; importando = null;
  if (!d || demoBloqueia()) return;
  closeForm();
  keepBefore('importar');
  if (canSync() && sync.on) try { await copiaAntes('importar'); } catch(e){ logErr('cópia antes de importar',
    e.status ? e.status + ' ' + String(e.text).slice(0, 300) : e); } // sem internet, fica a cópia deste aparelho
  // Substituir, como restaurar uma versão salva: o que veio do arquivo fica como "alterado agora" e o que existe hoje mas
  // não está nele é marcado como excluído. Sem isso, a próxima sincronização trazia de volta da conta tudo o que não
  // estava no arquivo, e a troca não valia nos outros aparelhos.
  if (modo === 'substituir') applySnapshot(d);
  else { loadDb(mergeDb(db, d)); rollover(); save(); closeForm(); render(); }
  toast(modo === 'substituir' ? 'Dados substituídos pelos do arquivo.' : 'Arquivo juntado aos seus dados.', {dest:{k:'cfg', s:'dados'}});
}
function importTexto(texto){
  try {
    const d = JSON.parse(texto);
    if (!Array.isArray(d.incomes) || !Array.isArray(d.expenses)) throw 0;
    if (newerDb(d)) return tell('Este backup foi feito por uma versão mais nova do app.\n\nO que fazer:\n• Atualize o app em Configurações › Procurar atualizações e importe de novo');
    importPerguntar(fixDb(d));
  } catch(e){ if (e !== 0) logErr('importar backup', e); avisoErro('arquivo', 'Arquivo de backup inválido: não é um backup do Cofrim ou está incompleto.'); }
}
function importData(input){
  if (demoOn){ input.value = ''; return demoBloqueia(); }
  const file = input.files && input.files[0]; if (!file) return;
  if (file.size > DADOS_MAX){ input.value = ''; return tell(LER_ERRO + '\n\nO arquivo é grande demais para ser um backup do Cofrim.'); }
  const r = new FileReader();
  r.onerror = () => { logErr('importar backup', 'leitura: ' + ((r.error && r.error.message) || r.error)); avisoErro('arquivo'); input.value = ''; };
  r.onload = () => { importTexto(r.result); input.value = ''; };
  try { r.readAsText(file); } catch(e){ logErr('importar backup', e); avisoErro('arquivo'); input.value = ''; }
}
