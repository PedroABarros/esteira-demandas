/* =====================================================================
   REPORTS.JS
   Página "Relatórios": resumo do dia, tempo por categoria, produtividade
   semanal (a partir do histórico salvo dia a dia) e tempo total de pausas.
===================================================================== */

let dayChart = null;
let categoryChart = null;
let weeklyChart = null;

const Reports = {
  render(){
    renderDaySummaryChart();
    renderCategoryChart();
    renderWeeklyChart();
    renderPauseSummary();
  }
};

function renderDaySummaryChart(){
  // Mesmo critério do dashboard: ocupado = demandas fixas ativas + tarefas
  // já iniciadas hoje, e não só o tempo executado no cronômetro.
  const occupied = Math.min(getScheduledOccupiedMinutesToday(), WORK_TOTAL_MIN);
  const free = Math.max(WORK_TOTAL_MIN - occupied, 0);

  document.getElementById('repWorkedLabel').textContent = formatHM(occupied);
  document.getElementById('repFreeLabel').textContent = formatHM(free);

  const ctx = document.getElementById('dayChart');
  if(!ctx) return;
  const data = {
    labels: ['Ocupado', 'Livre'],
    datasets: [{ data: [occupied, free], backgroundColor: ['#3454d1', '#e8edf5'], borderWidth: 0 }]
  };
  dayChart = upsertChart(dayChart, ctx, 'doughnut', data, { cutout: '65%' });
}

function renderCategoryChart(){
  const totals = getWorkedMinutesByCategory();
  const totalSum = Object.values(totals).reduce((a,b) => a+b, 0);

  const legend = document.getElementById('categoryLegend');
  const labels = Object.keys(CATEGORY_LABELS);

  legend.innerHTML = labels.map(cat => {
    const pct = totalSum > 0 ? Math.round((totals[cat] / totalSum) * 100) : 0;
    return `
      <div class="legend-row">
        <span class="dot" style="background:${CATEGORY_COLORS[cat]}"></span>
        <span class="legend-label">${CATEGORY_LABELS[cat]}</span>
        <span class="legend-value mono">${pct}%</span>
      </div>`;
  }).join('');

  const ctx = document.getElementById('categoryChart');
  if(!ctx) return;
  const data = {
    labels: labels.map(c => CATEGORY_LABELS[c]),
    datasets: [{
      data: labels.map(c => totals[c]),
      backgroundColor: labels.map(c => CATEGORY_COLORS[c]),
      borderWidth: 0
    }]
  };
  categoryChart = upsertChart(categoryChart, ctx, 'doughnut', data, { cutout: '55%' });
}

function renderWeeklyChart(){
  const history = Storage.getDailyHistory();
  const days = [];
  const today = new Date();

  for(let i = 6; i >= 0; i--){
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const entry = history[key];
    days.push({
      label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      minutes: entry ? entry.workedMinutes : 0
    });
  }

  const ctx = document.getElementById('weeklyChart');
  if(!ctx) return;
  const data = {
    labels: days.map(d => d.label),
    datasets: [{
      label: 'Minutos trabalhados',
      data: days.map(d => Math.round(d.minutes)),
      backgroundColor: '#3454d1',
      borderRadius: 6,
      maxBarThickness: 34
    }]
  };
  weeklyChart = upsertChart(weeklyChart, ctx, 'bar', data, null, {
    scales: {
      y: { beginAtZero: true, grid: { color: '#e8edf5' } },
      x: { grid: { display: false } }
    },
    plugins: { legend: { display: false } }
  });
}

function renderPauseSummary(){
  const paused = getTotalPausedMinutesToday();
  document.getElementById('repPausedLabel').textContent = formatHM(paused);
}

/* Cria o gráfico se ainda não existir, ou apenas atualiza os dados —
   evita recriar instâncias do Chart.js a cada re-render.
   Se o Chart.js não estiver disponível (ex: sem internet, CDN fora do ar),
   retorna null silenciosamente em vez de travar a página — os números e
   legendas continuam funcionando normalmente, só o desenho do gráfico
   fica ausente. */
function upsertChart(instance, ctx, type, data, extraDatasetOptions, extraOptions){
  if(!ctx || typeof Chart === 'undefined') return null;

  try{
    if(extraDatasetOptions){
      data.datasets[0] = { ...data.datasets[0], ...extraDatasetOptions };
    }
    if(instance){
      instance.data = data;
      if(extraOptions) Object.assign(instance.options, extraOptions);
      instance.update();
      return instance;
    }
    return new Chart(ctx, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: type === 'bar' ? false : true, position: 'bottom' } },
        ...extraOptions
      }
    });
  }catch(e){
    console.error('Não foi possível renderizar um gráfico de relatório.', e);
    return null;
  }
}
