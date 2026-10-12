// Cofrim — Erros explicados para quem não é técnico: o que aconteceu, por que pode ter acontecido e o que fazer. Um
// catálogo só (ERROS) para o APK e a versão web; avisoErro(tipo, titulo) mostra a explicação na caixa de aviso do app.
// O lado Android chama window.onErroNativo(tipo) quando a câmera, a escolha de arquivos ou outra tela do celular falha.
// Erro do próprio app (4º item true), que a pessoa não tem como resolver: o aviso oferece "Informar o problema", que abre
// Configurações › Sugestões e bugs com a mensagem começada (relatarProblema, em config.js).
// Erros inesperados de tela continuam indo para o Diagnóstico e, uma vez por abertura, mostram um aviso com o que fazer.
// Depende de dialogos.js (tell) e lixeira.js (showAcao).
const ERROS = {
  internet: ['Não foi possível falar com a internet agora.',
    ['Sem internet, ou com o sinal fraco', 'O Google está instável neste momento', 'A sessão da sua conta Google expirou'],
    ['Confira o Wi-Fi ou os dados móveis e tente de novo', 'Espere alguns minutos e tente outra vez',
      'Se continuar, entre de novo com a conta Google em Configurações › Conta e sincronização']],
  arquivo: ['Não foi possível ler este arquivo.',
    ['O arquivo não é do tipo certo (extrato: OFX ou CSV; backup: o arquivo .json salvo pelo Cofrim)',
      'O arquivo veio incompleto ou estragado (por exemplo, o download foi interrompido)', 'O celular não deixou o app abrir o arquivo'],
    ['Baixe o arquivo de novo no app ou no site do banco', 'No banco, procure "exportar extrato" e escolha OFX ou CSV',
      'Escolha o arquivo pelo app Arquivos do celular']],
  imagem: ['Não foi possível abrir essa imagem.',
    ['A imagem está num formato que o app não lê (por exemplo, HEIC, das fotos do iPhone)', 'A imagem está estragada ou é grande demais'],
    ['Tire uma foto nova pelo próprio app', 'Escolha outra imagem, ou um print (captura de tela) dela']],
  gravar: ['Não deu para salvar as últimas alterações neste aparelho.',
    ['O armazenamento do celular (ou do navegador) está cheio',
      'Na versão web, o navegador está numa janela anônima ou não deixa o site guardar dados'],
    ['Libere espaço apagando fotos, vídeos ou apps que você não usa', 'Na versão web, use uma janela normal e deixe o site guardar dados',
      'Salve um backup agora em Configurações › Dados e ajustes › Backup em arquivo',
      'Com a conta Google ligada, o que já sincronizou continua guardado no seu Google Drive']],
  decifrar: ['Não foi possível abrir os dados guardados neste navegador.',
    ['O navegador apagou parte dos dados do site (limpeza de dados, cookies ou cache)', 'O navegador ou o perfil do navegador foi trocado'],
    ['Entre com a sua conta Google: os dados voltam pela sincronização',
      'Se você tem um backup em arquivo, importe em Configurações › Dados e ajustes › Backup em arquivo']],
  atualizacao: ['Não foi possível procurar ou baixar a atualização.',
    ['Sem internet, ou com o sinal fraco', 'O site das atualizações está fora do ar por um momento', 'Pouco espaço livre no celular para baixar'],
    ['Confira a internet e tente de novo em Configurações › Procurar atualizações', 'Libere espaço no celular',
      'Se preferir, baixe a atualização pelo navegador']],
  camera: ['Não foi possível usar a câmera.',
    ['Outro app está usando a câmera', 'O Cofrim não tem permissão para usar a câmera'],
    ['Feche outros apps de câmera e tente de novo', 'No Android: Configurações › Apps › Cofrim › Permissões › Câmera › Permitir',
      'Ou escolha a foto da galeria']],
  arquivos: ['Não foi possível abrir a escolha de arquivos.',
    ['O celular não tem um app de arquivos ativo'],
    ['Ative ou instale um app de arquivos (por exemplo, Arquivos do Google) e tente de novo']],
  salvarArquivo: ['Não foi possível salvar o arquivo.',
    ['Pouco espaço livre no celular', 'A pasta escolhida não aceita gravar (pasta de outro app ou cartão de memória)'],
    ['Escolha a pasta Downloads (Transferências)', 'Libere espaço no celular e tente de novo']],
  navegador: ['Não foi possível abrir o link.', ['Nenhum navegador está instalado ou ativo no celular'],
    ['Instale ou ative o Chrome (ou outro navegador) e tente de novo']],
  // Importar planilha (planilha-ler.js): cada caso com o jeito de salvar a planilha num formato que o app lê.
  planilha: ['Não foi possível ler esta planilha.',
    ['O arquivo veio incompleto ou estragado (por exemplo, o download foi interrompido)', 'O arquivo não é uma planilha, só tem o nome de uma'],
    ['Abra a planilha no Excel, no LibreOffice ou no Google Planilhas e salve de novo como .xlsx', 'Baixe o arquivo de novo e tente outra vez']],
  planilhaXls: ['Esta planilha está no formato antigo do Excel (.xls), que o app não lê.',
    ['O arquivo foi salvo numa versão antiga do Excel, ou "Pasta de Trabalho do Excel 97-2003"'],
    ['No Excel: Arquivo › Salvar como › "Pasta de Trabalho do Excel (.xlsx)"', 'No LibreOffice: Arquivo › Salvar como › formato .xlsx ou .ods',
      'No Google Planilhas: Arquivo › Fazer download › Microsoft Excel (.xlsx)']],
  planilhaFormato: ['O app não lê planilhas neste formato.',
    ['O app lê planilhas .xlsx (Excel), .ods (LibreOffice) e .csv', 'Planilhas do Numbers (iPhone e Mac) e planilhas com senha não são lidas',
      'Uma planilha do Google Planilhas precisa ser baixada antes'],
    ['No Google Planilhas: Arquivo › Fazer download › Microsoft Excel (.xlsx)', 'No Numbers: Arquivo › Exportar para › Excel',
      'Se a planilha tem senha, tire a senha e salve de novo como .xlsx']],
  planilhaGrande: ['Esta planilha é grande demais para importar de uma vez.',
    ['O app lê até 10 MB, 60 abas e 20 mil linhas por vez, para o celular não ficar sem memória'],
    ['Divida a planilha em arquivos menores (por exemplo, um por ano) e importe um de cada vez',
      'Apague abas de gráficos, imagens e cálculos que não são lançamentos e salve de novo']],
  planilhaNavegador: ['Este navegador não consegue abrir planilhas .xlsx e .ods.',
    ['O navegador (ou o Android System WebView, no celular) está desatualizado'],
    ['Atualize o Chrome ou o Android System WebView na Play Store e tente de novo',
      'Ou salve a planilha como .csv e importe o .csv']],
  inesperado: ['Algo deu errado nesta tela.',
    ['Um dado chegou num formato que o app não esperava', 'O app está mais antigo que o de outro aparelho que mexeu nos dados'],
    ['Seus dados continuam guardados. Feche e abra o app de novo', 'Procure atualizações em Configurações',
      'Se continuar, toque em "Informar o problema": a mensagem vai para a equipe do Cofrim, com o Diagnóstico (sem os seus dados)'], true]
};
// Texto completo de um erro: título (ou o título próprio de quem chamou), causas e soluções.
function erroTexto(tipo, titulo){
  const [t, causas, solucoes] = ERROS[tipo] || ERROS.inesperado;
  return `${titulo || t}\n\nPor que pode ter acontecido:\n${causas.map(c => '• ' + c).join('\n')}\n\nO que fazer:\n${solucoes.map(c => '• ' + c).join('\n')}`;
}
function avisoErro(tipo, titulo){
  const e = ERROS[tipo] || ERROS.inesperado;
  if (!e[3]) return tell(erroTexto(tipo, titulo));
  return ask(erroTexto(tipo, titulo), 'Informar o problema').then(sim => { if (sim) relatarProblema(titulo || e[0]); return sim; });
}
// Chamado pelo lado Android (MainActivity/Ponte) quando uma tela do celular falha.
function onErroNativo(tipo){ avisoErro(ERROS[tipo] ? tipo : 'inesperado'); }
// Erro inesperado (já registrado no Diagnóstico por logErr): um aviso por abertura, com o que fazer. Só os erros de tela
// ("error"); promessas recusadas são quase sempre a internet, que cada função já explica. Fora da página de
// testes, onde os erros são provocados de propósito.
let erroAvisado = false;
function erroInesperado(){
  if (erroAvisado || window.TESTE) return;
  erroAvisado = true;
  setTimeout(() => { try { showAcao('Algo deu errado nesta tela.', 'O que fazer', () => avisoErro('inesperado')); } catch(e){} }, 300);
}
addEventListener('error', erroInesperado);
// No Android, a tela do app que travou e foi recarregada (MainActivity guarda "hora|motivo" em ultimoErro): na abertura
// seguinte, um aviso com "Informar o problema", uma vez por travamento (a hora do último avisado fica neste aparelho).
// Fechar para liberar memória é do Android, não do app: esse não pede para contar.
const ERRO_VISTO_KEY = 'financas-erro-visto';
function avisoTravou(){
  const e = temNativo('ultimoErro') ? String(nativo('ultimoErro') || '') : '', t = +e.split('|')[0];
  let visto = 0;
  try { visto = +localStorage.getItem(ERRO_VISTO_KEY) || 0; } catch(x){}
  if (!t || t <= visto || Date.now() - t > 7 * 864e5 || !e.includes('travou')) return;
  try { localStorage.setItem(ERRO_VISTO_KEY, String(t)); } catch(x){}
  showAcao('O app travou da última vez que foi usado.', 'Informar o problema', () => relatarProblema(e.slice(e.indexOf('|') + 1)));
}
