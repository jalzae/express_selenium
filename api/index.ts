import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { eq, and, desc } from 'drizzle-orm';
import { db } from './db';
import { projects, features, testRuns, stepDefinitions, scenarioSteps } from './db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, '..', '.env') });

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

app.use(cors());
app.use(express.json());

app.use('/recordings', express.static(path.join(__dirname, '../dashboard/public/recordings')));
app.use('/screenshots', express.static(path.join(__dirname, '../dashboard/public/screenshots')));

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

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

// ============================================================================
// PROJECTS
// ============================================================================
app.get('/api/projects', async (req, res) => {
  try {
    const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
    res.json(allProjects.map(parseProject));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(parseProject(project));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  const { name, type, baseUrl, mobileConfig, appPackage, appActivity, deviceName, platformVersion, automationName, appiumPath, appiumHost, appiumPort, apkPath } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'name and type are required' });
  }
  if (!['web', 'mobile'].includes(type)) {
    return res.status(400).json({ error: 'type must be web or mobile' });
  }

  const id = generateId();

  let config = null;
  if (type === 'mobile') {
    if (mobileConfig) {
      config = JSON.stringify(mobileConfig);
    } else {
      config = JSON.stringify({
        appPackage, appActivity, deviceName, platformVersion, automationName,
        appiumPath: appiumPath || '/', appiumHost: appiumHost || 'localhost',
        appiumPort: appiumPort || '4723', apkPath: apkPath || ''
      });
    }
  }

  try {
    await db.insert(projects).values({
      id, name, type, baseUrl: baseUrl || null, mobileConfig: config
    });
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  const { name, type, baseUrl, mobileConfig, appPackage, appActivity, deviceName, platformVersion, automationName, appiumPath, appiumHost, appiumPort, apkPath } = req.body;

  try {
    let config = null;
    if (type === 'mobile') {
      if (mobileConfig) {
        config = JSON.stringify(mobileConfig);
      } else if (appPackage || deviceName) {
        config = JSON.stringify({
          appPackage, appActivity, deviceName, platformVersion, automationName,
          appiumPath: appiumPath || '/', appiumHost: appiumHost || 'localhost',
          appiumPort: appiumPort || '4723', apkPath: apkPath || ''
        });
      }
    }

    await db.update(projects)
      .set({
        name, type, baseUrl: baseUrl || null, mobileConfig: config,
        updatedAt: new Date()
      })
      .where(eq(projects.id, req.params.id));

    const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await db.delete(projects).where(eq(projects.id, req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FEATURES
// ============================================================================
app.get('/api/projects/:projectId/features', async (req, res) => {
  try {
    const allFeatures = await db.select()
      .from(features)
      .where(eq(features.projectId, req.params.projectId))
      .orderBy(desc(features.createdAt));
    res.json(allFeatures);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/features', async (req, res) => {
  const { projectId, name, framework, description, content, enabled } = req.body;

  if (!projectId || !name || !framework || !content) {
    return res.status(400).json({ error: 'projectId, name, framework, and content are required' });
  }
  if (!['playwright', 'wdio'].includes(framework)) {
    return res.status(400).json({ error: 'framework must be playwright or wdio' });
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = generateId();

  try {
    await db.insert(features).values({
      id, projectId, name, framework, description: description || null, content,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1
    });
    const [feature] = await db.select().from(features).where(eq(features.id, id));
    res.status(201).json(feature);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/features/:id', async (req, res) => {
  const { name, framework, description, content, enabled } = req.body;

  try {
    await db.update(features)
      .set({
        name, framework, description: description || null, content,
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
        updatedAt: new Date()
      })
      .where(eq(features.id, req.params.id));

    const [feature] = await db.select().from(features).where(eq(features.id, req.params.id));
    if (!feature) return res.status(404).json({ error: 'Feature not found' });
    res.json(feature);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/features/:id', async (req, res) => {
  try {
    await db.delete(features).where(eq(features.id, req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// STEP DEFINITIONS
// ============================================================================
app.get('/api/projects/:projectId/step-definitions', async (req, res) => {
  try {
    const steps = await db.select()
      .from(stepDefinitions)
      .where(eq(stepDefinitions.projectId, req.params.projectId))
      .orderBy(stepDefinitions.category, stepDefinitions.name);

    res.json(steps.map((s) => {
      const parsed = { ...s };
      if (parsed.parameters) {
        try { parsed.parameters = JSON.parse(parsed.parameters); } catch {}
      }
      return parsed;
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/step-definitions/:id', async (req, res) => {
  try {
    const [step] = await db.select().from(stepDefinitions).where(eq(stepDefinitions.id, req.params.id));
    if (!step) return res.status(404).json({ error: 'Step definition not found' });
    const parsed = { ...step };
    if (parsed.parameters) {
      try { parsed.parameters = JSON.parse(parsed.parameters); } catch {}
    }
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/step-definitions', async (req, res) => {
  const { projectId, name, category, gherkinPattern, playwrightFunction, parameters, description, enabled } = req.body;

  if (!projectId || !name || !gherkinPattern || !playwrightFunction) {
    return res.status(400).json({ error: 'projectId, name, gherkinPattern, and playwrightFunction are required' });
  }

  const id = generateId();

  try {
    await db.insert(stepDefinitions).values({
      id, projectId, name, category: category || null, gherkinPattern, playwrightFunction,
      parameters: parameters ? JSON.stringify(parameters) : null,
      description: description || null,
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1
    });
    const [step] = await db.select().from(stepDefinitions).where(eq(stepDefinitions.id, id));
    res.status(201).json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/step-definitions/:id', async (req, res) => {
  const { name, category, gherkinPattern, playwrightFunction, parameters, description, enabled } = req.body;

  try {
    await db.update(stepDefinitions)
      .set({
        name, category: category || null, gherkinPattern, playwrightFunction,
        parameters: parameters ? JSON.stringify(parameters) : null,
        description: description || null,
        enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
        updatedAt: new Date()
      })
      .where(eq(stepDefinitions.id, req.params.id));

    const [step] = await db.select().from(stepDefinitions).where(eq(stepDefinitions.id, req.params.id));
    if (!step) return res.status(404).json({ error: 'Step definition not found' });
    res.json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/step-definitions/:id', async (req, res) => {
  try {
    await db.delete(stepDefinitions).where(eq(stepDefinitions.id, req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:projectId/step-definitions/import', async (req, res) => {
  const { framework } = req.body;
  if (framework !== 'playwright') {
    return res.status(400).json({ error: 'Only playwright framework is supported' });
  }

  const defaultSteps = [
    { name: 'Navigate to URL', category: 'navigation', gherkinPattern: 'I navigate to {url}', playwrightFunction: 'goTo', parameters: [{ name: 'url', type: 'string', description: 'URL to navigate to' }], description: 'Navigate to a specific URL' },
    { name: 'Go to URL', category: 'navigation', gherkinPattern: 'I go to {url}', playwrightFunction: 'goTo', parameters: [{ name: 'url', type: 'string', description: 'URL to navigate to' }], description: 'Navigate to a specific URL' },
    { name: 'Refresh page', category: 'navigation', gherkinPattern: 'I refresh the page', playwrightFunction: 'refresh', parameters: [], description: 'Reload the current page' },
    { name: 'Go back', category: 'navigation', gherkinPattern: 'I go back', playwrightFunction: 'goBack', parameters: [], description: 'Navigate back in browser history' },
    { name: 'Go forward', category: 'navigation', gherkinPattern: 'I go forward', playwrightFunction: 'goForward', parameters: [], description: 'Navigate forward in browser history' },
    { name: 'Enter text in input by ID', category: 'input', gherkinPattern: 'I enter {value} into input field having id {id}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by ID' },
    { name: 'Enter text in input by name', category: 'input', gherkinPattern: 'I enter {value} into input field having name {name}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'name:{name}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by name' },
    { name: 'Enter text in input by CSS', category: 'input', gherkinPattern: 'I enter {value} into input field having css selector {selector}', playwrightFunction: 'input', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }, { name: 'value', type: 'string' }], description: 'Enter text into an input field by CSS selector' },
    { name: 'Clear input by ID', category: 'input', gherkinPattern: 'I clear input field having id {id}', playwrightFunction: 'clearInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Clear an input field by ID' },
    { name: 'Type without clearing', category: 'input', gherkinPattern: 'I type {value} into input field having id {id}', playwrightFunction: 'sendInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Type text without clearing existing content' },
    { name: 'Click by ID', category: 'click', gherkinPattern: 'I click on element having id {id}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Click an element by ID' },
    { name: 'Click by CSS', category: 'click', gherkinPattern: 'I click on element having css selector {selector}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }], description: 'Click an element by CSS selector' },
    { name: 'Click by name', category: 'click', gherkinPattern: 'I click on element having name {name}', playwrightFunction: 'click', parameters: [{ name: 'selector', type: 'string', default: 'name:{name}' }], description: 'Click an element by name' },
    { name: 'Double click', category: 'click', gherkinPattern: 'I double click on element having id {id}', playwrightFunction: 'doubleClick', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Double click an element' },
    { name: 'Right click', category: 'click', gherkinPattern: 'I right click on element having id {id}', playwrightFunction: 'rightClick', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Right click an element' },
    { name: 'Hover', category: 'click', gherkinPattern: 'I hover over element having id {id}', playwrightFunction: 'hover', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Hover over an element' },
    { name: 'Check checkbox', category: 'form', gherkinPattern: 'I check checkbox having id {id}', playwrightFunction: 'check', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Check a checkbox' },
    { name: 'Uncheck checkbox', category: 'form', gherkinPattern: 'I uncheck checkbox having id {id}', playwrightFunction: 'uncheck', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Uncheck a checkbox' },
    { name: 'Select dropdown', category: 'form', gherkinPattern: 'I select {value} from dropdown having id {id}', playwrightFunction: 'selectOption', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'value', type: 'string' }], description: 'Select an option from dropdown' },
    { name: 'Submit form', category: 'form', gherkinPattern: 'I submit the form having id {id}', playwrightFunction: 'submitInput', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Submit form by pressing Enter on input' },
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
    { name: 'Wait milliseconds', category: 'wait', gherkinPattern: 'I wait {ms} milliseconds', playwrightFunction: 'wait', parameters: [{ name: 'ms', type: 'number' }], description: 'Pause for specified milliseconds' },
    { name: 'Wait for element visible', category: 'wait', gherkinPattern: 'I wait for element having id {id} to be visible', playwrightFunction: 'waitUntilVisible', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Wait until element is visible' },
    { name: 'Wait for element hidden', category: 'wait', gherkinPattern: 'I wait for element having id {id} to be hidden', playwrightFunction: 'waitUntilHidden', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Wait until element is hidden' },
    { name: 'Wait for CSS visible', category: 'wait', gherkinPattern: 'I wait for element having css selector {selector} to be visible', playwrightFunction: 'waitUntilVisible', parameters: [{ name: 'selector', type: 'string', default: 'css:{selector}' }], description: 'Wait until CSS element is visible' },
    { name: 'Wait for name visible', category: 'wait', gherkinPattern: 'I wait for element having name {name} to be visible', playwrightFunction: 'waitUntilVisible', parameters: [{ name: 'selector', type: 'string', default: 'name:{name}' }], description: 'Wait until element with name attribute is visible' },
    { name: 'Take screenshot', category: 'screenshot', gherkinPattern: 'I take a screenshot', playwrightFunction: 'takeShoot', parameters: [], description: 'Capture full page screenshot' },
    { name: 'Click with text', category: 'click', gherkinPattern: 'I click on element having css selector {selector} with text {text}', playwrightFunction: 'clickByText', parameters: [{ name: 'selector', type: 'string' }, { name: 'text', type: 'string' }], description: 'Click element matching CSS selector containing specific text' },
    { name: 'Scroll to element', category: 'scroll', gherkinPattern: 'I scroll to element having id {id}', playwrightFunction: 'scrollToElement', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }], description: 'Scroll element into view' },
    { name: 'Scroll down', category: 'scroll', gherkinPattern: 'I scroll down {pixels} pixels', playwrightFunction: 'scrollBy', parameters: [{ name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number' }], description: 'Scroll down by pixels' },
    { name: 'Scroll up', category: 'scroll', gherkinPattern: 'I scroll up {pixels} pixels', playwrightFunction: 'scrollBy', parameters: [{ name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: '-{pixels}' }], description: 'Scroll up by pixels' },
    { name: 'Execute script', category: 'script', gherkinPattern: 'I execute script {script}', playwrightFunction: 'executeScript', parameters: [{ name: 'script', type: 'string' }], description: 'Execute custom JavaScript' },
    { name: 'Element has attribute', category: 'attribute', gherkinPattern: 'element having id {id} should have attribute {attr} with value {value}', playwrightFunction: 'getAttribute', parameters: [{ name: 'selector', type: 'string', default: 'id:{id}' }, { name: 'attribute', type: 'string' }], description: 'Verify element attribute value' },
  ];

  const imported = [];
  for (const step of defaultSteps) {
    const id = generateId();
    try {
      await db.insert(stepDefinitions).values({
        id, projectId: req.params.projectId, name: step.name, category: step.category,
        gherkinPattern: step.gherkinPattern, playwrightFunction: step.playwrightFunction,
        parameters: JSON.stringify(step.parameters), description: step.description, enabled: 1
      });
      imported.push({ id, ...step });
    } catch (e: any) {
      if (!e.message.includes('Duplicate')) {
        return res.status(500).json({ error: e.message });
      }
    }
  }

  res.status(201).json({ imported: imported.length, steps: imported });
});

// ============================================================================
// TEST RUNS
// ============================================================================
app.get('/api/test-runs', async (req, res) => {
  try {
    const runs = await db.select({
      id: testRuns.id,
      projectId: testRuns.projectId,
      featureIds: testRuns.featureIds,
      status: testRuns.status,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      recordingPath: testRuns.recordingPath,
      screenshotPaths: testRuns.screenshotPaths,
      resultJson: testRuns.resultJson,
      errorMessage: testRuns.errorMessage,
      recordTestRun: testRuns.recordTestRun,
      takeScreenshots: testRuns.takeScreenshots,
      projectName: projects.name,
      projectType: projects.type,
    })
      .from(testRuns)
      .innerJoin(projects, eq(testRuns.projectId, projects.id))
      .orderBy(desc(testRuns.startedAt));

    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-runs/:id', async (req, res) => {
  try {
    const [run] = await db.select({
      id: testRuns.id,
      projectId: testRuns.projectId,
      featureIds: testRuns.featureIds,
      status: testRuns.status,
      startedAt: testRuns.startedAt,
      completedAt: testRuns.completedAt,
      recordingPath: testRuns.recordingPath,
      screenshotPaths: testRuns.screenshotPaths,
      resultJson: testRuns.resultJson,
      errorMessage: testRuns.errorMessage,
      recordTestRun: testRuns.recordTestRun,
      takeScreenshots: testRuns.takeScreenshots,
      projectName: projects.name,
      projectType: projects.type,
    })
      .from(testRuns)
      .innerJoin(projects, eq(testRuns.projectId, projects.id))
      .where(eq(testRuns.id, req.params.id));

    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:projectId/test-runs', async (req, res) => {
  try {
    const runs = await db.select()
      .from(testRuns)
      .where(eq(testRuns.projectId, req.params.projectId))
      .orderBy(desc(testRuns.startedAt));
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-runs', async (req, res) => {
  const { projectId, featureIds, recordTestRun, takeScreenshots } = req.body;

  if (!projectId || !featureIds || !Array.isArray(featureIds) || featureIds.length === 0) {
    return res.status(400).json({ error: 'projectId and featureIds array are required' });
  }

  const id = generateId();

  try {
    await db.insert(testRuns).values({
      id, projectId, featureIds: JSON.stringify(featureIds),
      status: 'pending',
      recordTestRun: recordTestRun ? 1 : 0,
      takeScreenshots: takeScreenshots !== false ? 1 : 0
    });
    const [run] = await db.select().from(testRuns).where(eq(testRuns.id, id));
    res.status(201).json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/test-runs/:id', async (req, res) => {
  const { status, recordingPath, screenshotPaths, resultJson, errorMessage } = req.body;
  const updates: any = {};

  if (status) {
    updates.status = status;
    if (status === 'running' && !req.body.startedAt) {
      updates.startedAt = new Date();
    } else if (['passed', 'failed', 'cancelled'].includes(status)) {
      updates.completedAt = new Date();
    }
  }
  if (recordingPath !== undefined) updates.recordingPath = recordingPath;
  if (screenshotPaths !== undefined) updates.screenshotPaths = JSON.stringify(screenshotPaths);
  if (resultJson !== undefined) updates.resultJson = JSON.stringify(resultJson);
  if (errorMessage !== undefined) updates.errorMessage = errorMessage;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    await db.update(testRuns)
      .set(updates)
      .where(eq(testRuns.id, req.params.id));

    const [run] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/test-runs/:id', async (req, res) => {
  try {
    await db.delete(testRuns).where(eq(testRuns.id, req.params.id));
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// TEST EXECUTION
// ============================================================================
const runningTests = new Map<string, any>();

app.post('/api/test-runs/:id/run', async (req, res) => {
  try {
    const [run] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    if (run.status === 'running') return res.status(400).json({ error: 'Test already running' });

    const [project] = await db.select().from(projects).where(eq(projects.id, run.projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const featureIds = JSON.parse(run.featureIds);
    const featureList = await db.select()
      .from(features)
      .where(eq(features.projectId, run.projectId));

    const filteredFeatures = featureList.filter(f => featureIds.includes(f.id));

    if (filteredFeatures.length === 0) {
      return res.status(400).json({ error: 'No valid features found' });
    }

    await db.update(testRuns)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(testRuns.id, req.params.id));

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

    child.on('close', async (code) => {
      runningTests.delete(req.params.id);
      const status = code === 0 ? 'passed' : 'failed';
      const errorMsg = code === 0 ? null : output.slice(0, 1000);
      await db.update(testRuns)
        .set({ status, completedAt: new Date(), errorMessage: errorMsg })
        .where(eq(testRuns.id, req.params.id));
    });

    child.on('error', async (err) => {
      runningTests.delete(req.params.id);
      console.error('[TestRunner] Failed to spawn:', err);
      await db.update(testRuns)
        .set({
          status: 'failed',
          errorMessage: `Failed to start test runner: ${err.message}`,
          completedAt: new Date()
        })
        .where(eq(testRuns.id, req.params.id));
    });

    res.json({ message: 'Test started', runId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-runs/:id/stop', async (req, res) => {
  try {
    const child = runningTests.get(req.params.id);
    if (!child) return res.status(404).json({ error: 'Test not running' });

    child.kill('SIGTERM');
    runningTests.delete(req.params.id);

    await db.update(testRuns)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(testRuns.id, req.params.id));

    res.json({ message: 'Test stopped' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test-runs/:id/logs', async (req, res) => {
  try {
    const [run] = await db.select().from(testRuns).where(eq(testRuns.id, req.params.id));
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json({ logs: run.resultJson || '' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
// APPIUM SERVER STATUS
// ============================================================================
app.post('/api/appium/status', async (req, res) => {
  try {
    const { host = 'localhost', port = 4723 } = req.body;

    const response = await fetch(`http://${host}:${port}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      res.json({
        connected: true,
        value: data.value
      });
    } else {
      res.json({
        connected: false,
        error: `Appium server returned status ${response.status}`
      });
    }
  } catch (err: any) {
    res.json({
      connected: false,
      error: err.message || 'Failed to connect to Appium server'
    });
  }
});

// ============================================================================
// SERVE FRONTEND
// ============================================================================
app.use(express.static(path.join(__dirname, '../dashboard/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
