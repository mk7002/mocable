const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Ensure data directory and file exist
function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ mocks: [], requestLogs: [] }, null, 2));
  }
}

function read() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { mocks: [], requestLogs: [] };
  }
}

function write(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ===== Mocks =====

function getAllMocks() {
  const db = read();
  return db.mocks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getMockById(id) {
  const db = read();
  return db.mocks.find(m => m.id === id) || null;
}

function createMock(mock) {
  const db = read();
  mock.id = generateId();
  mock.createdAt = new Date().toISOString();
  db.mocks.push(mock);
  write(db);
  return mock;
}

function updateMock(id, updates) {
  const db = read();
  const index = db.mocks.findIndex(m => m.id === id);
  if (index === -1) return null;
  db.mocks[index] = { ...db.mocks[index], ...updates };
  write(db);
  return db.mocks[index];
}

function deleteMock(id) {
  const db = read();
  const index = db.mocks.findIndex(m => m.id === id);
  if (index === -1) return false;
  db.mocks.splice(index, 1);
  write(db);
  return true;
}

function getEnabledMocks() {
  const db = read();
  return db.mocks.filter(m => m.enabled);
}

// ===== Request Logs =====

function getAllLogs(limit = 100) {
  const db = read();
  return db.requestLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

function addLog(log) {
  const db = read();
  log.id = generateId();
  log.timestamp = new Date().toISOString();
  db.requestLogs.push(log);
  // Keep max 500 logs
  if (db.requestLogs.length > 500) {
    db.requestLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    db.requestLogs.length = 500;
  }
  write(db);
  return log;
}

function clearLogs() {
  const db = read();
  db.requestLogs = [];
  write(db);
}

// ===== Bulk =====

function importMocks(mocksArray) {
  const db = read();
  const imported = [];
  for (const mock of mocksArray) {
    const newMock = { ...mock };
    newMock.id = generateId();
    newMock.createdAt = newMock.createdAt || new Date().toISOString();
    newMock.enabled = newMock.enabled !== undefined ? newMock.enabled : true;
    db.mocks.push(newMock);
    imported.push(newMock);
  }
  write(db);
  return imported;
}

// ===== Helpers =====

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

module.exports = {
  getAllMocks,
  getMockById,
  createMock,
  updateMock,
  deleteMock,
  getEnabledMocks,
  getAllLogs,
  addLog,
  clearLogs,
  importMocks
};
