<template>
  <div class="app">
    <nav class="navbar">
      <div class="container flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="logo">E2E Dashboard</h1>
          <router-link to="/" class="nav-link">Dashboard</router-link>
          <router-link to="/projects" class="nav-link">Projects</router-link>
          <router-link to="/test-runs" class="nav-link">Test Runs</router-link>
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
  padding: 0.75rem 0;
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--accent);
  margin: 0;
}

.nav-link {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text-primary);
  background: var(--bg-tertiary);
  text-decoration: none;
}

.main {
  flex: 1;
  padding: 1.5rem 0;
}
</style>
