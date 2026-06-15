<template>
  <div>
    <div v-if="screenshots.length" class="grid grid-cols-2 gap-3">
      <div v-for="(img, i) in screenshots" :key="i" class="rounded-lg overflow-hidden border border-dark-border cursor-pointer hover:border-accent transition-colors">
        <img :src="img.url" :alt="img.title || `截图${i+1}`" class="w-full h-auto" />
        <div v-if="img.title" class="p-2 text-xs text-text-muted bg-dark-900">{{ img.title }}</div>
      </div>
    </div>
    <div v-else class="text-text-muted text-xs text-center py-8">暂无截图</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ screenshots: any[] }>()
</script>
