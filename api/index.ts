import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (project root)
config({ path: path.join(__dirname, '..', '.env') });

// AI Configuration (set via env vars)
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'https://api.zyphra.ai/v1';
const ZAI_API_KEY = process.env.ZAI_API_KEY || '';
const Z_MODEL = process.env.Z_MODEL || 'DARTH-v1';

async function callAI(prompt: string): Promise<string> {
  if (!ZAI_API_KEY) {
    throw new Error('ZAI_API_KEY not configured');
  }

  const response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ZAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: Z_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

const app = express();
const PORT = process.env.API_PORT || 3001;

// SQLite DB
const db = new Database(path.join(__dirname, '../e2e-dashboard.db'));
db.pragma('journal_mode = WAL');

// Middleware
app.use(cors());
app.use(express.json());

// Static files for recordings and screenshots
app.use('/recordings', express.static(path.join(__dirname, '../recordings')));
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// ============================================================================
// SCHEMA
// ============================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('web', 'mobile')),
    baseUrl TEXT,
    -- Mobile Config (stored as JSON for flexibility)
    mobileConfig TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS features (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name TEXT NOT NULL,
    framework TEXT CHECK(framework IN ('playwright', 'wdio')),
    description TEXT,
    content TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    featureIds TEXT NOT NULL,
    status TEXT CHECK(status IN ('pending', 'running', 'passed', 'failed', 'cancelled')) DEFAULT 'pending',
    startedAt TEXT,
    completedAt TEXT,
    recordingPath TEXT,
    screenshotPaths TEXT,
    resultJson TEXT,
    errorMessage TEXT,
    recordTestRun INTEGER DEFAULT 0,
    takeScreenshots INTEGER DEFAULT 1,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_features_project ON features(projectId);
  CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(projectId);
`);

// Migration: Add missing columns for existing databases
const testRunColumns = db.prepare("PRAGMA table_info(test_runs)").all() as any[];
const hasRecordTestRunColumn = testRunColumns.some((col: any) => col.name === 'recordTestRun');
if (!hasRecordTestRunColumn) {
  db.exec('ALTER TABLE test_runs ADD COLUMN recordTestRun INTEGER DEFAULT 0');
}
const hasTakeScreenshotsColumn = testRunColumns.some((col: any) => col.name === 'takeScreenshots');
if (!hasTakeScreenshotsColumn) {
  db.exec('ALTER TABLE test_runs ADD COLUMN takeScreenshots INTEGER DEFAULT 1');
}

const featureColumns = db.prepare("PRAGMA table_info(features)").all() as any[];
const hasContentColumn = featureColumns.some((col: any) => col.name === 'content');
if (!hasContentColumn) {
  db.exec('ALTER TABLE features ADD COLUMN content TEXT');
}

// Migration: Drop legacy path column if it exists (SQLite requires recreating table)
const hasPathColumn = featureColumns.some((col: any) => col.name === 'path');
if (hasPathColumn) {
  db.exec(`
    CREATE TABLE features_new (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      framework TEXT CHECK(framework IN ('playwright', 'wdio')),
      description TEXT,
      content TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );
    INSERT INTO features_new SELECT id, projectId, name, framework, description, content, enabled, createdAt, updatedAt FROM features;
    DROP TABLE features;
    ALTER TABLE features_new RENAME TO features;
    CREATE INDEX IF NOT EXISTS idx_features_project ON features(projectId);
  `);
}

const projectColumns = db.prepare("PRAGMA table_info(projects)").all() as any[];
const hasMobileConfigColumn = projectColumns.some((col: any) => col.name === 'mobileConfig');
if (!hasMobileConfigColumn) {
  db.exec('ALTER TABLE projects ADD COLUMN mobileConfig TEXT');
}

// Migration: Create step_definitions table
const tableList = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
const hasStepDefinitionsTable = tableList.some((t: any) => t.name === 'step_definitions');
if (!hasStepDefinitionsTable) {
  db.exec(`
    CREATE TABLE step_definitions (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT CHECK(category IN ('navigation', 'input', 'click', 'assertion', 'wait', 'screenshot', 'form', 'scroll', 'script', 'attribute')),
      gherkinPattern TEXT NOT NULL,
      playwrightFunction TEXT NOT NULL,
      parameters TEXT,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_steps_project ON step_definitions(projectId);
    CREATE INDEX IF NOT EXISTS idx_steps_category ON step_definitions(category);
  `);
}

// Migration: Create scenario_steps table to link feature scenarios to step definitions
const hasScenarioStepsTable = tableList.some((t: any) => t.name === 'scenario_steps');
if (!hasScenarioStepsTable) {
  db.exec(`
    CREATE TABLE scenario_steps (
      id TEXT PRIMARY KEY,
      featureId TEXT NOT NULL,
      scenarioName TEXT NOT NULL,
      stepDefinitionId TEXT NOT NULL,
      stepOrder INTEGER NOT NULL,
      parameterValues TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (featureId) REFERENCES features(id) ON DELETE CASCADE,
      FOREIGN KEY (stepDefinitionId) REFERENCES step_definitions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_scenario_steps_feature ON scenario_steps(featureId);
    CREATE INDEX IF NOT EXISTS idx_scenario_steps_scenario ON scenario_steps(featureId, scenarioName, stepOrder);
  `);
}

// ============================================================================
// UTILS
// ============================================================================
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

// ============================================================================
// PROJECTS
// ============================================================================
app.get('/api/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY createdAt DESC').all();
  res.json(projects.map((p: any) => parseProject(p)));
});

app.get('/api/projects/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(parseProject(project));
});

// Helper to parse mobileConfig and expand for frontend
function parseProject(project: any) {
  const parsed = { ...project };
  if (parsed.mobileConfig) {
    try {
      const config = JSON.parse(parsed.mobileConfig);
      Object.assign(parsed, config);
    } catch {}
    delete parsed.mobileConfig;
  }
  return parsed;
}

app.post('/api/projects', (req, res) => {
  const { name, type, baseUrl, mobileConfig, appPackage, appActivity, deviceName, platformVersion, automationName, appiumPath, appiumHost, appiumPort } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!['web', 'mobile'].includes(type)) {
    return res.status(400).json({ error: 'type must be web or mobile' });
  }

  const id = generateId();

  // Build mobileConfig from legacy fields or provided mobileConfig
  let config = null;
  if (type === 'mobile') {
    if (mobileConfig) {
      config = JSON.stringify(mobileConfig);
    } else {
      // Legacy support - build from individual fields
      config = JSON.stringify({
        appPackage,
        appActivity,
        deviceName,
        platformVersion,
        automationName,
        appiumPath: appiumPath || '/',
        appiumHost: appiumHost || 'localhost',
        appiumPort: appiumPort || '4723'
      });
    }
  }

  // Check if table has new schema (mobileConfig column)
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
  const hasMobileConfig = tableInfo.some((col: any) => col.name === 'mobileConfig');

  let stmt;
  if (hasMobileConfig) {
    stmt = db.prepare('INSERT INTO projects (id, name, type, baseUrl, mobileConfig) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, name, type, baseUrl || null, config);
  } else {
    // Legacy schema
    const parsed = config ? JSON.parse(config) : {};
    stmt = db.prepare(`INSERT INTO projects (id, name, type, baseUrl, appPackage, appActivity, deviceName, platformVersion, automationName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(id, name, type, baseUrl || null, parsed.appPackage || null, parsed.appActivity || null,
      parsed.deviceName || null, parsed.platformVersion || null, parsed.automationName || null);
  }

  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', (req, res) => {
  const { name, type, baseUrl, mobileConfig, appPackage, appActivity, deviceName, platformVersion, automationName, appiumPath, appiumHost, appiumPort } = req.body;

  const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
  const hasMobileConfig = tableInfo.some((col: any) => col.name === 'mobileConfig');

  try {
    if (hasMobileConfig) {
      let config = null;
      if (type === 'mobile') {
        if (mobileConfig) {
          config = JSON.stringify(mobileConfig);
        } else if (appPackage || deviceName) {
          config = JSON.stringify({
            appPackage, appActivity, deviceName, platformVersion, automationName,
            appiumPath: appiumPath || '/', appiumHost: appiumHost || 'localhost', appiumPort: appiumPort || '4723'
          });
        }
      }
      const stmt = db.prepare("UPDATE projects SET name = ?, type = ?, baseUrl = ?, mobileConfig = ?, updatedAt = datetime('now') WHERE id = ?");
      const result = stmt.run(name, type, baseUrl || null, config, req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
    } else {
      // Legacy schema
      const stmt = db.prepare(`UPDATE projects
        SET name = ?, type = ?, baseUrl = ?, appPackage = ?, appActivity = ?,
            deviceName = ?, platformVersion = ?, automationName = ?, updatedAt = datetime('now')
        WHERE id = ?`);
      const result = stmt.run(name, type, baseUrl || null, appPackage || null, appActivity || null,
        deviceName || null, platformVersion || null, automationName || null, req.params.id);
      if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
    }
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Project not found' });
  res.status(204).send();
});

// ============================================================================
// FEATURES
// ============================================================================
app.get('/api/projects/:projectId/features', (req, res) => {
  const features = db.prepare('SELECT * FROM features WHERE projectId = ? ORDER BY createdAt DESC').all(req.params.projectId);
  res.json(features);
});

app.post('/api/features', (req, res) => {
  const { projectId, name, framework, description, content, enabled } = req.body;

  if (!projectId || !name || !framework || !content) {
    return res.status(400).json({ error: 'projectId, name, framework, and content are required' });
  }
  if (!['playwright', 'wdio'].includes(framework)) {
    return res.status(400).json({ error: 'framework must be playwright or wdio' });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO features (id, projectId, name, framework, description, content, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const enabledValue = enabled ?? 1;
    stmt.run(id, projectId, name, framework, description || null, content, enabledValue);
    const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(id);
    res.status(201).json(feature);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/features/:id', (req, res) => {
  const { name, framework, description, content, enabled } = req.body;
  const stmt = db.prepare(`
    UPDATE features
    SET name = ?, framework = ?, description = ?, content = ?, enabled = ?, updatedAt = datetime('now')
    WHERE id = ?
  `);

  try {
    const enabledValue = enabled ?? 1;
    const result = stmt.run(name, framework, description || null, content, enabledValue, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Feature not found' });
    const feature = db.prepare('SELECT * FROM features WHERE id = ?').get(req.params.id);
    res.json(feature);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/features/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM features WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Feature not found' });
  res.status(204).send();
});

// ============================================================================
// STEP DEFINITIONS
// ============================================================================
app.get('/api/projects/:projectId/step-definitions', (req, res) => {
  const steps = db.prepare('SELECT * FROM step_definitions WHERE projectId = ? ORDER BY category, name').all(req.params.projectId);
  res.json(steps.map((s: any) => {
    const parsed = { ...s };
    if (parsed.parameters) {
      try { parsed.parameters = JSON.parse(parsed.parameters); } catch {}
    }
    return parsed;
  }));
});

app.get('/api/step-definitions/:id', (req, res) => {
  const step = db.prepare('SELECT * FROM step_definitions WHERE id = ?').get(req.params.id);
  if (!step) return res.status(404).json({ error: 'Step definition not found' });
  const parsed = { ...step } as any;
  if (parsed.parameters) {
    try { parsed.parameters = JSON.parse(parsed.parameters); } catch {}
  }
  res.json(parsed);
});

app.post('/api/step-definitions', (req, res) => {
  const { projectId, name, category, gherkinPattern, playwrightFunction, parameters, description, enabled } = req.body;

  if (!projectId || !name || !gherkinPattern || !playwrightFunction) {
    return res.status(400).json({ error: 'projectId, name, gherkinPattern, and playwrightFunction are required' });
  }

  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO step_definitions (id, projectId, name, category, gherkinPattern, playwrightFunction, parameters, description, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(id, projectId, name, category || null, gherkinPattern, playwrightFunction,
      parameters ? JSON.stringify(parameters) : null, description || null, enabled !== undefined ? (enabled ? 1 : 0) : 1);
    const step = db.prepare('SELECT * FROM step_definitions WHERE id = ?').get(id);
    res.status(201).json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/step-definitions/:id', (req, res) => {
  const { name, category, gherkinPattern, playwrightFunction, parameters, description, enabled } = req.body;

  const stmt = db.prepare(`
    UPDATE step_definitions
    SET name = ?, category = ?, gherkinPattern = ?, playwrightFunction = ?, parameters = ?,
        description = ?, enabled = ?, updatedAt = datetime('now')
    WHERE id = ?
  `);

  try {
    stmt.run(name, category || null, gherkinPattern, playwrightFunction,
      parameters ? JSON.stringify(parameters) : null, description || null,
      enabled !== undefined ? (enabled ? 1 : 0) : 1, req.params.id);
    const step = db.prepare('SELECT * FROM step_definitions WHERE id = ?').get(req.params.id);
    if (!step) return res.status(404).json({ error: 'Step definition not found' });
    res.json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/step-definitions/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM step_definitions WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Step definition not found' });
  res.status(204).send();
});

// Bulk import step definitions from Playwright library
app.post('/api/projects/:projectId/step-definitions/import', (req, res) => {
  const { framework } = req.body;
  if (framework !== 'playwright') {
    return res.status(400).json({ error: 'Only playwright framework is supported' });
  }

  // Default step definitions for Playwright
  const defaultSteps = [
    // Navigation
    { name: 'Navigate to URL', category: 'navigation', gherkinPattern: 'I navigate to {url}', playwrightFunction: 'goTo', parameters: [{ name: 'url', type: 'string', description: 'URL to navigate to' }], description: 'Navigate to a specific URL' },
    { name: 'Go to URL', category: 'navigation', gherkinPattern: 'I go to {url}', playwrightFunction: 'goTo', parameters: [{ name: 'url', type: 'string', description: 'URL to navigate to' }], description: 'Navigate to a specific URL' },
    { name: 'Refresh page', category: 'navigation', gherkinPattern: 'I refresh the page', playwrightFunction: 'refresh', parameters: [], description: 'Reload the current page' },
    { name: 'Go back', category: 'navigation', gherkinPattern: 'I go back', playwrightFunction: 'goBack', parameters: [], description: 'Navigate back in browser history' },
    { name: 'Go forward', category: 'navigation', gherkinPattern: 'I go forward', playwrightFunction: 'goForward', parameters: [], description: 'Navigate forward in browser history' },
    // Input
    { name: 'Enter text in input by ID', category: 'input', gherkinPattern: 'I enter {value} into input field having id {id}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by ID' },
    { name: 'Enter text in input by name', category: 'input', gherkinPattern: 'I enter {value} into input field having name {name}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'name:{name}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by name' },
    { name: 'Enter text in input by CSS', category: 'input', gherkinPattern: 'I enter {value} into input field having css selector {selector}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by CSS selector' },
    { name: 'Clear input by ID', category: 'input', gherkinPattern: 'I clear input field having id {id}', playwrightFunction: 'clearInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Clear an input field by ID' },
    { name: 'Type without clearing', category: 'input', gherkinPattern: 'I type {value} into input field having id {id}', playwrightFunction: 'sendInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Type text without clearing existing content' },
    // Click
    { name: 'Click by ID', category: 'click', gherkinPattern: 'I click on element having id {id}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Click an element by ID' },
    { name: 'Click by CSS', category: 'click', gherkinPattern: 'I click on element having css selector {selector}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }], description: 'Click an element by CSS selector' },
    { name: 'Click by name', category: 'click', gherkinPattern: 'I click on element having name {name}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'name:{name}' }], description: 'Click an element by name' },
    { name: 'Double click', category: 'click', gherkinPattern: 'I double click on element having id {id}', playwrightFunction: 'doubleClick', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Double click an element' },
    { name: 'Right click', category: 'click', gherkinPattern: 'I right click on element having id {id}', playwrightFunction: 'rightClick', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Right click an element' },
    { name: 'Hover', category: 'click', gherkinPattern: 'I hover over element having id {id}', playwrightFunction: 'hover', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Hover over an element' },
    // Form
    { name: 'Check checkbox', category: 'form', gherkinPattern: 'I check checkbox having id {id}', playwrightFunction: 'check', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Check a checkbox' },
    { name: 'Uncheck checkbox', category: 'form', gherkinPattern: 'I uncheck checkbox having id {id}', playwrightFunction: 'uncheck', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Uncheck a checkbox' },
    { name: 'Select dropdown', category: 'form', gherkinPattern: 'I select {value} from dropdown having id {id}', playwrightFunction: 'selectOption', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Select an option from dropdown' },
    { name: 'Submit form', category: 'form', gherkinPattern: 'I submit the form having id {id}', playwrightFunction: 'submitInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Submit form by pressing Enter on input' },
    // Assertion
    { name: 'See text on page', category: 'assertion', gherkinPattern: 'I should see {text} text on page', playwrightFunction: 'getPageText', parameters: [{ name: 'expectedText', type: 'string' }], description: 'Verify text is visible somewhere on page' },
    { name: 'See text in element by ID', category: 'assertion', gherkinPattern: 'I should see {text} text in element having id {id}', playwrightFunction: 'getText', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'expectedText', type: 'string' }], description: 'Verify text within specific element' },
    { name: 'See text in element by CSS', category: 'assertion', gherkinPattern: 'I should see {text} text in element having css selector {selector}', playwrightFunction: 'getText', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }, { name: 'expectedText', type: 'string' }], description: 'Verify text within element by CSS' },
    { name: 'Element visible', category: 'assertion', gherkinPattern: 'element having id {id} should be visible', playwrightFunction: 'isVisible', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Verify element is visible' },
    { name: 'Element not visible', category: 'assertion', gherkinPattern: 'element having id {id} should not be visible', playwrightFunction: 'isVisible', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Verify element is not visible' },
    { name: 'Element enabled', category: 'assertion', gherkinPattern: 'element having id {id} should be enabled', playwrightFunction: 'isEnabled', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Verify element is enabled' },
    { name: 'Element disabled', category: 'assertion', gherkinPattern: 'element having id {id} should be disabled', playwrightFunction: 'isEnabled', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Verify element is disabled' },
    { name: 'Checkbox checked', category: 'assertion', gherkinPattern: 'checkbox having id {id} should be checked', playwrightFunction: 'isChecked', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Verify checkbox is checked' },
    { name: 'Title equals', category: 'assertion', gherkinPattern: 'the title should be {title}', playwrightFunction: 'getTitle', parameters: [{ name: 'expectedTitle', type: 'string' }], description: 'Verify page title' },
    { name: 'URL equals', category: 'assertion', gherkinPattern: 'the URL should be {url}', playwrightFunction: 'getUrl', parameters: [{ name: 'expectedUrl', type: 'string' }], description: 'Verify exact URL' },
    { name: 'URL contains', category: 'assertion', gherkinPattern: 'the URL should contain {fragment}', playwrightFunction: 'getUrl', parameters: [{ name: 'expectedFragment', type: 'string' }], description: 'Verify URL contains text' },
    { name: 'Input value equals', category: 'assertion', gherkinPattern: 'the value of input having id {id} should be {value}', playwrightFunction: 'getInputValue', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'expectedValue', type: 'string' }], description: 'Verify input field value' },
    { name: 'Element count equals', category: 'assertion', gherkinPattern: 'there should be {count} elements with css selector {selector}', playwrightFunction: 'getElementCount', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }, { name: 'count', type: 'number' }], description: 'Count elements matching selector' },
    // Wait
    { name: 'Wait milliseconds', category: 'wait', gherkinPattern: 'I wait {ms} milliseconds', playwrightFunction: 'wait', parameters: [{ name: 'ms', type: 'number' }], description: 'Pause for specified milliseconds' },
    { name: 'Wait for element visible', category: 'wait', gherkinPattern: 'I wait for element having id {id} to be visible', playwrightFunction: 'waitUntilVisible', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Wait until element is visible' },
    { name: 'Wait for element hidden', category: 'wait', gherkinPattern: 'I wait for element having id {id} to be hidden', playwrightFunction: 'waitUntilHidden', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Wait until element is hidden' },
    // Screenshot
    { name: 'Take screenshot', category: 'screenshot', gherkinPattern: 'I take a screenshot', playwrightFunction: 'takeShoot', parameters: [], description: 'Capture full page screenshot' },
    // Scroll
    { name: 'Scroll to element', category: 'scroll', gherkinPattern: 'I scroll to element having id {id}', playwrightFunction: 'scrollToElement', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Scroll element into view' },
    { name: 'Scroll down', category: 'scroll', gherkinPattern: 'I scroll down {pixels} pixels', playwrightFunction: 'scrollBy', parameters: [{ name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number' }], description: 'Scroll down by pixels' },
    { name: 'Scroll up', category: 'scroll', gherkinPattern: 'I scroll up {pixels} pixels', playwrightFunction: 'scrollBy', parameters: [{ name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: '-{pixels}' }], description: 'Scroll up by pixels' },
    // Script
    { name: 'Execute script', category: 'script', gherkinPattern: 'I execute script {script}', playwrightFunction: 'executeScript', parameters: [{ name: 'script', type: 'string' }], description: 'Execute custom JavaScript' },
    // Attribute
    { name: 'Element has attribute', category: 'attribute', gherkinPattern: 'element having id {id} should have attribute {attr} with value {value}', playwrightFunction: 'getAttribute', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'attribute', type: 'string' }], description: 'Verify element attribute value' },
  ];

  const stmt = db.prepare(`
    INSERT INTO step_definitions (id, projectId, name, category, gherkinPattern, playwrightFunction, parameters, description, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const imported = [];
  for (const step of defaultSteps) {
    const id = generateId();
    try {
      stmt.run(id, req.params.projectId, step.name, step.category, step.gherkinPattern, step.playwrightFunction,
        JSON.stringify(step.parameters), step.description, 1);
      imported.push({ id, ...step });
    } catch (e: any) {
      // Skip duplicates
      if (!e.message.includes('UNIQUE')) {
        return res.status(500).json({ error: e.message });
      }
    }
  }

  res.status(201).json({ imported: imported.length, steps: imported });
});

// ============================================================================
// TEST RUNS
// ============================================================================
app.get('/api/test-runs', (req, res) => {
  const runs = db.prepare(`
    SELECT tr.*, p.name as projectName, p.type as projectType
    FROM test_runs tr
    JOIN projects p ON tr.projectId = p.id
    ORDER BY tr.startedAt DESC
  `).all();
  res.json(runs);
});

app.get('/api/test-runs/:id', (req, res) => {
  const run = db.prepare(`
    SELECT tr.*, p.name as projectName, p.type as projectType
    FROM test_runs tr
    JOIN projects p ON tr.projectId = p.id
    WHERE tr.id = ?
  `).get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Test run not found' });
  res.json(run);
});

app.get('/api/projects/:projectId/test-runs', (req, res) => {
  const runs = db.prepare(`
    SELECT * FROM test_runs
    WHERE projectId = ?
    ORDER BY startedAt DESC
  `).all(req.params.projectId);
  res.json(runs);
});

app.post('/api/test-runs', (req, res) => {
  const { projectId, featureIds, recordTestRun, takeScreenshots } = req.body;

  if (!projectId || !featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
    return res.status(400).json({ error: 'projectId and featureIds array are required' });
  }

  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO test_runs (id, projectId, featureIds, status, recordTestRun, takeScreenshots)
    VALUES (?, ?, ?, 'pending', ?, ?)
  `);

  try {
    stmt.run(id, projectId, JSON.stringify(featureIds), recordTestRun ? 1 : 0, takeScreenshots !== false ? 1 : 0);
    const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id);
    res.status(201).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/test-runs/:id', (req, res) => {
  const { status, recordingPath, screenshotPaths, resultJson, errorMessage } = req.body;
  const updates: string[] = [];
  const values: any[] = [];

  if (status) {
    updates.push('status = ?');
    values.push(status);
    if (status === 'running' && !req.body.startedAt) {
      updates.push("startedAt = datetime('now')");
    } else if (['passed', 'failed', 'cancelled'].includes(status)) {
      updates.push("completedAt = datetime('now')");
    }
  }
  if (recordingPath) {
    updates.push('recordingPath = ?');
    values.push(recordingPath);
  }
  if (screenshotPaths) {
    updates.push('screenshotPaths = ?');
    values.push(JSON.stringify(screenshotPaths));
  }
  if (resultJson) {
    updates.push('resultJson = ?');
    values.push(JSON.stringify(resultJson));
  }
  if (errorMessage !== undefined) {
    updates.push('errorMessage = ?');
    values.push(errorMessage);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);
  const stmt = db.prepare(`UPDATE test_runs SET ${updates.join(', ')} WHERE id = ?`);

  try {
    const result = stmt.run(...values);
    if (result.changes === 0) return res.status(404).json({ error: 'Test run not found' });
    const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/test-runs/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM test_runs WHERE id = ?');
  const result = stmt.run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Test run not found' });
  res.status(204).send();
});

// ============================================================================
// TEST EXECUTION
// ============================================================================
import { spawn } from 'node:child_process';

const runningTests = new Map<string, any>();

app.post('/api/test-runs/:id/run', async (req, res) => {
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id) as any;
  if (!run) return res.status(404).json({ error: 'Test run not found' });
  if (run.status === 'running') return res.status(400).json({ error: 'Test already running' });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(run.projectId) as any;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const featureIds = JSON.parse(run.featureIds);
  const features = db.prepare(`SELECT * FROM features WHERE id IN (${featureIds.map(() => '?').join(',')})`).all(...featureIds);

  if (features.length === 0) {
    return res.status(400).json({ error: 'No valid features found' });
  }

  // Update status to running
  db.prepare("UPDATE test_runs SET status = ?, startedAt = datetime('now') WHERE id = ?").run('running', req.params.id);

  // Spawn test runner
  const testRunnerPath = path.join(__dirname, 'test-runner.ts');
  const child = spawn('npx', ['tsx', testRunnerPath], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      TEST_RUN_ID: req.params.id,
      PROJECT_TYPE: project.type,
      BASE_URL: project.baseUrl || '',
      HEADLESS: 'false'
    }
  });

  runningTests.set(req.params.id, child);

  let output = '';
  child.stdout.on('data', (data) => {
    output += data.toString();
  });

  child.stderr.on('data', (data) => {
    output += data.toString();
  });

  child.on('close', (code) => {
    runningTests.delete(req.params.id);
    const status = code === 0 ? 'passed' : 'failed';
    const errorMessage = code === 0 ? null : output.slice(0, 1000);
    db.prepare("UPDATE test_runs SET status = ?, completedAt = datetime('now'), errorMessage = ? WHERE id = ?")
      .run(status, errorMessage, req.params.id);
  });

  child.on('error', (err) => {
    runningTests.delete(req.params.id);
    console.error('[TestRunner] Failed to spawn:', err);
    db.prepare("UPDATE test_runs SET status = ?, errorMessage = ?, completedAt = datetime('now') WHERE id = ?")
      .run('failed', `Failed to start test runner: ${err.message}`, req.params.id);
  });

  res.json({ message: 'Test started', runId: req.params.id });
});

app.post('/api/test-runs/:id/stop', (req, res) => {
  const child = runningTests.get(req.params.id);
  if (!child) return res.status(404).json({ error: 'Test not running' });

  child.kill('SIGTERM');
  runningTests.delete(req.params.id);

  db.prepare("UPDATE test_runs SET status = ?, completedAt = datetime('now') WHERE id = ?")
    .run('cancelled', req.params.id);

  res.json({ message: 'Test stopped' });
});

app.get('/api/test-runs/:id/logs', (req, res) => {
  // Return logs if available (stored in resultJson or separate log file)
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Test run not found' });

  res.json({ logs: run.resultJson || '' });
});

// ============================================================================
// AI GHERKIN GENERATOR
// ============================================================================
app.post('/api/ai/gherkin', async (req, res) => {
  try {
    const { description, framework = 'playwright' } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description required' });
    }

    const prompt = `You are a Gherkin/Cucumber expert. Convert the following test description into proper Gherkin format.

Framework: ${framework === 'playwright' ? 'Web Testing (Playwright)' : 'Mobile Testing (WDIO/Appium)'}

Rules:
1. Start with "Feature: [Name]" followed by a brief description
2. Create multiple realistic scenarios covering happy path and edge cases
3. Use proper Gherkin keywords: Feature, Scenario, Given, When, Then, And, But
4. Steps should be clear, actionable, and testable
5. Include assertions in Then steps
6. Keep scenarios focused and independent

Test Description:
${description}

Return ONLY the Gherkin feature content, no explanations.`;

    const content = await callAI(prompt);

    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SERVE FRONTEND
// ============================================================================
app.use(express.static(path.join(__dirname, '../dashboard/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
});

// ============================================================================
// START
// ============================================================================
app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
