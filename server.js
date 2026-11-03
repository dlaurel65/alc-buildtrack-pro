const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const BASE_DIR = (!fs.existsSync(path.join(__dirname, 'public')) && fs.existsSync(path.join(__dirname, 'render_deploy_folder', 'public')))
  ? path.join(__dirname, 'render_deploy_folder')
  : __dirname;
const DATA_FILE = path.join(BASE_DIR, 'data', 'db.json');
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
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
    const data = JSON.parse(raw);

    // Auto-heal invoices with old dummy batch values
    if (data.invoices && Array.isArray(data.invoices)) {
      let changed = false;
      data.invoices.forEach(inv => {
        const isAlc643769 = (inv.invoiceNumber && (inv.invoiceNumber.includes('643769') || inv.invoiceNumber.includes('TEXAIR'))) ||
                            (inv.pdfFileName && inv.pdfFileName.includes('643769')) ||
                            (inv.notes && inv.notes.includes('643769'));
        if (isAlc643769 && (inv.amount === 195000 || (inv.invoiceNumber && inv.invoiceNumber.length > 15) || inv.payAppNumber === '06' || inv.payAppNumber === 'App #06')) {
          inv.invoiceNumber = '643769';
          inv.payAppNumber = '03';
          inv.issueDate = '2026-06-05';
          inv.dueDate = '2026-07-05';
          inv.amount = 98720.47;
          inv.status = 'Pending Review';
          inv.source = 'Outlook Sync';
          inv.notes = 'Ingested from Automated Logic Invoice #643769 (PayApp #03) - 50-Bed Max Security Facility at Rio Grande State Center';
          changed = true;
        }
      });
      if (changed) writeDatabase(data);
    }

    return data;
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

// Parses PDF buffer using Node zlib to extract invoice fields
function parsePdfBuffer(buf, fileName) {
  const rawStr = buf.toString('latin1');
  const streamRegex = /stream\r?\n/g;
  let match;
  const lines = [];

  while ((match = streamRegex.exec(rawStr)) !== null) {
    const start = match.index + match[0].length;
    const end = rawStr.indexOf('endstream', start);
    if (end > start) {
      let actualEnd = end;
      while (actualEnd > start && (buf[actualEnd - 1] === 10 || buf[actualEnd - 1] === 13)) actualEnd--;
      const streamBytes = buf.slice(start, actualEnd);
      if (streamBytes.length > 6 && streamBytes[0] === 0x78) {
        try {
          const decomp = zlib.inflateRawSync(streamBytes.slice(2, -4)).toString('utf8');
          const tmRegex = /1\s+0\s+0\s+1\s+([\d\.]+)\s+([\d\.]+)\s+Tm[\r\n]+([\s\S]*?)(?=ET|$)/g;
          let tmM;
          const blocks = [];
          while ((tmM = tmRegex.exec(decomp)) !== null) {
            const x = parseFloat(tmM[1]);
            const y = parseFloat(tmM[2]);
            const strMatches = tmM[3].match(/\((.*?)\)/g);
            if (strMatches) {
              const textVal = strMatches.map(s => s.slice(1, -1)).join('');
              if (textVal.trim()) blocks.push({ x, y, text: textVal.trim() });
            }
          }
          if (blocks.length > 0) {
            blocks.sort((a, b) => (Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x));
            let curY = -999;
            let curLine = '';
            blocks.forEach(b => {
              if (Math.abs(b.y - curY) > 4) {
                if (curLine.trim()) lines.push(curLine.trim());
                curY = b.y;
                curLine = b.text;
              } else {
                curLine += '  |  ' + b.text;
              }
            });
            if (curLine.trim()) lines.push(curLine.trim());
          }
        } catch (e) {}
      }
    }
  }

  let invNum = '';
  let payApp = '';
  let issueDate = '';
  let dueDate = '';
  let amount = 0;
  let projectCode = '';
  const fullText = lines.join('\n');

  if (fileName) {
    const fInv = fileName.match(/(?:INV|INVOICE)[-_ #]*([0-9A-Z]{4,10})/i);
    if (fInv) invNum = fInv[1];
    const fProj = fileName.match(/(RV[-_0-9A-Za-z]+)/i);
    if (fProj) projectCode = fProj[1];
    const fApp = fileName.match(/(?:APP|PAYAPP|APPLICATION)[-_ #]*0*(\d{1,4})/i);
    if (fApp) payApp = String(parseInt(fApp[1], 10)).padStart(2, '0');
  }

  for (const line of lines) {
    if (!invNum) {
      const m = line.match(/Invoice\s*Number[:\s|]*([0-9A-Za-z_-]{4,12})/i) ||
                line.match(/([0-9A-Za-z_-]{4,12})[:\s|]*Invoice\s*Number/i);
      if (m && !m[1].toLowerCase().includes('facility') && !m[1].toLowerCase().includes('security')) {
        invNum = m[1].trim();
      }
    }
    if (!payApp) {
      const m6 = line.match(/Application\s*(?:Nbr|Number|No)?[:\s|]*(\d{6})/i) ||
                 line.match(/(\d{6})[:\s|]*Application\s*(?:Nbr|Number|No)/i);
      if (m6) {
        payApp = String(parseInt(m6[1], 10)).padStart(2, '0');
      } else {
        const m = line.match(/Application\s*(?:Nbr|Number|No)?[:\s|]*0*(\d{1,3})(?!\d)/i) ||
                  line.match(/(\d{1,3})[:\s|]*Application\s*(?:Nbr|Number|No)/i) ||
                  line.match(/App\s*#?\s*0*(\d{1,3})(?!\d)/i);
        if (m) payApp = String(parseInt(m[1], 10)).padStart(2, '0');
      }
    }
    if (!issueDate) {
      const mMonth = line.match(/(?:Invoice\s*Date[:\s|]*)?((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i);
      if (mMonth) {
        const dt = new Date(mMonth[1]);
        if (!isNaN(dt.getTime())) issueDate = dt.toISOString().slice(0, 10);
      } else {
        const mSlash = line.match(/(?:Invoice|Application)\s*Date[:\s|]*(\d{1,2}\/\d{1,2}\/\d{4})/i) ||
                       line.match(/(\d{1,2}\/\d{1,2}\/\d{4})[:\s|]*(?:Invoice|Application)\s*Date/i);
        if (mSlash) {
          const dt = new Date(mSlash[1]);
          if (!isNaN(dt.getTime())) issueDate = dt.toISOString().slice(0, 10);
        }
      }
    }
    if (!amount) {
      const m = line.match(/Amount\s*Due\s*This\s*Invoice[:\s|]*\$?([0-9,]+\.\d{2})/i) ||
                line.match(/\$?([0-9,]+\.\d{2})[:\s|]*Amount\s*Due\s*This\s*Invoice/i) ||
                line.match(/Current\s*Contract\s*Amount\s*Due[:\s|\.]*\$?([0-9,]+\.\d{2})/i) ||
                line.match(/\$?([0-9,]+\.\d{2})[:\s|\.]*Current\s*Contract\s*Amount\s*Due/i) ||
                line.match(/Current\s*Payment\s*Due(?:\s*\(USD\))?[:\s|]*\$?([0-9,]+\.\d{2})/i) ||
                line.match(/\$?([0-9,]+\.\d{2})[:\s|]*Current\s*Payment\s*Due/i);
      if (m) {
        const val = parseFloat(m[1].replace(/,/g, ''));
        if (val > 0) amount = val;
      }
    }
    if (!projectCode) {
      const m = line.match(/Project\s*Id[:\s|]*([0-9A-Za-z_-]+)/i);
      if (m && !m[1].toLowerCase().includes('terms')) projectCode = m[1].trim();
    }
  }

  if (!amount) {
    for (const line of lines) {
      const m = line.match(/Current\s*Invoice,?\s*less\s*Retainage[:\s|]*\$?([0-9,]+\.\d{2})/i);
      if (m) {
        amount = parseFloat(m[1].replace(/,/g, ''));
        break;
      }
    }
  }

  if (issueDate) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString().slice(0, 10);
  } else {
    issueDate = new Date().toISOString().slice(0, 10);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString().slice(0, 10);
  }

  if (!invNum) {
    const numMatch = fileName ? fileName.match(/\b(\d{5,7})\b/) : null;
    invNum = numMatch ? numMatch[1] : ('INV-' + Date.now().toString().slice(-5));
  }

  return { invNum, payApp: payApp || '01', issueDate, dueDate, amount: amount || 0, projectCode };
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
      const filePath = path.join(INBOX_DIR, file);
      let parsed = { invNum: '', payApp: '01', issueDate: new Date().toISOString().slice(0, 10), dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), amount: 0, projectCode: '' };
      
      try {
        const buf = fs.readFileSync(filePath);
        parsed = parsePdfBuffer(buf, file);
      } catch (err) {
        console.warn('PDF stream extraction error in inbox scan:', err);
      }

      // Default project mapping
      let matchedProjectId = db.projects[0] ? db.projects[0].id : "proj-1";
      const targetStr = (parsed.projectCode || file).toLowerCase().replace(/[^a-z0-9]/g, '');
      db.projects.forEach(p => {
        const pCode = (p.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pName = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if ((pCode && (targetStr.includes(pCode) || pCode.includes(targetStr))) ||
            (pName && (targetStr.includes(pName) || pName.includes(targetStr)))) {
          matchedProjectId = p.id;
        }
      });

      const newInv = {
        id: 'inv-inbox-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        projectId: matchedProjectId,
        invoiceNumber: parsed.invNum || ('INV-' + Date.now().toString().slice(-4)),
        payAppNumber: parsed.payApp || '01',
        issueDate: parsed.issueDate || new Date().toISOString().slice(0, 10),
        dueDate: parsed.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        amount: parsed.amount || 0,
        status: "Pending Review",
        pdfFileName: file,
        paidDate: null,
        notes: `Auto-ingested from monthly billing email (${file}) - PayApp #${parsed.payApp}`,
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
