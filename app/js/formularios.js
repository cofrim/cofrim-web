// Cofrim — Formulários: os campos de cada um, abrir, preencher, conferir e salvar.
// Carregado na ordem do index.html (lista e dependências em docs/MAPA.md).
// ---------- Formulários ----------
// Cada formulário: fields (lista ou função que devolve a lista), e opcionalmente defaults, load (ajusta os
// valores ao abrir), onChange, hint, check (valida; devolve mensagem de erro) e commit (grava; sem ele,
// o registro é criado/alterado em db[col]).
const opts = cats => Object.entries(cats).filter(([,c]) => !c[3]).map(([k,c]) => [k, c[1]]); // sem as escondidas
// Dia em que um ganho cai: num ganho fixo ou anual, também o último ou o primeiro dia útil, o N-ésimo dia útil, ou um dia
// escolhido que, em fim de semana ou feriado, passa para o dia útil antes ou depois (diaGanho, em calculos.js).
const DIA_GANHO_FIELDS = [
  {k:'regra', label:'Dia em que cai', type:'select', optional:true, showIf:v => v.fixed, more:true,
    options:[['', 'Um dia do mês que eu escolho'], ['ult', 'Último dia útil do mês'], ['prim', 'Primeiro dia útil do mês'],
      ['nutil', 'Um dia útil contado (ex.: 5º dia útil)']]},
  {k:'day', label:v => v.fixed && v.regra === 'nutil' ? 'Qual dia útil (ex.: 5 para o 5º)' : 'Dia em que cai (opcional)', type:'int', optional:true,
    showIf:v => !v.fixed || !v.regra || v.regra === 'nutil', more:true},
  {k:'ajuste', label:'Se esse dia cair em fim de semana ou feriado', type:'select', optional:true, showIf:v => v.fixed && !v.regra && +v.day > 0,
    more:true, options:[['', 'Recebo nesse dia mesmo'], ['antes', 'A empresa paga antes (dia útil anterior)'], ['depois', 'Recebo no próximo dia útil']]}];
// Ao salvar: só o que vale para o tipo escolhido (avulso não tem regra; último/primeiro dia útil não têm dia).
function diaGanhoCheck(v){
  if (!v.fixed) v.regra = '';
  if (v.regra && v.regra !== 'nutil') v.day = '';
  if (v.regra || !v.day) v.ajuste = '';
  if (v.regra === 'nutil' && v.day !== '' && (v.day < 1 || v.day > 23)) return 'O dia útil deve ser de 1 a 23.';
  return dayOk(v, 'day', 'O dia');
}
// Em alguns meses (ver activeIn): no formulário, o Tipo 'n' (a cada X meses, campo cada) ou 'm' (meses escolhidos,
// campo meses: "1,2,3"); ao salvar, os dois viram fixed 'y' com rep (submitForm e repDe).
const REP_FIELDS = [
  {k:'cada', label:'A cada quantos meses', type:'int', atalhos:[2, 3, 4, 6], showIf:v => v.fixed === 'n', more:true},
  {k:'meses', label:'Em quais meses', type:'meses', showIf:v => v.fixed === 'm', more:true}];
const TIPO_REP = [['n', 'A cada X meses (PLR, IPTU em parcelas…)'], ['m', 'Meses escolhidos (IPVA em jan, fev e mar…)']];
const mesesDe = s => String(s || '').split(',').map(Number).filter(m => m >= 1 && m <= 12);
function repCheck(v){
  if (v.repTipo === 'n' && !(v.cada >= 2 && v.cada <= 24)) return 'Escolha de 2 a 24 meses.';
  if (v.repTipo === 'm' && !mesesDe(v.meses).length) return 'Marque pelo menos um mês.';
  return '';
}
// rep do registro a partir do formulário (undefined: anual, fixo ou avulso). Nos meses escolhidos, o início passa para o
// primeiro mês marcado a partir dele (um APK antigo mostra o lançamento nesse mês).
function repDe(rec, {repTipo, cada, meses}){
  rec.rep = repTipo === 'n' ? cada : repTipo === 'm' ? mesesDe(meses) : undefined;
  if (Array.isArray(rec.rep)) for (let m = rec.start, i = 0; i < 12; i++, m = addMonths(m, 1)) if (rec.rep.includes(+m.slice(5))){ rec.start = m; break; }
  return rec;
}
const dayOk = (v, k, name) => v[k] !== '' && (v[k] < 1 || v[k] > 31) ? name + ' deve ser de 1 a 31.' : '';
// Ganhos e gastos fixos: ao editar, a alteração pode valer só a partir de um mês. Nesse caso o registro antigo
// é encerrado no mês anterior e nasce um novo a partir dali, de modo que os meses passados ficam como estavam.
const wasMonthly = () => F && F.id && (db[F.col].find(x => x.id === F.id) || {}).fixed === true;
const SCOPE_FIELDS = [
  {k:'scope', label:'Aplicar a alteração', type:'select', optional:true, showIf:v => wasMonthly() && v.fixed === '1',
    options:[['from','Só a partir de um mês (mantém o histórico)'],['all','Em todos os meses, inclusive os passados']]},
  {k:'from', label:'Vale a partir de', type:'month', showIf:v => wasMonthly() && v.fixed === '1' && v.scope === 'from'}];
const commitRecurring = col => (v, id, newId) => {
  const {scope, from, repTipo, cada, meses, ...rec} = v;
  repDe(rec, {repTipo, cada, meses});
  if (rec.rep === undefined) delete rec.rep;
  if (!id) return void db[col].push(touch({id:newId, ...rec}));
  const old = db[col].find(x => x.id === id);
  if (scope === 'from' && old.fixed === true && rec.fixed === true && from > old.start && (!old.end || from <= old.end)){
    const pm = old.pm || [];
    db[col].push(touch({...old, ...rec, id:uid(), start:from, pm:pm.filter(m => m >= from), edi:Date.now()}));
    Object.assign(touch(old), {end:addMonths(from, -1), pm:pm.filter(m => m < from)});
  } else { Object.assign(touch(old), rec); if (rec.rep === undefined) delete old.rep; }
};
// Campos de venda/provento: lançar nos Ganhos e em qual conta o dinheiro cai.
const CASH_FIELDS = label => [
  {k:'toIncome', label, type:'select', optional:true, options:[['1','Sim'],['','Não']]},
  {k:'account', label:'Conta que recebe o dinheiro (opcional)', type:'select', optional:true, banco:true,
    options:() => [['', 'Não informar'], ...db.accounts.map(a => [a.name, a.name])]}];
function catDefaults(v){
  const last = db.expenses.filter(x => x.cat === v.cat && (x.bank || x.pay)).sort((a, b) => (b.u || 0) - (a.u || 0))[0];
  v.bank = last ? last.bank || '' : ''; v.pay = last ? last.pay || '' : '';
  return v;
}
// Gastos avulsos lançados pelo menos duas vezes com a mesma descrição e categoria, dos mais frequentes para os menos.
function frequent(){
  const g = {};
  for (const x of db.expenses){ if (x.fixed || !x.desc) continue; const k = plain(x.desc) + '|' + x.cat; (g[k] = g[k] || []).push(x); }
  const novo = a => Math.max(...a.map(x => x.u || 0));
  return Object.values(g).filter(a => a.length >= 2).sort((a, b) => b.length - a.length || novo(b) - novo(a)).slice(0, 6)
    .map(a => ({...a.sort((x, y) => (y.u || 0) - (x.u || 0))[0], same:a.every(x => x.value === a[0].value)}));
}
function repeatFill(i){
  const x = F.freq[i];
  Object.assign(F.vals, {desc:x.desc, cat:x.cat, bank:x.bank || '', pay:x.pay || ''}, x.same ? {value:moneyStr(x.value)} : {});
  Object.assign(F.touched, {desc:true, cat:true, bank:true, pay:true});
  syncForm();
  document.getElementById('f_value').focus();
}
const FORMS = {
  // Campos com more:true ficam atrás de "Mais opções" num lançamento novo (lançamento rápido); big = valor em destaque.
  incomes: { title:'ganho', defaults:() => ({cat:'salario', fixed:'1', start:curYM}), fields:() => formVale ? [
    {k:'value', label:'Valor do crédito', type:'money', big:true},
    {k:'cat', label:'Qual vale', type:'select', options:() => Object.entries(VALES)},
    EMP_FIELD,
    {k:'fixed', label:'Repete', type:'select', options:[['1','Todo mês'],['','Só neste mês']]},
    ...DIA_GANHO_FIELDS,
    {k:'start', label:v => v.fixed ? 'A partir de' : 'Mês', type:'month', more:true},
    {k:'end', label:'Até (opcional)', type:'month', optional:true, showIf:v => v.fixed, more:true},
    ...SCOPE_FIELDS] : [
    {k:'value', label:'Valor', type:'money', big:true},
    {k:'cat', label:'Categoria', type:'select', options:() => opts(CAT_GANHO)},
    {k:'desc', label:'Descrição (opcional)', type:'text', ph:'Ex.: Salário', optional:true},
    {k:'fixed', label:'Tipo', type:'select',
      options:[['1','Fixo — repete todo mês'],['y','Anual — uma vez por ano (13º, bônus…)'], ...TIPO_REP, ['','Avulso — só em um mês']]},
    ...REP_FIELDS,
    {k:'bank', label:'Conta onde cai (opcional)', type:'text', ph:'Ex.: Nubank', optional:true, sug:bankSuggestions, more:true},
    ...DIA_GANHO_FIELDS,
    {k:'start', label:v => v.fixed === 'y' ? 'Mês em que recebe (repete todo ano)' : v.fixed === 'n' ? 'Primeiro mês' : v.fixed ? 'A partir de' : 'Mês',
      type:'month', more:true},
    {k:'end', label:'Até (opcional)', type:'month', optional:true, showIf:v => v.fixed, more:true},
    ...SCOPE_FIELDS],
    load(v){ v.scope = 'from'; v.from = curYM; },
    summary:v => [v.bank, diaGanhoTexto(v), repResumo(v), v.start && v.start !== curYM && cap(monthName(v.start))].filter(Boolean).join(' · '),
    onChange(k, v, isNew, touched){ if (formVale && isNew && k === 'cat' && !touched.emp) v.emp = valeEmp(v.cat); },
    check(v){ if (!v.desc || formVale) v.desc = (CAT_GANHO[v.cat] || [0, 'Ganho'])[1]; return repCheck(v) || diaGanhoCheck(v); },
    commit:commitRecurring('incomes')},
  // Gasto novo à vista ou parcelado (parc): parcelado vira uma compra parcelada em db.installments, a mesma da aba
  // Parceladas (ver commit), com o mês do gasto como mês da 1ª parcela.
  expenses: { title:'gasto', defaults:() => catDefaults({cat:'alimentacao', fixed:'', start:state.month, parc:'', mode:'total'}), fields:() => formVale ? [
    {k:'value', label:'Valor', type:'money', big:true},
    {k:'pay', label:'Qual vale', type:'select', options:() => Object.entries(VALES)},
    EMP_FIELD,
    {k:'desc', label:'Descrição (opcional)', type:'text', ph:'Ex.: Almoço', optional:true},
    {k:'day', label:'Dia (opcional)', type:'int', optional:true, more:true},
    {k:'start', label:'Mês', type:'month', more:true}] : [
    {k:'value', label:v => !parcelado(v) ? 'Valor' : v.mode === 'parcela' ? 'Valor da parcela' : 'Valor total da compra', type:'money', big:true},
    {k:'parc', label:'Pagamento', type:'select', optional:true, showIf:v => !(F && F.id) && !v.fixed, options:[['', 'À vista'], ['1', 'Parcelado']]},
    {k:'n', label:'Número de parcelas', type:'int', showIf:parcelado},
    {k:'mode', label:'Informar', type:'select', showIf:parcelado, options:[['total', 'Valor total da compra'], ['parcela', 'Valor de cada parcela']]},
    {k:'cat', label:'Categoria', type:'select', options:() => opts(CAT_GASTO).filter(o => o[0] !== 'emprestimo')},
    {k:'desc', label:'Descrição (opcional)', type:'text', ph:'Ex.: Mercado', optional:true},
    ...WHERE_FIELDS().map(f => ({...f, more:true})),
    {k:'tags', label:'Etiquetas (opcional, separadas por vírgula)', type:'text', ph:'Ex.: viagem SP', optional:true, more:true, showIf:aVista,
      sug:() => [...new Set(db.expenses.flatMap(tagsOf))]},
    {k:'who', label:'Dividir com (nome da pessoa, opcional)', type:'text', ph:'Ex.: Ana', optional:true, more:true, showIf:aVista,
      sug:() => [...new Set(db.expenses.map(x => x.who).filter(Boolean))]},
    {k:'share', label:v => v.fixed ? 'Parte que a outra pessoa te paga a cada vez' : 'Parte que a outra pessoa vai te pagar', type:'money',
      showIf:v => aVista(v) && v.who, more:true},
    {k:'fixed', label:'Tipo', type:'select', more:true, showIf:aVista,
      options:[['','Só neste mês'],['1','Fixo — repete todo mês (aluguel, internet…)'],['y','Anual — uma vez por ano (IPVA, seguro…)'],
        ...TIPO_REP]},
    ...REP_FIELDS.map(f => ({...f, showIf:v => aVista(v) && f.showIf(v)})),
    {k:'sub', label:'Assinatura ou conta fixa?', type:'select', optional:true, more:true, showIf:v => v.fixed === '1',
      options:[['','Automático, pelo nome e pela categoria (Netflix, Spotify, streaming…)'],['1','Assinatura'],['0','Conta fixa']]},
    {k:'start', label:v => parcelado(v) ? 'Mês da 1ª parcela' : v.fixed === 'y' ? 'Mês em que paga (repete todo ano)' : v.fixed === 'n' ? 'Primeiro mês'
      : v.fixed ? 'A partir de' : 'Mês',
      type:'month', more:true},
    {k:'day', label:'Dia da compra (opcional, usado na fatura do cartão)', type:'int', optional:true, showIf:v => aVista(v) && !v.fixed, more:true},
    {k:'due', label:'Dia do vencimento (opcional, para lembretes)', type:'int', optional:true, showIf:v => v.fixed, more:true},
    {k:'end', label:'Até (opcional)', type:'month', optional:true, showIf:v => v.fixed, more:true},
    ...SCOPE_FIELDS],
    load(v){ v.scope = 'from'; v.from = state.month; },
    // Repetir um gasto: os avulsos mais frequentes viram botões no topo do formulário novo.
    top(){ if (formVale) return ''; F.freq = frequent(); return F.freq.length ? `<label>Repetir um gasto</label><div class="chips rep">${F.freq.map((x, i) => `<button type="button" data-onclick="repeatFill(${i})">${esc(x.desc)}</button>`).join('')}</div>` : ''; },
    // Ao trocar a categoria num gasto novo, banco e forma de pagamento vêm do último gasto dessa categoria.
    onChange(k, v, isNew, touched){
      if (formVale){ if (isNew && k === 'pay' && !touched.emp) v.emp = valeEmp(v.pay); return; }
      if (isNew && k === 'cat' && !touched.bank && !touched.pay) catDefaults(v); },
    hint:v => { if (!parcelado(v)) return ''; const n = parseInt(v.n), x = parseMoney(v.value), t = v.mode === 'parcela' ? x * n : x;
      return t > 0 && n > 0 ? `${n}x de ${fmt(t / n)} · total ${fmt(t)}` : ''; },
    // Parcelado: o comprovante não aparece (as parceladas não guardam foto).
    semBefore:v => parcelado(v),
    summary:v => [parcelado(v) && 'parcelado', v.bank, PAY[v.pay], ...tagsOf(v).map(t => '#' + t), v.who && 'dividido com ' + v.who,
      v.fixed === 'n' || v.fixed === 'm' ? repResumo(v) : v.fixed === 'y' ? 'anual' : v.fixed ? 'fixo' : '',
      v.start && v.start !== curYM && cap(monthName(v.start))].filter(Boolean).join(' · '),
    check(v){
      // Gasto no vale: sem categoria, banco ou conta no formulário; a categoria sai do tipo do vale (num novo).
      if (formVale){ if (!F.id){ v.cat = v.pay === 'vt' ? 'transporte' : 'alimentacao'; v.fixed = false; } if (!v.desc) v.desc = VALES[v.pay];
        return dayOk(v, 'day', 'O dia'); }
      if (!v.desc) v.desc = (CAT_GASTO[v.cat] || [0, 'Gasto'])[1];
      if (v.parc && v.n < 2) return 'Parcelado precisa de 2 parcelas ou mais.';
      if (v.who && v.share >= v.value) return 'A parte da outra pessoa precisa ser menor que o valor total.';
      if (!v.who) v.share = '';
      db.catMemo[plain(v.desc)] = v.cat; // lembra a categoria desta descrição para a importação de extratos
      return repCheck(v) || dayOk(v, 'day', 'O dia da compra') || dayOk(v, 'due', 'O dia do vencimento');
    },
    commit(v, id, newId){
      const {parc, n, mode, ...rec} = v;
      if (!parc) return commitRecurring('expenses')(rec, id, newId);
      // Compra parcelada: os mesmos campos do formulário das Parceladas; meses que já passaram contam como parcelas pagas.
      db.installments.push(touch({id:newId, desc:rec.desc, cat:rec.cat, bank:rec.bank, pay:rec.pay || 'credito', mode, n,
        total:mode === 'parcela' ? round2(rec.value * n) : rec.value, paid:Math.min(n, Math.max(0, monthDiff(curYM, rec.start))), start:rec.start, due:''}));
    },
    before:() => formVale ? '' : photoSection()},
  // Compra parcelada, financiamento ou empréstimo (formTipo, ver openForm): o mesmo formulário, com credor, conta de
  // débito e taxa nos dois últimos. Depois de um abatimento, prazo e valores mudam só pelo botão Abater (seg).
  installments: { title:() => PARC_TIPOS[formTipo] ? PARC_TIPOS[formTipo].toLowerCase() : 'compra parcelada', fem:() => !formTipo,
    defaults:() => formTipo ? {cat:formTipo === 'emprestimo' ? 'emprestimo' : 'transporte', mode:'parcela', n:'', paid:'0', start:curYM}
      : {cat:'compras', pay:'credito', mode:'total', n:'', paid:'0', start:curYM},
    fields:() => [
    {k:'desc', label:formTipo ? 'Nome' : 'Descrição', type:'text',
      ph:formTipo === 'emprestimo' ? 'Ex.: Empréstimo pessoal' : formTipo ? 'Ex.: Financiamento do carro' : 'Ex.: Celular'},
    ...(formTipo ? [
      {k:'credor', label:'Credor (banco ou financeira, opcional)', type:'text', ph:'Ex.: Caixa', optional:true, sug:bankSuggestions},
      {k:'conta', label:'Conta de débito', type:'select', optional:true, banco:true,
        options:() => [['', 'Não informar'], ...db.accounts.map(a => [a.name, a.name])]}] : []),
    {k:'cat', label:'Categoria', type:'select', options:() => opts(CAT_GASTO)},
    ...(formTipo ? [] : WHERE_FIELDS()),
    {k:'n', label:'Número de parcelas', type:'int', showIf:semAbat},
    {k:'mode', label:'Informar', type:'select', showIf:semAbat,
      options:[['total', formTipo ? 'Valor total' : 'Valor total da compra'],['parcela','Valor de cada parcela']]},
    {k:'total', label:v => v.mode === 'parcela' ? 'Valor da parcela' : formTipo ? 'Valor total' : 'Valor total da compra', type:'money', showIf:semAbat},
    {k:'paid', label:'Parcelas já pagas', type:'int', zero:true, showIf:semAbat},
    {k:'start', label:'Mês da 1ª parcela', type:'month', showIf:semAbat},
    {k:'due', label:'Dia do vencimento (opcional)', type:'int', optional:true},
    ...(formTipo ? [{k:'taxa', label:'Taxa de juros ao mês, em % (opcional)', type:'num', ph:'Ex.: 1,2', optional:true}] : [])],
    // Em compra nova, deduz o mês da 1ª parcela a partir de quantas já foram pagas. No financiamento, a categoria
    // acompanha o nome (imóvel → Moradia; carro, moto → Transporte) enquanto a pessoa não escolhe outra.
    onChange(k, v, isNew, touched){
      if (isNew && k === 'paid' && !touched.start) v.start = addMonths(curYM, -(parseInt(v.paid)||0));
      if (formTipo === 'financiamento' && k === 'desc' && !touched.cat){
        const t = plain(v.desc);
        if (/imovel|casa|apartamento|apto|terreno|lote/.test(t)) v.cat = 'moradia'; else if (/carro|moto|veiculo|caminhao/.test(t)) v.cat = 'transporte';
      }
    },
    // O campo "total" guarda o valor digitado; no modo "parcela" ele é o valor de uma parcela.
    load(v, item){ v.mode = item.mode || 'total'; if (v.mode === 'parcela') v.total = moneyStr(item.total/item.n); },
    hint:v => { if (!semAbat()) return 'Depois de um abatimento, o prazo e o valor das parcelas mudam pelo botão Abater, na tela da parcela.';
      const n = parseInt(v.n), p = parseInt(v.paid)||0, x = parseMoney(v.total), t = v.mode === 'parcela' ? x*n : x;
      return t > 0 && n > 0 ? `Total ${fmt(t)} · ${n}x de ${fmt(t/n)} · pago ${fmt(t/n*Math.min(p,n))} · falta ${fmt(t/n*Math.max(n-p,0))}` : ''; },
    check(v){
      if (v.paid > v.n) return 'As parcelas pagas não podem passar do total de parcelas.';
      if (v.taxa !== '' && v.taxa > 20) return 'A taxa de juros deve ser de 0 a 20% ao mês.';
      if (v.mode === 'parcela') v.total = round2(v.total*v.n);
      return dayOk(v, 'due', 'O dia do vencimento');
    },
    commit(v, id, newId){
      if (formTipo) v.tipo = formTipo;
      if (!id) return void db.installments.push(touch({id:newId, ...v}));
      const old = db.installments.find(x => x.id === id);
      if (old.seg) for (const k of ['n', 'mode', 'total', 'paid', 'start']) delete v[k]; // campos escondidos: mantém o que está gravado
      Object.assign(touch(old), v);
    }},
  // Dois formulários em um: categorias com cotação (QUOTE_SRC) registram uma compra (ativo, quantidade, preço);
  // as demais pedem valor e taxa de rendimento.
  investments: { title:'investimento', defaults:() => ({cat:'rendafixa', index:'cdi', pct:'100', date:now.toLocaleDateString('sv')}), fields:[
    {k:'cat', label:'Categoria', type:'select', options:opts(CAT_INV)},
    {k:'name', label:'Nome', type:'text', ph:'Ex.: CDB Banco X', showIf:v => !QUOTE_SRC[v.cat]},
    {k:'ticker', label:v => QUOTE_SRC[v.cat] === 'b3' ? 'Ativo — pesquise por código ou nome' : 'Moeda — pesquise por código ou nome', type:'asset',
      ph:'Pesquisar…', showIf:v => QUOTE_SRC[v.cat]},
    {k:'qty', label:'Quantidade comprada', type:'num', showIf:v => QUOTE_SRC[v.cat]},
    {k:'paid', label:'Preço pago por unidade (R$)', type:'num', showIf:v => QUOTE_SRC[v.cat]},
    {k:'date', label:'Data da compra', type:'date', showIf:v => QUOTE_SRC[v.cat]},
    {k:'value', label:'Valor investido hoje', type:'money', showIf:v => !QUOTE_SRC[v.cat]},
    {k:'index', label:'Rendimento atrelado a', type:'select', options:Object.entries(INDEX), showIf:v => !QUOTE_SRC[v.cat]},
    {k:'pct', label:v => v.index === 'ipca' ? 'Taxa acima do IPCA (% a.a.)' : v.index === 'pre' ? 'Taxa (% a.a.)' : '% do ' + INDEX[v.index],
      type:'num', zero:true, showIf:v => !QUOTE_SRC[v.cat]},
    {k:'monthly', label:'Aporte mensal (opcional)', type:'money', optional:true, showIf:v => !QUOTE_SRC[v.cat]},
    {k:'broker', label:'Corretora (opcional)', type:'text', ph:'Ex.: XP Investimentos', optional:true, max:40, sug:brokerSuggestions}],
    onChange(k, v){
      if (k === 'cat'){ v.ticker = ''; F.asset = null; if (!v.index) v.index = 'cdi'; if (QUOTE_SRC[v.cat]) searchAssets(''); }
      if (k === 'ticker') searchAssets(v.ticker);
    },
    hint:v => {
      if (QUOTE_SRC[v.cat]){
        const q = parseMoney(v.qty), p = parseMoney(v.paid), a = F && F.asset;
        return q > 0 && p > 0 ? `Investido ${fmt(q*p)}` + (a ? ` · vale hoje ${fmt(q*a.quote)}` : '') : '';
      }
      const val = parseMoney(v.value), pct = parseMoney(v.pct);
      return val > 0 && !isNaN(pct) ? 'Em 12 meses: ' + fmt(projection({value:val, index:v.index, pct, monthly:parseMoney(v.monthly)||0})) : '';
    },
    check(v){ if (QUOTE_SRC[v.cat] && (!F.asset || F.asset.code !== v.ticker)) return 'Escolha o ativo na lista de resultados.'; },
    commit(v, id){
      if (!QUOTE_SRC[v.cat]){ // renda fixa e afins: um registro por investimento
        const rec = {name:v.name, cat:v.cat, value:v.value, index:v.index, pct:v.pct, monthly:v.monthly, broker:normBroker(v.broker)};
        if (id) Object.assign(touch(db.investments.find(x => x.id === id)), rec, {ticker:'', lots:undefined});
        else db.investments.push(touch({id:uid(), accYM:curYM, ...rec}));
        return;
      }
      // Ação/moeda: a compra entra no registro do ativo, criando-o se for a primeira.
      const a = F.asset;
      let inv = db.investments.find(x => x.ticker === a.code && x.cat === v.cat);
      if (!inv) db.investments.push(inv = {id:uid(), cat:v.cat, ticker:a.code, name:a.code, assetName:a.name, lots:[], index:'pre', pct:0, monthly:0});
      inv.lots.push({qty:v.qty, paid:v.paid, date:v.date});
      if (v.broker) inv.broker = normBroker(v.broker); // a corretora é do ativo; compra sem ela não apaga a que já havia
      inv.quote = a.quote; inv.quoteAt = Date.now();
      recalc(inv); touch(inv);
    }},
  // Venda de ação/moeda: sai das compras mais antigas primeiro e guarda o lucro realizado (preço − custo).
  sell: { noDelete:true, fields:[
    {k:'qty', label:'Quantidade vendida', type:'num'},
    {k:'price', label:'Preço de venda por unidade (R$)', type:'num'},
    {k:'date', label:'Data da venda', type:'date'},
    ...CASH_FIELDS('Lançar o lucro nos Ganhos')],
    hint:v => { const inv = F && db.investments.find(x => x.id === F.id), q = parseMoney(v.qty), p = parseMoney(v.price);
      return inv && q > 0 && p > 0 ? `Você tem ${inv.qty.toLocaleString('pt-BR', {maximumFractionDigits:8})}. Venda de ${fmt(q*p)}, resultado aproximado de ${fmt(q * (p - inv.paid))}.` : inv ? `Você tem ${inv.qty.toLocaleString('pt-BR', {maximumFractionDigits:8})}.` : ''; },
    check(v){ if (v.qty > db.investments.find(x => x.id === F.id).qty + 1e-9) return 'Você não tem essa quantidade para vender.'; },
    commit(v, id){
      const inv = db.investments.find(x => x.id === id);
      let left = v.qty, cost = 0;
      while (left > 1e-9 && inv.lots.length){
        const lot = inv.lots[0], take = Math.min(lot.qty, left);
        cost += take * lot.paid; lot.qty -= take; left -= take;
        if (lot.qty <= 1e-9) inv.lots.shift();
      }
      (inv.sales = inv.sales || []).push({qty:v.qty, price:v.price, date:v.date, cost:cost / v.qty});
      recalc(inv); touch(inv);
      // Ganho = só o lucro (o resto é o seu próprio dinheiro voltando); a conta recebe o valor inteiro da venda.
      const profit = round2(v.qty * v.price - cost), ym = v.date.slice(0, 7), day = +v.date.slice(8);
      if (v.toIncome && profit > 0) db.incomes.push(touch({id:uid(), desc:'Lucro na venda de ' + inv.ticker, value:profit, cat:'rendimentos',
        fixed:false, start:ym, end:'', bank:'', day}));
      if (v.account) db.transfers.push(touch({id:uid(), from:'Investimentos', to:v.account, value:round2(v.qty * v.price), month:ym, day}));
    }},
  div: { noDelete:true, defaults:() => ({date:now.toLocaleDateString('sv'), toIncome:'1'}), fields:[
    {k:'value', label:'Valor recebido (dividendos, JCP, rendimentos)', type:'money'},
    {k:'date', label:'Data do recebimento', type:'date'},
    ...CASH_FIELDS('Lançar nos Ganhos')],
    commit(v, id){
      const inv = db.investments.find(x => x.id === id);
      (inv.divs = inv.divs || []).push({value:v.value, date:v.date}); touch(inv);
      const ym = v.date.slice(0, 7), day = +v.date.slice(8);
      if (v.toIncome) db.incomes.push(touch({id:uid(), desc:'Proventos de ' + inv.ticker, value:v.value, cat:'rendimentos', fixed:false, start:ym,
        end:'', bank:v.account, day}));
      else if (v.account) db.transfers.push(touch({id:uid(), from:'Investimentos', to:v.account, value:v.value, month:ym, day}));
    }},
  accounts: { fullTitle:'Conta bancária', defaults:() => ({initial:moneyStr(0), since:curYM}), fields:[
    {k:'name', label:'Nome do banco ou da conta', type:'text', ph:'Ex.: Nubank', sug:bankSuggestions},
    {k:'initial', label:'Saldo no início do mês abaixo', type:'money', zero:true},
    {k:'since', label:'Acompanhar o saldo a partir de', type:'month'}],
    extra:() => '<div class="hint">O saldo soma os ganhos e desconta os gastos em que o campo de banco/conta tiver exatamente este nome. Lançamentos com dia depois de hoje ainda não contam, e compras no crédito só saem quando a fatura é paga (configure em Gastos → Faturas do cartão).</div>'},
  transfers: { fullTitle:'Transferência entre contas', defaults:() => ({month:curYM, from:(db.accounts[0] || {}).name, to:(db.accounts[1] || {}).name}),
    // Além das contas, a lista traz nomes já usados em transferências (ex.: "Investimentos", de vendas e proventos).
    fields:() => { const o = [...new Set([...db.accounts.map(a => a.name), ...db.transfers.flatMap(t => [t.from, t.to])])].map(n => [n, n]); return [
      {k:'from', label:'Sai de', type:'select', options:o, banco:true},
      {k:'to', label:'Entra em', type:'select', options:o, banco:true},
      {k:'value', label:'Valor', type:'money'},
      {k:'month', label:'Mês', type:'month'},
      {k:'day', label:'Dia (opcional)', type:'int', optional:true}]; },
    check:v => v.from === v.to ? 'Escolha duas contas diferentes.' : dayOk(v, 'day', 'O dia')},
  goals: { title:'meta', fem:true, defaults:() => ({saved:moneyStr(0)}), fields:[
    {k:'name', label:'Nome da meta', type:'text', ph:'Ex.: Viagem, reserva de emergência'},
    {k:'target', label:'Valor da meta', type:'money'},
    {k:'saved', label:'Quanto já tem guardado', type:'money', zero:true},
    {k:'date', label:'Prazo (opcional)', type:'month', optional:true},
    {k:'auto', label:'Guardar todo mês (opcional)', type:'money', optional:true, zero:true, more:true},
    {k:'autoDia', label:'Em que dia do mês (1 a 28)', type:'int', optional:true, more:true}],
    hint:v => parseMoney(v.auto) > 0
      ? `Todo dia ${Math.min(28, Math.max(1, parseInt(v.autoDia) || 1))}, o app soma ${fmt(parseMoney(v.auto))} ao guardado, até chegar na meta.` : '',
    check:v => v.autoDia !== '' && v.autoDia != null && !(+v.autoDia >= 1 && +v.autoDia <= 28) ? 'O dia de guardar vai de 1 a 28.' : ''},
  goalAdd: { fullTitle:'Guardar dinheiro na meta', noDelete:true, fields:[{k:'amount', label:'Valor a guardar agora', type:'money', big:true}],
    commit(v, id){ const g = db.goals.find(x => x.id === id); g.saved = round2(g.saved + v.amount); touch(g); }},
  // Aporte avulso em um investimento de renda fixa (ações e moedas usam "+ Nova compra").
  invAdd: { fullTitle:'Fazer um aporte', noDelete:true, fields:[{k:'amount', label:'Valor do aporte', type:'money', big:true}],
    hint:v => { const inv = F && db.investments.find(x => x.id === F.id), a = parseMoney(v.amount);
      return inv && a > 0 ? `${inv.name}: de ${fmt(inv.value)} para ${fmt(inv.value + a)}` : ''; },
    commit(v, id){ const inv = db.investments.find(x => x.id === id); inv.value = round2(inv.value + v.amount); touch(inv); }},
  budgets: { fullTitle:'Orçamento mensal por categoria',
    fields:() => Object.entries(CAT_GASTO).map(([k,c]) => ({k, label:c[1] + ' — limite por mês', type:'money', optional:true})),
    commit(v){ db.budgets = Object.fromEntries(Object.entries(v).filter(([,lim]) => lim > 0)); db.cfgMod = Date.now(); },
    extra:() => `<label>O que sobrar do limite passa para o mês seguinte?</label>
      <div class="optPick" id="rollPick"><button type="button" data-v="1" class="${db.prefs.rollBudget ? 'on' : ''}" data-onclick="setRoll(true)">Sim</button><button type="button" data-v="" class="${db.prefs.rollBudget ? '' : 'on'}" data-onclick="setRoll(false)">Não</button></div>
      <div class="hint">Com "Sim", se você gastar menos que o limite de uma categoria, a diferença soma ao limite dela no mês seguinte.</div>`},
  // Cartões: para cada banco com compras no crédito, dia de fechamento (b), dia de pagamento (d) e conta que paga (a).
  cardClose: { fullTitle:'Cartões de crédito',
    fields:() => creditBanks().flatMap((b,i) => [
      {k:'b' + i, label:b + ' — dia de fechamento', type:'int', optional:true},
      {k:'d' + i, label:b + ' — dia de pagamento da fatura', type:'int', optional:true},
      {k:'l' + i, label:b + ' — limite do cartão (opcional)', type:'money', optional:true},
      {k:'a' + i, label:b + ' — conta que paga a fatura', type:'select', optional:true, banco:true,
        options:[['', 'Conta com o mesmo nome do cartão'], ...db.accounts.map(a => [a.name, a.name])]}]),
    load(v){ creditBanks().forEach((b,i) => { v['b' + i] = String(db.cardClose[b] || ''); v['d' + i] = String(db.cardDue[b] || '');
      v['a' + i] = db.cardAcc[b] || ''; v['l' + i] = db.cardLimit[b] ? moneyStr(db.cardLimit[b]) : ''; }); },
    check:v => Object.keys(v).filter(k => k[0] === 'b' || k[0] === 'd').map(k => dayOk(v, k, 'O dia')).find(Boolean),
    commit(v){
      db.cardClose = {}; db.cardDue = {}; db.cardAcc = {}; db.cardLimit = {};
      creditBanks().forEach((b,i) => { if (v['b' + i]) db.cardClose[b] = v['b' + i]; if (v['d' + i]) db.cardDue[b] = v['d' + i];
        if (v['a' + i]) db.cardAcc[b] = v['a' + i]; if (v['l' + i]) db.cardLimit[b] = v['l' + i]; });
      db.cfgMod = Date.now();
    },
    extra:() => '<div class="hint">Fechamento: compras avulsas com dia depois dele entram na fatura do mês seguinte. Pagamento: a fatura de um mês sai da conta no mês seguinte, nesse dia (sem dia, no começo do mês).</div>'},
  // Previsão de gasto numa categoria (ver previsoesDoMes): prevCtx diz o mês e, numa que se repete, se a mudança vale só
  // para este mês ('este') ou para este e os próximos ('prox').
  previsoes: { title:'previsão', fem:true, noDelete:true, fields:() => [
    {k:'cat', label:'Categoria', type:'select', options:() => opts(CAT_GASTO).filter(o => o[0] !== 'emprestimo')},
    {k:'value', label:'Valor previsto', type:'money', big:true},
    {k:'dia', label:'Até o dia (conta do dia 1 até este dia)', type:'int', optional:true},
    ...(prevCtx.modo === 'este' ? [] : [{k:'rep', label:'Repetir todo mês', type:'select', optional:true,
      options:[['', 'Não, só neste mês'], ['1', 'Sim, todo mês']]}])],
    check(v){
      if (v.dia && (v.dia < 1 || v.dia > 31)) return 'O dia final vai de 1 a 31.';
      const outra = previsoesDoMes(prevCtx.m).find(it => it.cat === v.cat && it.p.id !== (F && F.id));
      if (outra){ prevJaExiste(outra); return false; }
    },
    commit(v, id, novoId){ prevSalvar(v, id, novoId); },
    extra:() => '<div class="hint">Sem dia, vale até o último dia do mês. Os gastos da categoria até esse dia enchem a barra; o que faltar do previsto já entra no saldo previsto do mês.</div>'},
  // Alerta de preço de uma ação ou moeda (id = o investimento). Vazio desliga.
  priceAlert: { fullTitle:'Alerta de preço', noDelete:true, fields:[
    {k:'alertUp', label:'Avisar quando passar de (R$)', type:'num', optional:true},
    {k:'alertDown', label:'Avisar quando cair abaixo de (R$)', type:'num', optional:true}],
    hint:() => { const inv = F && db.investments.find(x => x.id === F.id);
      return inv ? `${inv.ticker}: cotação atual ${fmtQ(inv.quote)}. Deixe em branco para desligar.` : ''; },
    check:v => v.alertUp && v.alertDown && v.alertDown >= v.alertUp ? 'O valor de baixo precisa ser menor que o de cima.' : '',
    commit(v, id){ const inv = db.investments.find(x => x.id === id);
      Object.assign(touch(inv), {alertUp:v.alertUp || '', alertDown:v.alertDown || '', alertHit:''}); },
    extra:() => '<div class="hint">Com o app aberto, o preço é conferido a cada atualização das cotações. Com ele fechado, o celular confere mais ou menos de hora em hora e avisa por notificação (precisa das notificações ligadas e de internet). Não é um aviso em tempo real.</div>'},
  // Categoria (id do formulário = "tipo:chave"; chave vazia = categoria nova).
  catEdit: { noDelete:true, fields:[
    {k:'name', label:'Nome', type:'text', ph:'Ex.: Pets'},
    {k:'icon', label:'Ícone', type:'icons'},
    {k:'color', label:'Cor (aparece com a opção "Uma cor por categoria")', type:'colors', optional:true}],
    check(v){ const [type, key] = F.id.split(':'); if (catMesmoNome(type, v.name, key)) return catRepetida; },
    commit(v, id){ const [type, key] = id.split(':'); catSalvar(type, key, v); },
    after:() => openCats()},
  rates: { fullTitle:'Taxas de referência', fields:[
    {k:'auto', label:'Atualização', type:'select', optional:true,
      options:[['1','Automática — pela internet (Banco Central)'],['','Manual — uso os valores abaixo']]},
    {k:'cdi', label:'CDI (% a.a.)', type:'num'}, {k:'selic', label:'Selic (% a.a.)', type:'num'}, {k:'ipca', label:'IPCA (% a.a.)', type:'num'}],
    commit(v){ Object.assign(db.rates, v); },
    extra:() => `<div class="hint">Taxas ${ratesInfo()}.</div>
      <div class="btns"><button class="btn" data-onclick="updateRatesNow()">${I('refresh')}Atualizar taxas agora</button></div>`}
};
let prevCtx = {m:'', modo:''}; // previsão aberta no formulário: mês e modo ('' | 'este' | 'prox')
let formVale = false; // o formulário que está abrindo é de vale (ver openForm e os campos de incomes/expenses)
let formTipo = ''; // parcelas: '' (compra parcelada), 'financiamento' ou 'emprestimo' (ver openForm)
// Parcelas: o registro aberto ainda não teve abatimento (depois de um, prazo e valores mudam só por Abater).
// Gasto novo parcelado (campo parc do formulário de gasto) ou à vista.
const parcelado = v => v.parc === '1' && !(F && F.id), aVista = v => !parcelado(v);
const semAbat = () => !(F && F.id && (db.installments.find(x => x.id === F.id) || {}).seg);
const EMP_FIELD = {k:'emp', label:'Empresa do vale', type:'select', optional:true, options:() => [['', 'Não informar'], ...VALE_EMPRESAS.map(e => [e, e])]};
// Novo lançamento num vale: lado = 'gastos' ou 'ganhos'; k = qual vale. A empresa usada por último já vem escolhida.
function novoVale(lado, k){
  if (lado === 'gastos') openForm('expenses', null, {vale:true, vals:{pay:k, emp:valeEmp(k), fixed:'', start:state.month}});
  else openForm('incomes', null, {vale:true, vals:{cat:k, emp:valeEmp(k)}});
}
let F = null; // formulário aberto: {col, cfg, fields, id, vals, touched, asset}
let settingsOpen = false;

function addNew(){
  // Na parte dos vales, o + já abre o lançamento no vale (o que a pessoa usa, ou o de alimentação).
  const vale = Object.keys(VALES).find(temVale) || 'va';
  if (state.tab === 'gastos' && state.gsub === 'vale') return novoVale('gastos', vale);
  if (state.tab === 'ganhos' && state.isub === 'vale') return novoVale('ganhos', vale);
  // Em Parceladas, o + pergunta o que cadastrar.
  if (state.tab === 'gastos' && state.gsub === 'parc') return pickList('Adicionar',
    [['', 'Compra parcelada'], ['financiamento', 'Financiamento'], ['emprestimo', 'Empréstimo']], null, t => openForm('installments', null, {tipo:t}));
  const col = {ganhos:'incomes', gastos:'expenses', invest:'investments'}[state.tab]; if (col) openForm(col);
}
const ARCH_MSG = 'Este lançamento está no arquivo de anos antigos e não pode ser editado. Para editar, traga os anos de volta em Configurações > Dados e ajustes.';
function edit(col, id){
  event.stopPropagation();
  if (Date.now() - swipedAt < 400) return;
  const r = db[col].find(x => x.id === id);
  if (!r) return tell(ARCH_MSG);
  openForm(col, r);
}
function openRates(){ openForm('rates', db.rates); }
let sheetKey = ''; // título da folha aberta: redesenhar a mesma folha mantém a rolagem; abrir outra volta ao topo
function showSheet(html){
  const sheet = document.getElementById('sheet'), key = html.slice(0, html.indexOf('</h3>')), same = sheet.classList.contains('open') && key === sheetKey;
  const top = sheet.scrollTop;
  sheet.innerHTML = html;
  sheet.scrollTop = same ? top : 0;
  sheetKey = key;
  sheet.classList.add('open');
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden'; // a tela de trás não rola enquanto a folha está aberta
  a11y(sheet);
  valoresCabem(sheet);
}
// Arrastar a alça (o topo) de uma folha para baixo fecha a folha.
let drag = null;
document.addEventListener('touchstart', e => {
  const el = e.target.closest ? e.target.closest('.sheet.open') : null;
  drag = el && el.scrollTop <= 0 && e.touches[0].clientY - el.getBoundingClientRect().top < 64 ? {el, y:e.touches[0].clientY, dy:0} : null;
}, {passive:true});
document.addEventListener('touchmove', e => {
  if (!drag) return;
  drag.dy = e.touches[0].clientY - drag.y;
  if (drag.dy < 0){ drag.el.style.transform = ''; drag.el.style.transition = ''; return void (drag = null); }
  drag.el.style.transition = 'none'; drag.el.style.transform = `translateY(${drag.dy}px)`;
}, {passive:true});
document.addEventListener('touchend', () => {
  if (!drag) return;
  const d = drag; drag = null;
  d.el.style.transition = ''; d.el.style.transform = '';
  if (d.dy > 110){ if (d.el.id === 'picker') closePicker(); else closeForm(); }
}, {passive:true});

// Campo de banco ou conta (texto com as sugestões de bancos, ou lista das contas): mostra o logotipo do banco.
const ehBanco = f => !!f.banco || f.sug === bankSuggestions;
// Logotipo do banco digitado ou escolhido dentro do campo de texto (só quando o app conhece o banco).
function bancoNoCampo(k){
  const w = document.getElementById('cb_' + k), el = document.getElementById('f_' + k);
  if (!w || !el) return;
  const logo = bancoDe(el.value)[2];
  w.classList.toggle('comLogo', !!logo);
  const img = w.querySelector('img');
  if (!logo) return img && img.remove();
  if (img) img.src = logo[0]; else w.insertAdjacentHTML('afterbegin', `<img src="${logo[0]}" alt="">`);
}
// HTML de um campo. Listas, meses e datas guardam o valor num elemento escondido e mostram um componente do app
// (botões ou um seletor próprio), em vez das janelas do Android.
function fieldHtml(f){
  const id = 'f_' + f.k;
  // Campo de banco ou conta: o logotipo do banco escolhido aparece dentro do campo, à esquerda (bancoNoCampo).
  if (ehBanco(f) && f.type === 'text') return `<div class="campoBanco" id="cb_${f.k}">${fieldHtml({...f, banco:false, sug:null})}</div>`
    + `<div class="chips sug" id="sug_${f.k}" hidden></div>`;
  if (f.type === 'select') return `<select id="${id}" hidden>${(typeof f.options === 'function' ? f.options() : f.options).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('')}</select>` +
    (f.k === 'cat' ? '<div class="catPick" id="catPick"></div>' : `<div id="o_${f.k}"></div>`);
  if (f.type === 'icons') return `<input id="${id}" type="hidden"><div class="iconGrid">${Object.entries(ICON_NAMES).map(([k, n]) => `<button type="button" data-i="${k}" aria-label="${n}" title="${n}" data-onclick="pickIcon('${f.k}','${k}')">${I(k, 23)}</button>`).join('')}</div>`;
  if (f.type === 'colors') return `<input id="${id}" type="hidden"><div class="swatches colorGrid">${CAT_COLORS.map(c => `<button type="button" class="sw" data-c="${c}" style="background:${c}" aria-label="Cor ${c}" data-onclick="setField('${f.k}','${c}')"></button>`).join('')}</div>`;
  if (f.type === 'month' || f.type === 'date') return `<input id="${id}" type="hidden"><button type="button" class="pickBtn" id="p_${f.k}" data-onclick="pickField('${f.k}')"></button>`;
  if (f.type === 'meses') return `<input id="${id}" type="hidden"><div class="mesGrid" id="o_${f.k}"></div>`; // os 12 meses, para marcar
  // Valor de um gasto em vermelho e de um ganho em verde, para confirmar o que está sendo lançado.
  const cor = !['value', 'total'].includes(f.k) || !F ? '' : F.col === 'incomes' ? 'in' : ['expenses', 'installments'].includes(F.col) ? 'out' : '';
  if (f.big) return `<div class="bigVal ${cor}"><span>${esc(moeda.simbolo)}</span><input id="${id}" type="text" inputmode="numeric" placeholder="${moneyStr(0)}" autocomplete="off"></div>${somaHtml(f.k)}`;
  return `<input id="${id}" type="text" ${f.type === 'money' ? `inputmode="numeric" class="${cor}"` : f.type === 'num' ? 'inputmode="decimal"' : f.type === 'int' ? 'inputmode="numeric"' : ''} placeholder="${f.type === 'money' ? '0,00' : f.ph || ''}"${f.max ? ` maxlength="${f.max}"` : ''} autocomplete="off">` +
    (f.type === 'money' ? somaHtml(f.k) : '') +
    (f.atalhos ? `<div class="chips">${f.atalhos.map(n => `<button type="button" data-onclick="setField('${f.k}','${n}')">${n}</button>`)
      .join('')}</div>` : '') + // atalhos de valor (ex.: a cada 2, 3, 4 ou 6 meses)
    (f.type === 'asset' ? '<div id="assetList"></div>' : '') +
    (f.sug ? `<div class="chips sug" id="sug_${f.k}" hidden></div>` : '');
}
// Soma rápida: botões abaixo de todo campo de dinheiro; cada toque soma o valor ao que já está no campo.
const SOMAS = [10, 20, 50, 100];
const somaHtml = k => `<div class="chips soma">${SOMAS.map(n => `<button type="button" data-onclick="somaRapida('${k}',${n})">+${n}</button>`).join('')}</div>`;
function somaRapida(k, n){
  const el = document.getElementById('f_' + k);
  el.value = moneyStr((parseNum(el.value) || 0) + n);
  el.dispatchEvent(new Event('input')); // passa pela máscara e avisa o formulário, como se tivesse sido digitado
}
// Cores oferecidas para uma categoria (as mesmas famílias das categorias de fábrica).
const CAT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#65a30d', '#16a34a', '#14b8a6', '#0ea5e9',
  '#2563eb', '#b45309', '#64748b'];
// Texto digitado num campo de dinheiro → valor com os centavos: só os números contam, os últimos são os centavos (dois
// na maioria das moedas; nenhum no iene, três no dinar do Kuwait: moeda.casas).
function centsMask(s){
  const d = String(s).replace(/\D/g, '').replace(/^0+/, '').slice(0, 13), c = moeda.casas;
  return d ? (+d / 10 ** c).toLocaleString('pt-BR', {minimumFractionDigits:c, maximumFractionDigits:c}) : '';
}
// Toques num formulário que já está fechando (F = null) não fazem nada.
function setField(k, v){ if (!F) return; const el = document.getElementById('f_' + k); el.value = v; el.oninput(); }

// Redesenha os componentes de lista (até 4 opções: botões lado a lado; mais que isso: botão que abre o seletor), mês e data.
function drawPicks(){
  for (const f of F.fields){
    const el = document.getElementById('f_' + f.k);
    if (f.type === 'select' && f.k !== 'cat'){
      // até 4 opções (e sempre o Tipo): botões lado a lado
      const box = document.getElementById('o_' + f.k), os = [...el.options].map(o => [o.value, o.text]), few = os.length <= 4 || f.k === 'fixed';
      box.className = few ? 'optPick' : '';
      box.innerHTML = few
        ? os.map(([v, t]) => `<button type="button" class="${v === el.value ? 'on' : ''}" data-v="${esc(v)}" data-onclick="setField('${f.k}',this.dataset.v)">${ehBanco(f) ? bancoMini(v) : ''}${esc(t)}</button>`).join('')
        : `<button type="button" class="pickBtn" data-onclick="pickField('${f.k}')"><span>${ehBanco(f) ? bancoMini(el.value) : ''}${esc((os.find(o => o[0] === el.value) || ['', 'Escolher'])[1])}</span>${I('chev')}</button>`;
    } else if (f.type === 'meses'){
      const marcados = mesesDe(el.value);
      document.getElementById('o_' + f.k).innerHTML = MESES.map((n, i) => `<button type="button" class="${marcados.includes(i + 1) ? 'on' : ''}"
        aria-pressed="${marcados.includes(i + 1)}" data-onclick="mesMarca('${f.k}',${i + 1})">${n.slice(0, 3)}</button>`).join('');
    } else if (f.type === 'month' || f.type === 'date'){
      const v = el.value;
      document.getElementById('p_' + f.k).innerHTML = `<span class="${v ? '' : 'muted'}">${v ? (f.type === 'month' ? cap(monthName(v)) : fmtDate(v)) : 'Não definido'}</span>${I('calendar')}`;
    }
  }
}
// Grade dos meses (campo meses): marca ou desmarca um mês.
function mesMarca(k, m){
  if (!F) return;
  const l = mesesDe(document.getElementById('f_' + k).value);
  setField(k, (l.includes(m) ? l.filter(x => x !== m) : [...l, m]).sort((a, b) => a - b).join(','));
}
function pickField(k){
  if (!F) return;
  const f = F.fields.find(x => x.k === k), el = document.getElementById('f_' + k), title = typeof f.label === 'function' ? f.label(F.vals) : f.label,
  set = v => setField(k, v);
  if (f.type === 'select') pickList(title, [...el.options].map(o => [o.value, o.text]), el.value, set, false, ehBanco(f) && bancoMini);
  else if (f.type === 'month') pickMonthP(title, el.value, f.optional, set);
  else pickDateP(title, el.value, set);
}

// ---------- Carregando ----------
// Animação global de espera. Toda chamada de rede (Google, cotações, notícias, atualização) passa por espera(): enquanto
// houver alguma em andamento, uma faixa animada corre no topo da tela (só depois de 0,3 s, para não piscar nas rápidas).
// As ações demoradas pedidas pela pessoa (criar a conta compartilhada, restaurar uma cópia…) usam comCarga(), que mostra
// também um cartão com o que está sendo feito. Nada disso bloqueia a tela: as perguntas e avisos continuam por cima.
let esperas = 0, cargaT = 0;
const cargaTxt = [];
function cargaDraw(){
  const b = document.getElementById('carga'), c = document.getElementById('cargaCx');
  if (!b) return;
  const on = () => esperas > 0 || cargaTxt.length > 0;
  clearTimeout(cargaT);
  if (!on()) b.hidden = true; else if (b.hidden) cargaT = setTimeout(() => { b.hidden = !on(); }, 300);
  c.hidden = !cargaTxt.length;
  if (cargaTxt.length) c.lastElementChild.textContent = cargaTxt[cargaTxt.length - 1];
}
const espera = p => { esperas++; cargaDraw(); return Promise.resolve(p).finally(() => { esperas--; cargaDraw(); }); };
// cargaOn devolve a função que encerra o aviso; comCarga cuida disso sozinha em volta de fn.
function cargaOn(texto){ cargaTxt.push(texto); cargaDraw();
  return () => { const i = cargaTxt.lastIndexOf(texto); if (i >= 0) cargaTxt.splice(i, 1); cargaDraw(); }; }
async function comCarga(texto, fn){ const fim = cargaOn(texto); try { return await fn(); } finally { fim(); } }
// Aviso de rodapé. o: {central:false} não guarda na central; tipo, t (quando aconteceu) e dest (o que abrir ao tocar).
function toast(text, o = {}){
  const s = document.getElementById('snack');
  undoFn = null;
  s.textContent = text;
  s.hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, db.prefs.fun ? 3800 : 1800);
  centralRegistra(text, o);
}
