<template>
  <div class="container">
    <div class="header">
      <div class="flex items-center gap-4">
        <button class="btn-sm btn-secondary" @click="$router.back()">← Back</button>
        <div>
          <span class="badge" :class="project?.type === 'web' ? 'badge-info' : 'badge-warning'">
            {{ project?.type }}
          </span>
          <h2>{{ project?.name }}</h2>
        </div>
      </div>
      <button class="btn-primary" @click="openFeatureModal()">+ Add Feature</button>
    </div>

    <!-- Appium Server Status (for mobile projects) -->
    <div v-if="project?.type === 'mobile'" class="appium-status-section">
      <div class="section-header">
        <h3>Appium Server Status</h3>
        <div class="status-badge" :class="{ 'status-connected': appiumStatus.connected, 'status-disconnected': !appiumStatus.connected }">
          {{ appiumStatus.connected ? '✓ Connected' : '⚠️ Not Connected' }}
        </div>
      </div>
      <div class="appium-config">
        <div class="config-row">
          <span class="config-label">Server:</span>
          <span class="config-value">{{ project?.automationName || 'uiAutomator2' }} @ {{ project?.deviceName || 'Unknown Device' }}</span>
        </div>
        <div class="config-row">
          <span class="config-label">Endpoint:</span>
          <span class="config-value">http://{{ appiumConfig.host }}:{{ appiumConfig.port }}</span>
        </div>
      </div>
      <div v-if="!appiumStatus.connected" class="appium-warning">
        <p>⚠️ Appium server must be running before executing mobile tests.</p>
        <button class="btn-sm btn-primary" @click="checkAppiumServer" :disabled="appiumStatus.checking">
          {{ appiumStatus.checking ? 'Checking...' : 'Check Connection' }}
        </button>
      </div>
      <div v-else class="appium-success">
        <p>✓ Appium server is running and ready for testing.</p>
      </div>
    </div>

    <!-- Features List -->
    <div class="features-section">
      <div class="section-header">
        <h3>Features</h3>
        <span class="count">{{ features.length }} total</span>
      </div>
      <div class="features-grid" v-if="features.length">
        <div v-for="feature in features" :key="feature.id" class="feature-card">
          <div class="feature-card-header">
            <div class="feature-title">
              <h4>{{ feature.name }}</h4>
              <p v-if="feature.description">{{ feature.description }}</p>
            </div>
            <div class="feature-badges">
              <span class="badge" :class="feature.framework === 'playwright' ? 'badge-info' : 'badge-warning'">
                {{ feature.framework }}
              </span>
              <span class="badge" :class="feature.enabled ? 'badge-success' : 'badge-secondary'">
                {{ feature.enabled ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          <div class="feature-card-body">
            <div class="feature-stats">
              <div class="stat">
                <span class="stat-icon">📋</span>
                <span>{{ getScenarioCount(feature.content) }} scenarios</span>
              </div>
              <div class="stat">
                <span class="stat-icon">📝</span>
                <span>{{ getStepCount(feature.content) }} steps</span>
              </div>
            </div>
            <div class="feature-preview">
              <pre>{{ getPreview(feature.content) }}</pre>
            </div>
          </div>
          <div class="feature-card-footer">
            <button class="btn-sm btn-secondary" @click="editFeature(feature)">
              <span>✏️</span> Edit
            </button>
            <button class="btn-sm btn-error" @click="confirmDeleteFeature(feature)">
              <span>🗑️</span> Delete
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-icon">📦</div>
        <h4>No features yet</h4>
        <p>Create your first feature to start testing</p>
        <button class="btn-primary" @click="openFeatureModal()">+ Add Feature</button>
      </div>
    </div>

    <!-- Run Tests Section -->
    <div class="run-section">
      <h3>Run Tests</h3>
      <div class="run-card">
        <p class="help-text">Select features to run in this test suite (drag to reorder):</p>
        <div class="feature-selector">
          <div v-for="(featureId, idx) in orderedFeatures" :key="featureId" class="feature-checkbox"
               draggable="true"
               @dragstart="onDragStart(idx)"
               @dragover.prevent
               @drop="onDrop(idx)">
            <span class="drag-handle">⋮⋮</span>
            <label class="checkbox-label">
              <input type="checkbox" :value="featureId" v-model="selectedFeatures" />
              <span class="checkbox-check"></span>
              <div class="checkbox-content">
                <span class="checkbox-name">{{ getFeatureById(featureId)?.name }}</span>
                <span class="checkbox-meta">{{ getScenarioCount(getFeatureById(featureId)?.content || '') }} scenarios · {{ getFeatureById(featureId)?.framework }}</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Options -->
        <div class="run-options">
          <label class="option-checkbox">
            <input type="checkbox" v-model="recordTestRun" />
            <span class="option-check"></span>
            <span>📹 Record test run video</span>
          </label>
          <label class="option-checkbox">
            <input type="checkbox" v-model="takeScreenshots" />
            <span class="option-check"></span>
            <span>📸 Take screenshots</span>
          </label>
        </div>

        <div class="run-actions">
          <div class="run-summary">
            <span>{{ selectedFeatures.length }} feature{{ selectedFeatures.length !== 1 ? 's' : '' }} selected</span>
          </div>
          <button class="btn-primary btn-large" @click="runTests" :disabled="selectedFeatures.length === 0">
            <span>▶️</span> Run Tests
          </button>
        </div>
      </div>
    </div>

    <!-- Feature Modal -->
    <Teleport to="body">
      <div v-if="showFeatureModal" class="modal-overlay" @click.self="closeFeatureModal">
        <div class="modal modal-xl">
          <div class="modal-header">
            <h3>{{ editingFeature ? 'Edit Feature' : 'New Feature' }}</h3>
            <button class="btn-icon" @click="closeFeatureModal">✕</button>
          </div>
          <form @submit.prevent="saveFeature">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="feature-name">Feature Name *</label>
                  <input id="feature-name" v-model="featureForm.name" required placeholder="e.g., User Login" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="feature-framework">Framework *</label>
                  <select id="feature-framework" v-model="featureForm.framework" required>
                    <option value="playwright">🌐 Playwright (Web)</option>
                    <option value="wdio">📱 WDIO/Appium (Mobile)</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="feature-description">Description</label>
                <input id="feature-description" v-model="featureForm.description" placeholder="Brief description of what this feature tests..." />
              </div>

              <!-- AI Generator -->
              <div class="ai-generator">
                <div class="ai-header">
                  <label class="form-label" for="ai-description">
                    <span>✨</span> AI Generate Gherkin
                  </label>
                  <button type="button" class="btn-sm btn-primary" @click="generateWithAI" :disabled="aiGenerating || !aiDescription.trim()">
                    {{ aiGenerating ? 'Generating...' : 'Generate' }}
                  </button>
                </div>
                <textarea
                  id="ai-description"
                  v-model="aiDescription"
                  rows="3"
                  placeholder="Describe your test in plain language...

Example: I want to test the login functionality. User should be able to login with valid credentials and see error with invalid ones. Also test forgot password link."
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">
                  Gherkin Feature *
                  <span v-if="gherkinError" class="error-text">⚠️ {{ gherkinError }}</span>
                  <span v-else-if="gherkinValid" class="success-text">✓ Valid ({{ stepMatchCount }}/{{ totalSteps }} steps match)</span>
                </label>

                <!-- Toggle between editors -->
                <div class="editor-toggle">
                  <button type="button" :class="['tab-btn', { active: editorMode === 'visual' }]" @click="editorMode = 'visual'">
                    📝 Visual Editor
                  </button>
                  <button type="button" :class="['tab-btn', { active: editorMode === 'code' }]" @click="editorMode = 'code'">
                    💻 Code Editor
                  </button>
                </div>

                <!-- Visual Editor: Line-by-line step editor -->
                <div v-if="editorMode === 'visual'" class="visual-editor">
                  <!-- Feature header -->
                  <div class="feature-header-edit">
                    <label for="visual-feature-name">Feature Name:</label>
                    <input id="visual-feature-name" v-model="featureName" class="feature-name-input" placeholder="e.g., User Login" />
                  </div>
                  <div class="feature-header-edit">
                    <label for="visual-feature-desc">Description:</label>
                    <textarea id="visual-feature-desc" v-model="featureDescription" rows="2" class="feature-desc-input" placeholder="As a user, I want to..."></textarea>
                  </div>

                  <!-- Background Section -->
                  <div class="background-block">
                    <div class="background-header">
                      <h4>Background</h4>
                      <span class="background-hint">Steps that run before each scenario</span>
                    </div>
                    <div class="steps-list">
                      <div v-for="(step, stepIdx) in backgroundSteps" :key="`bg-${stepIdx}`" class="step-row">
                        <select v-model="step.keyword" class="keyword-select">
                          <option value="Given">Given</option>
                          <option value="When">When</option>
                          <option value="Then">Then</option>
                          <option value="And">And</option>
                          <option value="But">But</option>
                        </select>

                        <select v-model="step.stepDefId" @change="onBackgroundStepDefChange(step, stepIdx)" class="step-select">
                          <option value="">Select step...</option>
                          <option v-if="step.text && !step.matchedDef" value="" disabled class="step-unmatched-hint">
                            ⚠️ {{ step.text }}
                          </option>
                          <optgroup v-for="cat in stepCategories" :key="cat.name" :label="cat.label">
                            <option v-for="s in cat.steps" :key="s.id" :value="s.id">
                              {{ s.name }}
                            </option>
                          </optgroup>
                        </select>

                        <div v-if="step.matchedDef" class="step-params-inline">
                          <input v-for="param in step.matchedDef.parameters" :key="param.name"
                            :placeholder="param.name"
                            v-model="step.paramValues[param.name]"
                            @input="updateBackgroundStepText(step)"
                            class="param-input-inline" />
                        </div>

                        <button type="button" class="btn-icon" @click="removeBackgroundStep(stepIdx)" title="Remove step">✕</button>
                        <button type="button" class="btn-icon" @click="moveBackgroundStep(stepIdx, -1)" title="Move up">↑</button>
                        <button type="button" class="btn-icon" @click="moveBackgroundStep(stepIdx, 1)" title="Move down">↓</button>

                        <span v-if="step.matchedDef" class="step-status valid">✓</span>
                        <span v-else class="step-status invalid">⚠️</span>
                      </div>

                      <button type="button" class="btn-sm btn-secondary add-step-btn" @click="addBackgroundStep">
                        + Add Background Step
                      </button>
                    </div>
                  </div>

                  <!-- Scenarios -->
                  <div v-for="(scenario, sIdx) in scenarios" :key="sIdx" class="scenario-block">
                    <div class="scenario-header">
                      <div class="scenario-type-toggle">
                        <label class="checkbox-label-inline">
                          <input type="checkbox" v-model="scenario.isOutline" @change="toggleScenarioOutline(sIdx)" />
                          <span>Scenario Outline</span>
                        </label>
                      </div>
                      <input v-model="scenario.name" placeholder="Scenario name" class="scenario-name-input" />
                      <button type="button" class="btn-icon btn-error" @click="removeScenario(sIdx)" title="Delete scenario">🗑️</button>
                    </div>

                    <!-- Steps -->
                    <div class="steps-list">
                      <div v-for="(step, stepIdx) in scenario.steps" :key="stepIdx" class="step-row">
                        <select v-model="step.keyword" class="keyword-select">
                          <option value="Given">Given</option>
                          <option value="When">When</option>
                          <option value="Then">Then</option>
                          <option value="And">And</option>
                          <option value="But">But</option>
                        </select>

                        <select v-model="step.stepDefId" @change="onStepDefChange(step, sIdx, stepIdx)" class="step-select">
                          <option value="">Select step...</option>
                          <!-- Show raw parsed text as hint when step has text but no match -->
                          <option v-if="step.text && !step.matchedDef" value="" disabled class="step-unmatched-hint">
                            ⚠️ {{ step.text }}
                          </option>
                          <optgroup v-for="cat in stepCategories" :key="cat.name" :label="cat.label">
                            <option v-for="s in cat.steps" :key="s.id" :value="s.id">
                              {{ s.name }}
                            </option>
                          </optgroup>
                        </select>

                        <!-- Parameter inputs for selected step -->
                        <div v-if="step.matchedDef" class="step-params-inline">
                          <input v-for="param in step.matchedDef.parameters" :key="param.name"
                            :placeholder="scenario.isOutline ? `<${param.name}>` : param.name"
                            v-model="step.paramValues[param.name]"
                            @input="updateStepText(step)"
                            class="param-input-inline" />
                        </div>

                        <button type="button" class="btn-icon" @click="removeStep(sIdx, stepIdx)" title="Remove step">✕</button>
                        <button type="button" class="btn-icon" @click="moveStep(sIdx, stepIdx, -1)" title="Move up">↑</button>
                        <button type="button" class="btn-icon" @click="moveStep(sIdx, stepIdx, 1)" title="Move down">↓</button>

                        <!-- Validation status -->
                        <span v-if="step.matchedDef" class="step-status valid">✓</span>
                        <span v-else class="step-status invalid">⚠️</span>
                      </div>

                      <button type="button" class="btn-sm btn-secondary add-step-btn" @click="addStep(sIdx)">
                        + Add Step
                      </button>
                    </div>

                    <!-- Examples Table for Scenario Outline -->
                    <div v-if="scenario.isOutline" class="examples-section">
                      <div class="examples-header">
                        <h4>Examples</h4>
                        <div class="examples-actions">
                          <input
                            v-if="scenario.examples.length > 0"
                            v-model="newColumnName[sIdx]"
                            placeholder="New column name"
                            class="column-name-input"
                            @keyup.enter="addExampleColumn(sIdx, newColumnName[sIdx]); newColumnName[sIdx] = ''"
                          />
                          <button
                            type="button"
                            class="btn-sm btn-secondary"
                            @click="addExampleColumn(sIdx, newColumnName[sIdx]); newColumnName[sIdx] = ''"
                            :disabled="!newColumnName[sIdx]?.trim()"
                          >
                            + Column
                          </button>
                          <button type="button" class="btn-sm btn-primary" @click="addExampleRow(sIdx)">
                            + Row
                          </button>
                        </div>
                      </div>

                      <div v-if="scenario.examples.length === 0" class="examples-empty">
                        <p>No examples yet. Add columns based on your step parameters, then add test data rows.</p>
                        <button type="button" class="btn-sm btn-secondary" @click="addExampleRow(sIdx)">
                          Initialize Examples Table
                        </button>
                      </div>

                      <div v-else class="examples-table-wrapper">
                        <table class="examples-table">
                          <thead>
                            <tr>
                              <th v-for="header in getExampleHeaders(scenario)" :key="header" class="examples-header-cell">
                                <div class="header-cell-content">
                                  <span>{{ header }}</span>
                                  <button
                                    type="button"
                                    class="btn-icon-small"
                                    @click="removeExampleColumn(sIdx, header)"
                                    title="Remove column"
                                  >✕</button>
                                </div>
                              </th>
                              <th class="actions-header">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(row, rowIdx) in scenario.examples" :key="rowIdx">
                              <td v-for="header in getExampleHeaders(scenario)" :key="header" class="examples-cell">
                                <input
                                  v-model="row[header]"
                                  @input="syncFromVisualToCode"
                                  class="example-cell-input"
                                  :placeholder="`Enter ${header}`"
                                />
                              </td>
                              <td class="examples-cell-actions">
                                <button
                                  type="button"
                                  class="btn-icon-small btn-error"
                                  @click="removeExampleRow(sIdx, rowIdx)"
                                  title="Remove row"
                                >🗑️</button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <button type="button" class="btn-primary" @click="addScenario">+ Add Scenario</button>
                </div>

                <!-- Code Editor: Raw Gherkin textarea -->
                <div v-else class="gherkin-editor">
                  <textarea v-model="featureForm.content" @input="onCodeEditorChange" rows="16" required
                    placeholder="Feature: Login Functionality

  Scenario: Successful login
    Given I navigate to &quot;https://example.com/login&quot;
    When I enter &quot;user@example.com&quot; into input field having id &quot;email&quot;
    And I click on element having css selector &quot;button[type='submit']&quot;
    Then the URL should contain &quot;/dashboard&quot;"></textarea>
                  <div class="gherkin-sidebar">
                    <!-- Step Builder Quick Add -->
                    <div class="step-builder">
                      <h4>Quick Add Step</h4>
                      <select v-model="selectedStepCategory" @change="filterSteps" class="step-select">
                        <option value="">All Categories</option>
                        <option value="navigation">🧭 Navigation</option>
                        <option value="input">⌨️ Input</option>
                        <option value="click">👆 Click</option>
                        <option value="assertion">✓ Assertion</option>
                        <option value="wait">⏱️ Wait</option>
                        <option value="form">📋 Form</option>
                        <option value="scroll">📜 Scroll</option>
                      </select>
                      <select v-model="selectedStepDef" class="step-select" :size="filteredStepDefs.length > 10 ? 10 : undefined">
                        <option value="">Select step...</option>
                        <option v-for="step in filteredStepDefs" :key="step.id" :value="step.id">
                          {{ stepStore.getCategoryIcon(step.category || '') }} {{ step.name }}
                        </option>
                      </select>

                      <div v-if="selectedStepDefData" class="step-params">
                        <div v-for="param in selectedStepDefData.parameters" :key="param.name" class="param-row">
                          <label>{{ param.name }}</label>
                          <input v-model="paramValues[param.name]" @input="updateStepPreview" class="param-input" />
                        </div>
                      </div>

                      <div class="step-preview-result">
                        <code>{{ stepPreviewText }}</code>
                      </div>

                      <button type="button" class="btn-sm btn-primary" @click="insertStep">
                        + Insert to Code
                      </button>
                    </div>

                    <!-- Validation Errors -->
                    <div v-if="invalidSteps.length > 0" class="validation-errors">
                      <h4>⚠️ Invalid Steps</h4>
                      <div v-for="(err, idx) in invalidSteps" :key="idx" class="error-item">{{ err }}</div>
                    </div>
                    <div v-else-if="validStepsList.length > 0" class="valid-steps">
                      <h4>✓ Valid Steps</h4>
                      <div v-for="(step, idx) in validStepsList.slice(0, 5)" :key="idx" class="valid-item">{{ step }}</div>
                    </div>

                    <!-- Quick Reference -->
                    <div class="gherkin-help">
                      <h4>Quick Reference</h4>
                      <div class="syntax-item"><code>Feature:</code><span>Feature name</span></div>
                      <div class="syntax-item"><code>Scenario:</code><span>Test scenario</span></div>
                      <div class="syntax-item"><code>Given/When/Then</code><span>Step keywords</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <div class="form-label toggle-label">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="featureForm.enabled" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span>Enabled for testing</span>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="closeFeatureModal">Cancel</button>
              <button type="submit" class="btn-primary">
                {{ editingFeature ? 'Save Changes' : 'Create Feature' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <div v-if="deletingFeature" class="modal-overlay" @click.self="deletingFeature = null">
        <div class="modal modal-small">
          <div class="modal-header">
            <h3>Delete Feature?</h3>
          </div>
          <div class="modal-body">
            <p>Are you sure you want to delete <strong>{{ deletingFeature.name }}</strong>?</p>
            <p class="warning">This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="deletingFeature = null">Cancel</button>
            <button class="btn-error" @click="deleteFeature">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, type Feature } from '../stores/projects'
import { useTestRunStore } from '../stores/testRuns'
import { useStepDefinitionStore, type StepDefinition } from '../stores/stepDefinitions'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const testRunStore = useTestRunStore()
const stepStore = useStepDefinitionStore()

const projectId = route.params.id as string
const project = computed(() => projectStore.getProject(projectId))
const features = computed(() => projectStore.getProjectFeatures(projectId))
const enabledFeatures = computed(() => features.value.filter(f => f.enabled))
const stepDefinitions = computed(() => stepStore.steps.filter(s => s.enabled))

const showFeatureModal = ref(false)
const editingFeature = ref<Feature | null>(null)
const deletingFeature = ref<Feature | null>(null)
const selectedFeatures = ref<string[]>([])
const orderedFeatures = ref<string[]>([])
const recordTestRun = ref(false)
const takeScreenshots = ref(true)
const aiGenerating = ref(false)
const aiDescription = ref('')
const dragIdx = ref<number | null>(null)

// Appium Server Status (for mobile projects)
const appiumStatus = reactive({
  connected: false,
  checking: false,
  lastChecked: null as Date | null
})

const appiumConfig = reactive({
  host: 'localhost',
  port: 4723
})

async function checkAppiumServer() {
  if (!project.value || project.value.type !== 'mobile') return

  appiumStatus.checking = true
  try {
    const response = await fetch('/api/appium/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: project.value.deviceName ? 'localhost' : appiumConfig.host,
        port: appiumConfig.port
      })
    })
    const data = await response.json()
    appiumStatus.connected = data.connected || false
    appiumStatus.lastChecked = new Date()
  } catch (e) {
    appiumStatus.connected = false
    console.error('Failed to check Appium server:', e)
  } finally {
    appiumStatus.checking = false
  }
}

// Step Builder
const selectedStepCategory = ref('')
const selectedStepDef = ref('')
const selectedStepDefData = ref<StepDefinition | null>(null)
const paramValues = ref<Record<string, string>>({})
const gherkinValid = ref(false)
const gherkinError = ref('')
const stepPreviewText = ref('')
const invalidSteps = ref<string[]>([])
const validStepsList = ref<string[]>([])
const stepMatchCount = ref(0)
const totalSteps = ref(0)

const filteredStepDefs = computed(() => {
  let steps = stepDefinitions.value
  if (selectedStepCategory.value) {
    steps = steps.filter(s => s.category === selectedStepCategory.value)
  }
  return steps
})

// Step categories for visual editor
const stepCategories = computed(() => {
  const cats = [
    { name: 'navigation', label: '🧭 Navigation' },
    { name: 'input', label: '⌨️ Input' },
    { name: 'click', label: '👆 Click' },
    { name: 'assertion', label: '✓ Assertion' },
    { name: 'wait', label: '⏱️ Wait' },
    { name: 'form', label: '📋 Form' },
    { name: 'scroll', label: '📜 Scroll' },
    { name: 'screenshot', label: '📸 Screenshot' },
    { name: 'script', label: '🔧 Script' },
    { name: 'attribute', label: '🏷️ Attribute' },
  ]
  return cats.map(cat => ({
    ...cat,
    steps: stepDefinitions.value.filter(s => s.category === cat.name)
  })).filter(c => c.steps.length > 0)
})

// Visual Editor state
const editorMode = ref<'visual' | 'code'>('visual')
const featureName = ref('')
const featureDescription = ref('')
const backgroundSteps = ref<ScenarioStep[]>([])
const newColumnName = ref<Record<number, string>>({})

interface ScenarioStep {
  keyword: 'Given' | 'When' | 'Then' | 'And' | 'But'
  stepDefId: string
  matchedDef: StepDefinition | null
  paramValues: Record<string, string>
  text: string
}

interface ExampleRow {
  [key: string]: string
}

interface Scenario {
  name: string
  isOutline: boolean
  steps: ScenarioStep[]
  examples: ExampleRow[]
}

const scenarios = ref<Scenario[]>([
  { name: 'Example scenario', isOutline: false, steps: [], examples: [] }
])

// Sync between visual and code editor
function syncFromCodeToVisual() {
  const content = featureForm.content.trim()
  if (!content) {
    scenarios.value = [{ name: 'New Scenario', isOutline: false, steps: [], examples: [] }]
    featureName.value = ''
    featureDescription.value = ''
    backgroundSteps.value = []
    return
  }

  // Parse Feature name
  const featureMatch = content.match(/^Feature:\s*(.+?)(?:\n|$)/i)
  if (featureMatch) featureName.value = featureMatch[1].trim()

  // Parse content between Feature and first Scenario/Background
  const lines = content.split('\n')
  const descLines: string[] = []
  let backgroundStartIdx = -1
  let firstScenarioIdx = -1

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/^\s*Background:/i)) {
      backgroundStartIdx = i
      break
    }
    if (line.match(/^\s*Scenario(?:\s+Outline)?:/i)) {
      firstScenarioIdx = i
      break
    }
    // Skip user story lines for description
    if (line.trim() && !line.match(/^As a|I want|So that/)) {
      descLines.push(line.trim())
    }
  }
  featureDescription.value = descLines.join('\n')

  // Parse Background steps if exists
  backgroundSteps.value = []
  if (backgroundStartIdx !== -1) {
    const bgEndIdx = firstScenarioIdx !== -1 ? firstScenarioIdx : lines.length
    for (let i = backgroundStartIdx + 1; i < bgEndIdx; i++) {
      const line = lines[i]
      const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i)
      if (stepMatch) {
        const keyword = stepMatch[1] as ScenarioStep['keyword']
        const stepText = stepMatch[2].trim()
        const matched = findMatchingStepDef(stepText)
        backgroundSteps.value.push({
          keyword,
          stepDefId: matched?.id || '',
          matchedDef: matched || null,
          paramValues: extractParamValues(stepText, matched),
          text: stepText
        })
      }
    }
  }

  // Parse scenarios (including Scenario Outline)
  const newScenarios: Scenario[] = []
  // Split by Scenario or Scenario Outline
  const scenarioBlocks = content.split(/^\s*Scenario(?:\s+Outline)?:/im)
  for (let i = 1; i < scenarioBlocks.length; i++) {
    const block = scenarioBlocks[i]
    const blockLines = block.trim().split('\n')
    const scenarioName = blockLines[0]?.trim() || `Scenario ${i}`

    // Check if this was a Scenario Outline
    const isOutline = content.match(new RegExp(`Scenario\\s+Outline:\\s*${escapeRegExp(scenarioName)}`, 'i')) !== null

    const steps: ScenarioStep[] = []
    const examples: ExampleRow[] = []
    let inExamples = false
    let exampleHeaders: string[] = []

    for (const line of blockLines.slice(1)) {
      // Check for Examples section
      if (line.match(/^\s*Examples:/i)) {
        inExamples = true
        continue
      }

      if (inExamples) {
        // Parse examples table
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('|')) {
          const cells = trimmedLine.split('|').map(c => c.trim()).filter(c => c)
          if (exampleHeaders.length === 0) {
            exampleHeaders = cells
          } else if (cells.length === exampleHeaders.length) {
            const row: ExampleRow = {}
            exampleHeaders.forEach((header, idx) => {
              row[header] = cells[idx] || ''
            })
            examples.push(row)
          }
        }
        continue
      }

      const stepMatch = line.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/i)
      if (stepMatch) {
        const keyword = stepMatch[1] as ScenarioStep['keyword']
        const stepText = stepMatch[2].trim()
        const matched = findMatchingStepDef(stepText)
        steps.push({
          keyword,
          stepDefId: matched?.id || '',
          matchedDef: matched || null,
          paramValues: extractParamValues(stepText, matched),
          text: stepText
        })
      }
    }

    newScenarios.push({ name: scenarioName, isOutline, steps, examples })
  }

  // Update scenarios - create new array reference to trigger reactivity
  scenarios.value = newScenarios.length > 0 ? newScenarios : [{ name: 'New Scenario', isOutline: false, steps: [], examples: [] }]
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function syncFromVisualToCode() {
  let content = `Feature: ${featureName.value || 'New Feature'}\n`

  if (featureDescription.value) {
    content += `\n${featureDescription.value}\n`
  }

  // Add Background section if has steps
  if (backgroundSteps.value.length > 0) {
    content += `\n  Background:\n`
    for (const step of backgroundSteps.value) {
      content += `    ${step.keyword} ${step.text}\n`
    }
  }

  for (const scenario of scenarios.value) {
    if (scenario.isOutline) {
      content += `\n  Scenario Outline: ${scenario.name}\n`
    } else {
      content += `\n  Scenario: ${scenario.name}\n`
    }
    for (const step of scenario.steps) {
      content += `    ${step.keyword} ${step.text}\n`
    }

    // Add Examples table for Scenario Outline
    if (scenario.isOutline && scenario.examples.length > 0) {
      const headers = Object.keys(scenario.examples[0])
      content += `\n    Examples:\n`
      content += `      | ${headers.join(' | ')} |\n`
      for (const row of scenario.examples) {
        content += `      | ${headers.map(h => row[h]).join(' | ')} |\n`
      }
    }
  }

  featureForm.content = content
  validateGherkin()
}

function findMatchingStepDef(stepText: string): StepDefinition | null {
  // Normalise: strip surrounding quotes from the full step text for matching
  for (const stepDef of stepDefinitions.value) {
    let pattern = stepDef.gherkinPattern
    // Escape regex specials (but not our {param} placeholders)
    pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Replace \{param\} with a group that matches: "value", 'value', <value>, or bare word(s)
    pattern = pattern.replace(/\\{([^}]+)\\}/g, '(?:"([^"]*)"|\u0027([^\u0027]*)\u0027|<([^>]*)>|([\\S]+(?:\\s+[\\S]+)*))')
    try {
      if (new RegExp(`^${pattern}$`, 'i').test(stepText)) {
        return stepDef
      }
    } catch { /* invalid regex, skip */ }
  }
  return null
}

function extractParamValues(stepText: string, stepDef: StepDefinition | null): Record<string, string> {
  if (!stepDef || !stepDef.parameters) return {}

  const values: Record<string, string> = {}
  let pattern = stepDef.gherkinPattern
  const regexStrs: string[] = []

  // Escape regex specials first
  pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

  for (const param of stepDef.parameters) {
    pattern = pattern.replace(`\\{${param.name}\\}`, '(.*?)')
    regexStrs.push(param.name)
  }

  try {
    const regex = new RegExp(`^${pattern}$`, 'i')
    const match = stepText.match(regex)
    if (match) {
      for (let i = 0; i < regexStrs.length; i++) {
        values[regexStrs[i]] = match[i + 1] || ''
      }
    }
  } catch {}

  return values
}

// Visual editor actions
function addScenario() {
  scenarios.value.push({ name: 'New Scenario', isOutline: false, steps: [], examples: [] })
  syncFromVisualToCode()
}

function toggleScenarioOutline(scenarioIdx: number) {
  const scenario = scenarios.value[scenarioIdx]
  scenario.isOutline = !scenario.isOutline
  if (scenario.isOutline && scenario.examples.length === 0) {
    // Initialize with example headers from step parameters
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    if (headers.size > 0) {
      const emptyRow: ExampleRow = {}
      headers.forEach(h => emptyRow[h] = '')
      scenario.examples = [emptyRow]
    }
  }
  syncFromVisualToCode()
}

function removeScenario(idx: number) {
  scenarios.value.splice(idx, 1)
  syncFromVisualToCode()
}

// Background steps functions
function addBackgroundStep() {
  backgroundSteps.value.push({
    keyword: 'Given',
    stepDefId: '',
    matchedDef: null,
    paramValues: {},
    text: ''
  })
  syncFromVisualToCode()
}

function removeBackgroundStep(stepIdx: number) {
  backgroundSteps.value.splice(stepIdx, 1)
  syncFromVisualToCode()
}

function moveBackgroundStep(stepIdx: number, direction: number) {
  const steps = backgroundSteps.value
  const newIdx = stepIdx + direction
  if (newIdx >= 0 && newIdx < steps.length) {
    const [removed] = steps.splice(stepIdx, 1)
    steps.splice(newIdx, 0, removed)
    syncFromVisualToCode()
  }
}

function onBackgroundStepDefChange(step: ScenarioStep, stepIdx: number) {
  step.matchedDef = stepDefinitions.value.find(s => s.id === step.stepDefId) || null
  if (step.matchedDef) {
    step.paramValues = {}
    if (step.matchedDef.parameters) {
      for (const param of step.matchedDef.parameters) {
        step.paramValues[param.name] = param.default || ''
      }
    }
    updateBackgroundStepText(step)
    syncFromVisualToCode()
  }
}

function updateBackgroundStepText(step: ScenarioStep) {
  if (!step.matchedDef) {
    step.text = ''
    return
  }

  let text = step.matchedDef.gherkinPattern
  if (step.matchedDef.parameters) {
    for (const param of step.matchedDef.parameters) {
      const value = step.paramValues[param.name] || param.default || `<${param.name}>`
      text = text.split(`{${param.name}}`).join(value)
    }
  }
  step.text = text
  syncFromVisualToCode()
}

function addStep(scenarioIdx: number) {
  scenarios.value[scenarioIdx].steps.push({
    keyword: 'When',
    stepDefId: '',
    matchedDef: null,
    paramValues: {},
    text: ''
  })

  // Update examples table headers if scenario is outline
  const scenario = scenarios.value[scenarioIdx]
  if (scenario.isOutline) {
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    // Update existing examples rows to include new columns
    if (scenario.examples.length > 0) {
      for (const row of scenario.examples) {
        headers.forEach(h => {
          if (!(h in row)) {
            row[h] = ''
          }
        })
      }
    }
  }

  syncFromVisualToCode()
}

function removeStep(scenarioIdx: number, stepIdx: number) {
  scenarios.value[scenarioIdx].steps.splice(stepIdx, 1)
  syncFromVisualToCode()
}

function moveStep(scenarioIdx: number, stepIdx: number, direction: number) {
  const steps = scenarios.value[scenarioIdx].steps
  const newIdx = stepIdx + direction
  if (newIdx >= 0 && newIdx < steps.length) {
    const [removed] = steps.splice(stepIdx, 1)
    steps.splice(newIdx, 0, removed)
    syncFromVisualToCode()
  }
}

function onStepDefChange(step: ScenarioStep, scenarioIdx: number, _stepIdx: number) {
  step.matchedDef = stepDefinitions.value.find(s => s.id === step.stepDefId) || null
  if (step.matchedDef) {
    // Initialize param values with defaults
    step.paramValues = {}
    if (step.matchedDef.parameters) {
      for (const param of step.matchedDef.parameters) {
        step.paramValues[param.name] = param.default || ''
      }

      // Update examples table if scenario is outline
      const scenario = scenarios.value[scenarioIdx]
      if (scenario.isOutline) {
        for (const row of scenario.examples) {
          for (const param of step.matchedDef!.parameters) {
            if (!(param.name in row)) {
              row[param.name] = ''
            }
          }
        }
      }
    }
    updateStepText(step)
    syncFromVisualToCode()
  }
}

function updateStepText(step: ScenarioStep) {
  if (!step.matchedDef) {
    step.text = ''
    return
  }

  let text = step.matchedDef.gherkinPattern
  if (step.matchedDef.parameters) {
    for (const param of step.matchedDef.parameters) {
      const value = step.paramValues[param.name] || param.default || `<${param.name}>`
      text = text.split(`{${param.name}}`).join(value)
    }
  }
  step.text = text
  syncFromVisualToCode()
}

function addExampleRow(scenarioIdx: number) {
  const scenario = scenarios.value[scenarioIdx]
  if (scenario.examples.length === 0) {
    // Get headers from step parameters
    const headers = new Set<string>()
    for (const step of scenario.steps) {
      if (step.matchedDef?.parameters) {
        for (const param of step.matchedDef.parameters) {
          headers.add(param.name)
        }
      }
    }
    const emptyRow: ExampleRow = {}
    headers.forEach(h => emptyRow[h] = '')
    scenario.examples.push(emptyRow)
  } else {
    // Clone the last row or create empty from headers
    const headers = Object.keys(scenario.examples[0])
    const newRow: ExampleRow = {}
    headers.forEach(h => newRow[h] = '')
    scenario.examples.push(newRow)
  }
  syncFromVisualToCode()
}

function removeExampleRow(scenarioIdx: number, rowIdx: number) {
  scenarios.value[scenarioIdx].examples.splice(rowIdx, 1)
  syncFromVisualToCode()
}

function getExampleHeaders(scenario: Scenario): string[] {
  if (scenario.examples.length === 0) return []
  return Object.keys(scenario.examples[0])
}

function addExampleColumn(scenarioIdx: number, columnName: string) {
  const scenario = scenarios.value[scenarioIdx]
  for (const row of scenario.examples) {
    row[columnName] = ''
  }
  syncFromVisualToCode()
}

function removeExampleColumn(scenarioIdx: number, columnName: string) {
  const scenario = scenarios.value[scenarioIdx]
  for (const row of scenario.examples) {
    delete row[columnName]
  }
  syncFromVisualToCode()
}

function onCodeEditorChange() {
  if (editorMode.value === 'code') {
    syncFromCodeToVisual()
  }
}

// Watch for editor mode changes
watch(editorMode, (newMode) => {
  if (newMode === 'visual') {
    syncFromCodeToVisual()
  }
})

// When opening modal, parse content
watch(() => showFeatureModal.value, async (isOpen) => {
  if (isOpen && editorMode.value === 'visual') {
    // Wait a bit for everything to settle
    await nextTick()
    // Ensure step definitions are available
    if (stepDefinitions.value.length === 0) {
      await stepStore.fetchStepDefinitions(projectId)
    }
    await nextTick()
    syncFromCodeToVisual()
  }
})

// Re-sync when step definitions change (in case they were loaded after initial sync)
watch(stepDefinitions, (newDefs) => {
  if (showFeatureModal.value && editorMode.value === 'visual' && newDefs.length > 0) {
    syncFromCodeToVisual()
  }
})

const defaultGherkin = `Feature: New Feature
  As a user
  I want to perform an action
  So that I can achieve a goal

  Scenario: Example scenario
    Given I am on the page
    When I perform an action
    Then I should see the expected result`

const featureForm = reactive({
  name: '',
  framework: 'playwright' as 'playwright' | 'wdio',
  description: '',
  content: defaultGherkin,
  enabled: true
})

async function openFeatureModal() {
  editingFeature.value = null
  resetFeatureForm()
  // Auto-seed step library if empty
  if (stepDefinitions.value.length === 0) {
    try {
      await stepStore.importFromLibrary(projectId, 'playwright')
    } catch { /* silently ignore if already imported */ }
  }
  showFeatureModal.value = true
}

function closeFeatureModal() {
  showFeatureModal.value = false
  editingFeature.value = null
  aiDescription.value = ''
  resetFeatureForm()
}

async function editFeature(feature: Feature) {
  editingFeature.value = feature
  Object.assign(featureForm, {
    name: feature.name,
    framework: feature.framework,
    description: feature.description || '',
    content: feature.content,
    enabled: !!feature.enabled
  })
  // Ensure step definitions are loaded FIRST
  await stepStore.fetchStepDefinitions(projectId)
  // Auto-seed if still empty
  if (stepStore.steps.length === 0) {
    try {
      await stepStore.importFromLibrary(projectId, 'playwright')
      // Fetch again after import to ensure we have the steps
      await stepStore.fetchStepDefinitions(projectId)
    } catch { /* ignore */ }
  }
  // Open modal - watch will handle sync
  showFeatureModal.value = true
}

function confirmDeleteFeature(feature: Feature) {
  deletingFeature.value = feature
}

async function saveFeature() {
  // Sync from visual editor if in visual mode
  if (editorMode.value === 'visual') {
    syncFromVisualToCode()
  }
  const data = { ...featureForm, projectId, enabled: featureForm.enabled ? 1 : 0 }
  if (editingFeature.value) {
    await projectStore.updateFeature(editingFeature.value.id, data)
  } else {
    await projectStore.createFeature(data)
  }
  closeFeatureModal()
  await projectStore.fetchFeatures(projectId)
}

async function deleteFeature() {
  if (deletingFeature.value) {
    await projectStore.deleteFeature(deletingFeature.value.id)
    deletingFeature.value = null
    await projectStore.fetchFeatures(projectId)
  }
}

function resetFeatureForm() {
  Object.assign(featureForm, {
    name: '',
    framework: 'playwright',
    description: '',
    content: defaultGherkin,
    enabled: true
  })
}

function getScenarioCount(content: string): number {
  const matches = content.match(/^\s*Scenario:/gim)
  return matches ? matches.length : 0
}

function getStepCount(content: string): number {
  const matches = content.match(/^\s*(Given|When|Then|And|But)\s/gim)
  return matches ? matches.length : 0
}

function getPreview(content: string): string {
  const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
  return lines.slice(0, 4).join('\n') + (lines.length > 4 ? '\n...' : '')
}

async function runTests() {
  // Use selected features in their current order
  const featuresToRun = orderedFeatures.value.filter(id => selectedFeatures.value.includes(id))
  const run = await testRunStore.createTestRun(projectId, featuresToRun, {
    recordTestRun: recordTestRun.value,
    takeScreenshots: takeScreenshots.value
  })
  await testRunStore.runTest(run.id)
  router.push(`/test-runs/${run.id}`)
}

function getFeatureById(id: string) {
  return features.value.find(f => f.id === id)
}

function onDragStart(idx: number) {
  dragIdx.value = idx
}

function onDrop(idx: number) {
  if (dragIdx.value === null || dragIdx.value === idx) return
  const item = orderedFeatures.value.splice(dragIdx.value, 1)[0]
  orderedFeatures.value.splice(idx, 0, item)
  dragIdx.value = null
}

async function generateWithAI() {
  if (!aiDescription.value.trim()) return

  aiGenerating.value = true
  try {
    const res = await fetch('/api/ai/gherkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: aiDescription.value,
        framework: featureForm.framework
      })
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to generate')
    }

    const data = await res.json()
    featureForm.content = data.content

    // Auto-fill name from generated content if empty
    if (!featureForm.name) {
      const match = data.content.match(/Feature:\s*(.+?)(?:\n|$)/i)
      if (match) featureForm.name = match[1].trim()
    }
  } catch (err: any) {
    alert('AI Generation failed: ' + err.message)
  } finally {
    aiGenerating.value = false
  }
}

// Step Builder functions
function filterSteps() {
  selectedStepDef.value = ''
  selectedStepDefData.value = null
  paramValues.value = {}
}

watch(selectedStepDef, (newId) => {
  if (newId) {
    selectedStepDefData.value = stepDefinitions.value.find(s => s.id === newId) || null
    paramValues.value = {}
    // Set default values
    if (selectedStepDefData.value?.parameters) {
      for (const param of selectedStepDefData.value.parameters) {
        paramValues.value[param.name] = param.default || ''
      }
    }
  }
})

function insertStep() {
  if (!selectedStepDefData.value) return

  const step = selectedStepDefData.value
  let stepText = step.gherkinPattern

  // Replace parameters with values
  if (step.parameters) {
    for (const param of step.parameters) {
      const value = paramValues.value[param.name] || param.default || `{${param.name}}`
      stepText = stepText.split(`{${param.name}}`).join(value)
    }
  }

  // Determine keyword (default to And if there's already content)
  const hasContent = featureForm.content.trim().length > 0
  const keyword = hasContent ? '  And' : '  When'

  featureForm.content += `\n${keyword} ${stepText}`
  validateGherkin()

  // Reset selection
  selectedStepDef.value = ''
  selectedStepDefData.value = null
  paramValues.value = {}
}

function updateStepPreview() {
  if (!selectedStepDefData.value) {
    stepPreviewText.value = ''
    return
  }

  const step = selectedStepDefData.value
  let preview = step.gherkinPattern

  // Replace parameters with values
  if (step.parameters) {
    for (const param of step.parameters) {
      const value = paramValues.value[param.name] || param.default || `{${param.name}}`
      preview = preview.split(`{${param.name}}`).join(value)
    }
  }

  stepPreviewText.value = `  When ${preview}`
}

watch(selectedStepDef, (newId) => {
  if (newId) {
    selectedStepDefData.value = stepDefinitions.value.find(s => s.id === newId) || null
    paramValues.value = {}
    // Set default values
    if (selectedStepDefData.value?.parameters) {
      for (const param of selectedStepDefData.value.parameters) {
        paramValues.value[param.name] = param.default || ''
      }
    }
    updateStepPreview()
  }
})

function validateGherkin() {
  const content = featureForm.content.trim()
  gherkinError.value = ''
  gherkinValid.value = false
  invalidSteps.value = []
  validStepsList.value = []
  stepMatchCount.value = 0
  totalSteps.value = 0

  if (!content) {
    return
  }

  const errors: string[] = []

  // Check for Feature keyword
  if (!content.match(/^Feature:\s+/m)) {
    errors.push('Missing "Feature:" keyword')
  }

  // Check for Scenario keyword
  if (!content.match(/^\s*Scenario:\s+/m)) {
    errors.push('Missing "Scenario:" keyword')
  }

  // Extract and validate each step
  const stepLines = content.match(/^\s*(Given|When|Then|And|But)\s+(.+)$/gm)
  if (stepLines) {
    totalSteps.value = stepLines.length

    for (const line of stepLines) {
      const stepText = line.replace(/^\s*(Given|When|Then|And|But)\s+/, '')
      let matched = false

      // Check against step definitions from database
      for (const stepDef of stepDefinitions.value) {
        // Convert gherkin pattern to regex
        // e.g., "I enter {value} into input field having id {id}"
        // becomes /^I enter (.+) into input field having id (.+)$/
        let pattern = stepDef.gherkinPattern

        // Escape special regex characters except for our placeholders
        pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

        // Replace {param} with capture group
        pattern = pattern.replace(/\\{([^}]+)\\}/g, '(.+?)')

        // Allow quotes (single or double) around parameters
        pattern = pattern.replace(/\\(\\.\\+\\?\\)/g, '("([^"]*)"|\'([^\']*)\'|[^\\s]+)')

        try {
          if (new RegExp(`^${pattern}$`, 'i').test(stepText)) {
            matched = true
            stepMatchCount.value++
            validStepsList.value.push(stepText)
            break
          }
        } catch (e) {
          // Invalid regex, skip
        }
      }

      if (!matched) {
        invalidSteps.value.push(`Step not in library: "${stepText}"`)
      }
    }
  }

  // Check for proper indentation
  const lines = content.split('\n')
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/^(Given|When|Then|And|But)/)) {
      if (!line.match(/^s/)) {
        errors.push('Step keywords need indentation')
        break
      }
    }
  }

  if (errors.length > 0) {
    gherkinError.value = errors[0]
  } else if (invalidSteps.value.length === 0) {
    gherkinValid.value = true
  }
}

onMounted(() => {
  projectStore.fetchFeatures(projectId)
  testRunStore.fetchTestRuns(projectId)
  stepStore.fetchStepDefinitions(projectId)
  // Initialize ordered features with enabled feature IDs
  orderedFeatures.value = enabledFeatures.value.map(f => f.id)
})

// Update orderedFeatures when features change
watch(enabledFeatures, (newFeatures) => {
  const currentIds = new Set(orderedFeatures.value)
  const newIds = newFeatures.map(f => f.id)
  // Add new features
  for (const id of newIds) {
    if (!currentIds.has(id)) {
      orderedFeatures.value.push(id)
    }
  }
  // Remove deleted features
  orderedFeatures.value = orderedFeatures.value.filter(id => newIds.includes(id))
}, { deep: true })
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.header h2 {
  margin: 0.5rem 0 0 0;
  font-size: 1.5rem;
}

.features-section,
.run-section,
.appium-status-section {
  margin-bottom: 2.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.count {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s;
}

.feature-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.feature-card-header {
  padding: 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.feature-title h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
}

.feature-title p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.feature-badges {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
}

.badge-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.feature-card-body {
  padding: 1.25rem;
}

.feature-stats {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-icon {
  font-size: 1rem;
}

.feature-preview {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.75rem;
  overflow: hidden;
}

.feature-preview pre {
  margin: 0;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  line-height: 1.5;
}

.feature-card-footer {
  padding: 1rem 1.25rem;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  display: flex;
  gap: 0.75rem;
}

.feature-card-footer button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  color: var(--text-secondary);
}

.run-section h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
}

.run-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.help-text {
  margin: 0 0 1rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.feature-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.feature-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.feature-checkbox:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.feature-checkbox input[type="checkbox"] {
  display: none;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

.checkbox-check {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.feature-checkbox input:checked + .checkbox-check {
  background: var(--accent);
  border-color: var(--accent);
}

.feature-checkbox input:checked + .checkbox-check::after {
  content: '✓';
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
}

.checkbox-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.checkbox-name {
  font-weight: 500;
}

.checkbox-meta {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.run-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: var(--text-secondary);
  font-size: 0.875rem;
  letter-spacing: -2px;
  padding: 0 0.25rem;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.feature-checkbox[draggable="true"] {
  cursor: move;
}

.feature-checkbox .checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  cursor: pointer;
}

/* Options checkboxes */
.run-options {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.option-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
}

.option-checkbox input[type="checkbox"] {
  display: none;
}

.option-check {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.option-checkbox input:checked + .option-check {
  background: var(--accent);
  border-color: var(--accent);
}

.option-checkbox input:checked + .option-check::after {
  content: '✓';
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
}

.run-summary {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.btn-large {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.modal form {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  min-height: 0;
}

.modal-small {
  max-width: 400px;
}

.modal-large {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--text-secondary);
  padding: 0.25rem;
  width: auto;
}

.btn-icon:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.modal-body p {
  margin-bottom: 1rem;
}

.warning {
  color: var(--error);
  font-size: 0.875rem;
}

.gherkin-editor {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 1rem;
}

.gherkin-editor textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.6;
  resize: vertical;
}

.gherkin-help {
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.875rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.gherkin-help h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
}

.syntax-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.syntax-item code {
  background: var(--bg-secondary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.75rem;
}

.form-group label.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.form-group input[type="checkbox"] {
  width: auto;
}

/* AI Generator */
.ai-generator {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.ai-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.ai-header .form-label {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.ai-generator textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  resize: vertical;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.step-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.step-card:hover {
  border-color: var(--accent);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border);
}

.step-icon {
  font-size: 1.25rem;
}

.step-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.step-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.step-actions {
  display: flex;
  gap: 0.25rem;
}

.step-body {
  padding: 0.75rem 1rem;
}

.gherkin-pattern {
  display: block;
  background: var(--bg-tertiary);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
  color: var(--accent);
  margin-bottom: 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.function {
  font-family: monospace;
  background: var(--bg-tertiary);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

/* Parameters Editor */
.params-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-row {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr auto;
  gap: 0.5rem;
  align-items: center;
}

.param-row input,
.param-row select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  font-size: 0.875rem;
}

/* Badge colors */
.badge-purple { background: #8b5cf6; color: white; }
.badge-orange { background: #f97316; color: white; }
.badge-teal { background: #14b8a6; color: white; }
.badge-dark { background: #374151; color: white; }
.badge-pink { background: #ec4899; color: white; }
.badge-primary { background: #3b82f6; color: white; }

/* Gherkin Sidebar */
.gherkin-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Step Builder */
.step-builder {
  background: var(--bg-tertiary);
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.step-builder h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* .step-select is defined in the Steps List section below */

.step-params {
  margin: 0.5rem 0;
}

.param-label {
  display: block;
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.param-input {
  width: 100%;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-primary);
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

/* Validation messages */
.error-text {
  color: var(--error);
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.success-text {
  color: #10b981;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

/* Modal XL - Extra Large */
.modal-xl {
  max-width: 1200px;
  width: 95%;
}

/* Step Builder Section */
.step-builder-section {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.step-builder-controls {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.step-builder-controls .step-select {
  flex: 1;
}

/* Selected Step Card */
.selected-step-card {
  background: var(--bg-secondary);
  border: 1px solid var(--accent);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-top: 1rem;
}

.step-pattern-preview {
  margin-bottom: 0.5rem;
}

.step-pattern-preview code {
  display: block;
  background: var(--bg-tertiary);
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  margin-top: 0.25rem;
}

.step-desc {
  color: var(--text-secondary);
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.step-params-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.param-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.param-field label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.step-preview-result {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.step-preview-result strong {
  display: block;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.preview-code {
  display: block;
  color: var(--accent);
  font-family: monospace;
  font-size: 0.85rem;
}

/* Validation Errors */
.validation-errors {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 1rem;
}

.validation-errors h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: var(--error);
}

.error-item {
  font-size: 0.7rem;
  color: var(--error);
  padding: 0.25rem 0;
  word-break: break-word;
}

/* Valid Steps */
.valid-steps {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.valid-steps h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: #10b981;
}

.valid-item {
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 0.15rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-count {
  font-size: 0.7rem;
  color: var(--text-secondary);
  padding: 0.25rem 0;
}

/* Editor Toggle */
.editor-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 0.375rem 0.375rem 0 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-weight: 500;
}

.tab-btn:hover:not(.active) {
  background: var(--bg-tertiary);
}

/* Visual Editor */
.visual-editor {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.feature-header-edit {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.feature-header-edit label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.feature-name-input,
.feature-desc-input {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg-primary);
  font-size: 0.875rem;
}

.feature-desc-input {
  resize: vertical;
}

/* Background Block */
.background-block {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.background-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.background-header h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
}

.background-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Scenario Block */
.scenario-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.scenario-header {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.scenario-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  font-size: 1rem;
  font-weight: 500;
}

/* Steps List */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.step-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  flex-wrap: wrap;
  transition: all 0.2s;
}

.step-row:hover {
  border-color: var(--accent);
  background: var(--bg-secondary);
}

.keyword-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-primary);
  font-size: 0.8rem;
  font-weight: 500;
  min-width: 70px;
}

.step-select {
  flex: 1;
  min-width: 200px;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-primary);
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}

/* Make select options scrollable by using size attribute for large lists */
.step-select[size] {
  height: auto;
}

.step-params-inline {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.param-input-inline {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.375rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
  font-size: 0.85rem;
  min-width: 120px;
  font-family: monospace;
  font-weight: 500;
  color: var(--text-primary);
}

.param-input-inline::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.step-status {
  font-size: 0.875rem;
  width: 20px;
  text-align: center;
}

.step-status.valid {
  color: #10b981;
}

.step-status.invalid {
  color: var(--error);
}

.add-step-btn {
  margin-top: 0.5rem;
}

/* Scenario Type Toggle */
.scenario-type-toggle {
  display: flex;
  align-items: center;
}

.checkbox-label-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.checkbox-label-inline input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Examples Section */
.examples-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.examples-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.examples-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.examples-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.column-name-input {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-primary);
  font-size: 0.8rem;
  min-width: 120px;
}

.examples-empty {
  text-align: center;
  padding: 1.5rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  color: var(--text-secondary);
}

.examples-empty p {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
}

.examples-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}

.examples-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.examples-header-cell {
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 0;
  font-weight: 600;
}

.examples-header-cell:last-child {
  border-right: none;
}

.header-cell-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  gap: 0.5rem;
}

.actions-header {
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  padding: 0.5rem;
  font-weight: 600;
  width: 60px;
  text-align: center;
}

.examples-cell {
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 0;
}

.examples-cell:last-child {
  border-right: none;
}

.example-cell-input {
  width: 100%;
  padding: 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-family: inherit;
}

.example-cell-input:focus {
  outline: none;
  background: var(--bg-tertiary);
}

.examples-cell-actions {
  border-bottom: 1px solid var(--border);
  padding: 0.5rem;
  text-align: center;
  width: 60px;
}

.btn-icon-small {
  background: none;
  border: none;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 0.25rem;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.btn-icon-small:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-icon-small.btn-error:hover {
  background: rgba(239, 68, 68, 0.2);
  color: var(--error);
}

/* Step builder param rows use column layout */
.step-builder .param-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.step-builder .param-row label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Appium Server Status */
.appium-status-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.status-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-connected {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-disconnected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.appium-config {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.config-label {
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.config-value {
  font-family: monospace;
  color: var(--text-primary);
}

.appium-warning {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.appium-warning p {
  margin: 0;
  color: var(--text-primary);
}

.appium-success {
  padding: 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 0.5rem;
}

.appium-success p {
  margin: 0;
  color: #10b981;
}
</style>
