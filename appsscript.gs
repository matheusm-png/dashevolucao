/**
 * DASHBOARD DE PERFORMANCE - ABRIL 2026
 * Backend Google Apps Script
 */

const SPREADSHEET_ID = '1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8';
const ANO_ALVO = 2026;
const MES_ALVO = 3; // Abril (0-indexed no JS, mas vamos usar Date.getMonth())

function doGet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const metas = getMetas(ss);
    const dadosMídia = getDadosMidia(ss);
    const dadosLeads = getDadosLeads(ss);
    
    const response = processarDashboard(metas, dadosMídia, dadosLeads);
    
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getMetas(ss) {
  const sheet = ss.getSheetByName('METAS');
  const data = sheet.getDataRange().getValues();
  // Assume estrutura: [Nome, Valor]
  const metas = {};
  data.forEach(row => {
    const nome = row[0].toString().toLowerCase();
    const valor = row[1];
    if (nome.includes('leads')) metas.leads = valor;
    if (nome.includes('agendamentos')) metas.agendamentos = valor;
    if (nome.includes('agq')) metas.agq = valor;
    if (nome.includes('cpl max')) metas.cpl_max = valor;
    if (nome.includes('cplag max')) metas.cplag_max = valor;
  });
  return metas;
}

function getDadosMidia(ss) {
  const metaSheet = ss.getSheetByName('META ADS');
  const googleSheet = ss.getSheetByName('GOOGLE ADS');
  
  const metaData = metaSheet.getDataRange().getValues();
  const googleData = googleSheet.getDataRange().getValues();
  
  const registros = { meta: [], google: [] };
  
  // Processar Meta Ads
  // Colunas: Ad Name (0), Ad Set Name (1), Impressions (2), Results (leads) (3), Cost per Result (4), Amount Spent (5), ..., Day (10)
  const metaHeaders = metaData[0];
  for (let i = 1; i < metaData.length; i++) {
    const row = metaData[i];
    const dataRow = new Date(row[10]);
    if (dataRow.getFullYear() === ANO_ALVO && dataRow.getMonth() === MES_ALVO) {
      registros.meta.push({
        campanha: row[0],
        leads: Number(row[3]) || 0,
        investimento: Number(row[5]) || 0,
        data: Utilities.formatDate(dataRow, "GMT-3", "yyyy-MM-dd")
      });
    }
  }
  
  // Processar Google Ads
  // Colunas: Data (0), Campanha (1), ..., Cliques (6), Custo (7), Conversões (8)
  for (let i = 1; i < googleData.length; i++) {
    const row = googleData[i];
    const dataRow = new Date(row[0]);
    if (dataRow.getFullYear() === ANO_ALVO && dataRow.getMonth() === MES_ALVO) {
      registros.google.push({
        campanha: row[1],
        investimento: Number(row[7]) || 0,
        conversoes: Number(row[8]) || 0,
        data: Utilities.formatDate(dataRow, "GMT-3", "yyyy-MM-dd")
      });
    }
  }
  
  return registros;
}

function getDadosLeads(ss) {
  const sheet = ss.getSheetByName('LEADS GERAIS');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const colIndex = {};
  headers.forEach((h, i) => {
    const header = h.toString().toLowerCase().trim();
    if (header === 'data') colIndex.data = i;
    if (header === 'status') colIndex.status = i;
    if (header === 'origem') colIndex.origem = i;
    if (header === 'campanha') colIndex.campanha = i;
    if (header === 'público' || header === 'publico') colIndex.publico = i;
    if (header === 'tipo') colIndex.tipo = i;
  });
  
  const registros = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[colIndex.data]) continue;
    
    const dataRow = new Date(row[colIndex.data]);
    
    if (dataRow && !isNaN(dataRow.getTime()) && dataRow.getFullYear() === ANO_ALVO && dataRow.getMonth() === MES_ALVO) {
      const status = (row[colIndex.status] || "").toString().toLowerCase().trim();
      registros.push({
        data: Utilities.formatDate(dataRow, "GMT-3", "yyyy-MM-dd"),
        status: status,
        origem: (row[colIndex.origem] || "").toString().toLowerCase().trim(),
        campanha: row[colIndex.campanha] || "",
        publico: row[colIndex.publico] || "Não Identificado",
        tipo: row[colIndex.tipo] || "",
        isLead: true,
        isAgendamento: status === "agendamento" || status === "agendamento q",
        isAGQ: status === "agendamento q",
        isTentativa: status === "em tentativa",
        isDescartado: status === "descartado"
      });
    }
  }
  return registros;
}

function processarDashboard(metas, midia, leads) {
  const resumo_mes = {
    leads: 0,
    agendamentos: 0,
    agq: 0,
    tentativa: 0,
    descartado: 0,
    investimento_meta: 0,
    investimento_google: 0,
    total_investimento: 0
  };
  
  const serie_diaria = {};
  const breakdown_google = {};
  const breakdown_meta = {};
  
  // Totalizar Investimento
  midia.meta.forEach(m => {
    resumo_mes.investimento_meta += m.investimento;
    if (!serie_diaria[m.data]) serie_diaria[m.data] = criarObjetoDia(m.data);
    serie_diaria[m.data].investimento += m.investimento;
  });
  
  midia.google.forEach(g => {
    resumo_mes.investimento_google += g.investimento;
    if (!serie_diaria[g.data]) serie_diaria[g.data] = criarObjetoDia(g.data);
    serie_diaria[g.data].investimento += g.investimento;
    
    // Agrupamento Google
    let grupo = "Outros";
    const nome = g.campanha.toLowerCase();
    if (nome.includes("avaliacaode_desempenho") || nome.includes("youperforma")) grupo = "YOUperforma";
    else if (nome.includes("youeduca")) grupo = "YOUeduca";
    else if (nome.includes("yourh") || nome.includes("sistema_de_rh")) grupo = "YOUrh";
    
    if (!breakdown_google[grupo]) breakdown_google[grupo] = criarObjetoBreakdown(grupo);
    breakdown_google[grupo].investimento += g.investimento;
  });
  
  resumo_mes.total_investimento = resumo_mes.investimento_meta + resumo_mes.investimento_google;
  
  // Processar Leads
  leads.forEach(l => {
    resumo_mes.leads++;
    if (l.isAgendamento) resumo_mes.agendamentos++;
    if (l.isAGQ) resumo_mes.agq++;
    if (l.isTentativa) resumo_mes.tentativa++;
    if (l.isDescartado) resumo_mes.descartado++;
    
    // Série Diária
    if (!serie_diaria[l.data]) serie_diaria[l.data] = criarObjetoDia(l.data);
    serie_diaria[l.data].leads++;
    if (l.isAgendamento) serie_diaria[l.data].agendamentos++;
    if (l.isAGQ) serie_diaria[l.data].agq++;
    if (l.isTentativa) serie_diaria[l.data].tentativa++;
    if (l.isDescartado) serie_diaria[l.data].descartado++;
    
    // Breakdown
    if (l.origem.includes("google")) {
      let grupo = "Outros";
      const nomeCamp = (l.campanha || "").toLowerCase();
      if (nomeCamp.includes("avaliacao") || nomeCamp.includes("performa")) grupo = "YOUperforma";
      else if (nomeCamp.includes("educa")) grupo = "YOUeduca";
      else if (nomeCamp.includes("rh")) grupo = "YOUrh";
      
      if (!breakdown_google[grupo]) breakdown_google[grupo] = criarObjetoBreakdown(grupo);
      breakdown_google[grupo].leads++;
      if (l.isAgendamento) breakdown_google[grupo].agendamentos++;
      if (l.isAGQ) breakdown_google[grupo].agq++;
    } else {
      // Meta (ou outros) por Público
      const publico = l.publico || "Desconhecido";
      if (!breakdown_meta[publico]) breakdown_meta[publico] = criarObjetoBreakdown(publico);
      breakdown_meta[publico].leads++;
      if (l.isAgendamento) breakdown_meta[publico].agendamentos++;
      if (l.isAGQ) breakdown_meta[publico].agq++;
      
      // Atribuir investimento proporcional ou direto se possível (simplificado aqui por público)
      // Nota: Atribuição de investimento Meta por público em LEADS GERAIS exige match com META ADS.
      // Aqui somamos o investimento total do Meta no breakdown global do Meta se necessário.
    }
  });

  // Cálculos de Pace
  const hoje = new Date();
  const diaAtual = hoje.getFullYear() === ANO_ALVO && hoje.getMonth() === MES_ALVO ? hoje.getDate() : 30; // Se não for abril, assume fim do mês para teste
  const totalDiasMes = new Date(ANO_ALVO, MES_ALVO + 1, 0).getDate();
  const diasRestantes = totalDiasMes - diaAtual;
  
  const pace = {
    dias_corridos: diaAtual,
    dias_restantes: diasRestantes,
    leads_necessarios_por_dia: Math.max(0, (metas.leads - resumo_mes.leads) / (diasRestantes || 1)),
    agendamentos_necessarios_por_dia: Math.max(0, (metas.agendamentos - resumo_mes.agendamentos) / (diasRestantes || 1)),
    agq_necessarios_por_dia: Math.max(0, (metas.agq - resumo_mes.agq) / (diasRestantes || 1)),
    leads_media_atual_por_dia: resumo_mes.leads / diaAtual,
    agendamentos_media_atual_por_dia: resumo_mes.agendamentos / diaAtual,
    agq_media_atual_por_dia: resumo_mes.agq / diaAtual
  };

  return {
    metas,
    resumo_mes: {
      ...resumo_mes,
      cpl: resumo_mes.leads > 0 ? resumo_mes.total_investimento / resumo_mes.leads : 0,
      cplag: resumo_mes.agendamentos > 0 ? resumo_mes.total_investimento / resumo_mes.agendamentos : 0
    },
    pace,
    serie_diaria: Object.values(serie_diaria).sort((a,b) => a.data.localeCompare(b.data)),
    breakdown_google: Object.values(breakdown_google),
    breakdown_meta: Object.values(breakdown_meta),
    updated_at: new Date().toISOString()
  };
}

function criarObjetoDia(data) {
  return { data, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, investimento: 0 };
}

function criarObjetoBreakdown(nome) {
  return { nome, leads: 0, agendamentos: 0, agq: 0, investimento: 0 };
}
