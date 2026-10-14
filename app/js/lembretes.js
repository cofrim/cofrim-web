// Cofrim — Lembretes deste aparelho (interruptor, permissão de notificações) e o widget (updateWidget). Depende de
// dados.js e parcelas.js.
// Saiu de js/dados.js (só mudou de arquivo); carregado logo depois dele no index.html.

// ---------- Lembretes: interruptor deste aparelho ----------
// "Lembretes ativos neste aparelho" fica só no aparelho (no APK, nas preferências nativas; no navegador, no localStorage):
// nunca nos dados da conta, no backup, na sincronização ou na conta compartilhada. Uma notificação só é agendada ou
// mostrada com ele ligado E com aquele tipo de aviso ligado nas preferências da conta (db.prefs). O lado nativo confere
// o mesmo interruptor antes de mostrar qualquer notificação (ReminderReceiver.ligado).
const LEMB_KEY = 'financas-lembretes-aparelho', LEMB_AVISO = 'financas-lembretes-aviso';
// '1' ligado, '0' desligado, '' ainda não decidido (só até lembMigrar rodar).
function aparelhoLemb(){
  if (temNativo('lembretesAparelho')) return nativo('lembretesAparelho');
  try { return localStorage.getItem(LEMB_KEY) || ''; } catch(e){ return ''; }
}
function setAparelhoLemb(on){
  if (temNativo('setLembretesAparelho')) nativo('setLembretesAparelho', !!on);
  else try { localStorage.setItem(LEMB_KEY, on ? '1' : '0'); } catch(e){}
}
// Android 13 ou mais novo: as notificações precisam da permissão (retirada nas configurações, o interruptor aparece desligado).
const notifLiberada = () => !(temNativo('notificacaoLiberada')) || nativo('notificacaoLiberada');
const lembLigados = () => aparelhoLemb() === '1' && notifLiberada();
// Preferências da conta que geram notificação: contas a vencer, parcelas de financiamentos e empréstimos, orçamento perto do
// limite (orc), limite do cartão (cartao), metas (meta), alertas de preço
// dos investimentos e avisos da conta compartilhada.
const lembTipos = p => ({contas:!!p.notify, fin:!!(p.notifyFin ?? p.notify), prev:!!(p.notifyPrev ?? p.notify), orc:!!(p.notifyOrc ?? p.notify),
  cartao:!!(p.notifyCartao ?? p.notify), meta:!!(p.notifyMeta ?? p.notify),
  preco:db.investments.some(v => v.ticker && (v.alertUp || v.alertDown)),
  compart:!!sync.shared && p.avisoComp !== false});
// Decide se um tipo de aviso pode virar notificação: com o interruptor do aparelho desligado, sempre não.
const podeNotificar = tipo => !demoOn && lembLigados() && !!lembTipos(db.prefs)[tipo];
// Primeira abertura desta versão: instalação nova começa desligada (mesmo entrando numa conta com lembretes); quem
// atualizou o app (havia dados neste aparelho) continua como estava: ligado se já tinha algum lembrete ativo.
function lembMigrar(antes = dadosNoAparelho){
  if (aparelhoLemb() !== '') return;
  setAparelhoLemb(antes && Object.values(lembTipos(db.prefs)).some(Boolean));
}
function scheduleReminders(){
  if (demoOn) return;
  if (!(temNativo('lembretes'))) return;
  const p = db.prefs, list = [], oinc = p.fun && !p.skin ? 'Oinc! ' : ''; // com tema especial, o mascote não é o porquinho
  if (!lembLigados()) return void nativoSeMudou('lembretes', '[]'); // interruptor do aparelho desligado: nada agendado
  if (podeNotificar('contas')) for (const x of db.expenses){
    if (!x.fixed || !x.due || p.notifyCats[x.cat] === false) continue;
    for (const m of [curYM, addMonths(curYM, 1), addMonths(curYM, 2)]){
      if (!activeIn(x, m) || isPaid(x, m)) continue;
      const [y, mo] = m.split('-').map(Number), d = dueDay(x, m), at = new Date(y, mo - 1, d, 9, 0).getTime();
      const dm = String(d).padStart(2,'0') + '/' + String(mo).padStart(2,'0');
      for (const days of p.reminds) list.push({id:hashId(x.id + m + 'a' + days), at:at - days*864e5,
        title:oinc + 'Conta a vencer', text:`${x.desc} (${fmt(x.value)}) vence em ${days} dia${days > 1 ? 's' : ''}, em ${dm}.`});
      list.push({id:hashId(x.id + m + 'b'), at, title:oinc + 'Conta vence hoje',
        text:`${x.desc} (${fmt(x.value)}) vence hoje, ${dm}.`});
    }
  }
  // Financiamentos e empréstimos com dia de vencimento: aviso no dia, por volta das 9h, das próximas parcelas.
  if (podeNotificar('fin')) for (const q of db.installments){
    if (!isFin(q) || !q.due) continue;
    for (let j = q.paid; j < Math.min(q.n, q.paid + 3); j++){
      const v = parcVenc(q, j), [y, mo] = v.ym.split('-').map(Number);
      list.push({id:hashId(q.id + j + 'f'), at:new Date(y, mo - 1, v.dia, 9, 0).getTime(), title:oinc + 'Parcela vence hoje',
        text:`${q.desc}: parcela ${j + 1}/${q.n} (${fmt(parcVal(q, j))}) vence hoje, ${fmtDate(vencData(v)).slice(0, 5)}.`});
    }
  }
  nativoSeMudou('lembretes', JSON.stringify(list.filter(n => n.at > Date.now()).sort((a,b) => a.at - b.at).slice(0, 60)));
}
// Envia ao lado nativo só o que mudou desde o último envio nesta abertura: o widget e os alarmes eram refeitos a cada
// gravação, mesmo iguais (no Android, redesenhar 6 widgets e reagendar até 60 alarmes).
const nativoEnviado = {};
function nativoSeMudou(k, texto, enviar = () => nativo(k, texto)){ if (nativoEnviado[k] === texto) return; nativoEnviado[k] = texto; enviar(); }

// Widget da tela inicial (só no APK): entrega ao lado nativo os números do mês atual, já formatados.
function updateWidget(){
  if (!(temNativo('widget')) || demoOn) return;
  const tin = totalIn(curYM), tout = totalOut(curYM), m = monthName(curYM), humor = funMood(), saldoPrev = tin - totalOutPrev(curYM);
  // O saldo dos widgets é o previsto (como no Resumo): com previsões, diz isso e quanto delas está incluído, para a conta
  // com os ganhos e gastos realizados fechar.
  const reserva = reservaPrevisoes(curYM), mesNome = m.split(' ')[0];
  const frase = {feliz:db.prefs.skin ? 'Mês no azul' : 'Oinc! Mês no azul', ok:'Tudo sob controle', triste:'Segura o cartão…'}[humor];
  const semSimbolo = s => s.replace(moeda.simbolo, '').replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '').replace(/^-[\s\u00A0]+/, '-');
  const curto = v => semSimbolo(fmt(v)).replace(/,\d+$/, ''); // sem o símbolo nem centavos: cabe no widget de saldo, que é estreito
  const json = widgetMascara(JSON.stringify({mes:m[0].toUpperCase() + m.slice(1), saldo:fmt(saldoPrev), negativo:saldoPrev < 0,
    saldoRot:(reserva ? 'Saldo previsto de ' : 'Saldo de ') + mesNome, prevTxt:prevInclui(reserva), ganhos:fmt(tin), gastos:fmt(tout),
    ganhosC:curto(tin), gastosC:curto(tout),
    fun:!!db.prefs.fun, frase, linhas:widgetLines(), pig:db.prefs.widgetPig ?? !!db.prefs.fun, humor, skin:db.prefs.skin || '',
    // cor = cor do app (o fundo dos widgets acompanha); fundo = 'tema' (cor ou tema especial) ou 'escuro'; pct = gastos sobre ganhos.
    cor:db.prefs.color, fundo:db.prefs.widgetFundo || 'tema', pct:tin > 0 ? Math.min(100, Math.round(tout / tin * 100)) : tout > 0 ? 100 : 0,
    ...widgetGastos(), ...widgetContas(), sugs:widgetSugs(), ts:0, // ts entra no envio (a comparação ignora a hora)
    // Números curtos do tamanho 1x1 (sem o símbolo da moeda): saldo, quantas contas vencem e o total da lista de gastos.
    saldoC:semSimbolo(fmtCurto(saldoPrev)), contasN:upcomingBills().length ? String(upcomingBills().length) : '',
    contas:upcomingBills().slice(0, 12).map(b => ({t:b.x.desc,
      s:b.diff < 0 ? 'atrasada' : b.diff === 0 ? 'vence hoje' : 'vence dia ' + dueDay(b.x, curYM), v:fmt(b.x.value), c:b.diff <= 0 ? 'out' : '',
      k:(CAT_GASTO[b.x.cat] || CAT_GASTO.outros)[2]})),
    porco:{humor, frase, gastos:fmt(tout), sub:tin > 0 ? `gastos: ${Math.round(tout / tin * 100)}% dos ganhos` : 'gastos do mês'}}));
  nativoSeMudou('widget', json, () => nativo('widget', json.replace('"ts":0', '"ts":' + Date.now())));
}
// "Esconder valores nos widgets": o lado nativo esconde os valores em "R$"; com outra moeda, eles já vão escondidos daqui
// (o símbolo da moeda e os números curtos, que não têm símbolo).
function widgetMascara(json){
  if (moeda.cod === 'BRL' || !(temNativo('widgetOculto') && nativo('widgetOculto'))) return json;
  const sim = moeda.simbolo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const o = JSON.parse(json.replace(new RegExp('-?' + sim + '[\\s\\u00A0]*-?[\\d.,]*\\d', 'g'), MASK));
  for (const k of ['ganhosC', 'gastosC', 'saldoC']) if (o[k]) o[k] = '••••';
  return JSON.stringify(o);
}
// Widget "Mascote e gastos": as sugestões de gasto novas (as do Resumo), da mais nova para a mais antiga, até 10, com o
// valor ('' com "Esconder valores nos widgets" ou sem valor), a loja e o app. ts (junto dos dados) = hora do envio: o
// widget mostra também as que chegarem depois, lidas pelo lado nativo.
function widgetSugs(){
  if (!(temNativo('avisosLigado') && nativo('avisosLigado'))) return [];
  const oculto = !!(temNativo('widgetOculto') && nativo('widgetOculto'));
  return bankNotes().map(n => ({n, p:parseBankNote(n)})).filter(x => x.p).sort((a, b) => b.n.t - a.n.t).slice(0, 10)
    .map(({n, p}) => ({t:n.t, v:oculto || p.hidden ? '' : fmtTexto(p.value), d:p.hidden ? 'Novo aviso' : p.desc, a:bankName(n)}));
}
// Widget "Contas a vencer" sem conta nos próximos 7 dias e com espaço sobrando: a próxima conta fixa do mês depois
// disso e quantas contas fixas o mês tem, com o total.
function widgetContas(){
  const fixas = db.expenses.filter(x => x.fixed && x.due && activeIn(x, curYM)), hoje = now.getDate();
  const depois = fixas.filter(x => !isPaid(x, curYM) && dueDay(x, curYM) - hoje > 7).sort((a, b) => dueDay(a, curYM) - dueDay(b, curYM))[0];
  return {contasDepois:depois ? `Depois: ${depois.desc} · dia ${dueDay(depois, curYM)} · ${fmt(depois.value)}` : '',
    contasMes:fixas.length ? `${fixas.length} ${fixas.length > 1 ? 'contas fixas' : 'conta fixa'} no mês · ${fmt(sum(fixas, x => x.value))}` : ''};
}
// Widget "Gastos": a lista dos gastos do mês, como na aba Gastos. db.prefs.widgetLista = qual grupo ('' = todos) e
// db.prefs.widgetOrdem = 'valor' (maiores primeiro) ou '' (a ordem dos grupos do app). Vai até 40 linhas.
function widgetGastos(){
  const p = db.prefs, g = GRUPOS[p.widgetLista], todos = expensesOf(curYM);
  let l = g ? todos.filter(g[1]) : p.grpOrder.flatMap(k => todos.filter(GRUPOS[k][1]));
  if (p.widgetOrdem === 'valor') l = [...l].sort((a, b) => b.value - a.value);
  const m = monthName(curYM).split(' ')[0];
  return {listaTitulo:(g ? g[0] : 'Gastos') + ' de ' + m, listaC:l.length ? fmtCurto(sum(l, x => x.value)).replace(/^R\$\s?/, '') : '',
    listaSub:l.length ? `${l.length} ${l.length > 1 ? 'lançamentos' : 'lançamento'} · ${fmt(sum(l, x => x.value))}` : '',
    lista:l.slice(0, 40).map(x => { const c = CAT_GASTO[x.cat] || CAT_GASTO.outros;
      return {t:x.desc, s:c[1] + (x.kind === 'installment' ? ' · ' + parcTag(x) : x.fixed ? (repete(x) ? ' · ' + repTexto(x) : x.fixed === 'y' ? ' · anual' : isSub(x) ? ' · assinatura' : ' · fixo') : x.day ? ' · dia ' + x.day : ''), v:fmt(x.value), c:'out', k:c[2]}; })};
}
// Linhas do widget Resumo: as escolhidas em Configurações > Widgets, na ordem; as que não têm dado são puladas. [{t, v, c, s?}]; s = detalhe (no
// saldo, quanto das previsões está incluído)
function widgetLines(){
  const tin = totalIn(curYM), tout = totalOut(curYM), saldoPrev = tin - totalOutPrev(curYM); // saldo projetado: com as previsões
  const itens = {
    saldo:() => { const r = reservaPrevisoes(curYM);
      return [r ? 'Saldo previsto' : 'Saldo do mês', fmt(saldoPrev), saldoPrev < 0 ? 'out' : 'in', prevInclui(r)]; },
    ganhos:() => ['Ganhos', fmt(tin), 'in'],
    gastos:() => ['Gastos', fmt(tout), 'out'],
    conta:() => { const b = upcomingBills()[0];
      return b && [`${b.x.desc} · ${b.diff < 0 ? 'atrasada' : b.diff === 0 ? 'vence hoje' : 'em ' + b.diff + (b.diff > 1 ? ' dias' : ' dia')}`,
      fmt(b.x.value), b.diff <= 0 ? 'out' : '']; },
    contas:() => db.accounts.length && ['Saldo nas contas', fmt(sum(db.accounts, a => accountBalance(a))), ''],
    invest:() => db.investments.length && ['Investido', fmt(sum(db.investments, x => x.value)), ''],
    fatura:() => { const v = sum(invoices(curYM), i => i[1]); return v > 0 && ['Faturas do cartão', fmt(v), 'out']; },
    orcamento:() => { const b = budgetStatus(curYM), lim = sum(b, x => x.lim);
      return lim > 0 && ['Orçamento usado', Math.round(sum(b, x => x.used) / lim * 100) + '%', '']; },
    vales:() => temVales() && ['Saldo dos vales', fmt(sum(Object.keys(VALES), k => valeSaldo(k))), ''],
    parcelas:() => { const v = sum(expensesOf(curYM).filter(x => x.kind === 'installment'), x => x.value);
      return v > 0 && ['Parcelas do mês', fmt(v), 'out']; },
    previsao:() => { const n = addMonths(curYM, 1), s = totalIn(n) - totalOutPrev(n);
      return [(s < 0 ? 'Falta em ' : 'Sobra em ') + monthName(n).split(' ')[0], fmt(Math.abs(s)), s < 0 ? 'out' : 'in']; }};
  return db.prefs.layout.widget.filter(b => b.on).map(b => itens[b.k]()).filter(Boolean).map(([t, v, c, s]) => ({t, v, c, ...(s ? {s} : {})}));
}
