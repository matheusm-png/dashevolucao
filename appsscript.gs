/**
 * DASHBOARD DE PERFORMANCE - ABRIL 2026
 * Backend Google Apps Script - V8 (Inteligência por Grupo de Anúncios)
 */

const SPREADSHEET_ID = '1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8';
const ANO_ALVO = 2026;
const MES_ALVO = 3; // 0-indexed: abril = 3

// Feriados de abril/2026 (dias do mês) — atualizar conforme calendário
const FERIADOS_MES = [18, 21]; // 18/04 Sexta-feira Santa · 21/04 Tiradentes

function calcularPace(resumo, metas) {
  const hoje = new Date();
  const ultimoDia = new Date(ANO_ALVO, MES_ALVO + 1, 0).getDate(); // 30

  // Dia de início: hoje se estivermos no mês alvo, senão dia 1 (ou passado)
  let diaInicio;
  if (hoje.getFullYear() === ANO_ALVO && hoje.getMonth() === MES_ALVO) {
    diaInicio = hoje.getDate();
  } else if (hoje < new Date(ANO_ALVO, MES_ALVO, 1)) {
    diaInicio = 1; // mês ainda não começou
  } else {
    diaInicio = ultimoDia + 1; // mês já passou
  }

  // Dias restantes (a partir de hoje inclusive)
  let diasCorridosRestantes = Math.max(0, ultimoDia - diaInicio + 1);
  let diasUteisRestantes = 0;
  for (let d = diaInicio; d <= ultimoDia; d++) {
    const dow = new Date(ANO_ALVO, MES_ALVO, d).getDay();
    if (dow !== 0 && dow !== 6 && !FERIADOS_MES.includes(d)) diasUteisRestantes++;
  }

  // Dias já passados (dias completos = ontem para trás)
  const diaPassado = diaInicio > 1 ? diaInicio - 1 : 0;
  let diasCorridosPassados = diaPassado;
  let diasUteisPassados = 0;
  for (let d = 1; d <= diaPassado; d++) {
    const dow = new Date(ANO_ALVO, MES_ALVO, d).getDay();
    if (dow !== 0 && dow !== 6 && !FERIADOS_MES.includes(d)) diasUteisPassados++;
  }

  const metaLeads = metas.leads || 0;
  const metaAg    = metas.agendamentos || 0;
  const metaAgq   = metas.agq || 0;

  const faltamLeads = Math.max(0, metaLeads - resumo.leads);
  const faltamAg    = Math.max(0, metaAg    - resumo.agendamentos);
  const faltamAgq   = Math.max(0, metaAgq   - resumo.agq);

  return {
    dias_corridos_restantes: diasCorridosRestantes,
    dias_uteis_restantes:    diasUteisRestantes,
    dias_corridos_passados:  diasCorridosPassados,
    dias_uteis_passados:     diasUteisPassados,
    feriados: FERIADOS_MES.map(d => `${String(d).padStart(2,'0')}/04`),
    leads: {
      meta: metaLeads, realizado: resumo.leads, faltam: faltamLeads,
      pace_dia:    diasCorridosRestantes > 0 ? faltamLeads       / diasCorridosRestantes : 0,
      media_atual: diasCorridosPassados  > 0 ? resumo.leads      / diasCorridosPassados  : 0
    },
    agendamentos: {
      meta: metaAg, realizado: resumo.agendamentos, faltam: faltamAg,
      pace_dia:    diasUteisRestantes > 0 ? faltamAg             / diasUteisRestantes : 0,
      media_atual: diasUteisPassados  > 0 ? resumo.agendamentos  / diasUteisPassados  : 0
    },
    agq: {
      meta: metaAgq, realizado: resumo.agq, faltam: faltamAgq,
      pace_dia:    diasUteisRestantes > 0 ? faltamAgq  / diasUteisRestantes : 0,
      media_atual: diasUteisPassados  > 0 ? resumo.agq / diasUteisPassados  : 0
    }
  };
}

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

/** Classifica OBJETIVO a partir do Ad Set Name (nível de conjunto) */
function classificarObjetivo(adSetName) {
  const t = (adSetName || "").toString().toUpperCase();
  if (t.includes("INT FRIO") || t.includes("INTFRIO")) return "Int Frio";
  if (t.includes("SEMELHANTE") || t.includes(" LAL") || t.startsWith("LAL")) return "Semelhante";
  if (t.includes("RMKT") || t.includes("REMARKETING")) return "RMKT";
  return "Outros";
}

/** Classifica CRIATIVO e PRODUTO Google a partir do Ad Name e Ad Set Name */
function classificar(anuncio, grupo, publico) {
  const fullText = `${anuncio} ${grupo} ${publico}`.toLowerCase();

  // Objetivo vem de classificarObjetivo(), não desta função
  let objetivo = "Outros";

  // Classificação de CRIATIVO
  let criativo = "Outros";
  if (fullText.includes("uc motion") || fullText.includes("ucmotion") || fullText.includes("uc_motion")) criativo = "UC motion";
  else if (fullText.includes("let") || fullText.includes("t&d")) criativo = "Let T&D";
  else if (fullText.includes("jordana")) criativo = "Jordana";
  else if (fullText.includes("anna")) criativo = "Anna 2";
  else if (fullText.includes("vini") || fullText.includes("promo")) criativo = "Vini Promo";
  else if (fullText.includes("amanda") || fullText.includes("aved") || fullText.includes("aval") || fullText.includes("tela")) criativo = "Amanda/Aval";
  else if (fullText.includes("prova social") || fullText.includes("depoimento")) criativo = "Prova Social";

  // Classificação de GOOGLE (Produto)
  let googleProd = "Outros";
  if (fullText.includes("performa") || fullText.includes("desempenho") || fullText.includes("aval")) googleProd = "Avaliacao de desempenho";
  else if (fullText.includes("educa") || fullText.includes("jordana")) googleProd = "YouEduca";
  else if (fullText.includes("rh") || fullText.includes("sistema")) googleProd = "YouRH";

  return { objetivo, criativo, googleProd };
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
    const idxGrp = headers.indexOf('Ad Set Name');
    const idxCost = headers.indexOf('Amount Spent');

    for (let i = 1; i < data.length; i++) {
        const d = parseDate(data[i][idxDay]);
        if (d && d.getFullYear() === ANO_ALVO && d.getMonth() === MES_ALVO) {
          const c = classificar(data[i][idxName], data[i][idxGrp], "");
          registros.meta.push({
            campanha: data[i][idxName].toString(),
            grupo: data[i][idxGrp].toString(),
            objetivo: classificarObjetivo(data[i][idxGrp]), // Ad Set Name = fonte do objetivo
            criativo: c.criativo,
            investimento: Number(data[i][idxCost]) || 0, 
            data: d 
          });
        }
    }
  }
  
  if (googleSheet) {
    const data = googleSheet.getDataRange().getValues();
    const headers = data[0];
    const idxData = headers.indexOf('Data');
    const idxCamp = headers.indexOf('Campanha');
    const idxGrpHeader = headers.indexOf('Grupo');
    const idxCost = headers.indexOf('Custo (R$)');

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const d = parseDate(row[idxData]);
        if (d && d.getFullYear() === ANO_ALVO && d.getMonth() === MES_ALVO) {
          const c = classificar(row[idxCamp], row[idxGrpHeader], "");
          registros.google.push({ 
            campanha: row[idxCamp].toString(), 
            investimento: Number(row[idxCost]) || 0,
            produto: c.googleProd,
            data: d 
          });
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
        campanha: (row[idx.camp] || "").toString(), // No CRM Campanha = Criativo
        publico: (row[idx.pub] || "").toString(), // No CRM Público = Objetivo
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
  const b_meta_cri = { "UC motion": objB("UC motion"), "Let T&D": objB("Let T&D"), "Jordana": objB("Jordana"), "Anna 2": objB("Anna 2"), "Vini Promo": objB("Vini Promo"), "Amanda/Aval": objB("Amanda/Aval"), "Prova Social": objB("Prova Social"), "Outros": objB("Outros") };
  const b_google = { "Avaliacao de desempenho": objB("Avaliacao de desempenho"), "YouEduca": objB("YouEduca"), "YouRH": objB("YouRH"), "Outros": objB("Outros") };
  const b_organico = { "Desconhecido": objB("Desconhecido"), "Google": objB("Google"), "Instagram": objB("Instagram"), "Outros": objB("Outros") };

  midia.google.forEach(g => {
    b_google[g.produto].investimento += g.investimento; resumo.total_inv += g.investimento;
    const s = getSemana(g.data); serie_semanal[s].investimento += g.investimento;
    const ds = Utilities.formatDate(g.data, "GMT-3", "yyyy-MM-dd"); if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += g.investimento;
  });
  midia.meta.forEach(m => {
    b_meta_obj[m.objetivo].investimento += m.investimento; b_meta_cri[m.criativo].investimento += m.investimento;
    resumo.total_inv += m.investimento;
    const s = getSemana(m.data); serie_semanal[s].investimento += m.investimento;
    const ds = Utilities.formatDate(m.data, "GMT-3", "yyyy-MM-dd"); if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += m.investimento;
  });

  leads.forEach(l => {
    const s = getSemana(l.data); const ds = l.dataStr;
    resumo.leads++; if (l.status === "em tentativa") resumo.tentativa++; if (l.status === "descartado") resumo.descartado++;
    serie_semanal[s].leads++; if (l.status === "em tentativa") serie_semanal[s].tentativa++; if (l.status === "descartado") serie_semanal[s].descartado++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].leads++;
    if (l.origem === "pago") {
      if (l.tipo.includes("google")) { const c = classificar(l.campanha, "", ""); b_google[c.googleProd].leads++; if (l.status === "em tentativa") b_google[c.googleProd].tentativa++; if (l.status === "descartado") b_google[c.googleProd].descartado++; } 
      else { const obj = classificarObjetivo(l.publico); const c = classificar(l.campanha, "", l.publico); b_meta_obj[obj].leads++; b_meta_cri[c.criativo].leads++; if (l.status === "em tentativa") b_meta_obj[obj].tentativa++; if (l.status === "descartado") b_meta_obj[obj].descartado++; }
    } else if (l.origem === "organico") { const org = classificarOrganico(l.campanha); b_organico[org].leads++; }
  });

  agendamentos.forEach(a => {
    const s = getSemana(a.data); const ds = a.dataStr;
    resumo.agendamentos++; serie_semanal[s].agendamentos++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].agendamentos++;
    if (a.origem === "pago") {
      if (a.tipo.includes("google")) { b_google[classificar(a.campanha, "", "").googleProd].agendamentos++; }
      else { const obj = classificarObjetivo(a.publico); const c = classificar(a.campanha, "", a.publico); b_meta_obj[obj].agendamentos++; b_meta_cri[c.criativo].agendamentos++; }
    } else if (a.origem === "organico") { b_organico[classificarOrganico(a.campanha)].agendamentos++; }
  });

  agqs.forEach(q => {
    const s = getSemana(q.data); const ds = q.dataStr;
    resumo.agq++; serie_semanal[s].agq++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].agq++;
    if (q.origem === "pago") {
      if (q.tipo.includes("google")) { b_google[classificar(q.campanha, "", "").googleProd].agq++; }
      else { const obj = classificarObjetivo(q.publico); const c = classificar(q.campanha, "", q.publico); b_meta_obj[obj].agq++; b_meta_cri[c.criativo].agq++; }
    } else if (q.origem === "organico") { b_organico[classificarOrganico(q.campanha)].agq++; }
  });

  const resumo_final = { ...resumo, total_investimento: resumo.total_inv, cpl: resumo.leads > 0 ? (resumo.total_inv / resumo.leads) : 0, cplag: resumo.agendamentos > 0 ? (resumo.total_inv / resumo.agendamentos) : 0 };
  return {
    metas,
    resumo_mes: resumo_final,
    pace: calcularPace(resumo_final, metas),
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
  d.forEach(r => {
    const n = r[0].toString().toLowerCase();
    if (n.includes('leads') && !n.includes('cpl')) m.leads = r[1];
    else if (n.includes('agendamentos')) m.agendamentos = r[1];
    else if (n.includes('agq')) m.agq = r[1];
    else if (n.includes('cpl max') || (n.includes('cpl') && !n.includes('cplag'))) m.cpl_max = r[1];
    else if (n.includes('cplag')) m.cplag_max = r[1];
  });
  return m;
}
