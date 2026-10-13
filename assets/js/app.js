
/* ===== PALĪGFUNKCIJAS ===== */

var months = [
    'janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs',
    'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'
];

async function api(url, method = 'GET', data = null) {
    var options = {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
    };

    if (data !== null) {
        options.body = JSON.stringify(data);
    }

    var response = await fetch(url, options);
    var result;

    try {
        result = await response.json();
    } catch {
        throw new Error('Serveris neatgrieza derīgu JSON atbildi.');
    }

    if (!response.ok || result.error) {
        throw new Error(result.error || 'Radās servera kļūda.');
    }

    return result;
}

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

function formatDate(text) {
    if (!text) return 'bez termiņa';

    var p = String(text).split('-');
    return Number(p[2]) + '. ' + months[Number(p[1]) - 1];
}

function dueNumber(text) {
    if (!text) return 99999999999999;
    return Date.parse(text);
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* Pārveido MySQL lauku nosaukumus uz JavaScript nosaukumiem */

function normalizeTask(task) {
    return {
        id: Number(task.id),
        userId: Number(task.user_id),
        projectId: task.project_id ? Number(task.project_id) : null,
        assignee: task.assignee_id ? Number(task.assignee_id) : null,
        title: task.title,
        description: task.description || '',
        due: task.due || '',
        priority: task.priority || 'Medium',
        done: Number(task.done) === 1 || task.done === true,
        projectName: task.project_name || '',
        assigneeName: task.assignee_name || ''
    };
}

function normalizeProject(project) {
    return {
        id: Number(project.id),
        ownerId: Number(project.owner_id),
        name: project.name,
        description: project.description || '',
        members: project.members || [],
        tasks: (project.tasks || []).map(normalizeTask),
        memberCount: Number(project.member_count || (project.members || []).length),
        taskCount: Number(project.task_count || 0),
        doneCount: Number(project.done_count || 0)
    };
}

function normalizeInvitation(inv) {
    return {
        id: Number(inv.id),
        projectId: Number(inv.project_id),
        userId: Number(inv.user_id),
        invitedBy: Number(inv.invited_by),
        projectName: inv.project_name || '',
        senderName: inv.sender_name || '',
        status: inv.status || 'pending'
    };
}

function showMessage(error) {
    console.error(error);
    alert(error.message || 'Radās neparedzēta kļūda.');
}

/* ===== API DATU IELĀDE ===== */

async function loadTasks() {
    var data = await api('api/tasks.php');
    return data.map(normalizeTask);
}

async function loadProjects() {
    var data = await api('api/projects.php');
    return data.map(normalizeProject);
}

async function loadProject(id) {
    var data = await api('api/projects.php?id=' + encodeURIComponent(id));
    return normalizeProject(data);
}

async function loadInvitations() {
    var data = await api('api/invitations.php');
    return data.map(normalizeInvitation);
}

async function createTask(task) {
    return await api('api/tasks.php', 'POST', task);
}

async function updateTask(task) {
    return await api('api/tasks.php', 'PUT', task);
}

async function deleteTask(id) {
    return await api(
        'api/tasks.php?id=' + encodeURIComponent(id),
        'DELETE'
    );
}

async function createProject(project) {
    return await api('api/projects.php', 'POST', project);
}

async function createInvitation(projectId, email) {
    return await api('api/invitations.php', 'POST', {
        action: 'create',
        projectId: projectId,
        email: email
    });
}

async function respondToInvitation(id, action) {
    return await api('api/invitations.php', 'POST', {
        id: id,
        action: action
    });
}

/* ===== PIESLĒGŠANĀS STATUSS ===== */

var page = document.body.dataset.page;
var me = null;
var isAuthPage = page === 'login' || page === 'register';

async function checkSession() {
    if (page === 'index') return;

    try {
        var data = await api('api/auth.php?action=me');
        me = data.user;

        if (!isAuthPage && me == null) {
            window.location.href = 'login.html';
        } else if (isAuthPage && me != null) {
            window.location.href = 'dashboard.html';
        } else {
            startPage();
        }
    } catch (error) {
        console.error('Session check failed:', error);
        alert('Neizdevās pārbaudīt pieslēgšanos. Pārbaudi PHP un MariaDB.');
    }
}

checkSession();


function startPage() {
    if (me != null) {
        updateNav();
        setupDeleteAccount();
    }

    if (page === 'login') loginPage();
    if (page === 'register') registerPage();
    if (page === 'dashboard' || page === 'tasks') tasksPage();
    if (page === 'task-new') taskNewPage();
    if (page === 'task-edit') taskEditPage();
    if (page === 'projects') projectsPage();
    if (page === 'project-new') projectNewPage();
    if (page === 'project') projectPage();
    if (page === 'invite') invitePage();
    if (page === 'invitations') invitationsPage();

    setupFilters();
}
/* ===== IZVĒLNE ===== */

async function pendingInvitations() {
    return await loadInvitations();
}

async function updateNav() {
    var link = document.querySelector('.links a[href="invitations.html"]');

    if (link) {
        try {
            var invitations = await pendingInvitations();
            link.textContent = invitations.length > 0
                ? 'Uzaicinājumi (' + invitations.length + ')'
                : 'Uzaicinājumi';
        } catch (error) {
            console.error(error);
        }
    }

    var logout = document.querySelector('.links a[href="login.html"]');

    if (logout && !logout.dataset.logoutBound) {
        logout.dataset.logoutBound = 'true';

        logout.addEventListener('click', async function (e) {
            e.preventDefault();

            try {
                await api('api/auth.php?action=logout', 'POST');
            } catch (error) {
                console.error('Izrakstīšanās kļūda:', error);
            }

            window.location.href = 'login.html';
        });
    }
}

/* ===== FORMU VALIDĀCIJA ===== */

function checkForm(form) {
    var fields = form.querySelectorAll('[data-req]');
    var allGood = true;

    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var value = field.value.trim();
        var message = '';

        if (value === '') {
            message = 'Šis lauks ir obligāts.';
        } else if (field.type === 'email' && !value.includes('@')) {
            message = 'Ievadi derīgu e-pasta adresi.';
        } else if (
            field.type === 'password' &&
            page === 'register' &&
            value.length < 8
        ) {
            message = 'Parolei jābūt vismaz 8 simboliem.';
        }

        showError(field, message);

        if (message !== '') allGood = false;
    }

    return allGood;
}

function showError(field, message) {
    var error = document.querySelector('.err[data-for="' + field.id + '"]');

    if (!error) {
        error = document.createElement('div');
        error.className = 'err';
        error.dataset.for = field.id;
        field.insertAdjacentElement('afterend', error);
    }

    error.textContent = message;
    error.style.display = message === '' ? 'none' : 'block';

    if (message === '') {
        field.classList.remove('bad');
    } else {
        field.classList.add('bad');
    }
}

/* ===== REĢISTRĀCIJA UN PIESLĒGŠANĀS ===== */

function registerPage() {
    document.getElementById('form').addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!checkForm(this)) return;

        try {
            await api('api/auth.php?action=register', 'POST', {
                name: document.getElementById('name').value.trim(),
                email: document.getElementById('email').value.trim().toLowerCase(),
                password: document.getElementById('pw').value
            });

            window.location.href = 'dashboard.html';
        } catch (error) {
            showError(
                document.getElementById('email'),
                error.message || 'Reģistrācija neizdevās.'
            );
        }
    });
}

function loginPage() {
    document.getElementById('form').addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!checkForm(this)) return;

        try {
            await api('api/auth.php?action=login', 'POST', {
                email: document.getElementById('email').value.trim().toLowerCase(),
                password: document.getElementById('pw').value
            });

            window.location.href = 'dashboard.html';
        } catch (error) {
            showError(
                document.getElementById('pw'),
                error.message || 'Pieslēgšanās neizdevās.'
            );
        }
    });
}

/* ===== UZDEVUMU SARAKSTS ===== */

function taskMeta(task) {
    var parts = [];

    parts.push(task.projectName || 'Personīgais uzdevums');

    if (task.assigneeName) {
        parts.push(task.assigneeName);
    }

    return escapeHtml(parts.join(' · '));
}

function taskCard(task) {
    var label = task.done ? 'Pabeigts' : task.priority;
    var status = task.done ? 'done' : 'active';

    return '<a class="card" href="task-edit.html?id=' + task.id + '"' +
        ' data-status="' + status + '"' +
        ' data-pri="' + escapeHtml(task.priority) + '"' +
        ' data-due="' + dueNumber(task.due) + '">' +
        '<h3>' + escapeHtml(task.title) + '</h3>' +
        '<div class="m">' + taskMeta(task) + '</div>' +
        '<div class="g">' + escapeHtml(label) + ' · ' + formatDate(task.due) + '</div>' +
        '</a>';
}

function showTasks(list) {
    var html = '';

    for (var i = 0; i < list.length; i++) {
        html += taskCard(list[i]);
    }

    if (html === '') {
        html = '<div class="card"><div class="m">Šeit vēl nav uzdevumu.</div></div>';
    }

    var box = document.getElementById('taskList');
    if (box) box.innerHTML = html;
}

async function myProjects() {
    return await loadProjects();
}

async function tasksPage() {
    try {
        var mine = await loadTasks();
        var done = 0;
        var projects = await myProjects();

        for (var i = 0; i < mine.length; i++) {
            if (mine[i].done) done++;
        }

        if (page === 'dashboard') {
            document.getElementById('greeting').textContent = 'Labrīt, ' + me.name + '!';
        }

        document.getElementById('st1').textContent =
            (mine.length - done) + ' aktīvi uzdevumi';

        document.getElementById('st2').textContent = done + ' pabeigti';
        document.getElementById('st3').textContent = projects.length + ' projekti';

        showTasks(mine);
    } catch (error) {
        showMessage(error);
    }
}

function canUseProject(project) {
    if (!project || !Array.isArray(project.members)) return false;

    return project.members.some(function (member) {
        return Number(member.id) === Number(me.id);
    });
}

function isAdmin(project) {
    return project != null && Number(project.ownerId) === Number(me.id);
}

function fillMembers(project, selectedId) {
    var select = document.getElementById('assignee');
    var box = document.getElementById('assignBox');

    if (!select || !box) return;

    var html = '<option value="">Nav piešķirts</option>';

    for (var i = 0; i < project.members.length; i++) {
        var user = project.members[i];
        var selected = Number(user.id) === Number(selectedId) ? ' selected' : '';

        html += '<option value="' + Number(user.id) + '"' + selected + '>' +
            escapeHtml(user.name) + '</option>';
    }

    select.innerHTML = html;
    box.hidden = false;
}

async function taskNewPage() {
    try {
        var projectId = getParam('project');
        var project = null;

        if (projectId) {
            project = await loadProject(projectId);

            if (!canUseProject(project)) {
                window.location.href = 'projects.html';
                return;
            }

            if (!isAdmin(project)) {
                window.location.href = 'project.html?id=' + project.id;
                return;
            }

            fillMembers(project, null);
        }

        document.getElementById('form').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!checkForm(this)) return;

            var assignee = document.getElementById('assignee');
            var task = {
                projectId: project ? project.id : null,
                assignee: assignee && assignee.value ? Number(assignee.value) : null,
                title: document.getElementById('title').value.trim(),
                description: document.getElementById('desc').value.trim(),
                due: document.getElementById('due').value,
                priority: document.getElementById('pri').value
            };

            try {
                await createTask(task);
                window.location.href = project
                    ? 'project.html?id=' + project.id
                    : 'tasks.html';
            } catch (error) {
                showMessage(error);
            }
        });
    } catch (error) {
        showMessage(error);
    }
}

async function taskEditPage() {
    try {
        var id = getParam('id');
        var allTasks = await loadTasks();
        var task = allTasks.find(function (item) {
            return Number(item.id) === Number(id);
        });

        if (!task) {
            window.location.href = 'tasks.html';
            return;
        }

        var project = null;

        if (task.projectId) {
            project = await loadProject(task.projectId);

            if (!canUseProject(project)) {
                window.location.href = 'tasks.html';
                return;
            }
        } else if (Number(task.userId) !== Number(me.id)) {
            window.location.href = 'tasks.html';
            return;
        }

        var admin = !project || isAdmin(project);
        var canTick = admin || Number(task.assignee) === Number(me.id);

        if (project) fillMembers(project, task.assignee);

        var backPage = project
            ? 'project.html?id=' + project.id
            : 'tasks.html';

        document.getElementById('title').value = task.title;
        document.getElementById('desc').value = task.description;
        document.getElementById('due').value = task.due;
        document.getElementById('pri').value = task.priority;
        document.getElementById('status').value =
            task.done ? 'Pabeigts' : 'Nepabeigts';

        if (!admin) {
            var locked = ['title', 'desc', 'due', 'pri', 'assignee'];

            for (var i = 0; i < locked.length; i++) {
                var field = document.getElementById(locked[i]);
                if (field) field.disabled = true;
            }

            document.getElementById('deleteBtn').hidden = true;

            if (!canTick) {
                document.getElementById('status').disabled = true;
                document.querySelector('#form button[type="submit"]').hidden = true;
            }
        }

        document.getElementById('form').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!checkForm(this) || !canTick) return;

            var assignee = document.getElementById('assignee');
            var data = {
                id: task.id,
                title: admin ? document.getElementById('title').value.trim() : task.title,
                description: admin ? document.getElementById('desc').value.trim() : task.description,
                due: admin ? document.getElementById('due').value : task.due,
                priority: admin ? document.getElementById('pri').value : task.priority,
                done: document.getElementById('status').value === 'Pabeigts',
                assignee: admin && assignee && assignee.value
                    ? Number(assignee.value)
                    : task.assignee
            };

            try {
                await updateTask(data);
                window.location.href = backPage;
            } catch (error) {
                showMessage(error);
            }
        });

        document.getElementById('deleteBtn').addEventListener('click', async function () {
            if (!admin) return;
            if (!confirm('Vai tiešām dzēst šo uzdevumu?')) return;

            try {
                await deleteTask(task.id);
                window.location.href = backPage;
            } catch (error) {
                showMessage(error);
            }
        });
    } catch (error) {
        showMessage(error);
    }
}

/* ===== PROJEKTI ===== */

function percentDone(list) {
    if (list.length === 0) return 0;

    var done = 0;

    for (var i = 0; i < list.length; i++) {
        if (list[i].done) done++;
    }

    return Math.round(done / list.length * 100);
}

async function projectsPage() {
    try {
        var list = await loadProjects();
        var html = '';

        for (var i = 0; i < list.length; i++) {
            var project = list[i];
            var percent = project.taskCount > 0
                ? Math.round(project.doneCount / project.taskCount * 100)
                : 0;

            var state = project.taskCount > 0 && percent === 100
                ? 'Pabeigts · 100%'
                : 'Aktīvs · ' + percent + '% pabeigts';

            html += '<a class="card" href="project.html?id=' + project.id + '">' +
                '<h3>' + escapeHtml(project.name) + '</h3>' +
                '<div class="m">' + project.memberCount + ' dalībnieki · ' +
                project.taskCount + ' uzdevumi</div>' +
                '<div class="g">' + state + '</div>' +
                '</a>';
        }

        if (html === '') {
            html = '<div class="card"><div class="m">Tev vēl nav projektu. Izveido pirmo!</div></div>';
        }

        document.getElementById('projectList').innerHTML = html;
    } catch (error) {
        showMessage(error);
    }
}

async function projectNewPage() {
    document.getElementById('form').addEventListener('submit', async function (e) {
        e.preventDefault();
        if (!checkForm(this)) return;

        var emailField = document.getElementById('email');
        var email = emailField ? emailField.value.trim().toLowerCase() : '';

        try {
            var project = await createProject({
                name: document.getElementById('name').value.trim(),
                description: document.getElementById('desc').value.trim(),
                inviteEmail: email
            });

            window.location.href = 'project.html?id=' + project.id;
        } catch (error) {
            if (emailField && email !== '') {
                showError(emailField, error.message);
            } else {
                showMessage(error);
            }
        }
    });
}

async function projectPage() {
    try {
        var project = await loadProject(getParam('id'));

        if (!canUseProject(project)) {
            window.location.href = 'projects.html';
            return;
        }

        var tasks = project.tasks || [];

        document.title = project.name + ' – ToDo';
        document.getElementById('projName').textContent = project.name;

        var admin = isAdmin(project);
        var role = admin ? 'administrators' : 'dalībnieks';

        document.getElementById('projSub').textContent =
            'Projekts / ' + project.name + ' · ' +
            project.members.length + ' dalībnieki · Tava loma: ' + role;

        var addTaskBtn = document.getElementById('addTask');
        var inviteBtn = document.getElementById('inviteBtn');

        if (admin) {
            addTaskBtn.href = 'task-new.html?project=' + project.id;
            inviteBtn.href = 'invite.html?id=' + project.id;
        } else {
            addTaskBtn.remove();
            inviteBtn.remove();
        }

        document.getElementById('st1').textContent = tasks.length + ' uzdevumi';
        document.getElementById('st2').textContent =
            project.members.length + ' dalībnieki';
        document.getElementById('st3').textContent =
            percentDone(tasks) + '% pabeigts';

        showTasks(tasks);
    } catch (error) {
        showMessage(error);
    }
}

/* ===== UZAICINĀJUMI ===== */

async function invitePage() {
    try {
        var project = await loadProject(getParam('id'));

        if (!canUseProject(project) || !isAdmin(project)) {
            window.location.href = 'projects.html';
            return;
        }

        document.getElementById('form').addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!checkForm(this)) return;

            var emailField = document.getElementById('email');
            var email = emailField.value.trim().toLowerCase();

            try {
                await createInvitation(project.id, email);
                window.location.href = 'project.html?id=' + project.id;
            } catch (error) {
                showError(emailField, error.message);
            }
        });
    } catch (error) {
        showMessage(error);
    }
}

async function invitationsPage() {
    var box = document.getElementById('invList');

    async function show() {
        try {
            var list = await pendingInvitations();
            var html = '';

            for (var i = 0; i < list.length; i++) {
                var inv = list[i];

                html += '<div class="card">' +
                    '<h3>' + escapeHtml(inv.senderName || 'Lietotājs') +
                    ' uzaicina tevi</h3>' +
                    '<div class="m">Projekts: ' +
                    escapeHtml(inv.projectName || 'Projekts') + '</div>' +
                    '<div class="g">Gaida atbildi</div>' +
                    '<button class="btn" data-accept="' + inv.id +
                    '">Pieņemt uzaicinājumu</button><br>' +
                    '<button class="link-btn" data-decline="' + inv.id +
                    '">Noraidīt</button></div>';
            }

            if (html === '') {
                html = '<div class="card"><div class="m">Nav jaunu uzaicinājumu.</div></div>';
            }

            box.innerHTML = html;
            updateNav();
        } catch (error) {
            showMessage(error);
        }
    }

    box.addEventListener('click', async function (e) {
        var accept = e.target.dataset.accept;
        var decline = e.target.dataset.decline;

        try {
            if (accept) {
                await respondToInvitation(accept, 'accept');
                await show();
            }

            if (decline) {
                await respondToInvitation(decline, 'decline');
                await show();
            }
        } catch (error) {
            showMessage(error);
        }
    });

    await show();
}

/* ===== FILTRI UN KĀRTOŠANA ===== */

function setupFilters() {
    var taskList = document.getElementById('taskList');

    if (!taskList) return;

    var currentStatus = 'all';
    var currentPriority = 'all';
    var currentSort = 'due';

    function priorityNumber(name) {
        if (name === 'High') return 1;
        if (name === 'Medium') return 2;
        return 3;
    }

    function updateTasks() {
        var cards = [];
        var items = taskList.children;

        for (var i = 0; i < items.length; i++) {
            if (items[i].dataset.status) cards.push(items[i]);
        }

        cards.sort(function (a, b) {
            if (currentSort === 'due') {
                return Number(a.dataset.due) - Number(b.dataset.due);
            }

            return priorityNumber(a.dataset.pri) - priorityNumber(b.dataset.pri);
        });

        for (var j = 0; j < cards.length; j++) {
            var card = cards[j];
            var statusOk = currentStatus === 'all' ||
                card.dataset.status === currentStatus;
            var priorityOk = currentPriority === 'all' ||
                card.dataset.pri === currentPriority;

            taskList.appendChild(card);

            if (statusOk && priorityOk) {
                card.classList.remove('hide');
            } else {
                card.classList.add('hide');
            }
        }
    }

    var buttons = document.querySelectorAll('button[data-status]');

    for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', function () {
            currentStatus = this.dataset.status;

            for (var k = 0; k < buttons.length; k++) {
                buttons[k].classList.remove('on');
            }

            this.classList.add('on');
            updateTasks();
        });
    }

    var prioritySelect = document.getElementById('fPri');
    if (prioritySelect) {
        prioritySelect.addEventListener('change', function () {
            currentPriority = this.value;
            updateTasks();
        });
    }

    var sortSelect = document.getElementById('fSort');
    if (sortSelect) {
        sortSelect.addEventListener('change', function () {
            currentSort = this.value;
            updateTasks();
        });
    }

    updateTasks();
}

/* ===== KONTA DZĒŠANA ===== */

function setupDeleteAccount() {
    var button = document.getElementById('deleteAccountBtn');

    if (!button || button.dataset.bound === 'true') {
        return;
    }

    button.dataset.bound = 'true';

    button.addEventListener('click', async function () {
        var confirmed = confirm(
            'Vai tiešām vēlies dzēst savu kontu? ' +
            'Šo darbību nevarēs atcelt, un tavi dati tiks dzēsti.'
        );

        if (!confirmed) return;

        var finalConfirmation = confirm(
            'Pēdējais brīdinājums: dzēst kontu neatgriezeniski?'
        );

        if (!finalConfirmation) return;

        button.disabled = true;

        try {
            await api('api/auth.php?action=delete-account', 'POST');

            alert('Konts ir dzēsts.');
            window.location.href = 'login.html';
        } catch (error) {
            alert(error.message || 'Neizdevās dzēst kontu.');
            button.disabled = false;
        }
    });
}