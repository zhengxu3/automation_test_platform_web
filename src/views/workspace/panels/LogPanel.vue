<template>
  <div class="bg-dark-900 rounded-lg p-4 max-h-[400px] overflow-auto">
    <div v-if="logs.length">
      <div v-for="log in logs" :key="log.timestamp" class="flex gap-2 py-1 text-xs font-mono">
        <span class="text-text-muted opacity-60 flex-shrink-0">{{ formatTime(log.timestamp) }}</span>
        <span :class="logColor(log.status)">{{ log.chunk || log.msg }}</span>
      </div>
    </div>
    <div v-else class="text-text-muted text-xs text-center py-8">暂无运行日志</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ logs: any[] }>()

function formatTime(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString().slice(0, 8) : '' }
function logColor(status: string) {
  return { completed: 'text-emerald-400', error: 'text-red-400', warning: 'text-amber-400' }[status] || 'text-text-secondary'
}
</script>
