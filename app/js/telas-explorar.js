// Cofrim — Aba Explorar: tudo o que o app tem, numa lista por assunto (Organizar, Planejar, Acompanhar, Ferramentas), com as
// Configurações na engrenagem do topo e os temas especiais em destaque. Cada item só leva a uma tela que já existe:
// uma aba, uma parte dela (irBloco) ou uma janela. Depende de telas.js, telas-gastos.js e config.js.

// [grupo, [[ícone, título, ação, mostrar?, palavras da busca?, versão?]]]. Sem "mostrar", o item aparece sempre; com a
// versão em que entrou, ganha a etiqueta "Novo" até o primeiro toque nesta versão (prefs.explorarVistos).
const EXPLORAR = () => [
  ['Organizar', [
    ['bank', 'Contas bancárias', "explorarBloco('gastos','contas','Contas bancárias')", undefined, 'saldo banco carteira dinheiro'],
    ['card', 'Cartões e faturas', "explorarBloco('gastos','faturas','Cartões e faturas')", undefined, 'credito fechamento vencimento limite'],
    ['tag', 'Categorias', 'openCats()', undefined, 'subcategorias icone cor'],
    ['receipt', 'Parceladas e financiamentos', "state.gsub='parc';go('gastos')", undefined, 'parcela emprestimo divida carne'],
    ['wallet', 'Vales (refeição e alimentação)', "state.gsub='vale';go('gastos')", undefined, 'va vr beneficio'],
    ['calendar', 'Assinaturas e contas fixas', 'openSubs()', undefined, 'netflix spotify streaming mensalidade conta fixa seguro faculdade celular']]],
  ['Planejar', [
    ['target', 'Orçamento do mês', "explorarBloco('gastos','orcamento','Orçamento do mês')", undefined, 'limite teto categoria'],
    ['clock', 'Previsões de gastos', "explorarBloco('gastos','previsoes','Previsões de gastos')", undefined, 'futuro proximos meses'],
    ['trophy', 'Metas', "explorarBloco('invest','metas','Metas')", undefined, 'objetivo viagem reserva emergencia'],
    ['coins', 'Dívidas e quitação', 'openDebts()', undefined, 'quitar juros pagar']]],
  ['Acompanhar', [
    ['heart', 'Saúde financeira', "go('gastos');abrirSaude()", undefined, 'nota pontuacao'],
    ['star', 'Conquistas', 'openBadges()', db.prefs.fun, 'medalhas modo divertido']]],
  ['Ferramentas', [
    ['upload', 'Importar extrato', 'openStatementHelp()', undefined, 'ofx csv pdf banco arquivo'],
    ['doc', 'Importar planilha', 'abrirImportarPlanilha()', undefined, 'excel xlsx ods csv planilha migrar google sheets libreoffice', '2.60'],
    ['camera', 'Lançar pelo comprovante', 'lerComprovante()', temNativo('lerTexto'), 'foto nota cupom recibo ler', '2.60'],
    ['download', 'Relatório e planilha', 'explorarRelatorio()', undefined, 'pdf imprimir excel xlsx exportar', '2.50'],
    ['trash', 'Lixeira', 'openTrash()', undefined, 'apagados recuperar desfazer'],
    ['book', 'Guia do app', "openSettings('guia')", undefined, 'ajuda como usar tutorial'],
    ['send', 'Sugestões e bugs', "openSettings('sugestoes')", undefined, 'erro problema ideia contato email']]],
  ['Ajustes', [
    ['sun', 'Aparência', "openSettings('aparencia')", undefined, 'escuro claro cor fonte letra animacoes', '2.50'],
    ['globe', 'Idioma, moeda e país', "openSettings('regiao')", undefined, 'ingles espanhol dolar euro lingua', '2.50'],
    ['lock', 'Ícone e bloqueio', "openSettings('seguranca')", !!nativeOpts(), 'senha digital biometria privacidade', '2.50'],
    ['calendar', 'Lembretes', "openSettings('lembretes')", !!nativeOpts(), 'avisar vencimento conta parcela', '2.50'],
    ['chart', 'Widgets', "openSettings('widgets')", temNativo('widget'), 'tela inicial quadros', '2.50'],
    ['people', 'Conta compartilhada', "openSettings('compart')", canSync(), 'casal dupla familia juntos', '2.50'],
    ['box', 'Backup e exportar dados', "openSettings('dados')", undefined, 'copia salvar arquivo restaurar json', '2.50']]]];
const explorarItens = () => EXPLORAR().flatMap(([g, itens]) => itens.filter(i => i[3] === undefined || i[3])
  .map(([ic, t, acao, mostrar, palavras = '', v = '']) => [ic, t, acao, mostrar, palavras, v, g]));
// "Novo": item da versão em uso (2.50 até a 2.59) que a pessoa ainda não abriu.
const explorarNovo = (t, v) => !!v && Number(v) >= Math.floor(Number(APP_VERSION) * 10) / 10 && !(db.prefs.explorarVistos || []).includes(t);
const explorarBotao = ([ic, t, acao, , , v]) => `<button data-onclick="explorarVisto('${t}');${acao};explorarArmar()"><span>${I(ic, 22)}</span>${t}`
  + `${explorarNovo(t, v) ? '<em class="novo">Novo</em>' : ''}${I('chev', 18)}</button>`;
function viewExplorar(){
  const n = Object.keys(SKINS).length, itens = explorarItens();
  return `<h1><span class="tit">Explorar${nuvemBtn()}</span>
      <span class="acoes"><button class="iconbtn" data-onclick="openSettings('')" aria-label="Configurações">${I('gear', 24)}</button></span></h1>
    ${offlinePill()}
    <div class="search explorarBusca">${I('search')}<input id="eq" type="search" placeholder="O que você procura?" autocomplete="off"
      aria-label="Buscar no app" data-oninput="explorarBuscar(this.value)"></div>
    <div id="explorarRes" class="card explorarLista" hidden></div>
    <div id="explorarGrupos" class="explorarGrupos">
    <button class="explorarDestaque" data-onclick="openSettings('temas');explorarArmar()"><b>${I('sparkle', 20)} Temas especiais <small>${n} temas</small></b>
      <span>Personagem, cenário animado e estilo de interface próprios</span>${I('chev', 22)}</button>
    ${EXPLORAR().map(([g]) => [g, itens.filter(i => i[6] === g)]).filter(([, l]) => l.length).map(([g, l]) =>
      `<section><h2>${g}</h2><div class="card explorarLista">${l.map(explorarBotao).join('')}</div></section>`).join('')}</div>`;
}
// De onde a pessoa veio: um item da Explorar que abriu uma janela (raiz = a seção das Configurações, ou 'janela' para as
// outras) ou que levou a outra aba (aba). O "Voltar" dessa janela fecha e fica na Explorar (antes ia para as
// Configurações, de onde ela também abre), e o voltar do Android, na aba, volta à Explorar. Trocar de aba ou fechar a
// janela esquece a origem.
let explorarOrigem = null;
function explorarArmar(){
  explorarOrigem = sheetOpen() ? {raiz:settingsOpen ? setSec : 'janela'} : state.tab !== 'explorar' ? {aba:state.tab} : null;
}
const explorarVoltaAqui = sec => !!explorarOrigem && explorarOrigem.raiz !== undefined && sec !== undefined
  && (explorarOrigem.raiz === 'janela' || sec === '');
function explorarVisto(t){
  const p = db.prefs, v = p.explorarVistos || [];
  if (!v.includes(t)){ p.explorarVistos = [...v, t]; save(); }
}
// Busca: os itens da Explorar (título, grupo e palavras parecidas) e as funções do guia (nome e onde fica); um toque
// num resultado do guia abre o guia já filtrado nele. Sem acento e sem diferença de maiúsculas.
function explorarBuscar(q){
  const res = document.getElementById('explorarRes'), grupos = document.getElementById('explorarGrupos');
  const t = plain(q.trim());
  res.hidden = !t; grupos.hidden = !!t;
  if (!t) return;
  const tem = s => plain(s).includes(t);
  const itens = explorarItens().filter(([, nome, , , palavras, , g]) => tem(`${nome} ${g} ${palavras}`));
  const guia = GUIA.flatMap(([, l], i) => l.map(([nome, onde, como], j) => ({i, j, nome, onde, peso:tem(nome) ? 0 : tem(onde) ? 1 : tem(como) ? 2 : 3})))
    .filter(x => x.peso < 3).sort((a, b) => a.peso - b.peso).slice(0, 8);
  res.innerHTML = itens.map(explorarBotao).join('') + guia.map(x => `<button data-onclick="explorarGuia(${x.i},${x.j})"><span>${I('book', 22)}</span>
    <span class="txt">${esc(x.nome)}<small>No guia · ${esc(x.onde)}</small></span>${I('chev', 18)}</button>`).join('')
    || `<div class="hint">Nada encontrado para “${esc(q.trim())}”. Tente outra palavra ou pergunte ao
      <button class="explorarLink" data-onclick="go('chat')">assistente</button>.</div>`;
}
function explorarGuia(i, j){
  openSettings('guia');
  const q = document.getElementById('gq'), nome = GUIA[i][1][j][0];
  if (q){ q.value = nome; guideFilter(nome); }
  explorarArmar();
}
// Parte de uma aba numa janela (Contas, Faturas, Orçamento…): monta a aba fora da tela e pega só o bloco, da âncora
// b-<aba>-<bloco> até a próxima, com os mesmos botões. Bloco desligado em "Reorganizar esta tela" aparece do mesmo jeito.
// O título da parte vira o da janela (os botões do título ficam). Um formulário aberto daqui, ao fechar, volta à janela
// (explorarReabre); o que muda os dados redesenha a janela junto com a tela (render).
let explorarJanela = null; // [aba, bloco, título] da janela aberta
function explorarBloco(tab, k, titulo){
  const antes = {tab:state.tab, gsub:state.gsub}, b = layoutOf(tab).find(x => x.k === k), on = b && b.on, tmp = document.createElement('div');
  if (b) b.on = true;
  state.tab = tab; if (tab === 'gastos') state.gsub = 'mes';
  try { tmp.innerHTML = VIEWS[tab](); } finally { Object.assign(state, antes); if (b) b.on = on; }
  const a = tmp.querySelector(`#b-${tab}-${k}`), corpo = document.createElement('div');
  for (let n = a && a.nextSibling; n && !(n.classList && n.classList.contains('ancora'));){ const x = n.nextSibling; corpo.appendChild(n); n = x; }
  const h = corpo.firstElementChild && corpo.firstElementChild.tagName === 'H2' ? corpo.firstElementChild : null;
  if (h) [...h.childNodes].filter(n => n.nodeType === 3).forEach(n => n.remove()); // fica só com os botões do título
  explorarJanela = [tab, k, titulo];
  showSheet(`<h3>${titulo}</h3>${tab === 'gastos' ? `<div class="semTopo hint">${monthName(state.month)}</div>` : ''}
    <div class="blocoJanela">${corpo.innerHTML.trim() ? corpo.innerHTML : '<div class="hint">Nada para mostrar aqui ainda.</div>'}</div>
    <div class="btns foot"><button class="btn" data-onclick="closeForm();irBloco('${tab}','${k}');explorarArmar()">Ver na aba ${TABS[tab][1]}</button>
    <button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Relatório do mês e planilha do ano (os mesmos botões do fim da aba Gastos, sem os outros de lá).
function explorarRelatorio(){
  const m = state.month;
  showSheet(`<h3>Relatório e planilha</h3><div class="semTopo hint">O relatório é de ${monthName(m)}; a planilha, do ano de ${m.slice(0, 4)}.</div>
    <div class="btns"><button class="btn" data-onclick="shown(printReport)">${I('doc')}Relatório (PDF)</button></div>
    <div class="btns"><button class="btn" data-onclick="shown(exportPlanilha)">${I('download')}Exportar planilha de ${m.slice(0, 4)} (Excel)</button></div>
    <div class="btns"><button class="btn" data-onclick="openSheetLink()">${I('doc')}${sheetId() ? 'Planilha do Google (ligada)'
      : 'Ligar uma planilha do Google'}</button></div>
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Depois de um formulário aberto pela janela fechar (salvou ou desistiu): a janela volta, se a pessoa ficou na Explorar.
function explorarReabre(){
  if (explorarJanela && !sheetOpen() && state.tab === 'explorar') explorarBloco(...explorarJanela);
}
// Vai a uma aba e rola até um dos blocos dela (a âncora b-<aba>-<bloco> vem de blocks(), em aparencia.js). Bloco
// desligado em "Reorganizar esta tela": avisa onde ligar.
function irBloco(tab, k){
  if (tab === 'gastos') state.gsub = 'mes';
  go(tab);
  const el = document.getElementById(`b-${tab}-${k}`);
  if (el){
    el.scrollIntoView({block:'start'});
    // A parte de destino ganha um contorno por um instante (também com as animações desligadas): mostra onde o item
    // levou. É o primeiro cartão depois da âncora (antes vem o título da parte), ou o aviso da parte ainda vazia.
    let b = el.nextElementSibling;
    while (b && !b.matches('.card, .hero, .hint, .vazioParte, .ancora')) b = b.nextElementSibling;
    if (b && !b.matches('.ancora')){ b.classList.add('realce'); setTimeout(() => b.classList.remove('realce'), 1600); }
  }
  else toast('Essa parte está escondida nesta tela. Ligue em ☰ › Reorganizar esta tela.');
}
