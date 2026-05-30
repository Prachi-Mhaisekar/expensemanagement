const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const { signToken, authMiddleware } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Auth ---
app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db
      .prepare('INSERT INTO users (email, password) VALUES (?, ?)')
      .run(normalizedEmail, hash);
    const userId = Number(result.lastInsertRowid);
    const token = signToken(userId, normalizedEmail);
    res.status(201).json({ token, email: normalizedEmail });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Could not create account' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = signToken(Number(user.id), user.email);
  res.json({ token, email: user.email });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// --- Expenses (stats route before :id) ---
app.get('/api/expenses/stats/by-category', authMiddleware, (req, res) => {
  const stats = db
    .prepare(
      `SELECT category, SUM(amount) as total
       FROM expenses WHERE user_id = ?
       GROUP BY category ORDER BY total DESC`
    )
    .all(Number(req.user.userId));
  res.json({ stats: stats.map((s) => ({ category: s.category, total: Number(s.total) })) });
});

app.get('/api/expenses', authMiddleware, (req, res) => {
  const expenses = db
    .prepare(
      `SELECT id, category, amount, comments, created_at, updated_at
       FROM expenses WHERE user_id = ? ORDER BY datetime(created_at) DESC`
    )
    .all(Number(req.user.userId));
  res.json({ expenses });
});

app.post('/api/expenses', authMiddleware, (req, res) => {
  const { category, amount, comments } = req.body;
  if (!category || amount == null || amount === '') {
    return res.status(400).json({ error: 'Category and amount are required' });
  }
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  const userId = Number(req.user.userId);
  const result = db
    .prepare(
      `INSERT INTO expenses (user_id, category, amount, comments)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, category.trim(), num, comments?.trim() || null);
  const expense = db
    .prepare(
      `SELECT id, category, amount, comments, created_at, updated_at
       FROM expenses WHERE id = ?`
    )
    .get(Number(result.lastInsertRowid));
  res.status(201).json({ expense });
});

app.put('/api/expenses/:id', authMiddleware, (req, res) => {
  const { category, amount, comments } = req.body;
  const id = Number(req.params.id);
  const userId = Number(req.user.userId);
  const existing = db
    .prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?')
    .get(id, userId);
  if (!existing) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  const cat = category?.trim() || existing.category;
  const num = amount != null ? parseFloat(amount) : existing.amount;
  if (isNaN(num) || num <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }
  db.prepare(
    `UPDATE expenses SET category = ?, amount = ?, comments = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(cat, num, comments != null ? (comments.trim() || null) : existing.comments, id, userId);
  const expense = db
    .prepare(
      `SELECT id, category, amount, comments, created_at, updated_at FROM expenses WHERE id = ?`
    )
    .get(id);
  res.json({ expense });
});

app.delete('/api/expenses/:id', authMiddleware, (req, res) => {
  const result = db
    .prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?')
    .run(Number(req.params.id), Number(req.user.userId));
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Expense not found' });
  }
  res.json({ message: 'Deleted' });
});

// Static website
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.listen(PORT, () => {
  console.log(`Expense Management running at http://localhost:${PORT}`);
});
