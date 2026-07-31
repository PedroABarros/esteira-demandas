/* =====================================================================
   APP.JS
   Ponto de entrada da aplicação:
   - Mantém o estado em memória (App.state)
   - Controla navegação entre as 4 páginas (sidebar)
   - Atualiza o header (título, data, busca)
   - Dispara o "tick" do cronômetro (atualização ao vivo sem re-render pesado)
   - Inicializa tudo ao carregar a página
===================================================================== */

const App = {
  state: {
    tasks: [],
    fixedTasks: [],
    settings: {}
  },

  currentPage: 'dashboard',

  /* Carrega tudo do localStorage para a memória */
  loadState(){
    this.state.tasks = Storage.getTasks();
    this.state.fixedTasks = Storage.getFixedTasks();
    this.state.settings = Storage.getSettings();
    this.currentPage = this.state.settings.currentPage || 'dashboard';
  },

  /* Re-renderiza a página ativa + elementos globais (header, sidebar) */
  refreshAll(){
    renderHeader();
    switch(this.currentPage){
      case 'dashboard': Dashboard.render(); break;
      case 'kanban': Kanban.render(); break;
      case 'timeline': Timeline.render(); break;
      case 'reports': Reports.render(); break;
    }
  },

  /* Troca de página pela sidebar */
  goToPage(page){
    this.currentPage = page;
    this.state.settings.currentPage = page;
    Storage.saveSettings(this.state.settings);

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if(navEl) navEl.classList.add('active');

    this.refreshAll();
  }
};

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  kanban: 'Lista de Tarefas',
  timeline: 'Grade Horária',
  reports: 'Relatórios'
};

function renderHeader(){
  document.getElementById('pageTitle').textContent = PAGE_TITLES[App.currentPage];
  const now = new Date();
  let dateTxt = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  dateTxt = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1);
  document.getElementById('pageDate').textContent = dateTxt;

  const current = getTaskInProgress();
  const indicator = document.getElementById('headerLiveIndicator');
  if(current){
    indicator.classList.add('show');
    indicator.querySelector('.hli-text').textContent = current.title;
  } else {
    indicator.classList.remove('show');
  }
}

/* ---------------------- Sidebar / navegação ---------------------- */

function wireSidebar(){
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => App.goToPage(item.dataset.page));
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    App.state.settings.sidebarCollapsed = sidebar.classList.contains('collapsed');
    Storage.saveSettings(App.state.settings);
  });

  if(App.state.settings.sidebarCollapsed){
    document.getElementById('sidebar').classList.add('collapsed');
  }
}

/* ---------------------- Busca no header ---------------------- */

function wireSearch(){
  const input = document.getElementById('headerSearch');
  input.value = App.state.settings.search || '';
  input.addEventListener('input', e => {
    App.state.settings.search = e.target.value;
    Storage.saveSettings(App.state.settings);
    if(App.currentPage === 'kanban') Kanban.render();
  });
}

/* ---------------------- Botões "Nova Demanda" ---------------------- */

function wireQuickActions(){
  document.querySelectorAll('.js-open-new-task').forEach(btn => {
    btn.addEventListener('click', () => Modal.openNewTask());
  });
  document.querySelectorAll('.js-open-new-fixed').forEach(btn => {
    btn.addEventListener('click', () => Modal.openNewFixed());
  });
}

/* ---------------------- Loop do cronômetro ----------------------
   Tick "leve" (1x por segundo): atualiza apenas os textos de tempo já
   presentes na tela, sem re-renderizar toda a página (fica mais fluido).
   Tick "pesado" (1x por minuto): re-renderiza tudo (grade, gráficos,
   contagens), para refletir mudanças estruturais (bloco crescendo etc). */
function startTickLoop(){
  setInterval(() => {
    const current = getTaskInProgress();
    if(current){
      const liveEl = document.getElementById('liveTimerDisplay');
      if(liveEl){
        liveEl.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${formatClock(getLiveWorkedMinutes(current) * 60)}`;
      }
      document.querySelectorAll(`[data-live-id="${current.id}"]`).forEach(el => {
        el.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${formatHM(getLiveWorkedMinutes(current))}`;
      });
    }
  }, 1000);

  setInterval(() => {
    App.refreshAll();
  }, 60 * 1000);
}

/* ---------------------- Exportar / Importar dados (backup em JSON) ----------------------
   Mesma ideia da V1: gera um arquivo .json com tudo (demandas do Kanban,
   demandas fixas e histórico diário para o gráfico semanal) e permite
   restaurar a partir de um arquivo importado. */
function wireBackupActions(){
  const btnExport = document.getElementById('btnExportData');
  const btnImport = document.getElementById('btnImportData');
  const fileInput = document.getElementById('fileImportData');
  if(!btnExport || !btnImport || !fileInput) return;

  btnExport.addEventListener('click', () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      tasks: App.state.tasks,
      fixedTasks: App.state.fixedTasks,
      dailyHistory: Storage.getDailyHistory()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `esteira-demandas-v2-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  btnImport.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', function(e){
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = function(evt){
      try{
        const data = JSON.parse(evt.target.result);
        if(!Array.isArray(data.tasks) || !Array.isArray(data.fixedTasks)){
          throw new Error('Formato inválido: esperado { tasks: [...], fixedTasks: [...] }');
        }
        const ok = confirm('Importar este arquivo substituirá todas as demandas, demandas fixas e o histórico salvos atualmente. Continuar?');
        if(!ok) return;

        App.state.tasks = data.tasks;
        App.state.fixedTasks = data.fixedTasks;
        Storage.saveTasks(App.state.tasks);
        Storage.saveFixedTasks(App.state.fixedTasks);

        if(data.dailyHistory && typeof data.dailyHistory === 'object'){
          Storage.saveDailyHistory(data.dailyHistory);
        }

        App.refreshAll();
      }catch(err){
        alert('Não foi possível importar: arquivo JSON inválido ou em formato inesperado.');
        console.error(err);
      }finally{
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });
}

/* ---------------------- Inicialização ---------------------- */

function initApp(){
  App.loadState();
  wireSidebar();
  wireSearch();
  wireQuickActions();
  wireBackupActions();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const startPage = document.getElementById('page-' + App.currentPage) ? App.currentPage : 'dashboard';
  document.getElementById('page-' + startPage).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-page="${startPage}"]`);
  if(navEl) navEl.classList.add('active');
  App.currentPage = startPage;

  App.refreshAll();
  startTickLoop();
}

document.addEventListener('DOMContentLoaded', initApp);
