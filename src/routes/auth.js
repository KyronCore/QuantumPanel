const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function signUser(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      can_upload: user.can_upload,
      can_download: user.can_download,
      can_delete: user.can_delete,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const allowPublic = String(process.env.ALLOW_PUBLIC_REGISTER).toLowerCase() === 'true';

    if (!allowPublic) {
      return res.status(403).json({ error: 'Public register disabled. Ask admin.' });
    }

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }

    const existing = await get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    await run(
      `INSERT INTO users (username, email, password_hash, role, can_upload, can_download, can_delete)
       VALUES (?, ?, ?, 'user', 0, 1, 0)`,
      [username, email, hash]
    );

    return res.status(201).json({ message: 'Account created' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;
    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'usernameOrEmail and password are required' });
    }

    const user = await get(
      `SELECT id, username, email, password_hash, role, can_upload, can_download, can_delete
       FROM users WHERE username = ? OR email = ?`,
      [usernameOrEmail, usernameOrEmail]
    );

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signUser(user);
    return res.json({ token, user: { ...user, password_hash: undefined } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/me', authRequired, async (req, res) => {
  const user = await get(
    `SELECT id, username, email, role, can_upload, can_download, can_delete, created_at
     FROM users WHERE id = ?`,
    [req.user.id]
  );

  return res.json({ user });
});

module.exports = router;
