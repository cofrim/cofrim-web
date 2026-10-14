// Cofrim — Modo divertido: mascote no Resumo, conquistas, confete e recados (os mascotes e as falas: MASCOTES e FUN_TEMA).
// Carregado pelo index.html, nesta ordem: dados.js, telas.js, assistente.js, formularios.js, divertido.js, config.js, sincronizacao.js, entrada.js, inicio.js.
// ---------- Modo divertido (db.prefs.fun) ----------
// Porquinho no Resumo, conquistas, confete e recados ao salvar. Nada disso muda os dados: tudo é calculado na hora.
// A sequência de dias fica só neste aparelho (FUN_KEY).
const FUN_KEY = 'financas-fun';
const funState = {last:'', streak:0, tap:0};
try { Object.assign(funState, JSON.parse(localStorage.getItem(FUN_KEY))); } catch(e){}
function funVisit(){
  const dia = d => d.toLocaleDateString('sv'), hoje = dia(now);
  if (funState.last === hoje) return;
  funState.streak = funState.last === dia(new Date(now.getTime() - 864e5)) ? funState.streak + 1 : 1;
  funState.best = Math.max(funState.best || 0, funState.streak); // a conquista da sequência não se perde quando ela quebra
  funState.last = hoje;
  try { localStorage.setItem(FUN_KEY, JSON.stringify(funState)); } catch(e){}
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const FUN_SAVED = {
  expenses:['Anotado! A carteira sentiu, mas sobreviveu.', 'Gasto registrado. O porquinho viu tudo.', 'Mais um pra conta. Literalmente.',
    'Registrado! Saber para onde vai o dinheiro já é meio caminho.'],
  installments:['Parcelado registrado. O você do futuro mandou um abraço meio torto.', 'Anotado! Parcela é gasto de pijama: discreto, mas tá lá.'],
  incomes:['Dinheiro na conta, {nome}! O porquinho fez a dancinha.', 'Caiu! Hora de fingir costume.', 'Ganho registrado. Continue assim, {nome}!'],
  investments:['Investimento registrado. O seu eu do futuro agradece.', 'Plantou hoje, colhe depois.'],
  goals:['Meta criada! Sonho com prazo vira plano.'],
  goalAdd:['Mais perto da meta! O porquinho aprova.', 'Guardado! Cada moedinha conta.'],
  invAdd:['Aporte feito. Juros compostos, podem trabalhar!', 'Aporte registrado. Devagar e sempre.']
};
const FUN_PAID = ['Conta paga! Menos um boleto no mundo.', 'Pago! Boleto derrotado.', 'Em dia! O porquinho respira aliviado.'];
const FUN_LEVELS = [[0, 'Cofrinho vazio'], [5, 'Aprendiz da poupança'], [15, 'Caçador de boletos'], [30, 'Mestre do orçamento'],
  [50, 'Guardião do cofrinho'], [75, 'Lenda das finanças'], [100, 'Mito do porquinho']];
// Mensagens com o nome da pessoa: {nome} vira o nome; sem nome cadastrado, some junto com a vírgula.
const comNome = s => myName() ? s.replace(/\{nome\}/g, myName()) : s.replace(/,? ?\{nome\}/g, '').replace(/^\s*[a-zà-ú]/, c => c.toUpperCase());
// Texto do aviso depois de salvar um formulário (e confete nas boas notícias).
function savedMsg(col, isNew){
  const a = FUN_SAVED[col];
  if (!db.prefs.fun || !a || (!isNew && col !== 'goalAdd' && col !== 'invAdd')) return 'Salvo';
  if (col !== 'expenses' && col !== 'installments') confetti();
  return comNome(pick(semPorquinho(a)));
}
// Com um tema especial o mascote é o personagem do tema: saem as frases que falam do porquinho.
const semPorquinho = a => db.prefs.skin ? a.filter(t => !/porquinho|oinc/i.test(t)) : a;
// Humor do porquinho pelo saldo do mês atual.
function funMood(){
  const tin = totalIn(curYM), tout = totalOutPrev(curYM), net = tin - tout; // saldo projetado (com as previsões)
  return !tin && !tout ? 'ok' : net < 0 ? 'triste' : net >= tin * .1 ? 'feliz' : 'ok';
}
// Desafio do mês: gastar menos em avulsos do que no mês anterior, na categoria em que mais se gastou (mínimo de R$ 50).
// Devolve {cat, target, used, ok} ou null se não houve gasto avulso no mês anterior.
function challenge(m){
  const by = ym => { const g = {}; expensesOf(ym).forEach(x => { if (x.kind === 'expense' && !x.fixed) g[x.cat] = (g[x.cat] || 0) + x.value; }); return g; };
  const prev = by(addMonths(m, -1)), top = Object.entries(prev).filter(([, v]) => v >= 50).sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  const used = by(m)[top[0]] || 0;
  return {cat:top[0], target:top[1], used, ok:used < top[1]};
}
// Desafios cumpridos nos últimos 6 meses já encerrados.
const challengeWins = () => [...Array(6)].filter((_, i) => { const c = challenge(addMonths(curYM, -1 - i)); return c && c.ok; }).length;
function challengeHtml(){
  const c = challenge(curYM);
  if (!c) return '';
  const nome = (CAT_GASTO[c.cat] || CAT_GASTO.outros)[1], pct = Math.min(100, c.used / c.target * 100);
  return `<div class="card"><b>${I('target')} Desafio de ${monthName(curYM).split(' ')[0]}</b>
    <div class="hint u-mt4">Gaste menos de ${fmt(c.target)} em ${esc(nome)} (foi o gasto do mês passado).</div>
    <div class="bar"><i style="width:${pct}%;background:${c.ok ? 'var(--in)' : 'var(--out)'}"></i></div>
    <div class="semTopo hint">${c.ok ? `Até agora: ${fmt(c.used)}. Ainda cabem ${fmt(c.target - c.used)}.` : `Passou em ${fmt(c.used - c.target)}. Mês que vem tem outro!`}</div></div>`;
}
// Conquistas em níveis. Cada família: [ícone, nome, como ganhar (n => texto), valor atual, metas, unidade]; cada meta é
// uma conquista ("Anotador I", "Anotador II"…). Unidade do progresso: [singular, plural] ("3 de 5 assinaturas"), 'reais'
// ou null (sim ou não). O progresso é calculado dos dados; ficam guardadas só quais já foram avisadas (neste aparelho)
// e a data em que cada nível foi conquistado (db.conq, ver funCheck).
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;
const reais = n => comMoeda(n);
// Unidade do progresso de cada família (ver acima).
const CONQ_UN = {'Anotador':['gasto', 'gastos'], 'Ganha-pão':['ganho', 'ganhos'], 'Renda extra':['ganho avulso', 'ganhos avulsos'],
  'Parcelador':['compra parcelada', 'compras parceladas'], 'Livre de parcelas':['compra quitada', 'compras quitadas'],
  'Investidor':['investimento', 'investimentos'], 'Patrimônio':'reais', 'Sonhador':['meta', 'metas'], 'Meta batida':['meta alcançada', 'metas alcançadas'],
  'Mês no azul':['mês', 'meses'], 'Sequência azul':['mês seguido', 'meses seguidos'], 'Fogo no cofrinho':['dia seguido', 'dias seguidos'],
  'Desafiante':['desafio', 'desafios'], 'Organizado':['comprovante', 'comprovantes'], 'Etiquetador':['etiqueta', 'etiquetas'],
  'Variado':['categoria', 'categorias'], 'Planejador':['categoria', 'categorias'], 'Banqueiro':['conta', 'contas'],
  'Transferidor':['transferência', 'transferências'], 'Rachador':['gasto dividido', 'gastos divididos'],
  'Assinante consciente':['assinatura', 'assinaturas'], 'Sobrou!':'reais', 'Constância':['mês', 'meses'],
  'Detalhista':['gasto avulso', 'gastos avulsos'], 'Em dia':null, 'Em dupla':null};
// Guardado até a próxima mudança nos dados (cached, limpo por dirty): o Resumo pedia a lista 3 vezes por desenho.
function funFamilies(){ return cached('FF', funFamiliasCalc); }
function funFamiliasCalc(){
  const ultimos = n => [...Array(n)].map((_, i) => addMonths(curYM, -i));
  const azul = m => totalIn(m) > 0 && totalIn(m) >= totalOut(m), ano2 = ultimos(24);
  let seq = 0, melhor = 0;
  for (const m of [...ano2].reverse()){ seq = azul(m) ? seq + 1 : 0; melhor = Math.max(melhor, seq); }
  const porMes = {}; // gastos avulsos por mês, numa passada só (antes eram 12 filtros sobre todos os gastos)
  for (const x of db.expenses) if (!x.fixed) porMes[x.start] = (porMes[x.start] || 0) + 1;
  const avulsosNoMes = Math.max(0, ...ultimos(12).map(m => porMes[m] || 0));
  const emDia = db.expenses.some(x => x.fixed && x.due) && upcomingBills().every(b => b.diff >= 0);
  return [
    ['receipt', 'Anotador', n => `lance ${plural(n, 'gasto', 'gastos')}`, db.expenses.length, [1, 5, 10, 25, 50, 100, 250, 500, 1000]],
    ['income', 'Ganha-pão', n => `lance ${plural(n, 'ganho', 'ganhos')}`, db.incomes.length, [1, 5, 10, 25, 50, 100]],
    ['gift', 'Renda extra', n => `lance ${plural(n, 'ganho avulso', 'ganhos avulsos')}`, db.incomes.filter(x => !x.fixed).length, [1, 5, 10]],
    ['card', 'Parcelador', n => `cadastre ${plural(n, 'compra parcelada', 'compras parceladas')}`, db.installments.length, [1, 3, 5, 10]],
    ['key', 'Livre de parcelas', n => `quite ${plural(n, 'compra parcelada', 'compras parceladas')}`,
      db.installments.filter(p => p.paid >= p.n).length, [1, 3, 5, 10]],
    ['leaf', 'Investidor', n => `cadastre ${plural(n, 'investimento', 'investimentos')}`, db.investments.length, [1, 3, 5, 10]],
    ['trend', 'Patrimônio', n => `tenha ${reais(n)} investidos`, sum(db.investments, x => x.value),
      [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]],
    ['target', 'Sonhador', n => `crie ${plural(n, 'meta', 'metas')}`, db.goals.length, [1, 3, 5]],
    ['diamond', 'Meta batida', n => `alcance ${plural(n, 'meta', 'metas')}`, db.goals.filter(g => g.saved >= g.target).length, [1, 3, 5, 10]],
    ['smile', 'Mês no azul', n => `feche ${plural(n, 'mês', 'meses')} no azul (nos últimos 2 anos)`, ano2.filter(azul).length, [1, 3, 6, 12, 24]],
    ['trophy', 'Sequência azul', n => `fique ${n} meses seguidos no azul`, melhor, [2, 3, 6, 12]],
    ['flame', 'Fogo no cofrinho', n => `abra o app ${n} dias seguidos`, Math.max(funState.best || 0, funState.streak), [3, 7, 15, 30, 60, 100, 365]],
    ['star', 'Desafiante', n => `cumpra ${plural(n, 'desafio do mês', 'desafios do mês')} (nos últimos 6 meses)`, challengeWins(), [1, 2, 3, 6]],
    ['camera', 'Organizado', n => `anexe ${plural(n, 'comprovante', 'comprovantes')}`, db.expenses.filter(x => x.photo).length, [1, 5, 10, 25, 50]],
    ['tag', 'Etiquetador', n => `use ${plural(n, 'etiqueta diferente', 'etiquetas diferentes')}`, new Set(db.expenses.flatMap(tagsOf)).size, [1, 5, 10]],
    ['box', 'Variado', n => `lance gastos em ${n} categorias diferentes`, new Set(db.expenses.map(x => x.cat)).size, [5, 10, 15, 20]],
    ['sliders', 'Planejador', n => `defina orçamento para ${plural(n, 'categoria', 'categorias')}`,
      Object.values(db.budgets).filter(v => v > 0).length, [1, 3, 5, 10]],
    ['bank', 'Banqueiro', n => `cadastre ${plural(n, 'conta bancária', 'contas bancárias')}`, db.accounts.length, [1, 2, 3, 5]],
    ['exchange', 'Transferidor', n => `registre ${plural(n, 'transferência', 'transferências')}`, db.transfers.length, [1, 5, 10]],
    ['people', 'Rachador', n => `divida ${plural(n, 'gasto', 'gastos')} com alguém`, db.expenses.filter(x => x.who).length, [1, 5, 10, 25]],
    ['calendar', 'Assinante consciente', n => `cadastre ${plural(n, 'assinatura', 'assinaturas')}`, db.expenses.filter(isSub).length, [1, 3, 5]],
    ['coins', 'Sobrou!', n => `termine um mês com ${reais(n)} sobrando (no último ano)`,
      Math.max(0, ...ultimos(12).map(m => totalIn(m) - totalOut(m))), [100, 500, 1000, 2500, 5000, 10000]],
    ['book', 'Constância', n => `tenha lançamentos em ${plural(n, 'mês', 'meses')}`, new Set([...db.expenses, ...db.incomes].map(x => x.start)).size,
      [1, 3, 6, 12, 24, 36]],
    ['search', 'Detalhista', n => `lance ${n} gastos avulsos num mesmo mês`, avulsosNoMes, [10, 30, 60]],
    ['checked', 'Em dia', () => 'tenha contas com vencimento e nenhuma atrasada', emDia ? 1 : 0, [1]],
    ['heart', 'Em dupla', () => 'use a conta compartilhada', sync.shared ? 1 : 0, [1]]].map(f => [...f, CONQ_UN[f[1]]]);
}
// Lista plana: [ícone, nome, como ganhar, já ganhou, família, nível].
function funBadgeList(){
  return funFamilies().flatMap(([ic, nome, como, v, metas], f) => metas.map((n, i) => [ic, metas.length > 1 ? `${nome} ${ROMANOS[i]}` : nome, como(n),
    v >= n, f, i]));
}
// Avisa (uma vez) cada conquista nova e guarda em db.conq a data em que cada nível foi conquistado ("Anotador:2").
// Na primeira vez que roda neste aparelho, só anota as que já existiam (sem data: não se sabe quando vieram). Com o modo
// divertido desligado, roda calado a cada gravação (save), para a data ficar certa quando ele for ligado.
// Na demonstração não confere: as conquistas viriam dos dados fictícios (aviso com confete logo ao entrar) e ficariam
// guardadas como já ganhas, sem aviso quando a pessoa as ganhasse de verdade.
// Chamada por loadDb (dados.js) quando os dados chegam de fora, como ao entrar com uma conta que já existe num celular
// novo: as conquistas que já estão nesses dados ficam anotadas como vistas, sem aviso nem confete.
function funConhecerGanhas(){
  if (demoOn) return;
  funState.got = [...new Set([...(funState.got || []), ...funBadgeList().filter(b => b[3]).map(b => b[1])])];
  try { localStorage.setItem(FUN_KEY, JSON.stringify(funState)); } catch(e){}
}
function funCheck(){
  if (demoOn) return;
  const fams = funFamilies(), lista = funBadgeList().filter(b => b[3]), ganhas = lista.map(b => b[1]);
  if (!funState.got){ funState.got = ganhas; }
  else {
    const novas = lista.filter(b => !funState.got.includes(b[1]));
    if (!novas.length) return;
    funState.got = [...funState.got, ...novas.map(b => b[1])];
    for (const [, , , , f, i] of novas) db.conq[`${fams[f][1]}:${i + 1}`] = db.conq[`${fams[f][1]}:${i + 1}`] || Date.now();
    if (db.prefs.fun){
      save(false);
      confetti();
      const nomes = novas.map(b => b[1]);
      // em outro idioma, cada nome é traduzido antes: a lista inteira não está na tabela de traduções
      toast(nomes.length > 1 ? `${nomes.length} conquistas desbloqueadas: ${nomes.map(trText).join(', ')}!`
        : comNome(`Conquista desbloqueada, {nome}: ${trText(nomes[0])}!`),
        {dest:{k:'conq', n:nomes}}); // tocar no aviso (na central) abre as conquistas com estas em destaque
    }
  }
  try { localStorage.setItem(FUN_KEY, JSON.stringify(funState)); } catch(e){}
}
// Progresso de uma família rumo à meta alvo: "3 de 5 assinaturas", "R$ 3.200,00 de R$ 5.000,00" ou, nas de sim ou não,
// "Ainda não". completo: todos os níveis já conquistados.
function conqProgresso(v, alvo, un, completo){
  if (completo) return 'Todos os níveis conquistados!';
  if (!un) return 'Ainda não';
  return un === 'reais' ? `${reais(v)} de ${reais(alvo)}` : `${(+v).toLocaleString('pt-BR')} de ${plural(alvo, un[0], un[1])}`;
}
// Nível e progresso de uma família: n = níveis conquistados, alvo = a meta atual (a última, se completa).
function conqEstado([, nome, , v, metas, un]){
  const n = metas.filter(m => v >= m).length, completo = n === metas.length, alvo = metas[Math.min(n, metas.length - 1)];
  return {n, completo, alvo, titulo:nome + (n && metas.length > 1 ? ' ' + ROMANOS[n - 1] : ''), pct:Math.round(completo ? 100 : Math.min(100, v / alvo * 100)),
    prog:conqProgresso(v, alvo, un, completo), nivel:`Nível ${n} de ${metas.length}`};
}
const conqBarra = e => `<div class="bar"><i style="width:${e.pct}%"></i></div>
  <div class="conqLinha"><small class="conqProg">${e.prog}</small><small class="conqNivel">${e.nivel}</small></div>`;
// Detalhe de uma família de conquistas: o que cada nível pede, quando foi conquistado (só a partir da 2.60; as de antes
// ficam sem data), o progresso atual e o que falta para o próximo.
function openConq(f){
  settingsOpen = false; F = null;
  const fam = funFamilies()[f], [ic, nome, como, v, metas, un] = fam, e = conqEstado(fam);
  const falta = e.completo ? '' : !un ? cap(como(e.alvo)) + ' para conquistar.'
    : `${un !== 'reais' && e.alvo - v === 1 ? 'Falta' : 'Faltam'} ${un === 'reais' ? reais(e.alvo - v) : plural(e.alvo - v, un[0], un[1])} `
      + (metas.length > 1 ? `para o nível ${ROMANOS[e.n]}.` : 'para conquistar.');
  showSheet(`<h3>${esc(e.titulo)}</h3>
    <div class="semTopo item semCursor">${tile(ic)}<div class="mid">${conqBarra(e)}</div></div>
    <div class="hint ${e.completo ? 'in' : ''}">${e.completo ? 'Todos os níveis conquistados!' : falta}</div>
    <label>Níveis</label>
    <div class="card">${metas.map((m, i) => { const ok = v >= m, d = db.conq[`${nome}:${i + 1}`]; return `
      <div class="item semCursor conqNiv"><span class="${ok ? 'in' : 'muted'}">${I(ok ? 'checked' : 'unchecked', 22)}</span><div class="mid">
        <b>${metas.length > 1 ? 'Nível ' + ROMANOS[i] : nome}</b><small>${cap(como(m))}</small>
        <small class="u-bloco">${ok ? (d ? 'Conquistado em ' + new Date(d).toLocaleDateString('pt-BR') : 'Conquistado')
          : i === e.n ? 'Próximo nível' : 'Ainda bloqueado'}</small></div></div>`; }).join('')}</div>
    <div class="btns foot"><button class="btn" data-onclick="openBadges()">Voltar</button>
      <button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Mascote de cada tema especial. Cada tema tem um personagem próprio (não é o porquinho fantasiado):
// [claro, médio, forte, fenda, bochecha, olhos, boca, partes]. As partes trocam pedaços do desenho-base:
// orelhas (atrás da cabeça), cabeca (no lugar do rosto redondo), focinho (no lugar do focinho de porco; ' ' = sem),
// sob (por cima da cabeça, por baixo dos olhos), sobre (por cima de tudo), pes (no lugar das patas; ' ' = sem),
// semRabo, semFenda (a fenda de cofrinho) e semBrilho. Os olhos (em 43,55 e 77,55) e a boca mudam com o humor em todos.
// Sem tema especial (e nos temas sem desenho, até a imagem deles chegar), o personagem padrão em imagem (pigSvg).
const MASCOTES = {
  // Robô: cabeça quadrada, antena, parafusos, grade no lugar do focinho e visor verde.
  hacker:['#4ade80', '#16a34a', '#15803d', '#052e16', '#bbf7d0', '#03120a', '#052e16', {semFenda:true, semRabo:true,
    orelhas:'<path d="M60 30V15" stroke="#16a34a" stroke-width="3.500"/><circle cx="60" cy="11" r="5" fill="#bbf7d0"/><rect x="15" y="52" width="10" height="20" rx="4" fill="#15803d"/><rect x="95" y="52" width="10" height="20" rx="4" fill="#15803d"/>',
    cabeca:'<rect x="23" y="29" width="74" height="66" rx="17" fill="url(#pigG)"/>',
    focinho:'<rect x="45" y="63" width="30" height="13" rx="5" fill="#15803d"/><path d="M52 66v7M60 66v7M68 66v7" stroke="#052e16" stroke-width="2.200" stroke-linecap="round"/>',
    sobre:'<rect x="32" y="47" width="56" height="15" rx="7.500" fill="#03120a"/><path d="M38 54.500h8M50 54.500h3M68 54.500h8M80 54.500h3" stroke="#4ade80" stroke-width="2.400" stroke-linecap="round"/>'}],
  // Unicórnio: chifre dourado, crina colorida, cílios e estrelinha.
  boneca:['#fff0f8', '#f9a8d4', '#f472b6', '#be185d', '#ff5f95', '#500724', '#be185d', {semFenda:true,
    orelhas:'<path d="M60 2l8 28H52z" fill="#fde68a"/><path d="M56 13l8 2.500M54.500 21l11 3" stroke="#f59e0b" stroke-width="1.800" stroke-linecap="round"/><path d="M27 40c-10 10-12 28-5 44" stroke="#c026d3" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M34 31c-12 4-18 16-18 30" stroke="#a855f7" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M44 26c-10-2-20 4-25 14" stroke="#38bdf8" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M84 36c5-10 3-18-3-20-6 3-9 9-10 16z" fill="#f9a8d4"/>',
    focinho:'<ellipse cx="60" cy="72" rx="13" ry="9" fill="#f9a8d4"/><ellipse cx="55.500" cy="72" rx="1.800" ry="2.600" fill="#be185d"/><ellipse cx="64.500" cy="72" rx="1.800" ry="2.600" fill="#be185d"/>',
    sobre:'<path d="M36 50l-4-3M40 48l-2-4M84 50l4-3M80 48l2-4" stroke="#500724" stroke-width="2" stroke-linecap="round"/><path d="M90 74l1.600 3.300 3.600.500-2.600 2.500.600 3.600-3.200-1.700-3.200 1.700.600-3.600-2.600-2.500 3.600-.500z" fill="#facc15"/>'}],
  // Carro de corrida vermelho, visto de frente: faróis no lugar dos olhos, grade e aerofólio.
  corrida:['#f87171', '#dc2626', '#991b1b', '#7f1d1d', '#fecaca', '#111827', '#111827', {semFenda:true, semRabo:true, semBrilho:true,
    pes:'<rect x="22" y="82" width="19" height="22" rx="7" fill="#111827"/><rect x="79" y="82" width="19" height="22" rx="7" fill="#111827"/>',
    orelhas:'<rect x="20" y="20" width="80" height="8" rx="3.500" fill="#7f1d1d"/><path d="M32 28v12M88 28v12" stroke="#7f1d1d" stroke-width="5"/>',
    cabeca:'<path d="M38 32h44l11 20H27z" fill="#dc2626"/><path d="M42 36h36l7 13H35z" fill="#bae6fd"/><rect x="17" y="46" width="86" height="46" rx="15" fill="url(#pigG)"/>',
    sob:'<circle cx="43" cy="56" r="10.500" fill="#fef9c3"/><circle cx="77" cy="56" r="10.500" fill="#fef9c3"/><path d="M56 46h8v19h-8z" fill="#fff"/>',
    focinho:'<rect x="47" y="67" width="26" height="10" rx="4.500" fill="#111827"/><path d="M53 69.500v5M60 69.500v5M67 69.500v5" stroke="#4b5563" stroke-width="1.600"/>'}],
  // Gato DJ: orelhas pontudas, bigodes, focinho pequeno e fones.
  neon:['#c4b5fd', '#8b5cf6', '#7c3aed', '#4c1d95', '#22d3ee', '#1e1b4b', '#f472b6', {semFenda:true,
    orelhas:'<path d="M31 46 25 8l28 20zM89 46l6-38-28 20z" fill="#8b5cf6"/><path d="M34 37 31 17l15 11zM86 37l3-20-15 11z" fill="#f472b6"/>',
    focinho:'<path d="M55.500 65h9l-4.500 5.500z" fill="#f472b6"/><path d="M41 67H23M41 72l-17 5M79 67h18M79 72l17 5" stroke="#1e1b4b" stroke-width="1.700" stroke-linecap="round"/>',
    sobre:'<path d="M23 60a37 40 0 0 1 74 0" stroke="#22d3ee" stroke-width="4.500" fill="none"/><rect x="15" y="54" width="12" height="22" rx="6" fill="#22d3ee"/><rect x="93" y="54" width="12" height="22" rx="6" fill="#22d3ee"/><path d="M18 60v10M102 60v10" stroke="#f472b6" stroke-width="2" stroke-linecap="round"/>'}],
  // Coruja estudiosa: tufos, olhões com óculos e bico.
  papel:['#f5deb3', '#d6a77a', '#b98a5e', '#7c4a2d', '#e9a68a', '#3b2a1a', '#7c4a2d', {semFenda:true, semRabo:true,
    orelhas:'<path d="M33 42 27 11l25 17zM87 42l6-31-25 17z" fill="#b98a5e"/>',
    sob:'<circle cx="43" cy="55" r="14" fill="#fff7e6"/><circle cx="77" cy="55" r="14" fill="#fff7e6"/><path d="M40 86q20 12 40 0" stroke="#b98a5e" stroke-width="2" fill="none" stroke-dasharray="3 4" stroke-linecap="round"/>',
    focinho:'<path d="M53 63h14l-7 13z" fill="#e0a02b"/>',
    sobre:'<circle cx="43" cy="55" r="14" fill="none" stroke="#3b2a1a" stroke-width="2.600"/><circle cx="77" cy="55" r="14" fill="none" stroke="#3b2a1a" stroke-width="2.600"/><path d="M57 55h6" stroke="#3b2a1a" stroke-width="2.600"/>'}],
  // Caranguejo: garras para cima, perninhas e chapéu de palha.
  praia:['#fca5a5', '#ef4444', '#dc2626', '#991b1b', '#fecaca', '#450a0a', '#450a0a', {semFenda:true, semRabo:true, focinho:' ',
    pes:'<path d="M27 84l-11 9M33 90l-9 12M39 93l-4 11M93 84l11 9M87 90l9 12M81 93l4 11" stroke="#dc2626" stroke-width="5" stroke-linecap="round"/>',
    orelhas:'<path d="M24 52C8 46 4 28 13 18c2 9 8 11 13 9-3 9 1 16 6 18zM96 52c16-6 20-24 11-34-2 9-8 11-13 9 3 9-1 16-6 18z" fill="#ef4444"/>',
    cabeca:'<ellipse cx="60" cy="66" rx="41" ry="30" fill="url(#pigG)"/>',
    sobre:'<ellipse cx="60" cy="38" rx="24" ry="5.500" fill="#eab308"/><path d="M47 38c0-10 6-14 13-14s13 4 13 14z" fill="#facc15"/><path d="M47.500 35h25" stroke="#0e7490" stroke-width="3"/>'}],
  // Lua cheia do quadro: crateras, halo e estrelas em volta.
  noite:['#fff3b0', '#f4d35e', '#e0b93a', '#c99a1d', '#f59e0b', '#1b2a6b', '#1b2a6b', {semFenda:true, semRabo:true, pes:' ', focinho:' ',
    orelhas:'<circle cx="60" cy="60" r="50" fill="#f4d35e" opacity=".16"/><circle cx="60" cy="60" r="44" fill="#f4d35e" opacity=".2"/>',
    cabeca:'<circle cx="60" cy="60" r="38" fill="url(#pigG)"/>',
    sob:'<circle cx="34" cy="78" r="5" fill="#e0b93a" opacity=".7"/><circle cx="86" cy="80" r="6.500" fill="#e0b93a" opacity=".7"/><circle cx="84" cy="36" r="3.500" fill="#e0b93a" opacity=".7"/><circle cx="60" cy="30" r="2.500" fill="#e0b93a" opacity=".7"/>',
    sobre:'<path d="M14 26l2 4.200 4.600.600-3.300 3.200.800 4.600-4.100-2.200-4.100 2.200.800-4.600-3.300-3.200 4.600-.600zM104 84l1.600 3.300 3.600.500-2.600 2.500.600 3.600-3.200-1.700-3.200 1.700.600-3.600-2.600-2.500 3.600-.500z" fill="#fff6bf"/><path d="M96 18c6-6 14-4 15 2s-5 8-8 5" stroke="#9cc0e7" stroke-width="2.200" fill="none" stroke-linecap="round"/>'}],
  // Sapo mago: olhos saltados, narinas e chapéu pontudo com estrelas.
  bruxo:['#86efac', '#22c55e', '#16a34a', '#14532d', '#fda4af', '#052e16', '#052e16', {semFenda:true, semRabo:true, semBrilho:true,
    orelhas:'<circle cx="43" cy="44" r="16" fill="#22c55e"/><circle cx="77" cy="44" r="16" fill="#22c55e"/>',
    cabeca:'<ellipse cx="60" cy="70" rx="41" ry="28" fill="url(#pigG)"/>',
    sob:'<circle cx="43" cy="52" r="11.500" fill="#fff"/><circle cx="77" cy="52" r="11.500" fill="#fff"/>',
    focinho:'<circle cx="56" cy="71" r="1.600" fill="#14532d"/><circle cx="64" cy="71" r="1.600" fill="#14532d"/>',
    pes:'<ellipse cx="38" cy="98" rx="12" ry="6" fill="#16a34a"/><ellipse cx="82" cy="98" rx="12" ry="6" fill="#16a34a"/>',
    sobre:'<ellipse cx="60" cy="31" rx="19" ry="4.500" fill="#2e1657"/><path d="M62 2 47 30h27z" fill="#3b1d6e"/><path d="M49 27h23" stroke="#eab308" stroke-width="3"/><circle cx="59" cy="17" r="1.600" fill="#fde047"/><circle cx="65" cy="22" r="1.200" fill="#fde047"/>'}],
  // Alienígena: cabeçona, olhos enormes e antenas.
  espaco:['#a7f3d0', '#34d399', '#10b981', '#047857', '#6ee7b7', '#d1fae5', '#064e3b', {semFenda:true, semRabo:true, focinho:' ',
    orelhas:'<path d="M45 32 36 12M75 32l9-20" stroke="#34d399" stroke-width="3.500" stroke-linecap="round"/><circle cx="35" cy="10" r="5.500" fill="#fde047"/><circle cx="85" cy="10" r="5.500" fill="#fde047"/>',
    cabeca:'<path d="M20 54c0-23 17-36 40-36s40 13 40 36-17 44-40 44-40-21-40-44z" fill="url(#pigG)"/>',
    sob:'<ellipse cx="43" cy="55" rx="11.500" ry="15" fill="#022c22" transform="rotate(-16 43 55)"/><ellipse cx="77" cy="55" rx="11.500" ry="15" fill="#022c22" transform="rotate(16 77 55)"/>'}],
  // Raposa: orelhas pontudas, cara branca e nariz preto, com uma folha.
  floresta:['#fdba74', '#f97316', '#ea580c', '#9a3412', '#fed7aa', '#3b1d0a', '#7c2d12', {semFenda:true,
    orelhas:'<path d="M30 46 22 8l30 20zM90 46l8-38-30 20z" fill="#ea580c"/><path d="M33 37 29 18l15 10zM87 37l4-19-15 10z" fill="#fff7ed"/>',
    sob:'<path d="M23 64c5 22 24 32 37 32s32-10 37-32c-9 9-21 12-37 12s-28-3-37-12z" fill="#fff7ed"/>',
    focinho:'<ellipse cx="60" cy="71" rx="5.500" ry="4" fill="#3b1d0a"/>',
    sobre:'<path d="M60 30c-2-12 6-20 18-20-1 12-8 19-18 20z" fill="#4d7c0f"/><path d="M61 29c4-7 9-12 16-18" stroke="#a3e635" stroke-width="1.600" fill="none"/>'}],
  // Monstrinho de videogame antigo: tudo em quadradinhos, com antenas e perninhas.
  retro:['#c4b5fd', '#8b5cf6', '#6d28d9', '#4c1d95', '#f0abfc', '#12121c', '#12121c', {semFenda:true, semRabo:true, semBrilho:true, focinho:' ',
    orelhas:'<path d="M34 14h8v8h8v8h-8v-8h-8zM86 14h-8v8h-8v8h8v-8h8z" fill="#8b5cf6"/>',
    cabeca:'<path d="M34 30h52v8h8v8h8v32h-8v8h-8v8H34v-8h-8v-8h-8V46h8v-8h8z" fill="url(#pigG)"/>',
    pes:'<path d="M34 94h12v10H34zM74 94h12v10H74z" fill="#6d28d9"/>',
    sob:'<path d="M35 47h16v16H35zM69 47h16v16H69z" fill="#fff"/>',
    sobre:'<path d="M100 8h7v7h-7z" fill="#facc15"/><path d="M12 16h6v6h-6z" fill="#fb7185"/>'}],
  // Dragãozinho da noite: escuro, olhos verdes, chifres e asas.
  dragao:['#4b5563', '#1f2937', '#111827', '#030712', '#4ade80', '#a3e635', '#9ca3af', {semFenda:true,
    orelhas:'<path d="M24 62C6 52 2 30 7 20c8 9 18 14 27 24zM96 62c18-10 22-32 17-42-8 9-18 14-27 24z" fill="#1f2937"/><path d="M34 42 20 12l26 16zM86 42l14-30-26 16z" fill="#111827"/><path d="M50 30l-4-14 10 9zM70 30l4-14-10 9z" fill="#111827"/>',
    focinho:'<circle cx="55" cy="70" r="2" fill="#030712"/><circle cx="65" cy="70" r="2" fill="#030712"/>',
    sob:'<ellipse cx="43" cy="55" rx="9" ry="8" fill="#030712"/><ellipse cx="77" cy="55" rx="9" ry="8" fill="#030712"/>'}],
  // Carro de fórmula antigo, branco: rodas à mostra, bico fino, asa dianteira e número.
  grandprix:['#ffffff', '#e2e8f0', '#cbd5e1', '#94a3b8', '#fecaca', '#0f172a', '#0f172a', {semFenda:true, semRabo:true, semBrilho:true,
    pes:'<rect x="6" y="58" width="21" height="40" rx="9" fill="#111827"/><rect x="93" y="58" width="21" height="40" rx="9" fill="#111827"/><rect x="13" y="92" width="94" height="9" rx="4" fill="#dc2626"/>',
    orelhas:'<rect x="30" y="20" width="60" height="9" rx="3.500" fill="#1d4ed8"/><path d="M50 29h20v12H50z" fill="#1e3a8a"/><path d="M27 70h8M85 70h8" stroke="#64748b" stroke-width="4"/>',
    cabeca:'<rect x="31" y="36" width="58" height="58" rx="20" fill="url(#pigG)"/>',
    sob:'<path d="M56 36h8v12h-8z" fill="#dc2626"/>',
    focinho:'<circle cx="60" cy="72" r="9" fill="#dc2626"/><text x="60" y="76" text-anchor="middle" font-size="12" font-weight="800" font-family="sans-serif" fill="#fff">8</text>'}],
  // Buldogue de rua: orelhas caídas, focinhão, dentinhos, boné para trás e corrente.
  rua:['#e7d3bd', '#c9a27e', '#a67c52', '#7a5a3a', '#f5b7a0', '#1c1917', '#1c1917', {semFenda:true,
    orelhas:'<path d="M27 38c-14 2-18 22-11 38 9-5 13-16 14-28zM93 38c14 2 18 22 11 38-9-5-13-16-14-28z" fill="#a67c52"/>',
    focinho:'<ellipse cx="60" cy="76" rx="21" ry="15" fill="#f5e6d3"/><ellipse cx="60" cy="67" rx="6.500" ry="4.500" fill="#1c1917"/><path d="M60 71.500v7" stroke="#1c1917" stroke-width="2"/>',
    sobre:'<path d="M52 84.500l1.500-4M68 84.500l-1.500-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M25 46a35 28 0 0 1 70 0z" fill="#1c1917"/><path d="M25 42.500h70v4.500H25z" fill="#fb923c"/><path d="M90 44l19 3-17 6z" fill="#1c1917"/><path d="M38 95q22 11 44 0" stroke="#fbbf24" stroke-width="3.500" fill="none" stroke-dasharray="2.500 3" stroke-linecap="round"/>'}],
  // Gato da sorte: branco, pata levantada, coleira vermelha com guizo e mancha dourada.
  drift:['#ffffff', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#fda4af', '#1f2937', '#b91c1c', {semFenda:true, semRabo:true,
    orelhas:'<path d="M31 46 25 9l28 21zM89 46l6-37-28 21z" fill="#f1f5f9"/><path d="M34 37 31 19l15 11zM86 37l3-18-15 11z" fill="#ef4444"/><path d="M95 62c11-4 15-19 10-32-8 0-14 7-14 15z" fill="#f1f5f9"/><path d="M98 36v6M103 38l-1 6" stroke="#cbd5e1" stroke-width="1.600" stroke-linecap="round"/>',
    sob:'<path d="M68 30c9-3 18 3 21 12-8 3-17-1-21-12z" fill="#f59e0b" opacity=".85"/>',
    focinho:'<path d="M55.500 66h9l-4.500 5.500z" fill="#f472b6"/><path d="M41 68H25M41 73l-15 4M79 68h16M79 73l15 4" stroke="#94a3b8" stroke-width="1.600" stroke-linecap="round"/>',
    sobre:'<path d="M31 90q29 13 58 0" stroke="#dc2626" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="60" cy="98" r="6" fill="#fbbf24" stroke="#d97706" stroke-width="1.500"/><path d="M60 98v3" stroke="#92400e" stroke-width="1.600"/>'}],
  // Fusquinha de corrida, visto de frente: redondinho, faróis, faixas e número no capô.
  fusca:['#fffaf0', '#f3e3bf', '#e2cb9a', '#a8894e', '#f59e0b', '#3b2f1a', '#3b2f1a', {semFenda:true, semRabo:true, semBrilho:true,
    pes:'<rect x="23" y="84" width="17" height="20" rx="7" fill="#1f2937"/><rect x="80" y="84" width="17" height="20" rx="7" fill="#1f2937"/>',
    orelhas:'<circle cx="18" cy="62" r="5" fill="#cbd5e1"/><circle cx="102" cy="62" r="5" fill="#cbd5e1"/>',
    cabeca:'<path d="M20 72c0-32 17-46 40-46s40 14 40 46v12c0 6-4 9-10 9H30c-6 0-10-3-10-9z" fill="url(#pigG)"/><path d="M38 46c2-10 11-15 22-15s20 5 22 15z" fill="#bae6fd"/>',
    sob:'<path d="M52 27h5v66h-5z" fill="#dc2626" opacity=".9"/><path d="M57 26.500h6V93h-6z" fill="#fff"/><path d="M63 27h5v66h-5z" fill="#1d4ed8" opacity=".9"/><circle cx="43" cy="56" r="10.500" fill="#fef9c3" stroke="#cbd5e1" stroke-width="2"/><circle cx="77" cy="56" r="10.500" fill="#fef9c3" stroke="#cbd5e1" stroke-width="2"/>',
    focinho:'<circle cx="60" cy="72" r="8.500" fill="#fff" stroke="#3b2f1a" stroke-width="1.500"/><text x="60" y="75.500" text-anchor="middle" font-size="9" font-weight="800" font-family="sans-serif" fill="#3b2f1a">12</text>',
    sobre:'<rect x="24" y="92" width="72" height="5" rx="2.500" fill="#cbd5e1"/>'}],
  // Urso viking: orelhas redondas, focinho claro e elmo de ferro com chifres.
  vikings:['#c8a27c', '#a47148', '#7f5539', '#5e3c23', '#e6b8a2', '#2b1d12', '#2b1d12', {semFenda:true,
    orelhas:'<circle cx="28" cy="36" r="13" fill="#a47148"/><circle cx="92" cy="36" r="13" fill="#a47148"/><circle cx="28" cy="36" r="6.500" fill="#e6b8a2"/><circle cx="92" cy="36" r="6.500" fill="#e6b8a2"/><path d="M30 40C14 36 10 20 14 8c6 11 15 16 24 20zM90 40c16-4 20-20 16-32-6 11-15 16-24 20z" fill="#fef3c7"/>',
    focinho:'<ellipse cx="60" cy="74" rx="17" ry="13" fill="#f1dcc3"/><ellipse cx="60" cy="67.500" rx="6.500" ry="4.500" fill="#2b1d12"/><path d="M60 72v6" stroke="#2b1d12" stroke-width="2"/>',
    sobre:'<path d="M25 47a35 29 0 0 1 70 0z" fill="#94a3b8"/><path d="M25 47h70" stroke="#64748b" stroke-width="5"/><path d="M57 19h6v28h-6z" fill="#64748b"/><circle cx="37" cy="43" r="2" fill="#e2e8f0"/><circle cx="83" cy="43" r="2" fill="#e2e8f0"/>'}],
  // Leão espartano: juba, focinho claro e crista vermelha.
  espartano:['#fde68a', '#f59e0b', '#d97706', '#92400e', '#fcd34d', '#451a03', '#451a03', {semFenda:true,
    orelhas:'<circle cx="60" cy="60" r="49" fill="#92400e"/><path d="M60 8l8 10 12-6 2 13 13 0-4 12 12 6-9 9 8 10-12 4 3 13-13-1-3 13-11-7-9 9-9-9-11 7-3-13-13 1 3-13-12-4 8-10-9-9 12-6-4-12 13 0 2-13 12 6z" fill="#b45309"/><circle cx="31" cy="32" r="9" fill="#f59e0b"/><circle cx="89" cy="32" r="9" fill="#f59e0b"/>',
    focinho:'<ellipse cx="60" cy="74" rx="16" ry="12" fill="#fef3c7"/><path d="M54 67h12l-6 6.500z" fill="#451a03"/><path d="M60 73.500v5" stroke="#451a03" stroke-width="2"/>',
    sobre:'<path d="M53 0h14l3 24H50z" fill="#dc2626"/><path d="M50.500 7h19M50 14h20" stroke="#991b1b" stroke-width="1.600"/><path d="M27 42q33-15 66 0v6q-33-13-66 0z" fill="#b45309"/><path d="M27 45q33-14 66 0" stroke="#fbbf24" stroke-width="2" fill="none"/>'}]
};
Object.assign(MASCOTES, MASCOTES_NOVOS); // os dos temas por categoria (js/temas.js)
// Mascote visto de frente; mood: 'feliz', 'ok' ou 'triste'. tema: de qual tema (padrão: o que está em uso). cor: sem
// tema, a cor do personagem padrão (padrão: a do app).
function pigSvg(mood, tema = db.prefs.skin, cor = db.prefs.color){
  // Personagem do tema em imagem (js/temas-baixar.js), quando já está no aparelho: a imagem inteira (nunca cortada) na
  // mesma caixa, com o "chão" sobre a sombra, uma respiração no ritmo do tema e, se ele flutua, a sombra que acompanha.
  const ti = tema && temaImg(tema, mood === 'feliz' || mood === 'triste' ? mood : 'ok');
  if (ti){ const [resp, flutua, sombra] = TEMAS_IMG[tema][4];
    const cls = `pig ${mood} img${flutua ? ' flutua' : ''}${sombra ? ' sombra' : ''}`;
    return `<svg class="${cls}" viewBox="0 0 120 110" width="104" height="95" style="--resp:${resp}s" aria-hidden="true">
    <ellipse class="chao" cx="60" cy="104" rx="30" ry="4" fill="#000" opacity=".16"/>
    <g class="corpo"><g class="resp"><image href="${ti}" x="8" y="3" width="104" height="104" preserveAspectRatio="xMidYMid meet"/></g></g></svg>`; }
  // Personagem padrão (js/mascote-padrao.js), na cor do app; também nos temas sem desenho em código enquanto a imagem
  // deles não chega. Mesma caixa de 120 x 110, a mesma sombra e a mesma moeda; a imagem inteira (quadrada, com os pés a
  // 97% da altura) fica com os pés sobre a sombra, dentro de g.corpo para receber as animações de humor do app.css.
  if (!MASCOTES[tema]) return `<svg class="pig ${mood}" viewBox="0 0 120 110" width="104" height="95" aria-hidden="true">
    <ellipse cx="60" cy="104" rx="30" ry="4" fill="#000" opacity=".16"/>
    <g class="moeda"><circle cx="60" cy="10" r="7.5" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/><path d="M60 6.5v7" stroke="#b45309" stroke-width="2" stroke-linecap="round"/></g>
    <g class="corpo"><image href="${mascotePadraoImg(mood, cor)}" x="12" y="8" width="96" height="96" preserveAspectRatio="xMidYMid meet"/></g></svg>`;
  const [claro, medio, forte, fenda, bochecha, escuro, boca, p] = MASCOTES[tema];
  const triste = mood === 'triste', feliz = mood === 'feliz', g = 'pigG' + (tema || '');
  const olho = x => `<circle cx="${x}" cy="55" r="5" fill="${escuro}"/><circle cx="${x + 1.8}" cy="53.2" r="1.7" fill="#fff"/>`;
  const olhos = feliz ? `<path d="M38 57q5-7 10 0M72 57q5-7 10 0" stroke="${escuro}" stroke-width="3" fill="none" stroke-linecap="round"/>` : olho(43) + olho(77);
  const extra = triste ? `<path d="M36 48l10-4M84 48l-10-4" stroke="${escuro}" stroke-width="2.6" stroke-linecap="round"/><path d="M89 58c2.2 3.2 3.2 5.2 3.2 6.8a3.2 3.2 0 0 1-6.400 0c0-1.600 1-3.600 3.200-6.800z" fill="#7dd3fc"/>` : '';
  const parte = (s, padrao) => (s == null ? padrao : s).replace(/url\(#pigG\)/g, `url(#${g})`);
  return `<svg class="pig ${mood}" viewBox="0 0 120 110" width="104" height="95" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${claro}"/><stop offset="1" stop-color="${medio}"/></linearGradient></defs>
    <ellipse cx="60" cy="104" rx="30" ry="4" fill="#000" opacity=".16"/>
    <g class="moeda"><circle cx="60" cy="10" r="7.5" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/><path d="M60 6.5v7" stroke="#b45309" stroke-width="2" stroke-linecap="round"/></g>
    <g class="corpo">
    ${p.semRabo ? '' : `<path d="M95 70c8-2 10 5 5 7s-2 7 3 6" stroke="${medio}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`}
    ${parte(p.pes, `<rect x="38" y="88" width="14" height="14" rx="6" fill="${forte}"/><rect x="68" y="88" width="14" height="14" rx="6" fill="${forte}"/>`)}
    ${parte(p.orelhas, `<path d="M30 40c-6-12-3-22 4-24 8 2 14 8 16 16zM90 40c6-12 3-22-4-24-8 2-14 8-16 16z" fill="${medio}"/>
    <path d="M34 36c-3-8-2-14 2-16 5 2 8 6 10 11zM86 36c3-8 2-14-2-16-5 2-8 6-10 11z" fill="${forte}"/>`)}
    ${parte(p.cabeca, '<ellipse cx="60" cy="62" rx="38" ry="34" fill="url(#pigG)"/>')}
    ${p.semFenda ? '' : `<rect x="50" y="30.5" width="20" height="4" rx="2" fill="${fenda}"/>`}
    ${p.semBrilho ? '' : '<ellipse cx="41" cy="43" rx="9" ry="4.5" fill="#fff" opacity=".4" transform="rotate(-28 41 43)"/>'}
    ${p.sob || ''}${olhos}${extra}
    <circle cx="32" cy="69" r="6" fill="${bochecha}" opacity=".4"/><circle cx="88" cy="69" r="6" fill="${bochecha}" opacity=".4"/>
    ${parte(p.focinho, `<ellipse cx="60" cy="69" rx="15" ry="11" fill="${forte}"/>
    <ellipse cx="54.5" cy="69" rx="2.6" ry="3.6" fill="${boca}"/><ellipse cx="65.5" cy="69" rx="2.6" ry="3.6" fill="${boca}"/>`)}
    <path d="${feliz ? 'M52 84q8 7 16 0' : triste ? 'M54 88q6-5 12 0' : 'M54 85q6 3 12 0'}" stroke="${boca}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${p.sobre || ''}</g></svg>`;
}
// Falas do mascote, por tema (a de cada dia muda, e tocar nele troca). {v} = valor do saldo do mês; {nome} = nome da pessoa.
const FUN_TEMA = {
  '':{
    feliz:['Sobrando {v} este mês, {nome}. Tô até mais gordinho!', 'Mês no azul! Já posso sonhar com milho premium?',
      'Olha esse saldo de {v}, {nome}. Orgulho define.', 'Assim eu encho rapidinho. Continua, {nome}!',
      '{v} de folga. Guarda um pouquinho pra mim?', 'Hoje eu durmo tranquilo: sobrou {v}.', 'Se continuar assim, vou precisar de um cofrinho maior.',
      'Oinc de alegria: as contas fecharam com {v} sobrando!'],
    ok:['Tudo sob controle por aqui, {nome}. Bora registrar os gastos?', 'Equilibrado, como todo porquinho deveria ser.',
      'Nem aperto, nem folga. Seguimos de olho.', 'Me conta, {nome}: o que você gastou hoje?',
      'Mês no fio da navalha. Um cafezinho a menos e a gente respira.', 'Anotou tudo? Gasto esquecido é moedinha que foge.',
      'Tá empatado. Eu torço pelo time do "sobrou".', 'Sem sustos por enquanto. Gosto assim.'],
    triste:['Faltam {v} para fechar o mês, {nome}. Respira, a gente ajeita.', 'Tô sentindo um vento aqui dentro… saiu mais do que entrou.',
      'Mês no vermelho em {v}. Bora rever os gastos, {nome}?', 'Ai, minhas moedinhas! Segura o cartão um pouquinho.',
      'Faltando {v}. Que tal olhar as assinaturas?', 'Não é o fim do mundo, {nome}: é só {v}. Mas vamos cuidar.',
      'Eu emagreci {v} este mês. Me ajuda?', 'Cartão, senta lá um pouco. Faltam {v}.']},
  hacker:{
    feliz:['> saldo: +{v}. Sistema estável.', 'Acesso concedido: {v} sobrando, {nome}.', 'Nenhum bug no orçamento. Bip bop.',
      'Compilou sem erros: mês no azul.', 'Firewall do cofrinho ativo. {v} protegidos.', 'sudo guardar {v}. Feito.'],
    ok:['> status: OK. Aguardando novos lançamentos.', 'Rodando em modo econômico, {nome}.', 'Ping no orçamento: resposta em 0 ms.',
      'Log do dia vazio. Lançou tudo?', 'Sem alertas. Monitorando…', 'Entrada e saída empatadas. Zero a zero binário.'],
    triste:['ALERTA: déficit de {v} detectado.', 'Erro 402: faltam {v}, {nome}.', 'Vazamento de moedas em andamento. Faltam {v}.',
      'Orçamento invadido por boletos. Contra-atacar?', 'Memória cheia de parcelas. Faltam {v}.', '> encerrando gastos supérfluos…']},
  boneca:{
    feliz:['Sobrou {v}! Hoje o dia é rosa, {nome}.', 'Um arraso: mês no azul e brilho no olhar.',
      'Com {v} de sobra, dá até pra sonhar com o castelo.', 'Linda, organizada e com {v} guardados.',
      'Glitter e saldo positivo: combinação perfeita.', 'Hoje eu desfilo: fechamos com {v}!'],
    ok:['Tudo no lugar, {nome}. Como um bom closet.', 'Nem sobra, nem falta: equilíbrio é chique.', 'Conta pra mim, {nome}: teve comprinha hoje?',
      'Anotar os gastos também é autocuidado.', 'Mês comportado. Continuamos brilhando.', 'De olho na carteira e no brilho.'],
    triste:['Faltam {v}… respira, {nome}, a gente dá um jeito.', 'O saldo ficou menos rosa: {v} no vermelho.',
      'Hora de guardar o cartão na bolsinha. Faltam {v}.', 'Nem todo dia é de festa. Faltam {v}.', 'Vamos rever as comprinhas? Faltam {v}.',
      'Sem drama: {v} a gente recupera.']},
  corrida:{
    feliz:['Bandeirada! Mês fechando com {v} de vantagem.', 'Pole position: {v} sobrando, {nome}.', 'Volta mais rápida do orçamento!',
      'Tanque cheio: {v} na reserva.', 'Ultrapassamos os boletos pela direita.', 'No pódio com {v}. Champanhe? Só de água.'],
    ok:['Ritmo de corrida, {nome}. Sem forçar o motor.', 'Parada no box: lançou os gastos de hoje?', 'Pneus bons, estratégia mantida.',
      'Lado a lado com os gastos. Segura a curva!', 'Sem bandeira amarela por enquanto.', 'Meio da prova: concentração total.'],
    triste:['Bandeira vermelha: faltam {v}.', 'Motor no limite, {nome}. Faltam {v}.', 'Pneu furado no orçamento: {v} atrás.',
      'Hora de tirar o pé. Faltam {v}.', 'Derrapamos na curva dos gastos. Faltam {v}.', 'Pit stop urgente: rever as despesas.']},
  neon:{
    feliz:['A pista tá cheia: {v} sobrando, {nome}!', 'Batida boa e saldo positivo.', 'Solta o grave: fechamos com {v}!',
      'Hoje o set é de vitória. Miau.', 'Luzes acesas, bolso tranquilo.', 'Remix perfeito: ganhar mais, gastar menos.'],
    ok:['No ritmo, {nome}. Nem acelera, nem para.', 'Mixando ganhos e gastos sem desafinar.', 'Qual foi o gasto de hoje? Conta no microfone.',
      'Volume no médio. Tudo sob controle.', 'Passando o som do orçamento.', 'Sem ruído na pista.'],
    triste:['Desafinou: faltam {v}.', 'A música parou, {nome}. Faltam {v}.', 'Queimou um fusível no orçamento: {v}.',
      'Baixa o volume dos gastos. Faltam {v}.', 'Set difícil hoje. Faltam {v}.', 'Hora de trocar o disco das despesas.']},
  papel:{
    feliz:['Conforme os registros, sobram {v}. Excelente, {nome}.', 'A prudência rende: {v} de saldo.', 'Capítulo feliz no livro-caixa.',
      'Quem anota, não se espanta. Sobram {v}.', 'Economia exemplar. Uh-uh!', 'Nota dez em finanças este mês.'],
    ok:['Tudo devidamente anotado, {nome}?', 'O livro-caixa está em ordem.', 'Mês equilibrado, como recomenda a boa doutrina.',
      'Uma coruja atenta não perde um centavo.', 'Sem novidades no balancete.', 'Estudando os seus gastos com calma.'],
    triste:['Segundo meus cálculos, faltam {v}.', 'Página difícil, {nome}: {v} negativos.', 'Recomendo revisar as despesas. Faltam {v}.',
      'A lição do mês: gastou-se {v} além.', 'Hora de consultar o orçamento.', 'Nem os sábios escapam de um mês apertado.']},
  praia:{
    feliz:['Sombra, água fresca e {v} sobrando.', 'Maré boa, {nome}: fechamos no azul.', 'Dá até pra um picolé: sobram {v}.',
      'Sol brilhando no orçamento.', 'Pé na areia e conta em dia.', 'Onda perfeita: {v} de saldo.'],
    ok:['Mar calmo por aqui, {nome}.', 'Nem ressaca, nem maré alta.', 'Passou protetor no bolso hoje?', 'Brisa leve nas finanças.',
      'De boa na rede, de olho nos gastos.', 'Anota aí antes do mergulho.'],
    triste:['Maré baixa: faltam {v}.', 'Vem onda forte, {nome}. Faltam {v}.', 'O sol torrou {v} do orçamento.',
      'Hora de recolher a canga dos gastos.', 'Areia no cofrinho. Faltam {v}.', 'Ressaca de boletos. Vamos com calma.']},
  noite:{
    feliz:['O céu gira em festa: sobram {v}, {nome}.', 'Pintei o mês de azul. E sobrou {v}.', 'As estrelas brilham mais com a conta em dia.',
      'Uma obra-prima de orçamento.', 'Pinceladas certeiras: {v} de saldo.', 'Hoje até o cipreste dança.'],
    ok:['Noite tranquila na vila, {nome}.', 'Cada gasto é uma pincelada. Anotou?', 'O quadro do mês está tomando forma.',
      'Nem tempestade, nem calmaria.', 'Olhando as estrelas e as contas.', 'Tons equilibrados na paleta.'],
    triste:['Faltou tinta: {v} a menos.', 'Noite turbulenta, {nome}. Faltam {v}.', 'O redemoinho levou {v}.', 'Até os gênios tiveram meses difíceis.',
      'Vamos repintar esse orçamento.', 'Céu fechado. Faltam {v}.']},
  bruxo:{
    feliz:['Feitiço de multiplicar moedas: sobram {v}!', 'Dez pontos para {nome}: mês no azul.', 'O cofre encantado guardou {v}.',
      'Poção da economia funcionando.', 'Nem precisei de varinha: sobrou {v}.', 'Mágica mesmo é fechar o mês com folga.'],
    ok:['Nada de travessuras no orçamento, {nome}.', 'Caldeirão em fogo baixo. Tudo sob controle.', 'Anotou os gastos no pergaminho?',
      'Equilíbrio digno de um bom feiticeiro.', 'A coruja ainda não trouxe más notícias.', 'Sem feitiços estranhos por aqui.'],
    triste:['Alguém lançou um feitiço de sumiço: faltam {v}.', 'Faltam {v}, {nome}. Hora de um contrafeitiço.',
      'O dragão do cofre está com fome: {v}.', 'Poção errada este mês. Faltam {v}.', 'Nem toda mágica dá certo. Vamos rever.',
      'Menos dez pontos para os gastos.']},
  espaco:{
    feliz:['Órbita estável: {v} sobrando, {nome}.', 'Missão cumprida, mês no azul!', 'Combustível de sobra: {v}.', 'Pousamos com {v} no tanque.',
      'Rumo às estrelas, sem dívidas.', 'Central, aqui é o cofrinho: tudo certo.'],
    ok:['Navegando em velocidade de cruzeiro, {nome}.', 'Sem turbulência no orçamento.', 'Registrou os gastos no diário de bordo?',
      'Gravidade normal por aqui.', 'Radar limpo. Seguimos.', 'Trajetória mantida.'],
    triste:['Houston, faltam {v}.', 'Alerta de combustível: {v} a menos.', 'Entramos num buraco negro de gastos, {nome}.',
      'Chuva de meteoros no orçamento: {v}.', 'Corrigindo a rota. Faltam {v}.', 'Oxigênio baixo no cofrinho.']},
  floresta:{
    feliz:['Colheita boa: sobram {v}, {nome}.', 'A toca está cheia para o inverno.', 'Guardei {v} debaixo da árvore.',
      'Dia de sol na floresta e na conta.', 'Raposa esperta guarda antes de gastar.', 'Folhas verdes, saldo verde.'],
    ok:['Tudo calmo na trilha, {nome}.', 'Nem seca, nem enchente.', 'Farejou algum gasto hoje? Anota.', 'Passo a passo, sem pressa.',
      'A floresta está em equilíbrio.', 'De orelha em pé nos gastos.'],
    triste:['A toca ficou vazia: faltam {v}.', 'Inverno chegando, {nome}. Faltam {v}.', 'Alguém comeu as provisões: {v}.', 'Trilha difícil este mês.',
      'Hora de guardar mais nozes.', 'Faltam {v}. Vamos farejar onde cortar.']},
  retro:{
    feliz:['+{v} PONTOS! FASE CONCLUÍDA.', 'NOVO RECORDE, {nome}!', 'VIDA EXTRA: sobram {v}.', 'CHEFÃO DOS BOLETOS DERROTADO.',
      'COMBO DE ECONOMIA x3!', 'Moedas coletadas: {v}.'],
    ok:['FASE EM ANDAMENTO…', 'PRESS START para lançar um gasto.', 'Sem inimigos à vista, {nome}.', 'Energia no meio da barra.', 'Jogo salvo.',
      'Modo normal ativado.'],
    triste:['GAME OVER? Ainda não: faltam {v}.', 'Você perdeu {v} moedas, {nome}.', 'Chefão dos boletos na tela!', 'Energia baixa. Faltam {v}.',
      'CONTINUE? 9… 8… 7…', 'Insira mais moedas no cofrinho.']},
  dragao:{
    feliz:['Voo tranquilo: sobram {v}, {nome}.', 'Tesouro protegido: {v} guardados.', 'Nenhum invasor no ninho de moedas.',
      'Rugido de alegria: mês no azul!', 'Planando com {v} de folga.', 'Dragão bem alimentado, bolso também.'],
    ok:['Céu limpo sobre a ilha, {nome}.', 'De olho no tesouro.', 'Pousou algum gasto hoje? Anota.', 'Asas abertas, vento a favor.',
      'Tudo calmo na caverna.', 'Patrulha sem novidades.'],
    triste:['Fogo no orçamento: faltam {v}.', 'O tesouro encolheu {v}, {nome}.', 'Tempestade à frente. Faltam {v}.', 'Queimamos {v} a mais.',
      'Hora de voar baixo nos gastos.', 'O ninho precisa de mais moedas.']},
  grandprix:{
    feliz:['Vitória de ponta a ponta: sobram {v}!', 'Bandeira quadriculada, {nome}: mês no azul.', 'Largada perfeita e {v} no tanque.',
      'Campeão da economia desta temporada.', 'Volta de honra com {v} de sobra.', 'Motor cantando, bolso sorrindo.'],
    ok:['Reta longa, {nome}. Ritmo constante.', 'Conferindo os mostradores do orçamento.', 'Passou no box hoje? Anota o gasto.',
      'Nada de sustos na pista.', 'Seguimos no vácuo dos gastos.', 'Corrida limpa até aqui.'],
    triste:['Rodamos na curva: faltam {v}.', 'Bandeira amarela, {nome}. Faltam {v}.', 'O motor pediu arrego: {v} atrás.',
      'Abandonar? Jamais. Mas faltam {v}.', 'Hora de trocar a estratégia.', 'Perdemos posições para os boletos.']},
  rua:{
    feliz:['Quarto de milha vencido: sobram {v}.', 'Nitro guardado, {nome}: {v} no bolso.', 'Família, contas pagas e {v} sobrando.',
      'Arrancada limpa neste mês.', 'Motor turbinado, carteira também.', 'Ganhamos o racha contra os boletos.'],
    ok:['Rodando na boa, {nome}.', 'Sem pisar fundo no cartão.', 'Abasteceu hoje? Lança o gasto.', 'Noite calma no asfalto.',
      'De olho no retrovisor dos gastos.', 'Marcha lenta, tudo sob controle.'],
    triste:['Queimamos a largada: faltam {v}.', 'Acabou o nitro, {nome}. Faltam {v}.', 'Motor fundido no orçamento: {v}.',
      'Perdemos o racha deste mês.', 'Hora de voltar pra garagem e rever os gastos.', 'O tanque secou. Faltam {v}.']},
  drift:{
    feliz:['Curva perfeita: sobram {v}, {nome}.', 'Deslizando com {v} de folga.', 'O rei do drift fecha no azul.',
      'Fumaça nos pneus, não na carteira.', 'Controle total: {v} guardados.', 'Descida da montanha sem um arranhão.'],
    ok:['Carro alinhado, {nome}.', 'Entrando na curva com calma.', 'Anotou o gasto antes da próxima curva?', 'Traseira firme, orçamento também.',
      'Noite tranquila na cidade.', 'Ajustando o ponto de frenagem.'],
    triste:['Saímos de traseira: faltam {v}.', 'Bateu no muro, {nome}. Faltam {v}.', 'Pneus carecas no orçamento: {v}.',
      'Curva fechada demais este mês.', 'Hora de treinar o controle dos gastos.', 'Perdemos a traseira. Faltam {v}.']},
  fusca:{
    feliz:['Bip-bip! Sobraram {v}, {nome}.', 'Pequeno, valente e com {v} no porta-luvas.', 'Cruzamos a linha na frente dos boletos.',
      'Motor traseiro, saldo dianteiro.', 'Hoje eu empino de alegria.', 'Quem diria: o fusquinha venceu o mês.'],
    ok:['Rodando redondinho, {nome}.', 'Devagar e sempre a gente chega.', 'Parou pra abastecer? Anota aí.', 'Nenhum barulho estranho no orçamento.',
      'Farol aceso, olho nos gastos.', 'Na estrada, sem pressa.'],
    triste:['Enguiçou: faltam {v}.', 'Preciso de um empurrãozinho, {nome}. Faltam {v}.', 'Furou o pneu do orçamento: {v}.',
      'Subida difícil este mês.', 'Vamos pra oficina rever os gastos.', 'Engasguei. Faltam {v}.']},
  vikings:{
    feliz:['Saque glorioso: sobram {v}, {nome}!', 'O baú está cheio. Skol!', 'Os deuses sorriem: {v} de folga.', 'Banquete garantido neste mês.',
      'Velas ao vento e ouro no porão.', 'Digno de uma saga: mês no azul.'],
    ok:['Mar calmo no fiorde, {nome}.', 'Remando no ritmo.', 'Algum gasto na travessia? Anota.', 'O escudo está firme.', 'Sem tempestade à vista.',
      'O clã está em paz com as contas.'],
    triste:['O baú foi saqueado: faltam {v}.', 'Inverno duro, {nome}. Faltam {v}.', 'Naufragaram {v} moedas.', 'Os corvos trazem más notícias.',
      'Hora de afiar o machado nos gastos.', 'Faltam {v}. À luta!']},
  espartano:{
    feliz:['Vitória! Sobram {v}, {nome}.', 'Disciplina dá resultado: {v} guardados.', 'O orçamento resistiu como uma muralha.',
      'Batalha vencida este mês.', 'Escudo erguido, saldo positivo.', 'Honra e {v} no cofre.'],
    ok:['Formação mantida, {nome}.', 'Guardando a passagem do orçamento.', 'Algum gasto em combate? Anota.', 'Sem baixas por enquanto.',
      'Vigília tranquila.', 'Treino diário: anotar tudo.'],
    triste:['Perdemos terreno: faltam {v}.', 'Batalha dura, {nome}. Faltam {v}.', 'O inimigo levou {v}.', 'Recuar para reagrupar os gastos.',
      'Um guerreiro não desiste: vamos rever.', 'A muralha cedeu. Faltam {v}.']}
};
// Temas por categoria (js/temas.js e js/temas2.js): cinco falas próprias do tema por humor (FALAS_TEMA + FALAS_MAIS + FALAS_MAIS2).
// As falas da categoria só entram se um tema ainda não tiver as suas em FALAS_MAIS.
for (const [k, [feliz, ok, triste]] of Object.entries(FALAS_TEMA)){
  const m = FALAS_MAIS[k], n = FALAS_MAIS2[k] || [[], [], []], c = FALAS_CAT[temaCat(k)] || FALAS_CAT.gerais;
  FUN_TEMA[k] = m ? {feliz:[feliz, ...m[0], ...n[0]], ok:[ok, ...m[1], ...n[1]], triste:[triste, ...m[2], ...n[2]]} : {feliz:[feliz, ...c.feliz],
    ok:[ok, ...c.ok], triste:[triste, ...c.triste]};
}
// Bloco do Resumo: o porquinho reage ao saldo do mês atual. Tocar nele troca a fala.
// Frase do balão: muda com o dia e a cada toque no personagem (funState.tap).
function funFala(mood = funMood()){
  const falas = (FUN_TEMA[db.prefs.skin] || FUN_TEMA[''])[mood];
  return esc(comNome(falas[(now.getDate() + funState.tap) % falas.length])).replace('{v}', fmt(Math.abs(totalIn(curYM) - totalOutPrev(curYM))));
}
function funMascot(){
  const mood = funMood(), ganhas = funBadgeList().filter(b => b[3]).length, nivel = [...FUN_LEVELS].reverse().find(l => ganhas >= l[0])[1];
  return `<div class="card fun" data-onclick="funPoke()"><div class="pigBox">${pigSvg(mood)}</div>
    <div class="mid"><div class="bubble">${funFala(mood)}</div>
    <small>${I('trophy', 13)} ${nivel}${funState.streak > 1 ? ` · ${I('flame', 13)} ${funState.streak} dias seguidos` : ''}</small></div></div>`;
}
// Toque no personagem: só a frase do balão troca, com transição (.bubble.troca); a tela e o personagem ficam como estão.
function funPoke(){
  funState.tap++;
  const b = document.querySelector('#app .card.fun .bubble');
  if (!b) return;
  b.innerHTML = funFala();
  b.classList.remove('troca'); void b.offsetWidth; b.classList.add('troca'); // reinicia a transição
}
// Bloco do Resumo: quantas já foram ganhas, as últimas de cada família e as três mais perto de sair.
function funBadges(){
  const fams = funFamilies(), list = funBadgeList(), ganhas = list.filter(b => b[3]).length;
  const proximas = fams.map(([ic, nome, como, v, metas]) => { const i = metas.findIndex(n => v < n);
    return i < 0 ? null : {ic, nome:metas.length > 1 ? `${nome} ${ROMANOS[i]}` : nome, como:como(metas[i]), pct:Math.min(99, v / metas[i] * 100)}; })
    .filter(Boolean).sort((a, b) => b.pct - a.pct).slice(0, 3);
  const topo = fams.map(([ic, nome, , v, metas]) => { const n = metas.filter(m => v >= m).length;
    return n ? [ic, metas.length > 1 ? `${nome} ${ROMANOS[n - 1]}` : nome] : null; }).filter(Boolean);
  return `${challengeHtml()}<h2>Conquistas <button data-onclick="openBadges()">Ver todas (${ganhas} de ${list.length})</button></h2>
  <div class="card"><div class="semTopo bar"><i style="width:${ganhas / list.length * 100}%"></i></div>
    ${topo.length ? `<div class="badges">${topo.map(([ic, nome]) => `<button class="on" data-onclick="openBadges()"><span>${I(ic, 24)}</span>${nome}</button>`).join('')}</div>` : ''}
    ${proximas.length ? `<div class="hint" style="margin:10px 0 2px">Mais perto de ganhar:</div>${proximas.map(p => `<div class="catrow"><div class="top"><span>${I(p.ic, 16)} ${p.nome}</span><b>${Math.floor(p.pct)}%</b></div>
      <div class="hint u-mt2">${cap(p.como)}</div><div class="bar"><i style="width:${p.pct}%"></i></div></div>`).join('')}` : ''}</div>`;
}
// Todas as conquistas, por família, com o nível de cada uma. novas: nomes recém-ganhos (ex.: "Anotador II", vindos do
// aviso na central): a família de cada uma aparece em destaque, com "Nova!", e a tela rola até a primeira.
function openBadges(novas = []){
  settingsOpen = false; F = null;
  const nova = nome => (Array.isArray(novas) ? novas : []).some(n => n === nome || String(n).startsWith(nome + ' '));
  const list = funBadgeList(), ganhas = list.filter(b => b[3]).length;
  showSheet(`<h3>Conquistas: ${ganhas} de ${list.length}</h3>
    <div class="semTopo hint">Cada uma tem níveis: a próxima aparece quando você passa da anterior. Toque numa para ver os níveis.</div>
    ${funFamilies().map((fam, f) => { const [ic, nome, como, , metas] = fam, e = conqEstado(fam); return `
      <div class="item conq${nova(nome) ? ' sugDestaque' : ''}" data-onclick="openConq(${f})">${tile(ic)}<div class="mid">
        <b>${esc(e.titulo)}${nova(nome) ? ' <span class="tag in">Nova!</span>' : ''}</b>
        <small class="quebra">${e.completo ? 'Todos os níveis conquistados!' : cap(como(metas[e.n]))}</small>${conqBarra(e)}</div>
        ${I('chev', 18)}</div>`; }).join('')}
    <div class="btns foot"><button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
  const d = document.querySelector('#sheet .sugDestaque');
  if (d) d.scrollIntoView({block:'center'});
}
function confetti(){
  if (!db.prefs.anim) return;
  if (festaTema()) return; // com tema especial, a comemoração usa as formas e as cores dele (js/cena.js)
  const box = document.createElement('div'), cores = [shade(0, 4), shade(2, 4), '#fbbf24', '#34d399', '#f472b6', '#38bdf8'];
  box.className = 'confetti';
  box.innerHTML = [...Array(44)].map((_, i) => `<i style="left:${Math.random() * 100}%;background:${cores[i % cores.length]};animation-delay:${Math.random() * .25}s;animation-duration:${1.1 + Math.random() * .9}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--x:${Math.round(Math.random() * 120 - 60)}px;${i % 3 ? '' : 'border-radius:50%'}"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2400);
}
// Os números grandes dos cartões de destaque sobem de zero até o valor.
function funCount(){
  if (!db.prefs.fun || !db.prefs.anim) return;
  document.querySelectorAll('#app .hero .big').forEach(el => {
    if (hideVals) return;
    // O número vem de data-v (bigNum), não do texto: o texto já formatado ("R$ 4.002", "R$ 29,3 mil") não volta a número.
    const fim = +el.dataset.v, curto = el.dataset.f === 'c', t0 = performance.now(), final = el.textContent;
    if (!fim) return;
    const passo = t => { const k = Math.min(1, (t - t0) / 650);
      el.textContent = k < 1 ? (curto ? fmtCurto : fmt)(fim * (1 - Math.pow(1 - k, 3))) : final; if (k < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
  });
}
