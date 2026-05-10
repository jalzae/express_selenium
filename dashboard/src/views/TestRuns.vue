<template>
  <div class="container">
    <div class="header">
      <h2>Test Runs</h2>
    </div>

    <div class="filters">
      <select v-model="statusFilter">
        <option value="">All Statuses</option>
        <option value="running">Running</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </div>

    <div class="table-wrapper" v-if="testRunStore.testRuns.length">
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th>Started</th>
            <th>Duration</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in filteredRuns" :key="run.id" :class="{ running: run.status === 'running' }">
            <td>{{ run.projectName }}</td>
            <td>
              <span class="badge" :class="testRunStore.getStatusBadge(run.status)">
                {{ run.status }}
              </span>
            </td>
            <td>{{ formatDate(run.startedAt) }}</td>
            <td>{{ getDuration(run) }}</td>
            <td class="actions">
              <router-link :to="`/test-runs/${run.id}`" class="btn-sm btn-secondary">View</router-link>
              <button v-if="run.status === 'running'" class="btn-sm btn-error" @click="stopRun(run.id)">
                Stop
              </button>
              <button v-else class="btn-sm btn-secondary" @click="confirmDelete(run)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="empty-state">No test runs found.</p>

    <!-- Delete Confirmation -->
    <div v-if="deletingRun" class="modal-overlay" @click.self="deletingRun = null">
      <div class="modal">
        <h3>Delete Test Run?</h3>
        <p>This cannot be undone.</p>
        <div class="flex gap-2 justify-between">
          <button class="btn-secondary" @click="deletingRun = null">Cancel</button>
          <button class="btn-error" @click="deleteRun">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTestRunStore, type TestRun } from '../stores/testRuns'

const testRunStore = useTestRunStore()
const statusFilter = ref('')
const deletingRun = ref<TestRun | null>(null)
let refreshInterval: number | null = null

const filteredRuns = computed(() => {
  if (!statusFilter.value) return testRunStore.testRuns
  return testRunStore.testRuns.filter(r => r.status === statusFilter.value)
})

async function fetchRuns() {
  await testRunStore.fetchTestRuns()
}

function formatDate(date: string) {
  return new Date(date).toLocaleString()
}

function getDuration(run: TestRun) {
  if (!run.completedAt) return '-'
  const start = new Date(run.startedAt).getTime()
  const end = new Date(run.completedAt).getTime()
  const seconds = Math.round((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}

function confirmDelete(run: TestRun) {
  deletingRun.value = run
}

async function deleteRun() {
  if (deletingRun.value) {
    await testRunStore.deleteTestRun(deletingRun.value.id)
    deletingRun.value = null
  }
}

async function stopRun(id: string) {
  await testRunStore.stopTest(id)
}

onMounted(() => {
  fetchRuns()
  refreshInterval = window.setInterval(() => {
    if (testRunStore.testRuns.some(r => r.status === 'running')) {
      fetchRuns()
    }
  }, 3000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.filters {
  margin-bottom: 1rem;
}

.filters select {
  max-width: 200px;
}

.running {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { background: transparent; }
  50% { background: rgba(59, 130, 246, 0.1); }
}
</style>
