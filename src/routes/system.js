const express = require('express');
const si = require('systeminformation');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const [load, mem, disks, net, osInfo, timeInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.osInfo(),
      si.time(),
    ]);

    const totalDisk = disks.reduce((sum, d) => sum + d.size, 0);
    const usedDisk = disks.reduce((sum, d) => sum + d.used, 0);

    const rx = net.reduce((sum, n) => sum + (n.rx_sec || 0), 0);
    const tx = net.reduce((sum, n) => sum + (n.tx_sec || 0), 0);

    return res.json({
      cpu_percent: Number(load.currentLoad.toFixed(1)),
      ram_percent: Number(((mem.active / mem.total) * 100).toFixed(1)),
      disk_percent: totalDisk ? Number(((usedDisk / totalDisk) * 100).toFixed(1)) : 0,
      net_rx_kb: Number((rx / 1024).toFixed(1)),
      net_tx_kb: Number((tx / 1024).toFixed(1)),
      raw: {
        ram_total_gb: Number((mem.total / (1024 ** 3)).toFixed(2)),
        ram_used_gb: Number((mem.active / (1024 ** 3)).toFixed(2)),
        disk_total_gb: Number((totalDisk / (1024 ** 3)).toFixed(2)),
        disk_used_gb: Number((usedDisk / (1024 ** 3)).toFixed(2)),
      },
      host: {
        hostname: osInfo.hostname,
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
      },
      uptime_sec: Number(timeInfo.uptime || 0),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/storage', async (_req, res) => {
  try {
    const disks = await si.fsSize();
    return res.json({
      disks: disks.map((disk) => ({
        fs: disk.fs,
        mount: disk.mount,
        type: disk.type,
        size_gb: Number((disk.size / (1024 ** 3)).toFixed(2)),
        used_gb: Number((disk.used / (1024 ** 3)).toFixed(2)),
        use_percent: Number(disk.use.toFixed(1)),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/processes', async (_req, res) => {
  try {
    const data = await si.processes();
    const list = (data.list || [])
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 12)
      .map((proc) => ({
        pid: proc.pid,
        name: proc.name,
        cpu: Number((proc.cpu || 0).toFixed(1)),
        mem: Number((proc.memRss || 0) / (1024 ** 2)).toFixed(1),
        user: proc.user || 'system',
        command: proc.command || '',
      }));

    return res.json({
      total: data.all || list.length,
      running: data.running || 0,
      blocked: data.blocked || 0,
      list,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
