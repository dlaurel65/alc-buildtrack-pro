const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const INBOX_DIR = path.join(UPLOADS_DIR, 'inbox');

// Ensure upload & inbox dirs exist
[UPLOADS_DIR, INBOX_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function readDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return {
        settings: { companyName: "Apex Project Management", currency: "USD", defaultRetainage: 10 },
        projects: [],
        phases: [],
        materials: [],
        changeOrders: [],
        rfis: [],
        payApplications: [],
        invoices: [],
        punchList: [],
        cxPunchList: []
      };
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database:', err);
    return null;
  }
}

function writeDatabase(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// Scans uploads/inbox for new PDF invoices and auto-registers them
function scanInboxFolder() {
  const db = readDatabase();
  if (!db) return { error: "Database unavailable" };

  if (!fs.existsSync(INBOX_DIR)) {
    fs.mkdirSync(INBOX_DIR, { recursive: true });
    return { success: true, filesCount: 0, ingestedCount: 0 };
  }

  const files = fs.readdirSync(INBOX_DIR);
  let ingested = 0;
  const newInvoices = [];

  files.forEach(file => {
    if (!file.toLowerCase().endsWith('.pdf')) return;

    // Check if already registered
    const exists = db.invoices.some(inv =>
      inv.pdfFileName === file ||
      (inv.notes && inv.notes.includes(file)) ||
      (inv.attachments && inv.attachments.some(a => a.name === file || (a.url && a.url.includes(file))))
    );

    if (!exists) {
      // Heuristic parsing from filename: e.g. "INV-2026-042_ApexMedical_85000.pdf"
      let invNum = `INV-${Date.now().toString().slice(-4)}`;
      const numMatch = file.match(/INV[-_]?(\d+)/i) || file.match(/(\d{4,})/);
      if (numMatch) {
        invNum = `INV-${numMatch[1]}`;
      }

      // Check amount heuristic
      let amount = 50000;
      const amtMatch = file.match(/[\$_](\d+[\d,]*)/);
      if (amtMatch) {
        amount = Number(amtMatch[1].replace(/,/g, '')) || 50000;
      }

      // Default project mapping: assign to first project or match code
      let matchedProjectId = db.projects[0] ? db.projects[0].id : "proj-1";
      db.projects.forEach(p => {
        if (file.toLowerCase().includes((p.code || '').toLowerCase()) || file.toLowerCase().includes((p.name || '').slice(0, 8).toLowerCase())) {
          matchedProjectId = p.id;
        }
      });

      const newInv = {
        id: 'inv-inbox-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        projectId: matchedProjectId,
        invoiceNumber: invNum,
        payAppNumber: "Pending",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: amount,
        status: "Pending Review",
        pdfFileName: file,
        paidDate: null,
        notes: `Auto-ingested from monthly billing email (${file})`,
        attachments: [
          {
            name: file,
            type: "application/pdf",
            url: `/uploads/inbox/${encodeURIComponent(file)}`,
            caption: `Monthly Invoice Attachment: ${file}`
          }
        ]
      };

      db.invoices.unshift(newInv);
      newInvoices.push(newInv);
      ingested++;
    }
  });

  if (ingested > 0) {
    writeDatabase(db);
  }

  return { success: true, filesCount: files.length, ingestedCount: ingested, newInvoices };
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API: GET /api/data
  if (req.method === 'GET' && pathname === '/api/data') {
    const data = readDatabase();
    if (!data) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read data' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API: POST /api/data
  if (req.method === 'POST' && pathname === '/api/data') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const success = writeDatabase(payload);
        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, timestamp: new Date().toISOString() }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Failed to write data' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API: POST /api/inbox/scan (Trigger auto-ingest of Outlook invoices)
  if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/inbox/scan') {
    const result = scanInboxFolder();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: POST /api/upload (Upload single file)
  if (req.method === 'POST' && pathname === '/api/upload') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 30 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Attachment exceeds 30MB limit' }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const { name, type, data, isInbox } = JSON.parse(body);
        if (!name || !data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Name and Base64 data are required' }));
          return;
        }

        const cleanBase64 = data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const safeExt = path.extname(name).toLowerCase() || (type === 'application/pdf' ? '.pdf' : '.jpg');
        const baseName = path.basename(name, safeExt).replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = isInbox ? `${baseName}${safeExt}` : `${Date.now()}_${baseName}${safeExt}`;
        const targetDir = isInbox ? INBOX_DIR : UPLOADS_DIR;
        const filePath = path.join(targetDir, fileName);

        fs.writeFileSync(filePath, buffer);

        // If uploaded to inbox, auto-scan immediately
        if (isInbox) {
          scanInboxFolder();
        }

        const subPath = isInbox ? 'inbox/' : '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          url: `/uploads/${subPath}${fileName}`,
          fileName: fileName,
          originalName: name,
          size: buffer.length,
          type: type || 'application/octet-stream'
        }));
      } catch (err) {
        console.error('Upload processing error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to process file upload' }));
      }
    });
    return;
  }

  // API: GET /api/backup
  if (req.method === 'GET' && pathname === '/api/backup') {
    if (fs.existsSync(DATA_FILE)) {
      res.setHeader('Content-Disposition', `attachment; filename="pm_backup_${new Date().toISOString().slice(0, 10)}.json"`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      fs.createReadStream(DATA_FILE).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No data file exists' }));
    }
    return;
  }

  // Static File Serving: Uploads directory (/uploads/...)
  if (pathname.startsWith('/uploads/')) {
    const safeUploadPath = path.normalize(pathname.replace('/uploads/', '')).replace(/^(\.\.[\/\\])+/, '');
    const uploadFilePath = path.join(UPLOADS_DIR, safeUploadPath);

    fs.stat(uploadFilePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Attachment not found');
        return;
      }
      const ext = path.extname(uploadFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(uploadFilePath).pipe(res);
    });
    return;
  }

  // Static File Serving: Public directory (/...)
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // Find local Wi-Fi / LAN IP address
  let localIp = '127.0.0.1';
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }

  console.log(`====================================================`);
  console.log(` AUTOMATED LOGIC - BUILDTRACK PRO IS LIVE!`);
  console.log(` Local Access:     http://localhost:${PORT}`);
  console.log(` Share on Wi-Fi:   http://${localIp}:${PORT}`);
  console.log(` Outlook Watcher:  ${INBOX_DIR}`);
  console.log(` Press Ctrl+C in this window to terminate`);
  console.log(`====================================================`);
});
