<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-medium">🎯 Goal 自主任务</h2>
      <button @click="showCreate = true" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium hover:opacity-90">+ 创建 Goal</button>
    </div>

    <!-- Goal 列表 -->
    <div class="space-y-3">
      <div v-for="g in goals" :key="g.goal_id"
        @click="$router.push(`/goal/${g.goal_id}`)"
        class="p-4 rounded-xl border border-dark-border bg-dark-800 hover:bg-dark-700 cursor-pointer transition-colors">
        <div class="flex justify-between items-center">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-text-primary">{{ g.title }}</div>
            <div class="text-xs text-text-muted mt-1 flex items-center gap-3">
              <span>{{ g.goal_statement?.slice(0, 60) || '规划中...' }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(g.status)">
              <span v-if="isActive(g.status)" class="inline-flex gap-0.5 mr-1"><span class="w-1 h-1 rounded-full animate-pulse" :class="dotColor(g.status)"></span></span>
              {{ statusText(g.status) }}
            </span>
            <span v-if="g.trigger === 'webhook'" class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">🪝 钩子</span>
            <span class="text-xs text-text-muted font-mono">{{ formatDate(g.created_at) }}</span>
          </div>
        </div>
      </div>
      <div v-if="!goals.length" class="text-center text-text-muted py-12 text-sm">暂无 Goal，点击右上角创建</div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="flex items-center justify-center gap-3 mt-5 text-sm">
      <button @click="goPage(page - 1)" :disabled="page <= 1"
        class="px-3 py-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed">上一页</button>
      <span class="text-text-muted">第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 个</span>
      <button @click="goPage(page + 1)" :disabled="page >= totalPages"
        class="px-3 py-1.5 rounded-lg border border-dark-border text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed">下一页</button>
    </div>

    <!-- 创建弹窗 -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreate = false">
      <div class="w-[600px] bg-dark-800 border border-dark-border rounded-xl p-6 max-h-[85vh] overflow-auto">
        <h3 class="text-base font-medium mb-4">创建 Goal</h3>
        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="text-xs text-text-muted mb-1 block">目标标题</label>
            <input v-model="form.title" placeholder="如：验证登录模块变更" data-testid="goal-title"
              class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
          </div>

          <!-- 需求描述/文档（动态数量）-->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-text-muted">需求文档（可加多个，可选）</label>
              <button type="button" @click="addDoc" data-testid="add-doc"
                class="text-[11px] px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30">+ 添加文档</button>
            </div>
            <div class="space-y-2">
              <div v-for="(d, i) in form.docs" :key="i" class="flex gap-2 items-start" data-testid="doc-row">
                <textarea v-model="d.content" :placeholder="`需求文档 ${i + 1}：粘贴描述/PRD/接口说明`" rows="2"
                  class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"></textarea>
                <button type="button" @click="removeDoc(i)" class="text-text-muted hover:text-red-400 text-sm px-1 pt-1">✕</button>
              </div>
              <div v-if="!form.docs.length" class="text-xs text-text-muted py-1">未添加文档（纯代码模式）</div>
            </div>
          </div>

          <!-- 代码库（动态数量：地址 + 分支 + 角色）-->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs text-text-muted">关联代码库（可加多个，留空=纯文档）</label>
              <button type="button" @click="addRepo" data-testid="add-repo"
                class="text-[11px] px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30">+ 添加代码库</button>
            </div>
            <datalist id="repo-suggestions">
              <option v-for="r in repos" :key="r.repo_id" :value="r.git_url || r.repo_id">{{ r.repo_name }}</option>
            </datalist>
            <div class="space-y-2">
              <div v-for="(row, i) in form.repos" :key="i" class="flex gap-2 items-center" data-testid="repo-row">
                <input v-model="row.git_url" list="repo-suggestions" placeholder="git 地址 / 库ID"
                  class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
                <input v-model="row.branch" placeholder="分支"
                  class="w-20 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
                <select v-model="row.role"
                  class="w-24 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary focus:outline-none focus:border-accent">
                  <option value="">自动识别</option>
                  <option value="backend">后端</option>
                  <option value="web">前端Web</option>
                  <option value="client">客户端</option>
                  <option value="fullstack">混合前后端</option>
                </select>
                <button type="button" @click="removeRepo(i)" class="text-text-muted hover:text-red-400 text-sm px-1">✕</button>
              </div>
              <div v-if="!form.repos.length" class="text-xs text-text-muted py-1">未添加代码库（纯文档模式）</div>
            </div>
          </div>

          <!-- 测试环境（可选；演示用 mock 时填）-->
          <div>
            <label class="text-xs text-text-muted mb-1 block">测试环境（可选）</label>
            <div class="flex gap-2">
              <input v-model="form.env.base_url" placeholder="后端 base_url"
                class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
              <input v-model="form.env.web_url" placeholder="web_url"
                class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
            </div>
            <label class="flex items-center gap-2 mt-2 text-xs text-text-muted cursor-pointer">
              <input type="checkbox" v-model="form.env.mock" class="rounded" />
              测试执行用模拟(mock)·多轮由代码提交驱动（演示用）
            </label>
          </div>

          <!-- 完成策略 -->
          <div>
            <label class="text-xs text-text-muted mb-1 block">完成策略</label>
            <div class="flex gap-2">
              <label class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs"
                :class="form.completion_policy === 'auto_complete' ? 'border-accent text-accent bg-accent/10' : 'border-dark-border text-text-muted'">
                <input type="radio" value="auto_complete" v-model="form.completion_policy" class="hidden" />
                ✓ 达标即停
              </label>
              <label class="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs"
                :class="form.completion_policy === 'continuous' ? 'border-accent text-accent bg-accent/10' : 'border-dark-border text-text-muted'">
                <input type="radio" value="continuous" v-model="form.completion_policy" class="hidden" />
                🛡️ 持续守护
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-xs text-text-muted">多轮方式</label>
            <label class="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input type="checkbox" :checked="!form.auto_replan" @change="form.auto_replan = !($event.target as HTMLInputElement).checked" class="rounded" />
              外部驱动（一次代码提交=一轮；关闭则引擎失败自动重试多轮）
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showCreate = false" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:text-text-primary">取消</button>
            <button type="submit" :disabled="creating || !form.title.trim()" data-testid="goal-submit"
              class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium disabled:opacity-50">
              {{ creating ? '创建中...' : '创建并规划' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api'

const router = useRouter()
const goals = ref<any[]>([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const repos = ref<any[]>([])
const showCreate = ref(false)
const creating = ref(false)
const form = ref({
  title: '',
  docs: [{ content: '' }] as any[],
  repos: [{ git_url: '', branch: 'main', role: '' }] as any[],
  env: { base_url: '', web_url: '', mock: true },
  completion_policy: 'continuous',
  auto_replan: false,
})

function addDoc() { form.value.docs.push({ content: '' }) }
function removeDoc(i: number) { form.value.docs.splice(i, 1) }
function addRepo() { form.value.repos.push({ git_url: '', branch: 'main', role: '' }) }
function removeRepo(i: number) { form.value.repos.splice(i, 1) }

function resetForm() {
  form.value = {
    title: '', docs: [{ content: '' }],
    repos: [{ git_url: '', branch: 'main', role: '' }],
    env: { base_url: '', web_url: '', mock: true },
    completion_policy: 'continuous', auto_replan: false,
  }
}

async function fetchList() {
  const res: any = await http.get('/ai/goal/list', { params: { page: page.value, page_size: pageSize.value } })
  goals.value = res.data?.goals || []
  total.value = res.data?.total ?? goals.value.length
}

function goPage(p: number) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  fetchList()
}

async function fetchRepos() {
  try {
    const res: any = await http.get('/ai/repo/list')
    repos.value = res.data?.repos || []
  } catch {}
}

async function handleCreate() {
  if (!form.value.title.trim()) return
  creating.value = true
  try {
    const sources: any[] = []
    for (const d of form.value.docs) {
      if (d.content && d.content.trim()) sources.push({ type: 'doc', content: d.content })
    }
    for (const row of form.value.repos) {
      if (!row.git_url || !row.git_url.trim()) continue
      sources.push({
        type: 'repo',
        git_url: row.git_url.trim(),
        branch: (row.branch || 'main').trim(),
        role: row.role || '',
      })
    }
    const e = form.value.env
    if (e.base_url.trim() || e.web_url.trim() || e.mock) {
      const envSrc: any = {
        type: 'environment',
        base_url: e.base_url.trim(),
        web_url: e.web_url.trim(),
        api_test_mock: e.mock,
        web_test_mock: e.mock,
        device_test_mock: e.mock,
        mock_fail_rounds: 0,
        test_accounts: [],
      }
      if (e.mock) {
        // mock 演示自给自足：没填 URL 就补占位，让 api_test/web_test 也可达（mock 不真连）
        if (!envSrc.base_url) envSrc.base_url = 'http://mock.local:8080'
        if (!envSrc.web_url) envSrc.web_url = 'http://mock.local:3001'
        envSrc.apk_source = 'mock://demo.apk'
        envSrc.device_profile = { platform: 'mock', mock: true }
        envSrc.test_accounts = [{ phone: '13800000000' }]
      }
      sources.push(envSrc)
    }
    const res: any = await http.post('/ai/goal/create', {
      title: form.value.title,
      sources,
      completion_policy: form.value.completion_policy,
      auto_replan: form.value.auto_replan,
    })
    showCreate.value = false
    resetForm()
    router.push(`/goal/${res.data.goal_id}`)
  } finally {
    creating.value = false
  }
}

function statusClass(s: string) {
  return {
    discovering: 'bg-purple-900/30 text-purple-400',
    planning: 'bg-purple-900/30 text-purple-400',
    awaiting_approval: 'bg-amber-900/30 text-amber-400',
    running: 'bg-blue-900/30 text-blue-400',
    verifying: 'bg-cyan-900/30 text-cyan-400',
    guarding: 'bg-emerald-900/30 text-emerald-400',
    completed: 'bg-emerald-900/30 text-emerald-400',
    partial_completed: 'bg-orange-900/30 text-orange-400',
    blocked: 'bg-red-900/30 text-red-400',
    failed: 'bg-red-900/30 text-red-400',
  }[s] || 'bg-dark-600 text-text-muted'
}
function statusText(s: string) {
  return {
    discovering: '画像中', planning: '规划中', awaiting_approval: '待审批',
    running: '执行中', verifying: '验收中', guarding: '守护中',
    completed: '已完成', partial_completed: '部分完成', blocked: '阻塞', failed: '失败',
  }[s] || s
}
function isActive(s: string) {
  return ['discovering', 'planning', 'running', 'verifying'].includes(s)
}
function dotColor(s: string) {
  return { running: 'bg-blue-400', verifying: 'bg-cyan-400' }[s] || 'bg-purple-400'
}
function formatDate(ts: number) { return ts ? new Date(ts * 1000).toLocaleString().slice(5) : '' }

onMounted(() => { fetchList(); fetchRepos() })
</script>
