/* ==========================================================
                TASKS SERVICE
========================================================== */

const STORAGE_KEY = "esteira_v2_tasks";

let tasks = [];

function generateId(){

    return crypto.randomUUID();

}

function saveTasks(){

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(tasks)
    );

}

function loadTasks(){

    const data = localStorage.getItem(STORAGE_KEY);

    if(data){

        tasks = JSON.parse(data);

    }else{

        tasks = [];

    }

}

function getTasks(){

    return tasks;

}