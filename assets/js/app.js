// ToDo - darbojas bez datubāzes (dati glabājas pārlūkā, localStorage)
// Vēlāk šo daļu aizstāsim ar PHP + MySQL


// ===== PALĪGFUNKCIJAS =====

var months = ['janvāris', 'februāris', 'marts', 'aprīlis', 'maijs', 'jūnijs',
              'jūlijs', 'augusts', 'septembris', 'oktobris', 'novembris', 'decembris'];

function load(key) {
    var text = localStorage.getItem(key);
    if (text == null) {
        return [];
    }
    return JSON.parse(text);
}

function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function newId(list) {
    var max = 0;
    for (var i = 0; i < list.length; i++) {
        if (list[i].id > max) {
            max = list[i].id;
        }
    }
    return max + 1;
}

function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return list[i];
        }
    }
    return null;
}

function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// vienkārša paroles "jaucējfunkcija", lai parole neglabātos atklāti
// (PHP versijā lietosim password_hash)
function hashPassword(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) % 1000000007;
    }
    return 'h' + h;
}

function formatDate(text) {
    if (!text) {
        return 'bez termiņa';
    }
    var p = text.split('-');
    return Number(p[2]) + '. ' + months[p[1] - 1];
}

function dueNumber(text) {
    if (!text) {
        return 99999999999999;
    }
    return Date.parse(text);
}

// aizsargā pret ļaunprātīgu HTML ievadi
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}


// ===== PIESLĒGŠANĀS STATUSS =====

var page = document.body.dataset.page;
var me = findById(load('users'), localStorage.getItem('session'));
var isAuthPage = (page == 'login' || page == 'register');

if (page == 'index') {
    // nekas
} else if (!isAuthPage && me == null) {
    window.location.href = 'login.html';   // neautorizēts lietotājs
} else if (isAuthPage && me != null) {
    window.location.href = 'dashboard.html';
} else {
    startPage();
}


function startPage() {
    if (me != null) {
        updateNav();
    }

    if (page == 'login') loginPage();
    if (page == 'register') registerPage();
    if (page == 'dashboard' || page == 'tasks') tasksPage();
    if (page == 'task-new') taskNewPage();
    if (page == 'task-edit') taskEditPage();
    if (page == 'projects') projectsPage();
    if (page == 'project-new') projectNewPage();
    if (page == 'project') projectPage();
    if (page == 'invite') invitePage();
    if (page == 'invitations') invitationsPage();

    setupFilters();
}


// ===== IZVĒLNE =====

function pendingInvitations() {
    var all = load('invitations');
    var result = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].userId == me.id && all[i].status == 'pending') {
            result.push(all[i]);
        }
    }
    return result;
}

function updateNav() {
    var count = pendingInvitations().length;
    var link = document.querySelector('.links a[href="invitations.html"]');
    link.textContent = count > 0 ? 'Uzaicinājumi (' + count + ')' : 'Uzaicinājumi';

    // izrakstīšanās
    var logout = document.querySelector('.links a[href="login.html"]');
    logout.addEventListener('click', function () {
        localStorage.removeItem('session');
    });
}


// ===== FORMU VALIDĀCIJA =====

function checkForm(form) {
    var fields = form.querySelectorAll('[data-req]');
    var allGood = true;

    for (var i = 0; i < fields.length; i++) {
        var field = fields[i];
        var text = field.value.trim();
        var message = '';

        if (text == '') {
            message = 'Šis lauks ir obligāts.';
        }
        else if (field.type == 'email' && !text.includes('@')) {
            message = 'Ievadi derīgu e-pasta adresi.';
        }
        else if (field.type == 'password' && page == 'register' && text.length < 8) {
            message = 'Parolei jābūt vismaz 8 simboliem.';
        }

        showError(field, message);

        if (message != '') {
            allGood = false;
        }
    }

    return allGood;
}

function showError(field, message) {
    var error = document.querySelector('.err[data-for="' + field.id + '"]');

    if (error == null) {
        error = document.createElement('div');
        error.className = 'err';
        error.dataset.for = field.id;
        field.insertAdjacentElement('afterend', error);
    }

    error.textContent = message;
    error.style.display = (message == '') ? 'none' : 'block';

    if (message == '') {
        field.classList.remove('bad');
    } else {
        field.classList.add('bad');
    }
}


// ===== REĢISTRĀCIJA UN PIESLĒGŠANĀS =====

function registerPage() {
    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var name = document.getElementById('name').value.trim();
        var email = document.getElementById('email').value.trim().toLowerCase();
        var password = document.getElementById('pw').value;
        var users = load('users');

        // e-pastam jābūt unikālam
        for (var i = 0; i < users.length; i++) {
            if (users[i].email == email) {
                showError(document.getElementById('email'), 'Šis e-pasts jau ir reģistrēts.');
                return;
            }
        }

        var user = { id: newId(users), name: name, email: email, password: hashPassword(password) };
        users.push(user);
        save('users', users);

        localStorage.setItem('session', user.id);
        window.location.href = 'dashboard.html';
    });
}

function loginPage() {
    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var email = document.getElementById('email').value.trim().toLowerCase();
        var password = document.getElementById('pw').value;
        var users = load('users');

        for (var i = 0; i < users.length; i++) {
            if (users[i].email == email && users[i].password == hashPassword(password)) {
                localStorage.setItem('session', users[i].id);
                window.location.href = 'dashboard.html';
                return;
            }
        }

        showError(document.getElementById('pw'), 'Nepareizs e-pasts vai parole.');
    });
}


// ===== UZDEVUMU SARAKSTS =====

function taskMeta(task) {
    var parts = [];
    var project = task.projectId ? findById(load('projects'), task.projectId) : null;
    var person = task.assignee ? findById(load('users'), task.assignee) : null;

    parts.push(project ? project.name : 'Personīgais uzdevums');

    if (person) {
        parts.push(person.name);
    }

    return escapeHtml(parts.join(' · '));
}

function taskCard(task) {
    var label = task.done ? 'Pabeigts' : task.priority;
    var status = task.done ? 'done' : 'active';

    return '<a class="card" href="task-edit.html?id=' + task.id + '"' +
           ' data-status="' + status + '" data-pri="' + task.priority + '" data-due="' + dueNumber(task.due) + '">' +
           '<h3>' + escapeHtml(task.title) + '</h3>' +
           '<div class="m">' + taskMeta(task) + '</div>' +
           '<div class="g">' + label + ' · ' + formatDate(task.due) + '</div>' +
           '</a>';
}

function showTasks(list) {
    var html = '';

    for (var i = 0; i < list.length; i++) {
        html += taskCard(list[i]);
    }

    if (html == '') {
        html = '<div class="card"><div class="m">Šeit vēl nav uzdevumu.</div></div>';
    }

    document.getElementById('taskList').innerHTML = html;
}

function myProjects() {
    var all = load('projects');
    var result = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].members.indexOf(me.id) != -1) {
            result.push(all[i]);
        }
    }
    return result;
}

function tasksPage() {
    var all = load('tasks');
    var mine = [];
    var done = 0;

    // mani uzdevumi: personīgie + man piešķirtie
    for (var i = 0; i < all.length; i++) {
        var t = all[i];
        if ((!t.projectId && t.userId == me.id) || t.assignee == me.id) {
            mine.push(t);
            if (t.done) done++;
        }
    }

    if (page == 'dashboard') {
        document.getElementById('greeting').textContent = 'Labrīt, ' + me.name + '!';
    }

    document.getElementById('st1').textContent = (mine.length - done) + ' aktīvi uzdevumi';
    document.getElementById('st2').textContent = done + ' pabeigti';
    document.getElementById('st3').textContent = myProjects().length + ' projekti';

    showTasks(mine);
}


// ===== UZDEVUMA IZVEIDE UN REDIĢĒŠANA =====

function canUseProject(project) {
    return project != null && project.members.indexOf(me.id) != -1;
}

function fillMembers(project, selectedId) {
    var select = document.getElementById('assignee');
    var users = load('users');
    var html = '<option value="">Nav piešķirts</option>';

    for (var i = 0; i < project.members.length; i++) {
        var user = findById(users, project.members[i]);
        var selected = (user.id == selectedId) ? ' selected' : '';
        html += '<option value="' + user.id + '"' + selected + '>' + escapeHtml(user.name) + '</option>';
    }

    select.innerHTML = html;
    document.getElementById('assignBox').hidden = false;
}

function taskNewPage() {
    var projectId = getParam('project');
    var project = null;

    if (projectId) {
        project = findById(load('projects'), projectId);

        if (!canUseProject(project)) {
            window.location.href = 'projects.html';
            return;
        }
        fillMembers(project, null);
    }

    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var tasks = load('tasks');
        var assignee = document.getElementById('assignee').value;

        tasks.push({
            id: newId(tasks),
            userId: me.id,
            projectId: project ? project.id : null,
            assignee: assignee ? Number(assignee) : null,
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('desc').value.trim(),
            due: document.getElementById('due').value,
            priority: document.getElementById('pri').value,
            done: false
        });

        save('tasks', tasks);
        window.location.href = project ? 'project.html?id=' + project.id : 'tasks.html';
    });
}

function taskEditPage() {
    var tasks = load('tasks');
    var task = findById(tasks, getParam('id'));
    var project = null;

    if (task == null) {
        window.location.href = 'tasks.html';
        return;
    }

    // tiesību pārbaude
    if (task.projectId) {
        project = findById(load('projects'), task.projectId);
        if (!canUseProject(project)) {
            window.location.href = 'tasks.html';
            return;
        }
        fillMembers(project, task.assignee);
    } else if (task.userId != me.id) {
        window.location.href = 'tasks.html';
        return;
    }

    var backPage = project ? 'project.html?id=' + project.id : 'tasks.html';

    document.getElementById('title').value = task.title;
    document.getElementById('desc').value = task.description;
    document.getElementById('due').value = task.due;
    document.getElementById('pri').value = task.priority;
    document.getElementById('status').value = task.done ? 'Pabeigts' : 'Nepabeigts';

    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var assignee = document.getElementById('assignee').value;

        task.title = document.getElementById('title').value.trim();
        task.description = document.getElementById('desc').value.trim();
        task.due = document.getElementById('due').value;
        task.priority = document.getElementById('pri').value;
        task.done = (document.getElementById('status').value == 'Pabeigts');

        if (project) {
            task.assignee = assignee ? Number(assignee) : null;
        }

        save('tasks', tasks);
        window.location.href = backPage;
    });

    document.getElementById('deleteBtn').addEventListener('click', function () {
        if (!confirm('Vai tiešām dzēst šo uzdevumu?')) {
            return;
        }

        var left = [];
        for (var i = 0; i < tasks.length; i++) {
            if (tasks[i].id != task.id) {
                left.push(tasks[i]);
            }
        }

        save('tasks', left);
        window.location.href = backPage;
    });
}


// ===== PROJEKTI =====

function projectTasks(projectId) {
    var all = load('tasks');
    var result = [];
    for (var i = 0; i < all.length; i++) {
        if (all[i].projectId == projectId) {
            result.push(all[i]);
        }
    }
    return result;
}

function percentDone(list) {
    if (list.length == 0) {
        return 0;
    }
    var done = 0;
    for (var i = 0; i < list.length; i++) {
        if (list[i].done) done++;
    }
    return Math.round(done / list.length * 100);
}

function projectsPage() {
    var list = myProjects();
    var html = '';

    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var tasks = projectTasks(p.id);
        var percent = percentDone(tasks);
        var state = (tasks.length > 0 && percent == 100) ? 'Pabeigts · 100%' : 'Aktīvs · ' + percent + '% pabeigts';

        html += '<a class="card" href="project.html?id=' + p.id + '">' +
                '<h3>' + escapeHtml(p.name) + '</h3>' +
                '<div class="m">' + p.members.length + ' dalībnieki · ' + tasks.length + ' uzdevumi</div>' +
                '<div class="g">' + state + '</div>' +
                '</a>';
    }

    if (html == '') {
        html = '<div class="card"><div class="m">Tev vēl nav projektu. Izveido pirmo!</div></div>';
    }

    document.getElementById('projectList').innerHTML = html;
}

function createInvitation(projectId, user) {
    var invitations = load('invitations');

    invitations.push({
        id: newId(invitations),
        projectId: projectId,
        userId: user.id,
        invitedBy: me.id,
        status: 'pending'
    });

    save('invitations', invitations);
}

function findUserByEmail(email) {
    var users = load('users');
    for (var i = 0; i < users.length; i++) {
        if (users[i].email == email.trim().toLowerCase()) {
            return users[i];
        }
    }
    return null;
}

function projectNewPage() {
    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var emailField = document.getElementById('email');
        var email = emailField.value.trim();
        var invited = null;

        // e-pasts nav obligāts, bet ja ir, lietotājam jābūt reģistrētam
        if (email != '') {
            invited = findUserByEmail(email);

            if (invited == null) {
                showError(emailField, 'Lietotājs ar šādu e-pastu nav reģistrēts.');
                return;
            }
            if (invited.id == me.id) {
                showError(emailField, 'Tu jau esi projekta dalībnieks.');
                return;
            }
        }

        var projects = load('projects');
        var project = {
            id: newId(projects),
            ownerId: me.id,
            name: document.getElementById('name').value.trim(),
            description: document.getElementById('desc').value.trim(),
            members: [me.id]
        };

        projects.push(project);
        save('projects', projects);

        if (invited != null) {
            createInvitation(project.id, invited);
        }

        window.location.href = 'project.html?id=' + project.id;
    });
}

function projectPage() {
    var project = findById(load('projects'), getParam('id'));

    if (!canUseProject(project)) {
        window.location.href = 'projects.html';
        return;
    }

    var tasks = projectTasks(project.id);

    document.title = project.name + ' – ToDo';
    document.getElementById('projName').textContent = project.name;
    document.getElementById('projSub').textContent = 'Projekts / ' + project.name + ' · ' + project.members.length + ' dalībnieki';

    document.getElementById('addTask').href = 'task-new.html?project=' + project.id;

    // uzaicināt var tikai īpašnieks
    var inviteBtn = document.getElementById('inviteBtn');
    if (project.ownerId == me.id) {
        inviteBtn.href = 'invite.html?id=' + project.id;
    } else {
        inviteBtn.remove();
    }

    document.getElementById('st1').textContent = tasks.length + ' uzdevumi';
    document.getElementById('st2').textContent = project.members.length + ' dalībnieki';
    document.getElementById('st3').textContent = percentDone(tasks) + '% pabeigts';

    showTasks(tasks);
}


// ===== UZAICINĀJUMI =====

function invitePage() {
    var project = findById(load('projects'), getParam('id'));

    // uzaicināt drīkst tikai projekta īpašnieks
    if (project == null || project.ownerId != me.id) {
        window.location.href = 'projects.html';
        return;
    }

    document.getElementById('form').addEventListener('submit', function (e) {
        e.preventDefault();

        if (!checkForm(this)) {
            return;
        }

        var emailField = document.getElementById('email');
        var user = findUserByEmail(emailField.value);

        if (user == null) {
            showError(emailField, 'Lietotājs ar šādu e-pastu nav reģistrēts.');
            return;
        }
        if (project.members.indexOf(user.id) != -1) {
            showError(emailField, 'Šis lietotājs jau ir projekta dalībnieks.');
            return;
        }

        var invitations = load('invitations');
        for (var i = 0; i < invitations.length; i++) {
            var inv = invitations[i];
            if (inv.projectId == project.id && inv.userId == user.id && inv.status == 'pending') {
                showError(emailField, 'Uzaicinājums šim lietotājam jau ir nosūtīts.');
                return;
            }
        }

        createInvitation(project.id, user);
        window.location.href = 'project.html?id=' + project.id;
    });
}

function invitationsPage() {
    var box = document.getElementById('invList');

    function show() {
        var list = pendingInvitations();
        var html = '';

        for (var i = 0; i < list.length; i++) {
            var project = findById(load('projects'), list[i].projectId);
            var sender = findById(load('users'), list[i].invitedBy);

            html += '<div class="card">' +
                    '<h3>' + escapeHtml(sender.name) + ' uzaicina tevi</h3>' +
                    '<div class="m">Projekts: ' + escapeHtml(project.name) + '</div>' +
                    '<div class="g">Gaida atbildi</div>' +
                    '<button class="btn" data-accept="' + list[i].id + '">Pieņemt uzaicinājumu</button><br>' +
                    '<button class="link-btn" data-decline="' + list[i].id + '">Noraidīt</button>' +
                    '</div>';
        }

        if (html == '') {
            html = '<div class="card"><div class="m">Nav jaunu uzaicinājumu.</div></div>';
        }

        box.innerHTML = html;
        updateNav();
    }

    box.addEventListener('click', function (e) {
        var accept = e.target.dataset.accept;
        var decline = e.target.dataset.decline;
        var invitations = load('invitations');

        if (accept) {
            var inv = findById(invitations, accept);
            var projects = load('projects');
            var project = findById(projects, inv.projectId);

            inv.status = 'accepted';
            project.members.push(me.id);
            save('projects', projects);
            save('invitations', invitations);
            show();
        }

        if (decline) {
            findById(invitations, decline).status = 'declined';
            save('invitations', invitations);
            show();
        }
    });

    show();
}


// ===== FILTRI UN KĀRTOŠANA =====

function setupFilters() {
    var taskList = document.getElementById('taskList');

    if (taskList == null) {
        return;
    }

    var currentStatus = 'all';
    var currentPriority = 'all';
    var currentSort = 'due';

    function priorityNumber(name) {
        if (name == 'High') return 1;
        if (name == 'Medium') return 2;
        return 3;
    }

    function updateTasks() {
        var cards = [];
        var items = taskList.children;

        for (var i = 0; i < items.length; i++) {
            if (items[i].dataset.status) {
                cards.push(items[i]);
            }
        }

        cards.sort(function (a, b) {
            if (currentSort == 'due') {
                return a.dataset.due - b.dataset.due;
            }
            return priorityNumber(a.dataset.pri) - priorityNumber(b.dataset.pri);
        });

        for (var j = 0; j < cards.length; j++) {
            var card = cards[j];
            var statusOk = currentStatus == 'all' || card.dataset.status == currentStatus;
            var priorityOk = currentPriority == 'all' || card.dataset.pri == currentPriority;

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

    document.getElementById('fPri').addEventListener('change', function () {
        currentPriority = this.value;
        updateTasks();
    });

    document.getElementById('fSort').addEventListener('change', function () {
        currentSort = this.value;
        updateTasks();
    });

    updateTasks();
}
