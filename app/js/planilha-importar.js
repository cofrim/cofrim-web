// Cofrim — Importar planilha: entende sozinho uma planilha de gastos feita pela pessoa (lida por planilha-ler.js) e
// monta os lançamentos para revisar e importar. Carregado sob demanda (planilhaCarregar, em extrato.js).
// Detecção, aba por aba:
// - tabelas: uma linha de cabeçalho (nomes conhecidos de coluna, PL_PAPEIS) abre uma tabela nas colunas dela; várias
//   na mesma linha (lado a lado) ou uma embaixo da outra. Sem cabeçalho, as colunas saem do conteúdo;
// - título da tabela (o texto logo acima do cabeçalho): seção (Ganhos, Despesas, Investimentos), cartão ou banco,
//   mês e ano;
// - mês e ano de cada linha: a data dela; só o dia, com o mês e o ano do bloco (linha só com uma data ou um mês), do
//   título, do nome da aba ou do título dela, e o ano do nome do arquivo; sem ano em lugar nenhum, o ano atual (suposto);
// - ganho ou gasto: colunas Entrada/Saída, coluna Tipo, seção, título e, no valor com sinal, o sinal da maioria é o tipo
//   da tabela e o outro sinal é o contrário (estorno);
// - ignora linhas vazias, de total, subtotal, saldo e resumo, e as sem descrição (fórmulas de resumo);
// - parcela ("3/10", "3 de 10", no fim da descrição ou na coluna; também a data "d/m" que o Google Planilhas faz de
//   "3/10"): as parcelas da mesma compra viram uma compra parcelada; coluna Fixo marcada: um gasto fixo;
// - repetição (a mesma descrição em 3 meses seguidos, valor até 10% diferente): sugestão de fixo, desmarcada;
// - planilha só de resumo (categoria x mês): sem lançamentos; oferece um gasto por categoria por mês (opcional).
// O resultado (planDetectar) é refeito com os ajustes da pessoa (mês de uma aba, papel de uma coluna, tipo de uma tabela).

const PL_MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const plT = v => plain(String(v ?? '')).replace(/\s+/g, ' ').trim();
// Mês e ano escritos num texto ("Março", "Fev-24", "mar/2024", "2024-03", "03/2024", "Gastos de março de 2024", "2024").
function planMesAno(texto){
  const t = plT(texto), r = {};
  let m = /\b(\d{4})[-/.](\d{1,2})\b/.exec(t) || null;
  if (m && +m[2] >= 1 && +m[2] <= 12) return {y:+m[1], m:+m[2]};
  m = /\b(\d{1,2})[-/.](\d{4})\b/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return {y:+m[2], m:+m[1]};
  const nome = PL_MESES.findIndex(n => new RegExp(`\\b${n}\\b|\\b${n.slice(0, 3)}\\b`).test(t));
  if (nome >= 0) r.m = nome + 1;
  m = /\b(19[89]\d|20\d\d)\b/.exec(t);
  if (m) r.y = +m[1];
  else if (r.m){ m = new RegExp(`\\b${PL_MESES[r.m - 1].slice(0, 3)}[a-z]*[-/. ]?'?(\\d{2})\\b`).exec(t); if (m) r.y = 2000 + +m[1]; }
  return r;
}
const plYM = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
// Valor escrito: "R$ 1.234,56", "1,234.56", "1234,5", "-12", "(12,00)", "12,00 D" (débito: negativo), "12,00 C".
function planValor(c){
  if (!c) return null;
  if (c.t === 'n') return c.v;
  if (c.t !== 's') return null;
  let s = String(c.v).trim(), neg = false;
  if (/^\(.*\)$/.test(s)){ neg = true; s = s.slice(1, -1); }
  if (/\s*[dD]$/.test(s) && /\d/.test(s)){ neg = true; s = s.replace(/\s*[dD]$/, ''); } else s = s.replace(/\s*[cC]$/, '');
  s = s.replace(/r\$|\s| /gi, '');
  if (/^-/.test(s) || /-$/.test(s)){ neg = !neg; s = s.replace(/^-|-$/g, ''); }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const n = numEscrito(s);
  return isFinite(n) ? (neg ? -n : n) : null;
}
// Data de uma célula: {data:'AAAA-MM-DD'} completa, {d, m} sem ano (a data "d/m" da célula ou "05/03") ou {d} (só o dia).
function planData(c, papel){
  if (!c) return null;
  if (c.t === 'd'){ const [y, m, d] = c.v.split('-').map(Number); return /y|a/i.test(c.fmt || 'a') ? {data:c.v} : {d, m}; }
  if (c.t === 'n' && papel === 'dia' && Number.isInteger(c.v) && c.v >= 1 && c.v <= 31) return {d:c.v};
  if (c.t !== 's') return null;
  const s = String(c.v).trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) return {data:`${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`};
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return {data:m[0]};
  m = /^(\d{1,2})[/.](\d{1,2})$/.exec(s);
  if (m && papel !== 'parcela') return {d:+m[1], m:+m[2]};
  if (/^\d{1,2}$/.test(s) && papel === 'dia') return {d:+s};
  return null;
}
const planDataOk = iso => /^\d{4}-\d\d-\d\d$/.test(iso) && iso >= '1990-01-01' && iso <= '2100-12-31' && dataExiste(iso);

// Papéis das colunas pelo nome do cabeçalho (sem acento). A ordem importa: o primeiro que casa vale.
const PL_PAPEIS = [
  ['dia', /^dia$/], ['data', /^(data|dt|date|quando|vencimento|dia da compra|data da compra)\b/],
  ['entrada', /^(entrada|entradas|receita|receitas|credito|creditos|recebido|recebimentos?)$/],
  ['saida', /^(saida|saidas|despesa|despesas|debito|debitos|gasto|gastos|pago|pagamentos?)$/],
  ['pagamento', /forma de pagamento|^pagamento$|^forma$|^meio( de pagamento)?$/],
  ['parcela', /^(parcela|parcelas|parc|parcelamento)\.?$/], ['fixo', /^(fixo|fixa|recorrente|mensal)\??$/],
  ['categoria', /^(categoria|categorias|grupo|classificacao|tipo de (gasto|despesa))$/], ['tipo', /^(tipo|natureza|d\/c|c\/d)$/],
  ['conta', /^(conta|cartao|banco|instituicao|conta\/cartao|cartao\/conta)$/], ['situacao', /^(status|situacao|pago\?|ok)$/],
  ['valor', /^(valor|valores|quantia|quanto|preco|montante|r\$|valor \(r\$\)|total da linha)$/],
  ['desc', /^(descricao|historico|item|lancamento|estabelecimento|o que|nome|produto|detalhe|detalhes|observacao|memo|titulo|gasto com)$/]];
const planPapel = texto => { const t = plT(texto); const p = PL_PAPEIS.find(([, re]) => re.test(t)); return p ? p[0] : ''; };
// Palavras de seção e de título: tipo da tabela.
const PL_GANHO = /\b(ganhos?|receitas?|entradas?|rendas?|salarios?|recebimentos?|creditos)\b/;
const PL_GASTO = /\b(gastos?|despesas?|saidas?|contas a pagar|pagamentos?|compras|cartao|cartoes)\b/;
const PL_INVEST = /\b(investimentos?|aplicac(ao|oes)|poupanca|reserva|aportes?)\b/;
const planTipoDe = texto => { const t = plT(texto);
  return PL_INVEST.test(t) ? 'invest' : PL_GANHO.test(t) && !PL_GASTO.test(t) ? 'ganho' : PL_GASTO.test(t) ? 'gasto' : ''; };
// Linha de total, saldo ou resumo: não é lançamento.
const PL_TOTAL = /^(sub)?total\b|\btotal (do|de|da|geral|gasto|recebido|mes|ano)|^(saldo|soma|resumo|media|acumulado|sobra|resultado|balanco)\b/;
// Abas que costumam ser só de resumo ou gráficos.
const PL_ABA_RESUMO = /^(resumo|dashboard|painel|graficos?|totais|total|indice|instrucoes|config(uracoes)?|capa|sumario|analise)\b/;
// Parcela "3/10", "3 de 10", "parc 3/10", "(3/10)" no fim de um texto.
const planParcTexto = s => { const m = /(?:\bparc(?:ela)?\.?\s*)?\(?\b(\d{1,3})\s*(?:\/|de)\s*(\d{1,3})\)?\s*$/i.exec(String(s).trim());
  return m && +m[1] >= 1 && +m[2] >= 2 && +m[1] <= +m[2] && +m[2] <= 120 ? {k:+m[1], n:+m[2], resto:String(s).trim().slice(0, m.index).trim()} : null; };
// Parcela numa célula: texto "3/10" ou a data "d/m" (sem ano) que o Google Planilhas fez dele: dia = parcela, mês = total.
function planParcCel(c){
  if (!c) return null;
  if (c.t === 'd' && !/y|a/i.test(c.fmt || 'a')){ const [, m, d] = c.v.split('-').map(Number); return d <= m && m >= 2 ? {k:d, n:m} : null; }
  return c.t === 's' ? planParcTexto(c.v) : null;
}
const planSim = c => !!c && (c.t === 'b' ? c.v : /^(sim|s|x|fixo|fixa|yes|true|1)$/i.test(plT(c.v)));

// ---------- Categorias, pagamento e conta ----------
// Sinônimos comuns de planilha para as categorias de fábrica (sem acento).
const PL_SINONIMOS = {mercado:/^(supermercado|super mercado|feira|sacolao|hortifruti|atacado|compras do mes|rancho)$/,
  alimentacao:/^(comida|alimentos?|refeic(ao|oes)|almoco|jantar)$/, restaurante:/^(restaurantes?|delivery|ifood|lanches?|fast food)$/,
  transporte:/^(uber|99|taxi|transporte publico|locomocao|mobilidade)$/, combustivel:/^(gasolina|etanol|alcool|diesel|posto)$/,
  farmacia:/^(remedios?|medicamentos?|drogaria)$/, saude:/^(medico|consultas?|plano de saude|exames?|dentista|hospital)$/,
  moradia:/^(aluguel|condominio|habitacao|casa propria|financiamento (da )?casa)$/, luz:/^(energia|luz|agua|gas|contas de casa)$/,
  internet:/^(telefone|celular|internet e tv|tv a cabo)$/, lazer:/^(diversao|passeios?|entretenimento|hobby|hobbies)$/,
  educacao:/^(escola|faculdade|cursos?|estudos?|livros?|material escolar)$/, roupas:/^(vestuario|calcados?|roupa)$/,
  pets:/^(pet|animais|cachorro|gato|veterinario|racao)$/, impostos:/^(taxas?|tributos?|iptu|ipva)$/, viagem:/^(viagens|ferias|hotel|passagens?)$/,
  seguros:/^seguros?\b/, cinema:/^(streaming|netflix|youtube( premium)?|disney\+?|hbo( max)?|max|prime video|globoplay|paramount\+?)$/,
  salario:/^(salario|ordenado|pagamento|holerite|clt)$/, freelance:/^(freela|freelas|bico|bicos|extra|extras|servicos?)$/,
  rendimentos:/^(juros|dividendos|rendimento|investimentos)$/, vendas:/^(venda|vendas)$/};
// Distância de edição pequena (até 1 letra trocada, faltando ou sobrando), para erros de digitação.
const planQuase = (a, b) => { if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 5) return false;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1); };
// Categoria do app para o texto da planilha, ou '' (vira "categoria nova" na revisão). tipo: 'gasto' ou 'ganho'.
// soltas: vale também uma palavra do texto no nome da categoria ("Assinaturas" → "Contas e assinaturas"); para a
// descrição não vale ("Financiamento Carro" não é "Manutenção do carro").
function planCategoria(texto, tipo, soltas = true){
  const t = plT(texto), C = tipo === 'ganho' ? CAT_GANHO : CAT_GASTO;
  if (!t) return '';
  const chaves = Object.keys(C).filter(k => !C[k][3] && k !== 'emprestimo'), nome = k => plT(C[k][1]);
  return chaves.find(k => nome(k) === t || k === t)
    || chaves.find(k => planQuase(nome(k), t))
    || chaves.find(k => PL_SINONIMOS[k] && PL_SINONIMOS[k].test(t))
    || (soltas && chaves.find(k => t.split(' ').filter(w => w.length >= 4).some(w => nome(k).split(/[^a-z0-9]+/).includes(w))))
    || '';
}
// Forma de pagamento pelo texto, ou ''.
const planPagamento = texto => { const t = plT(texto);
  return /credito|^cc$|^cartao$/.test(t) ? 'credito' : /debito/.test(t) ? 'debito' : /\bpix\b/.test(t) ? 'pix' : /dinheiro|especie|cash/.test(t) ? 'dinheiro'
    : /boleto/.test(t) ? 'boleto' : /^va$|vale.?alimenta/.test(t) ? 'va' : /^vr$|vale.?refei/.test(t) ? 'vr' : /^vt$|vale.?transp/.test(t) ? 'vt' : ''; };
// Banco ou conta pelo texto: o nome já usado no app (mesma grafia) ou o texto como veio. "Dinheiro" não é banco.
function planBanco(texto){
  const s = String(texto ?? '').trim().slice(0, 40), t = plT(s);
  if (!t || planPagamento(t) === 'dinheiro') return '';
  return bankSuggestions().find(b => plT(b) === t) || bankSuggestions().find(b => plT(b).startsWith(t + ' ') || t.startsWith(plT(b) + ' ')) || s;
}
const planEhBanco = texto => { const t = plT(texto); return !!t && (bankSuggestions().some(b => plT(b) === t) || /^(cartao|cartoes)\b/.test(t)); };

// ---------- Tabelas de uma aba ----------
const plTexto = c => c && c.t === 's' && !c.m ? String(c.v).trim() : '';
const plVazia = (l, c0, c1) => { for (let c = c0; c <= c1; c++) if (l[c]) return false; return true; };
// Cabeçalhos de uma linha: trechos seguidos de textos (sem as cópias de mesclagem) com pelo menos dois nomes de
// coluna conhecidos, um deles de valor (valor, entrada ou saída). Devolve [{c0, c1, nomes:[{c, texto, papel}]}].
function planCabecalhos(l){
  const out = [];
  for (let c = 0; c < l.length; c++){
    if (!plTexto(l[c])) continue;
    const nomes = [];
    for (; c < l.length && plTexto(l[c]); c++) nomes.push({c, texto:plTexto(l[c]), papel:planPapel(plTexto(l[c]))});
    const papeis = nomes.map(n => n.papel).filter(Boolean);
    if (papeis.length >= 2 && papeis.some(p => ['valor', 'entrada', 'saida'].includes(p)) && papeis.some(p => ['desc', 'data', 'dia', 'categoria'].includes(p)))
      out.push({c0:nomes[0].c, c1:nomes[nomes.length - 1].c, nomes});
  }
  return out;
}
// Planilha de resumo (categoria x mês): uma linha com dois ou mais meses e a coluna da esquerda com textos.
function planResumoGrade(linhas){
  for (let r = 0; r < Math.min(linhas.length, 40); r++){
    const l = linhas[r] || [], meses = [];
    l.forEach((c, k) => { if (k > 0 && c && !c.m && (c.t === 'd' || (c.t === 's' && planMesAno(c.v).m && plT(c.v).split(' ').length <= 2))) meses.push(k); });
    if (meses.length < 2) continue;
    const col0 = l.findIndex(Boolean);
    if (col0 < 0 || col0 >= meses[0]) continue;
    const itens = [];
    for (let i = r + 1; i < linhas.length; i++){
      const li = linhas[i] || [], cat = plTexto(li[col0]);
      if (!cat || PL_TOTAL.test(plT(cat))) continue;
      for (const k of meses){ const v = planValor(li[k]); if (v) itens.push({cat, col:k, rotulo:l[k], valor:Math.abs(v)}); }
    }
    if (itens.length) return {r, itens};
  }
  return null;
}
// Colunas de uma tabela sem cabeçalho, pelo conteúdo: a de datas, a de valores e a de texto mais variado.
function planSemCabecalho(linhas){
  const n = Math.max(0, ...linhas.map(l => (l || []).length)), stat = [...Array(n)].map(() => ({d:0, v:0, s:new Set()}));
  for (const l of linhas) (l || []).forEach((c, k) => { if (!c || c.m) return; if (planData(c, 'data') && planData(c, 'data').data) stat[k].d++;
    else if (planValor(c) != null) stat[k].v++; else if (c.t === 's') stat[k].s.add(plT(c.v)); });
  const melhor = f => stat.reduce((a, s, k) => f(s) > (a < 0 ? 0 : f(stat[a])) ? k : a, -1);
  const vc = melhor(s => s.v), dc = melhor(s => s.d), tc = melhor(s => s.s.size);
  if (vc < 0 || stat[vc].v < 3 || tc < 0 || stat[tc].s.size < 2) return null;
  const nomes = [{c:tc, papel:'desc'}, {c:vc, papel:'valor'}, ...(dc >= 0 && stat[dc].d >= 3 ? [{c:dc, papel:'data'}] : [])];
  return {c0:Math.min(...nomes.map(x => x.c)), c1:Math.max(...nomes.map(x => x.c)), nomes, semCabecalho:true};
}
// Papel de uma coluna sem nome conhecido (ex.: "Espec"), pelo conteúdo: parcela, situação ("PAGO") ou nada.
function planPapelConteudo(linhas, r0, c){
  let parc = 0, sit = 0, n = 0;
  for (let r = r0 + 1; r < Math.min(linhas.length, r0 + 200); r++){
    const x = (linhas[r] || [])[c];
    if (!x || x.m) continue;
    n++;
    if (planParcCel(x)) parc++; else if (x.t === 's' && /^(pago|paga|ok|feito|quitad[oa]|x|pendente|aberto)$/i.test(plT(x.v))) sit++;
  }
  return n && parc >= n / 2 ? 'parcela' : n && sit >= n / 2 ? 'situacao' : '';
}

// ---------- Detecção ----------
// pl: {abas:[{nome, linhas, arq?}]} (lerPlanilha; com várias planilhas, arq = o arquivo de cada aba); arquivo: o nome
// do arquivo (o ano pode vir dele; com várias, vale o arq de cada aba); aj: ajustes da pessoa:
// {abas:{[i]:{mes:'AAAA-MM', ano:'AAAA', ignorar:bool}}, tabs:{[id]:{cols:{[c]:papel}, tipo}}}; hoje: 'AAAA-MM-DD'.
// Devolve {abas, lancs, grade} (ver planAba); planItens agrupa os lançamentos no que vai ser importado. O mesmo
// lançamento em duas planilhas (períodos que se cruzam) fica marcado como repetido (rep) na segunda.
function planDetectar(pl, arquivo = '', aj = {}, hoje = new Date().toLocaleDateString('sv')){
  const anoDoArquivo = nome => planMesAno(String(nome).replace(/\.[a-z0-9]+$/i, '').replace(/[_]/g, ' ')).y;
  const abas = [], lancs = [];
  pl.abas.forEach((aba, i) => {
    const a = planAba(aba, i, anoDoArquivo(aba.arq || arquivo), (aj.abas || {})[i] || {}, aj.tabs || {}, hoje);
    a.info.arq = aba.arq || '';
    abas.push(a.info); lancs.push(...a.lancs);
  });
  const visto = new Map();
  for (const x of lancs){
    const k = [x.tipo, plT(x.desc), x.mes, x.dia, x.valor].join('|'), arq = abas[x.aba].arq;
    if (!visto.has(k)) visto.set(k, arq); else if (visto.get(k) !== arq) x.rep = true;
  }
  // Planilha só de resumo: nenhum lançamento, mas uma grade de categoria por mês em alguma aba.
  const grade = !lancs.length ? pl.abas.map((aba, i) => { const g = planResumoGrade(aba.linhas); return g && {aba:i, ...g}; }).find(Boolean) || null : null;
  return {abas, lancs, grade};
}
// Uma aba: as tabelas, o mês e o ano, e os lançamentos (um por linha), cada um com de onde veio (aba, tabela, linha).
function planAba(aba, i, anoArq, ajA, ajT, hoje){
  const linhas = aba.linhas, info = {i, nome:aba.nome, tabelas:[], linhas:0, puladas:{}};
  const pula = motivo => { info.puladas[motivo] = (info.puladas[motivo] || 0) + 1; };
  // Mês e ano da aba: o nome dela, ou um título nas primeiras linhas (texto sozinho na linha), ou o ajuste.
  const doNome = planMesAno(aba.nome);
  let doTitulo = {};
  for (let r = 0; r < Math.min(linhas.length, 6) && !(doTitulo.m && doTitulo.y); r++){
    const textos = (linhas[r] || []).filter(c => c && !c.m);
    if (textos.length === 1 && textos[0].t === 's'){ const x = planMesAno(textos[0].v); doTitulo = {m:doTitulo.m || x.m, y:doTitulo.y || x.y}; }
  }
  info.mesDe = ajA.mes ? 'ajuste' : doNome.m ? 'nome' : doTitulo.m ? 'titulo' : '';
  const anoDe = ajA.mes ? 'ajuste' : doNome.y ? 'nome' : doTitulo.y ? 'titulo' : anoArq ? 'arquivo' : 'suposto';
  const aMes = ajA.mes ? +ajA.mes.slice(5) : doNome.m || doTitulo.m || 0;
  const aAno = ajA.mes ? +ajA.mes.slice(0, 4) : doNome.y || doTitulo.y || anoArq || +hoje.slice(0, 4);
  Object.assign(info, {mes:aMes ? plYM(aAno, aMes) : '', ano:aAno, anoDe});
  info.ignorada = ajA.ignorar === true ? 'ajuste' : ajA.ignorar === false ? '' : PL_ABA_RESUMO.test(plT(aba.nome)) ? 'resumo' : '';
  if (info.ignorada) return {info, lancs:[]};
  // Tabelas: cada cabeçalho até o próximo que use as mesmas colunas (ou o fim da aba).
  const cabs = [];
  linhas.forEach((l, r) => { for (const h of planCabecalhos(l || [])) cabs.push({r, ...h}); });
  if (!cabs.length && planResumoGrade(linhas)){ info.resumo = true; return {info, lancs:[]}; } // só resumo: ver planDetectar
  const semCab = !cabs.length && planSemCabecalho(linhas);
  if (semCab) cabs.push({r:linhas.findIndex(l => l && planValor(l[semCab.nomes[1].c]) != null) - 1, ...semCab});
  const lancs = [];
  cabs.forEach(h => {
    const id = `${i}:${h.r}:${h.c0}`, ajTab = ajT[id] || {}, prox = cabs.find(o => o.r > h.r && o.c0 <= h.c1 && o.c1 >= h.c0);
    const fim = prox ? prox.r : linhas.length;
    // Título: o texto mais próximo acima do cabeçalho, nas colunas da tabela (até 3 linhas acima).
    let titulo = '';
    for (let r = h.r - 1; r >= Math.max(0, h.r - 3) && !titulo; r--){
      const l = linhas[r] || [];
      for (let c = h.c0; c <= h.c1 && !titulo; c++) if (l[c] && l[c].t === 's') titulo = String(l[c].v).trim();
    }
    const cols = {};
    for (const n of h.nomes) cols[n.c] = n.papel || planPapelConteudo(linhas, h.r, n.c);
    Object.assign(cols, ajTab.cols || {});
    const tit = planMesAno(titulo), tipoTitulo = planTipoDe(titulo), banco = planEhBanco(titulo) ? planBanco(titulo) : '';
    const t = {id, r:h.r, c0:h.c0, c1:h.c1, titulo, nomes:h.nomes.map(n => [n.c, n.texto || '']), cols, semCabecalho:!!h.semCabecalho,
      tipo:ajTab.tipo || tipoTitulo || (banco ? 'gasto' : '') || planTipoDe(aba.nome) || '', banco, n:0, mes:tit.m ? plYM(tit.y || aAno, tit.m) : ''};
    info.tabelas.push(t);
    const col = papel => Object.keys(cols).filter(c => cols[c] === papel).map(Number);
    const um = papel => col(papel)[0], cel = (l, papel) => um(papel) == null ? null : l[um(papel)];
    // Linhas da tabela: primeiro lidas, depois o tipo (o sinal da maioria precisa de todas).
    const lidas = [];
    let bloco = ajA.mes ? '' : t.mes, blocoDia = null, secao = ''; // o mês escolhido pela pessoa para a aba vale mais que o título
    for (let r = h.r + 1; r < fim; r++){
      const l = linhas[r] || [];
      if (plVazia(l, h.c0, h.c1)){ pula('vazias'); continue; }
      const dl = cel(l, 'desc'), descTxt = dl && dl.t !== 'n' ? String(dl.t === 'd' ? '' : dl.v).trim() : '', catTxt = plTexto(cel(l, 'categoria'));
      // Valor: a coluna Valor, ou Entrada/Saída (a que estiver preenchida).
      const ve = um('entrada') != null ? planValor(l[um('entrada')]) : null, vs = um('saida') != null ? planValor(l[um('saida')]) : null;
      const vv = um('valor') != null ? planValor(l[um('valor')]) : null, valor = vv ?? (ve || vs || null);
      const textosLinha = l.slice(h.c0, h.c1 + 1).filter(c => c && !c.m);
      // Linha só com texto ou só com uma data: seção, bloco de mês ou de dia.
      if (valor == null){
        const so = textosLinha.length === 1 ? textosLinha[0] : null, dt = so && planData(so, 'data');
        if (so && so.t === 's' && planTipoDe(so.v) && !planMesAno(so.v).m) secao = planTipoDe(so.v);
        else if (dt && (dt.data || dt.m)){ blocoDia = dt; bloco = dt.data ? dt.data.slice(0, 7) : bloco; }
        else if (so && so.t === 's' && planMesAno(so.v).m){ const x = planMesAno(so.v); bloco = plYM(x.y || aAno, x.m); blocoDia = null; }
        pula(textosLinha.length ? 'sem valor' : 'vazias');
        continue;
      }
      const desc = descTxt || catTxt;
      if (!desc){ pula('sem descrição'); continue; }
      if (PL_TOTAL.test(plT(desc))){ pula('total'); continue; }
      if (valor === 0){ pula('sem valor'); continue; }
      // Data: a da coluna (completa, sem ano ou só o dia), a do bloco e o mês do bloco, do título, da aba.
      let dt = planData(cel(l, 'data'), 'data') || planData(cel(l, 'dia'), 'dia') || blocoDia || {};
      const mesBase = bloco || info.mes;
      let data = '', mes = '';
      if (dt.data && planDataOk(dt.data)){ data = dt.data; mes = data.slice(0, 7); }
      else if (dt.m){ mes = plYM(mesBase ? +mesBase.slice(0, 4) : aAno, dt.m); data = mes + '-' + String(Math.min(dt.d, 28)).padStart(2, '0'); }
      else if (dt.d && mesBase){ mes = mesBase; data = mes + '-' + String(dt.d).padStart(2, '0'); if (!planDataOk(data)) data = ''; }
      else mes = mesBase || '';
      // Parcela: na coluna Parcela ou no fim da descrição ("Geladeira 3/10").
      const pc = planParcCel(cel(l, 'parcela')), pd = !pc && planParcTexto(desc);
      const tipoCel = plT(plTexto(cel(l, 'tipo')));
      lidas.push({aba:i, tab:id, r, desc:(pd ? pd.resto : desc).slice(0, 80) || desc.slice(0, 80), valor, ve, vs, data, mes, dia:data ? +data.slice(8) : 0,
        catTxt, payTxt:plTexto(cel(l, 'pagamento')), contaTxt:plTexto(cel(l, 'conta')), parc:pc || (pd ? {k:pd.k, n:pd.n} : null),
        fixo:planSim(cel(l, 'fixo')), secao,
        tipoCel:/receita|entrada|ganho|credito|^c$/.test(tipoCel) ? 'ganho' : /despesa|saida|gasto|debito|^d$/.test(tipoCel) ? 'gasto' : ''});
    }
    // Tipo pelo sinal: com o tipo da tabela conhecido (título, seção, aba), o sinal da maioria é ele e o outro sinal é o
    // contrário (estorno); sem pista nenhuma, como num extrato: negativo é gasto, positivo é ganho (tudo positivo: gasto).
    const pos = lidas.filter(x => x.valor > 0).length, neg = lidas.length - pos, base = t.tipo;
    for (const x of lidas){
      let tipo = x.ve && !x.vs ? 'ganho' : x.vs && !x.ve ? 'gasto' : x.tipoCel || x.secao;
      if (!tipo && base){ const maioria = neg > pos ? x.valor < 0 : x.valor > 0; tipo = maioria ? base : base === 'ganho' ? 'gasto' : 'ganho'; }
      if (!tipo) tipo = neg && x.valor > 0 ? 'ganho' : 'gasto';
      const pay = planPagamento(x.payTxt) || planPagamento(x.contaTxt) || (t.banco ? 'credito' : ''), bank = planBanco(x.contaTxt) || t.banco;
      lancs.push({id:'p' + lancs.length + '_' + i, aba:x.aba, tab:x.tab, r:x.r, desc:x.desc, valor:Math.round(Math.abs(x.valor) * 100) / 100,
        data:x.data, mes:x.mes,
        dia:x.dia, tipo, catTxt:x.catTxt, cat:x.catTxt ? planCategoria(x.catTxt, tipo === 'ganho' ? 'ganho' : 'gasto')
          : tipo === 'ganho' ? planGanhoCat(x.desc) : planCategoria(x.desc, 'gasto', false) || guessCat(x.desc),
        pay, bank, parc:x.parc, fixo:x.fixo});
      t.n++;
    }
  });
  info.linhas = lancs.length;
  return {info, lancs};
}
// Categoria de um ganho pela descrição (salário, freela, venda…), ou "Outros".
const planGanhoCat = desc => { const t = plT(desc); return /salario|holerite|ordenado/.test(t) ? 'salario' : /freela|bico|extra/.test(t) ? 'freelance'
  : /rendiment|juros|dividend/.test(t) ? 'rendimentos' : /\bvenda|vendi\b/.test(t) ? 'vendas' : 'outros'; };

// ---------- O que vai ser importado ----------
// Agrupa os lançamentos detectados (só os de gasto e ganho; os de investimento ficam de fora) em itens:
// - compra parcelada: as parcelas da mesma compra (descrição, total de parcelas e valor parecido) viram uma, como no
//   formulário (mês da 1ª parcela = mês da linha − (parcela − 1); meses que já passaram contam como pagos);
// - fixo: a coluna Fixo marcada, do primeiro ao último mês em que aparece (aberto se chega ao mês passado);
// - avulso: o resto, um por linha;
// e sugere fixos (repetição): a mesma descrição em 3 ou mais meses seguidos com valor até 10% diferente; ou, em alguns
// meses (campo cada = rep, ver activeIn), a mesma descrição a cada 2, 3, 4 ou 6 meses (PLR em junho e dezembro) ou nos
// mesmos meses do ano em anos diferentes (IPVA em jan, fev e mar). Todo mês seguido vale antes dos outros.
function planItens(det, hoje = new Date().toLocaleDateString('sv')){
  const ym = hoje.slice(0, 7), itens = [], sugs = [], usados = new Set(), lancs = det.lancs.filter(x => x.tipo !== 'invest' && x.mes);
  for (const x of lancs) if (x.rep) usados.add(x.id); // repetido de outra planilha: fica avulso (desmarcado), fora dos grupos
  const chave = x => plT(x.desc).replace(/[^a-z0-9]+/g, ' ').trim();
  const grupos = (lista, k) => { const m = new Map();
    for (const x of lista){ const c = k(x); if (!m.has(c)) m.set(c, []); m.get(c).push(x); }
    return [...m.values()]; };
  const fimDe = meses => meses[meses.length - 1] >= addMonths(ym, -1) ? '' : meses[meses.length - 1]; // aberto se chega ao mês passado
  for (const g of grupos(lancs.filter(x => x.parc && x.tipo === 'gasto' && !x.rep), x => `${chave(x)}|${x.parc.n}|${x.bank}`)){
    // Compras diferentes com o mesmo nome: separadas pelo mês da 1ª parcela.
    for (const c of grupos(g, x => addMonths(x.mes, -(x.parc.k - 1)))){
      const start = addMonths(c[0].mes, -(c[0].parc.k - 1)), n = c[0].parc.n, valor = c[c.length - 1].valor;
      itens.push({tipo:'parcela', desc:c[0].desc, n, valor, total:Math.round(valor * n * 100) / 100, start, paid:Math.min(n, Math.max(0, monthDiff(ym, start))),
        cat:c[0].cat, catTxt:c[0].catTxt, bank:c[0].bank, pay:c[0].pay || 'credito', lancs:c.map(x => x.id), mes:start, on:true});
      c.forEach(x => usados.add(x.id));
    }
  }
  for (const g of grupos(lancs.filter(x => x.fixo && !usados.has(x.id)), x => `${chave(x)}|${x.tipo}`)){
    const meses = g.map(x => x.mes).sort(), ult = g.find(x => x.mes === meses[meses.length - 1]);
    itens.push({tipo:g[0].tipo === 'ganho' ? 'ganhoFixo' : 'fixo', desc:g[0].desc, valor:ult.valor, start:meses[0], end:fimDe(meses),
      dia:ult.dia, cat:g[0].cat, catTxt:g[0].catTxt, bank:g[0].bank, pay:g[0].pay, lancs:g.map(x => x.id), mes:meses[0], on:true});
    g.forEach(x => usados.add(x.id));
  }
  for (const x of lancs.filter(x => !usados.has(x.id) || x.rep))
    itens.push({tipo:x.tipo === 'ganho' ? 'ganho' : 'gasto', desc:x.desc, valor:x.valor, mes:x.mes, dia:x.dia, cat:x.cat, catTxt:x.catTxt,
      bank:x.bank, pay:x.pay,
      lancs:[x.id], on:true, ...(x.rep ? {rep:true} : {})});
  // Repetições entre os avulsos: viram sugestão de fixo (desmarcada). Assinatura ou conta fixa: a regra da Explorar.
  for (const g of grupos(itens.filter(x => (x.tipo === 'gasto' || x.tipo === 'ganho') && !x.rep), x => `${chave(x)}|${x.tipo}`)){
    const meses = [...new Set(g.map(x => x.mes))].sort();
    let seguidos = 1, melhor = 1;
    for (let k = 1; k < meses.length; k++){ seguidos = monthDiff(meses[k], meses[k - 1]) === 1 ? seguidos + 1 : 1; melhor = Math.max(melhor, seguidos); }
    const vals = g.map(x => x.valor).sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)];
    if (meses.length < 2 || meses.length !== g.length || vals.some(v => Math.abs(v - med) > med * .1)) continue;
    const cada = planCada(meses);
    if (!cada && melhor < 3) continue;
    const ult = g.find(x => x.mes === meses[meses.length - 1]), ganho = g[0].tipo === 'ganho';
    // Em alguns meses: aberto enquanto a próxima vez ainda não passou.
    const fim = !cada ? fimDe(meses) : proximoMes({fixed:'y', rep:cada, start:meses[0]}, meses[meses.length - 1]) >= ym ? '' : meses[meses.length - 1];
    sugs.push({tipo:ganho ? 'ganhoFixo' : 'fixo', desc:g[0].desc, valor:ult.valor, start:meses[0], end:fim, ...(cada ? {cada} : {}),
      dia:ult.dia, cat:g[0].cat, catTxt:g[0].catTxt, bank:g[0].bank, pay:g[0].pay, itens:g, mes:meses[0], on:false,
      sub:!ganho && !cada && isSub({fixed:true, desc:g[0].desc, cat:g[0].cat}) ? 'assinatura' : ganho ? '' : 'conta fixa'});
  }
  return {itens, sugs};
}
// Repetição em alguns meses (meses = os meses em que apareceu, em ordem): o intervalo (2, 3, 4 ou 6) quando é sempre o
// mesmo, ou os meses do ano quando são os mesmos em todos os anos (2 anos ou mais); 0 se é todo mês ou não tem padrão.
function planCada(meses){
  const pulos = meses.slice(1).map((m, i) => monthDiff(m, meses[i]));
  if (pulos.every(d => d === 1)) return 0;
  if ([2, 3, 4, 6].includes(pulos[0]) && pulos.every(d => d === pulos[0])) return pulos[0];
  const porAno = {};
  for (const m of meses) (porAno[m.slice(0, 4)] = porAno[m.slice(0, 4)] || []).push(+m.slice(5));
  const anos = Object.values(porAno).map(l => l.join(','));
  return anos.length >= 2 && anos.every(l => l === anos[0]) && anos[0].includes(',') ? anos[0].split(',').map(Number) : 0;
}
// Planilha só de resumo, se a pessoa aceitar: um gasto por categoria por mês (no dia 1), com o nome da categoria.
function planDaGrade(det){
  const g = det.grade;
  if (!g) return [];
  const ano = det.abas[g.aba].ano;
  return g.itens.map(x => { const r = x.rotulo, dt = r.t === 'd' ? r.v.slice(0, 7) : (m => m.m ? plYM(m.y || ano, m.m) : '')(planMesAno(r.v));
    return dt && {tipo:'gasto', desc:x.cat, valor:Math.round(x.valor * 100) / 100, mes:dt, dia:1, cat:planCategoria(x.cat, 'gasto'), catTxt:x.cat,
      bank:'', pay:'', lancs:[], on:true}; })
    .filter(Boolean);
}

// ---------- Tela: ajuda, escolha do arquivo e revisão ----------
// Importação em revisão: o arquivo, a planilha lida (pl), os ajustes da pessoa (aj, ver planDetectar), o resultado
// (det, itens, sugs, tabs) e as escolhas que valem depois de refazer a detecção, pela chave de cada item: marcas
// (marcado ou não), catItem (categoria trocada num item), sugsOn (sugestão de fixo aceita) e cats (o que fazer com
// cada categoria que não existe: a chave de uma categoria, ou ausente = "Outros").
let plan = null;
const PL_ACEITA = '.xlsx,.ods,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,'
  + 'application/vnd.oasis.opendocument.spreadsheet';
function planAjuda(){
  settingsOpen = false; F = null;
  showSheet(`<h3>Importar planilha</h3>
    <div class="semTopo hint">Traga os gastos e ganhos de uma planilha que você já usa. O app entende sozinho o jeito dela (uma linha
      por lançamento, uma aba por mês, blocos por dia, colunas de entrada e saída, cartões lado a lado…) e mostra tudo para você
      conferir antes de importar.</div>
    <div class="hint">Aceita .xlsx (Excel), .ods (LibreOffice) e .csv. No Google Planilhas, baixe antes: Arquivo › Fazer download ›
      Microsoft Excel (.xlsx). O .xls antigo precisa ser salvo de novo como .xlsx.</div>
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button>
      <button class="btn primary" data-onclick="planEscolher()">${I('upload', 18)}Escolher planilha</button></div>
    ${importacoesHtml()}`);
}
// A escolha dos arquivos (uma ou várias planilhas): um campo de arquivo criado na hora (o index.html não carrega este arquivo).
function planEscolher(){
  const inp = document.createElement('input');
  Object.assign(inp, {type:'file', accept:PL_ACEITA, multiple:true, hidden:true});
  inp.onchange = () => { const fs = [...inp.files]; inp.remove(); if (fs.length) planLer(fs); };
  document.body.appendChild(inp);
  inp.click();
}
// Lê uma ou várias planilhas. Uma que não dá para ler não impede as outras (vai para "Não li", com o motivo); juntas,
// valem os mesmos limites de abas e linhas de uma planilha só. Com várias, cada aba lembra de qual arquivo veio (arq).
async function planLer(arquivos){
  arquivos = [].concat(arquivos);
  const bons = [], ruins = [], aviso = e => e && ERROS[e.aviso] ? e.aviso : 'planilha';
  let abas = 0, linhas = 0;
  await comCarga(arquivos.length > 1 ? `Lendo ${arquivos.length} planilhas…` : 'Lendo a planilha…', async () => {
    for (const f of arquivos){
      const nome = f.name || 'planilha';
      try {
        const pl = await lerPlanilha(f), n = pl.abas.reduce((a, x) => a + x.linhas.length, 0);
        if (abas + pl.abas.length > PL_ABAS || linhas + n > PL_LINHAS) throw plErro('planilhaGrande', 'junto com as outras planilhas');
        abas += pl.abas.length; linhas += n;
        bons.push({nome, pl});
      } catch(e){
        logErr('importar planilha', `${nome} (${Math.round((f.size || 0) / 1024)} KB): ${(e && (e.stack || e.message)) || e}`);
        ruins.push({nome, aviso:aviso(e)});
      }
    }
  });
  if (!bons.length){ // só o aviso: quem chamou não fica esperando a pessoa tocar em OK
    if (arquivos.length === 1) avisoErro(ruins[0].aviso);
    else tell('Não consegui ler nenhuma das planilhas.\n\n' + ruins.map(r => `${r.nome}: ${ERROS[r.aviso][0]}`).join('\n'));
    return;
  }
  const varias = bons.length > 1;
  plan = {nome:varias ? `${bons.length} planilhas (${bons.map(b => b.nome).join(', ')})` : bons[0].nome, varias,
    pl:{abas:bons.flatMap(b => b.pl.abas.map(a => varias ? {...a, arq:b.nome} : a))}, ruins:ruins.map(r => `${r.nome}: ${ERROS[r.aviso][0]}`),
    aj:{abas:{}, tabs:{}}, marcas:{}, catItem:{}, sugsOn:{}, cats:{}, usarGrade:false};
  planRefazer();
  planAbrir();
}
// Chave de um item, para as escolhas da pessoa sobreviverem a refazer a detecção.
const planChave = x => [x.tipo, plT(x.desc), x.mes || x.start, x.valor].join('|');
const planGasto = x => ['gasto', 'parcela', 'fixo'].includes(x.tipo);
const planCatK = x => (planGasto(x) ? 'g:' : 'r:') + plT(x.catTxt);
// Já está no app? Parcelada com o mesmo nome e prazo, fixo com o mesmo nome, ou o gasto/ganho igual (jaCadastrado, jaExiste).
function planJa(x){
  const mesmo = l => l.some(e => plT(e.desc) === plT(x.desc));
  if (x.tipo === 'parcela') return mesmo(db.installments.filter(p => p.n === x.n)) ? 'compra parcelada ' + x.desc : '';
  if (x.tipo === 'fixo' || x.tipo === 'ganhoFixo') return mesmo((x.tipo === 'fixo' ? db.expenses : db.incomes).filter(e => e.fixed)) ? 'fixo ' + x.desc : '';
  return x.tipo === 'gasto' ? jaCadastrado(x.desc, x.valor, x.mes) : '';
}
// Refaz a detecção com os ajustes e aplica as escolhas: o que já está no app vem desmarcado (depois vale a marca da
// pessoa), a categoria de cada item e as sugestões aceitas (os avulsos delas saem da lista).
function planRefazer(){
  const det = plan.det = planDetectar(plan.pl, plan.nome, plan.aj), r = planItens(det);
  plan.tabs = det.abas.flatMap(a => a.tabelas.map(t => ({...t, aba:a.i})));
  plan.sugs = plan.usarGrade ? [] : r.sugs;
  const tiradas = new Set();
  for (const s of plan.sugs){ s.on = !!plan.sugsOn[planChave(s)]; if (s.on) s.itens.forEach(x => tiradas.add(x)); }
  plan.itens = (plan.usarGrade ? planDaGrade(det) : r.itens).filter(x => !tiradas.has(x)).concat(plan.sugs.filter(s => s.on));
  for (const x of plan.itens){
    const k = planChave(x);
    x.ja = planJa(x);
    x.dup = !x.ja && (x.tipo === 'gasto' || x.tipo === 'ganho') && jaExiste(x.tipo === 'gasto', x.desc, x.valor, x.mes, x.dia);
    x.on = plan.marcas[k] ?? !(x.ja || x.dup || x.rep);
    x.catFinal = plan.catItem[k] || x.cat || plan.cats[planCatK(x)] || 'outros';
  }
  plan.itens.sort((a, b) => (a.mes || a.start).localeCompare(b.mes || b.start) || (a.dia || 0) - (b.dia || 0));
}
// Categorias da planilha que não existem no app: [{k, texto, gasto, n, cat}] (cat: a escolhida para ela, ou '').
function planCatsNovas(){
  const m = new Map();
  for (const x of plan.itens) if (x.on && !x.cat && x.catTxt){
    const k = planCatK(x);
    if (!m.has(k)) m.set(k, {k, texto:x.catTxt.trim(), gasto:planGasto(x), n:0, cat:plan.cats[k] || ''});
    m.get(k).n++;
  }
  return [...m.values()];
}
const PL_PAPEL_NOME = {data:'Data', dia:'Dia', desc:'Descrição', valor:'Valor', entrada:'Entrada', saida:'Saída', categoria:'Categoria',
  pagamento:'Forma de pagamento', conta:'Conta ou cartão', parcela:'Parcela', fixo:'Fixo', tipo:'Ganho ou gasto',
  situacao:'Situação (ignorada)', '':'Ignorar'};
const PL_TIPO_NOME = {gasto:'Gastos', ganho:'Ganhos', invest:'Investimentos (não importar)', '':'Pelo sinal do valor'};
const PL_MES_DE = {nome:'pelo nome da aba', titulo:'pelo título da aba', arquivo:'ano pelo nome do arquivo', suposto:'ano suposto: confira',
  ajuste:'escolhido por você'};
const plColuna = c => { let s = ''; for (c++; c; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; };
const plBtn = (on, acao, texto) => `<button class="btn ${on ? 'primary' : ''}" data-onclick="${acao}">${texto}</button>`;
// Detalhe de um item na lista: data ou mês, parcelas, fixo, banco e se já está no app.
function planInfo(x){
  const pagas = x.paid ? ` · ${plural(x.paid, 'paga', 'pagas')}` : '';
  const quando = x.tipo === 'parcela' ? `${x.n}x de ${fmt(x.valor)} · 1ª em ${monthName(x.start)}${pagas}`
    : x.cada ? `${repTexto({rep:x.cada, start:x.start})} · desde ${monthName(x.start)}${x.end ? ' até ' + monthName(x.end) : ''}`
    : x.tipo === 'fixo' || x.tipo === 'ganhoFixo' ? `fixo desde ${monthName(x.start)}${x.end ? ' até ' + monthName(x.end) : ''}`
    : x.dia ? fmtDate(`${x.mes}-${String(x.dia).padStart(2, '0')}`) : cap(monthName(x.mes));
  const porque = x.ja ? 'já no app: ' + x.ja : x.dup ? 'já existe' : x.rep ? 'repetido em outra planilha' : '';
  return esc([quando, x.bank, PAY[x.pay], porque].filter(Boolean).join(' · '));
}
const planOn = () => plan.itens.filter(x => x.on);
// Topo da revisão: arquivo, abas, período, o aviso de planilha só de resumo e os totais do que está marcado.
function planTopoHtml(){
  const d = plan.det, on = planOn(), lidas = d.abas.filter(a => !a.ignorada).length, ign = d.abas.length - lidas, meses = on.map(x => x.mes || x.start).sort();
  const soma = l => sum(l, x => x.tipo === 'parcela' ? x.total : x.valor), gastos = on.filter(planGasto), ganhos = on.filter(x => !planGasto(x));
  const parc = on.filter(x => x.tipo === 'parcela').length, fixos = on.filter(x => /ixo/.test(x.tipo)).length;
  const periodo = meses.length ? ` · de ${monthName(meses[0])} a ${monthName(meses[meses.length - 1])}` : '';
  const abas = plural(lidas, 'aba lida', 'abas lidas') + (ign ? ` (${plural(ign, 'ignorada', 'ignoradas')})` : '');
  return `<div class="semTopo hint"><b>${esc(plan.nome)}</b> · ${abas}${periodo}</div>
    ${plan.ruins.length ? `<div class="hint warn">Não li: ${plan.ruins.map(esc).join('; ')}</div>` : ''}
    ${d.grade ? `<div class="card planGrade"><b>${I('alert', 16)} Esta planilha é um resumo por mês: não tem os lançamentos.</b>
      <div class="hint">Dá para lançar um gasto por categoria por mês, com o total de cada uma (${plural(d.grade.itens.length, 'gasto', 'gastos')}).</div>
      <div class="btns">${plBtn(plan.usarGrade, 'planGrade()', plan.usarGrade ? I('checked', 16) + 'Lançando um por categoria'
        : 'Lançar um gasto por categoria por mês')}</div>
      </div>` : ''}
    <div class="card grid2"><div class="stat"><small>${plural(gastos.length, 'gasto', 'gastos')}</small><b class="out">${fmt(soma(gastos))}</b></div>
      <div class="stat"><small>${plural(ganhos.length, 'ganho', 'ganhos')}</small><b class="in">${fmt(soma(ganhos))}</b></div></div>
    ${parc || fixos ? `<div class="hint">Entre eles, ${[parc && plural(parc, 'compra parcelada', 'compras parceladas'),
      fixos && plural(fixos, 'gasto fixo', 'gastos fixos')].filter(Boolean).join(' e ')}.</div>` : ''}`;
}
// "Como li cada aba": mês (com de onde veio), importar ou ignorar, o tipo e as colunas de cada tabela e o que foi pulado.
function planAbaHtml(a){
  const tabela = t => { const ti = plan.tabs.findIndex(x => x.id === t.id);
    return `<div class="planTab"><b>${esc(t.titulo || 'Tabela na linha ' + (t.r + 2))}</b><small> · ${plural(t.n, 'lançamento', 'lançamentos')}</small>
      <div>${impCatBtn(PL_TIPO_NOME[t.tipo] || 'Gastos', `planTipoTab(${ti})`)}</div>
      <div class="chips planCols">${t.nomes.map(([c, texto]) => `<button type="button" data-onclick="planColuna(${ti},${c})">${plColuna(c)}${texto ? ' '
        + esc(texto) : ''}: <b>${PL_PAPEL_NOME[t.cols[c] || '']}</b></button>`).join('')}</div></div>`; };
  const origem = a.mes && a.mesDe !== 'ajuste' && PL_MES_DE[a.anoDe]
    ? `<span class="${a.anoDe === 'suposto' ? 'warn' : 'muted'}">(${a.mesDe ? PL_MES_DE[a.mesDe] + ', ' : ''}${PL_MES_DE[a.anoDe]})</span>` : '';
  const pulos = Object.entries(a.puladas).map(([m, n]) => `${n} ${m}`).join(', ');
  return `<details class="grp planAba"><summary>${esc(planAbaNome(a))}<small>${a.ignorada ? 'ignorada' : a.linhas}</small>${I('chev')}</summary>
    <div class="planAbaCorpo"><div class="btns">${plBtn(!a.ignorada, `planIgnorar(${a.i},false)`, 'Importar esta aba')}${plBtn(!!a.ignorada,
      `planIgnorar(${a.i},true)`, 'Ignorar')}</div>
    ${a.ignorada ? `<div class="hint">${a.ignorada === 'resumo' ? 'Parece uma aba de resumo (pelo nome).' : 'Você escolheu ignorar.'}</div>`
      : `<div class="hint">Mês: ${impCatBtn(a.mes ? cap(monthName(a.mes)) : 'pela data de cada linha', `planMes(${a.i})`)} ${origem}</div>
      ${a.tabelas.map(tabela).join('')}${pulos ? `<div class="hint">Linhas que não são lançamentos: ${pulos}.</div>` : ''}`}</div></details>`;
}
// Categorias que não existem: criar (com o "+ Nova categoria"), usar Outros ou ligar a uma existente.
const planCatsHtml = novas => !novas.length ? '' : '<label>Categorias que não existem no app</label>' + novas.map((c, i) => {
  const nome = c.cat ? I('checked', 16) + esc(((c.gasto ? CAT_GASTO : CAT_GANHO)[c.cat] || [0, c.texto])[1]) : `Criar "${esc(c.texto)}"`;
  return `<div class="planCat"><b>${esc(c.texto)}</b><small> · ${plural(c.n, 'lançamento', 'lançamentos')}</small>
    <div class="btns">${plBtn(!!c.cat, `planCatCriar(${i})`, nome)}${plBtn(!c.cat, `planCatOutros(${i})`, 'Usar Outros')}${plBtn(false,
      `planCatLigar(${i})`, 'Ligar a…')}</div></div>`; }).join('');
function planAbrir(){
  settingsOpen = false; F = null;
  let mesAntes = '';
  const linha = (x, i) => { const m = x.mes || x.start, C = planGasto(x) ? CAT_GASTO : CAT_GANHO;
    const cab = m !== mesAntes ? `<div class="stmtMes">${cap(monthName(m))}</div>` : '';
    mesAntes = m;
    return cab + impLinha(x.on, `planMarca(${i},this)`, x.desc, planInfo(x), impCatBtn((C[x.catFinal] || C.outros)[1], `planCatItem(${i})`), planGasto(x),
      x.tipo === 'parcela' ? x.total : x.valor); };
  const sug = (s, i) => impLinha(s.on, `planSug(${i})`, s.desc, esc(`${s.sub || 'ganho fixo'} · ${fmt(s.valor)} por mês, desde ${monthName(s.start)}`
    + (s.end ? ' até ' + monthName(s.end) : '')), '', s.tipo === 'fixo', s.valor);
  showSheet(`<h3>Importar planilha</h3>${planTopoHtml()}
    <label>Como li cada aba</label>${plan.det.abas.map(planAbaHtml).join('')}
    ${planCatsHtml(planCatsNovas())}
    ${plan.sugs.length ? `<label>Parecem gastos fixos (aceite para virar um fixo só)</label>${plan.sugs.map(sug).join('')}` : ''}
    <label>Lançamentos</label>
    ${plan.itens.length ? plan.itens.slice(0, 300).map(linha).join('')
      : '<div class="hint">Não encontrei lançamentos. Confira em "Como li cada aba" o mês e o papel de cada coluna.</div>'}
    ${plan.itens.length > 300 ? '<div class="hint">Mostrando os primeiros 300; os demais marcados também serão importados.</div>' : ''}
    <div class="btns foot"><button class="btn" data-onclick="closeForm()">Cancelar</button>
      <button class="btn primary" id="planGo" data-onclick="planImportar()">${planRotulo()}</button></div>`);
}
const planRotulo = () => `Importar ${plural(planOn().length, 'lançamento', 'lançamentos')}`;
const planDeNovo = () => { planRefazer(); planAbrir(); };
const planAjAba = i => plan.aj.abas[i] = plan.aj.abas[i] || {}, planAjTab = ti => plan.aj.tabs[plan.tabs[ti].id] = plan.aj.tabs[plan.tabs[ti].id] || {};
function planMarca(i, b){
  const x = plan.itens[i];
  x.on = impMarca(b, !x.on); plan.marcas[planChave(x)] = x.on;
  document.getElementById('planGo').textContent = planRotulo();
}
function planSug(i){ const s = plan.sugs[i]; plan.sugsOn[planChave(s)] = !s.on; planDeNovo(); }
function planGrade(){ plan.usarGrade = !plan.usarGrade; planDeNovo(); }
function planIgnorar(i, sim){ planAjAba(i).ignorar = sim; planDeNovo(); }
// Nome de uma aba na revisão: com várias planilhas, o arquivo antes ("gastos-2025.xlsx › Março").
const planAbaNome = a => (a.arq ? a.arq + ' › ' : '') + a.nome;
function planMes(i){
  const a = plan.det.abas[i];
  pickMonthP('Mês da aba ' + planAbaNome(a), a.mes, false, v => { if (v){ planAjAba(i).mes = v; planDeNovo(); } });
}
function planTipoTab(ti){ pickList('Esta tabela é de', Object.entries(PL_TIPO_NOME), plan.tabs[ti].tipo, v => { planAjTab(ti).tipo = v; planDeNovo(); }); }
function planColuna(ti, c){
  pickList(`Coluna ${plColuna(c)}`, Object.entries(PL_PAPEL_NOME), plan.tabs[ti].cols[c] || '', v => {
    const aj = planAjTab(ti); (aj.cols = aj.cols || {})[c] = v; planDeNovo(); });
}
function planCatItem(i){
  const x = plan.itens[i];
  pickList('Categoria', opts(planGasto(x) ? CAT_GASTO : CAT_GANHO), x.catFinal, v => { plan.catItem[planChave(x)] = v; planDeNovo(); });
}
function planCatCriar(i){ const c = planCatsNovas()[i]; novaCategoria(c.gasto ? 'gasto' : 'ganho', k => { plan.cats[c.k] = k; planDeNovo(); }, c.texto); }
function planCatOutros(i){ delete plan.cats[planCatsNovas()[i].k]; planDeNovo(); }
function planCatLigar(i){
  const c = planCatsNovas()[i];
  pickList(`Ligar "${c.texto}" a`, opts(c.gasto ? CAT_GASTO : CAT_GANHO), c.cat, v => { plan.cats[c.k] = v; planDeNovo(); });
}

// ---------- Importar ----------
// Monta os registros (gasto, ganho, compra parcelada, fixo) do que está marcado, passa pela validação de sempre (fixDb)
// e grava.
const planValorOk = v => Math.min(99999999, Math.round(Math.abs(+v || 0) * 100) / 100);
function planRegistro(x){
  const C = planGasto(x) ? CAT_GASTO : CAT_GANHO, base = {id:uid(), desc:String(x.desc).trim().slice(0, 80) || 'Sem descrição',
    cat:C[x.catFinal] ? x.catFinal : 'outros', bank:String(x.bank || '').slice(0, 40)};
  if (x.tipo === 'parcela')
    return ['installments', {...base, pay:x.pay || 'credito', mode:'parcela', n:x.n, total:planValorOk(x.total), paid:x.paid, start:x.start, due:''}];
  const fixo = x.tipo === 'fixo' || x.tipo === 'ganhoFixo', gasto = x.tipo === 'fixo' || x.tipo === 'gasto';
  const rec = {...base, value:planValorOk(x.valor), fixed:fixo && x.cada ? 'y' : fixo, start:fixo ? x.start : x.mes, end:fixo ? x.end || '' : '',
    ...(fixo && x.cada ? {rep:x.cada} : {})};
  if (!gasto) return ['incomes', {...rec, day:x.dia || ''}];
  return ['expenses', fixo ? {...rec, due:x.dia || '', pay:x.pay || '', sub:x.sub === 'assinatura' ? '1' : x.sub === 'conta fixa' ? '0' : ''}
    : {...rec, day:x.dia || '', due:'', pay:x.pay || ''}];
}
function planImportar(){
  const novos = {expenses:[], incomes:[], installments:[]};
  for (const x of planOn()){ const [c, r] = planRegistro(x); novos[c].push(r); }
  fixDb(novos); // dado de fora: ids, categorias e o resto como em qualquer outro dado que chega
  const recs = ['expenses', 'incomes', 'installments'].flatMap(c => novos[c].filter(r => (r.value || r.total) > 0 && /^\d{4}-\d\d$/.test(r.start))
    .map(r => [c, r]));
  if (!recs.length) return closeForm();
  // Um lote: cada lançamento guarda de qual importação veio (imp), para desfazer tudo de uma vez (loteDesfazer).
  const id = 'imp' + uid(), agora = Date.now();
  for (const [c, r] of recs){ db[c].push(touch({...r, imp:id})); if (c === 'expenses' && r.cat !== 'outros') db.catMemo[plain(r.desc)] = r.cat; }
  db.imports.push({id, nome:String(plan.nome).slice(0, 80), at:agora, n:recs.length, u:agora});
  const ultimo = recs.map(([, r]) => r.start).sort().pop();
  state.month = ultimo > curYM ? curYM : ultimo;
  save(); closeForm(); render();
  showUndo(`${plural(recs.length, 'lançamento importado', 'lançamentos importados')} da planilha`, () => {
    loteTira(id); db.imports = db.imports.filter(x => x.id !== id); save(); render(); });
}
