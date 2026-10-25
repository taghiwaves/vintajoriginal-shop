const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Open an interactive terminal in the project folder to set the admin password.');
  }
  return new Promise((resolve, reject) => {
    process.stdout.write(label);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Cancelled.')); return; }
      if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(value); return; }
      if (key.name === 'backspace') { value = [...value].slice(0, -1).join(''); return; }
      if (character && !key.ctrl && !key.meta) value += character;
    };
    process.stdin.on('keypress', onKeypress);
  });
}

(async () => {
  const envPath = path.resolve(__dirname, '../../../.env');
  let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  if (/^ADMIN_PASSWORD_HASH\s*=/m.test(contents)) throw new Error('ADMIN_PASSWORD_HASH already exists in .env. Remove or rotate it manually first.');
  process.stdout.write('Create a unique admin password (12+ characters). Input is hidden.\n');
  const password = await hiddenPrompt('New password: ');
  const confirmation = await hiddenPrompt('Repeat password: ');
  if (password.length < 12) throw new Error('Use at least 12 characters.');
  if (password !== confirmation) throw new Error('The passwords do not match.');
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = crypto.scryptSync(password, salt, 64).toString('hex');
  const entry = `ADMIN_PASSWORD_HASH=scrypt$${salt}$${digest}`;
  contents = `${contents.replace(/[\r\n]*$/, '')}\n${entry}\n`;
  fs.writeFileSync(envPath, contents, { mode: 0o600 });
  process.stdout.write('Admin password saved to .env. You can now open http://localhost:3000/admin and sign in.\n');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
