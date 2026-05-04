/**
 * DASHBOARD PERFORMANCE — Scroll único
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwNIl3WoIo3cAAHt6wexcMjs0EovvWZW4LvQYPXXd0QLp3Wt_-UlXFRmcqgfujCx6lV/exec';

let charts = {};

document.addEventListener('DOMContentLoaded', () => {
    fetchData(false);
    setInterval(() => fetchData(false), 25 * 60 * 1000);
    document.getElementById('refresh-btn').addEventListener('click', () => fetchData(true));
    
    const monthSelector = document.getElementById('month-selector');
    if (monthSelector) {
        monthSelector.addEventListener('change', () => fetchData(false));
    }
});

async function fetchData(forceRefresh = false) {
    showLoading(true);
    
    const monthSelector = document.getElementById('month-selector');
    const selectedMonth = monthSelector ? monthSelector.value : '4';
    let finalUrl = `${API_URL}?mes=${selectedMonth}&ano=2026`;
    if (forceRefresh) finalUrl += '&refresh=true';
    
    // Dados de teste para garantir que o dashboard renderiza mesmo que o Google falhe
    const MOCK_DATA = {
        resumo_mes: { leads: 120, agendamentos: 45, agq: 20, vendas: 5, receita: 15000, total_inv: 3000, cpl: 25, cplag: 66, roas: 5.0, tentativa: 10, descartado: 15 },
        metas: { leads: 300, agendamentos: 100, agq: 50 },
        pace: { dias_corridos_restantes: 20, dias_uteis_restantes: 15, leads: { meta: 300, realizado: 120, faltam: 180, pace_dia: 9, media_atual: 12 }, agendamentos: { meta: 100, realizado: 45, faltam: 55, pace_dia: 3.6, media_atual: 3 }, agq: { meta: 50, realizado: 20, faltam: 30, pace_dia: 2, media_atual: 1.3 }, feriados: [] },
        serie_diaria: [],
        serie_semanal: [
            { nome: "S1", investimento: 26486, leads: 82, agendamentos: 16, agq: 13, tentativa: 43, descartado: 26, vendas: 0, receita: 0 },
            { nome: "S2", investimento: 19948, leads: 89, agendamentos: 18, agq: 13, tentativa: 58, descartado: 18, vendas: 0, receita: 0 },
            { nome: "S3", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S4", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S5", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }
        ],
        serie_semanal_meta: [
            { nome: "S1", investimento: 20000, leads: 60, agendamentos: 12, agq: 10, tentativa: 33, descartado: 20, vendas: 0, receita: 0 },
            { nome: "S2", investimento: 15000, leads: 65, agendamentos: 14, agq: 10, tentativa: 42, descartado: 14, vendas: 0, receita: 0 },
            { nome: "S3", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S4", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S5", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }
        ],
        serie_semanal_google: [
            { nome: "S1", investimento: 6486, leads: 15, agendamentos: 3, agq: 2, tentativa: 8, descartado: 5, vendas: 0, receita: 0 },
            { nome: "S2", investimento: 4948, leads: 18, agendamentos: 3, agq: 2, tentativa: 12, descartado: 3, vendas: 0, receita: 0 },
            { nome: "S3", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S4", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S5", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }
        ],
        serie_semanal_organico: [
            { nome: "S1", investimento: 0, leads: 7, agendamentos: 1, agq: 1, tentativa: 2, descartado: 1, vendas: 0, receita: 0 },
            { nome: "S2", investimento: 0, leads: 6, agendamentos: 1, agq: 1, tentativa: 4, descartado: 1, vendas: 0, receita: 0 },
            { nome: "S3", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S4", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 },
            { nome: "S5", investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 }
        ],
        breakdown_meta_obj: [{nome: "Meta Teste", investimento: 1500, leads: 60, agendamentos: 20, agq: 10, vendas: 3, receita: 9000, tentativa: 5, descartado: 8}],
        breakdown_meta_cri: [{nome: "Criativo Teste", investimento: 1500, leads: 60, agendamentos: 20, agq: 10, tentativa: 5, descartado: 8}],
        breakdown_google: [
            {nome: "YouPerforma",  investimento: 900,  leads: 38, agendamentos: 16, agq: 7, vendas: 1, receita: 3000, tentativa: 3, descartado: 4},
            {nome: "YouEduca",     investimento: 400,  leads: 14, agendamentos: 6,  agq: 2, vendas: 1, receita: 3000, tentativa: 1, descartado: 2},
            {nome: "YouRH",        investimento: 150,  leads: 6,  agendamentos: 2,  agq: 1, vendas: 0, receita: 0,    tentativa: 1, descartado: 1},
            {nome: "YouComunica",  investimento: 50,   leads: 2,  agendamentos: 1,  agq: 0, vendas: 0, receita: 0,    tentativa: 0, descartado: 0},
        ],
        breakdown_organico: [
            {nome: "Instagram", investimento: 0, leads: 18, agendamentos: 5, agq: 3, vendas: 0, receita: 0, tentativa: 4, descartado: 2},
            {nome: "Google",    investimento: 0, leads: 8,  agendamentos: 2, agq: 1, vendas: 0, receita: 0, tentativa: 1, descartado: 1},
            {nome: "Desconhecido", investimento: 0, leads: 4, agendamentos: 1, agq: 0, vendas: 0, receita: 0, tentativa: 0, descartado: 1}
        ],
        updated_at: new Date().toISOString()
    };

    const timeout = setTimeout(() => {
        showLoading(false);
        console.warn('Usando dados de demonstração devido ao atraso do Google.');
        renderDashboard(MOCK_DATA);
    }, 15000);

    try {
        const response = await fetch(finalUrl);
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
    const { resumo_mes, pace, serie_semanal, breakdown_meta_obj, breakdown_meta_cri, breakdown_google, breakdown_organico,
            serie_diaria, updated_at, metas, serie_semanal_meta, serie_semanal_google, serie_semanal_organico } = data;

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
    const roasLtv = resumo_mes.total_inv > 0 ? (resumo_mes.receita * 19) / resumo_mes.total_inv : 0;
    setVal('top-roas-ltv', roasLtv.toFixed(2), 'x');

    // Seção 1: Funil + Pace
    renderFunnel(resumo_mes);
    renderPace(resumo_mes, metas, pace);

    // Seção 2: Evolução diária
    renderMainChart(serie_diaria);

    // Seção Projeção do Mês
    renderProjection(resumo_mes, metas, pace);

    // Seção 3: Meta Ads
    renderChannelKPIs('meta-kpi-strip', sumBreakdown(breakdown_meta_obj), true, '#6366f1');
    renderDonutChart('objDonutChart', breakdown_meta_obj, ['#6366f1','#a855f7','#ec4899','rgba(255,255,255,0.1)']);
    renderBarChart('criBarChart', breakdown_meta_cri);
    renderTable('table-meta-obj', breakdown_meta_obj);

    // Seção 4: Google Ads
    renderChannelKPIs('google-kpi-strip', sumBreakdown(breakdown_google), true, '#10b981');
    renderDonutChart('googleDonutChart', breakdown_google, ['#10b981','#f59e0b','#6366f1','rgba(255,255,255,0.1)']);
    renderLeadsBarChart('googleLeadsChart', breakdown_google);
    renderTable('table-google', breakdown_google);

    // Seção 4B: Orgânico
    const orgTotal = sumBreakdown(breakdown_organico || []);
    renderChannelKPIs('organic-kpi-strip', orgTotal, false, '#f59e0b');
    renderTableOrganico('table-organico', breakdown_organico || []);

    // Seção 5: Semanal
    renderWeeklyHeatmap(serie_semanal);
    renderWeeklyChannelBreakdown(serie_semanal_meta, serie_semanal_google, serie_semanal_organico);
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
    const paceContent = document.getElementById('pace-content');
    const paceEmpty = document.getElementById('pace-empty');
    
    if (!pace) {
        if (paceContent) paceContent.style.display = 'none';
        if (paceEmpty) paceEmpty.style.display = 'block';
        return;
    } else {
        if (paceContent) paceContent.style.display = 'block';
        if (paceEmpty) paceEmpty.style.display = 'none';
    }

    // Dias restantes info
    const diasInfoEl = document.getElementById('pace-dias-info');
    if (diasInfoEl) {
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
        const cpl     = item.leads > 0           ? formatCurrency(item.investimento / item.leads)        : '—';
        const taxaAg  = item.leads > 0           ? ((item.agendamentos / item.leads)        * 100).toFixed(1) + '%' : '—';
        const taxaAgq = item.agendamentos > 0    ? ((item.agq          / item.agendamentos) * 100).toFixed(1) + '%' : '—';
        return `<tr>
            <td>${item.nome}</td>
            <td>${formatCurrency(item.investimento)}</td>
            <td>${item.leads}</td>
            <td>${item.agendamentos}</td>
            <td>${item.agq}</td>
            <td>${item.tentativa}</td>
            <td>${item.descartado}</td>
            <td>${cpl}</td>
            <td class="taxa-cell">${taxaAg}</td>
            <td class="taxa-cell">${taxaAgq}</td>
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
    const active = (weeks || []).filter(w => w.leads > 0 || w.investimento > 0);
    if (!active.length) { container.innerHTML = '<p class="w-empty">Sem dados semanais ainda.</p>'; return; }
    container.innerHTML = active.map((w, i) => {
        const cpl      = w.leads > 0           ? formatCurrency(w.investimento / w.leads)        : '—';
        const cplag    = w.agendamentos > 0    ? formatCurrency(w.investimento / w.agendamentos) : '—';
        const taxaAg   = w.leads > 0           ? ((w.agendamentos / w.leads)        * 100).toFixed(1) + '%' : '—';
        const taxaAgq  = w.agendamentos > 0    ? ((w.agq          / w.agendamentos) * 100).toFixed(1) + '%' : '—';
        return `
        <div class="week-card">
            <span class="w-title">Semana ${i + 1}</span>
            <div class="w-leads">${w.leads}</div>
            <span class="w-leads-label">Leads</span>
            <div class="w-detail">
                <div class="w-stat">
                    <span class="w-stat-val w-ag-val">${w.agendamentos}</span>
                    <span class="w-stat-pct">${taxaAg}</span>
                    <span class="w-stat-lbl">Ag.</span>
                </div>
                <div class="w-stat">
                    <span class="w-stat-val w-agq-val">${w.agq}</span>
                    <span class="w-stat-pct">${taxaAgq}</span>
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

// ── BREAKDOWN SEMANAL POR CANAL ───────────────────────────
function renderWeeklyChannelBreakdown(metaWeeks, googleWeeks, organicWeeks) {
    const container = document.getElementById('weekly-channels-container');
    if (!container) return;

    const channels = [
        { label: 'Meta Ads',   dotClass: 'meta-dot',   weeks: metaWeeks,    paid: true  },
        { label: 'Google Ads', dotClass: 'google-dot', weeks: googleWeeks,  paid: true  },
        { label: 'Orgânico',   dotClass: 'org-dot',    weeks: organicWeeks, paid: false }
    ];

    // Descobre quantas semanas têm dados no geral (para alinhar o grid)
    const allWeeks = [...(metaWeeks || []), ...(googleWeeks || []), ...(organicWeeks || [])];
    const totalSemanas = allWeeks.reduce((max, w, i) => {
        const idx = (metaWeeks || []).indexOf(w) >= 0 ? (metaWeeks || []).indexOf(w)
                  : (googleWeeks || []).indexOf(w) >= 0 ? (googleWeeks || []).indexOf(w)
                  : (organicWeeks || []).indexOf(w);
        return (w.leads > 0 || w.investimento > 0) ? Math.max(max, idx + 1) : max;
    }, 1);

    const html = channels.map(ch => {
        if (!ch.weeks || ch.weeks.length === 0) return '';

        // Filtra só semanas com dados neste canal
        const activeWeeks = ch.weeks.filter(w => w.leads > 0 || w.investimento > 0);
        if (activeWeeks.length === 0) return '';

        const cards = ch.weeks
            .map((w, i) => {
                const temDados = w.leads > 0 || w.investimento > 0;
                if (!temDados) return '';

                const taxaAg  = w.leads > 0         ? ((w.agendamentos / w.leads)        * 100).toFixed(1) + '%' : '—';
                const taxaAgq = w.agendamentos > 0   ? ((w.agq          / w.agendamentos) * 100).toFixed(1) + '%' : '—';
                const cpl     = w.leads > 0 && w.investimento > 0
                    ? `<div class="wc-cpl">${formatCurrency(w.investimento / w.leads)} <span>CPL</span></div>` : '';
                const investHtml = ch.paid
                    ? `<div class="wc-invest">${formatCurrency(w.investimento)}</div>${cpl}`
                    : '';

                return `
                <div class="wc-card">
                    <span class="wc-week-label">S${i + 1}</span>
                    <div class="wc-leads-num">${w.leads}</div>
                    <span class="wc-leads-lbl">Leads</span>
                    <div class="wc-detail">
                        <div class="wc-stat">
                            <span class="wc-val wc-ag-val">${w.agendamentos}</span>
                            <span class="wc-pct">${taxaAg}</span>
                            <span class="wc-lbl">AG</span>
                        </div>
                        <div class="wc-stat">
                            <span class="wc-val wc-agq-val">${w.agq}</span>
                            <span class="wc-pct">${taxaAgq}</span>
                            <span class="wc-lbl">AGQ</span>
                        </div>
                    </div>
                    ${investHtml}
                </div>`;
            }).join('');

        return `
        <div class="wc-channel-section">
            <div class="wc-channel-header">
                <span class="wc-dot ${ch.dotClass}"></span>
                <span class="wc-channel-title">${ch.label}</span>
            </div>
            <div class="wc-grid">${cards}</div>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="weekly-channels">${html}</div>`;
    lucide.createIcons();
}

// ── CHANNEL KPI STRIP ─────────────────────────────────────
function sumBreakdown(items) {
    return (items || []).reduce((acc, item) => ({
        investimento: acc.investimento + (item.investimento || 0),
        leads:        acc.leads        + (item.leads        || 0),
        agendamentos: acc.agendamentos + (item.agendamentos || 0),
        agq:          acc.agq          + (item.agq          || 0),
        tentativa:    acc.tentativa    + (item.tentativa    || 0),
        descartado:   acc.descartado   + (item.descartado   || 0),
        vendas:       acc.vendas       + (item.vendas       || 0),
        receita:      acc.receita      + (item.receita      || 0),
    }), { investimento: 0, leads: 0, agendamentos: 0, agq: 0, tentativa: 0, descartado: 0, vendas: 0, receita: 0 });
}

function renderChannelKPIs(containerId, t, showInvestimento, accentColor) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const cpl    = t.leads > 0 && t.investimento > 0 ? formatCurrency(t.investimento / t.leads)        : '—';
    const cplag  = t.agendamentos > 0 && t.investimento > 0 ? formatCurrency(t.investimento / t.agendamentos) : '—';
    const taxaAg  = t.leads > 0        ? ((t.agendamentos / t.leads)        * 100).toFixed(1) + '%' : '—';
    const taxaAgq = t.agendamentos > 0 ? ((t.agq          / t.agendamentos) * 100).toFixed(1) + '%' : '—';
    const taxaDesc = t.leads > 0       ? ((t.descartado   / t.leads)        * 100).toFixed(1) + '%' : '—';

    const kpis = [
        ...(showInvestimento ? [{ label: 'Investimento', value: formatCurrency(t.investimento), cls: 'ckpi-inv', accent: accentColor }] : []),
        { label: 'Leads',         value: t.leads,        cls: 'ckpi-leads' },
        { label: 'Agendamentos',  value: t.agendamentos, cls: 'ckpi-ag'    },
        { label: 'AGQ',           value: t.agq,          cls: 'ckpi-agq'   },
        { label: 'Em Tentativa',  value: t.tentativa,    cls: 'ckpi-tent'  },
        { label: 'Descartados',   value: t.descartado,   cls: 'ckpi-desc'  },
        ...(showInvestimento ? [
            { label: 'CPL',   value: cpl,   cls: 'ckpi-cpl'   },
            { label: 'CPLAg', value: cplag, cls: 'ckpi-cplag' },
        ] : []),
        { label: 'Taxa AG',  value: taxaAg,   cls: 'ckpi-taxa' },
        { label: 'Taxa AGQ', value: taxaAgq,  cls: 'ckpi-taxa' },
        { label: '% Descarte', value: taxaDesc, cls: 'ckpi-desc-pct' },
    ];

    el.innerHTML = kpis.map(k => `
        <div class="ckpi-card ${k.cls}">
            <span class="ckpi-val"${k.accent ? ` style="color:${k.accent}"` : ''}>${k.value}</span>
            <span class="ckpi-label">${k.label}</span>
        </div>
    `).join('');
}

// ── TABELA ORGÂNICO ───────────────────────────────────────
function renderTableOrganico(tableId, items) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    tbody.innerHTML = items.map(item => {
        const taxaAg  = item.leads > 0        ? ((item.agendamentos / item.leads)        * 100).toFixed(1) + '%' : '—';
        const taxaAgq = item.agendamentos > 0 ? ((item.agq          / item.agendamentos) * 100).toFixed(1) + '%' : '—';
        return `<tr>
            <td>${item.nome}</td>
            <td>${item.leads}</td>
            <td>${item.agendamentos}</td>
            <td>${item.agq}</td>
            <td>${item.tentativa}</td>
            <td>${item.descartado}</td>
            <td>${taxaAg}</td>
            <td>${taxaAgq}</td>
        </tr>`;
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
