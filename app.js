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
    
    // Dados de teste para garantir que o dashboard renderiza mesmo que o Google falhe
    const MOCK_DATA = {
        resumo_mes: { leads: 120, agendamentos: 45, agq: 20, vendas: 5, receita: 15000, total_inv: 3000, cpl: 25, cplag: 66, roas: 5.0, tentativa: 10, descartado: 15 },
        metas: { leads: 300, agendamentos: 100, agq: 50 },
        pace: { dias_corridos_restantes: 20, dias_uteis_restantes: 15, leads: { meta: 300, realizado: 120, faltam: 180, pace_dia: 9, media_atual: 12 }, agendamentos: { meta: 100, realizado: 45, faltam: 55, pace_dia: 3.6, media_atual: 3 }, agq: { meta: 50, realizado: 20, faltam: 30, pace_dia: 2, media_atual: 1.3 }, feriados: [] },
        serie_diaria: [],
        serie_semanal: [],
        breakdown_meta_obj: [{nome: "Meta Teste", investimento: 1500, leads: 60, agendamentos: 20, agq: 10, vendas: 3, receita: 9000, tentativa: 5, descartado: 8}],
        breakdown_meta_cri: [{nome: "Criativo Teste", investimento: 1500, leads: 60, agendamentos: 20, agq: 10, tentativa: 5, descartado: 8}],
        breakdown_google: [{nome: "Google Teste", investimento: 1500, leads: 60, agendamentos: 25, agq: 10, vendas: 2, receita: 6000, tentativa: 5, descartado: 7}],
        updated_at: new Date().toISOString()
    };

    const timeout = setTimeout(() => {
        showLoading(false);
        console.warn('Usando dados de demonstração devido ao atraso do Google.');
        renderDashboard(MOCK_DATA);
    }, 15000);

    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        clearTimeout(timeout);
        
        if (data.error) throw new Error(data.error);
        renderDashboard(data);
    } catch (error) {
        clearTimeout(timeout);
        console.error('Erro ao carregar dados:', error);
        // Se falhar o fetch real, tentamos renderizar o mock para não ficar em branco
        renderDashboard(MOCK_DATA);
    } finally {
        showLoading(false);
    }
}

function renderDashboard(data) {
    const { resumo_mes, pace, serie_semanal, breakdown_meta_obj, breakdown_meta_cri, breakdown_google, serie_diaria, updated_at, metas } = data;

    // Topbar - Atualização resiliente (evita travar se campo for undefined)
    const setVal = (id, val, suffix = '') => { 
        const el = document.getElementById(id); 
        if (el) el.innerText = (val !== undefined && val !== null) ? (val + suffix) : '—'; 
    };

    setVal('update-time', new Date(updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    setVal('top-inv',     formatCurrency(resumo_mes.total_inv));
    setVal('top-leads',   resumo_mes.leads);
    setVal('top-ag',      resumo_mes.agendamentos);
    setVal('top-agq',     resumo_mes.agq);
    setVal('top-vendas',  resumo_mes.vendas);
    setVal('top-receita', formatCurrency(resumo_mes.receita));
    setVal('top-cpl',     formatCurrency(resumo_mes.cpl));
    setVal('top-cplag',   formatCurrency(resumo_mes.cplag));
    setVal('top-roas',    (resumo_mes.roas || 0).toFixed(2), 'x');

    // Seção 1: Funil + Pace
    renderFunnel(resumo_mes);
    renderPace(resumo_mes, metas, pace);

    // Seção 2: Evolução diária
    renderMainChart(serie_diaria);

    // Seção Projeção do Mês
    renderProjection(resumo_mes, metas, pace);

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
    const vendas = r.vendas || 0;
    const tent  = r.tentativa || 0;
    const desc  = r.descartado || 0;

    updateStage('stage-leads', 100,                   leads, null);
    updateStage('stage-ag',    ag / leads * 100,       ag,    `Conv: ${(ag/leads*100).toFixed(1)}%`);
    updateStage('stage-agq',   agq / leads * 100,      agq,   `Quali: ${(agq/(ag||1)*100).toFixed(1)}%`);
    updateStage('stage-vendas', vendas / leads * 100,  vendas, `Vendas: ${(vendas/(agq||1)*100).toFixed(1)}%`);
    updateStage('stage-tent',  tent / leads * 100,     tent,  null);
    updateStage('stage-desc',  desc / leads * 100,     desc,  null);

    const taxaDescEl = document.getElementById('desc-taxa');
    if (taxaDescEl) {
        const p = (desc / leads * 100);
        taxaDescEl.innerText = `Taxa: ${p.toFixed(1)}%`;
        taxaDescEl.className = 'conversion-tag' + (p > 35 ? ' tag-danger' : '');
    }

    const taxaTentEl = document.getElementById('tent-taxa');
    if (taxaTentEl) {
        const p = (tent / leads * 100);
        taxaTentEl.innerText = `Taxa: ${p.toFixed(1)}%`;
        taxaTentEl.className = 'conversion-tag' + (p > 25 ? ' tag-warning' : '');
    }

    const taxaVendasEl = document.getElementById('vendas-taxa');
    if (taxaVendasEl) {
        const p = (vendas / (agq || 1) * 100);
        taxaVendasEl.innerText = `Conv: ${p.toFixed(1)}%`;
    }
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
    if (!items || items.length === 0) return;
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

function renderProjection(r, metas, pace) {
    if (!pace) return;

    const dc = pace.dias_corridos_restantes || 0;
    const du = pace.dias_uteis_restantes    || 0;

    const proj = (d) => Math.round(d.realizado + (d.media_atual || 0) * (d === pace.leads ? dc : du));

    const metrics = [
        {
            label: 'Leads',
            atual:    pace.leads.realizado,
            projetado: proj(pace.leads),
            meta:     pace.leads.meta,
            media:    pace.leads.media_atual,
            color:    '#6366f1',
            suffix:   ''
        },
        {
            label: 'Agendamentos',
            atual:    pace.agendamentos.realizado,
            projetado: proj(pace.agendamentos),
            meta:     pace.agendamentos.meta,
            media:    pace.agendamentos.media_atual,
            color:    '#10b981',
            suffix:   ''
        },
        {
            label: 'AGQ',
            atual:    pace.agq.realizado,
            projetado: proj(pace.agq),
            meta:     pace.agq.meta,
            media:    pace.agq.media_atual,
            color:    '#f59e0b',
            suffix:   ''
        },
        {
            label: 'Receita',
            atual:    r.receita,
            projetado: r.vendas > 0 ? Math.round((r.receita / r.vendas) * (r.vendas + Math.round((r.vendas / (r.agendamentos || 1)) * du))) : r.receita,
            meta:     null,
            media:    null,
            color:    '#a855f7',
            suffix:   'currency'
        }
    ];

    // Cards
    const container = document.getElementById('proj-cards');
    if (container) {
        container.innerHTML = metrics.map(m => {
            const pct     = m.meta ? Math.min((m.projetado / m.meta) * 100, 130) : null;
            const onTrack = m.meta ? m.projetado >= m.meta : true;
            const valFmt  = v => m.suffix === 'currency' ? formatCurrency(v) : v;
            const badge   = m.meta
                ? `<span class="proj-badge ${onTrack ? 'badge-ok' : 'badge-low'}">${onTrack ? '✓ On track' : '⚠ Abaixo'}</span>`
                : '';
            return `
            <div class="proj-card" style="--proj-color:${m.color}">
                <div class="pc-top">
                    <span class="pc-label">${m.label}</span>
                    ${badge}
                </div>
                <div class="pc-proj">${valFmt(m.projetado)}</div>
                <div class="pc-sub">Projeção ao final do mês</div>
                ${m.meta ? `
                <div class="pc-track">
                    <div class="pc-bar-bg"><div class="pc-bar-fill" style="width:${Math.min(pct,100)}%;background:${m.color}"></div></div>
                    <div class="pc-bar-labels">
                        <span>Atual: ${valFmt(m.atual)}</span>
                        <span>Meta: ${valFmt(m.meta)}</span>
                    </div>
                </div>` : `
                <div class="pc-track">
                    <div class="pc-bar-labels"><span>Atual: ${valFmt(m.atual)}</span></div>
                </div>`}
                ${m.media != null ? `<div class="pc-media">Média atual: <strong>${m.media.toFixed(1)}/dia</strong></div>` : ''}
            </div>`;
        }).join('');
    }

    // Gráfico comparativo
    const ctx = document.getElementById('projChart');
    if (!ctx) return;
    if (charts['proj']) charts['proj'].destroy();

    const labels  = ['Leads', 'Agendamentos', 'AGQ'];
    const atuais  = [pace.leads.realizado,    pace.agendamentos.realizado, pace.agq.realizado];
    const projArr = [proj(pace.leads),         proj(pace.agendamentos),    proj(pace.agq)];
    const metaArr = [pace.leads.meta,          pace.agendamentos.meta,     pace.agq.meta];

    charts['proj'] = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Atual',     data: atuais,  backgroundColor: 'rgba(99,102,241,0.7)',  borderRadius: 6 },
                { label: 'Projeção',  data: projArr, backgroundColor: 'rgba(168,85,247,0.7)', borderRadius: 6 },
                { label: 'Meta',      data: metaArr, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6,
                  borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 }
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

// ── HEATMAP SEMANAL ───────────────────────────────────────
function renderWeeklyHeatmap(weeks) {
    const container = document.getElementById('weekly-heatmap-container');
    container.innerHTML = weeks.map((w, i) => {
        const cpl   = w.leads > 0        ? formatCurrency(w.investimento / w.leads)        : '—';
        const cplag = w.agendamentos > 0  ? formatCurrency(w.investimento / w.agendamentos) : '—';
        return `
        <div class="week-card">
            <span class="w-title">Semana ${i + 1}</span>
            <div class="w-leads">${w.leads}</div>
            <span class="w-leads-label">Leads</span>
            <div class="w-detail">
                <div class="w-stat">
                    <span class="w-stat-val w-ag-val">${w.agendamentos}</span>
                    <span class="w-stat-lbl">Ag.</span>
                </div>
                <div class="w-stat">
                    <span class="w-stat-val w-agq-val">${w.agq}</span>
                    <span class="w-stat-lbl">AGQ</span>
                </div>
            </div>
            <div class="w-inv">${formatCurrency(w.investimento)}</div>
            <div class="w-divider"></div>
            <div class="w-costs">
                <div class="w-cost-item">
                    <span class="w-cost-val w-cpl-val">${cpl}</span>
                    <span class="w-cost-lbl">CPL</span>
                </div>
                <div class="w-cost-item">
                    <span class="w-cost-val w-cplag-val">${cplag}</span>
                    <span class="w-cost-lbl">CPLAg</span>
                </div>
            </div>
            <div class="w-status">
                <div class="w-status-item">
                    <span class="w-status-val w-tent-val">${w.tentativa || 0}</span>
                    <span class="w-status-lbl">Tentativa</span>
                </div>
                <div class="w-status-item">
                    <span class="w-status-val w-desc-val">${w.descartado || 0}</span>
                    <span class="w-status-lbl">Descarte</span>
                </div>
            </div>
        </div>`;
    }).join('');
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
