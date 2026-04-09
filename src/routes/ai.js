const express = require('express');

const router = express.Router();

const SYSTEM_PROMPT = `You are Quantum Assistant. You only discuss: tech news, Linux, AI news, coding, system admin basics, and teaching.
If asked outside these topics, refuse briefly and suggest a related tech/linux/ai topic.`;

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const model = process.env.LOCAL_AI_MODEL || 'llama3.1:8b';
    const baseUrl = process.env.LOCAL_AI_URL || 'http://127.0.0.1:11434';
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0.4 },
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `Local AI API error: ${text}` });
    }

    const data = await response.json();
    const answer = data.message?.content || 'No response from local model.';

    return res.json({ answer });
  } catch (err) {
    return res.status(500).json({
      error: `Failed to reach local AI server. Ensure Ollama is running and LOCAL_AI_URL is correct. Details: ${err.message}`,
    });
  }
});

module.exports = router;
