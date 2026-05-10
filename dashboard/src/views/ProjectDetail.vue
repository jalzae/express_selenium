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
        <p class="help-text">Select features to run in this test suite:</p>
        <div class="feature-selector">
          <label v-for="feature in enabledFeatures" :key="feature.id" class="feature-checkbox">
            <input type="checkbox" :value="feature.id" v-model="selectedFeatures" />
            <span class="checkbox-check"></span>
            <div class="checkbox-content">
              <span class="checkbox-name">{{ feature.name }}</span>
              <span class="checkbox-meta">{{ getScenarioCount(feature.content) }} scenarios · {{ feature.framework }}</span>
            </div>
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
        <div class="modal modal-large">
          <div class="modal-header">
            <h3>{{ editingFeature ? 'Edit Feature' : 'New Feature' }}</h3>
            <button class="btn-icon" @click="closeFeatureModal">✕</button>
          </div>
          <form @submit.prevent="saveFeature">
            <div class="modal-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Feature Name *</label>
                  <input v-model="featureForm.name" required placeholder="e.g., User Login" />
                </div>
                <div class="form-group">
                  <label class="form-label">Framework *</label>
                  <select v-model="featureForm.framework" required>
                    <option value="playwright">🌐 Playwright (Web)</option>
                    <option value="wdio">📱 WDIO/Appium (Mobile)</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <input v-model="featureForm.description" placeholder="Brief description of what this feature tests..." />
              </div>

              <!-- AI Generator -->
              <div class="ai-generator">
                <div class="ai-header">
                  <label class="form-label">
                    <span>✨</span> AI Generate Gherkin
                  </label>
                  <button type="button" class="btn-sm btn-primary" @click="generateWithAI" :disabled="aiGenerating || !aiDescription.trim()">
                    {{ aiGenerating ? 'Generating...' : 'Generate' }}
                  </button>
                </div>
                <textarea
                  v-model="aiDescription"
                  rows="3"
                  placeholder="Describe your test in plain language...

Example: I want to test the login functionality. User should be able to login with valid credentials and see error with invalid ones. Also test forgot password link."
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">Gherkin Feature *</label>
                <div class="gherkin-editor">
                  <textarea v-model="featureForm.content" rows="14" required
                    placeholder="Feature: Login Functionality

  Scenario: Successful login
    Given user is on login page
    When user enters valid credentials
    And clicks login button
    Then user should be redirected to dashboard"></textarea>
                  <div class="gherkin-help">
                    <h4>Gherkin Syntax</h4>
                    <div class="syntax-item">
                      <code>Feature:</code>
                      <span>Feature description</span>
                    </div>
                    <div class="syntax-item">
                      <code>Scenario:</code>
                      <span>Test scenario name</span>
                    </div>
                    <div class="syntax-item">
                      <code>Given</code>
                      <span>Initial context</span>
                    </div>
                    <div class="syntax-item">
                      <code>When</code>
                      <span>Action performed</span>
                    </div>
                    <div class="syntax-item">
                      <code>Then</code>
                      <span>Expected outcome</span>
                    </div>
                    <div class="syntax-item">
                      <code>And/But</code>
                      <span>Additional steps</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="featureForm.enabled" />
                    <span class="toggle-slider"></span>
                  </label>
                  <span>Enabled for testing</span>
                </label>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore, type Feature } from '../stores/projects'
import { useTestRunStore } from '../stores/testRuns'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const testRunStore = useTestRunStore()

const projectId = route.params.id as string
const project = computed(() => projectStore.getProject(projectId))
const features = computed(() => projectStore.getProjectFeatures(projectId))
const enabledFeatures = computed(() => features.value.filter(f => f.enabled))

const showFeatureModal = ref(false)
const editingFeature = ref<Feature | null>(null)
const deletingFeature = ref<Feature | null>(null)
const selectedFeatures = ref<string[]>([])
const aiGenerating = ref(false)
const aiDescription = ref('')

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

function openFeatureModal() {
  editingFeature.value = null
  resetFeatureForm()
  showFeatureModal.value = true
}

function closeFeatureModal() {
  showFeatureModal.value = false
  editingFeature.value = null
  aiDescription.value = ''
  resetFeatureForm()
}

function editFeature(feature: Feature) {
  editingFeature.value = feature
  Object.assign(featureForm, {
    name: feature.name,
    framework: feature.framework,
    description: feature.description || '',
    content: feature.content,
    enabled: !!feature.enabled
  })
  showFeatureModal.value = true
}

function confirmDeleteFeature(feature: Feature) {
  deletingFeature.value = feature
}

async function saveFeature() {
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
  const run = await testRunStore.createTestRun(projectId, selectedFeatures.value)
  await testRunStore.runTest(run.id)
  router.push(`/test-runs/${run.id}`)
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

onMounted(() => {
  projectStore.fetchFeatures(projectId)
  testRunStore.fetchTestRuns(projectId)
})
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
.run-section {
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
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.feature-checkbox:hover {
  border-color: var(--accent);
}

.feature-checkbox input[type="checkbox"] {
  display: none;
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
</style>
