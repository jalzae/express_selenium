<template>
  <div class="container">
    <div class="header">
      <button class="btn-sm btn-secondary" @click="$router.back()">← Back</button>
      <div>
        <span class="badge" :class="testRunStore.getStatusBadge(run?.status || 'pending')">
          {{ run?.status }}
        </span>
        <h2>Test Run Details</h2>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading"></div>
      <p>Loading...</p>
    </div>

    <div v-else-if="run">
      <!-- Info Section -->
      <div class="info-section">
        <div class="card">
          <h3>Information</h3>
          <div class="info-grid">
            <div>
              <label>Project</label>
              <p>{{ run.projectName }}</p>
            </div>
            <div>
              <label>Type</label>
              <p>
                <span class="badge" :class="run.projectType === 'web' ? 'badge-info' : 'badge-warning'">
                  {{ run.projectType }}
                </span>
              </p>
            </div>
            <div>
              <label>Started</label>
              <p>{{ formatDate(run.startedAt) }}</p>
            </div>
            <div>
              <label>Completed</label>
              <p>{{ run.completedAt ? formatDate(run.completedAt) : 'Running...' }}</p>
            </div>
          </div>
          <div v-if="run.status === 'running'" class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="actions-section" v-if="run.status === 'running'">
        <button class="btn-error" @click="stopTest">Stop Test</button>
        <button class="btn-secondary" @click="refresh">Refresh</button>
      </div>

      <!-- Error -->
      <div v-if="run.errorMessage" class="error-section">
        <div class="card" style="border-color: var(--error);">
          <h3>Error</h3>
          <pre>{{ run.errorMessage }}</pre>
        </div>
      </div>

      <!-- Results -->
      <div v-if="run.status !== 'pending' && run.status !== 'running'" class="results-section">
        <h3>Test Results</h3>
        
        <div v-if="parsedResults?.cucumberResults?.length" class="cucumber-report">
          <div v-for="feature in parsedResults.cucumberResults" :key="feature.id" class="feature-card">
            <div class="feature-header">
              <span class="feature-keyword">{{ feature.keyword }}:</span> {{ feature.name }}
            </div>
            
            <div class="scenarios">
              <div v-for="scenario in feature.elements" :key="scenario.id" class="scenario-block">
                <div class="scenario-header">
                  <span class="scenario-keyword">{{ scenario.keyword }}:</span> {{ scenario.name }}
                </div>
                
                <div class="steps">
                  <div v-for="(step, idx) in scenario.steps" :key="idx" v-show="!step.hidden" class="step-row">
                    <div class="step-content">
                      <span class="step-status" :class="`status-${step.result?.status}`" :title="step.result?.status">
                        <span v-if="step.result?.status === 'passed'">✅</span>
                        <span v-else-if="step.result?.status === 'failed'">❌</span>
                        <span v-else-if="step.result?.status === 'undefined'">⚠️</span>
                        <span v-else-if="step.result?.status === 'skipped'">⏭️</span>
                        <span v-else>❓</span>
                      </span>
                      <span class="step-keyword">{{ step.keyword }}</span>
                      <span class="step-name">{{ step.name }}</span>
                      <span v-if="step.result?.duration" class="step-duration">
                        ({{ Math.round(step.result.duration / 1000000) }}ms)
                      </span>
                    </div>
                    <div v-if="step.result?.error_message" class="step-error">
                      <pre>{{ step.result.error_message }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="run.resultJson" class="results-json">
          <pre>{{ formatResults(run.resultJson) }}</pre>
        </div>
      </div>

      <!-- Artifacts -->
      <div v-if="run.recordingPath || run.screenshotPaths" class="artifacts-section">
        <h3>Artifacts</h3>
        <div class="artifacts-grid">
          <a v-for="rec in recordings" :key="rec" :href="`/recordings/${rec}`" target="_blank" class="artifact-card">
            <div class="artifact-icon">🎥</div>
            <div class="artifact-name" :title="rec">{{ rec }}</div>
          </a>
          <a v-for="shot in screenshots" :key="shot" :href="`/screenshots/${shot}`" target="_blank" class="artifact-card">
            <img :src="`/screenshots/${shot}`" class="artifact-thumbnail" alt="Screenshot artifact preview" />
            <div class="artifact-name" :title="shot.split('/').pop()">{{ shot.split('/').pop() }}</div>
          </a>
        </div>
      </div>

      <!-- Feature Details -->
      <div class="features-section">
        <h3>Features in Run</h3>
        <div class="feature-list">
          <div v-for="featureId in featureIds" :key="featureId" class="feature-badge">
            {{ getFeatureName(featureId) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTestRunStore } from '../stores/testRuns'
import { useProjectStore } from '../stores/projects'

const route = useRoute()
const testRunStore = useTestRunStore()
const projectStore = useProjectStore()

const loading = ref(true)
const runId = route.params.id as string

const run = computed(() => testRunStore.currentRun)
const featureIds = computed(() => {
  if (!run.value?.featureIds) return []
  try {
    return JSON.parse(run.value.featureIds)
  } catch {
    return []
  }
})

const screenshots = computed(() => {
  if (!run.value?.screenshotPaths) return []
  try {
    return JSON.parse(run.value.screenshotPaths)
  } catch {
    return []
  }
})

const recordings = computed(() => {
  if (!run.value?.recordingPath) return []
  try {
    return JSON.parse(run.value.recordingPath)
  } catch {
    return []
  }
})

const parsedResults = computed(() => {
  if (!run.value?.resultJson) return null
  try {
    return JSON.parse(run.value.resultJson)
  } catch {
    return null
  }
})

let refreshInterval: ReturnType<typeof setInterval> | null = null

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function formatResults(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

function getFeatureName(id: string) {
  for (const pid in projectStore.features) {
    const feature = projectStore.features[pid].find(f => f.id === id)
    if (feature) return feature.name
  }
  return id
}

async function refresh() {
  loading.value = true
  await testRunStore.fetchTestRun(runId)
  loading.value = false
}

async function stopTest() {
  await testRunStore.stopTest(runId)
  await refresh()
}

async function loadFeatures() {
  for (const project of projectStore.projects) {
    await projectStore.fetchFeatures(project.id)
  }
}

onMounted(async () => {
  await loadFeatures()
  await refresh()

  refreshInterval = globalThis.setInterval(async () => {
    if (run.value?.status === 'running') {
      await testRunStore.fetchTestRun(runId)
    }
  }, 2000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.header h2 {
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  gap: 1rem;
}

.info-section,
.actions-section,
.error-section,
.results-section,
.artifacts-section,
.features-section {
  margin-bottom: 2rem;
}

.info-section h3,
.results-section h3,
.artifacts-section h3,
.features-section h3 {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-grid label {
  display: block;
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.info-grid p {
  margin: 0;
}

.progress-bar {
  margin-top: 1rem;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  animation: progress 2s infinite;
}

@keyframes progress {
  0% { width: 0%; }
  50% { width: 70%; }
  100% { width: 100%; }
}

.actions-section {
  display: flex;
  gap: 1rem;
}

.error-section pre {
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  color: var(--error);
}

.results-json pre {
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-size: 0.875rem;
}

.artifacts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.artifact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s;
  overflow: hidden;
  text-align: center;
}

.artifact-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.artifact-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.artifact-thumbnail {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 0.25rem;
  background: #000;
}

.artifact-name {
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.85rem;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.feature-badge {
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

/* Cucumber Report Styles */
.cucumber-report {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.feature-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
}

.feature-header {
  padding: 1rem 1.5rem;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 1.125rem;
}

.feature-keyword {
  color: var(--accent);
}

.scenarios {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.scenario-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.scenario-header {
  font-weight: 600;
  font-size: 1.05rem;
}

.scenario-keyword {
  color: var(--text-secondary);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-left: 1.5rem;
}

.step-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
  background: var(--bg-primary);
}

.step-content {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.step-status {
  min-width: 24px;
  text-align: center;
}

.step-keyword {
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.step-name {
  color: var(--text-primary);
}

.step-duration {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: 0.75rem;
}

.status-passed { color: #10b981; }
.status-failed { color: #ef4444; }
.status-undefined { color: #f59e0b; }
.status-skipped { color: #6b7280; }

.step-error {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
  border-radius: 0.25rem;
  overflow-x: auto;
}

.step-error pre {
  margin: 0;
  color: #ef4444;
  font-size: 0.875rem;
}
</style>
