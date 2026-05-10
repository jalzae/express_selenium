import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Project {
  id: string
  name: string
  type: 'web' | 'mobile'
  baseUrl?: string
  appPackage?: string
  appActivity?: string
  deviceName?: string
  platformVersion?: string
  automationName?: string
  createdAt: string
  updatedAt: string
}

export interface Feature {
  id: string
  projectId: string
  name: string
  framework: 'playwright' | 'wdio'
  description?: string
  content: string
  enabled: number
  createdAt: string
  updatedAt: string
}

export const useProjectStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const features = ref<Record<string, Feature[]>>({})
  const loading = ref(false)

  async function fetchProjects() {
    loading.value = true
    try {
      const res = await fetch('/api/projects')
      projects.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  async function fetchFeatures(projectId: string) {
    const res = await fetch(`/api/projects/${projectId}/features`)
    features.value[projectId] = await res.json()
  }

  async function createProject(data: Partial<Project>) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const project = await res.json()
      projects.value.unshift(project)
      return project
    }
    throw new Error('Failed to create project')
  }

  async function updateProject(id: string, data: Partial<Project>) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const idx = projects.value.findIndex(p => p.id === id)
      if (idx !== -1) projects.value[idx] = await res.json()
    }
  }

  async function deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      projects.value = projects.value.filter(p => p.id !== id)
    }
  }

  async function createFeature(data: Partial<Feature>) {
    const res = await fetch('/api/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const feature = await res.json()
      if (!features.value[feature.projectId]) {
        features.value[feature.projectId] = []
      }
      features.value[feature.projectId].unshift(feature)
      return feature
    }
    throw new Error('Failed to create feature')
  }

  async function updateFeature(id: string, data: Partial<Feature>) {
    const res = await fetch(`/api/features/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const updated = await res.json()
      for (const pid in features.value) {
        const idx = features.value[pid].findIndex(f => f.id === id)
        if (idx !== -1) features.value[pid][idx] = updated
      }
    }
  }

  async function deleteFeature(id: string) {
    const res = await fetch(`/api/features/${id}`, { method: 'DELETE' })
    if (res.ok) {
      for (const pid in features.value) {
        features.value[pid] = features.value[pid].filter(f => f.id !== id)
      }
    }
  }

  function getProject(id: string) {
    return projects.value.find(p => p.id === id)
  }

  function getProjectFeatures(projectId: string) {
    return features.value[projectId] || []
  }

  return {
    projects,
    features,
    loading,
    fetchProjects,
    fetchFeatures,
    createProject,
    updateProject,
    deleteProject,
    createFeature,
    updateFeature,
    deleteFeature,
    getProject,
    getProjectFeatures
  }
})
