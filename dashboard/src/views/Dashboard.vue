<template>
  <div class="container">
    <div class="header">
      <div>
        <h1>Dashboard</h1>
        <p class="subtitle">Overview of your E2E testing</p>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(59, 130, 246, 0.2);">📁</div>
        <div class="stat-content">
          <div class="stat-value">{{ projectStore.projects.length }}</div>
          <div class="stat-label">Projects</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(16, 185, 129, 0.2);">📋</div>
        <div class="stat-content">
          <div class="stat-value">{{ totalFeatures }}</div>
          <div class="stat-label">Features</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(16, 185, 129, 0.2);">✅</div>
        <div class="stat-content">
          <div class="stat-value">{{ passedTests }}</div>
          <div class="stat-label">Passed</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(239, 68, 68, 0.2);">❌</div>
        <div class="stat-content">
          <div class="stat-value">{{ failedTests }}</div>
          <div class="stat-label">Failed</div>
        </div>
      </div>
    </div>

    <div class="content-grid">
      <!-- Recent Projects -->
      <div class="section-card">
        <div class="section-header">
          <h3>Recent Projects</h3>
          <router-link to="/projects" class="view-all">View all →</router-link>
        </div>
        <div class="project-list" v-if="projectStore.projects.length">
          <router-link v-for="project in recentProjects" :key="project.id"
            :to="`/projects/${project.id}`" class="project-item">
            <span class="project-type-badge" :class="project.type === 'web' ? 'type-web' : 'type-mobile'">
              {{ project.type === 'web' ? '🌐' : '📱' }}
            </span>
            <span class="project-name">{{ project.name }}</span>
            <span class="project-arrow">→</span>
          </router-link>
        </div>
        <div v-else class="empty-mini">
          <p>No projects yet</p>
          <router-link to="/projects" class="create-link">Create one →</router-link>
        </div>
      </div>

      <!-- Recent Test Runs -->
      <div class="section-card">
        <div class="section-header">
          <h3>Recent Test Runs</h3>
          <router-link to="/test-runs" class="view-all">View all →</router-link>
        </div>
        <div class="test-runs-list" v-if="testRunStore.testRuns.length">
          <div v-for="run in recentTestRuns" :key="run.id" class="test-run-item">
            <div class="test-run-main">
              <span class="test-run-project">{{ run.projectName }}</span>
              <span class="badge" :class="testRunStore.getStatusBadge(run.status)">{{ run.status }}</span>
            </div>
            <div class="test-run-meta">
              <span>{{ formatDate(run.startedAt) }}</span>
              <router-link :to="`/test-runs/${run.id}`" class="view-link">View</router-link>
            </div>
          </div>
        </div>
        <div v-else class="empty-mini">
          <p>No test runs yet</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useProjectStore } from '../stores/projects'
import { useTestRunStore } from '../stores/testRuns'

const projectStore = useProjectStore()
const testRunStore = useTestRunStore()

const recentProjects = computed(() => projectStore.projects.slice(0, 5))
const recentTestRuns = computed(() => testRunStore.testRuns.slice(0, 5))

const totalFeatures = computed(() => Object.values(projectStore.features).flat().length)
const passedTests = computed(() => testRunStore.testRuns.filter(r => r.status === 'passed').length)
const failedTests = computed(() => testRunStore.testRuns.filter(r => r.status === 'failed').length)

function formatDate(date: string) {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

onMounted(() => {
  testRunStore.fetchTestRuns()
  projectStore.projects.forEach(p => projectStore.fetchFeatures(p.id))
})
</script>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  margin: 0 0 0.25rem 0;
  font-size: 1.75rem;
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.section-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
}

.view-all {
  color: var(--accent);
  font-size: 0.875rem;
  text-decoration: none;
}

.view-all:hover {
  text-decoration: underline;
}

/* Project List */
.project-list {
  padding: 0.5rem;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 0.5rem;
  text-decoration: none;
  color: var(--text-primary);
  transition: all 0.2s;
}

.project-item:hover {
  background: var(--bg-tertiary);
}

.project-type-badge {
  font-size: 1.25rem;
}

.project-name {
  flex: 1;
  font-weight: 500;
}

.project-arrow {
  color: var(--text-secondary);
}

/* Test Runs List */
.test-runs-list {
  padding: 0.5rem;
}

.test-run-item {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--border);
}

.test-run-item:last-child {
  border-bottom: none;
}

.test-run-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.375rem;
}

.test-run-project {
  font-weight: 500;
}

.test-run-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.view-link {
  color: var(--accent);
  text-decoration: none;
}

/* Empty States */
.empty-mini {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-mini p {
  margin: 0 0 0.5rem 0;
}

.create-link {
  color: var(--accent);
  text-decoration: none;
}
</style>
