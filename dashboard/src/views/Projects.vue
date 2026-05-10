<template>
  <div class="container">
    <div class="header">
      <div>
        <h2>Projects</h2>
        <p class="subtitle">Manage your E2E testing projects</p>
      </div>
      <button class="btn-primary" @click="openProjectModal()">+ New Project</button>
    </div>

    <div class="projects-grid" v-if="projectStore.projects.length">
      <div v-for="project in projectStore.projects" :key="project.id" class="project-card">
        <div class="project-card-header">
          <div class="project-type">
            <span class="type-icon">{{ project.type === 'web' ? '🌐' : '📱' }}</span>
            <span class="type-label">{{ project.type === 'web' ? 'Web' : 'Mobile' }}</span>
          </div>
          <div class="project-actions">
            <button class="btn-icon" @click="editProject(project)" title="Edit">✏️</button>
            <button class="btn-icon btn-icon-danger" @click="confirmDelete(project)" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="project-card-body">
          <h3>{{ project.name }}</h3>
          <div class="project-details">
            <p v-if="project.type === 'web' && project.baseUrl">
              <span class="detail-icon">🔗</span>
              <span>{{ project.baseUrl }}</span>
            </p>
            <p v-if="project.type === 'mobile'">
              <span class="detail-icon">📱</span>
              <span>{{ project.deviceName || 'Unknown Device' }} ({{ project.platformVersion || '?' }})</span>
            </p>
            <p v-if="project.type === 'mobile' && project.appPackage">
              <span class="detail-icon">📦</span>
              <span>{{ project.appPackage }}</span>
            </p>
          </div>
        </div>
        <div class="project-card-footer">
          <router-link :to="`/projects/${project.id}`" class="btn-secondary btn-block">
            <span>⚙️</span> Manage Features
          </router-link>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">📁</div>
      <h3>No projects yet</h3>
      <p>Create your first project to get started with E2E testing</p>
      <button class="btn-primary" @click="openProjectModal()">+ Create Project</button>
    </div>

    <!-- Project Modal -->
    <Teleport to="body">
      <div v-if="showProjectModal" class="modal-overlay" @click.self="showProjectModal = false">
        <div class="modal">
          <div class="modal-header">
            <h3>{{ editingProject ? 'Edit Project' : 'New Project' }}</h3>
            <button class="btn-icon" @click="showProjectModal = false">✕</button>
          </div>
          <form @submit.prevent="saveProject">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="project-name">Project Name *</label>
                <input id="project-name" v-model="projectForm.name" required placeholder="My E2E Tests" />
              </div>
              <div class="form-group">
                <label class="form-label" for="project-type">Type *</label>
                <select id="project-type" v-model="projectForm.type" required>
                  <option value="web">🌐 Web (Playwright)</option>
                  <option value="mobile">📱 Mobile (WDIO/Appium)</option>
                </select>
              </div>
              <template v-if="projectForm.type === 'web'">
                <div class="form-group">
                  <label class="form-label" for="base-url">Base URL</label>
                  <input id="base-url" v-model="projectForm.baseUrl" placeholder="https://example.com" />
                </div>
              </template>
              <template v-else>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="device-name">Device Name</label>
                    <input id="device-name" v-model="projectForm.deviceName" placeholder="Pixel_5" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="platform-version">Platform Version</label>
                    <input id="platform-version" v-model="projectForm.platformVersion" placeholder="12" />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="app-package">App Package</label>
                    <input id="app-package" v-model="projectForm.appPackage" placeholder="com.example.app" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="app-activity">App Activity</label>
                    <input id="app-activity" v-model="projectForm.appActivity" placeholder=".MainActivity" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="automation-name">Automation Name</label>
                  <input id="automation-name" v-model="projectForm.automationName" placeholder="UiAutomator2" />
                </div>

                <!-- Appium Connection -->
                <div class="form-section-title">Appium Server Configuration</div>
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="appium-host">Appium Host</label>
                    <input id="appium-host" v-model="projectForm.appiumHost" placeholder="localhost" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="appium-port">Appium Port</label>
                    <input id="appium-port" v-model="projectForm.appiumPort" placeholder="4723" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="appium-path">Appium Path</label>
                  <input id="appium-path" v-model="projectForm.appiumPath" placeholder="/wd/hub" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="apk-path-input">APK Path</label>
                  <div class="file-input-wrapper">
                    <input
                      type="file"
                      accept=".apk"
                      @change="onApkFileSelected"
                      class="file-input"
                      id="apk-file-input"
                      ref="apkFileInput"
                    />
                    <button type="button" class="btn-sm btn-secondary" @click="selectApkFile">
                      📁 Browse
                    </button>
                    <input
                      :value="projectForm.apkPath"
                      @input="projectForm.apkPath = ($event.target as HTMLInputElement).value"
                      placeholder="/path/to/app-release.apk or app-release.apk"
                      class="apk-name-input"
                    />
                  </div>
                  <p class="help-text">Enter full local path or filename. Browser only gets filename - paste full path manually if needed.</p>
                </div>
              </template>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" @click="showProjectModal = false">Cancel</button>
              <button type="submit" class="btn-primary">
                {{ editingProject ? 'Save Changes' : 'Create Project' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <div v-if="deletingProject" class="modal-overlay" @click.self="deletingProject = null">
        <div class="modal modal-small">
          <div class="modal-header">
            <h3>Delete Project?</h3>
          </div>
          <div class="modal-body">
            <p>Delete <strong>{{ deletingProject.name }}</strong>?</p>
            <p class="text-secondary">This will delete all features and test runs for this project.</p>
            <p class="warning">This action cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click="deletingProject = null">Cancel</button>
            <button class="btn-error" @click="deleteProject">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useProjectStore, type Project } from '../stores/projects'

const projectStore = useProjectStore()

const showProjectModal = ref(false)
const editingProject = ref<Project | null>(null)
const deletingProject = ref<Project | null>(null)

// APK file input ref
const apkFileInput = ref<HTMLInputElement | null>(null)

// Local storage key for APK path
const APK_PATH_KEY = 'last_apk_path'

// Load saved APK path from localStorage
const getSavedApkPath = (): string => {
  try {
    return localStorage.getItem(APK_PATH_KEY) || ''
  } catch {
    return ''
  }
}

// Save APK path to localStorage
const saveApkPath = (path: string) => {
  try {
    localStorage.setItem(APK_PATH_KEY, path)
  } catch {
    // Ignore storage errors
  }
}

const projectForm = reactive({
  name: '',
  type: 'web' as 'web' | 'mobile',
  baseUrl: '',
  deviceName: '',
  platformVersion: '',
  appPackage: '',
  appActivity: '',
  automationName: '',
  appiumHost: 'localhost',
  appiumPort: '4723',
  appiumPath: '/',
  apkPath: ''
})

// Watch apkPath changes and save to localStorage
watch(() => projectForm.apkPath, (newPath) => {
  if (newPath) {
    saveApkPath(newPath)
  }
})

function openProjectModal() {
  editingProject.value = null
  resetForm()
  // Load saved APK path for new mobile projects
  projectForm.apkPath = getSavedApkPath()
  showProjectModal.value = true
}

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
    automationName: project.automationName || '',
    appiumHost: project.appiumHost || 'localhost',
    appiumPort: project.appiumPort || '4723',
    appiumPath: project.appiumPath || '/',
    apkPath: project.apkPath || getSavedApkPath()
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
    automationName: '',
    appiumHost: 'localhost',
    appiumPort: '4723',
    appiumPath: '/',
    apkPath: ''
  })
}

function selectApkFile() {
  apkFileInput.value?.click()
}

function onApkFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    // Browser only gives filename for security - user can manually edit for full path
    const path = file.name
    projectForm.apkPath = path
    saveApkPath(path)
  }
}
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
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border);
}

.header h2 {
  margin: 0 0 0.25rem 0;
  font-size: 1.5rem;
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.project-card-header {
  padding: 1rem 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.project-type {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-icon {
  font-size: 1.25rem;
}

.type-label {
  font-weight: 600;
  font-size: 0.875rem;
}

.project-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: var(--bg-tertiary);
}

.btn-icon-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.project-card-body {
  padding: 1.25rem;
}

.project-card-body h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
}

.project-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.project-details p {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.detail-icon {
  font-size: 1rem;
}

.project-card-footer {
  padding: 1rem 1.25rem;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
}

.btn-block {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
}

.empty-state p {
  margin: 0 0 1.5rem 0;
  color: var(--text-secondary);
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
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-small {
  max-width: 400px;
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

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-body p {
  margin-bottom: 1rem;
}

.warning {
  color: var(--error);
  font-size: 0.875rem;
  margin: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
}

.form-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 1rem 0 0.75rem 0;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border);
}

.form-section-title:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

/* File Input Styles */
.file-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.file-input {
  display: none;
}

.apk-name-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: monospace;
}
</style>
