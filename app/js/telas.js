// Cofrim — As telas de cada aba (Resumo, Ganhos, Gastos, Investir), o título com o menu e a rosca de categorias.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md).
// ---------- Telas ----------
// Bloco com o ícone, na cor do tema; c = [ícone, nome, cor própria (não usada na tela: tudo segue o tema)].
const tile = (icon, color) => `<div class="ico" style="background:linear-gradient(135deg,${color ? color + ',' + color + 'cc' : 'var(--hero1),var(--hero2)'})">${I(icon, 22)}</div>`;
// Selo do banco nas contas, faturas e vales (a empresa do cartão): o logotipo dele (js/dados-bancos.js); sem logotipo, a
// cor e a sigla dele; carteira e dinheiro, o desenho de uma carteira; os outros, as iniciais numa cor tirada do nome
// (sempre a mesma). [trecho do nome sem acento, logotipo (BANCO_LOGOS) ou sigla, fundo, letra]
const BANCO_SELOS = [[/nubank|^nu\b/, 'nubank'], [/itau/, 'itau'], [/bradesco/, 'bradesco'], [/banco do brasil|^bb\b/, 'bb'],
  [/caixa/, 'caixa'], [/santander/, 'santander'], [/\binter\b/, 'inter'], [/\bc6\b/, 'c6'], [/picpay/, 'picpay'],
  [/mercado ?pago/, 'mercadopago'], [/\bxp\b/, 'xp'], [/btg/, 'btg'], [/neon/, 'neon'], [/pagbank|pagseguro/, 'pagbank'],
  [/sicoob/, 'sicoob'], [/sicredi/, 'sicredi'], [/original/, 'original'], [/banrisul/, 'banrisul'], [/safra/, 'safra'],
  [/\bpan\b/, 'pan'], [/stone/, 'stone'], [/infinite ?pay/, 'infinitepay'], [/\bcora\b/, 'cora'], [/\bbmg\b/, 'bmg'],
  [/magalu/, 'magalu'], [/recarga ?pay/, 'recargapay'], [/ifood/, 'ifood'],
  [/\bwill\b/, 'will'], [/alelo/, 'alelo'], [/pluxee|sodexo/, 'pluxee'], [/ticket/, 'ticket'], [/^vr\b/, 'vr'],
  [/flash/, 'flash'], [/caju/, 'caju'], [/swile/, 'swile'], [/^ben\b/, 'pluxee']]; // o Ben Visa Vale virou Pluxee
// Os logotipos (js/dados-bancos.js, ~100 KB) carregam só quando a primeira tela com banco aparece, não na abertura;
// até chegarem, fica a sigla ou as iniciais, e a tela se redesenha quando eles chegam.
let bancoLogosPedido = false;
function bancoLogos(){
  if (typeof BANCO_LOGOS !== 'undefined') return BANCO_LOGOS;
  if (!bancoLogosPedido){ bancoLogosPedido = true; const s = document.createElement('script'); s.src = 'js/dados-bancos.js';
    s.onload = () => { telaAtualizar(true); bancoLogosNoForm(); }; s.onerror = () => { bancoLogosPedido = false; }; document.head.appendChild(s); }
  return {};
}
// Formulário aberto quando os logotipos chegam: o campo do banco, as sugestões e as listas de contas ganham o logotipo
// (o "focus" redesenha as sugestões, ver sugBind).
function bancoLogosNoForm(){
  if (!F || !sheetOpen()) return;
  syncForm();
  document.querySelectorAll('#sheet input').forEach(el => { if (document.getElementById('sug_' + el.id.slice(2))) el.dispatchEvent(new Event('focus')); });
}
const bancoDe = nome => { const t = plain(String(nome || '').trim()), b = BANCO_SELOS.find(([re]) => re.test(t)); return [t, b, b && bancoLogos()[b[1]]]; };
// Ícone pequeno do banco antes do nome nas linhas dos lançamentos (só quando há logotipo).
const bancoMini = nome => { const logo = bancoDe(nome)[2]; return logo ? `<img class="bancoMini" src="${logo[0]}" alt="">` : ''; };
function bancoSelo(nome){
  const [t, b, logo] = bancoDe(nome);
  if (logo) return `<div class="ico banco logo${logo[1] ? '' : ' cheio'}" style="background:${logo[1] || 'none'}"><img src="${logo[0]}" alt=""></div>`;
  if (!b && /carteira|dinheiro|especie|cofre/.test(t)) return tile('wallet');
  const [sigla, fundo, letra] = b ? [b[1], b[2], b[3] || '#ffffff'] : [t.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean).slice(0, 2)
    .map(w => w[0].toUpperCase()).join('') || '?', hslHex([...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7), 55, 40), '#ffffff'];
  return `<div class="ico banco${sigla.length > 3 ? ' longo' : ''}" style="background:${fundo};color:${letra}" aria-hidden="true"><b>${esc(sigla)}</b></div>`;
}
// Ícone de uma categoria: na cor do tema ou, com a opção "Por categoria" ligada, na cor própria dela (c[2]).
const ico = (c) => tile(c[0], (db.prefs.catColor || db.prefs.skin) && c[2]); // num tema especial, as categorias ficam com a cor própria
// Valor curto para as escalas dos gráficos ("R$ 5,2 mil", com o símbolo da moeda escolhida).
const kfmt = v => hideVals || !isFinite(v) ? '' : comMoeda(v, {notation:'compact', maximumFractionDigits:1});
const chartGrid = max => `<div class="grid"><i style="top:0"><em>${kfmt(max)}</em></i><i style="top:50%"><em>${kfmt(max / 2)}</em></i></div>`;
// Blocos cinza animados no lugar do conteúdo enquanto ele carrega.
const skel = n => `<div class="sk skHero"></div><div class="card">${'<div class="skRow"><div class="sk skBox"></div><div><div class="sk skLine"></div><div class="sk skLine" style="width:55%"></div></div></div>'.repeat(n)}</div>`;
// Nome da categoria com o ícone pequeno, para textos corridos.
const catName = (c, color = 'var(--brand)') => `<span style="color:${esc(color)}">${I(c[0], 16)}</span> ${esc(c[1])}`;
// Título da aba com os botões de personalizar a tela e de configurações.
// Título das telas: a nuvem da sincronização logo depois do nome; à direita, o sino (só no Resumo), o olho e o menu.
const tituloTela = (title, tab, extra = '') => `<h1><span class="tit">${title}${nuvemBtn()}</span><span class="acoes">${extra}${eyeBtn()}${menuBtn(tab)}</span></h1>`;
// ---------- Botão de menu do título (três barras) ----------
// Abre um painel pequeno, preso ao botão, com "Configurações", "Sugestões de gasto" (só no Android, com as sugestões
// ligadas ou alguma guardada) e, nas telas com blocos, "Reorganizar esta tela" (o que o antigo botão de personalizar
// abria). Com só as Configurações, o toque vai direto a elas. Sugestões novas (nem lançadas nem ignoradas): um ponto no
// botão e o número ao lado do item. O painel fecha ao tocar fora, com o voltar do Android e com Esc; Tab e Enter navegam nele.
// Só onde a parte aberta tem blocos: em Gastos, o "Do mês" (Parceladas e Vales não têm); em Ganhos, fora de Vales.
const parteComBlocos = tab => tab === 'gastos' ? state.gsub === 'mes' && !state.parcDet : tab !== 'ganhos' || state.isub !== 'vale';
const reorganizar = tab => !parteComBlocos(tab) ? '' : tab === 'resumo' ? 'openResumoEdit()' : LAYOUT[tab] ? `openLayoutEdit('${tab}')` : '';
// Na versão web, aparece quando o celular já mandou alguma sugestão pela sincronização.
const sugNoMenu = () => temNativo('avisosBanco') ? ((temNativo('avisosLigado') && nativo('avisosLigado')) || sugLog().length > 0 || sugNovas() > 0)
  : db.sugs.lista.length > 0;
const sugNovas = () => bankNotes().filter(n => parseBankNote(n)).length;
function menuItens(tab){
  const l = [['gear', 'Configurações', "openSettings('')"]];
  if (sugNoMenu()) l.push(['sparkle', 'Sugestões de gasto', 'openSugestoes()', sugNovas()]);
  if (reorganizar(tab)) l.push(['sliders', 'Reorganizar esta tela', reorganizar(tab)]);
  return l;
}
const menuBtn = tab => {
  const l = menuItens(tab), n = l.reduce((t, x) => t + (x[3] || 0), 0), rot = `Menu${n ? `, ${n} ${n > 1 ? 'sugestões novas' : 'sugestão nova'}` : ''}`;
  return l.length > 1
    ? `<button class="iconbtn menuBtn" data-onclick="abrirMenu(this,'${tab}')" aria-label="${rot}" aria-haspopup="menu" aria-expanded="false">${I('menu', 24)}${n ? '<b class="menuPonto"></b>' : ''}</button>`
    : `<button class="iconbtn menuBtn" data-onclick="openSettings('')" aria-label="Menu">${I('menu', 24)}</button>`;
};
function abrirMenu(btn, tab){
  if (fecharMenu()) return; // segundo toque no botão fecha
  const el = document.createElement('div');
  el.id = 'menuTopo'; el.setAttribute('role', 'menu');
  el.innerHTML = menuItens(tab).map(([ic, txt, acao, n]) => `<button role="menuitem" data-onclick="fecharMenu();${acao}">${I(ic, 20)}${txt}${n ? `<b class="menuN">${n > 99 ? '99+' : n}</b>` : ''}</button>`).join('');
  btn.parentElement.appendChild(el);
  btn.setAttribute('aria-expanded', 'true');
  el.querySelector('button').focus({preventScroll:true});
}
function fecharMenu(focar){
  const el = document.getElementById('menuTopo');
  if (!el) return false;
  const btn = el.parentElement.querySelector('.menuBtn');
  el.remove();
  if (btn){ btn.setAttribute('aria-expanded', 'false'); if (focar) btn.focus({preventScroll:true}); }
  return true;
}
// Toque fora do painel: só fecha (o toque não chega ao que estava embaixo).
document.addEventListener('click', e => {
  const el = document.getElementById('menuTopo');
  if (!el || el.contains(e.target) || (e.target.closest && e.target.closest('.menuBtn'))) return;
  e.stopPropagation(); e.preventDefault(); fecharMenu();
}, true);
const head = (title, tab) => tituloTela(title, tab) + offlinePill();
// Tela ou lista vazia: ícone, texto e, quando há, o botão do próximo passo ([rótulo, comando]).
const empty = (icon, t, acao) => `<div class="card empty"><span>${I(icon, 40)}</span>${t}${acao ? `<button class="btn primary emptyBtn" data-onclick="${acao[1]}">${acao[0]}</button>` : ''}</div>`;
// Parte de uma aba ainda vazia: o texto e o botão para começar.
const vazioParte = (t, acao) => `<div class="vazioParte"><span>${t}</span><button class="btn" data-onclick="${acao[1]}">${acao[0]}</button></div>`;
// Conta compartilhada: quem lançou o registro (by), como etiqueta na linha. Fora dela não aparece.
const byTag = x => shared() && x.by ? `<span class="tag">${I('user', 11)} ${esc(x.by)}</span>` : '';
const bySmall = x => shared() && x.by ? ` · por ${esc(x.by)}` : '';
// Saudação do topo do Resumo, com o nome escolhido (db.prefs.greet: 'o' bem-vindo, 'a' bem-vinda, 'e' boas-vindas).
const greeting = () => { const n = db.prefs.name; return n ? `${{o:'Bem-vindo', a:'Bem-vinda'}[db.prefs.greet] || 'Boas-vindas'}, ${esc(n)}!` : ''; };
// Ordem dos grupos da lista de lançamentos (Gastos): ▲▼ como no "Personalizar".
function openGrpOrder(){
  const o = db.prefs.grpOrder;
  showSheet(`<h3>Ordem dos grupos</h3><div class="semTopo hint">Use as setas para escolher a ordem dos grupos na lista de lançamentos.</div>
    ${o.map((k, i) => `<div class="item u-linha"><div class="mid"><b>${GRUPOS[k][0]}</b></div>
      <button class="iconbtn u-apagado" data-onclick="grpMove(${i},-1)" ${i ? '' : 'disabled'} aria-label="Subir">▲</button>
      <button class="iconbtn u-apagado" data-onclick="grpMove(${i},1)" ${i < o.length - 1 ? '' : 'disabled'} aria-label="Descer">▼</button></div>`).join('')}
    <div class="btns"><button class="btn" data-onclick="db.prefs.grpOrder=Object.keys(GRUPOS);db.cfgMod=Date.now();save();render();openGrpOrder()">Restaurar padrão</button><button class="btn primary" data-onclick="closeForm()">Pronto</button></div>`);
}
function grpMove(i, d){ const o = db.prefs.grpOrder; [o[i], o[i + d]] = [o[i + d], o[i]]; db.cfgMod = Date.now(); save(); render(); openGrpOrder(); }
// Gráfico de rosca. parts = [[cor, valor], ...]
// Dia do mês de um gasto (para o calendário do Resumo e a ordenação das listas): o dia lançado ou, numa conta fixa,
// o do vencimento; 0 = sem dia informado.
// Gasto sem dia informado (avulso, fixo sem vencimento ou parcelado): vale o dia do mês em que foi cadastrado (o id
// guarda o momento da criação, ver uid). Um fixo cadastrado no dia 15 aparece no dia 15 de cada mês.
const criadoEm = x => { const t = parseInt(String(x.id).slice(0, -5), 36); return t > 1.5e12 && t < 4e12 ? new Date(t) : null; };
const diaCriado = (x, m) => { const d = criadoEm(x); return d ? Math.min(d.getDate(), daysIn(m)) : 0; };
// Ganho (sem kind nem vencimento): o dia em que cai, com as regras de dia útil (diaGanho).
const diaDe = (x, m) => (!x.kind && !x.due ? diaGanho(x, m) : x.kind === 'installment' ? +x.day : x.fixed ? (x.due ? dueDay(x, m) : 0) : +x.day)
  || diaCriado(x, m);
// Gastos do mês por dia: posição = dia (a 0 junta os sem dia); cada uma {v: total, itens}.
function gastosPorDia(m){
  const por = [...Array(daysIn(m) + 1)].map(() => ({v:0, itens:[]}));
  for (const x of expensesOf(m)){ const d = por[Math.min(diaDe(x, m), por.length - 1)]; d.v += x.value; d.itens.push(x); }
  return por;
}
// Valor curto para os cartões de destaque: "R$ 3.975" até dez mil, "R$ 28,8 mil" acima.
const fmtCurto = v => hideVals ? MASK : Math.abs(v) < 1e4 ? comMoeda(Math.round(v)) : comMoeda(v, {notation:'compact', maximumFractionDigits:1});
function donut(parts, total, rotulo = 'Total'){
  let acc = 0;
  // Cada fatia termina um pouco antes da seguinte (folga), para o anel não parecer um bloco só.
  const folga = parts.length > 1 ? .7 : 0;
  const ring = (color, p, off) => `<circle cx="21" cy="21" r="15.915" fill="none" stroke="${color}" stroke-width="5.2" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${off}"/>`;
  return `<svg viewBox="0 0 42 42" style="width:160px;height:160px;display:block;margin:0 auto 4px">${ring('var(--line)', 100, 25)}
    ${parts.map(([color, v]) => { const p = v / total * 100, s = ring(color, Math.max(p - folga, .3), 25 - acc); acc += p; return s; }).join('')}
    <text x="21" y="19.6" text-anchor="middle" font-size="2.8" fill="var(--muted)">${rotulo}</text>
    <text x="21" y="24.2" text-anchor="middle" font-size="3.6" font-weight="700" fill="var(--text)">${hideVals ? MASK : comMoeda(total, {notation:'compact', maximumFractionDigits:1})}</text></svg>`;
}

// Gastos por categoria em dois cartões lado a lado (cartaoCats): por subcategoria, a rosca com as cinco maiores (o resto
// vira "Demais categorias", para não confundir com a categoria Outros), cada uma com o grupo dela embaixo e no
// tom da cor do grupo; por grupo, a rosca dos grupos, e tocar num grupo abre as subcategorias dele (state.grpAberto).
// lista = [[categoria, valor], ...]; rotulo = o que vai no centro (mês ou ano); id separa os cartões abertos de cada tela.
function cartaoCats(lista, rotulo, vazio, id){
  const cs = [...lista].filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]), tot = sum(cs, c => c[1]);
  if (!cs.length) return `<div class="hint u-vazio">${vazio}</div>`;
  const top = cs.slice(0, 5), resto = sum(cs.slice(5), c => c[1]), cor = coresPorGrupo('gasto', cs.map(c => c[0]));
  const grupoDo = k => grupoInfo('gasto', grupoDe('gasto', k))[1], pct = v => Math.round(v / tot * 100);
  const leg = (c, nome, sub, v) => `<div class="leg duas"><i class="dot" style="background:${esc(c)}"></i><span>${nome}<small>${sub}</small></span><b>${pct(v)}%</b></div>`;
  const subs = top.map(([k, v]) => leg(cor[k], esc((CAT_GASTO[k] || CAT_GASTO.outros)[1]), `${esc(grupoDo(k))} · ${fmtCurto(v)}`, v))
    .concat(resto ? [leg('var(--muted)', 'Demais categorias', fmtCurto(resto), resto)] : []);
  const gs = somaPorGrupo('gasto', cs), aberto = state.grpAberto || (state.grpAberto = {});
  const grupos = gs.map(([g, v, cats]) => { const [ic, nome, gcor] = grupoInfo('gasto', g), on = aberto[id + g];
    return `<button type="button" class="leg duas grpLeg${on ? ' on' : ''}" data-onclick="grpAbre('${id}${esc(g)}')" aria-expanded="${!!on}">`
      + `<i class="dot" style="background:${esc(gcor)}"></i><span>${esc(nome)}<small>${fmtCurto(v)}</small></span><b>${pct(v)}%</b>${I('chev', 14)}</button>`
      + (on ? `<div class="grpSubs">${cats.map(([k, cv]) => leg(cor[k], esc((CAT_GASTO[k] || CAT_GASTO.outros)[1]), fmtCurto(cv), cv)).join('')}</div>` : ''); });
  return `<div class="duasVisoes"><div class="card rosca2"><div class="grafTit">Por subcategoria</div><div class="rosca">`
    + `${donut(cs.slice(0, 5).map(([k, v]) => [cor[k], v]).concat(resto ? [['var(--muted)', resto]] : []), tot, rotulo)}<div>${subs.join('')}</div></div></div>`
    + `<div class="card rosca2"><div class="grafTit">Por grupo</div><div class="rosca">${donut(gs.map(([g, v]) => [grupoInfo('gasto', g)[2], v]), tot, rotulo)}`
    + `<div>${grupos.join('')}</div></div></div></div>`;
}
// Abre ou fecha um grupo num cartão "por grupo" (cartaoCats, comparativo).
function grpAbre(k){ const a = state.grpAberto || (state.grpAberto = {}); a[k] = !a[k]; render(); }

const mesCurto = ym => trText(monthName(ym)).split(' ')[0].slice(0, 3) + '.'; // no idioma do app (set. / Sep.)
function viewResumo(){
  // rm = mês escolhido no Resumo (state.rmes), sempre dentro do ano escolhido (state.year).
  const y = state.year, rm = resumoMes(), nomeM = monthName(rm).split(' ')[0], months = [...Array(12)].map((_,i) => ymOf(y,i));
  const ins = months.map(totalIn), outs = months.map(totalOut), yields = months.map(yieldOf);
  const tin = sum(ins, x=>x), tout = sum(outs, x=>x), tyield = sum(yields, x=>x), max = Math.max(1, ...ins.map((v,i) => v + yields[i]), ...outs);
  const cats = {}, banks = {}, pays = {};
  months.forEach(m => expensesOf(m).forEach(e => {
    cats[e.cat] = (cats[e.cat]||0) + e.value;
    const b = e.bank || 'Não informado', p = PAY[e.pay] || 'Não informado';
    banks[b] = (banks[b]||0) + e.value;
    pays[p] = (pays[p]||0) + e.value;
  }));
  const catList = Object.entries(cats).sort((a,b) => b[1]-a[1]);
  // Lista "nome → valor" com barra proporcional ao total de gastos do ano.
  const breakdown = obj => `<div class="card">${Object.entries(obj).sort((a,b) => b[1]-a[1]).map(([k,v]) => `
    <div class="catrow"><div class="top"><span>${esc(k)}</span><b>${fmt(v)}</b></div>
    <div class="bar"><i style="width:${v/tout*100}%"></i></div></div>`).join('')}</div>`;
  const invNow = sum(db.investments, x => x.value);
  const bills = upcomingBills(), over = budgetStatus(curYM).filter(b => b.pct >= 80), overG = budgetGrupos(curYM).filter(b => b.pct >= 80), odd = unusual();
  const si = months.indexOf(state.sel); // mês tocado no gráfico
  const goals = db.goals, open = db.installments.filter(p => p.paid < p.n), inv = invoices(rm);
  // Blocos do Resumo. Quais aparecem e em que ordem vem de db.prefs.resumo (ver RESUMO e openResumoEdit).
  const B = {
  mascote: () => db.prefs.fun ? funMascot() : '',
  conquistas: () => db.prefs.fun ? funBadges() : '',
  atalhos: () => `<div class="quick">${[['incomes','income','Ganho'],['expenses','receipt','Gasto'],['investments','trend','Investir']].map(([col, ic, t]) => `<button data-onclick="openForm('${col}')"><span>${I(ic, 20)}</span>+ ${t}</button>`).join('')}</div>`,
  // Mês e ano lado a lado, no mesmo cartão de destaque: o gasto em cima, os ganhos embaixo. Tocar leva aos gastos do mês.
  // Em cada um: barra de quanto dos ganhos já foi gasto e um selo (mês: comparação com o mês anterior; ano: sobra ou falta).
  // O selo fala do mês anterior pelo nome curto ("set."): o cartão é estreito e o texto longo saía do cartão.
  destaque: () => { const mi = totalIn(rm), mo = totalOut(rm), ant = totalOut(addMonths(rm, -1)), dif = ant ? Math.round((mo - ant) / ant * 100) : null;
    const uso = (g, t) => `<div class="uso"><i style="width:${g ? Math.min(100, t / g * 100) : 0}%"></i></div><small>${g ? `${hideVals ? '••' : Math.round(t / g * 100)}% dos ganhos (${fmtCurto(g)})` : 'sem ganhos lançados'}</small>`;
    return `<div class="hero2">
    <div class="hero" data-onclick="goMonth('${rm}')"><small>Gastos de ${nomeM}</small>${bigNum(mo, 1)}${uso(mi, mo)}
      ${dif == null || hideVals ? '' : `<span class="selo">${dif ? tf('{} sobre {}', `${dif > 0 ? '▲' : '▼'} ${Math.abs(dif)}%`, mesCurto(addMonths(rm, -1)))
        : tf('= igual a {}', mesCurto(addMonths(rm, -1)))}</span>`}</div>
    <div class="hero ano"><small>Gastos de ${y}</small>${bigNum(tout, 1)}${uso(tin, tout)}
      ${tin || tout ? `<span class="selo">${tf(tin - tout < 0 ? 'faltou {}' : 'sobrou {}', fmtCurto(Math.abs(tin - tout)))}</span>` : ''}</div></div>`; },
  // Gastos por categoria do mês escolhido: rosca com o total no centro e as maiores categorias ao lado.
  rosca: () => { const g = {}; expensesOf(rm).forEach(e => g[e.cat] = (g[e.cat] || 0) + e.value);
    return `<h2>Gastos por categoria em ${nomeM} <button data-onclick="goMonth('${rm}')">Ver gastos</button></h2>${cartaoCats(Object.entries(g), cap(nomeM), `Nenhum gasto em ${monthName(rm)}.`, 'rm:')}`; },
  // Calendário do mês atual: cada dia fica mais escuro quanto mais se gastou nele. Tocar num dia mostra o que saiu.
  dias: () => { const por = gastosPorDia(rm), max = Math.max(...por.slice(1).map(d => d.v)), n = daysIn(rm), [ay, am] = rm.split('-').map(Number),
    vazio = new Date(ay, am - 1, 1).getDay();
    const sel = state.dia && state.dia <= n ? por[state.dia] : null;
    return `<h2>Calendário de gastos de ${nomeM}</h2><div class="card">
      <div class="cal">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<small>${d}</small>`).join('')}${'<span></span>'.repeat(vazio)}
      ${[...Array(n)].map((_, i) => { const d = i + 1, v = por[d].v, nivel = !v || !max ? 0 : Math.max(1, Math.ceil(v / max * 4));
        return `<button class="n${nivel}${rm === curYM && d === now.getDate() ? ' hoje' : ''}${state.dia === d ? ' sel' : ''}" data-onclick="state.dia=${state.dia === d ? 0 : d};render()" aria-label="Dia ${d}: ${hideVals ? MASK : fmt(v)}">${d}</button>`; }).join('')}</div>
      ${sel ? `<div class="calSel"><b>Dia ${state.dia}: ${fmt(sel.v)}</b>${sel.itens.length ? sel.itens.map(x => `<div class="leg"><span>${esc(x.desc)}</span><b>${fmt(x.value)}</b></div>`).join('') : '<div class="hint" style="margin:2px 0 0">Nenhum gasto neste dia.</div>'}</div>`
      : `<div class="escala"><span>menos</span>${[0, 1, 2, 3, 4].map(i => `<i class="n${i}"></i>`).join('')}<span>mais</span></div>
        <div class="hint">Quanto mais forte a cor, mais gasto no dia. Toque num dia para ver o que saiu. Gasto sem dia informado entra no dia do mês em que foi cadastrado.${por[0].v ? ` <span>Sem dia informado: ${fmt(por[0].v)}.</span>` : ''}</div>`}</div>`; },
  alertas: () => `${bills.length ? `<div class="card"><b>${I('calendar')} Contas a vencer</b>${bills.map(({x, diff}) => `
    <div class="semCursor item"><div class="mid"><b>${esc(x.desc)}</b>
      <small class="${diff < 0 ? 'out' : diff <= 2 ? 'warn' : ''}">${diff < 0 ? `venceu há ${-diff} dia${diff < -1 ? 's' : ''}` : diff === 0 ? 'vence hoje' : `vence em ${diff} dia${diff > 1 ? 's' : ''}`} · dia ${dueDay(x, curYM)}</small></div>
      <div class="val">${fmt(x.value)}</div><button class="btn" style="flex:none;padding:8px 10px" data-onclick="togglePaid('${x.id}','${curYM}')">${I('check', 15)}Pago</button></div>`).join('')}</div>` : ''}
  ${over.length || overG.length ? `<div class="card"><b><span class="warn">${I('alert')}</span> Orçamento de ${monthName(curYM)}</b>${[
    ...overG.map(b => [tf('Grupo {}', grupoInfo('gasto', b.g)[1]), b]), ...over.map(b => [(CAT_GASTO[b.cat] || CAT_GASTO.outros)[1], b])].map(([nome, b]) => `
    <div class="hint" style="color:${budgetColor(b.pct)}">${esc(nome)}:${Math.round(b.pct)}% usado (${fmt(b.used)} de ${fmt(b.lim)})</div>`).join('')}</div>` : ''}${oddHtml(odd)}`,
  planejar: () => planHtml(),
  saldo: () => `<div class="hero"><small>Saldo de ${y}</small>${bigNum(tin - tout)}
    <div class="row cores"><div><small>Ganho total</small><b class="hIn">${fmt(tin)}</b></div><div><small>Gasto total</small><b class="hOut">${fmt(tout)}</b></div></div></div>`,
  // Ganhos e gastos mês a mês, em curvas suaves: a linha cheia (cor do tema, com a área preenchida em degradê) são os
  // ganhos, com o rendimento dos investimentos; a pontilhada vermelha são os gastos. O mês tocado (ou, sem toque, o mês
  // atual) ganha um anel na linha dos ganhos e uma etiqueta com o valor. O desenho é um SVG esticado atrás das colunas.
  grafico: () => { const gan = ins.map((v, i) => v + yields[i]), alt = v => v / max * 90, mi = si >= 0 ? si : months.indexOf(curYM);
    const lim = v => Math.max(0, Math.min(100, v)).toFixed(2);
    const curva = vals => { const p = vals.map((v, i) => [i * 10 + 5, 100 - alt(v)]);
      return p.map(([x, yy], i) => { if (!i) return `M${x},${lim(yy)}`; const a = p[i - 2] || p[i - 1], b = p[i - 1], d = p[i + 1] || p[i];
        return `C${(b[0] + (x - a[0]) / 6).toFixed(2)},${lim(b[1] + (yy - a[1]) / 6)} ${(x - (d[0] - b[0]) / 6).toFixed(2)},${lim(yy - (d[1] - b[1]) / 6)} ${x},${lim(yy)}`; }).join(''); };
    const tr = 'fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"', cg = curva(gan);
    return `<div class="card graf"><div class="grafTit">Ganhos e gastos por mês<span>${y}</span></div>
    <div class="chart curva"><svg viewBox="0 0 120 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="grafDeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--brand);stop-opacity:.38"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>
        ${[25, 50, 75].map(g => `<line x1="0" x2="120" y1="${g}" y2="${g}" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')}
        <path d="${cg}L115,100L5,100Z" fill="url(#grafDeg)"/><path d="${cg}" stroke="var(--brand)" stroke-width="3.5" ${tr}/>
        <path d="${curva(outs)}" stroke="var(--out)" stroke-width="3.5" stroke-dasharray="0.1 8" ${tr}/></svg>
      ${months.map((m,i) => `<div class="col ${i === si ? 'sel' : ''}${m === curYM ? ' atual' : ''}" data-onclick="state.sel='${state.sel === m ? '' : m}';render()"><div class="bars">
        ${i === mi ? `<i class="anel" style="bottom:${alt(gan[i])}%"></i><span class="dica${alt(gan[i]) > 62 ? ' baixo' : ''}${i < 2 ? ' esq' : i > 9 ? ' dir' : ''}" style="bottom:${alt(gan[i])}%">${MESES[i].slice(0,3)} · ${fmtCurto(gan[i])}</span>` : ''}</div>
      <small>${[0, 3, 6, 9, 11].includes(i) || i === mi ? MESES[i].slice(0,3) : ''}</small></div>`).join('')}</div>
    <div class="legend" style="margin-top:8px"><span><i class="dot" style="background:var(--brand)"></i>${tyield ? 'Ganhos (com rendimento)' : 'Ganhos'}</span><span><i class="dot" style="background:var(--out)"></i>Gastos</span></div>
    ${si < 0 ? '<div class="hint">Toque em um mês para ver os valores.</div>' : `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><b class="u-capital">${monthName(months[si])}</b>
      <div class="grid2" style="margin-top:8px;row-gap:8px">
        <div class="stat"><small>Ganhos</small><b class="in">${fmt(ins[si])}</b></div>
        <div class="stat"><small>Gastos</small><b class="out">${fmt(outs[si])}</b></div>
        <div class="stat"><small>Saldo</small><b class="${ins[si] - outs[si] < 0 ? 'out' : ''}">${fmt(ins[si] - outs[si])}</b></div>
        <div class="stat"><small>Rendimento estimado</small><b class="u-marca">${fmt(yields[si])}</b></div>
      </div>
      <div class="btns"><button class="btn" data-onclick="goMonth('${months[si]}')">Ver gastos do mês</button></div></div>`}
    ${tyield ? `<div class="hint">Rendimento estimado dos investimentos em ${y}: <b class="u-marca">${fmt(tyield)}</b>. Meses passados usam o valor registrado pelo app; os futuros são projeção. Não entra no saldo do ano.</div>` : ''}
  </div>`; },
  numeros: () => `<div class="grid2">
    <div class="card stat"><small>Média mensal de gastos em ${y}</small><b class="out">${fmt(tout/12)}</b></div>
    <div class="card stat u-clicavel" data-onclick="go('invest')"><small>Investido hoje ›</small><b>${fmt(invNow)}</b></div>
  </div>`,
  // Gastos por categoria do ano: a mesma rosca do mês.
  categorias: () => `<h2>Gastos por categoria em ${y}</h2>${cartaoCats(Object.entries(cats), y, 'Nenhum gasto cadastrado neste ano.', 'ra:')}`,
  bancos: () => catList.length ? `<h2>Gastos por banco em ${y}</h2>${breakdown(banks)}` : '',
  pagamentos: () => catList.length ? `<h2>Gastos por forma de pagamento em ${y}</h2>${breakdown(pays)}` : '',
  // Previsão: mês atual e os três seguintes. "Sobra" = ganhos − gastos previstos do mês; com contas cadastradas,
  // mostra também o saldo somado delas no último dia de cada mês.
  previsao: () => { const rows = [...Array(4)].map((_,i) => addMonths(curYM, i)), hasAcc = db.accounts.length > 0;
    const pendIn = sum(incomesOf(curYM).filter(x => diaGanho(x, curYM) > now.getDate()), x => x.value);
    const pendOut = sum(expensesOf(curYM).filter(x => x.kind === 'expense' && (x.fixed ? x.due : x.day) > now.getDate()), x => x.value);
    // Um cartão por mês: selo de sobra/falta, barra de quanto dos ganhos os gastos consomem e os dois valores.
    return `<h2>Previsão dos próximos meses</h2><div class="card prev">${rows.map((m, i) => { const tin = totalIn(m), tout = totalOutPrev(m), net = tin - tout, end = hasAcc ? sum(db.accounts, a => accountBalance(a, monthEnd(m))) - reservaAte(m) : 0, r = reservaPrevisoes(m); return `
      <div class="prevM ${net < 0 ? 'neg' : ''}">
        <div class="prevCab"><b>${cap(monthName(m).split(' ')[0])}${i ? '' : '<em>este mês</em>'}</b><span class="${net < 0 ? 'out' : 'in'}">${net < 0 ? 'falta' : 'sobra'} ${fmt(Math.abs(net))}</span></div>
        <div class="prevBar"><i style="width:${tin ? Math.min(100, tout / tin * 100) : tout ? 100 : 0}%"></i></div>
        <div class="prevNum"><span>${I('income', 13)} entra <b>${fmt(tin)}</b></span><span>${I('receipt', 13)} sai <b>${fmt(tout)}</b></span></div>${r ? `<div class="hint" style="margin:2px 0 0">Sai inclui ${fmt(r)} de previsões.</div>` : ''}
        ${hasAcc ? `<div class="prevNum"><span>Saldo das contas no fim do mês</span><b class="${end < 0 ? 'out' : ''}">${fmt(end)}</b></div>` : ''}</div>`; }).join('')}
      ${pendIn || pendOut ? `<div class="hint">Até o fim de ${monthName(curYM).split(' ')[0]} ainda entram ${fmt(pendIn)} e saem ${fmt(pendOut)} (lançamentos com dia depois de hoje).</div>` : ''}
      <div class="hint">Considera ganhos e gastos fixos, anuais, parcelas, o que já está lançado em cada mês e o que falta gastar das previsões.</div></div>`; },
  // Resumo do mês: o mesmo cartão de destaque do saldo do ano. Tocar leva aos gastos do mês.
  mes: () => { const a = totalIn(rm), b = totalOut(rm), r = reservaPrevisoes(rm); return `<div class="hero u-clicavel" data-onclick="goMonth('${rm}')"><small>Saldo de ${monthName(rm)}</small>${bigNum(a - b - r)}${r ? `<small class="prevInc">${prevInclui(r)}</small>` : ''}
    <div class="row cores"><div><small>Ganhos</small><b class="hIn">${fmt(a)}</b></div><div><small>Gastos</small><b class="hOut">${fmt(b)}</b></div><div style="margin-left:auto;align-self:flex-end"><small>Ver gastos ›</small></div></div></div>`; },
  faturas: () => `<h2>Faturas de ${monthName(rm)}</h2>${inv.length ? `<div class="card">${inv.map(([bank, v]) => `<div class="semCursor item">${bancoSelo(bank)}<div class="mid"><b>${esc(bank)}</b></div><div class="val out">${fmt(v)}</div></div>`).join('')}</div>`
    : '<div class="hint u-vazio">Nenhuma compra no crédito neste mês.</div>'}`,
  parcelas: () => `<h2>Compras parceladas <button data-onclick="state.gsub='parc';go('gastos')">Ver todas</button></h2>${open.length ? `<div class="card grid2">
      <div class="stat"><small>Falta pagar (${open.length})</small><b class="out">${fmt(sum(open, parcFalta))}</b></div>
      <div class="stat"><small>Parcelas deste mês</small><b>${fmt(sum(expensesOf(curYM).filter(x => x.kind === 'installment'), x => x.value))}</b></div></div>`
    : vazioParte('Nenhuma compra parcelada em aberto.', ['+ Compra parcelada', "openForm('installments')"])}`,
  vales: () => !temVales() ? '' : `<h2>Vales <button data-onclick="state.gsub='vale';state.month=curYM;go('gastos')">Ver gastos</button></h2>
    <div class="card">${Object.keys(VALES).filter(temVale).map(k => { const s = valeSaldo(k); return `<div class="item" data-onclick="openVale('${k}')">${ico(CAT_GANHO[k])}<div class="mid"><b>${VALES[k]}${valeEmp(k) ? ' · ' + esc(valeEmp(k)) : ''}</b>
      <small>neste mês: entrou ${fmt(sum(valeIn(curYM, k), x => x.value))}, saiu ${fmt(sum(valeOut(curYM, k), x => x.value))}</small></div><div class="val ${s < 0 ? 'out' : ''}">${fmt(s)}</div></div>`; }).join('')}
    <div class="hint">Saldo de cada vale. Fica separado dos ganhos, gastos e do saldo do mês.</div></div>`,
  metas: () => `<h2>Metas <button data-onclick="go('invest')">Ver todas</button></h2>${goals.length ? `<div class="card">${goals.map(g => `
      <div class="catrow"><div class="top"><span>${esc(g.name)}</span><b>${fmt(g.saved)} de ${fmt(g.target)}</b></div>
      <div class="bar"><i style="width:${Math.min(100, g.saved / g.target * 100)}%"></i></div></div>`).join('')}</div>`
    : vazioParte('Nenhuma meta cadastrada.', ['+ Criar meta', "openForm('goals')"])}`,
  invest: () => `<h2>Investimentos <button data-onclick="go('invest')">Ver todos</button></h2>${db.investments.length ? `<div class="card grid2">
      <div class="stat"><small>Total hoje</small><b>${fmt(invNow)}</b></div>
      <div class="stat"><small>Projeção em 12 meses</small><b>${fmt(sum(db.investments, projection))}</b></div></div>`
    : vazioParte('Nenhum investimento cadastrado.', ['+ Cadastrar investimento', "openForm('investments')"])}`
  };
  return `${greeting() ? `<div class="hello">${greeting()}</div>` : ''}
  ${tituloTela('Resumo', 'resumo', sinoBtn()).replace('<h1>', '<h1 style="margin-bottom:0">')}
  <div class="muted" style="margin:0 2px 14px;font-size:13.5px">Hoje é ${todayLabel()}</div>${offlinePill(true)}${trocaContaHtml()}${typeof avisoInstalar === 'function' ? avisoInstalar() : ''}
  <div class="nav periodo"><button data-onclick="resMes(-1)" aria-label="Mês anterior">‹</button><b data-onclick="pickResumo()"><span>${nomeM}</span><small>${y} ▾</small></b><button data-onclick="resMes(1)" aria-label="Próximo mês">›</button></div>
  ${archBanner(y)}${ativHtml()}${bankNotesHtml()}${blocks('resumo', B)}
  ${db.prefs.resumoEnxuto ? '<div style="text-align:center;margin:2px 0 16px"><button class="linkBtn" data-onclick="openResumoEdit()">Ver mais informações no resumo</button></div>'
    : `<div class="btns u-mb12"><button class="btn" data-onclick="openResumoEdit()">${I('sliders')}Personalizar o Resumo</button></div>`}`;
}
// Sugestões de lançamento a partir das notificações de bancos, carteiras digitais e apps de vale (opcional, só no APK;
// ver BankListener no lado nativo, que marca n.tipo = 'vale' ou 'carteira').
// Tela para escolher quais blocos aparecem no Resumo e em que ordem.
// Vale para qualquer aba que tenha blocos em LAYOUT (Resumo, Ganhos, Gastos, Investir).
function openLayoutEdit(tab = state.tab){
  const defs = LAYOUT[tab], shown = b => db.prefs.fun || !FUN_BLOCKS.includes(b.k);
  const r = layoutOf(tab).map((b, i) => ({b, i})).filter(x => shown(x.b)); // i = posição na lista completa
  settingsOpen = false; F = null;
  showSheet(`<h3>Personalizar: ${tab === 'widget' ? 'widget Resumo' : TABS[tab][1]}</h3>
    <div class="semTopo hint">Toque no círculo para mostrar ou esconder um bloco e use as setas para mudar a ordem.</div>
    ${r.map(({b, i}, n) => `<div class="item u-linha">
      <button class="iconbtn ${b.on ? 'in' : 'muted'}" data-onclick="layoutSet('${tab}',${i},'toggle')" aria-label="${b.on ? 'Esconder' : 'Mostrar'}">${I(b.on ? 'checked' : 'unchecked', 24)}</button>
      <div class="mid" style="${b.on ? '' : 'opacity:.5'}"><b class="quebra">${defs[b.k][0]}</b></div>
      <button class="iconbtn u-apagado" data-onclick="layoutSet('${tab}',${i},${n ? r[n - 1].i : i})" ${n ? '' : 'disabled'} aria-label="Subir">▲</button>
      <button class="iconbtn u-apagado" data-onclick="layoutSet('${tab}',${i},${n < r.length - 1 ? r[n + 1].i : i})" ${n < r.length - 1 ? '' : 'disabled'} aria-label="Descer">▼</button></div>`).join('')}
    <div class="btns"><button class="btn" data-onclick="layoutSet('${tab}',0,'reset')">Restaurar padrão</button><button class="btn primary" data-onclick="closeForm()">Pronto</button></div>`);
}
const openResumoEdit = () => openLayoutEdit('resumo');
// op: 'toggle', 'reset' ou a posição com a qual o bloco i troca de lugar.
function layoutSet(tab, i, op){
  const r = layoutOf(tab);
  // Resumo: a primeira personalização tira o link "Ver mais informações" e o bloco mexido deixa de ligar sozinho.
  if (tab === 'resumo'){ db.prefs.resumoEnxuto = false; db.prefs.resumoAuto = op === 'reset' ? [] : (db.prefs.resumoAuto || []).filter(k => k !== r[i].k); }
  if (op === 'toggle') r[i].on = !r[i].on;
  else if (op === 'reset'){ const novo = Object.entries(LAYOUT[tab]).map(([k, d]) => ({k, on:!!d[1]})); if (tab === 'resumo') db.prefs.resumo = novo;
    else db.prefs.layout[tab] = novo; }
  else [r[i], r[op]] = [r[op], r[i]];
  db.cfgMod = Date.now(); save(); render(); openLayoutEdit(tab);
}

// Vale-refeição e vale-alimentação: parte própria nas abas Gastos (o que foi gasto no vale) e Ganhos (os créditos).
// Para cada vale: o crédito e o gasto do mês e o saldo acumulado. Nada disso entra nos totais do mês.
function viewVales(lado){
  const m = state.month, gastos = lado === 'gastos', lista = gastos ? valeOut(m) : valeIn(m);
  const novo = k => `event.stopPropagation();novoVale('${lado}','${k}')`;
  return `${navMes()}
  ${Object.keys(VALES).map(k => { const c = sum(valeIn(m, k), x => x.value), g = sum(valeOut(m, k), x => x.value), s = valeSaldo(k, m); return `
    <div class="card u-clicavel" data-onclick="openVale('${k}')"><b class="valeTit">${valeEmp(k) ? bancoSelo(valeEmp(k)) : I(CAT_GANHO[k][0])}
      ${VALES[k]}${valeEmp(k) ? ' · ' + esc(valeEmp(k)) : ''}</b>
      <div class="grid3" style="margin-top:10px">
        <div class="stat"><small>Crédito do mês</small><b class="in u-fs14">${fmt(c)}</b></div>
        <div class="stat"><small>Gasto do mês</small><b class="out u-fs14">${fmt(g)}</b></div>
        <div class="stat"><small>Saldo do vale</small><b class="${s < 0 ? 'out' : ''} u-fs14">${fmt(s)}</b></div></div>
      <div class="btns"><button class="btn" data-onclick="${novo(k)}">${gastos ? '+ Gasto neste vale' : '+ Crédito deste vale'}</button><button class="btn">${I('doc')}Histórico</button></div></div>`; }).join('')}
  <h2>${gastos ? 'Gastos nos vales' : 'Créditos dos vales'}</h2>
  ${lista.length ? `<div class="card">${lista.map(x => gastos ? expRow(x, m) : incRow(x)).join('')}</div>`
    : empty(gastos ? 'receipt' : 'wallet', gastos ? 'Nenhum gasto nos vales em ' + monthName(m) + '.' : 'Nenhum crédito de vale em ' + monthName(m) + '.<br>Cadastre o crédito como fixo para ele entrar todo mês.')}
  <div class="hint u-centro">Os vales ficam separados: não entram nos ganhos, nos gastos nem no saldo do mês. O saldo do vale é tudo o que entrou menos o que saiu desde o primeiro lançamento. ${gastos ? 'Um gasto vem para cá quando a forma de pagamento é um vale.' : 'Um ganho vem para cá quando a categoria é um vale.'}</div>`;
}
// Seletor do mês de Gastos, Ganhos e Vales (state.month, o mesmo nas três): setas e o mês com ▾ (pickMonth).
const navMes = () => `<div class="nav"><button data-onclick="state.month=addMonths(state.month,-1);renderIn()">‹</button><b data-onclick="pickMonth()">${monthName(state.month)} ▾</b><button data-onclick="state.month=addMonths(state.month,1);renderIn()">›</button></div>`;
const ganhosSeg = () => `<div class="seg">${[['todos','Ganhos'],['vale','Vales']].map(([k,t]) => `<button class="${state.isub === k ? 'on' : ''}" data-onclick="state.isub='${k}';renderIn()">${t}</button>`).join('')}</div>`;
// Tela de um vale: saldo, totais e o histórico de tudo o que entrou e saiu nele, mês a mês (do mais novo ao mais antigo).
function openVale(k){
  settingsOpen = false; F = null;
  const todos = [...db.incomes.filter(x => x.cat === k), ...db.expenses.filter(x => x.pay === k), ...db.installments.filter(x => x.pay === k)];
  const ini = todos.reduce((a, x) => x.start < a ? x.start : a, curYM), fim = todos.reduce((a, x) => !x.fixed && x.start > a ? x.start : a, curYM), meses = [];
  for (let m = fim, i = 0; m >= ini && i < 240; m = addMonths(m, -1), i++){
    const e = valeIn(m, k), s = valeOut(m, k);
    if (e.length || s.length) meses.push([m, e, s]);
  }
  const tin = sum(meses, ([, e]) => sum(e, x => x.value)), tout = sum(meses, ([, , s]) => sum(s, x => x.value)), saldo = valeSaldo(k),
  n = sum(meses, ([, e, s]) => e.length + s.length);
  const linha = (x, entra) => `<div class="item" data-onclick="edit('${entra ? 'incomes' : x.kind === 'installment' ? 'installments' : 'expenses'}','${x.pid || x.id}')"><div class="mid"><b>${esc(x.desc)}</b>
    <small>${entra ? 'crédito' : 'gasto'}${entra ? (diaGanhoTexto(x) ? ' · ' + diaGanhoTexto(x) : '') : x.day ? ' · dia ' + x.day : ''}${x.emp ? `<span class="tag">${esc(x.emp)}</span>` : ''}${byTag(x)}</small></div><div class="val ${entra ? 'in' : 'out'}">${entra ? '+' : '−'} ${fmt(x.value)}</div></div>`;
  showSheet(`<h3 class="valeTit">${valeEmp(k) ? bancoSelo(valeEmp(k)) : ''}${VALES[k]}${valeEmp(k) ? ' · ' + esc(valeEmp(k)) : ''}</h3>
    <div class="hero" style="margin-bottom:10px"><small>Saldo do vale</small>${bigNum(saldo)}
      <div class="row"><div><small>Entrou no total</small><b>${fmt(tin)}</b></div><div><small>Saiu no total</small><b>${fmt(tout)}</b></div></div></div>
    <div class="semTopo btns"><button class="btn" data-onclick="novoVale('ganhos','${k}')">+ Crédito</button><button class="btn primary" data-onclick="novoVale('gastos','${k}')">+ Gasto</button></div>
    <label>Histórico (${n} ${n === 1 ? 'lançamento' : 'lançamentos'})</label>
    ${meses.length ? meses.map(([m, e, s]) => `<div class="semCursor grpHead on"><b>${cap(monthName(m))}</b><small>${fmt(sum(e, x => x.value) - sum(s, x => x.value))}</small></div>
      <div class="plano card">${e.map(x => linha(x, true)).join('')}${[...s].sort((a, b) => (b.day || 0) - (a.day || 0)).map(x => linha(x, false)).join('')}</div>`).join('')
    : '<div class="semTopo hint">Nenhum lançamento neste vale ainda.</div>'}
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Quando repete um lançamento de "Em alguns meses" (repete, em calculos.js): "a cada 6 meses: jun e dez", "jan, fev e
// mar" ou, num ciclo que não fecha no ano, "a cada 5 meses, desde mar/2026". No idioma do app (tf).
const mesAbr = m => trText(MESES[m - 1].slice(0, 3));
const listaE = l => l.length > 1 ? tf('{} e {}', l.slice(0, -1).join(', '), l[l.length - 1]) : l[0] || '';
function repTexto(x){
  if (Array.isArray(x.rep)) return listaE(x.rep.map(mesAbr));
  if (12 % x.rep) return tf('a cada {} meses, desde {}', x.rep, trText(mesAbrev(x.start)));
  const ms = [...Array(12 / x.rep)].map((_, i) => (+x.start.slice(5) - 1 + i * x.rep) % 12 + 1).sort((a, b) => a - b);
  return tf('a cada {} meses: {}', x.rep, listaE(ms.map(mesAbr)));
}
// Tipo de um lançamento nas exportações (planilha, CSV, relatório): parcela, "a cada 6 meses: jun e dez", anual, fixo ou avulso.
const tipoLanc = x => x.kind === 'installment' ? parcTag(x) : repete(x) ? repTexto(x) : x.fixed === 'y' ? 'anual' : x.fixed ? 'fixo' : 'avulso';
// O mesmo, no resumo do formulário (Tipo 'n' ou 'm', ver REP_FIELDS); '' enquanto falta o número ou os meses.
const repResumo = v => { const rep = v.fixed === 'n' ? +v.cada : v.fixed === 'm' ? mesesDe(v.meses) : 0;
  return v.start && (Array.isArray(rep) ? rep.length : rep >= 2 && rep <= 24) ? repTexto({rep, start:v.start}) : ''; };
// Uma linha da lista de ganhos.
function incRow(x){ const c = CAT_GANHO[x.cat] || CAT_GANHO.outros; return `
    <div class="item" data-onclick="edit('incomes','${x.id}')">${ico(c)}<div class="mid"><b>${esc(x.desc)}</b>
    <small>${esc(c[1])}${x.bank ? ' · ' + esc(x.bank) : ''}${x.emp ? `<span class="tag">${esc(x.emp)}</span>` : ''}<span class="tag">${repete(x) ? repTexto(x) : x.fixed === 'y' ? 'anual, em ' + MESES[+x.start.slice(5) - 1] : x.fixed ? 'fixo' : monthName(x.start)}${diaGanhoTexto(x) ? ', ' + diaGanhoTexto(x) : ''}</span>${x.fixed ? `<span class="tag">desde ${x.fixed === 'y' ? x.start.slice(0,4) : monthName(x.start)}${x.end ? ' até ' + monthName(x.end) : ''}</span>` : ''}${byTag(x)}</small></div>
    <div class="val in">${fmt(x.value)}</div></div>`; }
// Ordem das listas de Gastos e Ganhos: db.prefs.ordem = 'ant' (mais antigo primeiro) ou qualquer outro valor (mais
// recente primeiro, o padrão). O botão alterna.
const ordemBtn = () => `<button data-onclick="setOrdem()">${db.prefs.ordem === 'ant' ? '↑ Mais antigo' : '↓ Mais recente'}</button>`;
function setOrdem(){ db.prefs.ordem = db.prefs.ordem === 'ant' ? 'rec' : 'ant'; db.cfgMod = Date.now(); save(); render(); }
function viewGanhos(){
  if (state.isub === 'vale') return `${head('Ganhos', 'ganhos')}${ganhosSeg()}${viewVales('ganhos')}`;
  // Os ganhos do mês escolhido (state.month, o mesmo de Gastos): fixos ativos nele, anuais que caem nele e avulsos dele.
  const m = state.month, doMes = db.incomes.filter(x => !valeGanho(x) && activeIn(x, m));
  const row = incRow, sinal = db.prefs.ordem === 'ant' ? -1 : 1, quando = x => x.start + String(x.day || 0).padStart(2, '0');
  const ordena = l => [...l].sort((a, b) => sinal * quando(b).localeCompare(quando(a)));
  const fixed = ordena(doMes.filter(isMonthly)), yearly = ordena(doMes.filter(x => x.fixed === 'y' && !repete(x))), once = ordena(doMes.filter(x => !x.fixed));
  const alguns = ordena(doMes.filter(repete));
  const B = {
  total: () => `<div class="hero"><small>Ganhos em ${monthName(m)}</small>${bigNum(totalIn(m))}
    <small>Fixos mensais: ${fmt(sum(fixed, x => x.value))}</small></div>`,
  fixos: () => `<h2>Fixos (todo mês) ${ordemBtn()}</h2>
  ${fixed.length ? `<div class="card">${fixed.map(row).join('')}</div>` : empty('briefcase', 'Cadastre seu salário e outros ganhos fixos.<br>Eles entram automaticamente em todos os meses.',
    ['+ Ganho fixo', "openForm('incomes', null, {vals:{fixed:'1'}})"])}`,
  alguns: () => alguns.length ? `<h2>Em alguns meses</h2><div class="card">${alguns.map(row).join('')}</div>` : '',
  anuais: () => `<h2>Anuais (uma vez por ano)</h2>
  ${yearly.length ? `<div class="card">${yearly.map(row).join('')}</div>` : empty('gift', `Nenhum ganho anual em ${monthName(m)}.<br>13º, férias, bônus: escolha o mês em que você recebe.`)}`,
  avulsos: () => `<h2>Ganhos avulsos</h2>
  ${once.length ? `<div class="card">${once.map(row).join('')}</div>` : empty('wallet', `Nenhum ganho avulso em ${monthName(m)}.`)}`
  };
  return head('Ganhos', 'ganhos') + ganhosSeg() + navMes() + blocks('ganhos', B)
    + `<div class="btns u-mb12"><button class="cresce btn danger" data-onclick="openApagar('ganhos')">${I('trash')}Apagar por dia, mês ou ano</button></div>`;
}

// Comparativo: gasto de cada categoria no mês m, no mês anterior e na média dos 6 meses antes de m.
function compareMonths(m){
  const byCat = ym => { const g = {}; expensesOf(ym).forEach(x => g[x.cat] = (g[x.cat] || 0) + x.value); return g; };
  const cur = byCat(m), prev = byCat(addMonths(m, -1)), past = [...Array(6)].map((_,i) => byCat(addMonths(m, -1 - i)));
  return [...new Set([...Object.keys(cur), ...Object.keys(prev)])]
    .map(cat => ({cat, cur:cur[cat] || 0, prev:prev[cat] || 0, avg:sum(past, g => g[cat] || 0) / 6})).sort((a,b) => b.cur - a.cur);
}
// Gastos divididos ainda não recebidos: [{x, m}]. Avulso gera uma linha; fixo ou anual, uma por mês
// (ou ano) já ocorrido e ainda não marcado em x.sm.
function owedList(){
  const out = [];
  for (const x of db.expenses){
    if (!x.share || !x.who) continue;
    if (!x.fixed){ if (!x.settled) out.push({x, m:x.start}); continue; }
    for (let m = activeIn(x, x.start) ? x.start : proximoMes(x, x.start); m && m <= curYM; m = proximoMes(x, m)) if (!(x.sm || []).includes(m)) out.push({x, m});
  }
  return out;
}
// Marca a parte da outra pessoa como recebida (no gasto fixo, só a do mês m).
function settle(id, m){
  const x = db.expenses.find(e => e.id === id), set = on => {
    if (x.fixed) x.sm = on ? (x.sm || []).concat(m) : (x.sm || []).filter(k => k !== m); else x.settled = on;
    touch(x); save(); render();
  };
  set(true);
  showUndo('Marcado como recebido', () => set(false));
}

// ---------- Peças de tela que estavam em util.js e calculos.js (número grande, olho, aviso do arquivo antigo) ----------
// Valor grande dos cartões (.hero .big): leva o número em data-v e o formato em data-f ('c' = fmtCurto), para a
// animação de contagem do modo divertido (funCount) usar o valor de verdade e o mesmo formato do cartão.
const bigNum = (v, curto) => `<div class="big" data-v="${+v || 0}"${curto ? ' data-f="c"' : ''}>${curto ? fmtCurto(v) : fmt(v)}</div>`;
// Valores lado a lado (.hero .row, .grid2, .grid3): as colunas têm largura fixa (app.css). Se um valor não cabe na dele,
// os valores da linha diminuem juntos, na mesma proporção, até o maior caber (no mínimo 60%). Roda depois de desenhar a
// tela ou uma folha, ao mudar o tamanho da janela e quando a fonte de um tema termina de carregar.
function valoresCabem(root = document){
  // Primeiro só escreve (volta ao tamanho original), depois só mede (todas as linhas de uma vez) e no fim só escreve:
  // medir no meio das mudanças fazia o navegador recalcular a tela uma vez por linha.
  const linhas = [...root.querySelectorAll('.hero .row, .grid2, .grid3')].map(r => [...r.querySelectorAll(':scope > * > b')]);
  for (const bs of linhas) for (const b of bs){ if (!('fs' in b.dataset)) b.dataset.fs = b.style.fontSize; b.style.setProperty('font-size', b.dataset.fs); }
  const ajustes = linhas.map(bs => { const k = Math.min(1, ...bs.filter(b => b.scrollWidth > 0).map(b => b.clientWidth / b.scrollWidth));
    return k < 1 ? bs.map(b => [b, parseFloat(getComputedStyle(b).fontSize) * Math.max(.6, k * .98)]) : []; });
  for (const a of ajustes) for (const [b, px] of a) b.style.setProperty('font-size', px + 'px', 'important');
}
let valoresT = 0;
addEventListener('resize', () => { clearTimeout(valoresT); valoresT = setTimeout(valoresCabem, 150); });
if (document.fonts) document.fonts.addEventListener('loadingdone', () => valoresCabem());
const eyeBtn = () => `<button class="iconbtn" data-onclick="toggleHide()" aria-label="${hideVals ? 'Mostrar valores' : 'Esconder valores'}">${I(hideVals ? 'eyeOff' : 'eye', 24)}</button>`;
const archBanner = y => !db.archUntil || String(y) > db.archUntil ? '' : `<div class="offline">${I('box', 14)}${arch
  ? 'Período arquivado: estes lançamentos vêm do arquivo e não podem ser editados.'
  : canSync() && sync.on ? 'Período arquivado: carregando o arquivo da sua conta…' : 'Período arquivado: entre com a conta Google para ver os lançamentos.'}</div>`;
function toggleHide(){ hideVals = !hideVals; try { localStorage.setItem(HIDE_KEY, hideVals ? '1' : ''); } catch(e){} render(); }
