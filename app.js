/**
 * DASHBOARD PERFORMANCE — Scroll único
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwNIl3WoIo3cAAHt6wexcMjs0EovvWZW4LvQYPXXd0QLp3Wt_-UlXFRmcqgfujCx6lV/exec';

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setInterval(fetchData, 5 * 60 * 1000);
    document.getElementById('refresh-btn').addEventListener('click', fetchData);
});

async function fetchData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        renderDashboard(data);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    } finally {
        showLoading(false);
    }
}

function renderDashboard(data) {
    const { resumo_mes, pace, serie_semanal, breakdown_meta_obj, breakdown_meta_cri, breakdown_google, serie_diaria, updated_at, metas } = data;

    // Topbar
    document.getElementById('update-time').innerText = new Date(updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('top-inv').innerText   = formatCurrency(resumo_mes.total_inv);
    document.getElementById('top-leads').innerText = resumo_mes.leads;
    document.getElementById('top-ag').innerText    = resumo_mes.agendamentos;
    document.getElementById('top-agq').innerText   = resumo_mes.agq;
    document.getElementById('top-cpl').innerText   = formatCurrency(resumo_mes.cpl);
    document.getElementById('top-cplag').innerText = formatCurrency(resumo_mes.cplag);

    // Seção 1: Funil + Pace
    renderFunnel(resumo_mes);
    renderPace(resumo_mes, metas, pace);

    // Seção 2: Evolução diária
    renderMainChart(serie_diaria);

    // Seção 3: Meta Ads
    renderDonutChart('objDonutChart', breakdown_meta_obj, ['#6366f1','#a855f7','#ec4899','rgba(255,255,255,0.1)']);
    renderBarChart('criBarChart', breakdown_meta_cri);
    renderTable('table-meta-obj', breakdown_meta_obj);

    // Seção 4: Google Ads
    renderDonutChart('googleDonutChart', breakdown_google, ['#10b981','#f59e0b','#6366f1','rgba(255,255,255,0.1)']);
    renderLeadsBarChart('googleLeadsChart', breakdown_google);
    renderTable('table-google', breakdown_google);

    // Seção 5: Semanal
    renderWeeklyHeatmap(serie_semanal);
}

// ── FUNIL ─────────────────────────────────────────────────
function renderFunnel(r) {
    const leads = r.leads || 1;
    const ag    = r.agendamentos || 0;
    const agq   = r.agq || 0;
    const tent  = r.tentativa || 0;
    const desc  = r.descartado || 0;

    updateStage('stage-leads', 100,                   leads, null);
    updateStage('stage-ag',    ag / leads * 100,       ag,    `Conv: ${(ag/leads*100).toFixed(1)}%`);
    updateStage('stage-agq',   agq / leads * 100,      agq,   `Quali: ${(agq/(ag||1)*100).toFixed(1)}%`);
    updateStage('stage-tent',  tent / leads * 100,     tent,  null);
    updateStage('stage-desc',  desc / leads * 100,     desc,  null);

    const taxaEl = document.getElementById('desc-taxa');
    if (taxaEl) taxaEl.innerText = `Taxa: ${(desc/leads*100).toFixed(1)}%`;
}

function updateStage(id, perc, val, tag) {
    const stage = document.getElementById(id);
    if (!stage) return;
    stage.querySelector('.fill').style.width = Math.min(perc, 100) + '%';
    stage.querySelector('p').innerText = val;
    const tagEl = stage.querySelector('.conversion-tag');
    if (tagEl && tag) tagEl.innerText = tag;
}

// ── PACE ATÉ O FIM DO MÊS ─────────────────────────────────
function renderPace(r, metas, pace) {
    // Dias restantes info
    const diasInfoEl = document.getElementById('pace-dias-info');
    if (diasInfoEl && pace) {
        diasInfoEl.innerHTML = `
            <span class="pdi pdi-corrido"><i data-lucide="calendar-days"></i> ${pace.dias_corridos_restantes} dias corridos</span>
            <span class="pdi pdi-util"><i data-lucide="briefcase"></i> ${pace.dias_uteis_restantes} dias úteis</span>
        `;
    }

    // Fallback se backend não retornou pace ainda
    const pData = pace || {
        leads:        { meta: metas.leads||0,        realizado: r.leads,        faltam: Math.max(0,(metas.leads||0)-r.leads),        pace_dia: 0 },
        agendamentos: { meta: metas.agendamentos||0, realizado: r.agendamentos, faltam: Math.max(0,(metas.agendamentos||0)-r.agendamentos), pace_dia: 0 },
        agq:          { meta: metas.agq||0,          realizado: r.agq,          faltam: Math.max(0,(metas.agq||0)-r.agq),          pace_dia: 0 },
        feriados: []
    };

    setPaceRow('leads', pData.leads);
    setPaceRow('ag',    pData.agendamentos);
    setPaceRow('agq',   pData.agq);

    // Feriados
    const ferEl = document.getElementById('pace-feriados-note');
    if (ferEl && pData.feriados && pData.feriados.length > 0) {
        ferEl.innerHTML = `<i data-lucide="calendar-x-2"></i> Feriados: ${pData.feriados.join(' · ')}`;
    }

    lucide.createIcons();
}

function setPaceRow(prefix, d) {
    const pct      = Math.min((d.realizado / (d.meta || 1)) * 100, 100);
    const atingido = d.faltam === 0;

    const countEl  = document.getElementById(`pr-${prefix}-count`);
    const barEl    = document.getElementById(`pr-${prefix}-bar`);
    const faltamEl = document.getElementById(`pr-${prefix}-faltam`);
    const paceEl   = document.getElementById(`pr-${prefix}-pace`);
    const mediaEl  = document.getElementById(`pr-${prefix}-media`);

    if (countEl)  countEl.innerText = `${d.realizado} / ${d.meta}`;
    if (barEl)    barEl.style.width = `${pct}%`;

    if (faltamEl) {
        faltamEl.innerText = atingido ? '✓ Meta atingida' : `Faltam ${d.faltam}`;
        faltamEl.className = 'pr-faltam' + (atingido ? ' pr-achieved' : '');
    }

    if (paceEl) {
        paceEl.innerText   = atingido ? '—' : `Precisa ${d.pace_dia.toFixed(1)}/dia`;
        paceEl.className   = 'pr-pace' + (d.pace_dia > 5 ? ' pr-pace-hot' : d.pace_dia > 2 ? ' pr-pace-warm' : '');
    }

    if (mediaEl && d.media_atual != null) {
        mediaEl.innerText  = `Atual ${d.media_atual.toFixed(1)}/dia`;
        // Verde se média atual >= pace necessário (on track), vermelho se abaixo
        const onTrack = d.media_atual >= d.pace_dia;
        mediaEl.className  = 'pr-media-atual' + (atingido ? '' : onTrack ? ' pr-media-ok' : ' pr-media-low');
    }
}

// ── EVOLUÇÃO DIÁRIA ───────────────────────────────────────
function renderMainChart(serie) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    if (charts['main']) charts['main'].destroy();

    const labels = serie.map(s => s.data.split('-')[2] + '/' + s.data.split('-')[1]);

    charts['main'] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Leads',        data: serie.map(s => s.leads),        borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)',  fill: true, tension: 0.4, pointRadius: 3 },
                { label: 'Agendamentos', data: serie.map(s => s.agendamentos), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.06)',  fill: true, tension: 0.4, pointRadius: 3 },
                { label: 'AGQ',          data: serie.map(s => s.agq),          borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)',  fill: true, tension: 0.4, pointRadius: 3 },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#8a8f98', usePointStyle: true, font: { size: 11 } } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a8f98' }, beginAtZero: true },
                x: { grid: { display: false }, ticks: { color: '#8a8f98' } }
            }
        }
    });
}

// ── DONUT ─────────────────────────────────────────────────
function renderDonutChart(id, items, colors) {
    const ctx = document.getElementById(id).getContext('2d');
    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: items.map(i => i.nome),
            datasets: [{ data: items.map(i => i.investimento), backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
            cutout: '68%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8a8f98', usePointStyle: true, font: { size: 10 }, padding: 14 } },
                tooltip: { callbacks: { label: (c) => ` ${c.label}: ${formatCurrency(c.raw)}` } }
            }
        }
    });
}

// ── BAR CRIATIVOS ─────────────────────────────────────────
function renderBarChart(id, items) {
    const ctx = document.getElementById(id).getContext('2d');
    if (charts[id]) charts[id].destroy();

    const sorted = [...items].sort((a, b) => b.leads - a.leads).slice(0, 6);

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(i => i.nome),
            datasets: [
                { label: 'Leads',        data: sorted.map(i => i.leads),        backgroundColor: '#6366f1', borderRadius: 4 },
                { label: 'Agendamentos', data: sorted.map(i => i.agendamentos), backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'AGQ',          data: sorted.map(i => i.agq),          backgroundColor: '#f59e0b', borderRadius: 4 },
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { labels: { color: '#8a8f98', usePointStyle: true, font: { size: 10 }, boxWidth: 8 } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a8f98' }, beginAtZero: true },
                y: { grid: { display: false }, ticks: { color: '#8a8f98', font: { size: 10 } } }
            }
        }
    });
}

// ── BAR LEADS GOOGLE ──────────────────────────────────────
function renderLeadsBarChart(id, items) {
    const ctx = document.getElementById(id).getContext('2d');
    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: items.map(i => i.nome),
            datasets: [
                { label: 'Leads',        data: items.map(i => i.leads),        backgroundColor: '#10b981', borderRadius: 5 },
                { label: 'Agendamentos', data: items.map(i => i.agendamentos), backgroundColor: '#6366f1', borderRadius: 5 },
                { label: 'AGQ',          data: items.map(i => i.agq),          backgroundColor: '#f59e0b', borderRadius: 5 },
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#8a8f98', usePointStyle: true, font: { size: 10 } } } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#8a8f98' } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a8f98' }, beginAtZero: true }
            }
        }
    });
}

// ── TABELAS ───────────────────────────────────────────────
function renderTable(tableId, items) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    tbody.innerHTML = items.map(item => {
        const cpl = item.leads > 0 ? formatCurrency(item.investimento / item.leads) : '—';
        return `<tr>
            <td>${item.nome}</td>
            <td>${formatCurrency(item.investimento)}</td>
            <td>${item.leads}</td>
            <td>${item.agendamentos}</td>
            <td>${item.agq}</td>
            <td>${item.tentativa}</td>
            <td>${item.descartado}</td>
            <td>${cpl}</td>
        </tr>`;
    }).join('');
}

// ── HEATMAP SEMANAL ───────────────────────────────────────
function renderWeeklyHeatmap(weeks) {
    const container = document.getElementById('weekly-heatmap-container');
    container.innerHTML = weeks.map((w, i) => `
        <div class="week-card">
            <span class="w-title">Semana ${i + 1}</span>
            <div class="w-leads">${w.leads}</div>
            <div class="w-detail">
                <span class="w-ag">${w.agendamentos} Ag.</span>
                <span class="w-agq">${w.agq} AGQ</span>
                <span class="w-inv">${formatCurrency(w.investimento)}</span>
            </div>
        </div>
    `).join('');
}

// ── HELPERS ───────────────────────────────────────────────
function formatCurrency(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if (show) {
        el.style.display = 'flex';
        el.style.opacity = '1';
    } else {
        el.style.opacity = '0';
        setTimeout(() => { el.style.display = 'none'; }, 400);
    }
}
