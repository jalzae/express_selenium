<template>
  <div class="container">
    <div class="header">
      <h2>Projects</h2>
      <button class="btn-primary" @click="showProjectModal = true">+ New Project</button>
    </div>

    <div class="projects-grid" v-if="projectStore.projects.length">
      <div v-for="project in projectStore.projects" :key="project.id" class="project-card">
        <div class="card-header">
          <div class="flex items-center gap-2">
            <span class="badge" :class="project.type === 'web' ? 'badge-info' : 'badge-warning'">
              {{ project.type }}
            </span>
            <h3>{{ project.name }}</h3>
          </div>
          <div class="actions">
            <button class="btn-sm btn-secondary" @click="editProject(project)">Edit</button>
            <button class="btn-sm btn-error" @click="confirmDelete(project)">Delete</button>
          </div>
        </div>
        <div class="card-body">
          <p v-if="project.type === 'web' && project.baseUrl">
            <strong>Base URL:</strong> {{ project.baseUrl }}
          </p>
          <p v-if="project.type === 'mobile'">
            <strong>Device:</strong> {{ project.deviceName }} ({{ project.platformVersion }})
          </p>
          <p v-if="project.type === 'mobile' && project.appPackage">
            <strong>Package:</strong> {{ project.appPackage }}
          </p>
        </div>
        <div class="card-footer">
          <router-link :to="`/projects/${project.id}`" class="btn-secondary btn-sm">
            Manage Features →
          </router-link>
        </div>
      </div>
    </div>

    <p v-else class="empty-state">
      No projects yet. Create your first project to get started.
    </p>

    <!-- Project Modal -->
    <div v-if="showProjectModal" class="modal-overlay" @click.self="showProjectModal = false">
      <div class="modal">
        <h3>{{ editingProject ? 'Edit Project' : 'New Project' }}</h3>
        <form @submit.prevent="saveProject">
          <div class="form-group">
            <label class="form-label">Project Name</label>
            <input v-model="projectForm.name" required placeholder="My E2E Tests" />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select v-model="projectForm.type" required>
              <option value="web">Web (Playwright)</option>
              <option value="mobile">Mobile (WDIO/Appium)</option>
            </select>
          </div>
          <template v-if="projectForm.type === 'web'">
            <div class="form-group">
              <label class="form-label">Base URL</label>
              <input v-model="projectForm.baseUrl" placeholder="https://example.com" />
            </div>
          </template>
          <template v-else>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Device Name</label>
                <input v-model="projectForm.deviceName" placeholder="Pixel_5" />
              </div>
              <div class="form-group">
                <label class="form-label">Platform Version</label>
                <input v-model="projectForm.platformVersion" placeholder="12" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">App Package</label>
              <input v-model="projectForm.appPackage" placeholder="com.example.app" />
            </div>
            <div class="form-group">
              <label class="form-label">App Activity</label>
              <input v-model="projectForm.appActivity" placeholder=".MainActivity" />
            </div>
            <div class="form-group">
              <label class="form-label">Automation Name</label>
              <input v-model="projectForm.automationName" placeholder="UiAutomator2" />
            </div>
          </template>
          <div class="flex gap-2 justify-between">
            <button type="button" class="btn-secondary" @click="showProjectModal = false">Cancel</button>
            <button type="submit" class="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <div v-if="deletingProject" class="modal-overlay" @click.self="deletingProject = null">
      <div class="modal">
        <h3>Delete Project?</h3>
        <p>This will delete all features and test runs for <strong>{{ deletingProject.name }}</strong>.</p>
        <div class="flex gap-2 justify-between">
          <button class="btn-secondary" @click="deletingProject = null">Cancel</button>
          <button class="btn-error" @click="deleteProject">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useProjectStore, type Project } from '../stores/projects'

const projectStore = useProjectStore()

const showProjectModal = ref(false)
const editingProject = ref<Project | null>(null)
const deletingProject = ref<Project | null>(null)

const projectForm = reactive({
  name: '',
  type: 'web' as 'web' | 'mobile',
  baseUrl: '',
  deviceName: '',
  platformVersion: '',
  appPackage: '',
  appActivity: '',
  automationName: ''
})

function editProject(project: Project) {
  editingProject.value = project
  Object.assign(projectForm, {
    name: project.name,
    type: project.type,
    baseUrl: project.baseUrl || '',
    deviceName: project.deviceName || '',
    platformVersion: project.platformVersion || '',
    appPackage: project.appPackage || '',
    appActivity: project.appActivity || '',
    automationName: project.automationName || ''
  })
  showProjectModal.value = true
}

function confirmDelete(project: Project) {
  deletingProject.value = project
}

async function saveProject() {
  if (editingProject.value) {
    await projectStore.updateProject(editingProject.value.id, projectForm)
  } else {
    await projectStore.createProject(projectForm)
  }
  showProjectModal.value = false
  editingProject.value = null
  resetForm()
}

async function deleteProject() {
  if (deletingProject.value) {
    await projectStore.deleteProject(deletingProject.value.id)
    deletingProject.value = null
  }
}

function resetForm() {
  Object.assign(projectForm, {
    name: '',
    type: 'web',
    baseUrl: '',
    deviceName: '',
    platformVersion: '',
    appPackage: '',
    appActivity: '',
    automationName: ''
  })
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1rem;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  font-size: 1rem;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.card-body {
  padding: 1rem;
}

.card-body p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.card-body strong {
  color: var(--text-primary);
}

.card-footer {
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

.card-footer a {
  text-decoration: none;
}

.empty-state {
  color: var(--text-secondary);
  padding: 3rem;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}

.modal h3 {
  margin-bottom: 1rem;
}

.modal p {
  margin-bottom: 1.5rem;
  color: var(--text-secondary);
}
</style>
