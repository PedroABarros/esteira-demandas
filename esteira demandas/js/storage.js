/* =====================================================================
   STORAGE.JS
   Camada única responsável por:
   - Definir as chaves de LocalStorage
   - Ler/gravar cada "tabela" (tasks, fixedTasks, activityLog, settings,
     dailyHistory)
   - Prover os dados padrão iniciais (seed) na primeira execução
   Nenhum outro módulo deve acessar localStorage diretamente: tudo passa
   por aqui, para manter uma única fonte de verdade sobre o formato dos
   dados salvos.
===================================================================== */

const STORAGE_KEYS = {
  tasks: 'esteira_v2_tasks',
  fixedTasks: 'esteira_v2_fixedTasks',
  activityLog: 'esteira_v2_activityLog',
  settings: 'esteira_v2_settings',
  dailyHistory: 'esteira_v2_dailyHistory'
};

const Storage = {

  // ---------- Tarefas do Kanban ----------
  getTasks(){
    return safeParse(localStorage.getItem(STORAGE_KEYS.tasks), []);
  },
  saveTasks(tasks){
    localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
  },

  // ---------- Demandas fixas ----------
  getFixedTasks(){
    const raw = localStorage.getItem(STORAGE_KEYS.fixedTasks);
    if(raw === null) return getDefaultFixedTasks();
    return safeParse(raw, []);
  },
  saveFixedTasks(list){
    localStorage.setItem(STORAGE_KEYS.fixedTasks, JSON.stringify(list));
  },

  // ---------- Log de atividades (últimas ações) ----------
  getActivityLog(){
    return safeParse(localStorage.getItem(STORAGE_KEYS.activityLog), []);
  },
  saveActivityLog(log){
    // mantém só as últimas 30 entradas para não crescer indefinidamente
    const trimmed = log.slice(-30);
    localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(trimmed));
  },
  pushActivity(type, title){
    const log = Storage.getActivityLog();
    log.push({
      time: new Date().toISOString(),
      type,   // 'iniciou' | 'pausou' | 'retomou' | 'finalizou' | 'criou'
      title
    });
    Storage.saveActivityLog(log);
  },

  // ---------- Configurações gerais (UI) ----------
  getSettings(){
    return safeParse(localStorage.getItem(STORAGE_KEYS.settings), {
      sidebarCollapsed: false,
      search: '',
      currentPage: 'dashboard'
    });
  },
  saveSettings(settings){
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  },

  // ---------- Histórico diário (para relatório semanal) ----------
  getDailyHistory(){
    return safeParse(localStorage.getItem(STORAGE_KEYS.dailyHistory), {});
  },
  saveDailyHistory(history){
    localStorage.setItem(STORAGE_KEYS.dailyHistory, JSON.stringify(history));
  },
  /* Atualiza o snapshot do dia atual com os minutos trabalhados,
     para alimentar o gráfico de produtividade semanal. */
  updateTodaySnapshot(workedMinutes, plannedMinutes){
    const history = Storage.getDailyHistory();
    const key = todayKey();
    history[key] = { workedMinutes, plannedMinutes };
    Storage.saveDailyHistory(history);
  }
};

function safeParse(raw, fallback){
  if(raw === null || raw === undefined) return fallback;
  try{
    return JSON.parse(raw);
  }catch(e){
    console.error('Dado corrompido no localStorage, usando valor padrão.', e);
    return fallback;
  }
}

function todayKey(d = new Date()){
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function uid(prefix = 'id'){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* Demandas fixas padrão, carregadas apenas na primeira execução
   (quando ainda não existe nada salvo no navegador). */
function getDefaultFixedTasks(){
  return [
    { id: uid('fx'), title: 'E-mails', time: '08:00', duration: 30, category: 'outros', active: true },
    { id: uid('fx'), title: 'Daily Comercial', time: '09:00', duration: 30, category: 'comercial', active: true },
    { id: uid('fx'), title: 'Atualização BI', time: '10:30', duration: 45, category: 'bi', active: true }
  ];
}
