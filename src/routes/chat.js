const express = require('express');
const { all } = require('../db');

const router = express.Router();

router.get('/history', async (_req, res) => {
  try {
    const messages = await all(
      `SELECT id, username, message, created_at
       FROM chat_messages
       ORDER BY id DESC
       LIMIT 50`
    );

    return res.json({ messages: messages.reverse() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
