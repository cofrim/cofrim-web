// Cofrim — Aba Explorar: tudo o que o app tem, numa lista por assunto (Organizar, Planejar, Acompanhar, Ferramentas), com as
// Configurações na engrenagem do topo e os temas especiais em destaque. Cada item só leva a uma tela que já existe:
// uma aba, uma parte dela (irBloco) ou uma janela. Depende de telas.js, telas-gastos.js e config.js.

// [grupo, [[ícone, título, ação, mostrar?]]]. Sem "mostrar", o item aparece sempre.
const EXPLORAR = () => [
  ['Organizar', [
    ['bank', 'Contas bancárias', "irBloco('resumo','contas')"],
    ['card', 'Cartões e faturas', "irBloco('gastos','faturas')"],
    ['tag', 'Categorias', 'openCats()'],
    ['receipt', 'Parceladas e financiamentos', "state.gsub='parc';go('gastos')"],
    ['wallet', 'Vales (refeição e alimentação)', "state.gsub='vale';go('gastos')"],
    ['calendar', 'Assinaturas', 'openSubs()']]],
  ['Planejar', [
    ['target', 'Orçamento do mês', "irBloco('gastos','orcamento')"],
    ['clock', 'Previsões de gastos', "irBloco('gastos','previsoes')"],
    ['trophy', 'Metas', "irBloco('invest','metas')"],
    ['trend', 'Investimentos', "go('invest')"],
    ['coins', 'Dívidas e quitação', 'openDebts()']]],
  ['Acompanhar', [
    ['heart', 'Saúde financeira', "go('gastos');abrirSaude()"],
    ['sparkle', 'Sugestões de gasto', 'openSugestoes()', sugNoMenu()],
    ['bell', 'Notificações', 'openCentral()'],
    ['star', 'Conquistas', 'openBadges()', db.prefs.fun],
    ['news', 'Notícias', "go('noticias')", !(typeof WEB_APP !== 'undefined' && WEB_APP)]]],
  ['Ferramentas', [
    ['chat', 'Assistente', "go('chat')"],
    ['upload', 'Importar extrato', 'openStatementHelp()'],
    ['history', 'Versões salvas na conta', 'openBackups()', canSync()],
    ['trash', 'Lixeira', 'openTrash()'],
    ['book', 'Guia do app', "openSettings('guia')"],
    ['send', 'Sugestões e bugs', "openSettings('sugestoes')"]]]];
function viewExplorar(){
  const n = Object.keys(SKINS).length;
  return `<h1><span class="tit">Explorar${nuvemBtn()}</span>
      <span class="acoes"><button class="iconbtn" data-onclick="openSettings('')" aria-label="Configurações">${I('gear', 24)}</button></span></h1>
    ${offlinePill()}
    <button class="explorarDestaque" data-onclick="openSettings('temas')"><b>${I('sparkle', 20)} Temas especiais <small>${n} temas</small></b>
      <span>Personagem, cenário animado e estilo de interface próprios</span>${I('chev', 22)}</button>
    ${EXPLORAR().map(([g, itens]) => `<h2>${g}</h2><div class="card explorarLista">${itens.filter(i => i[3] === undefined || i[3]).map(([ic, t, acao]) =>
      `<button data-onclick="${acao}"><span>${I(ic, 22)}</span>${t}${I('chev', 18)}</button>`).join('')}</div>`).join('')}`;
}
// Vai a uma aba e rola até um dos blocos dela (a âncora b-<aba>-<bloco> vem de blocks(), em aparencia.js). Bloco
// desligado em "Reorganizar esta tela": avisa onde ligar.
function irBloco(tab, k){
  if (tab === 'gastos') state.gsub = 'mes';
  go(tab);
  const el = document.getElementById(`b-${tab}-${k}`);
  if (el) el.scrollIntoView({block:'start'});
  else toast('Essa parte está escondida nesta tela. Ligue em ☰ › Reorganizar esta tela.');
}
