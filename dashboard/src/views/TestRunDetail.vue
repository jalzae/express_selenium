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
        <h3>Results</h3>
        <div v-if="run.resultJson" class="results-json">
          <pre>{{ formatResults(run.resultJson) }}</pre>
        </div>
      </div>

      <!-- Artifacts -->
      <div v-if="run.recordingPath || run.screenshotPaths" class="artifacts-section">
        <h3>Artifacts</h3>
        <div class="artifacts-grid">
          <a v-if="run.recordingPath" :href="`/recordings/${run.recordingPath}`" target="_blank" class="artifact-card">
            <div class="artifact-icon">🎥</div>
            <div>Recording</div>
          </a>
          <a v-for="shot in screenshots" :key="shot" :href="`/screenshots/${shot}`" target="_blank" class="artifact-card">
            <div class="artifact-icon">📸</div>
            <div>{{ shot.split('/').pop() }}</div>
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

let refreshInterval: number | null = null

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

  refreshInterval = window.setInterval(async () => {
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.artifact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s;
}

.artifact-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.artifact-icon {
  font-size: 2rem;
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
</style>
