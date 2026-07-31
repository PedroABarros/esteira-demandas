/* =====================================================================
   TASKS.JS
   - Constantes globais compartilhadas (expediente, categorias, prioridades)
   - CRUD das demandas do Kanban
   - Regras de cronômetro (iniciar / pausar / retomar / finalizar)
   - Regra "apenas uma tarefa em execução por vez"
===================================================================== */

/* ---------------------- Constantes globais ---------------------- */

// Expediente considerado pela Timeline e pelos cálculos de produtividade
const WORK_START_MIN = 8 * 60;         // 08:00
const WORK_END_MIN = 15 * 60 + 30;     // 15:30
const WORK_TOTAL_MIN = WORK_END_MIN - WORK_START_MIN; // 7h30 = 450min

const CATEGORY_LABELS = {
  reuniao: 'Reunião',
  bi: 'BI',
  comercial: 'Comercial',
  urgente: 'Urgente',
  outros: 'Outros'
};
const CATEGORY_COLORS = {
  reuniao: '#2563eb',
  bi: '#16a34a',
  comercial: '#f97316',
  urgente: '#dc2626',
  outros: '#7f8b9b'
};
const PRIORITY_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };
const PRIORITY_WEIGHT = { alta: 3, media: 2, baixa: 1 };

/* ---------------------- Estado em memória ---------------------- */
// App.state é a fonte única em memória; tasks.js manipula App.state.tasks
// e delega a gravação para Storage.

/* ---------------------- Utilitários de tempo ---------------------- */

function nowIso(){ return new Date().toISOString(); }

function minutesBetween(isoStart, isoEnd){
  return (new Date(isoEnd) - new Date(isoStart)) / 60000;
}

function formatHM(totalMinutes){
  totalMinutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}`;
}

function formatClock(totalSeconds){
  totalSeconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* Minutos já trabalhados em uma tarefa até agora (considera o tempo
   corrente se ela estiver em execução neste momento). */
function getLiveWorkedMinutes(task){
  let worked = task.workedMinutes || 0;
  if(task.status === 'progress' && task.lastResumeAt){
    worked += minutesBetween(task.lastResumeAt, nowIso());
  }
  return worked;
}

/* Minutos parados (pausado) acumulados em uma tarefa até agora. */
function getLivePausedMinutes(task){
  let paused = task.pausedMinutes || 0;
  if(task.status === 'paused' && task.lastPauseAt){
    paused += minutesBetween(task.lastPauseAt, nowIso());
  }
  return paused;
}

/* ---------------------- CRUD de tarefas ---------------------- */

function createTask({ title, description, category, priority, estimatedMinutes }){
  const task = {
    id: uid('task'),
    title: title.trim(),
    description: (description || '').trim(),
    category,
    priority,
    estimatedMinutes: Number(estimatedMinutes) || 30,
    workedMinutes: 0,
    pausedMinutes: 0,
    status: 'todo',
    createdAt: nowIso(),
    startedAt: null,
    lastResumeAt: null,
    lastPauseAt: null,
    finishedAt: null
  };
  App.state.tasks.push(task);
  Storage.saveTasks(App.state.tasks);
  Storage.pushActivity('criou', task.title);
  return task;
}

function updateTask(id, changes){
  const task = App.state.tasks.find(t => t.id === id);
  if(!task) return;
  Object.assign(task, changes);
  Storage.saveTasks(App.state.tasks);
}

function deleteTask(id){
  App.state.tasks = App.state.tasks.filter(t => t.id !== id);
  Storage.saveTasks(App.state.tasks);
}

function getTaskInProgress(){
  return App.state.tasks.find(t => t.status === 'progress');
}

/* ---------------------- Regras de cronômetro ---------------------- */

/* Inicia (ou retoma) uma tarefa. Se já existir outra em execução,
   pede confirmação para pausá-la antes (regra obrigatória do sistema). */
function startOrResumeTask(id){
  const task = App.state.tasks.find(t => t.id === id);
  if(!task) return;

  const current = getTaskInProgress();
  if(current && current.id !== id){
    const ok = confirm(`"${current.title}" está em execução.\nDeseja pausá-la para iniciar/retomar "${task.title}"?`);
    if(!ok) return;
    pauseTask(current.id);
  }

  const isFirstStart = task.status === 'todo';
  const wasPaused = task.status === 'paused';

  if(wasPaused && task.lastPauseAt){
    task.pausedMinutes = (task.pausedMinutes || 0) + minutesBetween(task.lastPauseAt, nowIso());
    task.lastPauseAt = null;
  }

  task.status = 'progress';
  task.lastResumeAt = nowIso();
  if(!task.startedAt) task.startedAt = task.lastResumeAt;

  Storage.saveTasks(App.state.tasks);
  Storage.pushActivity(isFirstStart ? 'iniciou' : 'retomou', task.title);
}

function pauseTask(id){
  const task = App.state.tasks.find(t => t.id === id);
  if(!task || task.status !== 'progress') return;

  if(task.lastResumeAt){
    task.workedMinutes = (task.workedMinutes || 0) + minutesBetween(task.lastResumeAt, nowIso());
  }
  task.status = 'paused';
  task.lastResumeAt = null;
  task.lastPauseAt = nowIso();

  Storage.saveTasks(App.state.tasks);
  Storage.pushActivity('pausou', task.title);
}

function finishTask(id){
  const task = App.state.tasks.find(t => t.id === id);
  if(!task) return;

  if(task.status === 'progress' && task.lastResumeAt){
    task.workedMinutes = (task.workedMinutes || 0) + minutesBetween(task.lastResumeAt, nowIso());
  }
  task.status = 'done';
  task.lastResumeAt = null;
  task.lastPauseAt = null;
  task.finishedAt = nowIso();

  Storage.saveTasks(App.state.tasks);
  Storage.pushActivity('finalizou', task.title);
}

/* ---------------------- Consultas agregadas (usadas no dashboard/relatórios) ---------------------- */

function getTotalWorkedMinutesToday(){
  return App.state.tasks.reduce((sum, t) => sum + getLiveWorkedMinutes(t), 0);
}
function getTotalPausedMinutesToday(){
  return App.state.tasks.reduce((sum, t) => sum + getLivePausedMinutes(t), 0);
}
function getWorkedMinutesByCategory(){
  const totals = {};
  Object.keys(CATEGORY_LABELS).forEach(c => totals[c] = 0);
  App.state.tasks.forEach(t => { totals[t.category] += getLiveWorkedMinutes(t); });
  // Demandas fixas também ocupam a agenda (mesmo sem passar pelo cronômetro),
  // então entram na distribuição por categoria.
  App.state.fixedTasks.filter(f => f.active).forEach(f => {
    const start = timeToMinutes(f.time);
    const end = start + f.duration;
    const clippedStart = Math.max(start, WORK_START_MIN);
    const clippedEnd = Math.min(end, WORK_END_MIN);
    if(clippedEnd > clippedStart) totals[f.category] += (clippedEnd - clippedStart);
  });
  return totals;
}
function getCountsByStatus(){
  const counts = { todo: 0, progress: 0, paused: 0, done: 0 };
  App.state.tasks.forEach(t => { counts[t.status]++; });
  return counts;
}

/* Minutos "ocupados" da agenda de hoje = união dos intervalos de tempo de
   TODAS as demandas fixas ativas + tarefas do Kanban já iniciadas hoje
   (em execução, pausadas ou finalizadas), sem contar duas vezes o tempo
   quando há sobreposição/conflito. É esse valor — e não só o tempo
   executado no cronômetro — que deve ser descontado das "Horas Livres",
   já que uma demanda fixa ocupa a agenda mesmo sem estar rodando. */
function getScheduledOccupiedMinutesToday(){
  if(typeof getTimelineBlocks !== 'function') return 0;
  const blocks = getTimelineBlocks();
  const intervals = blocks
    .map(b => [Math.max(b.startMin, WORK_START_MIN), Math.min(b.endMin, WORK_END_MIN)])
    .filter(([s, e]) => e > s);
  return mergeIntervalsTotal(intervals);
}

function mergeIntervalsTotal(intervals){
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  let total = 0, curStart = null, curEnd = null;
  sorted.forEach(([s, e]) => {
    if(curStart === null){ curStart = s; curEnd = e; }
    else if(s <= curEnd){ curEnd = Math.max(curEnd, e); }
    else { total += curEnd - curStart; curStart = s; curEnd = e; }
  });
  if(curStart !== null) total += curEnd - curStart;
  return total;
}
