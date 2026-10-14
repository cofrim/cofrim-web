// Cofrim — Grupos de categorias nas telas: a janela de criar e editar um grupo (nome, ícone, cor e as categorias dele)
// e a exclusão (mover para "Outros", com o que fazer nas repetidas, ou apagar as categorias, com confirmação). A mesma
// janela serve à tela de categorias das Configurações (openCats) e aos formulários de ganho e gasto; depois(g) diz o
// que fazer em seguida. As regras ficam em grupos.js.

let grupoEd = null; // {type, g, icon, color, depois}
function grupoEditor(type, g = '', depois = openCats){
  const c = g && GRUPOS_CAT[type][g];
  grupoEd = {type, g, icon:c ? c[0] : 'tag', color:c ? c[2] : '#64748b', depois};
  const cats = g ? catsDoGrupo(type, g) : [];
  showPicker(`<h3>${c ? 'Editar grupo' : type === 'gasto' ? 'Novo grupo de gastos' : 'Novo grupo de ganhos'}</h3>
    <label for="geNome">Nome</label>
    <input id="geNome" type="text" maxlength="40" placeholder="Ex.: Lazer" autocomplete="off" value="${esc(c ? c[1] : '')}">
    <label>Ícone</label><div class="iconGrid">${Object.entries(ICON_NAMES).map(([k, n]) => `<button type="button"
      class="${k === grupoEd.icon ? 'on' : ''}" data-i="${k}" aria-label="${n}" title="${n}"
      data-onclick="grupoEdEscolhe(this,'icon')">${I(k, 23)}</button>`).join('')}</div>
    <label>Cor</label><div class="swatches colorGrid">${CAT_COLORS.map(cor => `<button type="button"
      class="sw${cor === grupoEd.color ? ' on' : ''}" data-c="${cor}" style="background:${cor}" aria-label="Cor ${cor}"
      data-onclick="grupoEdEscolhe(this,'color')"></button>`).join('')}</div>
    ${c ? `<label>Categorias do grupo</label>${cats.length ? `<div class="chips grpCats">${cats.map(k =>
      `<span>${I(CAT_OF[type][k][0], 15)}${esc(CAT_OF[type][k][1])}</span>`).join('')}</div>` : '<div class="hint">Nenhuma categoria neste grupo.</div>'}
      <div class="btns"><button class="btn" data-onclick="grupoEdNovaCat()">${I('plus', 16)}Nova categoria neste grupo</button></div>` : ''}
    <div class="err" id="geErr"></div>
    <div class="btns foot"><button class="btn" data-onclick="closePicker()">Cancelar</button>
      ${c && g !== 'outros' ? `<button class="btn del" data-onclick="grupoExcluirPedir(grupoEd.type,grupoEd.g,grupoEd.depois)">`
        + `${I('trash', 17)}Excluir</button>` : ''}
      <button class="btn primary" data-onclick="grupoEdSalvar()">${c ? 'Salvar' : 'Criar'}</button></div>`);
}
function grupoEdEscolhe(b, campo){
  grupoEd[campo] = campo === 'icon' ? b.dataset.i : b.dataset.c;
  b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
}
function grupoEdSalvar(){
  const {type, g, icon, color, depois} = grupoEd, nome = document.getElementById('geNome').value;
  const erro = grupoNomeErro(type, nome, g);
  if (erro) return void (document.getElementById('geErr').textContent = erro);
  const k = grupoSalvar(type, g, {name:nome, icon, color});
  save(); render(); closePicker(); grupoEd = null;
  depois(k);
}
// Nova categoria já dentro do grupo aberto: a janela de categoria (novaCategoria) e, ao criar, o grupo de novo.
function grupoEdNovaCat(){
  const {type, g, depois} = grupoEd;
  novaCategoria(type, () => grupoEditor(type, g, depois), '', '', g);
}

// Excluir um grupo: vazio, só confirma; com categorias, diz quantas e quantos lançamentos e oferece mover para "Outros"
// (destacado) ou apagar as categorias também (com uma segunda confirmação).
async function grupoExcluirPedir(type, g, depois = openCats){
  const c = GRUPOS_CAT[type][g], af = grupoAfetados(type, g);
  const fim = () => { save(); render(); closePicker(); depois('outros'); toast('Grupo excluído.', {dest:{k:'cfg', s:'categorias'}}); };
  if (!c || g === 'outros') return;
  if (!af.cats){
    if (await ask(`Excluir o grupo "${c[1]}"?`, 'Excluir', true)){ grupoExcluir(type, g, 'mover'); fim(); }
    return;
  }
  const outros = GRUPOS_CAT[type].outros[1];
  showPicker(`<h3>Excluir o grupo "${esc(c[1])}"</h3>
    <div class="semTopo hint">${af.cats} categoria(s) · ${af.lanc} lançamento(s)</div>
    <div class="btns col">
      <button class="btn primary" data-onclick="grupoExcluirMover()">Mover categorias para ${esc(outros)}</button>
      <button class="btn danger" data-onclick="grupoExcluirApagar()">Apagar as categorias também</button>
      <button class="btn" data-onclick="closePicker()">Cancelar</button></div>`);
  grupoEx = {type, g, af, fim};
}
let grupoEx = null; // exclusão em andamento: {type, g, af, fim}
// Mover: para cada categoria com o nome de uma que já está em "Outros", pergunta se junta as duas ou renomeia.
async function grupoExcluirMover(){
  const {type, g, fim} = grupoEx, resolve = {};
  for (const [k, o] of grupoConflitos(type, g)){
    const nome = CAT_OF[type][k][1], outros = GRUPOS_CAT[type].outros[1];
    const r = await escolhaPicker(`"${nome}" já existe em ${outros}`, 'O que fazer com as duas categorias?',
      [['juntar', `Juntar as duas em ${outros}`], ['renomear', 'Renomear esta']]);
    if (!r) return closePicker();
    if (r === 'juntar'){ resolve[k] = 'juntar'; continue; }
    const novo = await textoPicker(`Novo nome para "${nome}"`, nome,
      v => catNomeErro(type, v, 'outros') || (nomeComparar(v) === nomeComparar(nome) ? 'Escolha um nome diferente.' : ''));
    if (novo == null) return closePicker();
    resolve[k] = {nome:novo};
  }
  grupoExcluir(type, g, 'mover', resolve); fim();
}
async function grupoExcluirApagar(){
  const {type, g, af, fim} = grupoEx, c = GRUPOS_CAT[type][g];
  closePicker();
  const msg = [`Apagar o grupo "${c[1]}" e as ${af.cats} categoria(s) dele?`,
    af.lanc && `Nenhum lançamento é apagado: ${af.lanc} lançamento(s) passam para "Outros" (ou para a categoria do app com o mesmo nome).`,
    'As categorias que já vêm no app não se apagam: ficam escondidas em "Outros".'];
  if (!await ask(msg.filter(Boolean).join('\n\n'), 'Apagar', true)) return;
  grupoExcluir(type, g, 'apagar'); fim();
}
async function gruposRestaurarPedir(type){
  const msg = [type === 'gasto' ? 'Restaurar os grupos padrão de gastos?' : 'Restaurar os grupos padrão de ganhos?',
    'Os grupos que vêm no app voltam com o nome, o ícone e a cor deles, e as categorias do app voltam para eles.',
    'Os grupos e as categorias que você criou ficam como estão; nenhum lançamento muda.'];
  if (!await ask(msg.join('\n\n'), 'Restaurar')) return;
  gruposRestaurar(type); save(); render(); openCats();
  toast('Grupos padrão restaurados.');
}

// Janelinhas que devolvem a resposta (Promise): escolher uma opção, ou escrever um texto validado. null = cancelou.
let pickResp = null;
function escolhaPicker(titulo, texto, opcoes){
  return new Promise(res => {
    pickResp = res;
    showPicker(`<h3>${esc(titulo)}</h3><div class="semTopo hint">${esc(texto)}</div>
      <div class="btns col">${opcoes.map(([v, t], i) =>
        `<button class="btn${i ? '' : ' primary'}" data-v="${v}" data-onclick="pickResponde(this.dataset.v)">${esc(t)}</button>`).join('')}
        <button class="btn" data-onclick="pickResponde(null)">Cancelar</button></div>`);
  });
}
let textoValida = null;
function textoPicker(titulo, valor, valida){
  return new Promise(res => {
    pickResp = res; textoValida = valida;
    showPicker(`<h3>${esc(titulo)}</h3><input id="tpTexto" type="text" maxlength="40" autocomplete="off" value="${esc(valor)}">
      <div class="err" id="tpErr"></div>
      <div class="btns foot"><button class="btn" data-onclick="pickResponde(null)">Cancelar</button>
        <button class="btn primary" data-onclick="textoPickerOk()">OK</button></div>`);
  });
}
function textoPickerOk(){
  const v = document.getElementById('tpTexto').value.trim(), e = textoValida && textoValida(v);
  if (e) return void (document.getElementById('tpErr').textContent = e);
  pickResponde(v);
}
function pickResponde(v){ const r = pickResp; pickResp = null; if (r) r(v); }
