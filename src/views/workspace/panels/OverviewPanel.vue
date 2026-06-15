<template>
  <div class="space-y-4">
    <!-- 指标卡片 -->
    <div class="grid grid-cols-3 gap-3">
      <div class="p-3 rounded-lg bg-dark-900">
        <div class="text-xs text-text-muted">状态</div>
        <div class="text-sm text-text-primary mt-1">{{ statusLabel }}</div>
      </div>
      <div class="p-3 rounded-lg bg-dark-900">
        <div class="text-xs text-text-muted">Token</div>
        <div class="text-sm text-text-primary mt-1 font-mono">{{ agent.tokens || 0 }}</div>
      </div>
      <div class="p-3 rounded-lg bg-dark-900">
        <div class="text-xs text-text-muted">模型</div>
        <div class="text-sm text-text-primary mt-1">{{ agent.model_id || '默认' }}</div>
      </div>
    </div>

    <!-- 评估结果（如有） -->
    <div v-if="evaluation?.conclusion" class="p-4 rounded-lg bg-dark-900 border border-dark-border">
      <div class="text-xs text-text-muted mb-2">记忆体评估</div>
      <div class="text-sm text-text-primary">{{ evaluation.conclusion }}</div>
      <div v-if="evaluation.quality" class="flex gap-4 mt-3 text-xs">
        <span :class="evaluation.quality.hallucination_risk === 'low' ? 'text-emerald-400' : 'text-amber-400'">
          幻觉: {{ evaluation.quality.hallucination_risk }}
        </span>
        <span class="text-text-secondary">置信度: {{ evaluation.quality.confidence }}</span>
      </div>
      <div v-if="evaluation.suggestion" class="mt-2 text-xs text-accent-blue">💡 {{ evaluation.suggestion }}</div>
    </div>

    <!-- 执行器信息 -->
    <div class="text-xs text-text-muted space-y-1">
      <div>执行器: <span class="text-text-secondary font-mono">{{ agent.handler_class || '通用 LLM' }}</span></div>
      <div v-if="agent.installed_at">安装时间: <span class="text-text-secondary">{{ formatDate(agent.installed_at) }}</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ agent: any, evaluation: any }>()

const statusLabel = computed(() => {
  const labels: Record<string, string> = { running: '运行中', completed: '已完成', error: '出错', idle: '就绪' }
  return labels[String(props.agent?.status || '')] || '就绪'
})

function formatDate(ts: number) { return ts ? new Date(ts * 1000).toLocaleString() : '' }
</script>
