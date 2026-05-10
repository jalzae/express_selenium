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
      <button class="btn-primary" @click="showFeatureModal = true">+ Add Feature</button>
    </div>

    <!-- Features List -->
    <div class="features-section">
      <h3>Features</h3>
      <div class="table-wrapper" v-if="features.length">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Path</th>
              <th>Framework</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="feature in features" :key="feature.id">
              <td>{{ feature.name }}</td>
              <td><code>{{ feature.path }}</code></td>
              <td>
                <span class="badge" :class="feature.framework === 'playwright' ? 'badge-info' : 'badge-warning'">
                  {{ feature.framework }}
                </span>
              </td>
              <td>
                <span class="badge" :class="feature.enabled ? 'badge-success' : 'badge-info'">
                  {{ feature.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="actions">
                <button class="btn-sm btn-secondary" @click="editFeature(feature)">Edit</button>
                <button class="btn-sm btn-error" @click="confirmDeleteFeature(feature)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">No features yet. Add your first feature.</p>
    </div>

    <!-- Run Tests Section -->
    <div class="run-section">
      <h3>Run Tests</h3>
      <div class="card">
        <p class="help-text">Select features to run in this test suite:</p>
        <div class="feature-selector">
          <label v-for="feature in enabledFeatures" :key="feature.id" class="feature-checkbox">
            <input type="checkbox" :value="feature.id" v-model="selectedFeatures" />
            <span>{{ feature.name }}</span>
            <span class="badge badge-info">{{ feature.framework }}</span>
          </label>
        </div>
        <div class="run-actions">
          <button class="btn-primary" @click="runTests" :disabled="selectedFeatures.length === 0">
            Run Selected ({{ selectedFeatures.length }})
          </button>
        </div>
      </div>
    </div>

    <!-- Feature Modal -->
    <div v-if="showFeatureModal" class="modal-overlay" @click.self="closeFeatureModal">
      <div class="modal">
        <h3>{{ editingFeature ? 'Edit Feature' : 'Add Feature' }}</h3>
        <form @submit.prevent="saveFeature">
          <div class="form-group">
            <label class="form-label">Feature Name</label>
            <input v-model="featureForm.name" required placeholder="Login Flow" />
          </div>
          <div class="form-group">
            <label class="form-label">Path (relative to src/)</label>
            <input v-model="featureForm.path" required placeholder="web/login.feature" />
          </div>
          <div class="form-group">
            <label class="form-label">Framework</label>
            <select v-model="featureForm.framework" required>
              <option value="playwright">Playwright (Web)</option>
              <option value="wdio">WDIO/Appium (Mobile)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea v-model="featureForm.description" rows="3" placeholder="Describe what this feature tests..."></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="featureForm.enabled" />
              Enabled
            </label>
          </div>
          <div class="flex gap-2 justify-between">
            <button type="button" class="btn-secondary" @click="closeFeatureModal">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Feature Confirmation -->
    <div v-if="deletingFeature" class="modal-overlay" @click.self="deletingFeature = null">
      <div class="modal">
        <h3>Delete Feature?</h3>
        <p>Delete <strong>{{ deletingFeature.name }}</strong>?</p>
        <div class="flex gap-2 justify-between">
          <button class="btn-secondary" @click="deletingFeature = null">Cancel</button>
          <button class="btn-error" @click="deleteFeature">Delete</button>
        </div>
      </div>
    </div>
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

const featureForm = reactive({
  name: '',
  path: '',
  framework: 'playwright' as 'playwright' | 'wdio',
  description: '',
  enabled: true
})

function closeFeatureModal() {
  showFeatureModal.value = false
  editingFeature.value = null
  resetFeatureForm()
}

function editFeature(feature: Feature) {
  editingFeature.value = feature
  Object.assign(featureForm, {
    name: feature.name,
    path: feature.path,
    framework: feature.framework,
    description: feature.description || '',
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
    path: '',
    framework: 'playwright',
    description: '',
    enabled: true
  })
}

async function runTests() {
  const run = await testRunStore.createTestRun(projectId, selectedFeatures.value)
  await testRunStore.runTest(run.id)
  router.push(`/test-runs/${run.id}`)
}

onMounted(() => {
  projectStore.fetchFeatures(projectId)
  testRunStore.fetchTestRuns(projectId)
})
</script>

<style scoped>
.header h2 {
  margin: 0;
}

.features-section,
.run-section {
  margin-bottom: 2rem;
}

.features-section h3,
.run-section h3 {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

code {
  background: var(--bg-tertiary);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.help-text {
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.feature-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.feature-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  background: var(--bg-tertiary);
  border-radius: 0.375rem;
  cursor: pointer;
}

.feature-checkbox input {
  width: auto;
}

.feature-checkbox span {
  flex: 1;
}

.run-actions {
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
</style>
