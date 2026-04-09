const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { safeResolve } = require('../utils/files');

const router = express.Router();

const requestedBase = path.resolve(process.env.NAS_BASE_PATH || path.join(__dirname, '..', '..', 'uploads'));
let basePath = requestedBase;
try {
  fs.mkdirSync(basePath, { recursive: true });
} catch (_err) {
  basePath = path.resolve(path.join(__dirname, '..', '..', 'uploads'));
  fs.mkdirSync(basePath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const rel = req.body.path || '';
      const dest = safeResolve(basePath, rel);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 },
});

function requireUploadPermission(req, res, next) {
  if (!req.user.can_upload && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Upload permission denied' });
  }
  return next();
}

router.get('/list', (req, res) => {
  try {
    const rel = req.query.path || '';
    const target = safeResolve(basePath, rel);
    const entries = fs.readdirSync(target, { withFileTypes: true }).map((item) => ({
      name: item.name,
      type: item.isDirectory() ? 'dir' : 'file',
    }));

    return res.json({ basePath, path: rel, entries });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/upload', requireUploadPermission, upload.single('file'), (req, res) => {
  try {
    return res.json({ message: 'Upload complete', file: req.file?.filename });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/download', (req, res) => {
  try {
    if (!req.user.can_download && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Download permission denied' });
    }

    const rel = req.query.path;
    if (!rel) return res.status(400).json({ error: 'path is required' });

    const target = safeResolve(basePath, rel);
    return res.download(target);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/delete', (req, res) => {
  try {
    if (!req.user.can_delete && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Delete permission denied' });
    }

    const rel = req.query.path;
    if (!rel) return res.status(400).json({ error: 'path is required' });

    const target = safeResolve(basePath, rel);
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
      fs.rmSync(target, { recursive: true, force: true });
    } else {
      fs.unlinkSync(target);
    }

    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
