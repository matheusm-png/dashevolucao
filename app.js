// ============================================================
// DASHBOARD EVOLUÇÃO — app.js
// ============================================================

// ⚠️ Substitua pela URL do seu Web App publicado no Apps Script
// Em produção (Netlify) o proxy /api/dados evita CORS.
// Para testar localmente, troque por a URL completa do Apps Script.
const APPS_SCRIPT_URL = '/api/dados';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

let chartEvolucao = null;
let dadosGlobais  = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-refresh').addEventListener('click', () => {
    carregarDados();
  });

  carregarDados();
  setInterval(carregarDados, REFRESH_INTERVAL_MS);
});

// ============================================================
// FETCH PRINCIPAL
// ============================================================

async function carregarDados() {
  mostrarLoading(true);
  esconderErro();

  const btn = document.getElementById('btn-refresh');
  btn.classList.add('spinning');

  try {
    const resp = await fetch(APPS_SCRIPT_URL, { cache: 'no-store' });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

    const dados = await resp.json();

    if (dados.error) throw new Error(dados.message || 'Erro no servidor');

    dadosGlobais = dados;
    renderizar(dados);
    atualizarTimestamp();
    mostrarConteudo();

  } catch (err) {
    console.error('[Dashboard] Falha ao carregar:', err);
    mostrarErro(err.message);
  } finally {
    mostrarLoading(false);
    btn.classList.remove('spinning');
  }
}

// ============================================================
// RENDERIZAÇÃO COMPLETA
// ============================================================

function renderizar(d) {
  renderizarHeader(d);
  renderizarBigNumbers(d);
  renderizarPace(d);
  renderizarGrafico(d);
  renderizarPlataformas(d);
}

// ============================================================
// HEADER — Mês de referência
// ============================================================

function renderizarHeader(d) {
  const agora = new Date();
  const mesRef = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  document.getElementById('mes-referencia').textContent = mesRef;
}

// ============================================================
// BLOCO 1 — BIG NUMBERS
// ============================================================

function renderizarBigNumbers(d) {
  const r = d.resumo_mes;
  const m = d.metas;

  // Investimento
  setText('bn-invest', formatBRL(d.investimento_total_mes));
  setText('bn-invest-meta',   'Meta ' + formatBRL(r.investimento_meta));
  setText('bn-invest-google', 'Google ' + formatBRL(r.investimento_google));

  // CPL
  setText('bn-cpl',     formatBRL(r.cpl));
  setText('bn-cpl-max', formatBRL(m.cpl_max));
  setCardStatus('card-cpl', r.cpl, m.cpl_max, /* inverso */ true);

  // CPLag
  setText('bn-cplag',     formatBRL(r.cplag));
  setText('bn-cplag-max', formatBRL(m.cplag_max));
  setCardStatus('card-cplag', r.cplag, m.cplag_max, /* inverso */ true);

  // Leads / Agendamentos / AGQ
  setText('bn-leads',        r.leads);
  setText('bn-leads-meta',   m.leads);
  setText('bn-agendamentos', r.agendamentos);
  setText('bn-ag-meta',      m.agendamentos);
  setText('bn-agq',          r.agq);
  setText('bn-agq-meta',     m.agq);
}

/**
 * Aplica classe de status ao card.
 * invertido = true: abaixo do limite é bom (CPL/CPLag)
 */
function setCardStatus(cardId, atual, limite, invertido) {
  const card = document.getElementById(cardId);
  card.classList.remove('status-ok', 'status-bad');
  if (atual === 0) return;
  const ok = invertido ? atual <= limite : atual >= limite;
  card.classList.add(ok ? 'status-ok' : 'status-bad');
}

// ============================================================
// BLOCO 2 — PACE
// ============================================================

function renderizarPace(d) {
  const p = d.pace;
  const m = d.metas;
  const r = d.resumo_mes;

  setText('pace-dias-corridos',   p.dias_corridos + ' dias corridos');
  setText('pace-dias-restantes',  p.dias_restantes + ' dias restantes');

  // Leads
  preencherLinhaPace({
    meta:        m.leads,
    acumulado:   r.leads,
    mediaAtual:  p.leads_media_atual_por_dia,
    mediaNec:    p.leads_necessarios_por_dia,
    ids: {
      meta:       'pr-leads-meta',
      acum:       'pr-leads-acum',
      pct:        'pr-leads-pct',
      mediaAtual: 'pr-leads-media-atual',
      mediaNec:   'pr-leads-media-nec',
      status:     'pr-leads-status',
    }
  });

  // Agendamentos
  preencherLinhaPace({
    meta:        m.agendamentos,
    acumulado:   r.agendamentos,
    mediaAtual:  p.agendamentos_media_atual_por_dia,
    mediaNec:    p.agendamentos_necessarios_por_dia,
    ids: {
      meta:       'pr-ag-meta',
      acum:       'pr-ag-acum',
      pct:        'pr-ag-pct',
      mediaAtual: 'pr-ag-media-atual',
      mediaNec:   'pr-ag-media-nec',
      status:     'pr-ag-status',
    }
  });

  // AGQ
  preencherLinhaPace({
    meta:        m.agq,
    acumulado:   r.agq,
    mediaAtual:  p.agq_media_atual_por_dia,
    mediaNec:    p.agq_necessarios_por_dia,
    ids: {
      meta:       'pr-agq-meta',
      acum:       'pr-agq-acum',
      pct:        'pr-agq-pct',
      mediaAtual: 'pr-agq-media-atual',
      mediaNec:   'pr-agq-media-nec',
      status:     'pr-agq-status',
    }
  });
}

function preencherLinhaPace({ meta, acumulado, mediaAtual, mediaNec, ids }) {
  const pct = meta > 0 ? (acumulado / meta) * 100 : 0;

  setText(ids.meta,       meta);
  setText(ids.acum,       acumulado);
  setText(ids.pct,        formatPct(pct));
  setText(ids.mediaAtual, formatDecimal(mediaAtual));
  setText(ids.mediaNec,   formatDecimal(mediaNec));

  // Status
  const el = document.getElementById(ids.status);
  let badge, label;

  if (mediaNec === 0) {
    // Meta atingida
    badge = 'badge-green';
    label = '🟢 Meta atingida';
  } else if (mediaAtual >= mediaNec) {
    badge = 'badge-green';
    label = '🟢 On Track';
  } else if (mediaAtual >= mediaNec * 0.8) {
    badge = 'badge-yellow';
    label = '🟡 Risco';
  } else {
    badge = 'badge-red';
    label = '🔴 Behind';
  }

  el.innerHTML = `<span class="status-badge ${badge}">${label}</span>`;
}

// ============================================================
// BLOCO 3 — GRÁFICO EVOLUÇÃO DIÁRIA
// ============================================================

function renderizarGrafico(d) {
  const serie   = d.serie_diaria;
  const metas   = d.metas;
  const hoje    = new Date();
  const totalDias = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  const labels        = serie.map(s => formatDataLabel(s.data));
  const dataLeads     = serie.map(s => s.leads);
  const dataAg        = serie.map(s => s.agendamentos);
  const dataAGQ       = serie.map(s => s.agq);

  // Pace ideal: linha reta de 0 até a meta ao longo do mês
  const paceLeads = serie.map((_, i) => parseFloat(((metas.leads / totalDias) * (i + 1)).toFixed(1)));
  const paceAg    = serie.map((_, i) => parseFloat(((metas.agendamentos / totalDias) * (i + 1)).toFixed(1)));
  const paceAGQ   = serie.map((_, i) => parseFloat(((metas.agq / totalDias) * (i + 1)).toFixed(1)));

  const ctx = document.getElementById('chart-evolucao').getContext('2d');

  if (chartEvolucao) {
    chartEvolucao.destroy();
  }

  chartEvolucao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Leads',
          data: dataLeads,
          borderColor: '#4f8ef7',
          backgroundColor: 'rgba(79,142,247,0.08)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Agendamentos',
          data: dataAg,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.06)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'AGQ',
          data: dataAGQ,
          borderColor: '#9b6df7',
          backgroundColor: 'rgba(155,109,247,0.06)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Pace Leads',
          data: paceLeads,
          borderColor: 'rgba(79,142,247,0.35)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
        {
          label: 'Pace Agend.',
          data: paceAg,
          borderColor: 'rgba(34,197,94,0.35)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
        {
          label: 'Pace AGQ',
          data: paceAGQ,
          borderColor: 'rgba(155,109,247,0.35)',
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#8b90a8',
            font: { size: 11, family: 'Segoe UI, system-ui, sans-serif' },
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
          }
        },
        tooltip: {
          backgroundColor: '#1c2030',
          borderColor: '#2a2f42',
          borderWidth: 1,
          titleColor: '#e8eaf0',
          bodyColor: '#8b90a8',
          padding: 12,
          callbacks: {
            title: (items) => items[0].label,
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(42,47,66,0.6)' },
          ticks: {
            color: '#555c7a',
            font: { size: 10 },
            maxTicksLimit: 15,
          }
        },
        y: {
          grid: { color: 'rgba(42,47,66,0.6)' },
          ticks: {
            color: '#555c7a',
            font: { size: 10 },
          },
          beginAtZero: true,
        }
      }
    }
  });
}

// ============================================================
// BLOCO 4 — INVESTIMENTO POR PLATAFORMA
// ============================================================

function renderizarPlataformas(d) {
  const r = d.resumo_mes;
  const total = d.investimento_total_mes || 1;

  const pctMeta   = total > 0 ? (r.investimento_meta   / total * 100) : 0;
  const pctGoogle = total > 0 ? (r.investimento_google / total * 100) : 0;

  setText('plat-meta-valor',   formatBRL(r.investimento_meta));
  setText('plat-google-valor', formatBRL(r.investimento_google));
  setText('plat-meta-pct',     formatPct(pctMeta));
  setText('plat-google-pct',   formatPct(pctGoogle));

  document.getElementById('plat-meta-bar').style.width   = pctMeta   + '%';
  document.getElementById('plat-google-bar').style.width = pctGoogle + '%';
}

// ============================================================
// UI HELPERS
// ============================================================

function mostrarLoading(show) {
  document.getElementById('loading').classList.toggle('hidden', !show);
}

function mostrarConteudo() {
  document.getElementById('main-content').classList.remove('hidden');
}

function mostrarErro(msg) {
  document.getElementById('error-msg').textContent = msg || 'Falha ao carregar os dados.';
  document.getElementById('error-box').classList.remove('hidden');
  document.getElementById('main-content').classList.add('hidden');
}

function esconderErro() {
  document.getElementById('error-box').classList.add('hidden');
}

function atualizarTimestamp() {
  const agora = new Date();
  const str = agora.toLocaleDateString('pt-BR') + ' às ' +
              agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('last-update').textContent = 'Atualizado em ' + str;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}

// ============================================================
// FORMATAÇÃO
// ============================================================

function formatBRL(valor) {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(valor) {
  if (valor === null || valor === undefined) return '—';
  return valor.toFixed(1) + '%';
}

function formatDecimal(valor) {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatDataLabel(dataStr) {
  // '2026-04-01' → '01/04'
  if (!dataStr) return '';
  const parts = dataStr.split('-');
  if (parts.length < 3) return dataStr;
  return parts[2] + '/' + parts[1];
}
