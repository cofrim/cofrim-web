// Cofrim — Grupos de categorias (categorias principais): regras sem HTML. Nomes e rótulos ("Grupo › Categoria"), criar,
// editar, mover categoria, excluir e restaurar os grupos de fábrica. Usadas pela tela de categorias (config.js) e pelos
// formulários de ganho e gasto. Depende de dados.js (GRUPOS_BASE, GRUPOS_CAT, CAT_GRUPO, applyCats) e de plain
// (investimentos.js). Quem chama grava (save) e redesenha.

// Nome para comparar: sem espaços nas pontas, sem maiúsculas e sem acentos ("Café" = "cafe").
const nomeComparar = s => plain(String(s ?? '').trim());
const grupoDe = (type, k) => CAT_GRUPO[type][k] || 'outros';
const grupoInfo = (type, g) => GRUPOS_CAT[type][g] || GRUPOS_CAT[type].outros;
const catCompleto = (type, k) => `${grupoInfo(type, grupoDe(type, k))[1]} › ${(CAT_OF[type][k] || CAT_OF[type].outros)[1]}`;
// Nome da categoria nas listas: só o nome; "Grupo › Categoria" quando outra categoria de outro grupo tem o mesmo nome.
function catRotulo(type, k){
  const C = CAT_OF[type], c = C[k] || C.outros, n = nomeComparar(c[1]), g = grupoDe(type, k);
  return Object.keys(C).some(o => o !== k && grupoDe(type, o) !== g && nomeComparar(C[o][1]) === n) ? catCompleto(type, k) : c[1];
}
const catsDoGrupo = (type, g) => Object.keys(CAT_OF[type]).filter(k => grupoDe(type, k) === g);

// Regras de nome: não vazio; grupo único no tipo; categoria única dentro do grupo (em grupos diferentes, pode repetir).
function grupoNomeErro(type, nome, g = ''){
  const n = nomeComparar(nome);
  if (!n) return 'Escreva o nome do grupo.';
  return Object.keys(GRUPOS_CAT[type]).some(o => o !== g && nomeComparar(GRUPOS_CAT[type][o][1]) === n) ? 'Já existe um grupo com esse nome.' : '';
}
function catNomeErro(type, nome, g, k = ''){
  const n = nomeComparar(nome);
  if (!n) return 'Escreva o nome da categoria.';
  return catsDoGrupo(type, g).some(o => o !== k && nomeComparar(CAT_OF[type][o][1]) === n) ? 'Já existe uma categoria com esse nome neste grupo.' : '';
}

// Grava um grupo (g = '' cria um novo) e devolve a chave. Nos de fábrica, guarda só as mudanças.
function grupoSalvar(type, g, v){
  g = g || 'g' + uid();
  db.grupos[type][g] = catLimpa({name:String(v.name).trim().slice(0, 40), icon:v.icon, color:v.color});
  db.cfgMod = Date.now(); applyCats();
  return g;
}
function catMover(type, k, g){
  db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {g});
  db.cfgMod = Date.now(); applyCats();
}

const catLancamentos = (type, k) => (type === 'gasto' ? ['expenses', 'installments'] : ['incomes']).flatMap(c => db[c]).filter(x => x.cat === k);
// Destino dos lançamentos de uma categoria criada pela pessoa que vai ser excluída (o mesmo de sempre): a de fábrica com
// o mesmo nome ou "Outros".
function catDestino(type, k){
  const nome = plainName(CAT_OF[type][k][1]);
  return Object.keys(BASE_CATS[type]).find(b => b !== k && plainName((db.cats[type][b] || {}).name || BASE_CATS[type][b][1]) === nome) || 'outros';
}
// Passa os lançamentos, o orçamento, as notificações e as sugestões de categoria de k para alvo e tira k: a criada pela
// pessoa é excluída (com tomb, para valer nos outros aparelhos); a de fábrica fica escondida. Nenhum lançamento é apagado.
function catApagarDados(type, k, alvo = catDestino(type, k)){
  for (const x of catLancamentos(type, k)){ x.cat = alvo; touch(x); }
  if (type === 'gasto'){
    if (db.budgets[k]){ db.budgets[alvo] = (db.budgets[alvo] || 0) + db.budgets[k]; delete db.budgets[k]; }
    delete db.prefs.notifyCats[k];
    for (const d in db.catMemo) if (db.catMemo[d] === k) db.catMemo[d] = alvo;
  }
  if (BASE_CATS[type][k]) db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {hidden:true});
  else { delete db.cats[type][k]; db.tomb['cat:' + type + ':' + k] = Date.now(); }
  db.cfgMod = Date.now(); applyCats();
  return alvo;
}

// O que a exclusão de um grupo atinge: categorias (as escondidas também) e lançamentos delas.
function grupoAfetados(type, g){
  const cats = catsDoGrupo(type, g);
  return {cats:cats.length, lanc:cats.reduce((n, k) => n + catLancamentos(type, k).length, 0)};
}
// Categorias do grupo com o mesmo nome de uma que já está em "Outros": [[chave, chave em Outros]].
const grupoConflitos = (type, g) => catsDoGrupo(type, g).map(k => [k, catsDoGrupo(type, 'outros')
  .find(o => nomeComparar(CAT_OF[type][o][1]) === nomeComparar(CAT_OF[type][k][1]))]).filter(([, o]) => o);
// Exclui um grupo ("Outros" não se exclui). modo 'mover': as categorias vão para "Outros"; nas que repetem um nome de lá,
// resolve[chave] diz o que fazer: 'juntar' (os lançamentos passam para a de Outros) ou {nome} (renomeia). modo 'apagar':
// as categorias saem também, como na exclusão de uma categoria (catApagarDados: lançamentos para a de fábrica com o mesmo
// nome ou "Outros"); as de fábrica, que não se excluem, ficam escondidas em "Outros", com os lançamentos delas.
function grupoExcluir(type, g, modo, resolve = {}){
  if (g === 'outros' || !GRUPOS_CAT[type][g]) return false;
  const conf = Object.fromEntries(grupoConflitos(type, g));
  for (const k of catsDoGrupo(type, g)){
    if (modo === 'apagar'){
      if (BASE_CATS[type][k]) db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {g:'outros', hidden:true});
      else catApagarDados(type, k);
      continue;
    }
    const r = resolve[k];
    if (conf[k] && r === 'juntar'){ catApagarDados(type, k, conf[k]); continue; }
    if (conf[k] && r && r.nome) db.cats[type][k] = Object.assign(db.cats[type][k] || {}, {name:String(r.nome).trim().slice(0, 40)});
    catMover(type, k, 'outros');
  }
  if (type === 'gasto') delete db.budgetsG[g]; // o limite do grupo sai com ele
  if (GRUPOS_BASE[type][g]) db.grupos[type][g] = {del:true};
  else { delete db.grupos[type][g]; db.tomb['grp:' + type + ':' + g] = Date.now(); }
  db.cfgMod = Date.now(); applyCats();
  return true;
}
// Grupos de fábrica como vieram: voltam os excluídos, com o nome, o ícone e a cor de fábrica, e as categorias de fábrica
// voltam para eles. Os grupos criados pela pessoa e as categorias dela ficam onde estão; nada é apagado.
function gruposRestaurar(type){
  for (const g of Object.keys(GRUPOS_BASE[type])) delete db.grupos[type][g];
  for (const k of Object.keys(BASE_CATS[type])) if (db.cats[type][k]) delete db.cats[type][k].g;
  db.cfgMod = Date.now(); applyCats();
}

// ---------- Totais por grupo e cores ----------
// Soma por grupo de [[categoria, valor], …]: [[grupo, valor, [[categoria, valor], …]], …], do maior para o menor.
function somaPorGrupo(type, lista){
  const por = {};
  for (const [k, v] of lista){ const g = grupoDe(type, k); (por[g] = por[g] || [g, 0, []])[1] += v; por[g][2].push([k, v]); }
  return Object.values(por).map(([g, v, cs]) => [g, v, cs.sort((a, b) => b[1] - a[1])]).sort((a, b) => b[1] - a[1]);
}
// Tom da i-ésima subcategoria (de n) a partir da cor do grupo: a primeira na cor dele; as outras alternam mais clara e
// mais escura, até 45% para o branco ou 40% para o preto (separa as fatias sem sumir no fundo claro ou escuro).
function tomDoGrupo(cor, i, n){
  if (!i || n < 2 || !/^#[0-9a-f]{6}$/i.test(cor)) return cor;
  const passo = Math.min(.22, .85 / n), t = Math.ceil(i / 2) * passo, claro = i % 2, alvo = claro ? 255 : 0, quanto = Math.min(claro ? .45 : .4, t);
  return '#' + [1, 3, 5].map(j => Math.round(parseInt(cor.slice(j, j + 2), 16) * (1 - quanto) + alvo * quanto).toString(16).padStart(2, '0')).join('');
}
// Cor de cada categoria de uma lista no gráfico: o tom do grupo dela, pela posição entre as do mesmo grupo na lista.
function coresPorGrupo(type, ks){
  const por = {}, out = {};
  for (const k of ks) (por[grupoDe(type, k)] = por[grupoDe(type, k)] || []).push(k);
  for (const [g, l] of Object.entries(por)) l.forEach((k, i) => { out[k] = tomDoGrupo(grupoInfo(type, g)[2], i, l.length); });
  return out;
}
