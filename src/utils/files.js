const path = require('path');

function safeResolve(base, target = '') {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error('Invalid path access');
  }
  return resolved;
}

module.exports = { safeResolve };
