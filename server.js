const express = require('express');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// ===========================
// API Routes (Dashboard CRUD)
// ===========================

// GET /api/mocks - List all mocks
app.get('/api/mocks', (req, res) => {
  const mocks = db.getAllMocks();
  res.json(mocks);
});

// POST /api/mocks - Create a mock
app.post('/api/mocks', (req, res) => {
  const data = req.body;
  data.enabled = data.enabled !== undefined ? data.enabled : true;
  const created = db.createMock(data);
  res.status(201).json(created);
});

// POST /api/mocks/import - Bulk import
app.post('/api/mocks/import', (req, res) => {
  const mocksArray = req.body;
  if (!Array.isArray(mocksArray)) {
    return res.status(400).json({ error: 'Expected an array of mocks' });
  }
  const imported = db.importMocks(mocksArray);
  res.status(201).json({ imported: imported.length, mocks: imported });
});

// PUT /api/mocks/:id - Update a mock
app.put('/api/mocks/:id', (req, res) => {
  const updated = db.updateMock(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Mock not found' });
  res.json(updated);
});

// DELETE /api/mocks/:id - Delete a mock
app.delete('/api/mocks/:id', (req, res) => {
  const deleted = db.deleteMock(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Mock not found' });
  res.json({ success: true });
});

// GET /api/logs - Get request logs
app.get('/api/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.getAllLogs(limit);
  res.json(logs);
});

// DELETE /api/logs - Clear logs
app.delete('/api/logs', (req, res) => {
  db.clearLogs();
  res.json({ success: true });
});

// ===========================
// Mock Endpoint: /mock/*
// ===========================
app.all('/mock/*', async (req, res) => {
  const requestPath = req.path.replace(/^\/mock/, '') || '/';
  const method = req.method.toUpperCase();

  const enabledMocks = db.getEnabledMocks();

  let matchedMock = null;
  let pathParams = {};

  for (const mock of enabledMocks) {
    if (mock.method !== method) continue;
    const params = matchPath(mock.path, requestPath);
    if (params !== null) {
      matchedMock = mock;
      pathParams = params;
      break;
    }
  }

  // Log the request
  db.addLog({
    method,
    path: requestPath,
    headers: req.headers || {},
    query: req.query || {},
    requestBody: req.body || null,
    responseStatus: matchedMock ? matchedMock.statusCode : 404
  });

  if (!matchedMock) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'No matching mock endpoint found'
    });
  }

  // Apply delay
  if (matchedMock.delay && matchedMock.delay > 0) {
    await sleep(matchedMock.delay);
  }

  // Set custom headers
  if (matchedMock.headers && typeof matchedMock.headers === 'object') {
    for (const [key, value] of Object.entries(matchedMock.headers)) {
      res.set(key, value);
    }
  }

  // Process response body
  let responseBody = matchedMock.responseBody || '';
  responseBody = replacePathParams(responseBody, pathParams);
  responseBody = replaceDynamicVariables(responseBody);

  // Set content type based on response type
  const responseType = (matchedMock.responseType || 'JSON').toUpperCase();
  switch (responseType) {
    case 'JSON': res.set('Content-Type', 'application/json'); break;
    case 'XML': res.set('Content-Type', 'application/xml'); break;
    case 'HTML': res.set('Content-Type', 'text/html'); break;
    case 'TEXT': res.set('Content-Type', 'text/plain'); break;
  }

  // Send response
  if (responseType === 'JSON') {
    try {
      const parsed = JSON.parse(responseBody);
      return res.status(matchedMock.statusCode).json(parsed);
    } catch {
      return res.status(matchedMock.statusCode).send(responseBody);
    }
  }
  res.status(matchedMock.statusCode).send(responseBody);
});

// ===========================
// Helpers
// ===========================

function matchPath(mockPath, requestPath) {
  const mockParts = mockPath.split('/').filter(Boolean);
  const requestParts = requestPath.split('/').filter(Boolean);

  if (mockParts.length !== requestParts.length) return null;

  const params = {};
  for (let i = 0; i < mockParts.length; i++) {
    if (mockParts[i].startsWith(':')) {
      params[mockParts[i].substring(1)] = requestParts[i];
    } else if (mockParts[i] !== requestParts[i]) {
      return null;
    }
  }
  return params;
}

function replacePathParams(text, params) {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

function replaceDynamicVariables(text) {
  if (typeof text !== 'string') return text;
  let result = text;
  result = result.replace(/\{\{timestamp\}\}/g, Date.now().toString());
  result = result.replace(/\{\{uuid\}\}/g, uuidv4());
  result = result.replace(/\{\{randomInt\}\}/g, Math.floor(Math.random() * 10000).toString());
  result = result.replace(/\{\{randomString\}\}/g, Math.random().toString(36).substring(2, 15));
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===========================
// Start Server
// ===========================
app.listen(PORT, () => {
  console.log(`🔌 MockAPI Platform running on http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   Mock APIs:  http://localhost:${PORT}/mock/...`);
});
