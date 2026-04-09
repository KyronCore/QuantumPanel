require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { initDb, get, run } = require('./db');
const { authRequired } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const systemRoutes = require('./routes/system');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const port = Number(process.env.PORT || 3000);
const nasBase = process.env.NAS_BASE_PATH || '/srv/quantum-nas';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);

app.use('/api', authRequired);
app.use('/api/system', systemRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/ai', aiLimiter, aiRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await get(
      `SELECT id, username, role, can_upload, can_download, can_delete
       FROM users WHERE id = ?`,
      [payload.id]
    );

    if (!user) return next(new Error('User not found'));
    socket.user = user;
    return next();
  } catch (err) {
    return next(new Error('Auth failed'));
  }
});

io.on('connection', (socket) => {
  socket.on('chat:send', async (messageText) => {
    try {
      const text = String(messageText || '').trim();
      if (!text) return;
      if (text.length > 1000) return;

      await run(
        'INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)',
        [socket.user.id, socket.user.username, text]
      );

      const payload = {
        username: socket.user.username,
        message: text,
        created_at: new Date().toISOString(),
      };

      io.emit('chat:new', payload);
    } catch (err) {
      socket.emit('chat:error', 'Failed to send message');
    }
  });
});

(async () => {
  if (!process.env.JWT_SECRET) {
    console.error('Missing JWT_SECRET in .env');
    process.exit(1);
  }

  await initDb();

  server.listen(port, '0.0.0.0', () => {
    console.log(`Quantum Panel running on http://0.0.0.0:${port}`);
    console.log(`Requested NAS base path: ${path.resolve(nasBase)}`);
  });
})();
