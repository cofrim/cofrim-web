// Cofrim — Saúde financeira: a nota de 0 a 100, o bloco da aba Gastos e a tela "Detalhe da análise". Depende de
// dados.js e telas.js.
// Saiu de js/telas.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Saúde financeira (bloco da aba Gastos e tela "Detalhe da análise") ----------
// Nota de 0 a 100 calculada na hora com os dados do mês (nada é gravado). Cada componente vai de 0 a 100 e tem um peso;
// componente sem dados suficientes fica de fora e o peso dele se divide entre os outros. Com menos de 3 componentes
// com dados, não há nota (semDados). calcSaude não mexe na tela: lê os dados pelos mesmos cálculos das outras telas.
const SAUDE_FAIXAS = [[80, 'Excelente', 'var(--in)'], [60, 'Boa', 'var(--brand)'], [40, 'Regular', 'var(--yield)'], [0, 'Atenção', 'var(--out)']];
const saudeFaixa = n => SAUDE_FAIXAS.find(f => n >= f[0]);
const numBR = (v, casas = 1) => v.toLocaleString('pt-BR', {maximumFractionDigits:casas});
// Linear entre "ruim" (0) e "bom" (100), limitado aos dois.
const escala = (v, ruim, bom) => Math.round(Math.max(0, Math.min(1, (v - ruim) / (bom - ruim))) * 100);
function calcSaude(ym){
  return cached('S' + ym, () => {
    const meses3 = [0, 1, 2].map(i => addMonths(ym, -i)), tin = totalIn(ym), tout = totalOutPrev(ym); // com o que falta das previsões
    const fim = ym < curYM ? [ym, daysIn(ym)] : today(); // saldo das contas no fim do mês (ou hoje, no mês atual)
    const C = [];
    const comp = (k, nome, peso, nota, frase, curta, dica, ativar) => C.push({k, nome, peso, nota, frase, curta, dica, ativar});
    // Poupança: (ganhos − gastos) ÷ ganhos; 20% ou mais = 100.
    const taxa = tin > 0 ? (tin - tout) / tin * 100 : null;
    comp('poupanca', 'Poupança', 22, taxa == null ? null : escala(taxa, 0, 20), taxa == null ? '' : `Taxa de poupança em ${numBR(taxa)}% (referência: 20%).`,
      taxa == null ? '' : taxa <= 0 ? 'Seus gastos passaram dos ganhos neste mês' : `Você guardou ${numBR(taxa)}% dos ganhos`,
      'Tente separar uma parte dos ganhos assim que eles entram, antes de gastar.', 'Lance os ganhos do mês.');
    // Reserva: saldo das contas ÷ média de gastos dos últimos 3 meses; 6 meses ou mais = 100.
    const media = sum(meses3, totalOut) / 3, saldo = sum(db.accounts, a => accountBalance(a, fim)),
    cobre = db.accounts.length && media > 0 ? Math.max(0, saldo) / media : null;
    comp('reserva', 'Reserva', 20, cobre == null ? null : escala(cobre, 0, 6),
      cobre == null ? '' : `Cobre ${numBR(cobre)} ${cobre === 1 ? 'mês' : 'meses'} de despesas (alvo: 3 a 6).`,
      cobre == null ? '' : `Sua reserva cobre ${numBR(cobre)} ${cobre === 1 ? 'mês' : 'meses'} de despesas`,
      'Guarde um pouco todo mês numa conta separada até juntar de 3 a 6 meses de gastos.', 'Cadastre suas contas bancárias com o saldo (Investir › Contas).');
    // Dívidas: vale a pior de três medidas. Uso do limite do cartão (fatura do mês ÷ limite) e compras parceladas do mês
    // seguinte ÷ renda: até 30% = 100, 100% ou mais = 0. Parcelas de financiamentos e empréstimos do mês seguinte ÷ renda:
    // até 30% = 100, 60% ou mais = 0.
    const lims = Object.entries(db.cardLimit || {}).filter(([, l]) => l > 0), fat = Object.fromEntries(invoices(ym));
    const uso = lims.length ? sum(lims, ([b]) => fat[b] || 0) / sum(lims, ([, l]) => l) * 100 : null;
    const renda = sum(meses3, totalIn) / 3, prox = expensesOf(addMonths(ym, 1)).filter(x => x.kind === 'installment' && !x.abat);
    const fins = new Set(db.installments.filter(isFin).map(p => p.id)), ehFin = x => fins.has(x.pid || x.id);
    const pesoParc = renda > 0 && db.installments.some(p => !isFin(p)) ? sum(prox.filter(x => !ehFin(x)), x => x.value) / renda * 100 : null;
    const pesoFin = renda > 0 && fins.size ? sum(prox.filter(ehFin), x => x.value) / renda * 100 : null;
    const notas = [[uso, 100], [pesoParc, 100], [pesoFin, 60]].filter(([v]) => v != null).map(([v, ruim]) => escala(v, ruim, 30));
    comp('dividas', 'Dívidas', 20, notas.length ? Math.min(...notas) : null,
      [uso != null && `Uso do cartão em ${numBR(uso)}% do limite.`, pesoParc != null && `Compras parceladas do mês que vem: ${numBR(pesoParc)}% da renda.`,
        pesoFin != null && `Financiamentos e empréstimos: ${numBR(pesoFin)}% da renda.`].filter(Boolean).join(' '),
      pesoFin != null && escala(pesoFin, 60, 30) === Math.min(...notas) ? `Financiamentos e empréstimos levam ${numBR(pesoFin)}% da renda`
        : uso != null ? `O cartão usa ${numBR(uso)}% do limite` : `As parcelas levam ${numBR(pesoParc || 0)}% da renda`,
      'Use menos de 30% do limite do cartão e evite novas compras parceladas até as atuais terminarem.',
      'Informe o limite do cartão (Gastos › Faturas do cartão).');
    // Investimentos: quanto entra por mês nos investimentos (aportes mensais cadastrados ÷ renda; 10% ou mais = 100) e
    // quanto já está investido (total hoje ÷ média de gastos; 12 meses de gastos ou mais = 100). Vale a média das duas.
    const aporte = sum(db.investments, x => x.monthly || 0), investido = sum(db.investments, x => x.value || 0);
    const taxaInv = db.investments.length && renda > 0 ? aporte / renda * 100 : null, mesesInv = db.investments.length && media > 0 ? investido / media : null;
    const notasInv = [taxaInv != null && escala(taxaInv, 0, 10), mesesInv != null && escala(mesesInv, 0, 12)].filter(v => v !== false);
    comp('investimentos', 'Investimentos', 15, notasInv.length ? Math.round(sum(notasInv, v => v) / notasInv.length) : null,
      [taxaInv != null && `Aportes de ${numBR(taxaInv)}% da renda por mês (referência: 10%).`,
        mesesInv != null && `Investido o equivalente a ${numBR(mesesInv)} ${mesesInv === 1 ? 'mês' : 'meses'} de gastos (alvo: 12).`].filter(Boolean).join(' '),
      taxaInv != null && taxaInv < 10 && (mesesInv == null || escala(taxaInv, 0, 10) <= escala(mesesInv, 0, 12)) ? `Você investe ${numBR(taxaInv)}% da renda por mês` : mesesInv != null ? `Seus investimentos cobrem ${numBR(mesesInv)} ${mesesInv === 1 ? 'mês' : 'meses'} de gastos` : `Você investe ${numBR(taxaInv || 0)}% da renda por mês`,
      'Depois da reserva, invista todo mês uma parte fixa da renda (10% é um bom começo), de preferência no dia em que o dinheiro entra.',
      'Cadastre seus investimentos e o aporte mensal (aba Investir).');
    // Orçamento: categorias com orçamento dentro do limite no mês.
    const orc = budgetStatus(ym), dentro = orc.length ? orc.filter(b => b.pct <= 100).length / orc.length * 100 : null;
    comp('orcamento', 'Orçamento', 13, dentro == null ? null : Math.round(dentro),
      dentro == null ? '' : `${numBR(dentro, 0)}% dos orçamentos dentro do limite.`,
      dentro == null ? '' : `${numBR(dentro, 0)}% dos orçamentos ficaram dentro do limite`,
      'Reveja as categorias que estouraram: ajuste o limite ou corte um pouco nelas.', 'Defina um orçamento por categoria (Gastos › Orçamento do mês).');
    // Regularidade: dias do mês (até hoje) com pelo menos um lançamento.
    const lanc = [...incomesOf(ym), ...expensesOf(ym)], ate = ym === curYM ? now.getDate() : ym < curYM ? daysIn(ym) : 0;
    const dias = new Set(lanc.map(x => diaDe(x, ym)).filter(d => d >= 1 && d <= ate)), reg = lanc.length && ate ? dias.size / ate * 100 : null;
    comp('regularidade', 'Regularidade', 6, reg == null ? null : Math.round(reg), reg == null ? '' : `Lançamentos em ${numBR(reg, 0)}% dos dias do mês.`,
      reg == null ? '' : `Você lançou algo em ${numBR(reg, 0)}% dos dias do mês`,
      'Anote os gastos no dia em que acontecem: leva segundos e deixa a análise mais certa.', 'Lance seus gastos do mês.');
    // Fontes de renda: descrições diferentes de ganhos nos últimos 3 meses; 3 ou mais = 100, 2 = 70, 1 = 40, 0 = 0.
    const fontes = new Set(meses3.flatMap(incomesOf).map(x => plain(String(x.desc || x.cat || '').trim()))).size;
    comp('fontes', 'Fontes de renda', 4, [0, 40, 70, 100][Math.min(fontes, 3)],
      `${fontes} ${fontes === 1 ? 'fonte de renda registrada' : 'fontes de renda registradas'}.`,
      `${fontes} ${fontes === 1 ? 'fonte de renda registrada' : 'fontes de renda registradas'}`,
      'Uma renda extra (um trabalho por fora, aluguel, dividendos) deixa você menos dependente de uma fonte só.', '');
    const com = C.filter(c => c.nota != null), peso = sum(com, c => c.peso);
    if (com.length < 3) return {semDados:true, componentes:C};
    const nota = Math.round(sum(com, c => c.nota * c.peso) / peso), fraco = [...com].sort((a, b) => a.nota - b.nota || b.peso - a.peso)[0];
    return {semDados:false, nota, faixa:saudeFaixa(nota)[1], cor:saudeFaixa(nota)[2], fraco, componentes:C};
  });
}
const SAUDE_VAZIO = 'Lance seus ganhos e gastos para ver sua saúde financeira.';
function saudeBloco(m){
  const r = calcSaude(m);
  return `<h2>Saúde financeira</h2><div class="card saude" data-onclick="abrirSaude()">${r.semDados ? `<div class="hint u-m0">${SAUDE_VAZIO}</div>`
    : `<div class="saudeTopo"><div class="saudeNota" style="color:${r.cor}">${r.nota}<small>/100</small></div><div><b style="color:${r.cor}">${r.faixa}</b><small>${esc(r.fraco.curta)}</small></div></div>`}
    <div class="saudeVer">Ver detalhe da análise ${I('chev', 14)}</div></div>`;
}
function abrirSaude(){ state.gsub = 'saude'; renderIn(); scrollTo(0, 0); }
function fecharSaude(){ state.gsub = 'mes'; renderIn(); scrollTo(0, 0); }
function viewSaude(){
  const m = state.month, r = calcSaude(m), ant = addMonths(m, -1), ra = calcSaude(ant);
  const dif = !r.semDados && !ra.semDados ? r.nota - ra.nota : null;
  const topo = `<h1><span class="volta"><button class="iconbtn" data-onclick="fecharSaude()" aria-label="Voltar para Gastos">‹</button>Detalhe da análise</span></h1>`;
  if (r.semDados) return `${topo}<div class="card"><div class="hint u-m0">${SAUDE_VAZIO}</div></div>${saudeItens(r)}`;
  return `${topo}
  <div class="card saude"><div class="saudeTopo"><div class="saudeNota" style="color:${r.cor}">${r.nota}<small>/100</small></div><div><b style="color:${r.cor}">${r.faixa}</b>
    ${dif != null ? `<small>${dif > 0 ? '+' : ''}${dif === 0 ? 'Igual a' : dif + ' desde'} ${monthName(ant).split(' ')[0]}</small>` : ''}</div></div>
    <div class="hint" style="margin:8px 0 0">Analisado em ${fmtDate(new Date().toLocaleDateString('sv'))} · análise local · ${monthName(m)}</div></div>
  ${saudeItens(r)}`;
}
const saudeItens = r => `<h2>Composição do score</h2><div class="card">${r.componentes.map(c => c.nota == null
  ? `<div class="catrow"><div class="top"><span>${c.nome}</span><b class="muted">Sem dados suficientes</b></div>${c.ativar ? `<div class="hint u-mt2">${c.ativar}</div>` : ''}</div>`
  : `<div class="catrow"><div class="top"><span>${c.nome}</span><b style="color:${saudeFaixa(c.nota)[2]}">${c.nota}</b></div>
    <div class="bar" style="margin:6px 0"><i style="width:${c.nota}%;background:${saudeFaixa(c.nota)[2]}"></i></div><div class="semTopo hint">${esc(c.frase)}</div>
    ${c.nota < 60 ? `<div class="hint saudeDica">${I('sparkle', 13)} ${c.dica}</div>` : ''}</div>`).join('')}</div>
  <div class="hint u-centro">Pesos: poupança 25, reserva 25, dívidas 20, orçamento 15, regularidade 10 e fontes de renda 5. O que está sem dados fica de fora da conta.</div>`;
