const express = require('express');
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(adminOnly);

router.get('/', async (_req, res) => {
  const users = await all(
    `SELECT id, username, email, role, can_upload, can_download, can_delete, created_at
     FROM users ORDER BY id DESC`
  );
  return res.json({ users });
});

router.post('/', async (req, res) => {
  try {
    const { username, email, password, role = 'user', can_upload = 0, can_download = 1, can_delete = 0 } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, password required' });
    }

    const exists = await get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (exists) return res.status(409).json({ error: 'Username or email exists' });

    const hash = await bcrypt.hash(password, 10);
    await run(
      `INSERT INTO users (username, email, password_hash, role, can_upload, can_download, can_delete)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, email, hash, role, Number(can_upload), Number(can_download), Number(can_delete)]
    );

    return res.status(201).json({ message: 'User created' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { role, can_upload, can_download, can_delete } = req.body;
    await run(
      `UPDATE users
       SET role = COALESCE(?, role),
           can_upload = COALESCE(?, can_upload),
           can_download = COALESCE(?, can_download),
           can_delete = COALESCE(?, can_delete)
       WHERE id = ?`,
      [
        role ?? null,
        can_upload !== undefined ? Number(can_upload) : null,
        can_download !== undefined ? Number(can_download) : null,
        can_delete !== undefined ? Number(can_delete) : null,
        req.params.id,
      ]
    );

    return res.json({ message: 'User updated' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    return res.json({ message: 'User deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
