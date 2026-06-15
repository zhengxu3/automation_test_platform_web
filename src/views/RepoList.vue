<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-medium">📦 Git 仓库</h2>
      <button @click="showCreate = true" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium hover:opacity-90 transition-opacity">+ 添加仓库</button>
    </div>

    <!-- 仓库列表 -->
    <div class="space-y-3">
      <div v-for="repo in repos" :key="repo.repo_id" class="border border-dark-border rounded-xl overflow-hidden">
        <!-- 主仓库行 -->
        <div class="flex items-center gap-4 p-4 bg-dark-800 hover:bg-dark-700 transition-colors">
          <span class="w-8 h-8 rounded-lg bg-dark-600 border border-dark-border flex items-center justify-center text-sm">📦</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-text-primary">{{ repo.repo_name }}</div>
            <div class="text-xs text-text-muted mt-0.5 truncate font-mono">{{ repo.git_url }}</div>
          </div>
          <span class="text-xs px-2 py-0.5 rounded bg-dark-600 text-text-secondary">{{ repo.language || '-' }}</span>
          <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(repo.status)">{{ statusText(repo.status) }}</span>
          <span v-if="repo.lock?.locked" class="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800">🔒 {{ repo.lock.locked_by }}</span>
          <div class="flex gap-1">
            <button @click="openBranch(repo)" class="p-1.5 rounded hover:bg-dark-600 text-text-muted hover:text-text-primary transition-colors" title="管理分支">🌿</button>
            <button @click="vectorize(repo)" :disabled="!canVectorize(repo)" class="p-1.5 rounded hover:bg-dark-600 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30" title="向量化">⚡</button>
            <button v-if="repo.lock?.locked" @click="unlock(repo)" class="p-1.5 rounded hover:bg-dark-600 text-amber-400 transition-colors" title="解锁">🔓</button>
            <button @click="deleteRepo(repo)" :disabled="!canDelete(repo)" class="p-1.5 rounded hover:bg-dark-600 text-red-400 transition-colors disabled:opacity-30" title="删除">🗑</button>
          </div>
        </div>
        <!-- 分支列表 -->
        <div v-if="repo.children?.length" class="border-t border-dark-border divide-y divide-dark-border">
          <div v-for="br in repo.children" :key="br.repo_id" class="flex items-center gap-4 px-4 py-3 pl-14 hover:bg-dark-700 transition-colors">
            <span class="text-xs text-text-muted">↳</span>
            <span class="text-sm font-mono text-text-secondary">{{ br.branch }}</span>
            <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(br.status)">{{ statusText(br.status) }}</span>
            <code v-if="br.last_commit" class="text-[10px] text-text-muted font-mono">{{ br.last_commit?.slice(0,8) }}</code>
            <div class="ml-auto flex gap-1">
              <button @click="vectorize(br)" :disabled="!canVectorize(br)" class="p-1 rounded hover:bg-dark-600 text-text-muted text-xs disabled:opacity-30">⚡</button>
              <button @click="deleteRepo(br)" :disabled="!canDelete(br)" class="p-1 rounded hover:bg-dark-600 text-red-400 text-xs disabled:opacity-30">🗑</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!repos.length && !loading" class="text-center text-text-muted py-16 text-sm">暂无仓库，点击右上角添加</div>
      <div v-if="loading" class="text-center text-text-muted py-16 text-sm animate-pulse">加载中...</div>
    </div>

    <!-- 创建弹窗 -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showCreate = false">
        <div class="bg-dark-800 border border-dark-border rounded-xl p-6 w-[420px]">
          <h3 class="text-base font-medium mb-4">添加 Git 仓库</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-text-muted mb-1 block">仓库名称</label>
              <input v-model="form.repo_name" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="如 monkey-android" />
            </div>
            <div>
              <label class="text-xs text-text-muted mb-1 block">Git SSH 地址</label>
              <input v-model="form.git_url" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent font-mono" placeholder="git@github.com:org/repo.git" />
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <label class="text-xs text-text-muted mb-1 block">分支</label>
                <input v-model="form.branch" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent font-mono" placeholder="master" />
              </div>
              <div class="flex-1">
                <label class="text-xs text-text-muted mb-1 block">语言</label>
                <select v-model="form.language" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                  <option value="python">Python</option>
                  <option value="go">Go</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="showCreate = false" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:bg-dark-700">取消</button>
            <button @click="submitCreate" :disabled="creating" class="px-4 py-2 rounded-lg bg-accent text-sm font-medium hover:opacity-90 disabled:opacity-50">{{ creating ? '创建中...' : '创建并拉取' }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 分支管理弹窗 -->
    <Teleport to="body">
      <div v-if="branchTarget" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="branchTarget = null">
        <div class="bg-dark-800 border border-dark-border rounded-xl p-6 w-[400px]">
          <h3 class="text-base font-medium mb-4">🌿 {{ branchTarget.repo_name }} - 添加分支</h3>
          <div class="space-y-2">
            <div class="flex gap-2">
              <input v-model="newBranch" class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent font-mono" placeholder="分支名 如 develop" @keyup.enter="addBranch" />
              <button @click="addBranch" :disabled="!newBranch.trim()" class="px-4 py-2 rounded-lg bg-accent text-sm hover:opacity-90 disabled:opacity-50">添加</button>
            </div>
            <div v-if="branchTarget.children?.length" class="text-xs text-text-muted mt-3">
              已有分支：
              <span v-for="b in branchTarget.children" :key="b.repo_id" class="inline-block px-2 py-0.5 rounded bg-dark-600 text-text-secondary mr-1 mt-1 font-mono">{{ b.branch }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import http from '@/api'

const repos = ref<any[]>([])
const loading = ref(false)
const showCreate = ref(false)
const creating = ref(false)
const form = ref({ repo_name: '', git_url: '', branch: 'master', language: 'android' })
const branchTarget = ref<any>(null)
const newBranch = ref('')
let timer: any = null

async function fetchList() {
  loading.value = true
  try {
    const res: any = await http.get('/ai/repo/list')
    const flat = res.data?.repos || []
    // 构建树形
    const childMap: Record<string, any[]> = {}
    flat.forEach((r: any) => {
      if (r.parent_repo_id) {
        if (!childMap[r.parent_repo_id]) childMap[r.parent_repo_id] = []
        childMap[r.parent_repo_id].push(r)
      }
    })
    repos.value = flat.filter((r: any) => !r.parent_repo_id).map((r: any) => ({ ...r, children: childMap[r.repo_id] || [] }))
  } finally { loading.value = false }
}

async function submitCreate() {
  if (!form.value.repo_name || !form.value.git_url) return
  creating.value = true
  try {
    await http.post('/ai/repo/create', form.value)
    showCreate.value = false
    form.value = { repo_name: '', git_url: '', branch: 'master', language: 'android' }
    fetchList()
  } finally { creating.value = false }
}

function openBranch(repo: any) { branchTarget.value = repo; newBranch.value = '' }

async function addBranch() {
  if (!newBranch.value.trim() || !branchTarget.value) return
  await http.post('/ai/repo/add_branch', { parent_repo_id: branchTarget.value.repo_id, branch: newBranch.value.trim() })
  branchTarget.value = null
  fetchList()
}

async function vectorize(repo: any) {
  if (!confirm(`确定对 [${repo.repo_name}/${repo.branch}] 执行向量化？`)) return
  await http.post('/ai/repo/vectorize', { repo_id: repo.repo_id })
  fetchList()
}

async function unlock(repo: any) {
  await http.post('/ai/repo/unlock', { repo_id: repo.repo_id })
  fetchList()
}

async function deleteRepo(repo: any) {
  if (!confirm(`确定删除 [${repo.repo_name}/${repo.branch || 'master'}]？不可恢复。`)) return
  await http.post('/ai/repo/delete', { repo_id: repo.repo_id })
  fetchList()
}

function canVectorize(r: any) { return ['ready', 'vectorized', 'vector_failed'].includes(r.status) && !r.lock?.locked }
function canDelete(r: any) { return !['cloning', 'vectorizing'].includes(r.status) && !r.lock?.locked }

function statusText(s: string) {
  return { pending: '等待', cloning: '拉取中', clone_failed: '拉取失败', ready: '就绪', vectorizing: '向量化中', vectorized: '向量就绪', vector_failed: '向量失败' }[s] || s
}
function statusClass(s: string) {
  const m: Record<string, string> = { pending: 'bg-dark-600 text-text-muted', cloning: 'bg-blue-900/30 text-blue-400', ready: 'bg-emerald-900/30 text-emerald-400', vectorizing: 'bg-blue-900/30 text-blue-400 animate-pulse', vectorized: 'bg-emerald-900/30 text-emerald-400', clone_failed: 'bg-red-900/30 text-red-400', vector_failed: 'bg-red-900/30 text-red-400' }
  return m[s] || 'bg-dark-600 text-text-muted'
}

onMounted(() => { fetchList(); timer = setInterval(fetchList, 10000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
