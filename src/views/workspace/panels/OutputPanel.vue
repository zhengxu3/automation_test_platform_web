<template>
  <div class="bg-dark-900 rounded-lg p-4 max-h-[400px] overflow-auto">
    <div v-if="content" class="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{{ content }}</div>
    <div v-else class="text-text-muted text-xs text-center py-8">暂无产出</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ content: string }>()
</script>
