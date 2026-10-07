// Tiny static server for previewing SlicePay over http (the app itself also works from file://).
// usage: node tools/serve.js [port]   (default 8765; env PORT also works)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT_ARG = String(process.argv[2] || process.env.PORT || 8765);
const PORT = /^\d+$/.test(PORT_ARG) ? +PORT_ARG : NaN;
if (!(PORT >= 1 && PORT <= 65535)) {
  console.error('usage: node tools/serve.js [port]   (port: an integer 1-65535, default 8765; got "' + PORT_ARG + '")');
  process.exit(2);
}
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf',
};

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (p.indexOf('\0') !== -1) { res.writeHead(400); return res.end('bad request'); }
  // never serve dotfiles / dot-directories (.git, .claude, .gitignore ...)
  if (p.split(/[\\/]/).some(seg => seg.startsWith('.') && seg !== '.' && seg !== '..')) { res.writeHead(403); return res.end('forbidden'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  const send = (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  };
  try { fs.readFile(file, send); } catch (e) { send(e); }
}).on('error', e => {
  console.error(e.code === 'EADDRINUSE'
    ? 'port ' + PORT + ' is already in use (another `npm run serve` or the Claude preview?) — try: node tools/serve.js <port>'
    : 'serve: ' + e.message);
  process.exit(1);
}).listen(PORT, '127.0.0.1', () => console.log('SlicePay: http://127.0.0.1:' + PORT + '/'));
