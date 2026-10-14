// Cofrim — Central de notificações (o sino): os avisos do app guardados neste aparelho, com o destino de cada um.
// Depende de dados.js e formularios.js (toast, folha); usado por quase todas as telas (centralAdd) e por inicio.js.

// ---------- Central de notificações ----------
// Os avisos de rodapé (toast, showUndo, showAcao) e alguns acontecimentos sem aviso na tela (sincronização, cópias,
// previsões, orçamento, sugestões do banco) ficam guardados aqui, NESTE aparelho: fora dos dados, do backup, da
// sincronização e da conta compartilhada. Na demonstração, numa central só na memória, que some ao sair.
// Mensagens iguais no mesmo dia viram um item: {txt, tipo, t (a última vez), ts (todas as vezes), novas (não lidas),
// dest}. Até 100 itens e 30 dias. t é quando o acontecimento foi (ex.: o fim do dia final de uma previsão).
const CENTRAL_KEY = 'financas-central';
// Fora da central (só na tela): confirmações instantâneas do que a pessoa acabou de fazer, sem informação nova.
const CENTRAL_FORA = /^(Copiado\.|Procurando atualização…|Atualizado|Salvo|Alteração salva|Excluído)$/;
const CENTRAL_TIPOS = {sucesso:['check', 'var(--in)'], aviso:['alert', 'var(--yield)'], erro:['alert', 'var(--out)'], info:['bell', 'var(--brand)']};
let centralDemo = [], centralNovas = new Set();
function centralLer(){
  if (demoOn) return centralDemo;
  let l = []; try { l = JSON.parse(localStorage.getItem(CENTRAL_KEY)); if (!Array.isArray(l)) l = []; } catch(e){ return []; }
  // Até a 1.77 os avisos da sincronização ficavam aqui: passam para o histórico da folha da nuvem.
  const sinc = l.filter(x => x.dest && x.dest.k === 'sync');
  if (sinc.length){
    for (const x of sinc) nuvemLogAdd(x.txt, x.tipo, x.t, (x.ts || []).length || 1);
    l = l.filter(x => !(x.dest && x.dest.k === 'sync'));
    try { localStorage.setItem(CENTRAL_KEY, JSON.stringify(l)); } catch(e){}
  }
  return l;
}
function centralGuardar(l){
  const limite = Date.now() - 30*864e5;
  l = l.filter(x => x.t >= limite).sort((a, b) => a.t - b.t).slice(-100);
  if (demoOn) centralDemo = l; else try { localStorage.setItem(CENTRAL_KEY, JSON.stringify(l)); } catch(e){}
  centralDraw();
}
const centralTipo = txt => /^(Não |Erro|Sem conexão)|não foi possível|não deu|não consegui/i.test(txt) ? 'erro'
  : /acima|passou|estourou|editado em dois/i.test(txt) ? 'aviso' : /salv|sincroniz|pronto|enviad|criad|baixad|importad|arquivad|restaurad|trazid|paga\b|registrad|substitu|juntad|ligad/i.test(txt) ? 'sucesso' : 'info';
const centralDia = t => new Date(t).toLocaleDateString('sv');
function centralAdd(txt, tipo, t, dest){
  txt = String(txt || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (!txt) return;
  t = t || Date.now();
  if (dest && dest.k === 'sync') return nuvemLogAdd(txt, tipo, t); // sincronização: vai para a folha da nuvem, não para a central
  const l = centralLer(), igual = dest && dest.k === 'sug' ? null : l.find(x => x.txt === txt && centralDia(x.t) === centralDia(t));
  // sugestões do banco: uma por item
  if (igual){ igual.ts = [...igual.ts, t].sort((a, b) => a - b).slice(-50); igual.t = Math.max(igual.t, t); igual.novas = (igual.novas || 0) + 1;
    if (dest) igual.dest = dest; }
  else l.push({txt, tipo:tipo || centralTipo(txt), t, ts:[t], novas:1, ...(dest ? {dest} : {})});
  centralGuardar(l);
}
// Registra um aviso de rodapé, salvo as exceções; devolve se registrou.
function centralRegistra(text, o = {}){
  if (o.central === false || CENTRAL_FORA.test(String(text).trim())) return false;
  centralAdd(text, o.tipo, o.t, o.dest);
  return true;
}
const centralNaoLidas = () => sum(centralLer(), x => x.novas || 0);
// Sino no título do Resumo, com o número de não lidas (some com zero; acima de 9, "9+").
const sinoBtn = () => { const n = centralNaoLidas();
  return `<button class="iconbtn sino" data-onclick="openCentral()" aria-label="${n ? `Notificações, ${n} não lida${n > 1 ? 's' : ''}` : 'Notificações'}">${I('bell', 24)}${n ? `<b class="sinoN">${n > 9 ? '9+' : n}</b>` : ''}</button>`; };
function centralDraw(){ for (const b of document.querySelectorAll('.sino')) b.outerHTML = sinoBtn(); }
const centralQuando = t => { const d = new Date(t);
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`; };
let centralItens = [];
// Abrir marca tudo como lido na hora (o sino zera); o que era novo fica destacado só nesta visita.
function openCentral(){
  const l = centralLer();
  centralNovas = new Set(l.filter(x => x.novas > 0).map(x => x.txt + '|' + centralDia(x.t)));
  if (centralNovas.size) centralGuardar(l.map(x => ({...x, novas:0})));
  centralTela();
}
function centralTela(){
  settingsOpen = false; F = null;
  centralItens = [...centralLer()].sort((a, b) => b.t - a.t);
  const hoje = centralDia(Date.now()), ontem = centralDia(Date.now() - 864e5);
  let dia = '', html = '';
  centralItens.forEach((x, i) => {
    const d = centralDia(x.t), [ic, cor] = CENTRAL_TIPOS[x.tipo] || CENTRAL_TIPOS.info, nova = centralNovas.has(x.txt + '|' + d);
    if (d !== dia){ dia = d; html += `<label>${d === hoje ? 'Hoje' : d === ontem ? 'Ontem' : new Date(x.t).toLocaleDateString('pt-BR')}</label>`; }
    html += `<div class="item centralItem${nova ? ' nova' : ''}" data-cent="${i}" data-onclick="centralToque(${i})"><span class="centralIco" style="color:${cor}">${I(ic, 20)}</span><div class="mid">
      <b class="quebra">${esc(x.txt)}</b><small>${centralQuando(x.t)}${x.ts.length > 1 ? ` · ${x.ts.length} vezes` : ''}${nova ? ' <em class="centralNova">Nova</em>' : ''}</small></div>${x.dest || x.ts.length > 1 ? `<span class="centralVai">${I('chev', 16)}</span>` : ''}
      <button class="iconbtn u-apagado" data-onclick="event.stopPropagation();centralApagar(${i})" aria-label="Apagar">${I('close', 18)}</button></div>`;
  });
  showSheet(`<h3>${I('bell', 22)} Notificações</h3>
    <div class="semTopo hint">${html ? 'Toque para abrir; arraste para o lado ou toque no × para apagar.' : 'Nenhuma notificação por aqui.'}</div>${html}
    <div class="btns foot">${centralItens.length ? '<button class="btn danger" data-onclick="centralLimpar()">Limpar</button>' : ''}<button class="btn primary" data-onclick="closeForm()">Fechar</button></div>`);
}
// Tocar: item repetido mostra cada vez que aconteceu; com destino, abre a tela dele.
function centralToque(i){
  const x = centralItens[i];
  if (!x) return;
  if (x.ts.length > 1){
    settingsOpen = false; F = null;
    return showSheet(`<h3>${esc(x.txt)}</h3><div class="semTopo hint">${x.ts.length} vezes em ${new Date(x.t).toLocaleDateString('pt-BR')}</div>
      <div class="plano card">${[...x.ts].reverse().map(t => `<div class="semCursor item"><div class="mid"><b>${centralQuando(t)}</b></div></div>`).join('')}</div>
      <div class="btns foot"><button class="btn" data-onclick="centralTela()">Voltar</button>${x.dest ? `<button class="btn primary" data-onclick="centralAbrir(${i})">Abrir</button>` : ''}</div>`);
  }
  if (x.dest) centralAbrir(i);
}
// Arrastar um item para o lado (assistente.js) apaga só ele, com "Desfazer".
function centralApagar(i){
  const x = centralItens[i];
  if (!x) return;
  const mesmo = y => y.txt === x.txt && y.t === x.t;
  centralGuardar(centralLer().filter(y => !mesmo(y)));
  centralTela();
  showUndo('Notificação apagada', () => { centralGuardar([...centralLer(), x]); if (sheetOpen()) centralTela(); }, {central:false});
}
function centralAbrir(i){
  const d = (centralItens[i] || {}).dest;
  if (!d) return;
  closeForm();
  if (d.k === 'prev'){ state.gsub = 'mes'; state.month = d.m; go('gastos'); abrirPrevisao(d.id, d.m); }
  else if (d.k === 'orc'){ state.gsub = 'mes'; state.month = d.m; go('gastos'); }
  else if (d.k === 'sync') canSync() && sync.on ? openNuvem() : openSettings('conta');
  else if (d.k === 'compart') openAtividade();
  else if (d.k === 'conflito') openConflitos();
  else if (d.k === 'sug') abrirSugestao(String(d.t)); // a sugestão do banco: o formulário dela (ou o histórico, se já saiu)
  else if (d.k === 'resumo') openSugestoes(); // itens antigos das sugestões (até a 1.77): não dá para saber qual era
  else if (d.k === 'sugs') openSugestoes();
  else if (d.k === 'appsIgn') openAppsIgnorados();
  else if (d.k === 'conq') openBadges(d.n); // a tela das conquistas, com as que vieram neste aviso em destaque
  else if (d.k === 'invest') go('invest');
  else if (d.k === 'gastos'){ state.gsub = d.sub || 'mes'; if (d.m) state.month = d.m; go('gastos'); }
  else if (d.k === 'lixeira') openTrash();
  else if (d.k === 'novidades') maybeNews(true);
  else if (d.k === 'cfg') openSettings(d.s || '');
}
async function centralLimpar(){
  if (await ask('Apagar todas as notificações desta central?', 'Limpar', true)){ centralLimparJa(); centralTela(); }
}
function centralLimparJa(){ centralGuardar([]); centralNovas = new Set(); }
function hideSnack(){ document.getElementById('snack').hidden = true; undoFn = null; }

