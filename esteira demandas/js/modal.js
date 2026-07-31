/* =====================================================================
   MODAL.JS
   Controla a abertura/fechamento dos modais:
   - "Nova Demanda" (cria uma tarefa do Kanban, cai direto em "A Fazer")
   - "Nova Demanda Fixa" (usado dentro da página Grade Horária)
   Mantém um único overlay genérico reaproveitado pelos dois formulários.
===================================================================== */

const Modal = {
  openNewTask(){
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('modalNewTask').classList.add('show');
    document.getElementById('modalNewFixed').classList.remove('show');
    document.getElementById('nt-title').focus();
  },
  openNewFixed(){
    document.getElementById('modalOverlay').classList.add('show');
    document.getElementById('modalNewFixed').classList.add('show');
    document.getElementById('modalNewTask').classList.remove('show');
    document.getElementById('nf-title').focus();
  },
  closeAll(){
    document.getElementById('modalOverlay').classList.remove('show');
    document.getElementById('modalNewTask').classList.remove('show');
    document.getElementById('modalNewFixed').classList.remove('show');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  // Fecha ao clicar fora do card do modal
  document.getElementById('modalOverlay').addEventListener('click', Modal.closeAll);
  document.querySelectorAll('.modal-card').forEach(card => {
    card.addEventListener('click', e => e.stopPropagation());
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', Modal.closeAll);
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') Modal.closeAll();
  });

  // ---- Submit: Nova Demanda (Kanban) ----
  document.getElementById('formNewTask').addEventListener('submit', function(e){
    e.preventDefault();
    const title = document.getElementById('nt-title').value.trim();
    const description = document.getElementById('nt-description').value;
    const category = document.getElementById('nt-category').value;
    const priority = document.getElementById('nt-priority').value;
    const estimatedMinutes = document.getElementById('nt-estimated').value;

    if(!title) return;

    createTask({ title, description, category, priority, estimatedMinutes });
    this.reset();
    document.getElementById('nt-estimated').value = 60;
    Modal.closeAll();
    App.refreshAll();
    App.goToPage('kanban');
  });

  // ---- Submit: Nova Demanda Fixa ----
  document.getElementById('formNewFixed').addEventListener('submit', function(e){
    e.preventDefault();
    const title = document.getElementById('nf-title').value.trim();
    const time = document.getElementById('nf-time').value;
    const duration = document.getElementById('nf-duration').value;
    const category = document.getElementById('nf-category').value;

    if(!title || !time || !duration) return;

    createFixedTask({ title, time, duration, category });
    this.reset();
    document.getElementById('nf-time').value = '08:00';
    document.getElementById('nf-duration').value = 30;
    Modal.closeAll();
    App.refreshAll();
  });
});
