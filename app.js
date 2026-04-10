/**
 * DASHBOARD PERFORMANCE - FRONTEND LOGIC
 */

const API_URL = '/api/dados'; // Proxy Netlify
let dashboardData = null;
let currentTab = 'google';
let chartInstance = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    
    // Auto refresh a cada 5 minutos
    setInterval(fetchData, 5 * 60 * 1000);

    document.getElementById('refresh-btn').addEventListener('click', fetchData);
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTab = e.target.dataset.tab;
            renderBreakdown();
        });
    });
});

async function fetchData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        dashboardData = data;
        updateUI();
    } catch (error) {
        console.error("Erro detalhado:", error);
        alert(`Erro ao buscar dados: ${error.message}\nVerifique se o Apps Script está publicado como 'Qualquer pessoa' e se o deploy no Netlify terminou.`);
    } finally {
        showLoading(false);
    }
}

function updateUI() {
    const { metas, resumo_mes, pace, updated_at, serie_diaria } = dashboardData;

    // Last Update
    const date = new Date(updated_at);
    document.getElementById('update-time').innerText = `Atualizado: ${date.toLocaleTimeString('pt-BR')}`;

    // Big Numbers
    updateCard('card-investimento', formatCurrency(resumo_mes.total_investimento));
    updateCard('card-leads', resumo_mes.leads);
    updateCard('card-cpl', formatCurrency(resumo_mes.cpl));
    updateCard('card-agendamentos', resumo_mes.agendamentos);
    updateCard('card-agq', resumo_mes.agq);
    updateCard('card-cplag', formatCurrency(resumo_mes.cplag));
    updateCard('card-tentativa', resumo_mes.tentativa);
    updateCard('card-descartado', resumo_mes.descartado);

    document.getElementById('meta-cpl').innerText = formatCurrency(metas.cpl_max);
    document.getElementById('meta-cplag').innerText = formatCurrency(metas.cplag_max);

    // Pace Table
    renderPaceTable(metas, resumo_mes, pace);

    // Chart
    renderChart(serie_diaria, metas, pace);

    // Platforms
    updatePlatform('plat-meta', resumo_mes.investimento_meta, resumo_mes.total_investimento);
    updatePlatform('plat-google', resumo_mes.investimento_google, resumo_mes.total_investimento);

    // Breakdown
    renderBreakdown();
}

function updateCard(id, value) {
    const card = document.getElementById(id);
    if (card) card.querySelector('.value').innerText = value;
}

function updatePlatform(id, value, total) {
    const el = document.getElementById(id);
    const percent = total > 0 ? (value / total) * 100 : 0;
    el.querySelector('.plat-value').innerText = formatCurrency(value);
    el.querySelector('.fill').style.width = `${percent}%`;
    el.querySelector('.plat-percent').innerText = `${percent.toFixed(1)}% do total`;
}

function renderPaceTable(metas, resumo, pace) {
    const tbody = document.getElementById('pace-body');
    
    const rows = [
        { label: 'Leads', meta: metas.leads, atual: resumo.leads, media: pace.leads_media_atual_por_dia, nec: pace.leads_necessarios_por_dia },
        { label: 'Agendamentos', meta: metas.agendamentos, atual: resumo.agendamentos, media: pace.agendamentos_media_atual_por_dia, nec: pace.agendamentos_necessarios_por_dia },
        { label: 'AGQ', meta: metas.agq, atual: resumo.agq, media: pace.agq_media_atual_por_dia, nec: pace.agq_necessarios_por_dia }
    ];

    tbody.innerHTML = rows.map(r => {
        const perc = r.meta > 0 ? (r.atual / r.meta) * 100 : 0;
        let statusClass = 'status-red';
        let statusIcon = '🔴 Crítico';
        
        if (r.media >= r.nec) {
            statusClass = 'status-green';
            statusIcon = '🟢 No Alvo';
        } else if (r.media >= r.nec * 0.8) {
            statusClass = 'status-yellow';
            statusIcon = '🟡 Alerta';
        }

        return `
            <tr>
                <td><strong>${r.label}</strong></td>
                <td>${r.meta}</td>
                <td>${r.atual}</td>
                <td>${perc.toFixed(1)}%</td>
                <td>${r.media.toFixed(1)}</td>
                <td>${r.nec.toFixed(1)}</td>
                <td><span class="status-indicator ${statusClass}">${statusIcon}</span></td>
            </tr>
        `;
    }).join('');
}

function renderChart(serie, metas, pace) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    
    // Preparar dados
    const labels = serie.map(d => formatDateShort(d.data));
    const leads = serie.map(d => d.leads);
    const agendamentos = serie.map(d => d.agendamentos);
    const agq = serie.map(d => d.agq);
    
    // Pace ideal (linha pontilhada)
    const totalDias = pace.dias_corridos + pace.dias_restantes;
    const paceValues = labels.map((_, i) => (metas.leads / totalDias) * (i + 1));

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Leads', data: leads, borderColor: '#6366f1', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'Agendamentos', data: agendamentos, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.3 },
                { label: 'AGQ', data: agq, borderColor: '#f59e0b', backgroundColor: 'transparent', tension: 0.3 },
                { 
                    label: 'Pace Ideal (Leads)', 
                    data: paceValues, 
                    borderColor: 'rgba(255,255,255,0.2)', 
                    borderDash: [5, 5], 
                    pointRadius: 0,
                    fill: false 
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderBreakdown() {
    const container = document.getElementById('breakdown-content');
    const data = currentTab === 'google' ? dashboardData.breakdown_google : dashboardData.breakdown_meta;
    
    if (!data || data.length === 0) {
        container.innerHTML = "<p style='padding: 2rem; color: #94a3b8'>Nenhum dado encontrado para esta aba.</p>";
        return;
    }

    let html = `
        <table>
            <thead>
                <tr>
                    <th>${currentTab === 'google' ? 'Campanha' : 'Público'}</th>
                    <th>Leads</th>
                    <th>Agend.</th>
                    <th>AGQ</th>
                    <th>CPL</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach(item => {
        const cpl = item.leads > 0 ? (item.investimento / item.leads) : 0;
        html += `
            <tr>
                <td><strong>${item.nome}</strong></td>
                <td>${item.leads}</td>
                <td>${item.agendamentos}</td>
                <td>${item.agq}</td>
                <td>${cpl > 0 ? formatCurrency(cpl) : '-'}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Helpers
function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
}

function showLoading(show) {
    document.getElementById('loading').style.opacity = show ? '1' : '0';
    document.getElementById('loading').style.pointerEvents = show ? 'all' : 'none';
}
