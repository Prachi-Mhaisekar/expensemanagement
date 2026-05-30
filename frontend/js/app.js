const COLORS = ['#0f3460', '#e94560', '#533483', '#2d6a4f', '#f4a261', '#264653', '#9b5de5'];
let editId = null;

function showPage(name) {
  document.querySelectorAll('.page').forEach((el) => el.classList.add('hidden'));
  document.getElementById('page-' + name).classList.remove('hidden');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('hidden', !msg);
}

function getToken() {
  return localStorage.getItem('token');
}

function setAuth(token, email) {
  localStorage.setItem('token', token);
  localStorage.setItem('email', email);
}

function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
}

async function api(path, method, body) {
  const options = {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  const token = getToken();
  if (token) options.headers.Authorization = 'Bearer ' + token;
  if (body) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch('/api' + path, options);
  } catch {
    throw new Error('Cannot reach server. Run: npm start');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso.replace(' ', 'T')).toLocaleString();
}

function formatMoney(n) {
  return '$' + Number(n).toFixed(2);
}

function logout() {
  clearAuth();
  editId = null;
  showPage('login');
}

async function checkServer() {
  try {
    await fetch('/api/health');
    document.getElementById('server-error').classList.add('hidden');
  } catch {
    showError('server-error', 'Server not running. Open terminal, run: npm start');
  }
}

async function loadExpenses() {
  showError('error-home', '');
  try {
    const data = await api('/expenses');
    const expenses = data.expenses || [];
    const tbody = document.getElementById('expense-table');
    tbody.innerHTML = '';

    const total = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    document.getElementById('total-expenses').textContent = formatMoney(total);

    const hasRows = expenses.length > 0;
    document.getElementById('table-wrap').classList.toggle('hidden', !hasRows);
    document.getElementById('no-expenses').classList.toggle('hidden', hasRows);

    expenses.forEach((exp) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + exp.category + '</td>' +
        '<td>' + formatMoney(exp.amount) + '</td>' +
        '<td>' + formatDate(exp.created_at) + '</td>' +
        '<td>' + formatDate(exp.updated_at) + '</td>' +
        '<td>' + (exp.comments || '-') + '</td>' +
        '<td>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-edit="' + exp.id + '">Edit</button> ' +
          '<button type="button" class="btn btn-danger btn-sm" data-del="' + exp.id + '">Delete</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.onclick = () => {
        const exp = expenses.find((e) => e.id === Number(btn.dataset.edit));
        if (!exp) return;
        editId = exp.id;
        document.getElementById('form-title').textContent = 'Edit Expense';
        document.getElementById('btn-save').textContent = 'Save Changes';
        document.getElementById('btn-cancel').classList.remove('hidden');
        document.getElementById('expense-category').value = exp.category;
        document.getElementById('expense-amount').value = exp.amount;
        document.getElementById('expense-comments').value = exp.comments || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    });

    tbody.querySelectorAll('[data-del]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Delete this expense?')) return;
        try {
          await api('/expenses/' + btn.dataset.del, 'DELETE');
          loadExpenses();
        } catch (err) {
          showError('error-home', err.message);
        }
      };
    });
  } catch (err) {
    if (err.message.includes('Login') || err.message.includes('token')) {
      logout();
    } else {
      showError('error-home', err.message);
    }
  }
}

function cancelEdit() {
  editId = null;
  document.getElementById('form-title').textContent = 'Add Expense';
  document.getElementById('btn-save').textContent = 'Add Expense';
  document.getElementById('btn-cancel').classList.add('hidden');
  document.getElementById('form-expense').reset();
}

async function loadChart() {
  try {
    const data = await api('/expenses/stats/by-category');
    const stats = data.stats || [];
    const pie = document.getElementById('pie-chart');
    const list = document.getElementById('chart-list');
    list.innerHTML = '';

    if (stats.length === 0) {
      document.getElementById('chart-area').classList.add('hidden');
      document.getElementById('chart-total').classList.add('hidden');
      document.getElementById('no-chart').classList.remove('hidden');
      return;
    }

    document.getElementById('chart-area').classList.remove('hidden');
    document.getElementById('no-chart').classList.add('hidden');

    const total = stats.reduce((s, x) => s + Number(x.total), 0);
    const chartTotalEl = document.getElementById('chart-total');
    chartTotalEl.textContent = 'Total: ' + formatMoney(total);
    chartTotalEl.classList.remove('hidden');
    let p = 0;
    const parts = [];

    stats.forEach((s, i) => {
      const start = p;
      p += (Number(s.total) / total) * 100;
      parts.push(COLORS[i % COLORS.length] + ' ' + start + '% ' + p + '%');

      const li = document.createElement('li');
      const pct = ((Number(s.total) / total) * 100).toFixed(1);
      li.innerHTML =
        '<span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>' +
        s.category + ': ' + formatMoney(s.total) + ' (' + pct + '%)';
      list.appendChild(li);
    });

    pie.style.background = 'conic-gradient(' + parts.join(', ') + ')';
  } catch (err) {
    if (err.message.includes('Login') || err.message.includes('token')) {
      logout();
    }
  }
}

// --- Event listeners ---
document.getElementById('go-signup').onclick = (e) => {
  e.preventDefault();
  showError('error-login', '');
  showPage('signup');
};

document.getElementById('go-login').onclick = (e) => {
  e.preventDefault();
  showError('error-signup', '');
  showPage('login');
};

document.getElementById('form-login').onsubmit = async (e) => {
  e.preventDefault();
  showError('error-login', '');
  try {
    const data = await api('/auth/login', 'POST', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
    });
    setAuth(data.token, data.email);
    document.getElementById('user-email').textContent = data.email;
    showPage('home');
    loadExpenses();
  } catch (err) {
    showError('error-login', err.message);
  }
};

document.getElementById('form-signup').onsubmit = async (e) => {
  e.preventDefault();
  showError('error-signup', '');
  try {
    const data = await api('/auth/signup', 'POST', {
      email: document.getElementById('signup-email').value,
      password: document.getElementById('signup-password').value,
    });
    setAuth(data.token, data.email);
    document.getElementById('user-email').textContent = data.email;
    showPage('home');
    loadExpenses();
  } catch (err) {
    showError('error-signup', err.message);
  }
};

document.getElementById('form-expense').onsubmit = async (e) => {
  e.preventDefault();
  showError('error-home', '');
  const body = {
    category: document.getElementById('expense-category').value,
    amount: document.getElementById('expense-amount').value,
    comments: document.getElementById('expense-comments').value,
  };
  try {
    if (editId) {
      await api('/expenses/' + editId, 'PUT', body);
      cancelEdit();
    } else {
      await api('/expenses', 'POST', body);
      document.getElementById('expense-amount').value = '';
      document.getElementById('expense-comments').value = '';
    }
    loadExpenses();
  } catch (err) {
    showError('error-home', err.message);
  }
};

document.getElementById('btn-cancel').onclick = cancelEdit;
document.getElementById('btn-logout').onclick = logout;
document.getElementById('btn-logout2').onclick = logout;
document.getElementById('btn-chart').onclick = () => { showPage('chart'); loadChart(); };
document.getElementById('btn-back').onclick = () => showPage('home');

// --- Start ---
checkServer();
if (getToken()) {
  document.getElementById('user-email').textContent = localStorage.getItem('email') || '';
  showPage('home');
  loadExpenses();
} else {
  showPage('login');
}
