/**
 * DASHBOARD PERFORMANCE - LOGIC V2 (Multi-Table)
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbwNIl3WoIo3cAAHt6wexcMjs0EovvWZW4LvQYPXXd0QLp3Wt_-UlXFRmcqgfujCx6lV/exec';
let chartInstance = null;

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
        console.error("Erro:", error);
        alert("Erro ao carregar dados. Verifique a conexão com o Google Script.");
    } finally {
        showLoading(false);
    }
}

function renderDashboard(data) {
    const { resumo_mes, serie_semanal, breakdown_meta_obj, breakdown_meta_cri, breakdown_google, breakdown_organico, serie_diaria, updated_at } = data;

    // Header
    document.getElementById('update-time').innerText = `Atualizado: ${new Date(updated_at).toLocaleTimeString('pt-BR')}`;

    // Big Numbers
    updateCard('card-investimento', formatCurrency(resumo_mes.total_inv));
    updateCard('card-leads', resumo_mes.leads);
    updateCard('card-cpl', formatCurrency(resumo_mes.cpl));
    updateCard('card-agendamentos', resumo_mes.agendamentos);
    updateCard('card-agq', resumo_mes.agq);
    updateCard('card-cplag', formatCurrency(resumo_mes.cplag));

    // Tabelas de Breakdown
    renderTable('table-meta-obj', breakdown_meta_obj, true);
    renderTable('table-meta-cri', breakdown_meta_cri, true);
    renderTable('table-google', breakdown_google, true);
    renderTable('table-organico', breakdown_organico, false);

    // Tabela Semanal
    renderWeeklyTable(serie_semanal, resumo_mes);

    // Gráfico
    renderChart(serie_diaria);
}

function updateCard(id, val) {
    const el = document.getElementById(id);
    if (el) el.querySelector('.value').innerText = val;
}

function renderTable(tableId, items, showSpend) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;

    tbody.innerHTML = items.map(item => {
        const cpl = item.leads > 0 ? (item.investimento / item.leads) : 0;
        const cplag = item.agendamentos > 0 ? (item.investimento / item.agendamentos) : 0;
        const percTent = item.leads > 0 ? (item.tentativa / item.leads) * 100 : 0;
        const percDesc = item.leads > 0 ? (item.descartado / item.leads) * 100 : 0;

        let row = `<td><strong>${item.nome}</strong></td>`;
        if (showSpend) row += `<td>${formatCurrency(item.investimento)}</td>`;
        row += `<td>${item.leads}</td>`;
        row += `<td>${item.agendamentos}</td>`;
        if (showSpend) {
            row += `<td>${formatCurrency(cpl)}</td>`;
            row += `<td>${cplag > 0 ? formatCurrency(cplag) : '-'}</td>`;
        } else {
            const txConv = item.leads > 0 ? (item.agendamentos / item.leads) * 100 : 0;
            row += `<td>${txConv.toFixed(1)}%</td>`;
        }
        row += `<td>${item.tentativa} (${percTent.toFixed(0)}%)</td>`;
        row += `<td>${item.descartado} (${percDesc.toFixed(0)}%)</td>`;

        return `<tr>${row}</tr>`;
    }).join('');
}

function renderWeeklyTable(weeks, resumo) {
    const tbody = document.getElementById('weekly-body');
    const rows = [
        { label: 'Investimento', key: 'investimento', isCurrency: true },
        { label: 'Leads', key: 'leads' },
        { label: 'Agendamentos', key: 'agendamentos' },
        { label: 'Taxa Agendamento', custom: w => w.leads > 0 ? (w.agendamentos / w.leads * 100).toFixed(1) + '%' : '0%' },
        { label: 'Qualificados (Ag Quali)', key: 'agq' },
        { label: 'Em tentativa', custom: w => w.leads > 0 ? (w.tentativa / w.leads * 100).toFixed(0) + '%' : '0%' },
        { label: 'Descarte', custom: w => w.leads > 0 ? (w.descartado / w.leads * 100).toFixed(0) + '%' : '0%' }
    ];

    tbody.innerHTML = rows.map(r => {
        let cells = `<td><strong>${r.label}</strong></td>`;
        weeks.forEach(w => {
            let val = r.custom ? r.custom(w) : w[r.key];
            if (r.isCurrency) val = formatCurrency(val);
            cells += `<td>${val}</td>`;
        });
        
        // Total column
        let totalVal = r.custom ? r.custom(resumo) : resumo[r.key];
        if (r.isCurrency) totalVal = formatCurrency(totalVal);
        cells += `<td><strong>${totalVal}</strong></td>`;
        
        return `<tr>${cells}</tr>`;
    }).join('');
}

function renderChart(serie) {
    const ctx = document.getElementById('evolutionChart').getContext('2d');
    const labels = serie.map(d => d.data.split('-').reverse().slice(0,2).join('/'));
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Leads', data: serie.map(d => d.leads), borderColor: '#6366f1', tension: 0.3, fill: false },
                { label: 'Agendamentos', data: serie.map(d => d.agendamentos), borderColor: '#10b981', tension: 0.3, fill: false },
                { label: 'AGQ', data: serie.map(d => d.agq), borderColor: '#f59e0b', tension: 0.3, fill: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8' } } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v); }
function showLoading(show) { document.getElementById('loading').style.display = show ? 'flex' : 'none'; }
