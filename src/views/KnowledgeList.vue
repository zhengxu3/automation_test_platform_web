<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-medium">📚 知识库</h2>
      <div class="flex items-center gap-3">
        <input v-model="searchQ" @keyup.enter="doSearch" class="px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary w-52 focus:outline-none focus:border-accent" placeholder="语义搜索..." />
        <button @click="showCreate = true" class="px-4 py-2 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium hover:opacity-90 transition-opacity">+ 录入知识</button>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="flex gap-1 mb-4 border-b border-dark-border">
      <button v-for="t in ['列表', '图谱']" :key="t" @click="tab = t" class="px-4 py-2 text-sm transition-colors -mb-px" :class="tab === t ? 'text-text-primary border-b-2 border-accent' : 'text-text-muted hover:text-text-secondary'">{{ t }}</button>
    </div>

    <!-- 列表 Tab -->
    <div v-if="tab === '列表'">
      <!-- 过滤栏 -->
      <div class="flex gap-2 mb-4">
        <input v-model="filterKw" @input="fetchList" class="px-3 py-1.5 rounded-lg bg-dark-900 border border-dark-border text-xs text-text-primary w-40 focus:outline-none focus:border-accent" placeholder="关键词过滤..." />
        <div class="flex gap-1 flex-wrap">
          <button v-for="t in allTags.slice(0, 12)" :key="t" @click="toggleTag(t)" class="px-2 py-1 rounded text-xs transition-colors" :class="selectedTag === t ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-dark-600 text-text-muted hover:text-text-secondary'">{{ t }}</button>
        </div>
      </div>

      <!-- 知识列表 -->
      <div class="space-y-2">
        <div v-for="item in list" :key="item.knowledge_id" class="flex items-center gap-4 p-4 bg-dark-800 border border-dark-border rounded-xl hover:bg-dark-700 transition-colors cursor-pointer" @click="openDetail(item)">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-text-primary truncate">{{ item.title }}</div>
            <div class="flex gap-1 mt-1">
              <span v-for="t in item.tags" :key="t" class="text-[10px] px-1.5 py-0.5 rounded bg-dark-600 text-text-muted">{{ t }}</span>
            </div>
          </div>
          <span v-if="item.confidence?.overall === 'partial'" class="text-[10px] px-2 py-0.5 rounded bg-amber-900/30 text-amber-400">存疑</span>
          <span class="text-xs text-text-muted">{{ item.source_type || 'manual' }}</span>
          <span class="text-xs text-text-muted tabular-nums">{{ fmtTime(item.created_at) }}</span>
          <button @click.stop="deleteKb(item)" class="p-1 rounded hover:bg-dark-600 text-red-400 text-xs">🗑</button>
        </div>
        <div v-if="!list.length && !loading" class="text-center text-text-muted py-16 text-sm">暂无知识</div>
      </div>

      <!-- 分页 -->
      <div v-if="total > pageSize" class="flex justify-center gap-2 mt-4">
        <button v-for="p in Math.ceil(total / pageSize)" :key="p" @click="page = p; fetchList()" class="w-8 h-8 rounded text-xs transition-colors" :class="page === p ? 'bg-accent text-white' : 'bg-dark-700 text-text-muted hover:bg-dark-600'">{{ p }}</button>
      </div>
    </div>

    <!-- 图谱 Tab -->
    <div v-if="tab === '图谱'" class="relative">
      <div ref="graphEl" class="w-full h-[75vh] rounded-xl border border-dark-border overflow-hidden graph-bg"></div>
      <!-- 图例 -->
      <div class="absolute top-4 left-4 bg-dark-800/80 backdrop-blur-md border border-dark-border rounded-xl p-4 text-[11px] text-text-secondary space-y-2 shadow-lg">
        <div class="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-medium">关系类型</div>
        <div class="flex items-center gap-2"><span class="w-5 h-[2px] bg-cyan-400 inline-block rounded shadow-[0_0_6px_rgba(34,211,238,0.6)]"></span>强关联</div>
        <div class="flex items-center gap-2"><span class="w-5 h-[2px] border-t border-dashed border-zinc-500 inline-block"></span>弱关联</div>
        <div class="flex items-center gap-2"><span class="w-5 h-[2px] bg-orange-400 inline-block rounded shadow-[0_0_6px_rgba(251,146,60,0.5)]"></span>同源需求</div>
        <div class="flex items-center gap-2"><span class="w-5 h-[2px] bg-emerald-400 inline-block rounded shadow-[0_0_6px_rgba(52,211,153,0.5)]"></span>内容相似</div>
      </div>
      <!-- 统计 -->
      <div class="absolute bottom-4 left-4 text-[10px] text-text-muted bg-dark-800/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-dark-border">
        {{ graphStats.nodes }} 节点 · {{ graphStats.edges }} 连接
      </div>
      <!-- 节点面板 -->
      <transition name="slide">
        <div v-if="graphNode" class="absolute top-4 right-4 bg-dark-800/90 backdrop-blur-md border border-dark-border rounded-xl p-5 w-64 shadow-2xl">
          <button @click="graphNode = null" class="absolute top-3 right-3 text-text-muted hover:text-white text-xs">✕</button>
          <div class="text-sm font-medium text-text-primary mb-3 pr-6">{{ graphNode.title }}</div>
          <div class="space-y-1.5 text-[11px] text-text-muted">
            <div>类型 <span class="text-text-secondary ml-2">{{ graphNode.type || '手动录入' }}</span></div>
            <div>来源 <span class="text-text-secondary ml-2 font-mono">{{ graphNode.source || '-' }}</span></div>
            <div>时间 <span class="text-text-secondary ml-2 tabular-nums">{{ fmtTime(graphNode.created_at) }}</span></div>
          </div>
          <div class="flex flex-wrap gap-1 mt-3">
            <span v-for="t in graphNode.tags" :key="t" class="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] border border-accent/20">{{ t }}</span>
          </div>
          <button @click="openDetailById(graphNode.id)" class="mt-4 w-full py-2 rounded-lg bg-dark-600 hover:bg-dark-700 border border-dark-border text-xs text-text-secondary hover:text-text-primary transition-colors">查看详情 →</button>
        </div>
      </transition>
    </div>

    <!-- 详情侧边栏 -->
    <div v-if="detail" class="fixed right-0 top-0 h-full w-[480px] bg-dark-800 border-l border-dark-border p-6 overflow-auto z-50 shadow-2xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-base font-medium">{{ detail.title }}</h3>
        <button @click="detail = null" class="text-zinc-500 hover:text-white">✕</button>
      </div>
      <div v-if="detail.confidence?.overall === 'partial'" class="text-xs p-3 rounded-lg bg-amber-900/20 border border-amber-800 mb-4 text-amber-300">
        ⚠️ 存疑：{{ detail.confidence?.reason }}
      </div>
      <div class="flex flex-wrap gap-1 mb-4"><span v-for="t in detail.tags" :key="t" class="text-xs px-2 py-0.5 rounded bg-dark-600 text-text-secondary">{{ t }}</span></div>
      <div class="prose-sm text-text-secondary text-sm leading-relaxed whitespace-pre-wrap font-mono bg-dark-900 p-4 rounded-lg max-h-[60vh] overflow-auto border border-dark-border">{{ detail.content || '加载中...' }}</div>
    </div>

    <!-- 创建弹窗 -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showCreate = false">
        <div class="bg-dark-800 border border-dark-border rounded-xl p-6 w-[500px]">
          <h3 class="text-base font-medium mb-4">录入知识</h3>
          <div class="space-y-3">
            <!-- 文件上传 -->
            <div>
              <label class="text-xs text-text-muted mb-1 block">上传文件（PDF / MD / TXT）</label>
              <label class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-dark-border hover:border-accent/50 cursor-pointer transition-colors bg-dark-900">
                <input type="file" accept=".pdf,.md,.txt,.markdown" class="hidden" @change="handleFileUpload" />
                <span class="text-text-muted text-sm">{{ uploadFileName || '点击或拖拽上传' }}</span>
                <span v-if="uploading" class="text-accent text-xs animate-pulse">解析中...</span>
              </label>
            </div>
            <div class="text-center text-[10px] text-text-muted">— 或直接填写 —</div>
            <div><label class="text-xs text-text-muted mb-1 block">标题</label><input v-model="createForm.title" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent" /></div>
            <div><label class="text-xs text-text-muted mb-1 block">标签（逗号分隔）</label><input v-model="createForm.tagsStr" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent" placeholder="如: 登录,安全,客户端" /></div>
            <div><label class="text-xs text-text-muted mb-1 block">内容（Markdown）</label><textarea v-model="createForm.content" rows="8" class="w-full px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary focus:outline-none focus:border-accent font-mono resize-y"></textarea></div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="showCreate = false" class="px-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary hover:bg-dark-700">取消</button>
            <button @click="submitCreate" :disabled="!createForm.title.trim()" class="px-4 py-2 rounded-lg bg-accent text-sm font-medium hover:opacity-90 disabled:opacity-50">确认入库</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import http from '@/api'

const tab = ref('列表')
const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterKw = ref('')
const selectedTag = ref('')
const searchQ = ref('')
const allTags = ref<string[]>([])
const detail = ref<any>(null)
const showCreate = ref(false)
const createForm = ref({ title: '', content: '', tagsStr: '' })
const uploadFileName = ref('')
const uploading = ref(false)
const graphEl = ref<HTMLElement | null>(null)
const graphNode = ref<any>(null)
let chartInst: any = null

async function fetchList() {
  loading.value = true
  try {
    const params: any = { page: page.value, page_size: pageSize }
    if (selectedTag.value) params.tags = selectedTag.value
    if (filterKw.value) params.keyword = filterKw.value
    const res: any = await http.get('/ai/knowledge/list', { params })
    list.value = res.data?.items || []
    total.value = res.data?.total || 0
  } finally { loading.value = false }
}

async function fetchTags() {
  try {
    const res: any = await http.get('/ai/knowledge/tags')
    allTags.value = res.data?.tags || []
  } catch {}
}

function toggleTag(t: string) {
  selectedTag.value = selectedTag.value === t ? '' : t
  page.value = 1
  fetchList()
}

async function doSearch() {
  if (!searchQ.value.trim()) return fetchList()
  loading.value = true
  try {
    const res: any = await http.get('/ai/knowledge/search', { params: { q: searchQ.value } })
    list.value = res.data?.results || []
    total.value = list.value.length
  } finally { loading.value = false }
}

async function openDetail(item: any) {
  detail.value = { ...item, content: '' }
  try {
    const res: any = await http.get('/ai/knowledge/detail', { params: { knowledge_id: item.knowledge_id } })
    detail.value = res.data?.item || item
  } catch {}
}

async function openDetailById(id: string) {
  detail.value = { title: '加载中...' }
  try {
    const res: any = await http.get('/ai/knowledge/detail', { params: { knowledge_id: id } })
    detail.value = res.data?.item || {}
  } catch {}
}

async function deleteKb(item: any) {
  if (!confirm(`删除 [${item.title}]？`)) return
  await http.delete(`/ai/knowledge/${item.knowledge_id}`)
  fetchList()
}

async function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  uploadFileName.value = file.name
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res: any = await http.post('/ai/knowledge/upload', fd)
    createForm.value.title = res.data?.title || ''
    createForm.value.content = res.data?.content || ''
  } catch { uploadFileName.value = '解析失败，请重试' }
  finally { uploading.value = false }
}

async function submitCreate() {
  if (!createForm.value.title.trim()) return
  const tags = createForm.value.tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean)
  await http.post('/ai/knowledge/create', { title: createForm.value.title, content: createForm.value.content, tags })
  showCreate.value = false
  createForm.value = { title: '', content: '', tagsStr: '' }
  fetchList(); fetchTags()
}

function fmtTime(ts: number) { return ts ? new Date(ts * 1000).toLocaleDateString() : '' }

const graphStats = ref({ nodes: 0, edges: 0 })

// ========== 图谱 ==========
async function renderGraph() {
  if (!graphEl.value) return
  if (!(window as any).echarts) {
    await new Promise<void>(resolve => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/echarts@5.5.0/dist/echarts.min.js'
      s.onload = () => resolve()
      document.head.appendChild(s)
    })
  }
  const echarts = (window as any).echarts
  if (chartInst) chartInst.dispose()
  chartInst = echarts.init(graphEl.value, null, { renderer: 'canvas' })

  let data: any
  try {
    const res: any = await http.get('/ai/knowledge/graph')
    data = res.data
  } catch { return }
  if (!data?.nodes?.length) return

  graphStats.value = { nodes: data.nodes.length, edges: (data.edges || []).length }

  // 色板：柔和霓虹感
  const tagColors: Record<string, string> = {}
  const palette = ['#06b6d4', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#4ade80', '#c084fc', '#fb923c']
  let ci = 0

  const edgeColor: Record<string, string> = { strong: 'rgba(34,211,238,0.8)', weak: 'rgba(100,116,139,0.35)', source: 'rgba(251,146,60,0.7)', similar: 'rgba(52,211,153,0.6)' }
  const edgeWidth: Record<string, number> = { strong: 2.5, weak: 0.8, source: 1.8, similar: 1.5 }
  const edgeLine: Record<string, string> = { strong: 'solid', weak: 'dashed', source: 'solid', similar: 'dotted' }

  const nodes = data.nodes.map((n: any) => {
    const mainTag = (n.tags || [])[0] || '_'
    if (!tagColors[mainTag]) { tagColors[mainTag] = palette[ci % palette.length]; ci++ }
    const baseColor = tagColors[mainTag]
    const conn = (data.edges || []).filter((e: any) => e.from === n.id || e.to === n.id).length
    const size = 18 + conn * 5

    return {
      id: n.id,
      name: (n.title || '').slice(0, 10),
      symbolSize: size,
      itemStyle: {
        color: {
          type: 'radial', x: 0.5, y: 0.5, r: 0.5,
          colorStops: [
            { offset: 0, color: baseColor },
            { offset: 0.7, color: baseColor },
            { offset: 1, color: 'transparent' },
          ]
        },
        borderColor: baseColor,
        borderWidth: 1.5,
        shadowBlur: 12,
        shadowColor: baseColor.replace(')', ',0.4)').replace('rgb', 'rgba'),
      },
      label: {
        show: size > 22,
        color: '#e4e4e7',
        fontSize: 9,
        distance: 4,
        position: 'bottom',
        textShadowBlur: 4,
        textShadowColor: '#000',
      },
      emphasis: {
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2.5,
          shadowBlur: 30,
          shadowColor: baseColor,
        },
        label: { show: true, color: '#fff', fontSize: 12, fontWeight: 'bold' }
      },
      _raw: n
    }
  })

  const links = (data.edges || []).map((e: any) => ({
    source: e.from, target: e.to,
    lineStyle: {
      color: edgeColor[e.type] || 'rgba(60,60,60,0.3)',
      width: edgeWidth[e.type] || 1,
      type: edgeLine[e.type] || 'solid',
      curveness: 0.2,
    },
    emphasis: { lineStyle: { width: 3, shadowBlur: 8, shadowColor: edgeColor[e.type] || '#fff' } }
  }))

  chartInst.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15,17,23,0.95)',
      borderColor: '#2e3450',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#e4e4e7', fontSize: 11 },
      extraCssText: 'backdrop-filter: blur(8px); box-shadow: 0 8px 32px rgba(0,0,0,0.5); border-radius: 10px;',
      formatter: (p: any) => {
        if (p.dataType !== 'node') return ''
        const r = p.data._raw
        const tags = (r.tags || []).map((t: string) => `<span style="display:inline-block;padding:1px 6px;margin:1px;border-radius:10px;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);font-size:10px">${t}</span>`).join('')
        return `<div style="font-weight:600;margin-bottom:4px">${r.title}</div><div style="color:#a1a1b5;font-size:10px;margin-bottom:4px">${r.type || '手动'} · ${fmtTime(r.created_at)}</div>${tags}`
      }
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: { repulsion: 450, edgeLength: [100, 300], gravity: 0.04, friction: 0.6 },
      data: nodes,
      links,
      lineStyle: { opacity: 0.8 },
      emphasis: { focus: 'adjacency', blurScope: 'global' },
      blur: {
        itemStyle: { opacity: 0.08 },
        lineStyle: { opacity: 0.04 },
        label: { opacity: 0 }
      },
      animationDuration: 1500,
      animationEasingUpdate: 'quinticInOut',
    }]
  })

  chartInst.on('click', (p: any) => { if (p.dataType === 'node') graphNode.value = p.data._raw })
  chartInst.on('dblclick', (p: any) => { if (p.dataType === 'node') openDetailById(p.data.id) })
}

watch(tab, (v) => { if (v === '图谱') nextTick(renderGraph) })
onMounted(() => { fetchList(); fetchTags() })
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.slide-leave-active { transition: all 0.2s ease-in; }
.slide-enter-from { opacity: 0; transform: translateX(20px); }
.slide-leave-to { opacity: 0; transform: translateX(20px); }

.graph-bg {
  background:
    radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.04) 0%, transparent 60%),
    radial-gradient(circle at 20% 80%, rgba(6,182,212,0.03) 0%, transparent 40%),
    linear-gradient(180deg, #080a10 0%, #0c0e16 100%);
  background-size: 100% 100%;
  position: relative;
}
.graph-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(46,52,80,0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(46,52,80,0.15) 1px, transparent 1px);
  background-size: 60px 60px;
  pointer-events: none;
  mask: radial-gradient(ellipse at center, black 40%, transparent 80%);
  -webkit-mask: radial-gradient(ellipse at center, black 40%, transparent 80%);
}
</style>
