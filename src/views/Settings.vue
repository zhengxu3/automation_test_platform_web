<template>
  <div class="max-w-3xl">
    <h2 class="text-xl font-medium mb-6">⚙️ 设置</h2>

    <!-- 钩子(Webhook)配置 -->
    <section class="rounded-xl border border-dark-border bg-dark-800 p-5 mb-4">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-base font-medium flex items-center gap-2">🪝 钩子（Webhook）配置</h3>
        <span class="text-xs px-2 py-0.5 rounded" :class="sourceClass">{{ sourceText }}</span>
      </div>
      <p class="text-xs text-text-muted mb-4">
        代码仓库 push 时回调本平台，自动激活守护中的 Goal 或新建守护任务。在 Git 仓库的 Webhook 设置里填入下面的地址。
      </p>

      <!-- 网关基址 -->
      <div class="mb-4">
        <label class="text-xs text-text-muted mb-1 block">网关对外基址（由部署的域名/反代决定）</label>
        <input v-model="form.webhook_base_url" :placeholder="originPlaceholder"
          class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono" />
      </div>

      <!-- 完整钩子 URL（复制用）-->
      <div class="mb-4">
        <label class="text-xs text-text-muted mb-1 block">钩子 URL（填到 Git 仓库 Webhook）</label>
        <div class="flex gap-2">
          <input :value="fullWebhookUrl" readonly
            class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-emerald-300 font-mono focus:outline-none" />
          <button type="button" @click="copy(fullWebhookUrl)"
            class="px-3 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:text-text-primary whitespace-nowrap">
            {{ copied === fullWebhookUrl ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <!-- 鉴权 token -->
      <div class="mb-4">
        <label class="text-xs text-text-muted mb-1 block">
          鉴权 Token（请求头 <code class="text-accent">X-Hook-Token</code> 或 GitLab <code class="text-accent">X-Gitlab-Token</code>）
        </label>
        <div class="flex gap-2">
          <input v-model="form.token" :type="showToken ? 'text' : 'password'" placeholder="留空 = 不鉴权（外放前务必设置）"
            :disabled="envTokenSet"
            class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono disabled:opacity-50" />
          <button type="button" @click="showToken = !showToken"
            class="px-3 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:text-text-primary whitespace-nowrap">
            {{ showToken ? '隐藏' : '显示' }}
          </button>
        </div>
        <p v-if="envTokenSet" class="text-[11px] text-amber-400 mt-1">
          检测到环境变量 GOAL_HOOK_TOKEN 已设置，它始终优先生效，此处不可改。
        </p>
        <p v-else class="text-[11px] text-text-muted mt-1">
          保存后立即生效，无需重启服务。
        </p>
      </div>

      <!-- payload 说明 -->
      <details class="mb-4">
        <summary class="text-xs text-text-secondary cursor-pointer hover:text-text-primary">请求体（payload）字段说明</summary>
        <pre class="mt-2 p-3 rounded-lg bg-dark-900 border border-dark-border text-[11px] text-text-muted overflow-auto">{{ payloadExample }}</pre>
        <p class="text-[11px] text-text-muted mt-1">
          repo_id 必填（用于定位本平台已登记的仓库）；commit 兼容 after 字段；branch 用于匹配监控该分支的 Goal。
        </p>
      </details>

      <div class="flex items-center gap-3">
        <button type="button" @click="save" :disabled="saving"
          class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium disabled:opacity-50">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <span v-if="savedTip" class="text-xs text-emerald-400">{{ savedTip }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import http from '@/api'

const form = ref<{ webhook_base_url: string; token: string }>({ webhook_base_url: '', token: '' })
const webhookPath = ref('/ai/goal/webhook')
const tokenSource = ref<'env' | 'db' | 'none'>('none')
const envTokenSet = ref(false)
const showToken = ref(false)
const saving = ref(false)
const savedTip = ref('')
const copied = ref('')

const originPlaceholder = computed(() => (typeof window !== 'undefined' ? window.location.origin : 'https://your-gateway'))

const fullWebhookUrl = computed(() => {
  const base = (form.value.webhook_base_url || originPlaceholder.value).replace(/\/$/, '')
  return base + webhookPath.value
})

const sourceText = computed(() => ({
  env: 'Token 来源：环境变量',
  db: 'Token 来源：已配置',
  none: '未设置 Token',
}[tokenSource.value]))

const sourceClass = computed(() => ({
  env: 'bg-blue-900/30 text-blue-400',
  db: 'bg-emerald-900/30 text-emerald-400',
  none: 'bg-amber-900/30 text-amber-400',
}[tokenSource.value]))

const payloadExample = `{
  "repo_id": "demo-shop",
  "branch": "main",
  "commit": "<sha>",       // 兼容 "after"
  "role": "backend",        // 可选
  "title": "..."            // 可选
}`

async function load() {
  try {
    const res: any = await http.get('/ai/settings/hook')
    const d = res.data || {}
    form.value.webhook_base_url = d.webhook_base_url || ''
    form.value.token = d.token || ''
    webhookPath.value = d.webhook_path || '/ai/goal/webhook'
    tokenSource.value = d.token_source || 'none'
    envTokenSet.value = !!d.env_token_set
  } catch { /* ignore */ }
}

async function save() {
  saving.value = true
  savedTip.value = ''
  try {
    const payload: any = { webhook_base_url: form.value.webhook_base_url }
    if (!envTokenSet.value) payload.token = form.value.token
    await http.post('/ai/settings/hook', payload)
    savedTip.value = '已保存'
    setTimeout(() => (savedTip.value = ''), 2000)
    await load()
  } catch (e) {
    savedTip.value = '保存失败'
  } finally {
    saving.value = false
  }
}

function copy(text: string) {
  try {
    navigator.clipboard?.writeText(text)
    copied.value = text
    setTimeout(() => (copied.value = ''), 1500)
  } catch { /* ignore */ }
}

onMounted(load)
</script>
