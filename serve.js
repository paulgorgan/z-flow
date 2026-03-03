const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8080;
const ROOT = __dirname;
const MIME = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.json':'application/json','.png':'image/png','.ico':'image/x-icon','.svg':'image/svg+xml'
};
const srv = http.createServer((req, res) => {
  let p = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(p)] || 'text/plain'});
    res.end(data);
  });
});
srv.listen(PORT, () => console.log('Z-FLOW server: http://localhost:' + PORT));
