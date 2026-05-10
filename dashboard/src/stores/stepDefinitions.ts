import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface StepParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  default?: string
  description?: string
}

export interface StepDefinition {
  id: string
  projectId: string
  name: string
  category: 'navigation' | 'input' | 'click' | 'assertion' | 'wait' | 'screenshot' | 'form' | 'scroll' | 'script' | 'attribute' | null
  gherkinPattern: string
  playwrightFunction: string
  parameters?: StepParameter[]
  description?: string
  enabled: number
  createdAt: string
  updatedAt: string
}

export const useStepDefinitionStore = defineStore('stepDefinitions', () => {
  const steps = ref<StepDefinition[]>([])
  const loading = ref(false)

  async function fetchStepDefinitions(projectId: string) {
    loading.value = true
    try {
      const res = await fetch(`/api/projects/${projectId}/step-definitions`)
      steps.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  async function createStepDefinition(data: Partial<StepDefinition>) {
    const res = await fetch('/api/step-definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const step = await res.json()
      steps.value.push(step)
      return step
    }
    throw new Error('Failed to create step definition')
  }

  async function updateStepDefinition(id: string, data: Partial<StepDefinition>) {
    const res = await fetch(`/api/step-definitions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const step = await res.json()
      const idx = steps.value.findIndex(s => s.id === id)
      if (idx !== -1) steps.value[idx] = step
      return step
    }
    throw new Error('Failed to update step definition')
  }

  async function deleteStepDefinition(id: string) {
    const res = await fetch(`/api/step-definitions/${id}`, { method: 'DELETE' })
    if (res.ok) {
      steps.value = steps.value.filter(s => s.id !== id)
    }
  }

  async function importFromLibrary(projectId: string, framework: string) {
    const res = await fetch(`/api/projects/${projectId}/step-definitions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ framework })
    })
    if (res.ok) {
      const data = await res.json()
      await fetchStepDefinitions(projectId)
      return data
    }
    throw new Error('Failed to import step definitions')
  }

  function getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      navigation: '🧭',
      input: '⌨️',
      click: '👆',
      assertion: '✓',
      wait: '⏱️',
      screenshot: '📸',
      form: '📋',
      scroll: '📜',
      script: '🔧',
      attribute: '🏷️'
    }
    return icons[category] || '📌'
  }

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      navigation: 'badge-info',
      input: 'badge-primary',
      click: 'badge-warning',
      assertion: 'badge-success',
      wait: 'badge-secondary',
      screenshot: 'badge-purple',
      form: 'badge-orange',
      scroll: 'badge-teal',
      script: 'badge-dark',
      attribute: 'badge-pink'
    }
    return colors[category] || 'badge-secondary'
  }

  return {
    steps,
    loading,
    fetchStepDefinitions,
    createStepDefinition,
    updateStepDefinition,
    deleteStepDefinition,
    importFromLibrary,
    getCategoryIcon,
    getCategoryColor
  }
})
