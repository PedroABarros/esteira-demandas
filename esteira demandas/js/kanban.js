/* =====================================================================
   KANBAN.JS
   Renderiza o quadro de 3 colunas (A Fazer / Em Execução / Finalizado)
   e conecta os botões de cada card às regras de cronômetro em tasks.js.
===================================================================== */

const Kanban = {

  render(){
    const search = (App.state.settings.search || '').trim().toLowerCase();
    const tasks = App.state.tasks.filter(t =>
      search === '' || t.title.toLowerCase().includes(search)
    );

    const todo = tasks.filter(t => t.status === 'todo').sort(sortByPriorityThenDate);
    const inProgress = tasks.filter(t => t.status === 'progress' || t.status === 'paused')
      .sort((a,b) => (b.status === 'progress') - (a.status === 'progress'));
    const done = tasks.filter(t => t.status === 'done')
      .sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt));

    renderColumn('kanban-todo', todo, 'Nenhuma demanda aguardando.');
    renderColumn('kanban-progress', inProgress, 'Nenhuma demanda em execução.');
    renderColumn('kanban-done', done, 'Nenhuma demanda finalizada ainda.');

    setCount('kanban-todo-count', todo.length);
    setCount('kanban-progress-count', inProgress.length);
    setCount('kanban-done-count', done.length);
  }
};

function sortByPriorityThenDate(a, b){
  const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if(diff !== 0) return diff;
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function setCount(elId, n){
  const el = document.getElementById(elId);
  if(el) el.textContent = n;
}

function renderColumn(containerId, list, emptyText){
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if(list.length === 0){
    container.innerHTML = `<div class="empty-hint">${emptyText}</div>`;
    return;
  }
  list.forEach(task => container.appendChild(buildTaskCard(task)));
}

function buildTaskCard(task){
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;

  const worked = getLiveWorkedMinutes(task);
  const progressPct = Math.min(100, Math.round((worked / task.estimatedMinutes) * 100));

  card.innerHTML = `
    <div class="tc-top">
      <span class="badge cat-badge" style="background:${CATEGORY_COLORS[task.category]}22;color:${CATEGORY_COLORS[task.category]}">
        <i class="fa-solid fa-tag"></i> ${CATEGORY_LABELS[task.category]}
      </span>
      <span class="badge prio-badge prio-${task.priority}">${PRIORITY_LABELS[task.priority]}</span>
    </div>
    <div class="tc-title">${escapeHtml(task.title)}</div>
    ${task.description ? `<div class="tc-desc">${escapeHtml(task.description)}</div>` : ''}

    <div class="tc-time-row mono">
      <span title="Tempo estimado"><i class="fa-regular fa-clock"></i> ${task.estimatedMinutes}min</span>
      <span title="Tempo executado" class="${task.status === 'progress' ? 'live-worked' : ''}" data-live-id="${task.id}">
        <i class="fa-solid fa-stopwatch"></i> ${formatHM(worked)}
      </span>
    </div>
    <div class="tc-progress-track">
      <div class="tc-progress-fill" style="width:${progressPct}%"></div>
    </div>

    <div class="tc-actions">
      ${buildActionButtons(task)}
    </div>
  `;

  wireCardButtons(card, task);
  return card;
}

function buildActionButtons(task){
  if(task.status === 'todo'){
    return `<button class="btn btn-primary btn-sm act-start"><i class="fa-solid fa-play"></i> Iniciar</button>
            <button class="btn btn-ghost btn-icon btn-sm act-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;
  }
  if(task.status === 'progress'){
    return `<button class="btn btn-warning btn-sm act-pause"><i class="fa-solid fa-pause"></i> Pausar</button>
            <button class="btn btn-success btn-sm act-finish"><i class="fa-solid fa-check"></i> Finalizar</button>`;
  }
  if(task.status === 'paused'){
    return `<button class="btn btn-primary btn-sm act-resume"><i class="fa-solid fa-play"></i> Retomar</button>
            <button class="btn btn-success btn-sm act-finish"><i class="fa-solid fa-check"></i> Finalizar</button>`;
  }
  // done
  return `<button class="btn btn-ghost btn-icon btn-sm act-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>`;
}

function wireCardButtons(card, task){
  const start = card.querySelector('.act-start');
  const resume = card.querySelector('.act-resume');
  const pause = card.querySelector('.act-pause');
  const finish = card.querySelector('.act-finish');
  const del = card.querySelector('.act-delete');

  if(start) start.addEventListener('click', () => { startOrResumeTask(task.id); App.refreshAll(); });
  if(resume) resume.addEventListener('click', () => { startOrResumeTask(task.id); App.refreshAll(); });
  if(pause) pause.addEventListener('click', () => { pauseTask(task.id); App.refreshAll(); });
  if(finish) finish.addEventListener('click', () => {
    if(confirm(`Finalizar a demanda "${task.title}"?`)){ finishTask(task.id); App.refreshAll(); }
  });
  if(del) del.addEventListener('click', () => {
    if(confirm(`Excluir a demanda "${task.title}"? Essa ação não pode ser desfeita.`)){
      deleteTask(task.id); App.refreshAll();
    }
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
