<template>
  <div class="container">
    <div class="header">
      <h2>📚 Step Library</h2>
      <div class="header-actions">
        <select v-model="selectedProject" @change="loadSteps" class="project-select">
          <option value="">All Projects</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
        <select v-model="selectedCategory" @change="filterSteps" class="category-select">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
    </div>

    <div class="steps-grid" v-if="filteredSteps.length">
      <div v-for="step in filteredSteps" :key="step.id" class="step-card">
        <div class="step-header">
          <span class="step-icon">{{ stepStore.getCategoryIcon(step.category || '') }}</span>
          <div class="step-info">
            <span class="step-name">{{ step.name }}</span>
            <span class="badge" :class="stepStore.getCategoryColor(step.category || '')">{{ step.category }}</span>
          </div>
          <div class="step-actions">
            <button class="btn-icon" @click="editStep(step)" title="Edit">✏️</button>
            <button class="btn-icon" @click="confirmDeleteStep(step)" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="step-body">
          <code class="gherkin-pattern">{{ step.gherkinPattern }}</code>
          <div class="step-meta">
            <span class="project">{{ getProjectName(step.projectId) }}</span>
            <span class="function">→ {{ step.playwrightFunction }}()</span>
            <span class="params-count">{{ step.parameters?.length || 0 }} params</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <div class="empty-icon">📚</div>
      <h4>No step definitions found</h4>
      <p>Step definitions will appear here after you import or create them</p>
    </div>

    <!-- Edit Step Modal -->
    <div v-if="editingStep" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>Edit Step Definition</h3>
          <button class="btn-icon" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Name</label>
            <input v-model="editingStep.name" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Category</label>
            <select v-model="editingStep.category" class="form-control">
              <option value="">None</option>
              <option value="navigation">Navigation</option>
              <option value="input">Input</option>
              <option value="click">Click</option>
              <option value="assertion">Assertion</option>
              <option value="wait">Wait</option>
              <option value="screenshot">Screenshot</option>
              <option value="form">Form</option>
              <option value="scroll">Scroll</option>
              <option value="script">Script</option>
              <option value="attribute">Attribute</option>
            </select>
          </div>
          <div class="form-group">
            <label>Gherkin Pattern</label>
            <input v-model="editingStep.gherkinPattern" type="text" class="form-control" />
          </div>
          <div class="form-group">
            <label>Playwright Function</label>
            <input v-model="editingStep.playwrightFunction" type="text" class="form-control" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModal">Cancel</button>
          <button class="btn-primary" @click="saveStep">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjectStore } from '../stores/projects'
import { useStepDefinitionStore, type StepDefinition } from '../stores/stepDefinitions'

const projectStore = useProjectStore()
const stepStore = useStepDefinitionStore()

const projects = computed(() => projectStore.projects)
const allSteps = ref<StepDefinition[]>([])
const selectedProject = ref('')
const selectedCategory = ref('')
const editingStep = ref<StepDefinition | null>(null)

const categories = ['navigation', 'input', 'click', 'assertion', 'wait', 'screenshot', 'form', 'scroll', 'script', 'attribute']

const filteredSteps = computed(() => {
  let steps = allSteps.value.filter(s => s.enabled)
  if (selectedProject.value) {
    steps = steps.filter(s => s.projectId === selectedProject.value)
  }
  if (selectedCategory.value) {
    steps = steps.filter(s => s.category === selectedCategory.value)
  }
  return steps
})

function getProjectName(projectId: string): string {
  const project = projectStore.getProject(projectId)
  return project?.name || 'Unknown'
}

async function loadSteps() {
  allSteps.value = []
  if (selectedProject.value) {
    await stepStore.fetchStepDefinitions(selectedProject.value)
    allSteps.value = stepStore.steps
  } else {
    for (const project of projects.value) {
      await stepStore.fetchStepDefinitions(project.id)
      allSteps.value.push(...stepStore.steps)
    }
  }
}

function filterSteps() {
  // Handled by computed
}

function editStep(step: StepDefinition) {
  editingStep.value = { ...step }
}

function closeModal() {
  editingStep.value = null
}

async function saveStep() {
  if (editingStep.value) {
    await stepStore.updateStepDefinition(editingStep.value.id, editingStep.value)
    closeModal()
    await loadSteps()
  }
}

async function confirmDeleteStep(step: StepDefinition) {
  if (confirm(`Delete step "${step.name}"?`)) {
    await stepStore.deleteStepDefinition(step.id)
    await loadSteps()
  }
}

onMounted(async () => {
  await projectStore.fetchProjects()
  await loadSteps()
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.header h2 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.project-select,
.category-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.step-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  transition: all 0.2s;
}

.step-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.step-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.step-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.step-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.step-name {
  font-weight: 600;
  color: var(--text-primary);
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  width: fit-content;
}

.step-actions {
  display: flex;
  gap: 0.25rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-icon:hover {
  opacity: 1;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gherkin-pattern {
  background: var(--bg-tertiary);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: var(--accent);
  overflow-x: auto;
}

.step-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.project {
  color: var(--accent);
  font-weight: 500;
}

.function {
  font-family: monospace;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h4 {
  margin: 0 0 0.5rem 0;
}

.empty-state p {
  margin: 0;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary);
  border-radius: 0.75rem;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.form-control {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>
