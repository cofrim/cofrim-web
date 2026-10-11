// Cofrim — Aparência: abas, cores, temas (SKINS), modo claro/escuro (applyTheme),
// blocos de cada tela (LAYOUT) e o estado da tela (state).
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md e ARCHITECTURE.md).

// ---------- Aparência: tema e ordem das abas ----------
const TABS = {resumo:['chart','Resumo'], ganhos:['income','Ganhos'], gastos:['receipt','Gastos'], invest:['trend','Investir'],
  noticias:['news','Notícias'], chat:['chat','Assistente'], explorar:['more','Explorar']};
// nome, par de cores para o modo claro (também usado nos cartões de destaque), par para o modo escuro,
// e matiz + saturação da cor: delas saem o fundo, os cartões, as linhas e os tons dos gráficos.
const COLORS = {
  // Cor padrão (chave 'indigo', guardada nos dados de quem já usa): o roxo do ícone do Cofrim (#6b33b4, o centro do icon.svg).
  indigo:['Cofrim','#6b33b4','#4c1e7f','#b48df0','#c9a6f5', 266, 56], esmeralda:['Esmeralda','#047857','#0f766e','#34d399','#2dd4bf', 165, 75],
  oceano:['Oceano','#0369a1','#1d4ed8','#38bdf8','#60a5fa', 212, 85], rosa:['Rosa','#be185d','#a21caf','#f472b6','#e879f9', 322, 75],
  laranja:['Laranja','#c2410c','#b45309','#fb923c','#fbbf24', 26, 88], grafite:['Grafite','#475569','#1e293b','#cbd5e1','#94a3b8', 215, 14],
  vermelho:['Vermelho','#b91c1c','#be123c','#f87171','#fb7185', 0, 75], roxo:['Roxo','#7e22ce','#6d28d9','#c084fc','#a78bfa', 272, 75],
  turquesa:['Turquesa','#0f766e','#0e7490','#2dd4bf','#22d3ee', 182, 70], dourado:['Dourado','#854d0e','#a16207','#facc15','#fbbf24', 42, 85],
  limao:['Verde-limão','#3f6212','#4d7c0f','#a3e635','#bef264', 85, 70], cafe:['Café','#7c2d12','#78350f','#fdba74','#fcd34d', 20, 45]
};
// Temas especiais: trocam as cores do app inteiro (menos os ícones das categorias, que ficam com a cor própria de cada
// uma), o mascote do modo divertido (MASCOTES) e, se a pessoa quiser, o ícone do app.
// [nome, escuro?, destaque, destaque 2, cartão de destaque 1 e 2, fundo, cartões, linhas, texto secundário, texto, matiz, saturação]
const SKINS = {
  hacker:['Hacker', true, '#22c55e', '#4ade80', '#052e16', '#166534', '#020a04', '#07140b', '#14532d', '#86efac', '#d1fae5', 140, 70],
  boneca:['Boneca', false, '#be185d', '#db2777', '#db2777', '#c026d3', '#fff0f7', '#ffffff', '#fbcfe8', '#9d174d', '#500724', 328, 80],
  corrida:['Corrida', true, '#ef4444', '#f59e0b', '#991b1b', '#1f2937', '#0c0c0f', '#17171c', '#2a2a33', '#a1a1aa', '#fafafa', 0, 70],
  neon:['Neon', true, '#f472b6', '#22d3ee', '#7c3aed', '#db2777', '#0d0221', '#1a0b3b', '#3b1d7a', '#c4b5fd', '#f5f3ff', 290, 80],
  papel:['Papel antigo', false, '#7c2d12', '#92400e', '#78350f', '#92400e', '#f5efe0', '#fffaf0', '#e7dcc3', '#6b5a3e', '#2b2118', 35, 45],
  praia:['Praia', false, '#0e7490', '#0369a1', '#0e7490', '#155e75', '#fdf6e3', '#ffffff', '#f0e2bd', '#5b6b73', '#0c2a33', 190, 70],
  noite:['Noite estrelada', true, '#f4d35e', '#9cc0e7', '#1e3a8a', '#274690', '#0b1437', '#13205a', '#2b3f8f', '#b4c6f0', '#f4f7ff', 225, 75],
  // inspirado no quadro de Van Gogh
  bruxo:['Bruxo', true, '#eab308', '#fbbf24', '#7f1d1d', '#991b1b', '#1a0b0e', '#2a1216', '#4a1f26', '#d6b3a0', '#fdf4e3', 0, 60],
  espaco:['Espaço', true, '#a78bfa', '#38bdf8', '#312e81', '#4338ca', '#05060f', '#0e1024', '#1f2347', '#a5b4d4', '#eef2ff', 240, 60],
  floresta:['Floresta', false, '#166534', '#3f6212', '#166534', '#3f6212', '#eef5e6', '#fbfdf7', '#cfe3bf', '#4b5d3f', '#1a2e12', 110, 45],
  retro:['Retrô 8-bit', true, '#facc15', '#fb7185', '#7c3aed', '#be185d', '#12121c', '#1e1e2e', '#3a3a55', '#b8b8d0', '#f8f8f2', 250, 30],
  dragao:['Dragão', true, '#a3e635', '#4ade80', '#111827', '#064e3b', '#07090c', '#11151b', '#232a33', '#9ca3af', '#f3f4f6', 150, 20],
  grandprix:['Grand Prix', false, '#b91c1c', '#1d4ed8', '#b91c1c', '#1e3a8a', '#f4f6fb', '#ffffff', '#d9e0ee', '#475569', '#0f172a', 0, 70],
  rua:['Corrida de rua', true, '#fb923c', '#a3e635', '#7c2d12', '#1c1917', '#0c0a09', '#1c1917', '#33302c', '#a8a29e', '#fafaf9', 25, 70],
  drift:['Drift', true, '#fb7185', '#fde68a', '#b91c1c', '#1e293b', '#0b0f1a', '#151b2b', '#27304a', '#a8b3cf', '#f8fafc', 350, 70],
  fusca:['Fusca de corrida', false, '#1d4ed8', '#b91c1c', '#1e40af', '#b91c1c', '#f7f3e8', '#fffdf6', '#e5dcc5', '#5c5546', '#1f1b12', 45, 50],
  vikings:['Vikings', true, '#7dd3fc', '#fbbf24', '#1e3a5f', '#334155', '#0b1220', '#141d2e', '#26334d', '#9fb0c8', '#f1f5f9', 210, 45],
  espartano:['Espartano', true, '#f87171', '#e5e7eb', '#7f1d1d', '#374151', '#0f0f10', '#1a1a1c', '#2e2e33', '#a3a3a3', '#f5f5f5', 0, 30]
};
// Temas por categoria (js/temas.js): só trazem os destaques, o matiz e a saturação; o resto sai daí, como nas cores comuns.
const SKIN_ANTIGOS = Object.keys(SKINS); // os primeiros temas: têm ícone do app também com os desenhos de barras e porquinho
for (const [k, [nome, escuro, c1, c2, h1, h2, h, s]] of Object.entries(TEMAS_NOVOS))
  SKINS[k] = [nome, escuro, c1, c2, h1, h2, escuro ? hslHex(h, s * .5, 7) : hslHex(h, s * .6, 96), escuro ? hslHex(h, s * .42, 12) : '#ffffff',
    escuro ? hslHex(h, s * .38, 19) : hslHex(h, s * .5, 90), escuro ? hslHex(h, s * .22, 68) : hslHex(h, s * .2, 37),
    escuro ? hslHex(h, s * .3, 96) : hslHex(h, s * .5, 12), h, s];
// Cores do ícone do app: as do tema e as dos temas especiais (cada uma tem um ícone pronto no APK).
const ICONES = {...COLORS, ...Object.fromEntries(Object.entries(SKINS).map(([k, s]) => [k, [s[0], s[4], s[2]]]))};
const APP_NOMES = ['Cofrim', 'Finanças', 'Carteira', 'Meu Dinheiro']; // nomes que o app pode ter na tela inicial (lista fixa no APK)
function hslHex(h, s, l){
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l),
  f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return '#' + f(0) + f(8) + f(4);
}
let theme = {h:245, s:80, dark:false}; // preenchido por applyTheme
// Tom i de n da cor do tema, do mais forte ao mais suave (fatias e legendas dos gráficos).
const shade = (i, n) => hslHex(theme.h, theme.s * .9, theme.dark ? 76 - i * 44 / Math.max(n, 1) : 34 + i * 44 / Math.max(n, 1));
const MODES = {auto:'Automático', light:'Claro', dark:'Escuro'};
// Blocos disponíveis na aba Resumo: [nome, aparece por padrão]. O conteúdo de cada um está em viewResumo.
const RESUMO = {mascote:['Porquinho (modo divertido)', 1, 1], atalhos:['Atalhos para adicionar', 1, 1],
  destaque:['Gastos do mês e do ano', 1, 1], rosca:['Gastos por categoria no mês', 1, 1], dias:['Calendário de gastos do mês', 1, 1],
  alertas:['Contas a vencer e avisos de orçamento', 1], saldo:['Saldo do ano', 1], grafico:['Gráfico de ganhos e gastos', 1],
  numeros:['Média de gastos e total investido', 1], previsao:['Previsão dos próximos meses', 1], contas:['Contas bancárias', 1],
  planejar:['Planejamento (reserva, assinaturas, dívidas)', 1], categorias:['Gastos por categoria', 1], bancos:['Gastos por banco', 1],
  pagamentos:['Gastos por forma de pagamento', 1], mes:['Resumo do mês atual', 0], faturas:['Faturas do cartão do mês', 0], parcelas:['Compras parceladas', 0],
  metas:['Metas', 0], invest:['Investimentos', 0], vales:['Vale-refeição e alimentação', 1], conquistas:['Conquistas (modo divertido)', 1]};
const FUN_BLOCKS = ['mascote', 'conquistas']; // só existem com o modo divertido ligado
// Blocos das outras abas, no mesmo formato. A ordem e o que aparece ficam em db.prefs.layout[aba]
// (o Resumo usa db.prefs.resumo, que já existia). O conteúdo de cada bloco está na função view da aba.
const LAYOUT = {
  resumo:RESUMO,
  ganhos:{total:['Total de ganhos do mês', 1], fixos:['Fixos (todo mês)', 1], anuais:['Anuais (uma vez por ano)', 1], avulsos:['Ganhos avulsos', 1]},
  gastos:{mes:['Ganhos, gastos e saldo do mês', 1], saude:['Saúde financeira', 1, 'mes'], orcamento:['Orçamento do mês', 1],
    previsoes:['Previsões', 1, 'orcamento'], comparativo:['Comparativo por categoria', 1], receber:['A receber de gastos divididos', 1],
    faturas:['Faturas do cartão', 1], lancamentos:['Lançamentos', 1], acoes:['Importar extrato, relatório e planilha', 1]},
  // Linhas do widget Resumo da tela inicial (não é uma aba: ver updateWidget e Configurações > Widgets).
  widget:{saldo:['Saldo do mês', 1], ganhos:['Ganhos do mês', 1], gastos:['Gastos do mês', 1], conta:['Próxima conta a vencer', 1],
    contas:['Saldo nas contas', 0], invest:['Total investido', 0],
    vales:['Saldo dos vales (refeição e alimentação)', 0], fatura:['Faturas do cartão do mês', 0], orcamento:['Orçamento usado', 0],
    parcelas:['Parcelas do mês', 0], previsao:['Previsão do mês que vem', 0]},
  invest:{total:['Total investido e projeção', 1], evolucao:['Evolução do total investido', 1], metas:['Metas', 1],
    carteira:['Meus investimentos', 1], taxas:['Taxas usadas na projeção', 1]}
};
// Grupos da lista de lançamentos da aba Gastos: [nome, quais lançamentos entram].
const GRUPOS = {
  sub:['Assinaturas', x => isSub(x)],
  fix:['Fixos e anuais', x => x.fixed && !isSub(x)],
  parc:['Parceladas', x => x.kind === 'installment'],
  avu:['Ocasionais', x => !x.fixed && x.kind !== 'installment']};
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function ensurePrefs(){
  const p = db.prefs = Object.assign({mode:'auto', color:'indigo', tabs:[], remind:0, anim:true, notifyCats:{}, font:1, fun:false, rollBudget:false,
    catColor:false, skin:''}, db.prefs);
  if (!SKINS[p.skin]) p.skin = '';
  // Notificações: notify liga/desliga tudo; remind = dias de antecedência; notifyCats[categoria] === false silencia a categoria.
  // resumo = blocos da aba Resumo, na ordem escolhida, cada um ligado ou desligado.
  // Bloco que ainda não está na lista salva (criado numa versão mais nova) entra no fim, no começo se d[2] = 1, ou logo
  // depois do bloco que d[2] nomeia.
  const fill = (list, defs) => {
    const r = (list || []).filter(b => defs[b.k]), novo = Object.entries(defs).filter(([k]) => !r.some(b => b.k === k)), item = ([k, d]) => ({k, on:!!d[1]});
    // d[2] com o nome de um bloco: o novo entra logo depois dele (ou no fim, se ele não estiver na lista).
    const out = novo.filter(([, d]) => d[2] === 1 || d[2] === true).map(item).concat(r, novo.filter(([, d]) => !d[2]).map(item));
    for (const n of novo.filter(([, d]) => typeof d[2] === 'string')){ const i = out.findIndex(b => b.k === n[1][2]);
      out.splice(i < 0 ? out.length : i + 1, 0, item(n)); }
    return out;
  };
  // Resumo de quem abre o app pela primeira vez (sem lista salva): só os blocos essenciais, nesta ordem; os outros ficam
  // em Personalizar, desligados (os do modo divertido seguem o modo divertido, como antes). resumoEnxuto mostra o link
  // "Ver mais informações no resumo" até a primeira personalização; resumoAuto = blocos que ainda ligam sozinhos com o
  // primeiro vale ou parcelamento (ver resumoAutoLiga). Quem já tem a lista salva não muda nada.
  if (!Array.isArray(p.resumo)){
    const ess = ['atalhos', 'destaque', 'alertas', 'rosca', 'contas'];
    p.resumo = ['mascote', ...ess,
      ...Object.keys(RESUMO).filter(k => k !== 'mascote' && !ess.includes(k))].map(k => ({k, on:ess.includes(k) || FUN_BLOCKS.includes(k)}));
    p.resumoEnxuto = true; p.resumoAuto = ['vales', 'parcelas'];
  }
  p.resumo = fill(p.resumo, RESUMO);
  // grpOrder = ordem dos grupos da lista de gastos (assinaturas, fixos, parceladas, ocasionais).
  p.grpOrder = [...(p.grpOrder || []).filter(k => GRUPOS[k]), ...Object.keys(GRUPOS).filter(k => !(p.grpOrder || []).includes(k))];
  p.layout = p.layout || {};
  for (const t of ['ganhos', 'gastos', 'invest', 'widget']) p.layout[t] = fill(p.layout[t], LAYOUT[t]);
  // tabsOff = abas escondidas do menu de baixo (o Resumo fica sempre: é por ele que se chega às configurações).
  p.tabsOff = (p.tabsOff || []).filter(t => TABS[t] && t !== 'resumo');
  // reminds = lista de antecedências escolhidas (ex.: [1, 3, 5] avisa três vezes, além do aviso no dia).
  if (p.notify === undefined) p.notify = p.remind > 0;
  if (!Array.isArray(p.reminds)) p.reminds = [p.remind || 3];
  p.tabs = p.tabs.filter(t => TABS[t]).concat(Object.keys(TABS).filter(t => !p.tabs.includes(t)));
}
// Na versão web não há aba Notícias: os sites de notícias não deixam o navegador ler os feeds (só o APK consegue).
// O assistente não fica no menu de baixo: abre pelo botão flutuante que aparece em todas as telas (ver render).
const visTabs = () => db.prefs.tabs.filter(t => t !== 'chat' && !db.prefs.tabsOff.includes(t) && !(t === 'noticias' && typeof WEB_APP !== 'undefined' && WEB_APP));
const layoutOf = tab => tab === 'resumo' ? db.prefs.resumo : db.prefs.layout[tab];
// Monta a tela: os blocos ligados da aba, na ordem escolhida. B = {chave: () => html}.
// Um bloco com erro (dado inesperado) não derruba a tela: no lugar dele fica um aviso, e o erro vai para o Diagnóstico.
// Cada bloco leva antes uma âncora vazia (b-<aba>-<bloco>), para a aba Explorar levar direto a ele (irBloco).
const blocks = (tab, B) => layoutOf(tab).filter(b => b.on && B[b.k]).map(b => {
  try { const h = B[b.k](); return h ? `<i class="ancora" id="b-${tab}-${b.k}"></i>${h}` : ''; }
  catch(e){ logErr(`bloco ${tab}.${b.k}`, e); return `<div class="card hint" style="margin-bottom:12px">Não foi possível mostrar esta parte da tela. O erro ficou registrado em Configurações › Diagnóstico.</div>`; }
}).join('');
function applyTheme(){
  const p = db.prefs, sk = SKINS[p.skin]; // tema especial: define tudo, inclusive claro ou escuro
  if (!moeda || moeda.cod !== (p.moeda || 'BRL')) definirMoeda(p.moeda || 'BRL'); // a moeda dos valores (util.js)
  const dark = sk ? sk[1] : p.mode === 'dark' || (p.mode === 'auto' && darkQuery.matches),
  c = sk ? [sk[0], sk[2], sk[3], sk[2], sk[3], sk[11], sk[12]] : COLORS[p.color] || COLORS.indigo;
  const st = document.documentElement.style;
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  document.documentElement.dataset.anim = p.anim ? 'on' : 'off';
  document.documentElement.dataset.fun = p.fun ? 'on' : 'off';
  document.documentElement.dataset.skin = sk ? p.skin : '';
  document.documentElement.dataset.ui = sk && TEMAS_IMG[p.skin] ? TEMAS_IMG[p.skin][0] : ''; // estilo de interface do tema (app.css)
  document.body.style.zoom = p.font; // tamanho do texto: amplia ou reduz a tela inteira por igual
  st.setProperty('--brand', c[dark ? 3 : 1]); st.setProperty('--brand2', c[dark ? 4 : 2]);
  st.setProperty('--hero1', sk ? sk[4] : c[1]); st.setProperty('--hero2', sk ? sk[5] : c[2]);
  // Fundo, cartões, linhas e texto secundário levam um toque da cor do tema.
  const h = c[5], s = c[6];
  theme = {h, s, dark};
  const bg = sk ? sk[6] : dark ? hslHex(h, s * .5, 7) : hslHex(h, s * .6, 96), card = sk ? sk[7] : dark ? hslHex(h, s * .42, 12) : '#ffffff';
  st.setProperty('--bg', bg); st.setProperty('--card', card);
  st.setProperty('--line', sk ? sk[8] : dark ? hslHex(h, s * .38, 19) : hslHex(h, s * .5, 90));
  st.setProperty('--muted', sk ? sk[9] : dark ? hslHex(h, s * .22, 68) : hslHex(h, s * .2, 37));
  if (sk) st.setProperty('--text', sk[10]); else st.removeProperty('--text');
  // Cores da tela de abertura da próxima vez (lidas pelo index.html antes de tudo).
  try { localStorage.setItem('financas-abre', JSON.stringify([sk ? sk[4] : c[1], sk ? sk[5] : c[2]])); } catch(e){}
  if (window.webIcone) webIcone(); // versão web: o ícone indicado pela página acompanha o tema
  if (window.cenaAplicar) cenaAplicar(); // fundo animado do tema especial (js/cena.js)
  // barras do sistema no APK
  if (temNativo('cores')) nativo('cores', bg, card, dark);
  else if (temNativo('tema')) nativo('tema', dark);
}
darkQuery.addEventListener('change', applyTheme);
ensurePrefs();
applyTheme();

// Data de hoje, lida do relógio do aparelho. É relida sempre que o app volta para a tela
// (ver "visibilitychange" no fim), para o mês atual virar sozinho mesmo com o app aberto.
let now = new Date();
let curYM = ymOf(now.getFullYear(), now.getMonth());
const todayLabel = () => now.toLocaleDateString(LOCALES[lang()], {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const state = {tab:visTabs()[0], year:now.getFullYear(), month:curYM, sel:'', q:'', fcat:'', fbank:'', fpay:'', ftag:'', limit:60, gsub:'mes',
  isub:'todos', parcDet:''}; // gsub: parte da aba Gastos (do mês / parceladas / vales); isub: parte da aba Ganhos (todos / vales)
