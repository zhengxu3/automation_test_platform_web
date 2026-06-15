<template>
  <div v-if="agent" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="w-[600px] bg-dark-800 border border-dark-border rounded-xl max-h-[85vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex justify-between items-center p-5 border-b border-dark-border">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" :class="dotClass(agent.status)"></span>
          <h3 class="text-base font-medium text-text-primary">{{ agent.agent_name || agent.agent_id }}</h3>
          <span class="text-xs text-text-muted px-2 py-0.5 rounded bg-dark-600">{{ agent.category }}</span>
        </div>
        <button @click="$emit('close')" class="text-text-muted hover:text-text-primary text-lg">✕</button>
      </div>

      <!-- Tab 切换 -->
      <div class="flex gap-1 px-5 pt-3">
        <button v-for="tab in visibleTabs" :key="tab.key" @click="activeTab = tab.key"
          class="px-3 py-1.5 rounded-lg text-xs transition-colors"
          :class="activeTab === tab.key ? 'bg-dark-600 text-text-primary' : 'text-text-muted hover:text-text-secondary'">
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab 内容 -->
      <div class="flex-1 overflow-auto p-5">
        <overview-panel v-if="activeTab === 'overview'" :agent="agent" :evaluation="evaluation" />
        <log-panel v-if="activeTab === 'logs'" :logs="logs" />
        <output-panel v-if="activeTab === 'output'" :content="output" />
        <screenshot-panel v-if="activeTab === 'screenshots'" :screenshots="screenshots" />
      </div>

      <!-- 底部：运行参数 + 操作 -->
      <div class="border-t border-dark-border p-5">
        <!-- 动态参数（如有 inputs） -->
        <div v-if="agent.inputs?.length" class="mb-3 space-y-2">
          <div v-for="inp in visibleInputs" :key="inp.key" class="flex items-center gap-2">
            <label class="text-xs text-text-muted w-24 flex-shrink-0">{{ inp.label || inp.key }}</label>
            <!-- repo_select：仓库选择 -->
            <select v-if="inp.type === 'repo_select'" v-model="runInputs[inp.key]" class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary focus:outline-none focus:border-accent">
              <option value="">请选择仓库/分支</option>
              <option v-for="r in repos" :key="r.repo_id" :value="r.repo_id" :disabled="r.status !== 'ready'">
                {{ r.repo_name }}/{{ r.branch }} {{ r.status !== 'ready' ? `(${r.status})` : '' }}
              </option>
            </select>
            <!-- select：普通下拉 -->
            <select v-else-if="inp.type === 'select'" v-model="runInputs[inp.key]" class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary focus:outline-none focus:border-accent">
              <option v-for="opt in inp.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <!-- switch -->
            <label v-else-if="inp.type === 'switch'" class="flex items-center gap-2 flex-1">
              <input type="checkbox" v-model="runInputs[inp.key]" class="rounded" />
              <span class="text-xs text-text-secondary">{{ inp.placeholder || '启用' }}</span>
            </label>
            <!-- 默认：文本输入 -->
            <input v-else v-model="runInputs[inp.key]" :placeholder="inp.placeholder || inp.key" class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
            <span v-if="inp.required" class="text-red-400 text-xs">*</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="$emit('run', agent, runInputs)" :disabled="agent.status === 'running'" class="px-4 py-2 rounded-lg bg-accent/20 text-accent text-xs font-medium hover:bg-accent/30 disabled:opacity-30">▶ 运行</button>
          <button @click="$emit('uninstall', agent)" :disabled="agent.status === 'running'" class="px-4 py-2 rounded-lg border border-dark-border text-xs text-text-muted hover:text-red-400 hover:border-red-900 disabled:opacity-30">卸载</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import OverviewPanel from './panels/OverviewPanel.vue'
import LogPanel from './panels/LogPanel.vue'
import OutputPanel from './panels/OutputPanel.vue'
import ScreenshotPanel from './panels/ScreenshotPanel.vue'

const props = defineProps<{
  agent: any
  logs: any[]
  output: string
  evaluation: any
  screenshots: any[]
}>()

defineEmits(['close', 'run', 'uninstall'])

const activeTab = ref('overview')
const runInputs = ref<Record<string, any>>({})
const repos = ref<any[]>([])
const visibleInputs = computed(() => (props.agent?.inputs || []).filter((i: any) => !i.fixed))

// 根据 handler 类型决定展示哪些 Tab
const visibleTabs = computed(() => {
  const tabs = [
    { key: 'overview', label: '概览' },
    { key: 'logs', label: '日志' },
    { key: 'output', label: '产出' },
  ]
  const handler = props.agent?.handler_class || ''
  if (handler === 'device_script' || props.screenshots?.length) {
    tabs.push({ key: 'screenshots', label: '截图' })
  }
  return tabs
})

function dotClass(status: string) {
  return { running: 'bg-blue-400 animate-pulse', completed: 'bg-emerald-400', error: 'bg-red-400' }[status] || 'bg-zinc-600'
}

// 加载仓库列表（有 repo_select 类型的 input 时）
async function fetchRepos() {
  const hasRepoInput = props.agent?.inputs?.some((i: any) => i.type === 'repo_select')
  if (hasRepoInput) {
    const { default: http } = await import('@/api')
    const res: any = await http.get('/ai/repo/list')
    repos.value = res.data?.repos || []
  }
}

// 重置 tab 和 inputs
watch(() => props.agent, () => {
  activeTab.value = 'overview'
  runInputs.value = {}
  repos.value = []
  if (props.agent) {
    // 填充默认值
    props.agent.inputs?.forEach((inp: any) => {
      if (inp.default) runInputs.value[inp.key] = inp.default
    })
    fetchRepos()
  }
})
</script>
