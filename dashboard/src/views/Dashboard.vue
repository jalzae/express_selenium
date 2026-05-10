<template>
  <div class="container">
    <div class="header">
      <h2>Dashboard</h2>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ projectStore.projects.length }}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalFeatures }}</div>
        <div class="stat-label">Features</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ passedTests }}</div>
        <div class="stat-label">Passed Tests</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ failedTests }}</div>
        <div class="stat-label">Failed Tests</div>
      </div>
    </div>

    <div class="section">
      <h3>Recent Projects</h3>
      <div class="project-list" v-if="projectStore.projects.length">
        <div v-for="project in recentProjects" :key="project.id" class="project-item">
          <span class="badge" :class="project.type === 'web' ? 'badge-info' : 'badge-warning'">
            {{ project.type }}
          </span>
          <router-link :to="`/projects/${project.id}`" class="project-link">
            {{ project.name }}
          </router-link>
        </div>
      </div>
      <p v-else class="empty-state">No projects yet. <router-link to="/projects">Create one</router-link></p>
    </div>

    <div class="section">
      <h3>Recent Test Runs</h3>
      <div class="table-wrapper" v-if="testRunStore.testRuns.length">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in recentTestRuns" :key="run.id">
              <td>{{ run.projectName }}</td>
              <td><span class="badge" :class="testRunStore.getStatusBadge(run.status)">{{ run.status }}</span></td>
              <td>{{ formatDate(run.startedAt) }}</td>
              <td>
                <router-link :to="`/test-runs/${run.id}`" class="btn-sm btn-secondary">View</router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="empty-state">No test runs yet.</p>
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
const recentTestRuns = computed(() => testRunStore.testRuns.slice(0, 10))

const totalFeatures = computed(() => Object.values(projectStore.features).flat().length)
const passedTests = computed(() => testRunStore.testRuns.filter(r => r.status === 'passed').length)
const failedTests = computed(() => testRunStore.testRuns.filter(r => r.status === 'failed').length)

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

onMounted(() => {
  testRunStore.fetchTestRuns()
  projectStore.projects.forEach(p => projectStore.fetchFeatures(p.id))
})
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.section {
  margin-bottom: 2rem;
}

.section h3 {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
}

.project-link {
  color: var(--text-primary);
  text-decoration: none;
  flex: 1;
}

.project-link:hover {
  color: var(--accent);
}

.table-wrapper {
  overflow-x: auto;
}

.empty-state {
  color: var(--text-secondary);
  padding: 2rem;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.375rem;
}

.empty-state a {
  color: var(--accent);
}
</style>
