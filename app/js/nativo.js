// Cofrim — Acesso ao lado nativo num lugar só. No APK, window.Android é a ponte com o Java (Ponte.java); na web e
// no iPhone, js/web.js põe um substituto com o que dá para fazer no navegador, e o resto não existe.
// As telas nunca usam window.Android direto: temNativo('x') diz se a função existe (temNativo() = há ponte ou substituto)
// e nativo('x', …) chama, ou devolve undefined quando ela não existe, sem erro na web. O ./checa.sh recusa "Android."
// fora deste arquivo e do web.js. Carregado logo no começo do index.html, antes de dados.js (que lê o arquivo do app).
function temNativo(nome){ const A = window.Android; return nome === undefined ? !!A : !!A && typeof A[nome] === 'function'; }
// Os textos que saem para o lado nativo (notificações, lembretes agendados, widgets) vão no idioma do app (trNativo,
// js/idioma.js, carregado depois deste arquivo).
function nativo(nome, ...args){ return temNativo(nome) ? window.Android[nome](...(window.trNativo ? trNativo(nome, args) : args)) : undefined; }
