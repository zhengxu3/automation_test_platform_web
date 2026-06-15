<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-medium">⬡ 智能体管理</h2>
      <button @click="showCreate = true" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium hover:opacity-90 transition-opacity">+ 创建智能体</button>
    </div>

    <!-- 树形列表 -->
    <div class="space-y-3">
      <div v-for="agent in tree" :key="agent.agent_id" class="border border-dark-border rounded-xl overflow-hidden">
        <div class="flex items-center gap-3 p-4 bg-dark-800 cursor-pointer hover:bg-dark-700 transition-colors" @click="selectAgent(agent)">
          <span class="w-8 h-8 rounded-lg bg-dark-600 border border-dark-border flex items-center justify-center text-sm">{{ categoryIcon(agent.category) }}</span>
          <div class="flex-1">
            <div class="text-sm font-medium text-text-primary">{{ agent.agent_name }}</div>
            <div class="text-xs text-text-muted mt-0.5">{{ agent.description || '无描述' }}</div>
          </div>
          <span class="text-xs text-text-muted">{{ agent.category }}</span>
          <span v-if="agent.children?.length" class="text-xs px-2 py-0.5 rounded bg-dark-600 text-text-secondary">{{ agent.children.length }} 子级</span>
        </div>
        <!-- 子级 -->
        <div v-if="agent.children?.length" class="border-t border-dark-border">
          <div v-for="child in agent.children" :key="child.agent_id" class="flex items-center gap-3 px-4 py-3 pl-12 hover:bg-dark-700 cursor-pointer transition-colors" @click="selectAgent(child)">
            <span class="w-6 h-6 rounded bg-dark-900 border border-dark-border flex items-center justify-center text-xs">{{ categoryIcon(child.category) }}</span>
            <div class="flex-1">
              <span class="text-sm">{{ child.agent_name }}</span>
              <span class="text-xs text-zinc-500 ml-2">{{ child.description }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!tree.length" class="text-center text-zinc-500 py-12 text-sm">暂无智能体</div>
    </div>

    <!-- 详情侧边栏 -->
    <div v-if="selected" class="fixed right-0 top-0 h-full w-96 bg-dark-800 border-l border-dark-border p-6 overflow-auto z-50 shadow-2xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-medium">{{ selected.agent_name }}</h3>
        <button @click="selected = null" class="text-zinc-500 hover:text-white">✕</button>
      </div>
      <div class="space-y-4 text-sm">
        <div><span class="text-text-muted">ID:</span> <span class="font-mono text-xs text-text-secondary">{{ selected.agent_id }}</span></div>
        <div><span class="text-text-muted">分类:</span> {{ selected.category }}</div>
        <div><span class="text-text-muted">模型:</span> {{ selected.model_id || '默认' }}</div>
        <div><span class="text-text-muted">执行器:</span> <span class="font-mono text-xs px-1.5 py-0.5 rounded bg-dark-600">{{ selected.handler_class || '通用 LLM' }}</span></div>
        <div><span class="text-text-muted">平台:</span> {{ selected.runtime?.run_platform || 'linux' }}</div>
        <div><span class="text-text-muted">超时:</span> {{ selected.runtime?.max_runtime_sec || 600 }}s</div>
        <div><span class="text-text-muted">父级:</span> {{ parentName(selected.parent_id) || '无' }}</div>
        <div v-if="selected.inputs?.length">
          <span class="text-text-muted">输入参数:</span>
          <div class="mt-1 space-y-1">
            <div v-for="inp in selected.inputs" :key="inp.key" class="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-dark-900">
              <span class="text-text-primary font-mono">{{ inp.key }}</span>
              <span class="text-text-muted">{{ inp.label }}</span>
              <span v-if="inp.required" class="text-red-400">*</span>
              <span v-if="inp.fixed" class="text-accent-cyan text-[10px]">自动注入</span>
            </div>
          </div>
        </div>
        <div v-if="selected.outputs?.length">
          <span class="text-text-muted">输出:</span>
          <div class="mt-1 flex flex-wrap gap-1">
            <span v-for="out in selected.outputs" :key="out.key" class="text-xs px-2 py-0.5 rounded bg-dark-900 text-text-secondary">{{ out.key }}</span>
          </div>
        </div>
        <div v-if="selected.system_prompt || selected.handler_class === ''" class="border-t border-dark-border pt-3">
          <div class="flex justify-between items-center mb-1">
            <span class="text-text-muted">Prompt:</span>
            <button v-if="promptEditing" @click="savePrompt" class="text-xs text-accent hover:text-accent-blue">💾 保存</button>
            <button v-else @click="promptEditing = true; editPrompt = selected.system_prompt || ''" class="text-xs text-text-muted hover:text-text-secondary">✏️ 编辑</button>
          </div>
          <textarea v-if="promptEditing" v-model="editPrompt" rows="12" class="w-full text-xs text-text-primary font-mono bg-dark-900 border border-dark-border p-3 rounded-lg resize-y focus:outline-none focus:border-accent min-h-[200px]"></textarea>
          <div v-else class="text-xs text-text-secondary font-mono bg-dark-900 p-3 rounded-lg max-h-[200px] overflow-auto whitespace-pre-wrap cursor-pointer hover:border-accent border border-transparent transition-colors" @click="promptEditing = true; editPrompt = selected.system_prompt || ''">{{ selected.system_prompt || '点击编辑 Prompt...' }}</div>
        </div>
        <div class="flex gap-2 pt-4 border-t border-dark-border">
          <button @click="deleteAgent(selected.agent_id)" class="px-3 py-1.5 rounded-lg border border-red-900 text-red-400 text-xs hover:bg-red-900/20">删除</button>
        </div>
      </div>
    </div>

    <!-- 创建弹窗 -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCreate = false">
      <div class="w-[560px] max-h-[80vh] overflow-auto bg-dark-800 border border-dark-border rounded-xl p-6">
        <h3 class="text-base font-medium mb-4">创建智能体</h3>
        <form @submit.prevent="handleCreate" class="space-y-4">
          <!-- 基本信息 -->
          <div class="space-y-3">
            <input v-model="form.agent_name" placeholder="名称 *" class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
            <input v-model="form.description" placeholder="描述" class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
            <div class="grid grid-cols-2 gap-3">
              <select v-model="form.category" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="requirement">需求分析</option>
                <option value="code_review">代码审查</option>
                <option value="test_engineer">测试工程</option>
                <option value="device">设备操作</option>
                <option value="custom">自定义</option>
              </select>
              <select v-model="form.parent_id" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                <option :value="null">无父级</option>
                <option v-for="a in flatAgents" :key="a.agent_id" :value="a.agent_id">{{ a.agent_name }}</option>
              </select>
            </div>
          </div>

          <!-- 执行映射 -->
          <div class="border-t border-dark-border pt-4">
            <div class="text-xs text-text-muted mb-2">执行配置</div>
            <div class="grid grid-cols-2 gap-3">
              <select v-model="form.handler_class" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                <option v-for="h in handlers" :key="h.key" :value="h.key">{{ h.label }}</option>
              </select>
              <select v-model="form.model_id" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="gemini_flash">Gemini Flash（快速）</option>
                <option value="gemini_pro">Gemini Pro（高质量）</option>
                <option value="deepseek">DeepSeek（经济）</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <select v-model="form.run_platform" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent">
                <option value="linux">Linux（AI 服务器）</option>
                <option value="device">设备服务器</option>
              </select>
              <input v-model.number="form.max_runtime_sec" type="number" placeholder="超时(秒)" class="px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
            </div>
          </div>

          <!-- inputs 参数 -->
          <div class="border-t border-dark-border pt-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs text-text-muted">输入参数</span>
              <button type="button" @click="addInput" class="text-xs text-accent hover:text-accent-blue">+ 添加</button>
            </div>
            <div v-for="(inp, i) in form.inputs" :key="i" class="flex gap-2 mb-2">
              <input v-model="inp.key" placeholder="key" class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
              <input v-model="inp.label" placeholder="显示名" class="flex-1 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" />
              <select v-model="inp.type" class="w-24 px-2 py-1.5 rounded bg-dark-900 border border-dark-border text-xs text-text-primary focus:outline-none">
                <option value="string">文本</option>
                <option value="repo_select">仓库选择</option>
                <option value="file">文件</option>
                <option value="select">下拉</option>
              </select>
              <label class="flex items-center gap-1 text-xs text-text-muted">
                <input type="checkbox" v-model="inp.required" class="rounded"> 必填
              </label>
              <button type="button" @click="form.inputs.splice(i, 1)" class="text-red-400 text-xs hover:text-red-300">✕</button>
            </div>
          </div>

          <!-- System Prompt -->
          <div class="border-t border-dark-border pt-4">
            <div class="text-xs text-text-muted mb-2">System Prompt（通用模式时使用）</div>
            <textarea v-model="form.system_prompt" placeholder="定义智能体的角色和行为..." rows="4" class="w-full px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none font-mono"></textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" @click="showCreate = false" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:text-text-primary">取消</button>
            <button type="submit" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import http from '@/api'

const tree = ref<any[]>([])
const flatAgents = ref<any[]>([])
const handlers = ref<any[]>([])
const selected = ref<any>(null)
const showCreate = ref(false)
const promptEditing = ref(false)
const editPrompt = ref('')
const form = ref({
  agent_name: '', description: '', category: 'custom', parent_id: null as string | null,
  handler_class: '', model_id: 'gemini_flash', run_platform: 'linux', max_runtime_sec: 600,
  inputs: [] as any[], system_prompt: ''
})

async function fetchTree() {
  const res: any = await http.get('/ai/agent/tree')
  tree.value = res.data.tree || []
  const listRes: any = await http.get('/ai/agent/list')
  flatAgents.value = listRes.data.agents || []
  const hRes: any = await http.get('/ai/agent/handlers')
  handlers.value = hRes.data.handlers || []
}

function parentName(parentId: string | null) {
  if (!parentId) return null
  const p = flatAgents.value.find((a: any) => a.agent_id === parentId)
  return p?.agent_name || parentId
}

function categoryIcon(cat: string) {
  return { requirement: '📋', test_engineer: '🔧', code_review: '🔍', device: '📱', custom: '⬡' }[cat] || '⬡'
}

function addInput() {
  form.value.inputs.push({ key: '', label: '', type: 'string', required: false })
}

async function handleCreate() {
  await http.post('/ai/agent/create', {
    ...form.value,
    inputs: form.value.inputs.filter(i => i.key),
  })
  showCreate.value = false
  form.value = { agent_name: '', description: '', category: 'custom', parent_id: null, handler_class: '', model_id: 'gemini_flash', run_platform: 'linux', max_runtime_sec: 600, inputs: [], system_prompt: '' }
  fetchTree()
}

async function deleteAgent(id: string) {
  if (!confirm('确认删除？子级将解除关联。')) return
  await http.post('/ai/agent/delete', { agent_id: id })
  selected.value = null
  fetchTree()
}

async function savePrompt() {
  await http.post('/ai/agent/update', { agent_id: selected.value.agent_id, system_prompt: editPrompt.value })
  selected.value.system_prompt = editPrompt.value
  promptEditing.value = false
}

function selectAgent(agent: any) {
  selected.value = agent
  promptEditing.value = false
}

onMounted(fetchTree)
</script>
