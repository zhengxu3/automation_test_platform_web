<template>
  <div class="flex h-screen bg-dark-900">
    <!-- 侧边栏 -->
    <aside class="w-56 bg-dark-800 border-r border-dark-border flex flex-col">
      <div class="p-5 border-b border-dark-border">
        <h1 class="text-base font-medium bg-gradient-to-r from-accent to-accent-cyan bg-clip-text text-transparent">AI Platform</h1>
      </div>
      <nav class="flex-1 p-3 space-y-1">
        <router-link v-for="item in nav" :key="item.path" :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="$route.path.startsWith(item.path) ? 'bg-dark-600 text-white border border-dark-border' : 'text-text-secondary hover:text-text-primary hover:bg-dark-700'">
          <span>{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="p-3 border-t border-dark-border">
        <div class="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
          <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>
          {{ user?.name || 'dev' }}
        </div>
      </div>
    </aside>

    <!-- 内容区 -->
    <main class="flex-1 overflow-auto p-6">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import http from '@/api'

const nav = [
  { path: '/requirements', icon: '📋', label: '需求' },
  { path: '/goals', icon: '🎯', label: 'Goals' },
  { path: '/agents', icon: '⬡', label: '智能体' },
  { path: '/repos', icon: '📦', label: 'Git 仓库' },
  { path: '/knowledge', icon: '📚', label: '知识库' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

const user = ref<any>(null)

onMounted(async () => {
  try {
    const res: any = await http.get('/auth/check')
    user.value = res.data
  } catch { /* dev mode */ }
})
</script>
