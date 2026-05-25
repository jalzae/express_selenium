import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TestRun {
  id: string
  projectId: string
  projectName?: string
  projectType?: string
  featureIds: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  recordingPath?: string
  screenshotPaths?: string
  resultJson?: string
  errorMessage?: string
}

export const useTestRunStore = defineStore('testRuns', () => {
  const testRuns = ref<TestRun[]>([])
  const loading = ref(false)
  const currentRun = ref<TestRun | null>(null)

  async function fetchTestRuns(projectId?: string) {
    loading.value = true
    try {
      const url = projectId ? `/api/projects/${projectId}/test-runs` : '/api/test-runs'
      const res = await fetch(url)
      testRuns.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  async function fetchTestRun(id: string) {
    const res = await fetch(`/api/test-runs/${id}`)
    currentRun.value = await res.json()
    return currentRun.value
  }

  async function createTestRun(projectId: string, featureIds: string[], options?: { recordTestRun?: boolean; takeScreenshots?: boolean }) {
    const res = await fetch('/api/test-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, featureIds, ...options })
    })
    if (res.ok) {
      const run = await res.json()
      testRuns.value.unshift(run)
      return run
    }
    throw new Error('Failed to create test run')
  }

  async function runTest(runId: string) {
    const res = await fetch(`/api/test-runs/${runId}/run`, { method: 'POST' })
    if (res.ok) {
      const run = await res.json()
      const idx = testRuns.value.findIndex(r => r.id === runId)
      if (idx !== -1) testRuns.value[idx].status = 'running'
      return run
    }
    throw new Error('Failed to start test')
  }

  async function stopTest(runId: string) {
    const res = await fetch(`/api/test-runs/${runId}/stop`, { method: 'POST' })
    if (res.ok) {
      const idx = testRuns.value.findIndex(r => r.id === runId)
      if (idx !== -1) testRuns.value[idx].status = 'cancelled'
    }
  }

  async function deleteTestRun(id: string) {
    const res = await fetch(`/api/test-runs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      testRuns.value = testRuns.value.filter(r => r.id !== id)
    }
  }

  async function updateTestRun(id: string, data: Partial<TestRun>) {
    const res = await fetch(`/api/test-runs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated = await res.json()
      const idx = testRuns.value.findIndex(r => r.id === id)
      if (idx !== -1) testRuns.value[idx] = updated
      if (currentRun.value?.id === id) currentRun.value = updated
      return updated
    }
    throw new Error('Failed to update test run')
  }

  async function fetchTestRunLogs(id: string) {
    const res = await fetch(`/api/test-runs/${id}/logs`)
    if (res.ok) {
      const data = await res.json()
      return data.logs || ''
    }
    throw new Error('Failed to fetch test run logs')
  }

  function getStatusBadge(status: TestRun['status']) {
    const map = {
      pending: 'badge-info',
      running: 'badge-warning',
      passed: 'badge-success',
      failed: 'badge-error',
      cancelled: 'badge-info'
    }
    return map[status] || 'badge-info'
  }

  return {
    testRuns,
    loading,
    currentRun,
    fetchTestRuns,
    fetchTestRun,
    createTestRun,
    updateTestRun,
    runTest,
    stopTest,
    deleteTestRun,
    fetchTestRunLogs,
    getStatusBadge
  }
})
