<template>
  <div class="app">
    <nav class="navbar">
      <div class="container navbar-inner">
        <div class="navbar-brand">
          <span class="brand-icon">🧪</span>
          <span class="brand-name">E2E Dashboard</span>
        </div>
        <div class="navbar-nav">
          <router-link to="/" class="nav-link">
            <span>📊</span>
            <span>Dashboard</span>
          </router-link>
          <router-link to="/projects" class="nav-link">
            <span>📁</span>
            <span>Projects</span>
          </router-link>
          <router-link to="/test-runs" class="nav-link">
            <span>🚀</span>
            <span>Test Runs</span>
          </router-link>
        </div>
      </div>
    </nav>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectStore } from './stores/projects'

const projectStore = useProjectStore()

onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.navbar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0;
}

.navbar-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.brand-icon {
  font-size: 1.5rem;
}

.brand-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--accent);
}

.navbar-nav {
  display: flex;
  gap: 0.25rem;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.nav-link.router-link-active {
  color: var(--accent);
  background: rgba(59, 130, 246, 0.15);
}

.main {
  flex: 1;
  padding: 2rem 0;
}
</style>
