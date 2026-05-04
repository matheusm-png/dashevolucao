/**
 * DASHBOARD DE PERFORMANCE
 * Backend Google Apps Script - V8 (Inteligência por Grupo de Anúncios)
 */

const SPREADSHEET_ID = '1QMS8QfKbEvVwdIRI9zZlF_8ilO-Ap-Lmske_PZ5_m-8';

// Feriados mapeados por mês (0-indexed: 0=Jan, 1=Fev, 2=Mar, 3=Abr, 4=Mai)
const FERIADOS = {
  0: [1],      // Janeiro: Confraternização Universal
  1: [16, 17], // Fevereiro: Carnaval
  2: [],       // Março
  3: [18, 21], // Abril: Sexta-feira Santa, Tiradentes
  4: [1],      // Maio: Dia do Trabalhador
};

function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getMesNome(mesIdx) {
  return ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][mesIdx];
}

function calcularPace(resumo, metas, config) {
  if (config.isYear) return null; // Pace não faz sentido no agregado do ano

  const hoje = new Date();
  const ultimoDia = new Date(config.ano, config.mes + 1, 0).getDate();

  // Dia de início: hoje se estivermos no mês alvo, senão dia 1 (ou passado)
  let diaInicio;
  if (hoje.getFullYear() === config.ano && hoje.getMonth() === config.mes) {
    diaInicio = hoje.getDate();
  } else if (hoje < new Date(config.ano, config.mes, 1)) {
    diaInicio = 1; // mês ainda não começou
  } else {
    diaInicio = ultimoDia + 1; // mês já passou
  }

  // Dias restantes (a partir de hoje inclusive)
  let diasCorridosRestantes = Math.max(0, ultimoDia - diaInicio + 1);
  let diasUteisRestantes = 0;
  for (let d = diaInicio; d <= ultimoDia; d++) {
    const dow = new Date(config.ano, config.mes, d).getDay();
    if (dow !== 0 && dow !== 6 && !config.feriados.includes(d)) diasUteisRestantes++;
  }

  // Dias já passados (dias completos = ontem para trás)
  const diaPassado = diaInicio > 1 ? diaInicio - 1 : 0;
  let diasCorridosPassados = diaPassado;
  let diasUteisPassados = 0;
  for (let d = 1; d <= diaPassado; d++) {
    const dow = new Date(config.ano, config.mes, d).getDay();
    if (dow !== 0 && dow !== 6 && !config.feriados.includes(d)) diasUteisPassados++;
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
    feriados: config.feriados.map(d => `${String(d).padStart(2,'0')}/${String(config.mes+1).padStart(2,'0')}`),
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

function doGet(e) {
  try {
    const mesParam = (e && e.parameter && e.parameter.mes) ? e.parameter.mes : "4";
    const anoParam = (e && e.parameter && e.parameter.ano) ? parseInt(e.parameter.ano) : 2026;
    const isYear = (mesParam === 'all');
    
    const config = {
      ano: anoParam,
      mes: isYear ? null : parseInt(mesParam) - 1, // 0-indexed no JS
      isYear: isYear,
      feriados: isYear ? [] : (FERIADOS[parseInt(mesParam) - 1] || [])
    };

    const cache = CacheService.getScriptCache();
    const cacheKey = 'dash_data_' + config.ano + '_' + mesParam;
    
    const forceUpdate = (e && e.parameter && e.parameter.refresh === 'true');
    if (!forceUpdate) {
      const cached = cache.get(cacheKey);
      if (cached) {
        return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
      }
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const metas = getMetas(ss);
    const midia = getDadosMidia(ss, config);
    const leads = filterByMonth(ss.getSheetByName('LEADS GERAIS'), config);
    const agendamentos = filterByMonth(ss.getSheetByName('AGENDAMENTO'), config);
    const agqs = filterByMonth(ss.getSheetByName('AGQ'), config);
    const vendas = filterByMonth(ss.getSheetByName('VENDAS'), config);

    const response = processarDashboard(metas, midia, leads, agendamentos, agqs, vendas, config);
    const responseStr = JSON.stringify(response);
    
    cache.put(cacheKey, responseStr, 60 * 15); // Cache por 15 minutos

    return ContentService.createTextOutput(responseStr).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
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
  if (fullText.includes("performa") || fullText.includes("desempenho") || fullText.includes("aval")) googleProd = "YouPerforma";
  else if (fullText.includes("comunica")) googleProd = "YouComunica";
  else if (fullText.includes("educa")) googleProd = "YouEduca";
  else if (fullText.includes("rh") || fullText.includes("sistema")) googleProd = "YouRH";

  return { objetivo, criativo, googleProd };
}

function getDadosMidia(ss, config) {
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
        if (d && d.getFullYear() === config.ano && (config.isYear || d.getMonth() === config.mes)) {
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
        if (d && d.getFullYear() === config.ano && (config.isYear || d.getMonth() === config.mes)) {
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

function filterByMonth(sheet, config) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = { mes: [], dataEx: -1, camp: -1, orig: -1, pub: -1, stat: -1, tipo: -1, dataP: -1, valor: -1, semana: -1 };
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
    if (head === 'valor' || head === 'mrr' || head === 'faturamento') idx.valor = i;
    if (head === 'semana') idx.semana = i;
  });

  const res = [];
  const searchStr = config.isYear ? config.ano.toString() : (getMesNome(config.mes) + " " + config.ano);
  const searchStrNorm = normalizeString(searchStr);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let naCompetencia = false;
    
    idx.mes.forEach(mIdx => { 
      const cellVal = normalizeString((row[mIdx] || "").toString());
      if (cellVal.includes(searchStrNorm) || (config.isYear && cellVal.includes(config.ano.toString()))) {
         naCompetencia = true;
      }
    });

    const d = parseDate(row[idx.dataEx] || row[idx.dataP]);
    if (d && d.getFullYear() === config.ano && (config.isYear || d.getMonth() === config.mes)) {
       naCompetencia = true;
    }

    if (naCompetencia) {
      const semanaRaw = idx.semana >= 0 ? (row[idx.semana] || "").toString().trim() : "";
      const semanaNum = semanaRaw.match(/(\d)/);
      const semana = semanaNum ? "S" + semanaNum[1] : null;
      res.push({
        data: d,
        semana: semana,
        dataStr: d ? Utilities.formatDate(d, "GMT-3", "yyyy-MM-dd") : "2026-04-01",
        origem: (row[idx.orig] || "").toString().toLowerCase().trim(),
        tipo: (row[idx.tipo] || "").toString().toLowerCase().trim(),
        campanha: (row[idx.camp] || "").toString(),
        publico: (row[idx.pub] || "").toString(),
        status: (row[idx.stat] || "").toString().toLowerCase().trim(),
        valor: Number(row[idx.valor]) || 0
      });
    }
  }
  return res;
}

function processarDashboard(metas, midia, leads, agendamentos, agqs, vendas, config) {
  const resumo = { leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, total_inv: 0, vendas: 0, receita: 0 };
  const serie_diaria = {};
  const serie_semanal = { "S1": criarObjSemana("S1"), "S2": criarObjSemana("S2"), "S3": criarObjSemana("S3"), "S4": criarObjSemana("S4"), "S5": criarObjSemana("S5") };
  
  const b_meta_obj = { "Int Frio": objB("Int Frio"), "Semelhante": objB("Semelhante"), "RMKT": objB("RMKT"), "Outros": objB("Outros") };
  const b_meta_cri = { "UC motion": objB("UC motion"), "Let T&D": objB("Let T&D"), "Jordana": objB("Jordana"), "Anna 2": objB("Anna 2"), "Vini Promo": objB("Vini Promo"), "Amanda/Aval": objB("Amanda/Aval"), "Prova Social": objB("Prova Social"), "Outros": objB("Outros") };
  const b_google = { "YouPerforma": objB("YouPerforma"), "YouComunica": objB("YouComunica"), "YouEduca": objB("YouEduca"), "YouRH": objB("YouRH"), "Outros": objB("Outros") };
  const b_organico = { "Desconhecido": objB("Desconhecido"), "Google": objB("Google"), "Instagram": objB("Instagram"), "Outros": objB("Outros") };

  const semanal_meta     = { "S1": criarObjSemana("S1"), "S2": criarObjSemana("S2"), "S3": criarObjSemana("S3"), "S4": criarObjSemana("S4"), "S5": criarObjSemana("S5") };
  const semanal_google   = { "S1": criarObjSemana("S1"), "S2": criarObjSemana("S2"), "S3": criarObjSemana("S3"), "S4": criarObjSemana("S4"), "S5": criarObjSemana("S5") };
  const semanal_organico = { "S1": criarObjSemana("S1"), "S2": criarObjSemana("S2"), "S3": criarObjSemana("S3"), "S4": criarObjSemana("S4"), "S5": criarObjSemana("S5") };

  midia.google.forEach(g => {
    b_google[g.produto].investimento += g.investimento; resumo.total_inv += g.investimento;
    const s = getSemana(g.data); serie_semanal[s].investimento += g.investimento; semanal_google[s].investimento += g.investimento;
    const ds = Utilities.formatDate(g.data, "GMT-3", "yyyy-MM-dd"); if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += g.investimento;
  });
  midia.meta.forEach(m => {
    b_meta_obj[m.objetivo].investimento += m.investimento; b_meta_cri[m.criativo].investimento += m.investimento;
    resumo.total_inv += m.investimento;
    const s = getSemana(m.data); serie_semanal[s].investimento += m.investimento; semanal_meta[s].investimento += m.investimento;
    const ds = Utilities.formatDate(m.data, "GMT-3", "yyyy-MM-dd"); if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].investimento += m.investimento;
  });

  leads.forEach(l => {
    const s = l.semana || getSemana(l.data); const ds = l.dataStr;
    const isTentativa = l.status === "em tentativa" || l.status === "";
    resumo.leads++; if (isTentativa) resumo.tentativa++; if (l.status === "descartado") resumo.descartado++;
    serie_semanal[s].leads++; if (isTentativa) serie_semanal[s].tentativa++; if (l.status === "descartado") serie_semanal[s].descartado++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].leads++;
    if (l.origem === "pago") {
      if (l.tipo.includes("google")) { const c = classificar(l.campanha, "", ""); b_google[c.googleProd].leads++; if (isTentativa) b_google[c.googleProd].tentativa++; if (l.status === "descartado") b_google[c.googleProd].descartado++; semanal_google[s].leads++; if (isTentativa) semanal_google[s].tentativa++; if (l.status === "descartado") semanal_google[s].descartado++; }
      else { const obj = classificarObjetivo(l.publico); const c = classificar(l.campanha, "", l.publico); b_meta_obj[obj].leads++; b_meta_cri[c.criativo].leads++; if (isTentativa) b_meta_obj[obj].tentativa++; if (l.status === "descartado") b_meta_obj[obj].descartado++; semanal_meta[s].leads++; if (isTentativa) semanal_meta[s].tentativa++; if (l.status === "descartado") semanal_meta[s].descartado++; }
    } else if (l.origem === "organico") { const org = classificarOrganico(l.campanha); b_organico[org].leads++; semanal_organico[s].leads++; }
  });

  agendamentos.forEach(a => {
    const s = getSemana(a.data); const ds = a.dataStr;
    resumo.agendamentos++; serie_semanal[s].agendamentos++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].agendamentos++;
    if (a.origem === "pago") {
      if (a.tipo.includes("google")) { b_google[classificar(a.campanha, "", "").googleProd].agendamentos++; semanal_google[s].agendamentos++; }
      else { const obj = classificarObjetivo(a.publico); const c = classificar(a.campanha, "", a.publico); b_meta_obj[obj].agendamentos++; b_meta_cri[c.criativo].agendamentos++; semanal_meta[s].agendamentos++; }
    } else if (a.origem === "organico") { b_organico[classificarOrganico(a.campanha)].agendamentos++; semanal_organico[s].agendamentos++; }
  });

  agqs.forEach(q => {
    const s = getSemana(q.data); const ds = q.dataStr;
    resumo.agq++; serie_semanal[s].agq++;
    if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].agq++;
    if (q.origem === "pago") {
      if (q.tipo.includes("google")) { b_google[classificar(q.campanha, "", "").googleProd].agq++; semanal_google[s].agq++; }
      else { const obj = classificarObjetivo(q.publico); const c = classificar(q.campanha, "", q.publico); b_meta_obj[obj].agq++; b_meta_cri[c.criativo].agq++; semanal_meta[s].agq++; }
    } else if (q.origem === "organico") { b_organico[classificarOrganico(q.campanha)].agq++; semanal_organico[s].agq++; }
  });

  if (vendas) {
    vendas.forEach(v => {
      const s = getSemana(v.data); const ds = v.dataStr;
      resumo.vendas++; resumo.receita += v.valor;
      serie_semanal[s].vendas++; serie_semanal[s].receita += v.valor;
      if (!serie_diaria[ds]) serie_diaria[ds] = criarDia(ds); serie_diaria[ds].vendas++;
      if (v.origem === "pago") {
        if (v.tipo.includes("google")) { b_google[classificar(v.campanha, "", "").googleProd].vendas++; semanal_google[s].vendas++; }
        else { const obj = classificarObjetivo(v.publico); const c = classificar(v.campanha, "", v.publico); b_meta_obj[obj].vendas++; b_meta_cri[c.criativo].vendas++; semanal_meta[s].vendas++; }
      } else if (v.origem === "organico") { b_organico[classificarOrganico(v.campanha)].vendas++; semanal_organico[s].vendas++; }
    });
  }

  const resumo_final = { 
    ...resumo, 
    total_investimento: resumo.total_inv, 
    cpl: resumo.leads > 0 ? (resumo.total_inv / resumo.leads) : 0, 
    cplag: resumo.agendamentos > 0 ? (resumo.total_inv / resumo.agendamentos) : 0,
    roas: resumo.total_inv > 0 ? (resumo.receita / resumo.total_inv) : 0
  };


  // -------------------------------------------------------------
  // LIMPEZA E PREENCHIMENTO DO GRÁFICO DE EVOLUÇÃO DIÁRIA
  // Garante que mostre apenas o mês atual e inclua dias vazios (0)
  // -------------------------------------------------------------
  let serie_diaria_filtrada = Object.values(serie_diaria);
  
  if (!config.isYear && config.mes !== null) {
      const prefix = config.ano + "-" + String(config.mes + 1).padStart(2, '0');
      const diasDoMes = new Date(config.ano, config.mes + 1, 0).getDate();
      const mapDias = {};
      
      // Salva apenas os dias que pertencem ao mês alvo
      serie_diaria_filtrada.forEach(d => { 
        if (d.data.startsWith(prefix)) mapDias[d.data] = d; 
      });
      
      serie_diaria_filtrada = [];
      // Preenche do dia 1 ao fim do mês
      for (let d = 1; d <= diasDoMes; d++) {
          const ds = prefix + "-" + String(d).padStart(2, '0');
          serie_diaria_filtrada.push(mapDias[ds] || criarDia(ds));
      }
  } else {
      // Ano Todo: preenche todos os dias do ano para evitar buracos e linhas desconexas
      const mapDias = {};
      serie_diaria_filtrada.forEach(d => {
        if (d.data.startsWith(config.ano.toString())) mapDias[d.data] = d;
      });

      serie_diaria_filtrada = [];
      const hoje = new Date();
      // Mostra até o dia atual se for o ano corrente, senao mostra o ano todo.
      const maxDate = (config.ano === hoje.getFullYear()) ? hoje : new Date(config.ano, 11, 31);
      
      const dAtual = new Date(config.ano, 0, 1);
      while (dAtual <= maxDate) {
          const ds = Utilities.formatDate(dAtual, "GMT-3", "yyyy-MM-dd");
          serie_diaria_filtrada.push(mapDias[ds] || criarDia(ds));
          dAtual.setDate(dAtual.getDate() + 1);
      }
  }

  const resultado = {
    metas,
    resumo_mes: resumo_final,
    pace: calcularPace(resumo_final, metas, config),
    serie_semanal: Object.values(serie_semanal),
    breakdown_meta_obj: Object.values(b_meta_obj),
    breakdown_meta_cri: Object.values(b_meta_cri),
    breakdown_google: Object.values(b_google),
    breakdown_organico: Object.values(b_organico),
    serie_semanal_meta:     Object.values(semanal_meta),
    serie_semanal_google:   Object.values(semanal_google),
    serie_semanal_organico: Object.values(semanal_organico),
    serie_diaria: serie_diaria_filtrada,
    updated_at: new Date().toISOString()
  };
  
  return resultado;
}

/**
 * Calcula a semana do mês seguindo a lógica yourh:
 * - Semana começa na segunda e termina no domingo.
 * - A Semana 1 começa no dia 1 do mês (mesmo que seja quarta, sábado etc.)
 *   e vai até o primeiro domingo do mês.
 * - A Semana 2 começa na segunda seguinte e assim por diante.
 *
 * Exemplo Abril/2026 (começa quarta):
 *   S1: 01–05 | S2: 06–12 | S3: 13–19 | S4: 20–26 | S5: 27–30
 */
function getSemana(d) {
  if (!d) return "S1";
  const dia      = parseInt(Utilities.formatDate(d, "GMT-3", "d"),  10);
  const mes      = parseInt(Utilities.formatDate(d, "GMT-3", "M"),  10) - 1; // 0-indexed
  const ano      = parseInt(Utilities.formatDate(d, "GMT-3", "yyyy"), 10);

  // Dia da semana do dia 1 do mês (0=Dom, 1=Seg, ..., 6=Sáb)
  const primeiroDia    = new Date(ano, mes, 1);
  const diaSemDia1     = primeiroDia.getDay();

  // Dia do mês em que cai o primeiro domingo (= fim da Semana 1)
  const primeiroDomingo = diaSemDia1 === 0 ? 1 : 1 + (7 - diaSemDia1);

  if (dia <= primeiroDomingo) return "S1";
  const semana = 1 + Math.ceil((dia - primeiroDomingo) / 7);
  return "S" + Math.min(semana, 5);
}
function parseDate(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  const p = v.toString().split('/');
  if (p.length >= 2) return new Date(parseInt(p[2]) || 2026, parseInt(p[1]) - 1, parseInt(p[0]));
  const iso = v.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  return new Date(v);
}
function classificarOrganico(n) { const c = (n || "").toString().toLowerCase(); if (c.includes("google")) return "Google"; if (c.includes("instagram")) return "Instagram"; return "Desconhecido"; }
function criarObjSemana(s) { return { nome: s, investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }; }
function objB(n) { return { nome: n, investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }; }
function criarDia(d) { return { data: d, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0, investimento: 0 }; }
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
