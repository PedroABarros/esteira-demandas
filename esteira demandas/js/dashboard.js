/* =====================================================================
   DASHBOARD.JS
   Renderiza a visão geral do dia: cards superiores, gráfico circular de
   produtividade, card da tarefa atual (com cronômetro ao vivo) e a lista
   de últimas atividades.
===================================================================== */

let productivityChart = null;

const Dashboard = {
  render(){
    const worked = getTotalWorkedMinutesToday();
    const planned = WORK_TOTAL_MIN;
    // "Ocupado" = agenda realmente tomada (demandas fixas + tarefas já iniciadas hoje),
    // não apenas o tempo executado no cronômetro — é isso que precisa ser
    // descontado das Horas Livres.
    const occupied = Math.min(getScheduledOccupiedMinutesToday(), planned);
    const free = Math.max(planned - occupied, 0);
    const counts = getCountsByStatus();

    document.getElementById('dashWorked').textContent = formatHM(worked);
    document.getElementById('dashPlanned').textContent = formatHM(planned);

    const totalOpen = counts.todo + counts.progress + counts.paused;
    document.getElementById('dashOpenTodo').textContent = totalOpen;
    document.getElementById('dashOpenTodoBreak').textContent = counts.todo;
    document.getElementById('dashOpenProgress').textContent = counts.progress + counts.paused;
    document.getElementById('dashOpenDone').textContent = counts.done;

    const pct = Math.min(100, Math.round((occupied / planned) * 100));
    document.getElementById('dashFreeTime').textContent = formatHM(free);
    document.getElementById('dashBusyTime').textContent = formatHM(occupied);

    // Tarefa atual e atividades primeiro: são as informações mais importantes
    // e não podem ficar reféns de uma falha ao carregar o Chart.js via CDN.
    renderCurrentTask();
    renderActivityLog();
    renderProductivityChart(pct);

    // Snapshot do dia para alimentar o relatório semanal
    Storage.updateTodaySnapshot(worked, planned);
  }
};

function renderProductivityChart(pct){
  // Atualiza o texto sempre, mesmo se o Chart.js não tiver carregado (ex: sem internet/CDN indisponível)
  document.getElementById('productivityPct').textContent = pct + '%';

  const ctx = document.getElementById('productivityChart');
  if(!ctx || typeof Chart === 'undefined') return;

  try{
    const data = {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: ['#3454d1', '#e8edf5'],
        borderWidth: 0,
        cutout: '72%'
      }]
    };
    if(productivityChart){
      productivityChart.data = data;
      productivityChart.update();
    } else {
      productivityChart = new Chart(ctx, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
      });
    }
  }catch(e){
    console.error('Não foi possível renderizar o gráfico de produtividade.', e);
  }
}

function renderCurrentTask(){
  const box = document.getElementById('currentTaskBox');
  const task = getTaskInProgress();
  if(!task){
    box.innerHTML = `
      <div class="empty-hint">
        <i class="fa-regular fa-circle-pause"></i><br>
        Nenhuma tarefa em execução
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="current-task-title">${escapeHtml(task.title)}</div>
    <div class="current-task-cat">
      <span class="badge cat-badge" style="background:${CATEGORY_COLORS[task.category]}22;color:${CATEGORY_COLORS[task.category]}">
        ${CATEGORY_LABELS[task.category]}
      </span>
    </div>
    <div class="current-task-timer mono" id="liveTimerDisplay">
      <i class="fa-solid fa-stopwatch"></i> ${formatClock(getLiveWorkedMinutes(task) * 60)}
    </div>
    <button class="btn btn-warning btn-block" id="dashPauseBtn">
      <i class="fa-solid fa-pause"></i> Pausar
    </button>
  `;
  document.getElementById('dashPauseBtn').addEventListener('click', () => {
    pauseTask(task.id);
    App.refreshAll();
  });
}

function renderActivityLog(){
  const list = document.getElementById('activityLogList');
  const log = Storage.getActivityLog().slice().reverse().slice(0, 8);
  if(log.length === 0){
    list.innerHTML = '<div class="empty-hint">Nenhuma atividade registrada ainda.</div>';
    return;
  }
  const verbLabel = {
    criou: 'Criou',
    iniciou: 'Iniciou',
    pausou: 'Pausou',
    retomou: 'Retomou',
    finalizou: 'Finalizou'
  };
  list.innerHTML = log.map(entry => {
    const d = new Date(entry.time);
    const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `
      <div class="activity-item">
        <div class="activity-time mono">${hora}</div>
        <div class="activity-text"><strong>${verbLabel[entry.type] || entry.type}:</strong> ${escapeHtml(entry.title)}</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
