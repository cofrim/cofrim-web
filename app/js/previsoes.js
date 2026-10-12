// Cofrim — Previsões de gastos: cálculos (quanto falta, reserva no saldo previsto) e os avisos (80%, passou,
// encerramento…). Depende de dados.js.
// Saiu de js/dados.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Previsões de gastos ----------
// Gasto ESPERADO numa categoria até um dia do mês (o orçamento é um limite e só avisa; a previsão entra nos valores
// projetados). db.previsoes: {id, cat, mes, value, dia, rep, ex, ate}. Uma que se repete vale do mês dela em diante (até
// "ate"), calculada a cada mês, sem cópia gravada; ex guarda o que mudou ou saiu num mês só. Uma por categoria e mês.
function previsoesDoMes(m){
  return cached('P' + m, () => {
    const por = {};
    for (const p of db.previsoes){
      if (!(p.mes === m || (p.rep && p.mes < m && (!p.ate || m <= p.ate)))) continue;
      const e = (p.ex || {})[m] || {};
      if (e.del || (por[p.cat] && por[p.cat].p.mes > p.mes)) continue; // duas na mesma categoria: vale a mais recente
      por[p.cat] = {p, m, cat:p.cat, value:e.value || p.value, dia:Math.min(e.dia || p.dia, daysIn(m))}; // dia 31 em fevereiro = 28 ou 29
    }
    return Object.values(por);
  });
}
// Lançamentos que contam: gastos da categoria do dia 1 até o dia final, pela data da aba Gastos (diaDe: fixos pelo
// vencimento, parcelas pelo dia delas, crédito pela data da compra).
const prevLanc = it => expensesOf(it.m).filter(x => x.cat === it.cat && diaDe(x, it.m) <= it.dia);
const prevGasto = it => round2(sum(prevLanc(it), x => x.value));
// Ainda vale o previsto? Mês futuro, sim; mês passado, não; no mês atual, até o dia final (inclusive).
const prevAtiva = (it, hoje = today()) => it.m > hoje[0] || (it.m === hoje[0] && hoje[1] <= it.dia);
// Quanto as previsões somam ao total PROJETADO de gastos do mês: só o que falta gastar do previsto, enquanto a previsão
// vale (o já gasto está nos totais e não conta duas vezes). Não mexe no saldo real das contas nem nos gastos feitos.
const reservaPrevisoes = (m, hoje = today()) => round2(sum(previsoesDoMes(m), it => prevAtiva(it, hoje) ? Math.max(0, it.value - prevGasto(it)) : 0));
const totalOutPrev = ym => round2(totalOut(ym) + reservaPrevisoes(ym));
// Do mês atual até m: o que as previsões tiram do saldo das contas no fim de m (projetado).
const reservaAte = m => { let t = 0; for (let k = curYM; k <= m; k = addMonths(k, 1)) t += reservaPrevisoes(k); return round2(t); };
const prevInclui = v => v > 0 ? `inclui ${fmt(v)} de previsões` : '';
// Avisos das previsões: os pontos marcados em Configurações › Lembretes (prevPontos: 50%, 80%, 90%, chegou no previsto,
// passou do previsto e o encerramento; os padrões são 80%, passou e encerramento), uma vez por previsão, mês e ponto. Se
// o gasto pula vários pontos de uma vez, avisa só o maior e marca os menores como vistos. As marcas guardadas antes da
// 1.90 continuam valendo (sufixos 80, 100 = passou e fim). Conferido ao abrir, ao voltar ao app e ao salvar. O que já foi avisado fica guardado neste
// aparelho (na
// demonstração, só na memória), para não repetir ao reabrir ou sincronizar. O encerramento descoberto dias depois leva o
// horário do fim do dia final (23:59). Olha o mês atual e o anterior (app fechado por muito tempo).
const PREV_AVISOS_KEY = 'financas-prev-avisos';
let prevAvisosDemo = {};
function prevAvisosLer(){ if (demoOn) return prevAvisosDemo; try { return JSON.parse(localStorage.getItem(PREV_AVISOS_KEY)) || {}; } catch(e){ return {}; } }
function prevAvisosGuardar(o){ if (demoOn){ prevAvisosDemo = o; return; } try { localStorage.setItem(PREV_AVISOS_KEY, JSON.stringify(o)); } catch(e){} }
// Sufixo guardado de cada ponto (passou continua "100", como antes da 1.90).
const PREV_MARCA = {'50':'50', '70':'70', '80':'80', '90':'90', chegou:'chegou', passou:'100', fim:'fim'};
const prevPontos = () => Array.isArray(db.prefs.prevPontos) ? db.prefs.prevPontos : PREV_PONTOS_PADRAO;
function prevAvisosNovos(hoje = today()){
  const vistos = prevAvisosLer(), novos = [], velho = addMonths(hoje[0], -3), pontos = prevPontos();
  for (const k of Object.keys(vistos)) if (k.split(':')[1] < velho) delete vistos[k];
  for (const m of [addMonths(hoje[0], -1), hoje[0]]) for (const it of previsoesDoMes(m)){
    const k = it.p.id + ':' + m + ':', nome = prevNome(it.cat), g = prevGasto(it), dif = round2(g - it.value), dest = {k:'prev', id:it.p.id, m};
    if (!prevAtiva(it, hoje)){
      if (vistos[k + 'fim']) continue;
      for (const p of Object.values(PREV_MARCA)) vistos[k + p] = 1;
      if (!pontos.includes('fim')) continue;
      const [y, mo] = m.split('-').map(Number);
      novos.push({t:new Date(y, mo - 1, it.dia, 23, 59).getTime(), tipo:dif > 0 ? 'aviso' : 'sucesso', dest,
        txt:dif < 0 ? `Previsão de ${nome} encerrada: você gastou ${fmtTexto(g)} de ${fmtTexto(it.value)}. Sobraram ${fmtTexto(-dif)}, e o valor do mês foi atualizado.`
          : dif > 0 ? `Previsão de ${nome} encerrada: você gastou ${fmtTexto(g)}, ${fmtTexto(dif)} acima do previsto. O valor do mês foi atualizado.`
          : `Previsão de ${nome} encerrada: você gastou exatamente o previsto.`});
    } else if (m === hoje[0]){
      const pct = g / it.value * 100;
      const alcancados = pontosAlcancados(pct);
      const topo = alcancados.filter(p => pontos.includes(p)).pop();
      if (!topo || vistos[k + PREV_MARCA[topo]]) continue;
      for (const p of alcancados) vistos[k + PREV_MARCA[p]] = 1;
      novos.push({t:Date.now(), tipo:'aviso', dest,
        txt:topo === 'passou' ? `Previsão de ${nome}: você passou do previsto. Gastou ${fmtTexto(g)} de ${fmtTexto(it.value)}, ${fmtTexto(dif)} acima.`
        : topo === 'chegou' ? `Previsão de ${nome}: você chegou no previsto (${fmtTexto(it.value)}).`
        : `Previsão de ${nome}: você já gastou ${Math.round(pct)}% do previsto (${fmtTexto(g)} de ${fmtTexto(it.value)}).`});
    }
  }
  prevAvisosGuardar(vistos);
  return novos.sort((a, b) => a.t - b.t);
}
// Pontos (50%, 70%, 80%, 90%, chegou, passou) que um valor já alcançou; os avisos de valor usam os escolhidos.
const pontosAlcancados = pct => ['50', '70', '80', '90', 'chegou', 'passou'].filter(p => p === 'passou' ? pct > 100 : p === 'chegou' ? pct >= 100 : pct >= +p);
const pontosDe = tipo => Array.isArray(db.prefs[tipo + 'Pontos']) ? db.prefs[tipo + 'Pontos'] : PONTOS_PADRAO[tipo];
const AVISO_TITULO = {orc:'Orçamento', cartao:'Limite do cartão', meta:'Meta'};
// Avisa o ponto mais alto já alcançado entre os escolhidos, uma vez só (os de baixo ficam como vistos): no sino e, com o
// tipo ligado em Configurações › Lembretes (Android), como notificação no celular.
function avisoPonto(vistos, tipo, chave, pct, texto, dest, tipoSino = 'aviso'){
  const al = pontosAlcancados(pct), topo = al.filter(p => pontosDe(tipo).includes(p)).pop();
  if (!topo || vistos[chave + PREV_MARCA[topo]]) return;
  for (const p of al) vistos[chave + PREV_MARCA[p]] = 1;
  const txt = texto(topo); centralAdd(txt, tipoSino, 0, dest);
  if (temNativo('notificar') && podeNotificar(tipo)) nativo('notificar', AVISO_TITULO[tipo], txt);
}
// Avisos de valor: orçamento de cada categoria e limite de cada cartão (no mês atual) e quanto já foi guardado nas metas.
function avisosDeValor(hoje = today()){
  const vistos = prevAvisosLer(), m = hoje[0], de = (x, y) => `${fmtTexto(x)} de ${fmtTexto(y)}`;
  for (const b of budgetStatus(m)){
    const nome = (CAT_GASTO[b.cat] || CAT_GASTO.outros)[1];
    avisoPonto(vistos, 'orc', 'orc:' + m + ':' + b.cat + ':', b.pct, p => p === 'passou' ? `Orçamento de ${nome} estourou: ${de(b.used, b.lim)}.`
      : p === 'chegou' ? `Orçamento de ${nome}: chegou no limite (${fmtTexto(b.lim)}).`
      : `Orçamento de ${nome}: ${Math.round(b.pct)}% do limite usado (${de(b.used, b.lim)}).`, {k:'orc', m});
  }
  for (const [banco, lim] of Object.entries(db.cardLimit || {})) if (lim > 0){
    const u = cardUsed(banco), pct = u / lim * 100;
    avisoPonto(vistos, 'cartao', 'cartao:' + m + ':' + banco + ':', pct, p => p === 'passou'
      ? `Cartão ${banco}: passou do limite (${de(u, lim)} comprometidos).` : p === 'chegou' ? `Cartão ${banco}: chegou no limite (${fmtTexto(lim)}).`
      : `Cartão ${banco}: ${Math.round(pct)}% do limite comprometido (${de(u, lim)}).`, {k:'gastos', sub:'mes', m});
  }
  // Metas não acabam no mês: a chave usa um mês que nunca é apagado da lista de vistos.
  for (const g of db.goals) if (g.target > 0){
    const pct = g.saved / g.target * 100;
    avisoPonto(vistos, 'meta', 'meta:9999-12:' + g.id + ':', pct, p => p === 'passou' ? `Meta ${g.name}: passou da meta (${de(g.saved, g.target)}).`
      : p === 'chegou' ? `Meta ${g.name} alcançada: ${fmtTexto(g.target)} guardados!`
      : `Meta ${g.name}: ${Math.round(pct)}% guardado (${de(g.saved, g.target)}).`,
      {k:'invest'}, 'sucesso');
  }
  prevAvisosGuardar(vistos);
}
// Metas com depósito automático: a cada mês, no dia escolhido, soma o valor ao guardado (sem passar da meta) e avisa na
// central. Mês que passou com o app fechado entra na próxima abertura. Começa no mês em que foi ligado (ou no próximo, se o
// dia já passou).
function metasAuto(){
  const [m0, d0] = today(), feitos = [];
  for (const g of db.goals){
    const v = +g.auto || 0, dia = g.autoDia || 1;
    if (!(v > 0)) { delete g.autoProx; continue; }
    if (!g.autoProx) { g.autoProx = d0 <= dia ? m0 : addMonths(m0, 1); touch(g); }
    let n = 0, total = 0;
    while (g.saved < g.target && (g.autoProx < m0 || (g.autoProx === m0 && d0 >= dia))){
      const antes = g.saved; g.saved = round2(Math.min(g.target, g.saved + v)); total = round2(total + g.saved - antes); n++;
      g.autoProx = addMonths(g.autoProx, 1);
    }
    if (n){ touch(g); feitos.push(`Meta ${g.name}: ${fmtTexto(total)} guardados automaticamente${n > 1 ? ` (${n} meses)` : ''}.`); }
  }
  if (!feitos.length) return;
  save(); for (const t of feitos) centralAdd(t, 'sucesso', 0, {k:'invest'});
}
function prevAvisos(){
  metasAuto();
  avisosDeValor();
  const novos = prevAvisosNovos();
  if (!novos.length) return novos;
  // Cada um vai para a central de notificações com o horário do acontecimento; na tela, só o último (ou quantos foram).
  for (const a of novos){
    centralAdd(a.txt, a.tipo, a.t, a.dest);
    if (temNativo('notificar') && podeNotificar('prev')) nativo('notificar', 'Previsão de gastos', a.txt);
  }
  toast(novos.length === 1 ? novos[0].txt : `${novos.length} avisos das suas previsões de gastos.`, {central:false});
  return novos;
}
