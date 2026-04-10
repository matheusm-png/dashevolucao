/**
 * DASHBOARD DE PERFORMANCE - ABRIL 2026
 * Backend Google Apps Script - V7 (Filtragem Avançada por Objetivo/Criativo)
 */

const SPREADSHEET_ID = '1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8';
const ANO_ALVO = 2026;
const MES_ALVO = 3;

function doGet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const metas = getMetas(ss);
    const midia = getDadosMidia(ss);
    const leads = filterByMonth(ss.getSheetByName('LEADS GERAIS')); 
    const agendamentos = filterByMonth(ss.getSheetByName('AGENDAMENTO'));
    const agqs = filterByMonth(ss.getSheetByName('AGQ'));
    
    const response = processarDashboard(metas, midia, leads, agendamentos, agqs);
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: e.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** MAPEAMENTO DE CRIATIVO (Baseado no seu Excel) */
function classificarCriativo(nome) {
  const n = (nome || "").toString().toLowerCase();
  if (n.includes("uc motion") || n.includes("ucmotion")) return "UC motion";
  if (n.includes("let") || n.includes("t&d")) return "Let T&D";
  if (n.includes("jordana")) return "Jordana";
  if (n.includes("anna")) return "Anna 2";
  if (n.includes("prova social") || n.includes("depoimento")) return "Prova Social";
  return "Outros";
}

/** MAPEAMENTO DE OBJETIVO (Público Meta) */
function classificarObjetivo(publico) {
  const p = (publico || "").toString().toLowerCase();
  if (p.includes("intfrio") || p.includes("inteiro")) return "Int Frio";
  if (p.includes("lal") || p.includes("semelhante")) return "Semelhante";
  if (p.includes("rmkt")) return "RMKT";
  return "Outros";
}

/** MAPEAMENTO DE GOOGLE */
function classificarGoogle(nome) {
  const n = (nome || "").toString().toLowerCase();
  if (n.includes("performa") || n.includes("desempenho") || n.includes("aval")) return "Avaliacao de desempenho";
  if (n.includes("educa") || n.includes("jordana")) return "YouEduca";
  if (n.includes("rh") || n.includes("sistema")) return "YouRH";
  return "Outros";
}

function getDadosMidia(ss) {
  const metaSheet = ss.getSheetByName('META ADS');
  const googleSheet = ss.getSheetByName('GOOGLE ADS');
  const registros = { meta: [], google: [] };
  
  if (metaSheet) {
    const data = metaSheet.getDataRange().getValues();
    const headers = data[0];
    const idxDay = headers.indexOf('Day');
    const idxName = headers.indexOf('Ad Name');
    const idxCost = headers.indexOf('Amount Spent');
    for (let i = 1; i < data.length; i++) {
        const d = parseDate(data[i][idxDay]);
        if (d && d.getFullYear() === ANO_ALVO && d.getMonth() === MES_ALVO) {
          registros.meta.push({ campanha: data[i][idxName].toString(), investimento: Number(data[i][idxCost]) || 0, data: d });
        }
    }
  }
  
  if (googleSheet) {
    const data = googleSheet.getDataRange().getValues();
    const headers = data[0];
    const idxData = headers.indexOf('Data');
    const idxCamp = headers.indexOf('Campanha');
    const idxCost = headers.indexOf('Custo (R$)');
    for (let i = 1; i < data.length; i++) {
        const d = parseDate(data[i][idxData]);
        if (d && d.getFullYear() === ANO_ALVO && d.getMonth() === MES_ALVO) {
          registros.google.push({ campanha: data[i][idxCamp].toString(), investimento: Number(data[i][idxCost]) || 0, data: d });
        }
    }
  }
  return registros;
}

function filterByMonth(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = { mes: [], dataEx: -1, camp: -1, orig: -1, pub: -1, stat: -1, tipo: -1, dataP: -1 };
  headers.forEach((h, i) => {
    const head = h ? h.toString().toLowerCase().trim() : "";
    if (head === 'mês' || head === 'mes') idx.mes.push(i);
    if (head === 'data exact' || head === 'data_exact') idx.dataEx = i;
    if (head === 'campanha') idx.camp = i;
    if (head === 'origem') idx.orig = i;
    if (head === 'público' || head === 'publico') idx.pub = i;
    if (head === 'status') idx.stat = i;
    if (head === 'tipo') idx.tipo = i;
    if (head === 'data') idx.dataP = i;
  });

  const res = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let ehAbril = false;
    idx.mes.forEach(mIdx => { if ((row[mIdx] || "").toString().toLowerCase().includes("abril 2026")) ehAbril = true; });
    if (ehAbril) {
      const d = parseDate(row[idx.dataEx] || row[idx.dataP]);
      res.push({
        data: d,
        dataStr: d ? Utilities.formatDate(d, "GMT-3", "yyyy-MM-dd") : "2026-04-01",
        origem: (row[idx.orig] || "").toString().toLowerCase().trim(),
        tipo: (row[idx.tipo] || "").toString().toLowerCase().trim(),
        campanha: (row[idx.camp] || "").toString(),
        publico: (row[idx.pub] || "").toString(),
        status: (row[idx.stat] || "").toString().toLowerCase().trim()
      });
    }
  }
  return res;
}

function processarDashboard(metas, midia, leads, agendamentos, agqs) {
  const resumo = { leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, total_inv: 0 };
  const serie_diaria = {};
  const serie_semanal = { "S1": criarObjSemana("S1"), "S2": criarObjSemana("S2"), "S3": criarObjSemana("S3"), "S4": criarObjSemana("S4"), "S5": criarObjSemana("S5") };
  
  const b_meta_obj = { "Int Frio": objB("Int Frio"), "Semelhante": objB("Semelhante"), "RMKT": objB("RMKT"), "Outros": objB("Outros") };
  const b_meta_cri = { "UC motion": objB("UC motion"), "Let T&D": objB("Let T&D"), "Jordana": objB("Jordana"), "Anna 2": objB("Anna 2"), "Prova Social": objB("Prova Social"), "Outros": objB("Outros") };
  const b_google = { "Avaliacao de desempenho": objB("Avaliacao de desempenho"), "YouEduca": objB("YouEduca"), "YouRH": objB("YouRH"), "Outros": objB("Outros") };
  const b_organico = { "Desconhecido": objB("Desconhecido"), "Google": objB("Google"), "Instagram": objB("Instagram"), "Outros": objB("Outros") };

  // Investimento
  midia.google.forEach(g => {
    const p = classificarGoogle(g.campanha);
    b_google[p].investimento += g.investimento;
    resumo.total_inv += g.investimento;
    const s = getSemana(g.data); serie_semanal[s].investimento += g.investimento;
    const ds = Utilities.formatDate(g.data, "GMT-3", "yyyy-MM-dd");
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += g.investimento;
  });
  midia.meta.forEach(m => {
    const obj = classificarObjetivo(m.campanha); b_meta_obj[obj].investimento += m.investimento;
    const cri = classificarCriativo(m.campanha); b_meta_cri[cri].investimento += m.investimento;
    resumo.total_inv += m.investimento;
    const s = getSemana(m.data); serie_semanal[s].investimento += m.investimento;
    const ds = Utilities.formatDate(m.data, "GMT-3", "yyyy-MM-dd");
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += m.investimento;
  });

  // Leads
  leads.forEach(l => {
    const s = getSemana(l.data);
    const ds = l.dataStr;
    resumo.leads++; if (l.status === "em tentativa") resumo.tentativa++; if (l.status === "descartado") resumo.descartado++;
    serie_semanal[s].leads++; if (l.status === "em tentativa") serie_semanal[s].tentativa++; if (l.status === "descartado") serie_semanal[s].descartado++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].leads++;

    if (l.origem === "pago") {
      if (l.tipo.includes("google")) {
        const p = classificarGoogle(l.campanha); b_google[p].leads++; if (l.status === "em tentativa") b_google[p].tentativa++; if (l.status === "descartado") b_google[p].descartado++;
      } else {
        const obj = classificarObjetivo(l.publico); b_meta_obj[obj].leads++; if (l.status === "em tentativa") b_meta_obj[obj].tentativa++; if (l.status === "descartado") b_meta_obj[obj].descartado++;
        const cri = classificarCriativo(l.campanha); b_meta_cri[cri].leads++; if (l.status === "em tentativa") b_meta_cri[cri].tentativa++; if (l.status === "descartado") b_meta_cri[cri].descartado++;
      }
    } else if (l.origem === "organico") {
      const org = classificarOrganico(l.campanha); b_organico[org].leads++; if (l.status === "em tentativa") b_organico[org].tentativa++; if (l.status === "descartado") b_organico[org].descartado++;
    }
  });

  // Agendamentos
  agendamentos.forEach(a => {
    const s = getSemana(a.data);
    resumo.agendamentos++; serie_semanal[s].agendamentos++;
    if (!serie_diaria[a.dataStr]) serie_diaria[a.dataStr] = criarDia(a.dataStr); serie_diaria[a.dataStr].agendamentos++;
    if (a.origem === "pago") {
      if (a.tipo.includes("google")) { b_google[classificarGoogle(a.campanha)].agendamentos++; } 
      else { b_meta_obj[classificarObjetivo(a.publico)].agendamentos++; b_meta_cri[classificarCriativo(a.campanha)].agendamentos++; }
    } else if (a.origem === "organico") { b_organico[classificarOrganico(a.campanha)].agendamentos++; }
  });

  // AGQs
  agqs.forEach(q => {
    const s = getSemana(q.data);
    resumo.agq++; serie_semanal[s].agq++;
    if (!serie_diaria[q.dataStr]) serie_diaria[q.dataStr] = criarDia(q.dataStr); serie_diaria[q.dataStr].agq++;
    if (q.origem === "pago") {
      if (q.tipo.includes("google")) { b_google[classificarGoogle(q.campanha)].agq++; } 
      else { b_meta_obj[classificarObjetivo(q.publico)].agq++; b_meta_cri[classificarCriativo(q.campanha)].agq++; }
    } else if (q.origem === "organico") { b_organico[classificarOrganico(q.campanha)].agq++; }
  });

  return {
    metas,
    resumo_mes: { ...resumo, cpl: resumo.leads > 0 ? (resumo.total_inv / resumo.leads) : 0, cplag: resumo.agendamentos > 0 ? (resumo.total_inv / resumo.agendamentos) : 0 },
    serie_semanal: Object.values(serie_semanal),
    breakdown_meta_obj: Object.values(b_meta_obj),
    breakdown_meta_cri: Object.values(b_meta_cri),
    breakdown_google: Object.values(b_google),
    breakdown_organico: Object.values(b_organico),
    serie_diaria: Object.values(serie_diaria).sort((a,b) => a.data.localeCompare(b.data)),
    updated_at: new Date().toISOString()
  };
}

function getSemana(d) {
  if (!d) return "S1";
  const dia = d.getDate();
  if (dia <= 7) return "S1"; if (dia <= 14) return "S2"; if (dia <= 21) return "S3"; if (dia <= 28) return "S4"; return "S5";
}
function parseDate(v) { if (v instanceof Date) return v; if (!v) return null; const p = v.toString().split('/'); if (p.length >= 2) return new Date(p[2] || 2026, p[1]-1, p[0]); return new Date(v); }
function classificarOrganico(n) { const c = (n || "").toString().toLowerCase(); if (c.includes("google")) return "Google"; if (c.includes("instagram")) return "Instagram"; return "Desconhecido"; }
function criarObjSemana(s) { return { nome: s, investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0 }; }
function objB(n) { return { nome: n, investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0 }; }
function criarDia(d) { return { data: d, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, investimento: 0 }; }
function getMetas(ss) {
  const s = ss.getSheetByName('METAS'); if(!s) return {};
  const d = s.getDataRange().getValues(); const m = {};
  d.forEach(r => { const n = r[0].toString().toLowerCase(); if (n.includes('leads')) m.leads = r[1]; if (n.includes('agendamentos')) m.agendamentos = r[1]; if (n.includes('agq')) m.agq = r[1]; });
  return m;
}
