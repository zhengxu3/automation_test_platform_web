<template>
  <div class="h-full flex flex-col">
    <!-- 顶部栏 -->
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center gap-3">
        <button @click="$router.push('/requirements')" class="text-text-muted hover:text-text-primary text-sm">← 返回</button>
        <h2 class="text-base font-medium text-text-primary">{{ requirement.title }}</h2>
        <span class="text-xs px-2 py-0.5 rounded" :class="statusClass">
          <span v-if="requirement.status === 'analyzing'" class="inline-flex gap-0.5 mr-1"><span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span><span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse [animation-delay:0.15s]"></span></span>
          {{ statusText }}
        </span>
      </div>
      <div class="flex gap-2">
        <button @click="showInstall = true; fetchAvailableAgents()" class="px-3 py-1.5 rounded-lg border border-dark-border text-xs text-text-secondary hover:text-text-primary">+ 安装智能体</button>
      </div>
    </div>

    <!-- 聚合统计 -->
    <div class="flex gap-3 mb-4">
      <div class="flex-1 p-3 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="openPanel('memory')">
        <div class="text-lg font-mono font-medium text-text-primary">{{ stats.memory_count || 0 }}</div>
        <div class="text-xs text-text-muted mt-1">🧠 记忆点</div>
      </div>
      <div class="flex-1 p-3 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="openPanel('cases')">
        <div class="text-lg font-mono font-medium text-text-primary">{{ stats.case_count || 0 }}</div>
        <div class="text-xs text-text-muted mt-1">✓ Case</div>
      </div>
      <div class="flex-1 p-3 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="openPanel('issues')">
        <div class="text-lg font-mono font-medium" :class="stats.issue_count > 0 ? 'text-amber-400' : 'text-text-primary'">{{ stats.issue_count || 0 }}</div>
        <div class="text-xs text-text-muted mt-1">❓ 问题</div>
      </div>
      <div class="flex-1 p-3 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="openPanel('docs')">
        <div class="text-lg font-mono font-medium text-text-primary">{{ stats.doc_count || 0 }}</div>
        <div class="text-xs text-text-muted mt-1">📄 文档</div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="flex-1 flex gap-4 min-h-0">
      <!-- 左侧：智能体卡片 -->
      <div class="w-64 flex-shrink-0 overflow-auto">
        <div class="text-xs text-text-muted mb-2 px-1">已安装 ({{ agents.length }})</div>
        <div class="space-y-2">
          <div v-for="a in agents" :key="a.agent_id"
            @click="openAgentDetail(a)"
            class="p-3 rounded-lg border bg-dark-800 border-dark-border hover:border-dark-600 cursor-pointer transition-all">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :class="dotClass(a.status)"></span>
              <span class="text-sm text-text-primary flex-1 truncate">{{ a.agent_name || a.agent_id }}</span>
            </div>
            <div class="text-xs text-text-muted mt-1.5 flex justify-between">
              <span>{{ statusLabel(a.status) }}</span>
              <span v-if="a.status === 'running'" class="flex gap-0.5"><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></span><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse [animation-delay:0.15s]"></span><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse [animation-delay:0.3s]"></span></span>
              <span v-else-if="a.tokens" class="font-mono">{{ a.tokens }}t</span>
            </div>
          </div>
          <div v-if="!agents.length" class="text-xs text-text-muted text-center py-8">点击上方安装智能体</div>
        </div>
      </div>

      <!-- 右侧：结论日志流 -->
      <div class="flex-1 flex flex-col min-h-0">
        <div class="text-xs text-text-muted mb-2">📍 结论 & 日志</div>
        <div class="flex-1 overflow-auto rounded-lg border border-dark-border bg-dark-800 p-4 space-y-3">
          <div v-for="log in logs" :key="log.timestamp" class="p-3 rounded-lg" :class="logBg(log)">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium text-text-secondary">{{ log.agent_id ? agentNameMap[log.agent_id] || log.agent_id : '系统' }}</span>
              <span class="text-[10px] text-text-muted">{{ formatTime(log.timestamp) }}</span>
              <span v-if="log.type === 'conclusion'" class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">结论</span>
            </div>
            <div class="text-sm text-text-primary whitespace-pre-wrap">{{ log.chunk }}</div>
          </div>
          <div v-if="!logs.length" class="text-text-muted text-sm text-center py-8">等待智能体运行产出...</div>
        </div>
      </div>
    </div>

    <!-- 底部对话框 -->
    <div class="mt-3 border border-dark-border rounded-lg bg-dark-800 p-3">
      <div v-if="conversation.length" class="max-h-32 overflow-auto mb-2 space-y-2">
        <div v-for="msg in conversation.slice(-4)" :key="msg.timestamp" class="text-xs" :class="msg.role === 'user' ? 'text-accent-blue' : 'text-text-secondary'">
          <span class="font-medium">{{ msg.role === 'user' ? '我' : 'AI' }}:</span> {{ msg.content }}
        </div>
      </div>
      <div v-if="chatLoading" class="flex items-center gap-2 mb-2 text-xs text-text-muted">
        <span class="flex gap-1"><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.2s]"></span><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.4s]"></span></span>
        思考中...
      </div>
      <div class="flex gap-2">
        <input v-model="chatInput" @keydown.enter="sendChat" :disabled="chatLoading" placeholder="和记忆体对话..."
          class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50" />
        <button @click="sendChat" :disabled="chatLoading || !chatInput.trim()" class="px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm hover:bg-accent/30 disabled:opacity-30">发送</button>
      </div>
    </div>

    <!-- 安装弹窗 -->
    <div v-if="showInstall" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showInstall = false">
      <div class="w-[400px] bg-dark-800 border border-dark-border rounded-xl p-6 max-h-[70vh] overflow-auto">
        <h3 class="text-base font-medium mb-4">安装智能体</h3>
        <div v-for="a in availableAgents" :key="a.agent_id" class="flex justify-between items-center py-3 border-b border-dark-border last:border-0">
          <div>
            <div class="text-sm text-text-primary">{{ a.agent_name }}</div>
            <div class="text-xs text-text-muted">{{ a.description?.slice(0, 50) }}</div>
          </div>
          <button @click="doInstall(a)" class="text-xs px-3 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30">安装</button>
        </div>
        <div v-if="!availableAgents.length" class="text-text-muted text-sm text-center py-8">无可安装智能体</div>
        <button @click="showInstall = false" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 智能体详情弹窗 -->
    <agent-dialog
      :agent="agentDetail"
      :logs="agentDetail ? (agentLogs[agentDetail.agent_id] || []) : []"
      :output="agentDetail ? (agentOutputs[agentDetail.agent_id] || '') : ''"
      :evaluation="agentDetail ? (agentEvals[agentDetail.agent_id] || {}) : {}"
      :screenshots="[]"
      @close="agentDetail = null"
      @run="handleRunFromDialog"
      @uninstall="handleUninstallFromDialog"
    />

    <!-- ===== 面板弹窗 ===== -->

    <!-- 记忆弹窗 -->
    <div v-if="panelOpen === 'memory'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="panelOpen = ''">
      <div class="w-[700px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">🧠 需求记忆</h3>
        <div class="space-y-3">
          <div v-for="m in memories" :key="m.point_id" class="p-3 rounded-lg bg-dark-900 border border-dark-border" :class="{ 'border-accent/50': m.pinned }">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-medium text-accent-blue">{{ m.run_context?.agent_name || '系统' }}</span>
              <span class="text-[10px] text-text-muted">{{ formatTime(m.created_at) }}</span>
              <span v-if="m.pinned" class="text-[10px] text-accent">📌 已钉选</span>
              <span class="ml-auto text-[10px] text-text-muted">{{ m.source }}</span>
            </div>
            <div class="text-sm text-text-primary">{{ m.summary }}</div>
            <div v-if="m.key_facts?.length" class="mt-1 flex flex-wrap gap-1">
              <span v-for="f in m.key_facts" :key="f" class="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-text-muted">{{ f }}</span>
            </div>
            <div class="mt-2 flex gap-2">
              <button @click="togglePin(m)" class="text-[10px] text-text-muted hover:text-accent">{{ m.pinned ? '取消钉选' : '📌 钉选' }}</button>
            </div>
          </div>
          <div v-if="!memories.length" class="text-text-muted text-sm text-center py-8">暂无记忆点</div>
        </div>
        <button @click="panelOpen = ''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- Case 弹窗 -->
    <div v-if="panelOpen === 'cases'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="panelOpen = ''">
      <div class="w-[700px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-base font-medium">✓ 测试用例</h3>
          <div class="flex gap-1">
            <button v-for="f in ['all','active','passed','failed']" :key="f" @click="caseFilter = f"
              class="text-[10px] px-2 py-1 rounded" :class="caseFilter === f ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-secondary'">
              {{ caseFilterLabel(f) }}
            </button>
          </div>
        </div>
        <!-- 统计 -->
        <div class="flex gap-4 mb-3 text-xs text-text-muted">
          <span>总计 {{ caseStats.total }}</span>
          <span class="text-emerald-400">有效 {{ caseStats.active }}</span>
          <span class="text-green-400">通过 {{ caseStats.passed }}</span>
          <span class="text-red-400">失败 {{ caseStats.failed }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="c in filteredCases" :key="c.case_id" class="flex items-start gap-2 p-2 rounded-lg bg-dark-900 border border-dark-border">
            <span class="mt-0.5 text-xs" :class="{'text-emerald-400': c.status==='passed', 'text-red-400': c.status==='failed', 'text-text-muted': c.status==='active'}">
              {{ caseStatusIcon(c.status) }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-text-primary">{{ c.title }}</div>
              <div class="text-[10px] text-text-muted mt-0.5 flex gap-2">
                <span class="px-1 rounded" :class="c.priority === 'P0' ? 'bg-red-900/30 text-red-400' : c.priority === 'P1' ? 'bg-amber-900/30 text-amber-400' : 'bg-dark-700'">{{ c.priority }}</span>
                <span>v{{ c.source_round || 1 }}</span>
              </div>
            </div>
          </div>
          <div v-if="!filteredCases.length" class="text-text-muted text-sm text-center py-8">暂无用例</div>
        </div>
        <button @click="panelOpen = ''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 问题弹窗 -->
    <div v-if="panelOpen === 'issues'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="panelOpen = ''">
      <div class="w-[600px] max-h-[70vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">❓ 问题追踪</h3>
        <div class="space-y-2">
          <div v-for="iss in issues" :key="iss.timestamp" class="p-3 rounded-lg bg-dark-900 border" :class="iss.status === 'bug' ? 'border-red-900/50' : iss.status === 'ignored' ? 'border-dark-border opacity-60' : 'border-amber-900/30'">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs px-1.5 py-0.5 rounded" :class="iss.status === 'bug' ? 'bg-red-900/30 text-red-400' : iss.status === 'ignored' ? 'bg-dark-700 text-text-muted' : 'bg-amber-900/30 text-amber-400'">
                {{ issueStatusLabel(iss.status) }}
              </span>
              <span class="text-[10px] text-text-muted">{{ formatTime(iss.timestamp) }}</span>
            </div>
            <div class="text-sm text-text-primary">{{ iss.chunk }}</div>
            <div v-if="iss.status === 'pending'" class="mt-2 flex gap-2">
              <button @click="resolveIssue(iss, 'bug')" class="text-[10px] px-2 py-1 rounded border border-red-900/50 text-red-400 hover:bg-red-900/20">标记 Bug</button>
              <button @click="resolveIssue(iss, 'ignored')" class="text-[10px] px-2 py-1 rounded border border-dark-border text-text-muted hover:text-text-secondary">忽略</button>
            </div>
          </div>
          <div v-if="!issues.length" class="text-text-muted text-sm text-center py-8">暂无问题</div>
        </div>
        <button @click="panelOpen = ''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 文档弹窗 -->
    <div v-if="panelOpen === 'docs'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="panelOpen = ''">
      <div class="w-[800px] max-h-[85vh] bg-dark-800 border border-dark-border rounded-xl p-6 flex flex-col">
        <h3 class="text-base font-medium mb-4">📄 需求文档</h3>
        <!-- 文档 Tab -->
        <div class="flex gap-1 mb-3">
          <button v-for="d in docs" :key="d.doc_type" @click="activeDoc = d.doc_type"
            class="px-3 py-1.5 rounded-lg text-xs transition-colors"
            :class="activeDoc === d.doc_type ? 'bg-dark-600 text-text-primary' : 'text-text-muted hover:text-text-secondary'">
            {{ d.doc_type_label }}
            <span class="ml-1 text-[10px] text-text-muted">v{{ d.version }}</span>
          </button>
        </div>
        <div class="flex-1 overflow-auto rounded-lg bg-dark-900 border border-dark-border p-4">
          <div v-if="currentDoc" class="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{{ currentDoc.content }}</div>
          <div v-else class="text-text-muted text-sm text-center py-8">运行需求分析智能体后自动生成文档</div>
        </div>
        <div v-if="currentDoc" class="mt-2 text-[10px] text-text-muted flex justify-between">
          <span>来源: {{ currentDoc.source === 'ai_generate' ? 'AI 生成' : '手动上传' }} · {{ formatTime(currentDoc.updated_at) }}</span>
        </div>
        <button @click="panelOpen = ''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import http from '@/api'
import AgentDialog from './workspace/AgentDialog.vue'

const route = useRoute()
const reqId = computed(() => route.params.reqId as string)

// 数据
const requirement = ref<any>({})
const agents = ref<any[]>([])
const logs = ref<any[]>([])
const stats = ref<any>({})
const conversation = ref<any[]>([])
const agentLogs = ref<Record<string, any[]>>({})
const agentOutputs = ref<Record<string, string>>({})
const agentEvals = ref<Record<string, any>>({})

// 面板数据
const panelOpen = ref('')
const memories = ref<any[]>([])
const cases = ref<any[]>([])
const caseStats = ref<any>({})
const caseFilter = ref('all')
const issues = ref<any[]>([])
const docs = ref<any[]>([])
const activeDoc = ref('')

// UI
const chatInput = ref('')
const chatLoading = ref(false)
const showInstall = ref(false)
const agentDetail = ref<any>(null)
const availableAgents = ref<any[]>([])
let pollTimer: any = null

const agentNameMap = computed(() => {
  const m: Record<string, string> = {}
  agents.value.forEach(a => { m[a.agent_id] = a.agent_name || a.agent_id })
  return m
})

const filteredCases = computed(() => {
  if (caseFilter.value === 'all') return cases.value
  return cases.value.filter(c => c.status === caseFilter.value)
})

const currentDoc = computed(() => docs.value.find(d => d.doc_type === activeDoc.value) || null)

const statusClass = computed(() => {
  const classes: Record<string, string> = {
    ready: 'bg-emerald-900/30 text-emerald-400',
    analyzing: 'bg-amber-900/30 text-amber-400',
    working: 'bg-blue-900/30 text-blue-400',
  }
  return classes[String(requirement.value.status || '')] || 'bg-dark-600 text-text-muted'
})
const statusText = computed(() => {
  const labels: Record<string, string> = {
    ready: '就绪',
    analyzing: '分析中...',
    working: '工作中',
    completed: '已完结',
  }
  return labels[String(requirement.value.status || '')] || '新建'
})

function dotClass(status: string) {
  return { running: 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)] animate-pulse', completed: 'bg-emerald-400', error: 'bg-red-400', idle: 'bg-zinc-600' }[status] || 'bg-zinc-600'
}
function statusLabel(status: string) {
  return { running: '运行中...', completed: '已完成', error: '出错', idle: '就绪' }[status] || '就绪'
}
function logBg(log: any) {
  if (log.type === 'conclusion') return 'bg-accent/5 border border-accent/20'
  if (log.status === 'error') return 'bg-red-900/10 border border-red-900/30'
  return 'bg-dark-900'
}
function formatTime(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString().slice(0, 8) : '' }
function caseFilterLabel(status: string) {
  const labels: Record<string, string> = { all: '全部', active: '有效', passed: '通过', failed: '失败' }
  return labels[status] || status
}
function caseStatusIcon(status: string) {
  const icons: Record<string, string> = { passed: '✅', failed: '❌', active: '○' }
  return icons[status] || '○'
}
function issueStatusLabel(status: string) {
  const labels: Record<string, string> = { pending: '待处理', bug: 'Bug', ignored: '已忽略', resolved: '已解决' }
  return labels[status] || status
}

async function fetchData() {
  try {
    const res: any = await http.get('/ai/req/detail', { params: { req_id: reqId.value } })
    requirement.value = res.data?.requirement || {}
    agents.value = res.data?.workspace_agents || []
    stats.value = res.data?.stats || {}
  } catch {}
}

async function fetchLogs() {
  try {
    const res: any = await http.get('/ai/req/logs', { params: { req_id: reqId.value, offset: 0 } })
    logs.value = (res.data?.logs || []).slice(-30)
  } catch {}
}

async function openPanel(panel: string) {
  panelOpen.value = panel
  if (panel === 'memory') {
    const res: any = await http.get('/ai/req/memories', { params: { req_id: reqId.value } })
    memories.value = res.data?.memories || []
  } else if (panel === 'cases') {
    const res: any = await http.get('/ai/req/cases', { params: { req_id: reqId.value } })
    cases.value = res.data?.cases || []
    caseStats.value = res.data?.stats || {}
  } else if (panel === 'issues') {
    const res: any = await http.get('/ai/req/issues', { params: { req_id: reqId.value } })
    issues.value = res.data?.issues || []
  } else if (panel === 'docs') {
    const res: any = await http.get('/ai/req/docs', { params: { req_id: reqId.value } })
    docs.value = res.data?.docs || []
    if (docs.value.length && !activeDoc.value) activeDoc.value = docs.value[0].doc_type
  }
}

async function togglePin(m: any) {
  const newPinned = !m.pinned
  await http.post('/ai/req/memories/pin', { point_id: m.point_id, pinned: newPinned })
  m.pinned = newPinned
}

async function resolveIssue(iss: any, action: string) {
  await http.post('/ai/req/resolve_issue', { req_id: reqId.value, title: iss.chunk, action })
  iss.status = action
}

function openAgentDetail(a: any) {
  agentDetail.value = a
  // 拉取该 agent 的日志和产出
  fetchAgentData(a.agent_id)
}

async function fetchAgentData(agentId: string) {
  try {
    const [logsRes, outputsRes]: any[] = await Promise.all([
      http.get('/ai/req/logs', { params: { req_id: reqId.value, agent_id: agentId } }),
      http.get('/ai/req/outputs', { params: { req_id: reqId.value, agent_id: agentId } }),
    ])
    agentLogs.value[agentId] = logsRes.data?.logs || []
    const outputs = outputsRes.data?.outputs || []
    // 取最长的产出内容（通常是 AI 生成的代码/分析）
    if (outputs.length) {
      const longest = outputs.reduce((a: any, b: any) => (a.content?.length || 0) > (b.content?.length || 0) ? a : b)
      agentOutputs.value[agentId] = longest.content || ''
    }
  } catch {}
}

async function fetchAvailableAgents() {
  const res: any = await http.get('/ai/agent/list')
  const installed = new Set(agents.value.map((a: any) => a.agent_id))
  availableAgents.value = (res.data?.agents || []).filter((a: any) => !installed.has(a.agent_id))
}

async function doInstall(a: any) {
  await http.post('/ai/req/install_agent', { req_id: reqId.value, agent_id: a.agent_id })
  showInstall.value = false
  fetchData()
}

async function runAgent(a: any, inputs?: Record<string, any>) {
  a.status = 'running'
  try {
    const res: any = await http.post('/ai/req/run_agent', { req_id: reqId.value, agent_id: a.agent_id, inputs: inputs || {} })
    a.status = 'completed'
    a.tokens = res.data?.tokens?.total_tokens || 0
    if (res.data?.evaluation) {
      agentEvals.value[a.agent_id] = res.data.evaluation
    }
    if (res.data?.output) {
      agentOutputs.value[a.agent_id] = res.data.output
    }
    // 刷新统计和日志
    fetchData()
    fetchLogs()
  } catch {
    a.status = 'error'
  }
}

async function uninstallAgent(a: any) {
  await http.post('/ai/req/uninstall_agent', { req_id: reqId.value, agent_id: a.agent_id })
  agents.value = agents.value.filter(ag => ag.agent_id !== a.agent_id)
}

function handleRunFromDialog(agent: any, inputs: Record<string, any>) { agentDetail.value = null; runAgent(agent, inputs) }
function handleUninstallFromDialog(agent: any) { agentDetail.value = null; uninstallAgent(agent) }

async function sendChat() {
  if (!chatInput.value.trim() || chatLoading.value) return
  const msg = chatInput.value
  chatInput.value = ''
  conversation.value.push({ role: 'user', content: msg, timestamp: Date.now() / 1000 })
  chatLoading.value = true
  const aiMsg = { role: 'ai', content: '', timestamp: Date.now() / 1000 }
  conversation.value.push(aiMsg)

  try {
    const baseURL = import.meta.env.DEV ? '/api' : ''
    const res = await fetch(`${baseURL}/ai/req/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Token': localStorage.getItem('ai_token') || '' },
      body: JSON.stringify({ req_id: reqId.value, question: msg })
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          if (data.startsWith('[ERROR]')) { aiMsg.content += `⚠️ ${data.slice(7)}`; break }
          aiMsg.content += data
        }
      }
    }
  } catch {
    aiMsg.content = '⚠️ 请求失败'
  } finally {
    chatLoading.value = false
  }
}

onMounted(() => {
  fetchData()
  fetchLogs()
  // 分析中时轮询刷新
  pollTimer = setInterval(() => {
    if (requirement.value.status === 'analyzing' || agents.value.some(a => a.status === 'running')) {
      fetchData()
      fetchLogs()
    }
  }, 5000)
})
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>
