<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-medium">📋 需求管理</h2>
      <button @click="showCreate = true" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium hover:opacity-90">+ 创建需求</button>
    </div>

    <!-- 需求列表 -->
    <div class="space-y-3">
      <div v-for="req in requirements" :key="req.req_id"
        @click="$router.push(`/workspace/${req.req_id}`)"
        class="p-4 rounded-xl border border-dark-border bg-dark-800 hover:bg-dark-700 cursor-pointer transition-colors">
        <div class="flex justify-between items-center">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-text-primary">{{ req.title }}</div>
            <div class="text-xs text-text-muted mt-1 flex items-center gap-3">
              <span>{{ req.description?.slice(0, 60) || '无描述' }}</span>
              <span v-if="req.doc_filename" class="text-accent-blue">📄 {{ req.doc_filename }}</span>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(req.status)">
              <span v-if="req.status === 'analyzing'" class="inline-flex gap-0.5 mr-1"><span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"></span><span class="w-1 h-1 rounded-full bg-amber-400 animate-pulse [animation-delay:0.15s]"></span></span>
              {{ statusText(req.status) }}
            </span>
            <span class="text-xs text-text-muted font-mono">{{ formatDate(req.created_at) }}</span>
            <!-- 上传按钮（未分析时） -->
            <button v-if="!req.doc_filename && req.status === 'ready'" @click.stop="openUpload(req)" class="text-xs px-2 py-1 rounded border border-dark-border text-text-muted hover:text-accent hover:border-accent">📤 上传</button>
          </div>
        </div>
      </div>
      <div v-if="!requirements.length" class="text-center text-text-muted py-12 text-sm">暂无需求，点击右上角创建</div>
    </div>

    <!-- 创建弹窗 -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreate = false">
      <div class="w-[560px] bg-dark-800 border border-dark-border rounded-xl p-6">
        <h3 class="text-base font-medium mb-4">创建需求</h3>
        <form @submit.prevent="handleCreate" class="space-y-4">
          <div>
            <label class="text-xs text-text-muted mb-1 block">需求标题</label>
            <input v-model="form.title" placeholder="如：女女匹配策略验证" class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label class="text-xs text-text-muted mb-1 block">描述（可选）</label>
            <textarea v-model="form.description" placeholder="简要描述需求背景" rows="2" class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none"></textarea>
          </div>
          <div>
            <label class="text-xs text-text-muted mb-1 block">上传需求文档</label>
            <label class="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border border-dashed cursor-pointer hover:border-accent">
              <span class="text-sm text-text-muted">{{ form.file ? form.file.name : '选择文件（PDF/Word/TXT/Markdown）' }}</span>
              <input type="file" accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls" class="hidden" @change="onFileChange($event)" />
            </label>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showCreate = false" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:text-text-primary">取消</button>
            <button type="submit" :disabled="creating" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium disabled:opacity-50">
              {{ creating ? '分析中...' : (form.file ? '创建并分析' : '创建') }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 补充上传弹窗 -->
    <div v-if="uploadTarget" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="uploadTarget = null">
      <div class="w-[420px] bg-dark-800 border border-dark-border rounded-xl p-6">
        <h3 class="text-base font-medium mb-4">上传需求文档 — {{ uploadTarget.title }}</h3>
        <label class="flex items-center gap-2 px-3 py-4 rounded-lg bg-dark-900 border border-dark-border border-dashed cursor-pointer hover:border-accent">
          <span class="text-sm text-text-muted">{{ uploadFile ? uploadFile.name : '选择文件' }}</span>
          <input type="file" accept=".pdf,.docx,.doc,.txt,.md" class="hidden" @change="uploadFile = ($event.target as HTMLInputElement)?.files?.[0] || null" />
        </label>
        <div class="flex justify-end gap-2 mt-4">
          <button @click="uploadTarget = null" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">取消</button>
          <button @click="handleUpload" :disabled="!uploadFile || uploading" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium disabled:opacity-50">
            {{ uploading ? '上传中...' : '上传并分析' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api'

const router = useRouter()
const requirements = ref<any[]>([])
const showCreate = ref(false)
const creating = ref(false)
const form = ref<{ title: string; description: string; file: File | null }>({ title: '', description: '', file: null })
const uploadTarget = ref<any>(null)
const uploadFile = ref<File | null>(null)
const uploading = ref(false)

async function fetchList() {
  const res: any = await http.get('/ai/req/list')
  requirements.value = res.data?.requirements || []
}

function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  form.value.file = f || null
}

async function handleCreate() {
  if (!form.value.title.trim()) return
  creating.value = true
  try {
    const fd = new FormData()
    fd.append('title', form.value.title)
    fd.append('description', form.value.description)
    if (form.value.file) fd.append('file', form.value.file)

    const res: any = await http.post('/ai/req/create', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    showCreate.value = false
    form.value = { title: '', description: '', file: null }
    // 跳转到工作空间
    router.push(`/workspace/${res.data.req_id}`)
  } finally {
    creating.value = false
  }
}

function openUpload(req: any) {
  uploadTarget.value = req
  uploadFile.value = null
}

async function handleUpload() {
  if (!uploadFile.value || !uploadTarget.value) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('req_id', uploadTarget.value.req_id)
    fd.append('file', uploadFile.value)
    await http.post('/ai/req/upload_doc', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    uploadTarget.value = null
    fetchList()
  } finally {
    uploading.value = false
  }
}

function statusClass(s: string) {
  return { ready: 'bg-emerald-900/30 text-emerald-400', analyzing: 'bg-amber-900/30 text-amber-400', working: 'bg-blue-900/30 text-blue-400', completed: 'bg-zinc-800 text-zinc-400' }[s] || 'bg-dark-600 text-text-muted'
}
function statusText(s: string) {
  return { ready: '就绪', analyzing: '分析中...', working: '工作中', completed: '已完结' }[s] || s || '新建'
}
function formatDate(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString() : '' }

onMounted(fetchList)
</script>
