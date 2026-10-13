// Cofrim — Rendimento e projeção dos investimentos e a virada de mês (rollover). Depende de dados.js.
// Saiu de js/previsoes.js (só mudou de arquivo); carregado logo depois dele no index.html.

function annualRate(inv){
  const r = db.rates, p = inv.pct/100;
  if (inv.index === 'cdi') return r.cdi/100 * p;
  if (inv.index === 'selic') return r.selic/100 * p;
  if (inv.index === 'ipca') return (1 + r.ipca/100) * (1 + p) - 1;
  return p;
}
const monthlyRate = inv => Math.pow(1 + annualRate(inv), 1/12) - 1;
function projection(inv){
  const r = annualRate(inv), i = monthlyRate(inv), a = inv.monthly || 0;
  return inv.value * (1+r) + (i ? a * (Math.pow(1+i,12) - 1) / i : a*12);
}
// Rendimento estimado dos investimentos em um mês, com as taxas atuais e os aportes mensais.
// Meses passados usam o valor anotado em db.yieldLog (ver save); antes do primeiro uso do app, zero.
function yieldOf(ym){
  const k = monthDiff(ym, curYM);
  if (k < 0) return db.yieldLog[ym] || 0;
  return sum(db.investments.filter(inv => !inv.ticker), inv => { // ações e moedas não têm rendimento projetado
    const i = monthlyRate(inv), g = Math.pow(1+i, k), a = inv.monthly || 0;
    return (inv.value * g + (i ? a * (g - 1) / i : a*k)) * i;
  });
}

// Virada de mês: o que o app atualiza sozinho. Roda ao abrir, ao voltar para a tela e após sincronizar.
// - Parcelas: as parcelas dos meses que já passaram contam como pagas (o botão fica para correções).
// - Renda fixa: o valor recebe o rendimento do mês e o aporte mensal, mês a mês.
// Não marca os registros como editados (touch): um aparelho que ficou dias sem sincronizar roda isto ao abrir, antes
// de juntar com a nuvem, e a cópia velha dele passaria a ser "a mais nova", desfazendo o que foi feito nos outros. As
// contas daqui saem das mesmas informações (autoYM, accYM) e são refeitas depois de cada junção.
function rollover(){
  let changed = false;
  const hadLog = {...db.yieldLog};
  for (const p of db.installments){
    if (!p.autoYM){ p.autoYM = curYM; continue; } // registro novo ou de versão antiga: começa a contar daqui
    if (p.autoYM >= curYM) continue;
    const expected = Math.max(0, Math.min(p.n, monthDiff(curYM, p.start)));
    if (expected > p.paid) p.paid = expected;
    p.autoYM = curYM; changed = true;
  }
  for (const v of db.investments){
    if (v.ticker) continue; // ações e moedas seguem a cotação
    if (!v.accYM){ v.accYM = curYM; continue; }
    if (v.accYM >= curYM) continue;
    const i = monthlyRate(v);
    for (let m = v.accYM; m < curYM; m = addMonths(m, 1)){
      if (!(m in hadLog)) db.yieldLog[m] = (db.yieldLog[m] || 0) + v.value * i; // mês em que o app não foi aberto
      v.value = v.value * (1 + i) + (v.monthly || 0);
    }
    v.value = round2(v.value);
    v.accYM = curYM; changed = true;
  }
  if (changed) save();
  return changed;
}
