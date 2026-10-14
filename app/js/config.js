// Cofrim — Configurações (a folha com as categorias), tema ou cor do dia e o Diagnóstico.
// Carregado pelo index.html, nesta ordem: dados.js, telas.js, assistente.js, formularios.js, divertido.js, config.js, sincronizacao.js, entrada.js, inicio.js.
// ---------- Configurações ----------
// Ícone e bloqueio são funções do lado nativo (window.Android). Na prévia do PC (localhost) não há
// lado nativo: demoOpts só guarda as escolhas na memória para a tela poder ser vista; não tem efeito real.
const demoOpts = {
  lock:false, time:30, icon:'indigo', esconde:true,
  bloqueio(){ return this.lock; }, setBloqueio(v){ this.lock = v; },
  tempoBloqueio(){ return this.time; }, setTempoBloqueio(v){ this.time = v; },
  icone(){ return this.icon; }, setIcone(v){ this.icon = v; }
};
const isPreview = location.hostname === 'localhost';
function nativeOpts(){ return temNativo('setTempoBloqueio') ? Android : isPreview ? demoOpts : null; }
// Chamado pelo lado nativo depois de pedir a senha para desligar o bloqueio.
function onLockChanged(){ if (settingsShown()) openSettings(); }
// Configurações em categorias: a primeira tela mostra um botão por categoria; cada uma abre só as opções dela.
// setSec guarda a categoria aberta, para as opções que redesenham a tela (openSettings()) continuarem nela.
// Sem argumento e com as configurações fechadas, abre o menu de categorias.
let setSec = '';
const settingsShown = () => sheetOpen() && !!document.querySelector('#sheet .setGrid, #sheet .setHead');
function openSettings(sec){
  if (explorarVoltaAqui(sec)) return closeForm(); // "Voltar" de uma janela aberta pela Explorar
  if (sec !== undefined) setSec = sec; else if (!settingsShown()) setSec = '';
  const p = db.prefs, n = p.tabs.length;
  // Opções que só existem no APK (ícone, bloqueio). Number()/!! porque os valores vêm do lado nativo.
  const N = nativeOpts(), isApp = !!N, lockOn = isApp && !!N.bloqueio(), lockTime = isApp ? Number(N.tempoBloqueio()) : 0;
  const demo = N === demoOpts ? '<div class="semTopo hint warn">Prévia no PC: estas opções só funcionam no app instalado no celular.</div>' : '';
  const batLivre = temNativo('bateriaLivre') ? !!nativo('bateriaLivre') : null; // null: não dá para saber (prévia)
  const syncHtml = syncSection();
  F = null;
  // [chave, ícone, título, descrição, conteúdo ('' = categoria não existe neste aparelho)]
  const S = [
  ['perfil', 'person', 'Perfil', 'Nome, tutorial e versão', `
    <label>Seu nome</label>
    <div class="semTopo hint">${myName() ? `${greeting()} O nome aparece no topo do Resumo e nas mensagens do app.` : 'Ainda sem nome. Ele aparece no topo do Resumo e nas mensagens do app.'}${sync.shared ? ' Na conta compartilhada, cada pessoa vê o próprio nome no seu celular.' : ''}</div>
    <div class="btns"><button class="btn" data-onclick="askName(true)">${I('person')}${myName() ? 'Trocar o nome' : 'Informar o nome'}</button></div>
    <label>Ajuda</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openTour(0, true)">${I('book')}Ver o tutorial</button><button class="btn" data-onclick="maybeNews(true)">${I('sparkle')}Novidades da versão</button></div>
    ${typeof podeInstalar === 'function' && podeInstalar() ? `<label>Instalar o app</label>
    <div class="semTopo hint">Abre o Cofrim direto da tela inicial.</div>
    <div class="btns"><button class="btn primary" data-onclick="instalarApp()">${I('download')}Instalar o Cofrim</button></div>` : ''}
    ${temNativo('atualizar') ? `<label>Atualizações</label>
    <div class="semTopo hint">Versão ${APP_VERSION}. O app confere sozinho a cada abertura.</div>
    <div class="btns"><button class="btn" data-onclick="procurarAtualizacao()">${I('refresh')}Procurar atualização agora</button></div>` : ''}`],
  ['regiao', 'globe', 'Idioma e região', 'Idioma, moeda e país', `
    <label>Idioma</label>
    <div class="semTopo btns">${Object.entries(LANGS).map(([k, v]) => `<button class="btn ${lang() === k ? 'primary' : ''}" style="padding:11px 4px" data-onclick="setLang('${k}')">${v}</button>`).join('')}</div>
    <label>Moeda</label>
    <div class="semTopo btns"><button class="btn" data-onclick="escolherMoeda()">${esc(moedaNome(p.moeda || 'BRL'))}</button></div>
    <label>País</label>
    <div class="semTopo btns"><button class="btn" data-onclick="escolherPais()">${esc(paisNome(p.pais || 'BR'))}</button></div>
    <div class="hint">O país diz os feriados e o fim de semana no dia útil dos ganhos. Fora do Brasil, os feriados vêm da internet uma vez por ano.</div>`],
  ['aparencia', 'sun', 'Aparência', 'Tema, cores e animações', `
    <label>Claro ou escuro</label>
    <div class="semTopo btns">${Object.entries(MODES).map(([k,v]) => `<button class="btn ${p.mode === k ? 'primary' : ''}" data-onclick="setPref('mode','${k}')">${v}</button>`).join('')}</div>
    ${p.skin ? `<div class="hint">Com um tema especial claro, o modo escuro (ou o automático com o celular escuro) deixa o app
      escuro, com as cores do tema. Os temas escuros ficam sempre escuros.</div>` : ''}
    <label>Cor</label>
    <div class="swatches">${Object.entries(COLORS).map(([k,c]) => `<button class="sw ${p.color === k ? 'on' : ''}" style="background:linear-gradient(135deg,${c[1]},${c[2]})" data-onclick="setCor('${k}')" aria-label="${c[0]}" title="${c[0]}"></button>`).join('')}</div>
    ${sorteioBtn('cor', 'Cor aleatória todo dia')}
    ${p.skin ? '' : `<label>Fundo animado</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${(p.fundo !== false) === v ? 'primary' : ''}" data-onclick="setPref('fundo',${v})">${t}</button>`).join('')}</div>
    ${p.fundo !== false ? `<div class="swatches">${Object.entries(COLORS).map(([k,c]) => `<button class="sw ${fundoCorDe(p) === k ? 'on' : ''}" style="background:linear-gradient(135deg,${c[1]},${c[2]});border-radius:50%" data-onclick="setPref('fundoCor','${k}')" aria-label="Fundo ${c[0]}" title="${c[0]}"></button>`).join('')}</div>
    <div class="hint">${p.fundoCor && COLORS[p.fundoCor] ? '<a class="u-marca" href="#" data-onclick="setPref(\'fundoCor\',\'\');return false">Usar a cor do app</a>' : 'Segue a cor do app; toque numa cor para fixar.'}</div>
    <label>Intensidade do fundo</label>
    <div class="semTopo btns">${Object.entries(FUNDO_INT).map(([k, t]) => `<button class="btn ${fundoIntDe(p) === k ? 'primary' : ''}" data-onclick="setPref('fundoInt','${k}')">${t}</button>`).join('')}</div>` : ''}`}
    <label>Tamanho do texto</label>
    <div class="semTopo btns">${[[.9,'Pequeno'],[1,'Normal'],[1.12,'Grande'],[1.25,'Maior']].map(([v,t]) => `<button class="btn ${p.font === v ? 'primary' : ''}" style="padding:11px 4px" data-onclick="setPref('font',${v})">${t}</button>`).join('')}</div>
    ${temNativo('girar') ? `<label>Girar a tela com o celular</label>
    <div class="semTopo btns">${[[true,'Sim'],[false,'Não, sempre em pé']].map(([v,t]) => `<button class="btn ${!!nativo('girarLigado') === v ? 'primary' : ''}" data-onclick="nativo('girar', ${v});openSettings()">${t}</button>`).join('')}</div>` : ''}
    <label>Animações</label>
    <div class="semTopo btns g2">${[['auto','Automáticas'],['completo','Completas'],['leve','Leves'],['off','Desligadas']].map(([v,t]) => `<button class="btn
      ${(p.anim ? leveCfg().modo : 'off') === v ? 'primary' : ''}" data-onclick="setEfeitos('${v}')">${t}</button>`).join('')}</div>
    <div class="hint">Leves: o cenário continua, com menos coisas se mexendo, para ficar fluido num celular mais simples. Vale só para este aparelho.</div>
    ${p.anim && leveCfg().modo === 'auto' && efeitosLeves() ? '<div class="hint"><b>Neste celular, as animações estão leves.</b></div>' : ''}
    <label>Modo divertido</label>
    <div class="semTopo btns">${[[true, I('sparkle') + 'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${p.fun === v ? 'primary' : ''}" data-onclick="setPref('fun',${v})">${t}</button>`).join('')}</div>
    <div class="hint">Mascote, conquistas e recados bem-humorados.</div>
    <label>Tema especial</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openSettings('temas')">${I('sparkle')}${p.skin ? 'Em uso: ' + SKINS[p.skin][0] : 'Escolher um tema especial'}</button></div>
    <div class="hint">Com um tema especial, a Cor não vale: as cores são as do tema.</div>`],
  ['temas', 'sparkle', 'Temas especiais', `${Object.keys(SKINS).length} temas com mascote`, `
    <div class="semTopo hint">Um tema especial muda as cores do app inteiro, o mascote do modo divertido, a abertura e os widgets; os ícones das categorias ficam com a cor de cada uma.
      ${p.skin ? `<span>Em uso: <b>${SKINS[p.skin][0]}</b></span>` : '<span>Nenhum em uso.</span>'}</div>
    <div class="semTopo btns"><button class="btn ${p.skin ? '' : 'primary'}" data-onclick="setSkin('')">Sem tema especial</button></div>
    ${sorteioBtn('tema', 'Tema aleatório todo dia')}
    ${WEB_APP ? '<div class="hint">No iPhone, adicione de novo à Tela de Início para trocar o ícone.</div>' : ''}
    ${TEMA_CATS.map(([c, nome, ks]) => `<details class="grp" ${ks.includes(p.skin) || (!p.skin && c === 'estilos') ? 'open' : ''}><summary>${nome}<small>${ks.length}</small>${I('chev')}</summary>
      <div class="icoGrid t3">${ks.map(k => `<button class="${p.skin === k ? 'on' : ''}" data-onclick="setSkin('${k}')"><span class="temaM" style="background:linear-gradient(135deg,${SKINS[k][4]},${SKINS[k][5]})">${mascoteEm(k, 'ok', 0, 0, 46)}${temaMiniatura(k)}</span><small>${SKINS[k][0]}</small></button>`).join('')}</div></details>`).join('')}`],
  ['categorias', 'tag', 'Categorias', 'Criar, renomear, esconder e cores', `
    <label>Suas categorias</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openCats()">${I('tag')}Criar, renomear ou esconder</button></div>
    <div class="hint">Na hora de lançar também dá: "+ Nova categoria" no fim da lista e, segurando uma categoria, Editar e Excluir.</div>
    <label>Cor dos ícones</label>
    <div class="semTopo btns">${[[false,'Do tema'],[true,'Coloridos']].map(([v,t]) => `<button class="btn ${!!p.catColor === v ? 'primary' : ''}" data-onclick="setPref('catColor',${v})">${t}</button>`).join('')}</div>
    <div class="hint">Coloridos: cada categoria com a cor escolhida para ela.</div>`],
  ['menu', 'sliders', 'Menu de baixo', 'Ordem das abas', `
    <div class="semTopo hint">O Resumo fica sempre no menu.</div>
    <div>${p.tabs.map((t,i) => { if (t === 'chat' || (WEB_APP && t === 'noticias')) return ''; const off = p.tabsOff.includes(t);
      return `<div class="item u-linha">
      <button class="iconbtn ${off ? 'muted' : 'in'}" data-onclick="toggleTab('${t}')" ${t === 'resumo' ? 'disabled style="opacity:.35"' : ''} aria-label="${off ? 'Mostrar' : 'Esconder'}">${I(off ? 'unchecked' : 'checked', 24)}</button>
      <div class="mid" style="${off ? 'opacity:.5' : ''}"><b>${I(TABS[t][0])} ${TABS[t][1]}</b>${off ? '<small>escondida</small>' : t === visTabs()[0] ? '<small>Aba inicial</small>' : ''}</div>
      <button class="iconbtn u-apagado" data-onclick="moveTab(${i},-1)" ${i ? '' : 'disabled'} aria-label="Subir">▲</button>
      <button class="iconbtn u-apagado" data-onclick="moveTab(${i},1)" ${i < n-1 ? '' : 'disabled'} aria-label="Descer">▼</button></div>`; }).join('')}</div>`],
  ['seguranca', 'lock', 'Ícone e bloqueio', 'Ícone e senha', !isApp ? '' : `${demo}
    <label>Cor do ícone do app</label>
    <div class="swatches">${Object.entries(ICONES).filter(([k]) => !SKINS[k] || SKIN_ANTIGOS.includes(k) || (k === p.skin || k === N.icone()) && iconeTem(k)).map(([k,c]) => `<button class="sw ${N.icone() === k ? 'on' : ''}" style="background:linear-gradient(135deg,${c[1]},${c[2]});border-radius:14px" data-onclick="nativeOpts().setIcone('${k}');openSettings()" aria-label="${c[0]}" title="${c[0]}"></button>`).join('')}</div>
    ${temNativo('setIconeApp') ? `<label>Desenho do ícone</label>
    <div class="icoGrid">${icoPadrao()}${iconeDesenhos(nativo('icone')).map(k => `<button class="${nativo('iconeDesenho') === k ? 'on' : ''}" data-onclick="nativo('setIconeApp', nativo('icone'),'${k}',0);openSettings()">${iconeSvg(nativo('icone'), k)}<small>${iconeNomeDesenho(nativo('icone'), k)}</small></button>`).join('')}</div>
    ${SKINS[nativo('icone')] ? '<div class="hint">Mais desenhos nas cores comuns.</div>' : temNativo('criarAtalho') ? '' : '<div class="hint">Há mais desenhos (moeda, carteira, cofre…) na versão nova do app: toque em Procurar atualizações.</div>'}` : ''}
    <div class="hint">O app fecha ao trocar; abra pelo ícone novo.</div>
    <label>Pedir senha ou biometria ao abrir</label>
    <div class="semTopo btns">${[[true, I('lock') + 'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${lockOn === v ? 'primary' : ''}" data-onclick="nativeOpts().setBloqueio(${v});openSettings()">${t}</button>`).join('')}</div>
    ${lockOn ? '<div class="hint">Desligar pede a senha ou a biometria.</div>' : ''}
    <label>Pedir de novo após</label>
    <div class="btns" style="margin-top:0;flex-wrap:wrap${lockOn ? '' : ';opacity:.4;pointer-events:none'}">${[[0,'Sempre'],[30,'30 s'],[60,'1 min'],[300,'5 min'],[900,'15 min']].map(([s,t]) => `<button class="btn ${lockTime === s ? 'primary' : ''}" style="padding:11px 6px" data-onclick="nativeOpts().setTempoBloqueio(${s});openSettings()">${t}</button>`).join('')}</div>`],
  ['lembretes', 'calendar', 'Lembretes', 'Contas, parcelas e previsões', !isApp ? '' : `${demo}
    <label>Lembretes ativos neste aparelho</label>
    <div class="semTopo btns">${[[true,'Ligados'],[false,'Desligados']].map(([v,t]) => `<button class="btn ${lembLigados() === v ? 'primary' : ''}" data-onclick="${v ? 'ligarLembretes()' : 'desligarLembretes()'}">${t}</button>`).join('')}</div>
    ${aparelhoLemb() === '1' && !notifLiberada() ? `<div class="hint warn">${I('alert', 13)} Desligados porque as notificações do Cofrim estão bloqueadas nas configurações do Android.</div>
      <div class="btns"><button class="btn" data-onclick="nativo('abrirConfigNotificacoes')">Abrir configurações do Android</button></div>` : ''}
    <div class="hint">Só neste aparelho; as escolhas ficam na conta.</div>
    ${lembLigados() && batLivre === false ? `<div class="hint warn">${I('alert', 13)} A economia de bateria está ligada para o app: os lembretes podem atrasar ou não chegar. Desligue para recebê-los na hora.</div>` : ''}
    ${lembLigados() && batLivre ? `<div class="hint in">${I('check', 13)} Economia de bateria desligada para o app: os lembretes chegam na hora.</div>` : ''}
    <label>Contas a vencer</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${!!p.notify === v ? 'primary' : ''}" data-onclick="setNotify(${v})">${t}</button>`).join('')}</div>
    <div style="${p.notify ? '' : 'opacity:.4;pointer-events:none'}">
      <label>Avisar com antecedência de (pode marcar mais de uma)</label>
      <div class="semTopo btns">${[[1,'1 dia'],[3,'3 dias'],[5,'5 dias']].map(([d,t]) => `<button class="btn ${p.reminds.includes(d) ? 'primary' : ''}" data-onclick="toggleRemind(${d})">${p.reminds.includes(d) ? I('check', 15) : ''}${t}</button>`).join('')}</div>
      <label>Categorias que notificam (as que têm gastos fixos; toque para ligar ou desligar)</label>
      <div class="chips u-m0">${Object.entries(CAT_GASTO).filter(([k]) => k !== 'emprestimo' && (p.notifyCats[k] === false || db.expenses.some(x => x.cat === k && x.fixed))).map(([k,c]) => { const on = p.notifyCats[k] !== false; return `<button style="${on ? 'background:var(--brand);color:' + (theme.dark ? '#0b1020' : '#fff') : 'opacity:.6;text-decoration:line-through'}" data-onclick="toggleNotifyCat('${k}')">${I(c[0], 14)} ${esc(c[1])}</button>`; }).join('')}</div>
    </div>
    <div class="hint">Avisa nos dias marcados e no vencimento, às 9h.</div>${temNativo('bateria') ? `${batLivre ? '' : `<div class="btns"><button class="btn" data-onclick="nativo('bateria')">Tirar o app da economia de bateria</button></div>`}
    ${[['notifyOrc', 'Orçamento das categorias e dos grupos'], ['notifyCartao', 'Limite do cartão'], ['notifyMeta', 'Metas'], ['notifyPrev', 'Previsões de gastos']].map(([k, t]) => `
    <label>${t}</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,r]) => `<button class="btn ${!!(p[k] ?? p.notify) === v ? 'primary' : ''}"
      data-onclick="setNotifyTipo('${k}',${v})">${r}</button>`).join('')}</div>`).join('')}
    <div class="hint">Em que ponto avisar (50%, 70%, 80%, 90%, chegou ou passou do valor): <a href="#" class="u-marca" data-onclick="openSettings('avisos');return false">Avisos de valores</a>.</div>
    <label>Parcelas de financiamentos e empréstimos (no dia do vencimento)</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${!!(p.notifyFin ?? p.notify) === v ? 'primary' : ''}" data-onclick="setNotifyTipo('notifyFin',${v})">${t}</button>`).join('')}</div>
    <div class="hint">Se atrasarem, escolha "Não otimizar" para o Cofrim.</div>` : ''}`],
  ['avisos', 'bell', 'Avisos de valores', 'Quando avisar: de 50% a passou', `
    <div class="semTopo hint">Escolha em que pontos o app avisa (no sino e, no Android com os lembretes ligados, no celular). Pode marcar mais de um.</div>
    ${[['prev', 'Previsões de gastos', PREV_PONTOS, prevPontos()], ['orc', 'Orçamento de cada categoria e grupo', PONTOS, pontosDe('orc')],
      ['cartao', 'Limite do cartão (quanto já está comprometido)', PONTOS, pontosDe('cartao')], ['meta', 'Metas (quanto já foi guardado)', PONTOS, pontosDe('meta')]]
      .map(([tipo, t, lista, marcados]) => `<label>${t}</label>
    <div class="semTopo btns pontos">${Object.entries(lista).map(([k, r]) =>
      `<button class="btn ${marcados.includes(k) ? 'primary' : ''}${/%$/.test(r) ? '' : ' longo'}"
      data-onclick="togglePonto('${tipo}','${k}')">${r}</button>`).join('')}</div>
    ${marcados.length ? '' : '<div class="hint warn">Nenhum ponto marcado: este aviso fica desligado.</div>'}`).join('')}`],
  ['widgets', 'chart', 'Widgets', 'Quadros da tela inicial', !(temNativo('widget')) ? '' : `
    <div class="semTopo hint">Seis quadros: <b>Resumo</b>, <b>Gastos</b>, <b>Saldo</b>, <b>Contas</b>, <b>Mascote</b> e <b>Gastar</b>.</div>
    ${temNativo('setWidgetOculto') ? `<label>Valores nos widgets</label>
    <div class="semTopo btns">${[[false, 'Mostrar'], [true, 'Esconder']].map(([v, t]) => `<button class="btn ${!!nativo('widgetOculto') === v ? 'primary' : ''}" data-onclick="nativo('setWidgetOculto', ${v});updateWidget();openSettings()">${t}</button>`).join('')}</div>
    <div class="hint">Mostra R$ •••• no lugar dos valores.</div>` : ''}
    <div class="hint">Segure o widget para ajustar fundo e cantos.</div>
    <label>Fundo dos widgets</label>
    <div class="semTopo btns">${[['tema', p.skin ? 'Tema especial' : 'Cor do app'], ['escuro', 'Escuro']].map(([v, t]) => `<button class="btn ${(p.widgetFundo || 'tema') === v ? 'primary' : ''}" data-onclick="setPref('widgetFundo','${v}')">${t}</button>`).join('')}</div>
    <label>Mascote nos widgets Resumo, Gastos, Saldo e Contas</label>
    <div class="semTopo btns">${[[true, 'Com mascote'], [false, 'Sem mascote']].map(([v, t]) => `<button class="btn ${(p.widgetPig ?? !!p.fun) === v ? 'primary' : ''}" data-onclick="setPref('widgetPig',${v})">${t}</button>`).join('')}</div>
    <div class="hint">O mascote do app, com a cara do mês.</div>
    <label>Widget Resumo</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openLayoutEdit('widget')">${I('sliders')}Escolher o que aparece</button></div>
    <div class="hint">Linhas sem dado não aparecem.</div>
    <label>Widget Gastos: o que listar</label>
    <div class="semTopo quebraLinha btns">${[['', 'Todos'], ...Object.entries(GRUPOS).map(([k, g]) => [k, g[0]])].map(([k, t]) => `<button class="btn ${(p.widgetLista || '') === k ? 'primary' : ''}" style="padding:11px 6px;flex:1 0 30%" data-onclick="setPref('widgetLista','${k}')">${t}</button>`).join('')}</div>
    <label>Widget Gastos: ordem</label>
    <div class="semTopo btns">${[['', 'Como no app'], ['valor', 'Maiores primeiro']].map(([k, t]) => `<button class="btn ${(p.widgetOrdem || '') === k ? 'primary' : ''}" data-onclick="setPref('widgetOrdem','${k}')">${t}</button>`).join('')}</div>
    ${temNativo('fixarWidget') ? `<label>Pôr na tela inicial</label>
    <div class="semTopo quebraLinha btns">${[['resumo', 'Resumo'], ...(temNativo('criarAtalho') ? [['gastos', 'Gastos']] : []), ['saldo', 'Saldo do mês'], ['contas', 'Contas a vencer'], ['porco', 'Mascote'], ['gastar', 'Gastar']].map(([k, t]) => `<button class="btn" style="padding:11px 6px;flex:1 0 30%" data-onclick="if(!nativo('fixarWidget', '${k}'))tell('Esta tela inicial não aceita o pedido. Segure o dedo num espaço vazio da tela inicial, toque em Widgets e procure Cofrim.')">${t}</button>`).join('')}</div>
    <div class="hint">O Android pede confirmação.</div>` : ''}`],
  ['conta', 'cloud', 'Conta e sincronização', 'Google Drive e cópias', syncHtml],
  ['compart', 'people', 'Conta compartilhada', sync.shared ? 'Ligada: vocês veem os mesmos dados' : 'Mesmos dados em dupla', syncHtml ? shareHtml() : ''],
  ['auto', 'sparkle', 'Lançamento automático', 'Sugestões de gasto', !(temNativo('avisosLigar')) ? '' : `
    <label>Sugestões de gasto</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${!!nativo('avisosLigado') === v ? 'primary' : ''}" data-onclick="setAvisos(${v})">${t}</button>`).join('')}</div>
    ${nativo('avisosLigado') && !nativo('avisosAcesso') ? `<div class="hint warn">${I('alert', 13)} Falta autorizar no Android. <a class="u-marca" href="#" data-onclick="nativo('avisosConfigurar');return false">Abrir a tela de autorização</a></div>` : ''}
    <div class="hint">Compras e Pix avisados pelo banco viram sugestão; nada sai do aparelho.</div>
    ${temNativo('setAvisoGasto') && !nativo('avisosLigado') ? `<label class="apagado">Avisar quando encontrar um gasto</label>
    <div class="semTopo hint apagado">Ligue as sugestões de gasto para usar o aviso.</div>` : ''}
    ${temNativo('setAvisoGasto') && nativo('avisosLigado') ? `<label>Avisar quando encontrar um gasto</label>
    <div class="semTopo btns">${[[true,'Ligado'],[false,'Desligado']].map(([v,t]) => `<button class="btn ${!!nativo('avisoGasto') === v ? 'primary' : ''}" data-onclick="nativo('setAvisoGasto', ${v});openSettings()">${t}</button>`).join('')}</div>
    ${nativo('avisoGasto') && !lembLigados() ? `<div class="hint warn">${I('alert', 13)} Os lembretes estão desligados neste aparelho: o aviso não aparece.</div><div class="btns u-mt6"><button class="btn primary" data-onclick="ligarLembretes()">Ligar lembretes</button></div>`
      : '<div class="hint">Notificação na hora, com o app aberto ou fechado; tocar abre o formulário já preenchido.</div>'}` : ''}
    <label>Apps ignorados</label>
    ${appsIgnorados().length ? `<div class="semTopo btns"><button class="btn" data-onclick="openAppsIgnorados()">Apps ignorados (${appsIgnorados().length})</button></div>` : '<div class="semTopo hint">Nenhum app ignorado.</div>'}`],
  ['guia', 'book', 'Guia do app', 'Todas as funções, onde ficam e como usar', guideHtml()],
  ['sugestoes', 'send', 'Sugestões e bugs', 'Mande uma ideia ou informe um problema', `
    <div class="semTopo hint">Escreva aqui e toque em enviar: a mensagem vai direto para a equipe do Cofrim, sem sair do app.</div>
    <textarea id="sugTexto" maxlength="3000" style="height:130px;font:inherit" placeholder="O que você quer contar?"></textarea>
    <label>Seu e-mail (opcional, para receber resposta)</label>
    <input id="sugEmail" type="email" maxlength="120" autocomplete="email" placeholder="voce@exemplo.com">
    <input id="sugIsca" class="isca" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="btns"><button class="btn" data-onclick="enviarSugestao('sugestao', this)">${I('sparkle')}Enviar sugestão</button>
      <button class="btn" data-onclick="enviarSugestao('problema', this)">${I('alert')}Informar um problema</button></div>
    <div class="btns"><button class="btn on" id="sugRetrato" data-onclick="sugRetratoAlternar(this)">${I('checked', 22)}Incluir um retrato da tela</button>
      <button class="btn" data-onclick="sugRetratoVer()">${I('eye', 20)}Ver o que vai</button></div>
    <div class="hint">O retrato mostra o que estava na tela em texto, com valores, datas, nomes e descrições trocados por •••. Num problema, vai junto
      também o Diagnóstico do app (versão, aparelho e erros, sem os seus dados), para achar a causa mais rápido.</div>`],
  ['dados', 'box', 'Dados e ajustes', 'Backup, lixeira e planilha', `
    <label>Investimentos</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openRates()">${I('trend')}Taxas: CDI, Selic e IPCA</button></div>
    ${archHtml()}
    <label>Lixeira</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openTrash()">${I('trash')}Lançamentos excluídos (${db.trash.length})</button></div>
    ${importacoesHtml()}
    <label>Planilha do Google</label>
    <div class="semTopo btns"><button class="btn" data-onclick="openSheetLink()">${I('doc')}${sheetId() ? 'Planilha ligada ao app' : 'Criar planilha ligada ao app'}</button></div>
    <label>Backup em arquivo</label>
    ${canSync() && sync.on ? `<div class="semTopo hint">Seus dados ficam numa área privada do Drive; "Salvar cópia" gera um arquivo seu.</div>
    <div class="btns"><button class="btn" data-onclick="salvarCopiaDrive()">${I('cloud')}Salvar cópia no meu Google Drive</button></div>` : ''}
    <div class="btns" style="margin-top:${canSync() && sync.on ? 8 : 0}px"><button class="btn" data-onclick="exportData()">${I('download')}Salvar no aparelho</button><button class="btn" data-onclick="if(!demoBloqueia())document.getElementById('file').click()">${I('upload')}Importar</button></div>
    ${sync.fileAt ? `<div class="hint">Cópia semanal no celular: a última em ${new Date(sync.fileAt).toLocaleDateString('pt-BR')}.</div>` : ''}
    <label>Apagar tudo</label>
    <div class="semTopo btns"><button class="cresce btn danger" data-onclick="wipeAll()">${I('trash')}Apagar todos os meus dados</button></div>
    <div class="hint">Apaga tudo, aqui e na conta. Não dá para desfazer.</div>`]
  ].filter(s => s[4]);
  const cur = S.find(s => s[0] === setSec);
  if (!cur) setSec = '';
  showSheet(cur ? `<h3 class="setHead"><button class="iconbtn" data-onclick="openSettings('')" aria-label="Voltar">‹</button>${I(cur[1], 22)} ${cur[2]}</h3>
    <div class="sec">${cur[4]}</div>
    <div class="btns foot"><button class="btn" data-onclick="openSettings('')">Voltar</button><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`
  : `<h3>Configurações</h3>
    <div class="setGrid">${S.map(([k, ic, t, d]) => `<button class="setTile" data-onclick="openSettings('${k}')"><span>${I(ic, 22)}</span><b>${t}</b><small>${d}</small></button>`).join('')}</div>
    ${(temNativo('atualizar')) || WEB_APP ? `<div class="btns"><button class="btn" data-onclick="procurarAtualizacao()">${I('refresh')}Procurar atualizações</button></div>` : ''}
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>
    <div class="hint u-centro" data-onclick="diagTap()">Cofrim · versão ${APP_VERSION}</div>`);
  settingsOpen = true;
}
// O APK instalado tem ícone para esta cor ou tema? (Os temas por categoria chegaram ao ícone no APK 1.46.)
// "Padrão": o ícone do Cofrim de fábrica (o C com a moeda, no roxo), sempre à mão na lista de desenhos, qualquer que seja a
// cor ou o tema do ícone escolhido. Com ele já em uso, aparece marcado no lugar do C da própria cor.
const icoPadrao = () => nativo('icone') === 'indigo' ? ''
  : `<button data-onclick="nativo('setIconeApp','indigo','b',0);openSettings()">${iconeSvg('indigo', 'b')}<small>Padrão</small></button>`;
const iconeTem = k => !SKINS[k] || SKIN_ANTIGOS.includes(k) || !!(temNativo('iconeTem') && nativo('iconeTem', k));
// Tema especial: aplica e, no APK, oferece trocar também o ícone do app para combinar.
// ---------- Tema ou cor do dia ----------
// db.prefs.sorteio = 'tema' (um tema especial por dia) ou 'cor' (uma cor comum por dia); '' = desligado. A cada dia o
// app sorteia um que ainda não saiu (sorteioVistos); quando todos já saíram, a rodada recomeça. Escolher um tema ou uma
// cor à mão desliga o sorteio.
function sorteioDoDia(forcar){
  const p = db.prefs, modo = p.sorteio, hoje = new Date().toLocaleDateString('sv');
  if ((modo !== 'tema' && modo !== 'cor') || (!forcar && p.sorteioDia === hoje)) return false;
  const todos = Object.keys(modo === 'tema' ? SKINS : COLORS), atual = modo === 'tema' ? p.skin : p.color;
  let vistos = (p.sorteioVistos || []).filter(k => todos.includes(k)), resto = todos.filter(k => !vistos.includes(k) && k !== atual);
  if (!resto.length){ vistos = []; resto = todos.filter(k => k !== atual); } // todos já saíram: começa outra rodada
  const k = resto[Math.floor(Math.random() * resto.length)];
  if (modo === 'tema') p.skin = k; else { p.skin = ''; p.color = k; }
  Object.assign(p, {sorteioVistos:[...vistos, k], sorteioDia:hoje});
  db.cfgMod = Date.now(); save(); applyTheme();
  return true;
}
const sorteioNome = () => db.prefs.sorteio === 'tema' ? SKINS[db.prefs.skin][0] : COLORS[db.prefs.color][0];
// "Tema (ou cor) de hoje": o aviso leva às Configurações do sorteio (Temas especiais ou Aparência).
function sorteioAviso(){ const tema = db.prefs.sorteio === 'tema';
  toast(`${tema ? 'Tema' : 'Cor'} de hoje: ${sorteioNome()}`, {dest:{k:'cfg', s:tema ? 'temas' : 'aparencia'}}); }
function setSorteio(modo){
  const p = db.prefs;
  p.sorteio = p.sorteio === modo ? '' : modo;
  if (p.sorteio){ p.sorteioVistos = []; sorteioDoDia(true); sorteioAviso(); }
  else { db.cfgMod = Date.now(); save(); }
  render(); openSettings();
}
const sorteioBtn = (modo, texto) => `<div class="btns" style="margin-top:8px"><button class="btn ${db.prefs.sorteio === modo ? 'primary' : ''}" data-onclick="setSorteio('${modo}')">${I('sparkle')}${texto}: ${db.prefs.sorteio === modo ? 'ligado' : 'desligado'}</button></div>
  ${db.prefs.sorteio === modo ? `<div class="hint">Todo dia o app escolhe ${modo === 'tema' ? 'um tema especial' : 'uma cor'} diferente, sem repetir até passar por ${modo === 'tema' ? 'todos' : 'todas'} (${(db.prefs.sorteioVistos || []).length} de ${Object.keys(modo === 'tema' ? SKINS : COLORS).length}). Hoje: <b>${sorteioNome()}</b>. <button style="color:var(--brand);font-weight:700" data-onclick="sorteioDoDia(true);render();openSettings()">Sortear outro agora</button></div>` : ''}`;
// Escolha feita à mão: vale ela, e o sorteio diário para.
function setCor(k){ db.prefs.sorteio = ''; setPref('color', k); iconeNaCor(k); }
// O ícone do Cofrim (desenho 'b') acompanha a cor escolhida à mão. Na versão web o ícone indicado pela página já segue a
// cor (webIcone); no Android, trocar o ícone pode fechar o app, então pergunta antes. Outro desenho ou o ícone de um tema
// ficam como estão.
async function iconeNaCor(k){
  if (!(temNativo('setIconeApp') && temNativo('icone')) || demoOn || !COLORS[k]) return;
  if (nativo('iconeDesenho') !== 'b' || !COLORS[nativo('icone')] || nativo('icone') === k) return;
  if (await ask(`Usar o ${COLORS[k][0].toLowerCase()} também no ícone do app?\n\nAo trocar o ícone, o Android pode fechar o app: é só abrir de novo.`,
    'Trocar o ícone')) nativo('setIconeApp', k, 'b', 0);
}
async function setSkin(k){
  const tinha = db.prefs.skin;
  db.prefs.sorteio = '';
  setPref('skin', k);
  if (!k && tinha) return iconeSemTema();
  if (k && temNativo('setIconeApp') && nativo('icone') !== k && iconeTem(k)
    && await ask(`Trocar também o ícone do app para combinar com o tema ${SKINS[k][0]}?\n\nO Android fecha o app ao trocar o ícone: é só abrir de novo pelo ícone novo.`, 'Trocar o ícone')) nativo('setIconeApp', k, 't', nativo('iconeNome')); // o ícone do tema: o mascote dele e as barras do app
}
// De volta ao "Sem tema especial": o ícone do app (só no Android) que não é o padrão (outra cor, outro desenho, o ícone de
// um tema ou outro nome) pode voltar ao do Cofrim, na cor em uso. Pergunta antes: trocar o ícone pode fechar o app.
async function iconeSemTema(){
  if (!(temNativo('setIconeApp') && temNativo('icone')) || demoOn) return;
  const cor = COLORS[db.prefs.color] ? db.prefs.color : 'indigo';
  if (nativo('icone') === cor && nativo('iconeDesenho') === 'b' && !(temNativo('iconeNome') && nativo('iconeNome'))) return;
  if (await ask('Voltar também o ícone do app para o padrão do Cofrim?\n\nAo trocar o ícone, o Android pode fechar o app: é só abrir de novo.',
    'Voltar ao padrão')) nativo('setIconeApp', cor, 'b', 0);
}
// Guia do app (Configurações): todas as funções (GUIA, em js/guia.js), por assunto, com busca.
function guideHtml(){
  return `<div class="search" style="margin-bottom:10px">${I('search')}<input id="gq" type="text" placeholder="Buscar uma função" autocomplete="off" data-oninput="guideFilter(this.value)"></div>
    ${GUIA.map(([sec, itens]) => `<details class="grp gSec"><summary>${sec}<small>${itens.length}</small>${I('chev')}</summary>${itens.map(([nome, onde, como]) => `
      <div class="gItem" data-t="${esc(plain(nome + ' ' + onde + ' ' + como))}"><b>${esc(nome)}</b><small><i>Onde:</i> ${esc(onde)}</small><small><i>Como usar:</i> ${esc(como)}</small></div>`).join('')}</details>`).join('')}
    <div class="hint" id="gVazio" hidden>Nenhuma função encontrada com esse texto.</div>`;
}
function guideFilter(q){
  q = plain(q.trim());
  let algum = false;
  document.querySelectorAll('#sheet .gSec').forEach(sec => {
    let n = 0;
    sec.querySelectorAll('.gItem').forEach(it => { const ok = !q || it.dataset.t.includes(q); it.hidden = !ok; if (ok) n++; });
    sec.hidden = !n; sec.open = !!q && n > 0;
    if (n) algum = true;
  });
  document.getElementById('gVazio').hidden = algum;
}
// Ao voltar de uma tela do Android (economia de bateria, notificações), as configurações abertas se atualizam.
document.addEventListener('visibilitychange', () => { if (!document.hidden && settingsShown()) openSettings(); });
// ---------- Diagnóstico (tela escondida) ----------
// Abre com 7 toques seguidos no número da versão, em Configurações. Não tem senha: o relatório não traz valores nem
// descrições dos lançamentos, e uma senha fixa no código não protegia nada. Do 3º toque em diante, o aviso rápido diz
// quantos faltam (trocando o texto no lugar, fora da central); parar por 1,5 s zera a contagem.
let diagTaps = 0, diagTimer = 0;
function diagTap(){
  clearTimeout(diagTimer); diagTimer = setTimeout(() => diagTaps = 0, 1500);
  if (++diagTaps < 7){
    const faltam = 7 - diagTaps;
    if (diagTaps >= 3) toast(`Falta${faltam > 1 ? 'm' : ''} ${faltam} toque${faltam > 1 ? 's' : ''} para abrir o Diagnóstico`, {central:false});
    return;
  }
  hideSnack();
  diagTaps = 0; settingsOpen = false; F = null;
  diagOpen();
}
function diagErrors(){ try { return JSON.parse(localStorage.getItem(ERR_KEY) || '[]'); } catch(e){ return []; } }
// Texto do relatório: nada de valores nem descrições dos lançamentos, só contagens e o estado do app. O texto inteiro
// passa por limpaDiag (e-mails, tokens, respostas do Google, valores e códigos longos), também o que veio do lado nativo.
// Sugestões e bugs: enviadas de dentro do app pelo Web3Forms (api.web3forms.com, na CSP), que entrega no e-mail da
// equipe (diaslab.apps@gmail.com, cadastrado no Web3Forms: a chave abaixo é pública e só serve para esse envio).
let SUGESTAO_CHAVE = '57040c27-ab59-4c06-81f8-cb1f511c356c'; // let: os testes trocam pela de teste
// Contra spam (a chave fica no app, qualquer um pode copiar): o campo isca escondido (botcheck do Web3Forms; pessoa não
// vê nem preenche, robô preenche e a mensagem é descartada), no máximo SUG_POR_DIA envios por dia neste aparelho e
// 30 s entre um e outro. A chave também só vale nos endereços do app (restrição de domínio no painel do Web3Forms).
const SUG_KEY_ENVIOS = 'financas-sugestoes-envios', SUG_POR_DIA = 5;
function sugEnviosHoje(){
  try { const d = Date.now() - 864e5; return (JSON.parse(localStorage.getItem(SUG_KEY_ENVIOS)) || []).filter(t => typeof t === 'number' && t > d); }
  catch(e){ return []; }
}
// Troca por ••• tudo o que a pessoa digitou: qualquer texto guardado nos dados (lançamentos, contas, metas, categorias,
// cartões, membros), menos os códigos do próprio app (categoria, forma de pagamento, datas…), que dão o contexto; o
// nome, a saudação, o e-mail da conta e qualquer e-mail. Não liga para maiúsculas (a tela mostra alguns títulos em
// MAIÚSCULAS). Vale para o retrato da tela e para o Diagnóstico que vai junto num problema.
function semDadosDaPessoa(texto){
  const proprios = new Set([myName(), db.prefs.greet, sync.account]);
  const junta = (v, k) => {
    if (typeof v === 'string') { if (!TR_CODIGOS.test(k)) proprios.add(v); return; } // os códigos são os mesmos do tradutor
    if (!v || typeof v !== 'object') return;
    if (/^(card|catMemo)/.test(k) && !Array.isArray(v)) Object.keys(v).forEach(b => proprios.add(b)); // cartões: chave = banco; catMemo: descrição
    for (const [kk, vv] of Object.entries(v)) junta(vv, Array.isArray(v) ? k : kk);
  };
  for (const [k, v] of Object.entries(db)) if (k !== 'prefs') junta(v, k);
  const lista = [...proprios].filter(t => typeof t === 'string' && t.trim().length >= 3 && !/^\d{4}-\d{2}/.test(t)).map(t => t.trim())
    .sort((a, b) => b.length - a.length);
  const re = lista.length && new RegExp(lista.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu');
  return (re ? String(texto).replace(re, '•••') : String(texto)).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '•••@•••');
}
// Retrato da tela em texto, no lugar de uma print (o Web3Forms gratuito não aceita anexos): qual aba, janela e aviso
// estavam abertos e o texto que aparecia neles, sem os dados da pessoa. Saem todos os números (valores, datas, saldos), o
// que ela digitou (descrições, nomes, bancos, metas, categorias próprias), o nome e o e-mail dela.
let telaRetrato = ''; // tirado na hora do erro (relatarProblema), antes de as Configurações cobrirem a tela
function retratoTela(semFolha){
  const censura = t => semDadosDaPessoa(t).replace(/\d/g, '•'); // e todos os números (valores, datas, saldos)
  const vis = id => { const e = document.getElementById(id); return e && !e.hidden && e.offsetParent !== null ? e : null; };
  const folha = !semFolha && vis('sheet'), aviso = vis('dlg');
  document.body.classList.add('semEtiquetas'); // innerText sem as etiquetas "Novo" (escondidas só durante a leitura)
  const partes = [`Tela: ${TABS[state.tab] ? TABS[state.tab][1] : state.tab}${state.tab === 'gastos' ? ' (' + state.gsub + ')' : ''}`,
    aviso && 'Aviso aberto:\n' + aviso.innerText.trim(), folha && 'Janela aberta:\n' + folha.innerText.trim(),
    'Conteúdo da tela:\n' + document.getElementById('app').innerText.trim()];
  document.body.classList.remove('semEtiquetas');
  return censura(partes.filter(Boolean).join('\n\n')).replace(/\n{3,}/g, '\n\n').slice(0, 4000);
}
const sugRetratoLigado = () => { const b = document.getElementById('sugRetrato'); return !b || b.classList.contains('on'); };
function sugRetratoAlternar(btn){
  btn.classList.toggle('on'); btn.innerHTML = I(btn.classList.contains('on') ? 'checked' : 'unchecked', 22) + 'Incluir um retrato da tela';
}
function sugRetratoVer(){ tell('Vai junto com a mensagem (os seus dados aparecem como •••):\n\n' + (telaRetrato || retratoTela(true))); }
// Erro do próprio app (avisoErro, tela que não abre, sincronização, travamento): abre Sugestões e bugs com a mensagem
// começada; a pessoa completa e toca em "Informar um problema", que manda junto o Diagnóstico e o retrato da tela.
function relatarProblema(oQue){
  telaRetrato = retratoTela();
  openSettings('sugestoes');
  const t = document.getElementById('sugTexto');
  t.value = `O app mostrou: "${oQue}"\nO que eu estava fazendo: `;
  t.focus(); t.setSelectionRange(t.value.length, t.value.length);
}
async function enviarSugestao(tipo, btn){
  const txt = document.getElementById('sugTexto').value.trim(), email = document.getElementById('sugEmail').value.trim();
  if (!txt) return toast('Escreva a mensagem antes de enviar.');
  if (!SUGESTAO_CHAVE){ tell('O envio de sugestões ainda não está ligado nesta versão.'); return; }
  const envios = sugEnviosHoje(), isca = document.getElementById('sugIsca');
  if (envios.length >= SUG_POR_DIA){ tell(`Você já mandou ${SUG_POR_DIA} mensagens nas últimas 24 horas. Tente de novo amanhã, por favor.`); return; }
  if (envios.length && Date.now() - Math.max(...envios) < 30e3) return toast('Espere alguns segundos antes de mandar outra mensagem.');
  const assunto = `Cofrim ${APP_VERSION} · ${tipo === 'problema' ? 'Problema' : 'Sugestão'}`;
  const info = (tipo === 'problema' ? semDadosDaPessoa(diagText()) : `Cofrim ${APP_VERSION}\nAparelho: ${navigator.userAgent}`)
    + (sugRetratoLigado() ? '\n\n--- Retrato da tela (dados escondidos) ---\n' + (telaRetrato || retratoTela(true)) : '');
  btn.disabled = true;
  try {
    const r = await fetch('https://api.web3forms.com/submit', {method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json'},
      body:JSON.stringify({access_key:SUGESTAO_CHAVE, subject:assunto, from_name:'Cofrim', botcheck:!!(isca && isca.value),
        ...(email ? {email} : {}), message:`${txt}\n\n---\n${info}`})});
    if (!r.ok || !(await r.json()).success) throw new Error('Web3Forms: HTTP ' + r.status);
    document.getElementById('sugTexto').value = ''; telaRetrato = '';
    try { localStorage.setItem(SUG_KEY_ENVIOS, JSON.stringify([...envios, Date.now()])); } catch(e){}
    toast('Mensagem enviada. Obrigado!');
  } catch(e){ logErr('sugestão', e); avisoErro('internet'); }
  finally { btn.disabled = false; }
}
function diagText(){ return limpaDiag(diagTextoBruto()); }
function diagTextoBruto(){
  const kb = k => { try { return Math.round((localStorage.getItem(k) || '').length / 1024); } catch(e){ return -1; } };
  const errs = diagErrors();
  return [`Cofrim ${APP_VERSION} · formato dos dados ${db.ver || 1}`,
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Aparelho: ${navigator.userAgent}`,
    `Tela: ${screen.width}x${screen.height} · zoom do texto ${db.prefs.font}`,
    `Dados: ${kb(KEY)} KB · ` + COLS.map(c => `${c} ${db[c].length}`).join(', '),
    `Gravação falhou: ${saveFailed ? 'sim' : 'não'}`,
    `Sincronização: ${canSync() ? (sync.on ? 'ligada' : 'desligada') : 'indisponível'} · última: ${sync.at ? new Date(sync.at).toLocaleString('pt-BR') : 'nunca'} · erro: ${sync.err || 'nenhum'}`,
    `Fotos na fila: ${sync.up.length} para enviar, ${sync.del.length} para apagar`,
    `Preferências: tema ${db.prefs.mode}/${db.prefs.color}, animações ${db.prefs.anim ? 'sim' : 'não'}, modo divertido ${db.prefs.fun ? 'sim' : 'não'}, abas escondidas ${db.prefs.tabsOff.join(',') || 'nenhuma'}`,
    `Animações neste aparelho: ${leveCfg().modo}, efeitos leves ${efeitosLeves() ? 'sim' : 'não'} · memória ${navigator.deviceMemory || '?'} GB · ${navigator.hardwareConcurrency || '?'} núcleos · aberturas ruins ${leveCfg().ruins}`,
    `Último fechamento por erro: ${(() => { const e = temNativo('ultimoErro') ? String(nativo('ultimoErro')) : ''; return e ? new Date(+e.split('|')[0]).toLocaleString('pt-BR') + ' — ' + e.slice(e.indexOf('|') + 1, 1500) : 'nenhum registrado'; })()}`,
    `Conferências da conta compartilhada com o app fechado: ${(() => { const h = temNativo('compartHist') ? String(nativo('compartHist')) : ''; return h ? '\n' + h.split('\n').map(l => { const i = l.indexOf('|'); return '  ' + new Date(+l.slice(0, i)).toLocaleString('pt-BR') + ' — ' + l.slice(i + 1); }).join('\n') : 'nenhuma registrada'; })()}`,
    '', `Erros registrados (${errs.length}):`,
    ...errs.slice().reverse().map(e => `[${new Date(e.t).toLocaleString('pt-BR')} · v${e.v}] ${e.onde}: ${e.msg}`)].join('\n');
}
// Diagnóstico › Notificações (só no app Android): os dois testes e o estado do que permite as notificações aparecerem.
// Os testes dependem só do interruptor dos lembretes deste aparelho (não da conta compartilhada nem das preferências).
function diagNotifHtml(){
  if (!temNativo() || !temNativo('notificar')) return '';
  const leitura = temNativo('avisosLigado') ? (nativo('avisosLigado') && temNativo('avisosAcesso') && nativo('avisosAcesso') ? 'ligada' : 'desligada') : 'indisponível';
  return `<label>Notificações</label>
    <div class="semTopo hint">Lembretes deste aparelho: ${aparelhoLemb() === '1' ? 'ligados' : 'desligados'} · permissão de notificações do Android: ${notifLiberada() ? 'concedida' : 'negada'} · leitura das notificações dos bancos: ${leitura}.</div>
    <div class="btns"><button class="btn" data-onclick="diagTestar('notif')">${I('bell')}Testar notificação</button>${temNativo('notificarGastoTeste') ? `<button class="btn" data-onclick="diagTestar('gasto')">${I('sparkle')}Testar aviso de gasto</button>` : ''}</div>`;
}
async function diagTestar(tipo){
  if (!lembLigados()){
    if (await ask('Os lembretes estão desligados neste aparelho. Ligar agora?', 'Ligar')) ligarLembretes();
    return;
  }
  if (tipo === 'gasto') nativo('notificarGastoTeste'); // "R$ 12,34 em Padaria Teste"; tocar abre o formulário, sem criar sugestão
  else nativo('notificar', 'Cofrim', 'Teste: é assim que os avisos do Cofrim aparecem.');
  toast('Notificação de teste enviada.', {central:false});
}
function diagOpen(){
  showSheet(`<h3>Diagnóstico</h3>
    <div class="semTopo hint">Estado do app e últimos erros, para enviar a quem dá suporte. Não inclui valores nem descrições dos seus lançamentos.</div>
    <textarea id="diagBox" readonly>${esc(diagText())}</textarea>${diagNotifHtml()}
    <div class="btns"><button class="btn" data-onclick="diagSave()">${I('download')}Salvar em arquivo</button><button class="btn" data-onclick="diagCopy()">Copiar</button></div>
    <div class="btns"><button class="cresce btn danger" data-onclick="localStorage.removeItem(ERR_KEY);diagOpen()">Limpar erros</button></div>
    <div class="btns"><button class="cresce btn" data-onclick="demoLigar()">${I('sparkle')}Ligar modo demonstração</button></div>
    <div class="btns foot"><button class="btn primary" data-onclick="openSettings()">Voltar</button></div>`);
}
function diagSave(){
  const name = 'financas-diagnostico.txt';
  if (temNativo('exportar')) return nativo('exportar', diagText(), name);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([diagText()], {type:'text/plain'}));
  a.download = name; a.click();
}
function diagCopy(){
  if (temNativo('copiar')){ nativo('copiar', diagText()); return toast('Copiado.'); }
  const box = document.getElementById('diagBox');
  box.select();
  try { document.execCommand('copy'); toast('Copiado.'); } catch(e){ toast('Não deu para copiar; use "Salvar em arquivo".'); }
}

// Categorias de gastos e de ganhos: renomear, trocar o ícone, esconder e criar novas.
const ICON_NAMES = {home:'Casa', bed:'Cama', key:'Chave', wrench:'Ferramenta', brush:'Pintura', drop:'Água', flame:'Gás', bolt:'Raio',
  wifi:'Internet', phone:'Celular', tv:'TV',
  food:'Comida', pizza:'Pizza', coffee:'Café', cup:'Bebida', cake:'Bolo', cart:'Mercado', bag:'Sacola', shirt:'Roupa', scissors:'Beleza', gift:'Presente',
  car:'Carro', fuel:'Combustível', bus:'Ônibus', bike:'Bicicleta', truck:'Entrega', plane:'Viagem', pin:'Lugar', globe:'Mundo',
  health:'Saúde', cross:'Farmácia', pill:'Remédio', dumbbell:'Academia', heart:'Coração', paw:'Pet', person:'Pessoa', people:'Família', smile:'Sorriso',
  star:'Estrela', game:'Jogos', music:'Música', film:'Filmes', ticket:'Ingresso', ball:'Esporte', camera:'Foto', sun:'Sol', leaf:'Planta',
  book:'Livro', grad:'Formatura', laptop:'Computador', briefcase:'Maleta', building:'Prédio', bank:'Banco', calendar:'Calendário', doc:'Documento',
  receipt:'Recibo',
  coins:'Moedas', coin:'Moeda', cash:'Dinheiro', card:'Cartão', wallet:'Carteira', piggy:'Cofrinho', percent:'Porcentagem', trend:'Gráfico', chart:'Barras',
  tag:'Etiqueta', box:'Caixa', target:'Alvo', trophy:'Troféu', diamond:'Diamante', shield:'Escudo', umbrella:'Guarda-chuva', lock:'Cadeado',
  cloud:'Nuvem', sparkle:'Brilho'};
// Tela de categorias: gastos e ganhos, cada um com os seus grupos (js/grupos.js); cada grupo abre as categorias dele,
// com "Nova categoria" (já no grupo) e "Editar grupo" (nome, ícone, cor, excluir: js/grupos-tela.js). A categoria muda de
// grupo pelo Editar dela. catsOpen guarda os grupos abertos ("tipo:grupo").
const catsOpen = new Set();
function openCats(){
  settingsOpen = false; F = null;
  const row = (type, k, c) => `
    <div class="item u-linha">${tile(c[0])}<div class="mid" style="${c[3] ? 'opacity:.5' : ''}"><b>${esc(c[1])}</b>${c[3] ? '<small>escondida</small>' : ''}</div>
      <button class="btn" style="flex:none;padding:8px 12px" data-onclick="editCat('${type}','${k}')">Editar</button>
      ${BASE_CATS[type][k] ? '' : `<button class="iconbtn out" data-onclick="deleteCat('${type}','${k}')" aria-label="Excluir categoria">${I('close', 20)}</button>`}
      ${k === 'outros' ? '' : `<button class="iconbtn ${c[3] ? 'muted' : 'in'}" data-onclick="toggleCat('${type}','${k}')" aria-label="${c[3] ? 'Mostrar' : 'Esconder'}">${I(c[3] ? 'unchecked' : 'checked', 24)}</button>`}</div>`;
  const grupo = (type, g, c) => { const ks = catsDoGrupo(type, g), id = type + ':' + g; return `
    <details class="grp" ${catsOpen.has(id) ? 'open' : ''} data-ontoggle="catsOpen[this.open ? 'add' : 'delete'](this.dataset.g)" data-g="${id}">
      <summary><span class="grpIco" style="color:${c[2]}">${I(c[0], 18)}</span>${esc(c[1])}<small>${ks.length}</small>${I('chev')}</summary>
      ${ks.length ? ks.map(k => row(type, k, CAT_OF[type][k])).join('') : '<div class="hint">Nenhuma categoria neste grupo.</div>'}
      <div class="btns grpAcoes"><button class="btn" data-onclick="editCat('${type}','','${g}')">${I('plus', 16)}Nova categoria</button>
        <button class="btn" data-onclick="grupoEditor('${type}','${g}')">Editar grupo</button></div></details>`; };
  const secao = type => `<label>${type === 'gasto' ? 'Gastos' : 'Ganhos'}</label>
    <div class="semTopo btns catNova"><button class="btn" data-onclick="grupoEditor('${type}')">${I('plus', 16)}Novo grupo</button></div>
    ${Object.entries(GRUPOS_CAT[type]).map(([g, c]) => grupo(type, g, c)).join('')}
    <div class="btns"><button class="btn" data-onclick="gruposRestaurarPedir('${type}')">${I('refresh', 16)}Restaurar grupos padrão</button></div>`;
  showSheet(`<h3>Categorias</h3>
    <div class="semTopo hint">As categorias ficam em grupos (ex.: Lazer reúne Bares, Cinema e Viagens), para ver o total de cada grupo. Toque em um grupo para abrir. Categoria escondida some das listas de escolha, mas os lançamentos antigos continuam com ela. As que você criou podem ser excluídas (X): os lançamentos passam para a de fábrica com o mesmo nome ou para "Outros".</div>
    ${secao('gasto')}${secao('ganho')}
    <div class="btns foot"><button class="btn primary" data-onclick="openSettings('categorias')">Voltar</button></div>`);
}
// Grava uma categoria (nova com k = '', ou já existente; v.g = o grupo) e refaz as listas; devolve a chave. Usada pela
// tela de categorias (formulário catEdit) e pela criação rápida (novaCategoria).
function catSalvar(type, k, v){
  k = k || 'c' + uid();
  db.cats[type][k] = catLimpa(Object.assign(db.cats[type][k] || {}, {name:v.name, icon:v.icon, color:v.color}, v.g ? {g:v.g} : {}));
  db.cfgMod = Date.now(); applyCats();
  return k;
}
// Criar uma categoria sem sair do que se está fazendo: abre por cima (na camada dos seletores), pede nome, grupo, ícone e
// cor e chama aoCriar(chave). Nome igual ao de uma categoria do mesmo grupo: usa essa (e a mostra, se estava escondida);
// em outro grupo, o mesmo nome pode. Usada pelos formulários (formCatNova), pela janela do grupo e pelo Importar planilha
// (nome: o da planilha, já escrito). Com edita (chave de uma categoria), a mesma janela edita essa categoria, já com o
// nome, o grupo, o ícone e a cor dela (segurar a categoria no formulário, catSegurar). grupo: o grupo já escolhido.
let catNovaDe = null; // {type, aoCriar, icon, color, edita, g}
function novaCategoria(type, aoCriar, nome = '', edita = '', grupo = ''){
  const c = edita && CAT_OF[type][edita];
  catNovaDe = {type, aoCriar, icon:c ? c[0] : 'tag', color:c ? c[2] : '#64748b', edita, g:c ? grupoDe(type, edita) : GRUPOS_CAT[type][grupo] ? grupo : 'outros'};
  if (c) nome = c[1];
  showPicker(`<h3>${c ? 'Editar categoria' : 'Nova categoria de ' + type}</h3>
    <label for="cnNome">Nome</label><input id="cnNome" type="text" maxlength="40" placeholder="Ex.: Pets" autocomplete="off" value="${esc(nome)}">
    <label>Grupo</label><div class="chips grpEscolhe">${Object.entries(GRUPOS_CAT[type]).map(([g, gc]) => `<button type="button"
      class="${g === catNovaDe.g ? 'on' : ''}" data-g="${g}" data-onclick="catNovaEscolhe(this,'g')"><span style="color:${gc[2]}">${I(gc[0], 15)}</span>${esc(gc[1])}</button>`).join('')}</div>
    <label>Ícone</label><div class="iconGrid">${Object.entries(ICON_NAMES).map(([k, n]) => `<button type="button"
      class="${k === catNovaDe.icon ? 'on' : ''}" data-i="${k}" aria-label="${n}" title="${n}"
      data-onclick="catNovaEscolhe(this,'icon')">${I(k, 23)}</button>`).join('')}</div>
    <label>Cor</label><div class="swatches colorGrid">${CAT_COLORS.map(cor => `<button type="button"
      class="sw${cor === catNovaDe.color ? ' on' : ''}" data-c="${cor}" style="background:${cor}" aria-label="Cor ${cor}"
      data-onclick="catNovaEscolhe(this,'color')"></button>`).join('')}</div>
    <div class="err" id="cnErr"></div>
    <div class="btns foot"><button class="btn" data-onclick="closePicker()">Cancelar</button>
      <button class="btn primary" data-onclick="catNovaCriar()">${c ? 'Salvar' : 'Criar'}</button></div>`);
}
function catNovaEscolhe(b, campo){
  catNovaDe[campo] = campo === 'icon' ? b.dataset.i : campo === 'g' ? b.dataset.g : b.dataset.c;
  b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
}
function catNovaCriar(){
  const nome = document.getElementById('cnNome').value.trim().slice(0, 40);
  const {type, aoCriar, icon, color, edita, g} = catNovaDe, C = CAT_OF[type];
  const igual = !edita && catsDoGrupo(type, g).find(k => nomeComparar(C[k][1]) === nomeComparar(nome));
  const erro = igual ? '' : catNomeErro(type, nome, g, edita);
  if (erro) return void (document.getElementById('cnErr').textContent = erro);
  let k = edita || igual;
  if (igual && C[k][3]){ db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {hidden:false}); db.cfgMod = Date.now(); applyCats(); }
  if (!igual) k = catSalvar(type, edita, {name:nome, icon, color, g});
  save(); closePicker(); catNovaDe = null;
  aoCriar(k);
}
// Categoria nas Configurações (formulário catEdit): nova (k = '', no grupo g) ou já existente; o Grupo a move de grupo.
let catEditTipo = 'gasto';
function editCat(type, k, g = ''){
  const c = CAT_OF[type][k];
  catEditTipo = type;
  openForm('catEdit', null,
    {id:type + ':' + k, title:c ? 'Editar categoria' : 'Nova categoria de ' + type,
    vals:c ? {name:c[1], icon:c[0], color:c[2], g:grupoDe(type, k)} : {icon:'tag', color:'#64748b', g:GRUPOS_CAT[type][g] ? g : 'outros'}});
}
// Exclui uma categoria criada pelo usuário. Os lançamentos dela vão para a de fábrica de mesmo nome, ou para "Outros"
// (catApagarDados, em grupos.js). depois(alvo): o que fazer em seguida (a tela de categorias, ou o formulário que estava
// aberto: catSegurar).
async function deleteCat(type, k, depois = openCats){
  const alvo = catDestino(type, k), nomeAlvo = CAT_OF[type][alvo][1], usados = catLancamentos(type, k);
  if (!await ask(`Excluir a categoria "${CAT_OF[type][k][1]}"?` + (usados.length ? `\n${usados.length} lançamento(s) passam para "${nomeAlvo}".` : ''),
    'Excluir', true)) return;
  catApagarDados(type, k, alvo);
  save(); render(); depois(alvo);
  toast('Categoria excluída.', {dest:{k:'cfg', s:'categorias'}});
}
function toggleCat(type, k){
  db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {hidden:!CAT_OF[type][k][3]});
  db.cfgMod = Date.now(); applyCats(); save(); render(); openCats();
}
function toggleTab(t){
  const p = db.prefs;
  p.tabsOff = p.tabsOff.includes(t) ? p.tabsOff.filter(x => x !== t) : p.tabsOff.concat(t);
  if (p.tabsOff.includes(state.tab)) state.tab = visTabs()[0];
  db.cfgMod = Date.now(); save(); render(); openSettings();
}
// Moeda e país (Idioma e região): listas longas, com busca. Os nomes, no idioma do app, vêm do navegador (Intl.DisplayNames).
const nomeIntl = (tipo, c) => { try { return new Intl.DisplayNames([LOCALES[lang()]], {type:tipo}).of(c) || c; } catch(e){ return c; } };
const moedaNome = c => { const n = nomeIntl('currency', c); return `${cap(n === c ? MOEDAS_NOMES[c] || c : n)} (${c})`; };
const paisNome = c => cap(nomeIntl('region', c));
const porNome = (a, b) => a[1].localeCompare(b[1], 'pt-BR');
function escolherMoeda(){ pickList('Moeda', MOEDAS.map(c => [c, moedaNome(c)]).sort(porNome), db.prefs.moeda || 'BRL', c => setPref('moeda', c), true); }
function escolherPais(){ pickList('País', PAISES.map(c => [c, paisNome(c)]).sort(porNome), db.prefs.pais || 'BR', c => setPref('pais', c), true); }
function setPref(k, v){ db.prefs[k] = v; db.cfgMod = Date.now(); save(); applyTheme(); render(); openSettings(); }
// Animações (Configurações › Aparência): desligadas valem para a conta (db.prefs.anim); automáticas, completas ou leves
// são deste aparelho (leveCfg). Escolher de novo zera a conta das aberturas ruins.
function setEfeitos(modo){
  if (modo !== 'off') leveGuardar({modo, ruins:0});
  if (db.prefs.anim !== (modo !== 'off')) return setPref('anim', modo !== 'off');
  applyTheme(); render(); openSettings();
}
function moveTab(i, d){ const t = db.prefs.tabs; [t[i], t[i+d]] = [t[i+d], t[i]]; db.cfgMod = Date.now(); save(); render(); openSettings(); }
// Um tipo de lembrete (preferência da conta). Ligar um tipo com o interruptor do aparelho desligado liga os dois juntos.
function setNotify(on){ setNotifyTipo('notify', on); }
function setNotifyTipo(k, on){
  setPref(k, on);
  if (on && !lembLigados()) ligarLembretes();
}
// Liga os lembretes deste aparelho. No Android 13 ou mais novo, sem a permissão de notificações, pede a permissão: se a
// pessoa permitir, liga; se recusar (ou se o Android não perguntar mais), fica desligado e oferece as configurações.
let lembQuerLigar = false, permRes = null;
async function ligarLembretes(){
  if (demoBloqueia()) return;
  if (!notifLiberada()){
    lembQuerLigar = true;
    const ok = temNativo('notificacaoBloqueada') && nativo('notificacaoBloqueada') ? false : await new Promise(r => { permRes = r; nativo('pedirNotificacao'); });
    if (!ok) return lembNegado();
  }
  lembQuerLigar = false;
  setAparelhoLemb(true); scheduleReminders(); compNativo();
  if (settingsOpen) openSettings('lembretes');
  // Com a economia de bateria ligada para o app, o Android atrasa ou corta os lembretes: avisa e oferece a tela de desligar.
  if (temNativo() && temNativo('bateriaLivre') && !nativo('bateriaLivre')
    && await ask(comNome('Para os lembretes chegarem na hora, {nome}, é preciso desligar a economia de bateria do app.\n\nNa tela que vai abrir, procure "Cofrim" e escolha "Não otimizar" (ou "Sem restrições").'), 'Abrir a tela'))
    nativo('bateria');
}
function desligarLembretes(){
  lembQuerLigar = false;
  setAparelhoLemb(false); scheduleReminders();
  if (settingsOpen) openSettings('lembretes');
}
async function lembNegado(){
  if (settingsOpen) openSettings('lembretes');
  if (await ask('Para receber lembretes, permita as notificações do Cofrim.',
    'Abrir configurações do Android') && temNativo('abrirConfigNotificacoes')) nativo('abrirConfigNotificacoes');
  else lembQuerLigar = false;
}
// Resposta do pedido de permissão (chamada pelo lado nativo).
function onPermissaoNotificacao(ok){ const r = permRes; permRes = null; if (r) r(!!ok); }
// Volta ao app (das configurações do Android, por exemplo): confere a permissão de novo e, se a parte de lembretes
// das Configurações estiver aberta, atualiza o aviso dela. Outra tela (ou outra parte das Configurações) fica como está.
function onVoltouApp(){
  if (lembQuerLigar && notifLiberada()) return void ligarLembretes();
  if (settingsOpen && setSec === 'lembretes' && settingsShown()) openSettings('lembretes');
}
// Entrou numa conta que já tem lembretes, com eles desligados neste aparelho: pergunta uma vez, de forma discreta.
function avisoLembretes(){
  if (!(temNativo('lembretes')) || demoOn || lembLigados() || !Object.values(lembTipos(db.prefs)).some(Boolean)) return false;
  try { if (localStorage.getItem(LEMB_AVISO)) return false; localStorage.setItem(LEMB_AVISO, '1'); } catch(e){ return false; }
  ask('Seus lembretes estão salvos na conta, mas desligados neste aparelho. Ligar agora?', 'Ligar').then(sim => { if (sim) ligarLembretes(); askLock(); });
  return true;
}
// Pontos de aviso das previsões: marca ou desmarca um, na ordem da lista.
// Marca ou desmarca um ponto de aviso (Avisos de valores); a ordem segue a da lista do tipo.
function togglePonto(tipo, k){
  const lista = tipo === 'prev' ? PREV_PONTOS : PONTOS, l = tipo === 'prev' ? prevPontos() : pontosDe(tipo);
  setPref(tipo + 'Pontos', Object.keys(lista).filter(x => x === k ? !l.includes(x) : l.includes(x)));
}
function toggleRemind(d){ const r = db.prefs.reminds; setPref('reminds', r.includes(d) ? r.filter(x => x !== d) : r.concat(d).sort((a,b) => a - b)); }
function toggleNotifyCat(k){ db.prefs.notifyCats[k] = db.prefs.notifyCats[k] === false; setPref('notifyCats', db.prefs.notifyCats); }
