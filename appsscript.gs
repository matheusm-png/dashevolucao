// ============================================================
// DASHBOARD EVOLUÇÃO — Apps Script Backend
// Planilha: 1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8
// ============================================================

var SPREADSHEET_ID = '1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8';

function doGet(e) {
  try {
    var dados = consolidarDados();
    var output = ContentService
      .createTextOutput(JSON.stringify(dados))
      .setMimeType(ContentService.MimeType.JSON);
    return output;
  } catch (err) {
    var erro = { error: true, message: err.message };
    return ContentService
      .createTextOutput(JSON.stringify(erro))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// CONSOLIDAÇÃO PRINCIPAL
// ============================================================

function consolidarDados() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var metas       = lerMetas(ss);
  var metaAds     = lerMetaAds(ss);
  var googleAds   = lerGoogleAds(ss);
  var leadsGerais = lerLeadsGerais(ss);

  // ---- Datas do mês atual ----
  var hoje     = new Date();
  var ano      = hoje.getFullYear();
  var mes      = hoje.getMonth(); // 0-based
  var diaHoje  = hoje.getDate();

  var ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  var diasCorridos = diaHoje;
  var diasRestantes = ultimoDiaMes - diaHoje;

  // ---- Somar investimentos do mês ----
  var investMeta   = somarCampo(metaAds, 'investimento');
  var investGoogle = somarCampo(googleAds, 'custo');
  var investTotal  = investMeta + investGoogle;

  // ---- Totais do mês (LEADS GERAIS é fonte principal) ----
  var totalLeads        = somarCampo(leadsGerais, 'leads');
  var totalAgendamentos = somarCampo(leadsGerais, 'agendamentos');
  var totalAGQ          = somarCampo(leadsGerais, 'agq');

  // ---- CPL e CPLag ----
  var cpl   = totalLeads        > 0 ? investTotal / totalLeads        : 0;
  var cplag = totalAgendamentos > 0 ? investTotal / totalAgendamentos : 0;

  // ---- Pace ----
  var mediaDiariaLeads        = diasCorridos > 0 ? totalLeads        / diasCorridos : 0;
  var mediaDiariaAgendamentos = diasCorridos > 0 ? totalAgendamentos / diasCorridos : 0;
  var mediaDiariaAGQ          = diasCorridos > 0 ? totalAGQ          / diasCorridos : 0;

  var faltamLeads        = Math.max(0, metas.leads        - totalLeads);
  var faltamAgendamentos = Math.max(0, metas.agendamentos - totalAgendamentos);
  var faltamAGQ          = Math.max(0, metas.agq          - totalAGQ);

  var diasParaCalculo = diasRestantes > 0 ? diasRestantes : 1;
  var necessarioPorDiaLeads        = faltamLeads        / diasParaCalculo;
  var necessarioPorDiaAgendamentos = faltamAgendamentos / diasParaCalculo;
  var necessarioPorDiaAGQ          = faltamAGQ          / diasParaCalculo;

  // ---- Série diária consolidada ----
  var serieDiaria = construirSerieDiaria(
    ano, mes, ultimoDiaMes,
    metaAds, googleAds, leadsGerais
  );

  return {
    metas: metas,
    investimento_total_mes: arredondar(investTotal),
    resumo_mes: {
      leads:              totalLeads,
      agendamentos:       totalAgendamentos,
      agq:                totalAGQ,
      cpl:                arredondar(cpl),
      cplag:              arredondar(cplag),
      investimento_meta:  arredondar(investMeta),
      investimento_google: arredondar(investGoogle)
    },
    pace: {
      dias_corridos:                  diasCorridos,
      dias_restantes:                 diasRestantes,
      leads_necessarios_por_dia:      arredondar(necessarioPorDiaLeads),
      agendamentos_necessarios_por_dia: arredondar(necessarioPorDiaAgendamentos),
      agq_necessarios_por_dia:        arredondar(necessarioPorDiaAGQ),
      leads_media_atual_por_dia:      arredondar(mediaDiariaLeads),
      agendamentos_media_atual_por_dia: arredondar(mediaDiariaAgendamentos),
      agq_media_atual_por_dia:        arredondar(mediaDiariaAGQ)
    },
    serie_diaria: serieDiaria
  };
}

// ============================================================
// LEITURA — ABA METAS
// ============================================================

function lerMetas(ss) {
  var aba = ss.getSheetByName('METAS');
  if (!aba) return { leads: 650, agendamentos: 152, agq: 137, cpl_max: 173.08, cplag_max: 740.13 };

  var dados = aba.getDataRange().getValues();
  var metas = { leads: 650, agendamentos: 152, agq: 137, cpl_max: 173.08, cplag_max: 740.13 };

  // Formato esperado: coluna A = nome da meta, coluna B = valor
  for (var i = 1; i < dados.length; i++) {
    var nome  = String(dados[i][0]).toLowerCase().trim();
    var valor = parseFloat(String(dados[i][1]).replace(',', '.')) || 0;

    if (nome.includes('lead'))          metas.leads          = valor;
    if (nome.includes('agendamento'))   metas.agendamentos   = valor;
    if (nome.includes('agq'))           metas.agq            = valor;
    if (nome.includes('cpl') && nome.includes('max') && !nome.includes('ag'))
                                        metas.cpl_max        = valor;
    if (nome.includes('cplag') || (nome.includes('cpl') && nome.includes('ag')))
                                        metas.cplag_max      = valor;
  }

  return metas;
}

// ============================================================
// LEITURA — ABA META ADS
// Colunas: Ad Name, Ad Set Name, Impressions, Results,
//          Cost per Result, Amount Spent, CPM,
//          Link Clicks, CPC, CTR, Day
// ============================================================

function lerMetaAds(ss) {
  var aba = ss.getSheetByName('META ADS');
  if (!aba) return [];

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  var cabecalho = dados[0].map(function(c) { return String(c).trim().toLowerCase(); });

  var idxAmountSpent  = encontrarColuna(cabecalho, ['amount spent', 'spent']);
  var idxResults      = encontrarColuna(cabecalho, ['results']);
  var idxLinkClicks   = encontrarColuna(cabecalho, ['link clicks', 'clicks']);
  var idxDay          = encontrarColuna(cabecalho, ['day', 'data', 'date']);

  var hoje     = new Date();
  var anoAtual = hoje.getFullYear();
  var mesAtual = hoje.getMonth(); // 0-based

  var agregado = {}; // chave: 'YYYY-MM-DD'

  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];

    var diaRaw = linha[idxDay];
    var chave  = normalizarData(diaRaw);
    if (!chave) continue;

    // Filtrar apenas mês atual
    var partes = chave.split('-');
    if (parseInt(partes[0]) !== anoAtual || parseInt(partes[1]) - 1 !== mesAtual) continue;

    if (!agregado[chave]) {
      agregado[chave] = { investimento: 0, leads: 0, cliques: 0 };
    }

    agregado[chave].investimento += toNum(idxAmountSpent >= 0 ? linha[idxAmountSpent] : 0);
    agregado[chave].leads        += toNum(idxResults    >= 0 ? linha[idxResults]      : 0);
    agregado[chave].cliques      += toNum(idxLinkClicks >= 0 ? linha[idxLinkClicks]   : 0);
  }

  return objetoParaArray(agregado);
}

// ============================================================
// LEITURA — ABA GOOGLE ADS
// Colunas: Data, Campanha, Grupo, Ad ID, Ad Name,
//          Impressões, Cliques, Custo, Conversões, Custo/Conv
// ============================================================

function lerGoogleAds(ss) {
  var aba = ss.getSheetByName('GOOGLE ADS');
  if (!aba) return [];

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  var cabecalho = dados[0].map(function(c) { return String(c).trim().toLowerCase(); });

  var idxData        = encontrarColuna(cabecalho, ['data', 'date', 'dia', 'day']);
  var idxCusto       = encontrarColuna(cabecalho, ['custo', 'cost', 'spend']);
  var idxConversoes  = encontrarColuna(cabecalho, ['conversões', 'conversoes', 'conversions']);

  var hoje     = new Date();
  var anoAtual = hoje.getFullYear();
  var mesAtual = hoje.getMonth(); // 0-based

  var agregado = {};

  for (var i = 1; i < dados.length; i++) {
    var linha  = dados[i];
    var chave  = normalizarData(idxData >= 0 ? linha[idxData] : null);
    if (!chave) continue;

    // Filtrar apenas mês atual
    var partes = chave.split('-');
    if (parseInt(partes[0]) !== anoAtual || parseInt(partes[1]) - 1 !== mesAtual) continue;

    if (!agregado[chave]) {
      agregado[chave] = { custo: 0, leads: 0 };
    }

    agregado[chave].custo  += toNum(idxCusto      >= 0 ? linha[idxCusto]      : 0);
    agregado[chave].leads  += toNum(idxConversoes >= 0 ? linha[idxConversoes] : 0);
  }

  return objetoParaArray(agregado);
}

// ============================================================
// LEITURA — ABA LEADS GERAIS
// Colunas: Empresa, Data, Status, Origem, Campanha
// ============================================================

function lerLeadsGerais(ss) {
  var aba = ss.getSheetByName('LEADS GERAIS');
  if (!aba) return [];

  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];

  var cabecalho = dados[0].map(function(c) { return String(c).trim().toLowerCase(); });

  var idxData   = encontrarColuna(cabecalho, ['data', 'date', 'dia']);
  var idxStatus = encontrarColuna(cabecalho, ['status']);

  var hoje = new Date();
  var anoAtual = hoje.getFullYear();
  var mesAtual = hoje.getMonth();

  var agregado = {};

  for (var i = 1; i < dados.length; i++) {
    var linha  = dados[i];
    var dataRaw = idxData >= 0 ? linha[idxData] : null;
    var chave  = normalizarData(dataRaw);
    if (!chave) continue;

    // Filtrar apenas mês atual
    var partes = chave.split('-');
    var anoLinha = parseInt(partes[0]);
    var mesLinha = parseInt(partes[1]) - 1; // 0-based

    if (anoLinha !== anoAtual || mesLinha !== mesAtual) continue;

    if (!agregado[chave]) {
      agregado[chave] = { leads: 0, agendamentos: 0, agq: 0 };
    }

    var status = String(idxStatus >= 0 ? linha[idxStatus] : '').trim().toLowerCase();

    agregado[chave].leads++; // qualquer registro é um lead

    if (status === 'agendado' || status === 'agendamento') {
      agregado[chave].agendamentos++;
    }

    if (status === 'agq' || status === 'agqualificado' || status === 'ag qualificado' || status === 'ag. qualificado') {
      agregado[chave].agq++;
    }
  }

  return objetoParaArray(agregado);
}

// ============================================================
// SÉRIE DIÁRIA CONSOLIDADA
// ============================================================

function construirSerieDiaria(ano, mes, ultimoDia, metaAds, googleAds, leadsGerais) {
  // Indexar por data
  var idxMeta   = indexarPorData(metaAds);
  var idxGoogle = indexarPorData(googleAds);
  var idxLeads  = indexarPorData(leadsGerais);

  var serie = [];

  for (var d = 1; d <= ultimoDia; d++) {
    var chave = formatarChave(ano, mes, d);

    var investMeta   = idxMeta[chave]   ? idxMeta[chave].investimento   : 0;
    var investGoogle = idxGoogle[chave] ? idxGoogle[chave].custo         : 0;

    serie.push({
      data:         chave,
      leads:        idxLeads[chave] ? idxLeads[chave].leads        : 0,
      agendamentos: idxLeads[chave] ? idxLeads[chave].agendamentos : 0,
      agq:          idxLeads[chave] ? idxLeads[chave].agq          : 0,
      investimento: arredondar(investMeta + investGoogle)
    });
  }

  return serie;
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function encontrarColuna(cabecalho, candidatos) {
  for (var i = 0; i < cabecalho.length; i++) {
    for (var j = 0; j < candidatos.length; j++) {
      if (cabecalho[i].includes(candidatos[j])) return i;
    }
  }
  return -1;
}

function normalizarData(valor) {
  if (!valor) return null;

  if (valor instanceof Date) {
    return formatarChave(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }

  var str = String(valor).trim();
  if (!str || str === '') return null;

  // Tenta DD/MM/YYYY
  var m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m1) return m1[3] + '-' + pad(m1[2]) + '-' + pad(m1[1]);

  // Tenta YYYY-MM-DD
  var m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return m2[1] + '-' + m2[2] + '-' + m2[3];

  // Tenta número serial do Google Sheets
  var num = parseFloat(str);
  if (!isNaN(num) && num > 40000) {
    var d = new Date((num - 25569) * 86400 * 1000);
    return formatarChave(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  return null;
}

function formatarChave(ano, mes, dia) {
  // mes é 0-based
  return ano + '-' + pad(mes + 1) + '-' + pad(dia);
}

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  var s = String(v).replace(/[R$\s]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function arredondar(n) {
  return Math.round(n * 100) / 100;
}

function somarCampo(arr, campo) {
  return arr.reduce(function(acc, item) {
    return acc + (item[campo] || 0);
  }, 0);
}

function objetoParaArray(obj) {
  return Object.keys(obj).map(function(k) {
    var item = obj[k];
    item.data = k;
    return item;
  });
}

function indexarPorData(arr) {
  var idx = {};
  arr.forEach(function(item) {
    if (item.data) idx[item.data] = item;
  });
  return idx;
}
