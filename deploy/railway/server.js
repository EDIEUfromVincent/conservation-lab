// 보존과학자의 하루: classroom 빌드(index.html + video/)를 그대로 내보내는 정적 서버. 영상 넘기기를 위해 Range 요청을 지원한다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, 'public');
const TYPES = {'.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf'};

http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = path.normalize(path.join(ROOT, rel === '/' ? 'index.html' : rel));
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : st.size - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (!(start >= 0 && start <= end)) { res.writeHead(416, {'Content-Range': `bytes */${st.size}`}).end(); return; }
      res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1});
      fs.createReadStream(file, {start, end}).pipe(res);
      return;
    }
    res.writeHead(200, {'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600'});
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}).listen(process.env.PORT || 3000, () => console.log('listening on', process.env.PORT || 3000));
