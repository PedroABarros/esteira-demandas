/* =====================================================================
   TIMELINE.JS
   - CRUD das "demandas fixas" (não passam pelo Kanban, vão direto pra grade)
   - Renderização da Grade Horária (08:00 - 15:30), combinando:
       a) blocos fixos (horário definido manualmente)
       b) blocos dinâmicos de execução (tarefas do Kanban que já foram
          iniciadas hoje: em execução, pausadas ou finalizadas)
   - Algoritmo de colunas para tratar sobreposição/conflito de horários
===================================================================== */

const SLOT_MIN = 30;
const ROW_HEIGHT_PX = 44;

let editingFixedId = null;

const Timeline = {
  render(){
    renderFixedList();
    renderGridSkeleton();
    renderGridBlocks();
  }
};

/* ---------------------- CRUD demandas fixas ---------------------- */

function createFixedTask({ title, time, duration, category }){
  const fixed = {
    id: uid('fx'),
    title: title.trim(),
    time,
    duration: Number(duration) || 30,
    category,
    active: true
  };
  App.state.fixedTasks.push(fixed);
  Storage.saveFixedTasks(App.state.fixedTasks);
  return fixed;
}

function toggleFixedActive(id){
  const fx = App.state.fixedTasks.find(f => f.id === id);
  if(!fx) return;
  fx.active = !fx.active;
  Storage.saveFixedTasks(App.state.fixedTasks);
  App.refreshAll();
}

function deleteFixedTask(id){
  if(!confirm('Excluir esta demanda fixa?')) return;
  App.state.fixedTasks = App.state.fixedTasks.filter(f => f.id !== id);
  Storage.saveFixedTasks(App.state.fixedTasks);
  App.refreshAll();
}

function startEditFixed(id){
  editingFixedId = id;
  Timeline.render();
}
function cancelEditFixed(){
  editingFixedId = null;
  Timeline.render();
}
function saveEditFixed(id){
  const fx = App.state.fixedTasks.find(f => f.id === id);
  if(!fx) return;
  const title = document.getElementById(`fxedit-title-${id}`).value.trim();
  const time = document.getElementById(`fxedit-time-${id}`).value;
  const duration = parseInt(document.getElementById(`fxedit-duration-${id}`).value, 10);
  const category = document.getElementById(`fxedit-category-${id}`).value;
  if(!title || !time || !duration || duration <= 0) return;

  fx.title = title; fx.time = time; fx.duration = duration; fx.category = category;
  Storage.saveFixedTasks(App.state.fixedTasks);
  editingFixedId = null;
  App.refreshAll();
}

/* ---------------------- Renderização: lista de demandas fixas ---------------------- */

function renderFixedList(){
  const container = document.getElementById('fixedList');
  if(!container) return;
  container.innerHTML = '';

  const pill = document.getElementById('fixedCountPill');
  if(pill) pill.textContent = App.state.fixedTasks.length;

  if(App.state.fixedTasks.length === 0){
    container.innerHTML = '<div class="empty-hint">Nenhuma demanda fixa cadastrada.</div>';
    return;
  }

  App.state.fixedTasks
    .slice()
    .sort((a,b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .forEach(fx => {
      const item = document.createElement('div');
      item.className = 'fixed-item' + (fx.active ? '' : ' inactive');

      if(editingFixedId === fx.id){
        item.innerHTML = buildFixedEditRow(fx);
      } else {
        item.innerHTML = `
          <div class="swatch" style="background:${CATEGORY_COLORS[fx.category]}"></div>
          <div class="info">
            <div class="nome">${escapeHtml(fx.title)}</div>
            <div class="meta mono">${fx.time} · ${fx.duration}min · ${CATEGORY_LABELS[fx.category]}</div>
          </div>
          <label class="switch" title="${fx.active ? 'Desativar' : 'Ativar'}">
            <input type="checkbox" ${fx.active ? 'checked' : ''} onchange="toggleFixedActive('${fx.id}')">
            <span class="slider"></span>
          </label>
          <div class="actions">
            <button class="btn btn-ghost btn-icon btn-sm" title="Editar" onclick="startEditFixed('${fx.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-danger-outline btn-icon btn-sm" title="Excluir" onclick="deleteFixedTask('${fx.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
      }
      container.appendChild(item);
    });
}

function buildFixedEditRow(fx){
  const options = Object.keys(CATEGORY_LABELS).map(key =>
    `<option value="${key}" ${fx.category === key ? 'selected' : ''}>${CATEGORY_LABELS[key]}</option>`
  ).join('');
  return `
    <div class="edit-row">
      <div class="er-line"><input type="text" id="fxedit-title-${fx.id}" value="${escapeHtml(fx.title)}" style="flex:1;"></div>
      <div class="er-line">
        <input type="time" id="fxedit-time-${fx.id}" value="${fx.time}" style="width:100px;">
        <input type="number" id="fxedit-duration-${fx.id}" value="${fx.duration}" min="5" step="5" style="width:80px;">
        <select id="fxedit-category-${fx.id}" style="flex:1;">${options}</select>
      </div>
      <div class="er-line">
        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="saveEditFixed('${fx.id}')">Salvar</button>
        <button class="btn btn-ghost btn-sm" style="flex:1;" onclick="cancelEditFixed()">Cancelar</button>
      </div>
    </div>
  `;
}

/* ---------------------- Renderização: grade horária ---------------------- */

function timeToMinutes(hhmm){
  const [h,m] = hhmm.split(':').map(Number);
  return h*60+m;
}
function minutesToTime(min){
  const h = Math.floor(min/60), m = min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function renderGridSkeleton(){
  const times = document.getElementById('gridTimes');
  const body = document.getElementById('gridBody');
  if(!times || !body) return;
  times.innerHTML = '';
  body.innerHTML = '';

  const totalSlots = (WORK_END_MIN - WORK_START_MIN) / SLOT_MIN;
  for(let i = 0; i <= totalSlots; i++){
    const min = WORK_START_MIN + i * SLOT_MIN;
    if(min > WORK_END_MIN) break;
    const slot = document.createElement('div');
    slot.className = 'slot mono';
    slot.style.height = ROW_HEIGHT_PX + 'px';
    slot.textContent = minutesToTime(min);
    times.appendChild(slot);
  }

  body.style.height = (totalSlots * ROW_HEIGHT_PX) + 'px';
  for(let i = 0; i < totalSlots; i++){
    const row = document.createElement('div');
    row.className = 'slot-row';
    body.appendChild(row);
  }

  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();
  if(nowMin >= WORK_START_MIN && nowMin <= WORK_END_MIN){
    const line = document.createElement('div');
    line.className = 'now-line';
    line.style.top = (((nowMin - WORK_START_MIN)/SLOT_MIN) * ROW_HEIGHT_PX) + 'px';
    body.appendChild(line);
  }
}

/* Junta demandas fixas ativas + tarefas do kanban já iniciadas hoje
   em uma lista única normalizada (start/end em minutos). */
function getTimelineBlocks(){
  const fixedBlocks = App.state.fixedTasks
    .filter(f => f.active)
    .map(f => ({
      kind: 'fixed',
      id: 'fixed_' + f.id,
      title: f.title,
      category: f.category,
      startMin: timeToMinutes(f.time),
      endMin: timeToMinutes(f.time) + f.duration,
      label: `${f.duration}min`
    }));

  const dynamicBlocks = App.state.tasks
    .filter(t => t.startedAt && isToday(t.startedAt))
    .map(t => {
      const start = new Date(t.startedAt);
      const end = t.status === 'done' ? new Date(t.finishedAt) : new Date();
      const startMin = start.getHours()*60 + start.getMinutes();
      let endMin = end.getHours()*60 + end.getMinutes();
      if(endMin <= startMin) endMin = startMin + 5; // garante altura mínima visível
      return {
        kind: 'dynamic',
        id: 'dyn_' + t.id,
        title: t.title,
        category: t.category,
        status: t.status,
        startMin, endMin,
        label: `${formatHM(getLiveWorkedMinutes(t))} executado`
      };
    });

  return [...fixedBlocks, ...dynamicBlocks];
}

function isToday(iso){
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/* Algoritmo de colunas para tratar sobreposição (mesmo princípio da V1):
   agrupa blocos em clusters de sobreposição contínua e distribui colunas. */
function layoutBlocks(blocks){
  const sorted = [...blocks].sort((a,b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const result = new Map();
  let cluster = null;
  let clusterEnd = -Infinity;

  sorted.forEach(b => {
    if(b.startMin >= clusterEnd){
      if(cluster) flush(cluster, result);
      cluster = { items: [], colEnds: [] };
      clusterEnd = b.endMin;
    } else {
      clusterEnd = Math.max(clusterEnd, b.endMin);
    }
    let col = cluster.colEnds.findIndex(end => end <= b.startMin);
    if(col === -1){ col = cluster.colEnds.length; cluster.colEnds.push(b.endMin); }
    else { cluster.colEnds[col] = b.endMin; }
    cluster.items.push({ block: b, col });
  });
  if(cluster) flush(cluster, result);
  return result;
}
function flush(cluster, result){
  const numCols = cluster.colEnds.length;
  cluster.items.forEach(({block, col}) => result.set(block.id, { col, numCols }));
}

function renderGridBlocks(){
  const body = document.getElementById('gridBody');
  if(!body) return;
  body.querySelectorAll('.task-block').forEach(el => el.remove());

  const blocks = getTimelineBlocks();
  const layout = layoutBlocks(blocks);
  let conflictCount = 0;
  const seen = new Set();

  blocks.forEach(b => {
    const info = layout.get(b.id) || { col: 0, numCols: 1 };
    const isConflict = info.numCols > 1;
    if(isConflict && !seen.has(b.id)){ seen.add(b.id); conflictCount++; }

    const clippedStart = Math.max(b.startMin, WORK_START_MIN);
    const clippedEnd = Math.min(b.endMin, WORK_END_MIN);
    if(clippedEnd <= clippedStart) return;

    const top = ((clippedStart - WORK_START_MIN)/SLOT_MIN) * ROW_HEIGHT_PX;
    const height = Math.max(((clippedEnd - clippedStart)/SLOT_MIN) * ROW_HEIGHT_PX, 20);
    const widthPct = 100 / info.numCols;
    const leftPct = info.col * widthPct;

    const el = document.createElement('div');
    el.className = `task-block cat-${b.category}` + (isConflict ? ' conflict' : '') + (b.kind === 'dynamic' ? ' dynamic' : '');
    el.style.top = top + 'px';
    el.style.height = height + 'px';
    el.style.left = `calc(${leftPct}% + 2px)`;
    el.style.width = `calc(${widthPct}% - 4px)`;
    el.style.background = CATEGORY_COLORS[b.category];

    const statusIcon = b.kind === 'dynamic'
      ? (b.status === 'progress' ? '<i class="fa-solid fa-play"></i> ' : b.status === 'paused' ? '<i class="fa-solid fa-pause"></i> ' : '<i class="fa-solid fa-check"></i> ')
      : '';

    el.innerHTML = `
      <div class="t-nome">${isConflict ? '⚠ ' : ''}${statusIcon}${escapeHtml(b.title)}</div>
      <div class="t-hora mono">${minutesToTime(b.startMin)} · ${b.label}</div>
    `;
    body.appendChild(el);
  });

  const banner = document.getElementById('conflictBanner');
  const text = document.getElementById('conflictText');
  if(banner && text){
    if(conflictCount > 0){
      banner.classList.add('show');
      text.textContent = conflictCount === 1
        ? '1 demanda está com conflito de horário na grade.'
        : `${conflictCount} demandas estão com conflito de horário na grade.`;
    } else {
      banner.classList.remove('show');
    }
  }
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
