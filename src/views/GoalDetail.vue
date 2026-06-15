<template>
  <div class="h-full flex flex-col">
    <!-- 顶部栏 -->
    <div class="flex justify-between items-center mb-3">
      <div class="flex items-center gap-3">
        <button @click="$router.push('/goals')" class="text-text-muted hover:text-text-primary text-sm">← 返回</button>
        <h2 class="text-base font-medium text-text-primary">{{ goal.title }}</h2>
        <span class="text-xs px-2 py-0.5 rounded" :class="statusClass(goal.status)">{{ statusText(goal.status) }}</span>
        <span class="text-[10px] text-text-muted">置信 {{ ((goal.goal_confidence || 0) * 100).toFixed(0) }}%</span>
        <span v-if="llmModelLabel" class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300" title="平台主用大模型">🧠 {{ llmModelLabel }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="controlError" class="text-[10px] text-red-400 max-w-[220px] truncate">{{ controlError }}</span>
        <button v-if="goal.status === 'awaiting_approval'" @click="approve" data-testid="approve-btn"
          class="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30">✓ 批准执行</button>
        <button v-if="canPause" :disabled="!!controlLoading" @click="controlGoal('pause')" data-testid="pause-btn"
          class="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 text-xs font-medium hover:bg-blue-500/25 disabled:opacity-50">暂停</button>
        <button v-if="canResume" :disabled="!!controlLoading" @click="controlGoal('resume')" data-testid="resume-btn"
          class="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50">恢复</button>
        <button v-if="canCancel" :disabled="!!controlLoading" @click="controlGoal('cancel')" data-testid="cancel-btn"
          class="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 text-xs font-medium hover:bg-red-500/25 disabled:opacity-50">{{ cancelButtonText }}</button>
      </div>
    </div>

    <!-- 🔁 本轮来源 + 💥 爆炸范围：每次代码提交激活时，明确告诉用户这次影响多大（持久显示）-->
    <div v-if="roundActivation" data-testid="blast-radius"
      class="mb-2 px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-900/10">
      <div class="flex items-center flex-wrap gap-2 text-[11px]">
        <span class="px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-200 font-medium">🔁 第 {{ roundActivation.round || goal.round }} 轮 · 代码提交激活</span>
        <span class="text-text-muted">💥 爆炸范围：</span>
        <span v-if="(roundActivation.touched_sides || []).length"
          class="px-2 py-0.5 rounded bg-blue-900/30 text-blue-300">触及 {{ roundActivation.touched_sides.map(sideCnLabel).join('、') }}</span>
        <span v-else class="px-2 py-0.5 rounded bg-dark-700 text-text-muted">未探测到改动侧（全量重验）</span>
        <span v-if="blastFiles.length"
          class="px-2 py-0.5 rounded bg-dark-700 text-text-secondary font-mono" :title="blastFiles.join('\n')">改动 {{ blastFiles.slice(0, 3).join('、') }}{{ blastFiles.length > 3 ? ` +${blastFiles.length - 3}` : '' }}</span>
        <span v-if="blastResetText" class="px-2 py-0.5 rounded bg-amber-900/30 text-amber-300">本轮重验 {{ blastResetText }}</span>
        <span v-if="uiSkipped" class="px-2 py-0.5 rounded bg-dark-700 text-text-muted">客户端未触及 → UI/设备验证已跳过</span>
      </div>
    </div>

    <!-- 🔄 replan 重新插入横幅（4s 自动淡出）-->
    <transition name="fade">
      <div v-if="replanFlash" data-testid="replan-flash"
        class="mb-2 px-4 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-medium flex items-center gap-2 animate-pulse">
        {{ replanFlash }}
      </div>
    </transition>

    <!-- 🎯 目标锁定过渡横幅（发现→执行 切换时给节拍，4s 自动淡出）-->
    <transition name="fade">
      <div v-if="lockFlash" data-testid="lock-flash"
        class="mb-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-sm font-medium flex items-center gap-2 animate-pulse">
        {{ lockFlash }}
      </div>
    </transition>

    <!-- ⏱️ 真实 plan 切换等待：后端 pending_plan_transition 控制，非前端假倒计时 -->
    <transition name="fade">
      <div v-if="planTransitionActive" data-testid="plan-transition-countdown"
        class="mb-3 px-4 py-3 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-100">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium flex-1">{{ planTransitionText }}</span>
          <span class="px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/40 text-indigo-200 text-xs font-mono">
            {{ planTransitionRemaining }}s
          </span>
        </div>
        <div class="text-[10px] text-indigo-200/70 mt-1">
          调度器正在真实等待，到点后才会生成并启动下一轮 plan。
        </div>
      </div>
    </transition>

    <!-- 🔔 统一事件闪现横幅（由 EVENT_CATALOG 的 flash 驱动：代码提交/守护/完成/取消/自愈…）-->
    <transition name="fade">
      <div v-if="eventFlash" data-testid="event-flash"
        class="mb-2 px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 animate-pulse"
        :class="flashToneClass(eventFlashTone)">
        {{ eventFlash }}
      </div>
    </transition>

    <!-- 🏁 终态结果卡 / 🛡️ 守护态提醒：任务结束或达标守护后给明确状态 -->
    <div v-if="terminalMeta" data-testid="terminal-card"
      class="mb-3 px-4 py-3 rounded-xl border" :class="flashToneClass(terminalMeta.tone)">
      <div class="flex items-center gap-3">
        <span class="text-2xl">{{ terminalMeta.icon }}</span>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold">{{ terminalMeta.title }}</div>
          <div class="text-[11px] opacity-80 mt-0.5">
            验收 {{ terminalStats.passed }}/{{ terminalStats.total }} 通过 ·
            证据 {{ terminalStats.evidence }} 条 ·
            用时 {{ fmtDuration(terminalStats.durationSec) }}
            <template v-if="terminalStats.steps">
              · 步骤 {{ terminalStats.steps.completed }} 完成<span v-if="terminalStats.steps.degraded">/{{ terminalStats.steps.degraded }} 降级</span><span v-if="terminalStats.steps.failed">/{{ terminalStats.steps.failed }} 失败</span>
            </template>
          </div>
          <div v-if="goal.status === 'guarding'" class="text-[11px] opacity-80 mt-1">
            🛡️ 持续守护中——下一次代码提交（webhook）会自动重新激活验证。
          </div>
          <div v-else-if="goal.status === 'partial_completed'" class="text-[11px] opacity-80 mt-1">
            未达成：{{ (goal.acceptance || []).filter((a: any) => a.verdict !== 'pass').map((a: any) => a.desc).slice(0,3).join('、') || '—' }}
          </div>
        </div>
      </div>
    </div>

    <!-- ⛳ 节拍 / 里程碑：演示叙事主线 -->
    <div v-if="milestones.length" class="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1" data-testid="milestones">
      <span class="text-[10px] text-text-muted shrink-0 mr-1">节拍</span>
      <template v-for="(m, i) in milestones" :key="m.key">
        <div class="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] whitespace-nowrap shrink-0"
          :class="i === milestones.length-1 ? flashToneClass(m.tone) : 'border-dark-border text-text-muted bg-dark-800'"
          :title="m.text">
          <span>{{ m.icon }}</span>
          <span class="max-w-[160px] truncate">{{ m.text }}</span>
        </div>
        <span v-if="i < milestones.length-1" class="text-text-muted text-[10px] shrink-0">→</span>
      </template>
    </div>

    <!-- 🧭 自主流程四阶段：资源准备 → 目标发现 → 锁定目标 → 执行目标 -->
    <div class="flex items-center gap-1 mb-3" data-testid="flow-phases">
      <template v-for="(st, i) in flowStages" :key="st.key">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all" :class="stageStateClass(st.state)">
          <span>{{ st.icon }}</span>
          <span>{{ st.label }}</span>
          <span v-if="st.state==='done'" class="text-[10px]">✓</span>
        </div>
        <span v-if="i < flowStages.length-1" class="text-text-muted text-xs">→</span>
      </template>
      <span v-if="goal.target_state" class="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-text-muted">
        目标态：{{ targetStateText(goal.target_state) }}
      </span>
    </div>

    <!-- 当前任务驾驶舱：当前轮次 / 动作 / 智能体 / 下一步 -->
    <div class="mb-3 grid grid-cols-4 gap-2" data-testid="goal-dashboard">
      <div class="rounded-lg border border-dark-border bg-dark-800 px-3 py-2">
        <div class="text-[10px] text-text-muted">当前轮次</div>
        <div class="text-sm text-text-primary mt-0.5 truncate">{{ currentRoundLabel }}</div>
        <div class="text-[10px] text-text-muted mt-1">{{ currentRoundProgress }}</div>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-800 px-3 py-2">
        <div class="text-[10px] text-text-muted">当前动作</div>
        <div class="text-sm text-text-primary mt-0.5 truncate">{{ currentActionText }}</div>
        <div class="text-[10px] text-text-muted mt-1">{{ currentActionHint }}</div>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-800 px-3 py-2">
        <div class="text-[10px] text-text-muted">激活智能体</div>
        <div class="text-sm text-text-primary mt-0.5 truncate">{{ currentAgentText }}</div>
        <div class="text-[10px] text-text-muted mt-1">{{ currentAgentHint }}</div>
      </div>
      <div class="rounded-lg border border-dark-border bg-dark-800 px-3 py-2">
        <div class="text-[10px] text-text-muted">下一步</div>
        <div class="text-sm text-text-primary mt-0.5 truncate">{{ nextActionText }}</div>
        <div class="text-[10px] text-text-muted mt-1">{{ latestDecisionText }}</div>
      </div>
    </div>

    <!-- 统计卡片（点击弹窗）-->
    <div class="flex gap-2 mb-3">
      <div class="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="dialog='acceptance'">
        <div class="text-base font-mono font-medium text-text-primary">{{ passedCount }}<span class="text-text-muted text-xs">/{{ (goal.acceptance||[]).length }}</span></div>
        <div class="text-[10px] text-text-muted">验收矩阵</div>
      </div>
      <div class="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="dialog='evidence'" data-testid="stat-evidence">
        <div class="text-base font-mono font-medium text-text-primary">{{ evidence.length }}</div>
        <div class="text-[10px] text-text-muted">证据</div>
      </div>
      <div class="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="dialog='outputs'" data-testid="stat-outputs">
        <div class="text-base font-mono font-medium text-text-primary">{{ artifacts.length }}</div>
        <div class="text-[10px] text-text-muted">产出</div>
      </div>
      <div class="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="dialog='memory'" data-testid="stat-memory">
        <div class="text-base font-mono font-medium text-text-primary">{{ memories.length }}</div>
        <div class="text-[10px] text-text-muted">🧠 记忆</div>
      </div>
      <div class="flex-1 px-3 py-2 rounded-lg bg-dark-800 border border-dark-border cursor-pointer hover:border-accent/50" @click="dialog='feasibility'" data-testid="stat-feasibility">
        <div class="text-base font-mono font-medium" :class="executionCapabilityClass">{{ inputModeText(feasibility.input_mode) }}</div>
        <div class="text-[10px] text-text-muted">{{ executionCapabilityText }}</div>
      </div>
    </div>

    <!-- 🏃 执行跑道（带当前位置指示）-->
    <div class="mb-3 p-3 rounded-xl border border-dark-border bg-dark-800">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xs text-text-muted">🏃 执行跑道</span>
        <span class="text-[10px] text-text-muted">{{ doneSteps }}/{{ steps.length }} 步</span>
        <div class="flex-1 h-1 bg-dark-900 rounded-full overflow-hidden ml-2">
          <div class="h-full transition-all duration-500" :class="trackColor" :style="{width: trackPct + '%'}"></div>
        </div>
        <span class="text-[10px] font-mono" :class="trackPct===100 ? 'text-emerald-400' : 'text-text-muted'">{{ trackPct }}%</span>
      </div>
      <div class="flex items-center gap-1 overflow-x-auto pb-1" data-testid="track">
        <template v-for="(s, i) in orderedSteps" :key="s.step_id">
          <div class="flex-shrink-0 relative">
            <!-- 当前位置指示 -->
            <div v-if="s.status === 'running'" class="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] text-blue-400 animate-bounce">📍</div>
            <div @click="openStep(s)" data-testid="track-node"
              class="px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all hover:scale-105 min-w-[110px]"
              :class="trackNodeClass(s.status)">
              <div class="flex items-center gap-1">
                <span class="text-xs">{{ stepIcon(s.status) }}</span>
                <span class="text-[11px] text-text-primary truncate flex-1">{{ s.name }}</span>
              </div>
              <div class="flex items-center gap-1 mt-0.5">
                <span class="text-[9px] px-1 rounded" :class="riskClass(s.risk_level)">{{ s.risk_level }}</span>
                <span v-if="s.requires_approval" class="text-[9px]">🔒</span>
                <span class="text-[9px] text-text-muted ml-auto">{{ stepStatusText(s.status) }}</span>
              </div>
            </div>
          </div>
          <span v-if="i < orderedSteps.length-1" class="flex-shrink-0 text-xs" :class="isEdgeDone(orderedSteps[i]) ? 'text-emerald-400' : 'text-text-muted'">→</span>
        </template>
        <div v-if="!steps.length" class="text-text-muted text-xs py-2">{{ ['discovering','planning'].includes(goal.status) ? '规划中...' : '暂无步骤' }}</div>
      </div>
    </div>

    <!-- 主区：4 等分（Plan | 智能体 | 决策流 | 记忆库）-->
    <div class="flex-1 grid grid-cols-4 gap-3 min-h-0">

      <!-- 列1：Plan 叙事 -->
      <div class="flex flex-col min-h-0">
        <div class="text-xs text-text-muted mb-2">📋 执行计划（{{ steps.length }}步）</div>
        <div class="flex-1 overflow-auto rounded-lg border border-dark-border bg-dark-800 p-2 space-y-3">
          <!-- 🎯 已锁定目标：代码分析后由管家综合，承上(发现)启下(执行) -->
          <div v-if="goal.goal_statement && goal.target_state === 'confirmed'"
            class="rounded-lg border border-cyan-700/40 bg-cyan-950/20 px-2.5 py-2">
            <div class="text-[10px] text-cyan-300 font-medium">🎯 已锁定目标（代码分析后综合）</div>
            <div class="text-[11px] text-text-primary mt-1 leading-relaxed">{{ goal.goal_statement }}</div>
            <div class="text-[10px] text-text-muted mt-1">验收点 {{ (goal.acceptance||[]).length }} 个 · 通过 {{ passedCount }}</div>
          </div>
          <div v-for="round in planRounds" :key="round.plan_version" data-testid="plan-round" class="space-y-2 rounded-lg"
            :class="round.plan_version === goal.plan_version ? 'ring-1 ring-accent/40 bg-accent/5 p-1' : ''">
            <!-- 轮次标题：资源准备 / 目标发现 / 目标执行 -->
            <div class="flex items-center gap-1.5 text-[11px] font-medium sticky top-0 bg-dark-800 py-0.5" :class="roundKindClass(round.plan_kind)">
              <span>{{ planKindLabel(round.plan_kind, round.plan_version) }}</span>
              <span class="text-[9px] text-text-muted">· {{ round.steps.length }}步</span>
              <span v-if="round.plan_version === goal.plan_version" class="text-[9px] px-1 rounded bg-accent/20 text-accent">当前</span>
            </div>
            <div v-for="(s, idx) in round.steps" :key="s.step_id" data-testid="plan-item"
              @click="selectStep(s)"
              class="rounded-lg border bg-dark-900 overflow-hidden transition-all cursor-pointer"
              :class="[stepBorder(s.status), selectedStepId===s.step_id ? 'ring-1 ring-accent' : '', isCurrentStep(s) ? 'shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : '']">
              <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-dark-border/50" :class="stepHeadBg(s.status)">
                <span class="text-[10px] font-mono text-text-muted">{{ idx + 1 }}</span>
                <span class="text-xs">{{ stepIcon(s.status) }}</span>
                <span class="text-xs font-medium text-text-primary flex-1 truncate">{{ s.name }}</span>
              </div>
              <div class="px-2 py-2 space-y-1.5">
                <div class="text-[11px] text-text-primary">{{ s.rationale || s.name }}</div>
                <div v-if="s.source_ref" class="text-[10px] text-cyan-400/80">📦 仓库：{{ s.source_ref }}</div>
                <div class="text-[10px] text-text-secondary">
                  <span class="text-text-muted">前提：</span>
                  <template v-if="s.depends_on?.length">需先完成 {{ depNames(s.depends_on) }}</template>
                  <template v-else>无依赖</template>
                </div>
                <div v-if="(s.serves_acceptance||[]).length" class="text-[10px]">
                  <span class="text-text-muted">为了：</span>
                  <span v-for="aid in s.serves_acceptance || []" :key="aid" class="mr-1.5">{{ verdictIcon(accVerdict(aid)) }}{{ accDesc(aid).slice(0,10) }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-[10px] px-1 rounded bg-dark-700 text-text-secondary">🤖{{ shortAgent(s.agent_id) }}</span>
                  <span class="text-[9px] px-1 rounded" :class="statusBadge(s.status)">{{ stepStatusText(s.status) }}</span>
                </div>
                <div v-if="s.status==='degraded'" class="text-[10px] text-orange-400">⚠️降级→{{ s.fallback_applied }}</div>
              </div>
            </div>
          </div>
          <!-- 历史轮次（被替换的旧计划，append-only 保留，可展开追溯）-->
          <div v-if="historyRounds.length" class="pt-1 border-t border-dark-border/50">
            <button @click="showHistory = !showHistory" class="text-[11px] text-text-muted hover:text-text-secondary">
              {{ showHistory ? '▾' : '▸' }} 历史轮次（已替换 {{ historyRounds.length }} 个计划，可追溯）
            </button>
            <div v-if="showHistory" class="space-y-2 mt-1 opacity-70">
              <div v-for="round in historyRounds" :key="'h'+round.plan_version" class="space-y-1">
                <div class="text-[10px] text-text-muted line-through">{{ planKindLabel(round.plan_kind, round.plan_version) }}</div>
                <div v-for="s in round.steps" :key="'h'+s.step_id+round.plan_version"
                  @click="selectStep(s)"
                  class="rounded border border-dark-border/50 bg-dark-900/50 px-2 py-1 cursor-pointer">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px]">{{ stepIcon(s.status) }}</span>
                    <span class="text-[11px] text-text-muted truncate flex-1">{{ s.name }}</span>
                    <span class="text-[9px] px-1 rounded" :class="statusBadge(s.status)">{{ stepStatusText(s.status) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!steps.length" class="text-text-muted text-xs text-center py-8">
            {{ ['discovering','planning'].includes(goal.status) ? '🧠 规划中...' : '暂无步骤' }}
          </div>
        </div>
      </div>

      <!-- 列2：智能体注册表（持久, 中文名+状态+累计运行+参与步, 点开看运行详情）-->
      <div class="flex flex-col min-h-0">
        <div class="text-xs text-text-muted mb-2">🤖 智能体（{{ goalAgents.length }}）<span class="text-[10px]">注册即在册·点开看日志</span></div>
        <div class="flex-1 overflow-auto rounded-lg border border-dark-border bg-dark-800 p-2 space-y-2">
          <div v-for="a in goalAgents" :key="a.agent_id" data-testid="agent-item"
            @click="openAgent(a)"
            class="p-2.5 rounded-lg border bg-dark-900 cursor-pointer hover:border-accent/50 transition-all" :class="agentBorder(a.status)">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :class="agentDot(a.status)"></span>
              <span class="text-xs text-text-primary flex-1 truncate">{{ a.agent_name }}</span>
              <span v-if="a.status==='running'" class="flex gap-0.5"><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></span><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse [animation-delay:0.2s]"></span><span class="w-1 h-1 rounded-full bg-blue-400 animate-pulse [animation-delay:0.4s]"></span></span>
              <span v-else-if="a.status==='completed'" class="text-emerald-400 text-xs agent-done">✓</span>
            </div>
            <div class="text-[10px] text-text-muted mt-1 flex items-center gap-1">
              <span>{{ a.capability_key }}</span>
              <span v-if="!a.can_execute" class="text-amber-400">·受限</span>
            </div>
            <div v-if="a.status==='running'" class="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 flex items-center gap-1 working-glow">
              <span class="inline-block animate-spin">🔄</span> 工作中<span v-if="a.last_step" class="text-blue-400">· 执行 {{ a.last_step }}</span>
            </div>
            <div class="text-[10px] mt-1 flex items-center gap-1">
              <span class="px-1 rounded" :class="statusBadge(a.status)">{{ agentStatusText(a.status) }}</span>
              <span class="text-text-muted">运行 {{ a.runs }} 次</span>
              <span v-if="a.served.length" class="text-text-muted ml-auto truncate">步:{{ a.served.join(',') }}</span>
            </div>
          </div>
          <div v-if="!goalAgents.length" class="text-text-muted text-xs text-center py-8">注册阶段装载智能体...</div>
        </div>
      </div>

      <!-- 列3+4：记忆体决策流（占2格，大显示）-->
      <div class="col-span-2 flex flex-col min-h-0">
        <div class="text-xs text-text-muted mb-2 flex items-center gap-2">
          <span>🧠 记忆体工作流（实时）</span>
          <span class="text-[10px] text-text-muted">{{ filteredEvents.length }}/{{ events.length }} 条决策</span>
          <div class="ml-auto flex gap-1">
            <button v-for="f in eventFilters" :key="f.key" @click="eventFilter = f.key"
              class="text-[9px] px-1.5 py-0.5 rounded border transition-colors"
              :class="eventFilter === f.key ? 'border-accent text-accent bg-accent/10' : 'border-dark-border text-text-muted hover:text-text-secondary'">
              {{ f.label }}
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto rounded-lg border border-dark-border bg-dark-800 p-3 space-y-2" ref="eventStream">
          <div v-for="(e, i) in filteredEvents" :key="i" data-testid="event-item"
            class="p-2 rounded-lg cursor-pointer transition-all"
            :class="[eventBg(e.actor), eventRelatedStep(e) && eventRelatedStep(e) === selectedStepId ? 'ring-1 ring-accent/60' : '']"
            @click="selectEvent(e)">
            <div class="flex items-start gap-2">
              <span class="flex-shrink-0 text-sm">{{ actorIcon(e.actor) }}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-medium" :class="actorColor(e.actor)">{{ actorName(e.actor) }}</span>
                  <span class="text-[10px] text-text-muted font-mono ml-auto">{{ formatTime(e.timestamp) }}</span>
                </div>
                <div class="text-xs text-text-secondary mt-0.5">{{ eventText(e) }}</div>

                <div v-if="e.event==='steward_thinking'" class="mt-2 space-y-1.5">
                  <div v-if="e.payload?.thought" class="text-[11px] text-purple-200/90 leading-relaxed bg-purple-950/20 border border-purple-900/30 rounded px-2 py-1.5">
                    {{ e.payload.thought }}
                  </div>
                  <div v-for="a in (e.payload?.acceptance_decisions || []).slice(0, 4)" :key="a.acceptance_id"
                    class="rounded border border-dark-border/70 bg-dark-950/40 px-2 py-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-mono text-purple-300">{{ a.acceptance_id }}</span>
                      <span class="text-[9px] px-1 rounded bg-dark-700 text-text-muted">{{ evidenceLabel(a.evidence_type) }}</span>
                    </div>
                    <div class="text-[10px] text-text-secondary mt-0.5">{{ shortText(a.desc, 56) }}</div>
                    <div class="text-[10px] text-text-muted mt-0.5">{{ a.why }}</div>
                  </div>
                  <div v-if="(e.payload?.acceptance_decisions || []).length > 4" class="text-[10px] text-text-muted">
                    还有 {{ (e.payload?.acceptance_decisions || []).length - 4 }} 个验收点...
                  </div>
                </div>

                <div v-else-if="e.event==='planner_thinking'" class="mt-2 space-y-1.5">
                  <div class="text-[11px] text-blue-200/90 leading-relaxed bg-blue-950/20 border border-blue-900/30 rounded px-2 py-1.5">
                    {{ e.payload?.thought || '规划器根据验收点、能力和依赖关系生成执行 DAG' }}
                  </div>
                  <div v-for="s in (e.payload?.step_decisions || []).slice(0, 5)" :key="s.step_id"
                    class="rounded border border-dark-border/70 bg-dark-950/40 px-2 py-1.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-mono text-blue-300">{{ s.step_id }}</span>
                      <span class="text-[10px] text-text-primary truncate">{{ s.step_name || s.capability }}</span>
                      <span class="text-[9px] text-text-muted ml-auto">{{ s.agent_name || s.agent_id }}</span>
                    </div>
                    <div class="text-[10px] text-text-muted mt-0.5">
                      <span v-if="s.depends_on?.length">依赖 {{ s.depends_on.join('、') }} · </span>{{ s.why || '按能力契约分配' }}
                    </div>
                  </div>
                  <div v-if="(e.payload?.step_decisions || []).length > 5" class="text-[10px] text-text-muted">
                    还有 {{ (e.payload?.step_decisions || []).length - 5 }} 个步骤...
                  </div>
                </div>

                <div v-else-if="e.event==='step_submitted'" class="mt-2 rounded border border-dark-border/70 bg-dark-950/40 px-2 py-1.5">
                  <div class="text-[10px] text-text-secondary">{{ e.payload?.activation_reason || e.payload?.rationale }}</div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span v-for="a in (e.payload?.serves_acceptance || [])" :key="a.id"
                      class="text-[9px] px-1.5 py-0.5 rounded bg-dark-700 text-text-muted">
                      {{ a.id }} · {{ evidenceLabel(a.evidence_type) }}
                    </span>
                    <span v-if="e.payload?.source_ref" class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/30 text-cyan-300">
                      {{ e.payload.source_ref }}
                    </span>
                  </div>
                </div>

                <div v-else-if="e.event==='codegen_progress'" class="mt-2 rounded border border-dark-border/70 bg-dark-950/40 px-2 py-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[9px] px-1.5 py-0.5 rounded" :class="codegenStageClass(e.payload?.stage)">{{ codegenStageText(e.payload?.stage) }}</span>
                    <span class="text-[10px] text-text-secondary flex-1">{{ e.payload?.summary }}</span>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-1 text-[9px] text-text-muted">
                    <span v-if="e.payload?.attempt">attempt {{ e.payload.attempt }}</span>
                    <span v-if="e.payload?.script_chars">{{ e.payload.script_chars }} chars</span>
                    <span v-if="e.payload?.cases_passed != null">{{ e.payload.cases_passed }} pass</span>
                    <span v-if="e.payload?.cases_failed != null">{{ e.payload.cases_failed }} fail</span>
                    <span v-if="e.payload?.suite_id">suite {{ e.payload.suite_id }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!filteredEvents.length" class="text-text-muted text-sm text-center py-8">等待记忆体决策...</div>
        </div>
      </div>
    </div>

    <!-- 底部：与记忆体交谈 -->
    <div class="mt-3 border border-dark-border rounded-lg bg-dark-800 p-2.5">
      <div v-if="chat.length" class="max-h-28 overflow-auto mb-2 space-y-1.5">
        <div v-for="(msg, i) in chat.slice(-4)" :key="i" class="text-xs" :class="msg.role==='user' ? 'text-accent-blue' : 'text-text-secondary'">
          <span class="font-medium">{{ msg.role==='user' ? '我' : '🧠' }}:</span> {{ msg.content }}
        </div>
      </div>
      <div v-if="chatLoading" class="text-xs text-text-muted mb-2 flex items-center gap-1">
        <span class="flex gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:0.2s]"></span></span>记忆体思考中...
      </div>
      <div class="flex gap-2">
        <input v-model="chatInput" @keydown.enter="sendChat" :disabled="chatLoading" data-testid="chat-input"
          placeholder="和记忆体交谈（问目标进度、为什么这么规划、记忆里有什么...）"
          class="flex-1 px-3 py-2 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50" />
        <button @click="sendChat" :disabled="chatLoading || !chatInput.trim()" data-testid="chat-send"
          class="px-4 py-2 rounded-lg bg-accent/20 text-accent text-sm hover:bg-accent/30 disabled:opacity-30">发送</button>
      </div>
    </div>

    <!-- ===== 弹窗 ===== -->
    <!-- 验收证据墙 -->
    <div v-if="dialog==='acceptance'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="dialog=''">
      <div class="w-[640px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">✓ 验收矩阵</h3>
        <div class="space-y-2">
          <div class="grid grid-cols-[1.4fr_0.8fr_1fr_1fr_0.7fr] gap-2 px-2 text-[10px] text-text-muted">
            <span>验收点</span><span>证据</span><span>计划步骤</span><span>智能体</span><span>状态</span>
          </div>
          <div v-for="row in acceptanceRows" :key="row.id"
            class="grid grid-cols-[1.4fr_0.8fr_1fr_1fr_0.7fr] gap-2 items-start p-2 rounded-lg bg-dark-900 border cursor-pointer hover:border-accent/50"
            :class="row.verdict==='pass' ? 'border-emerald-900/40' : row.verdict==='fail' ? 'border-red-900/40' : 'border-dark-border'"
            @click="row.step && selectStep(row.step)">
            <div>
              <div class="text-[10px] font-mono text-text-muted">{{ row.id }}</div>
              <div class="text-xs text-text-primary mt-0.5">{{ row.desc }}</div>
            </div>
            <div class="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-text-muted w-fit">{{ evidenceLabel(row.evidence_type) }}</div>
            <div class="text-xs text-text-secondary">
              <template v-if="row.step">{{ row.step.name }}</template>
              <template v-else>未分配</template>
            </div>
            <div class="text-xs text-text-secondary">{{ row.agentName }}</div>
            <div class="text-xs">{{ verdictIcon(row.verdict) }} {{ verdictText(row.verdict) }}</div>
          </div>
          <div v-if="!acceptanceRows.length" class="text-text-muted text-sm text-center py-8">暂无验收点</div>
        </div>
        <button @click="dialog=''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 证据 -->
    <div v-if="dialog==='evidence'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="dialog=''">
      <div class="w-[640px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">📎 证据 ({{ evidence.length }})</h3>
        <div class="space-y-2">
          <div v-for="e in evidence" :key="e.evidence_id" class="p-3 rounded-lg bg-dark-900 border border-dark-border">
            <div class="flex items-center gap-2">
              <span class="text-xs">{{ verdictIcon(e.verdict) }}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-text-muted">{{ evidenceLabel(e.type) }}</span>
              <span class="text-sm text-text-secondary flex-1">{{ e.summary || '(无摘要)' }}</span>
              <a v-if="e.ref" :href="e.ref" target="_blank" class="text-[10px] text-accent-blue">查看</a>
            </div>
            <div class="text-[10px] text-text-muted mt-1">→ {{ e.acceptance_id }} · 置信 {{ ((e.confidence||0)*100).toFixed(0) }}%</div>
          </div>
          <div v-if="!evidence.length" class="text-text-muted text-sm text-center py-8">暂无证据</div>
        </div>
        <button @click="dialog=''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 产出 -->
    <div v-if="dialog==='outputs'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="dialog=''">
      <div class="w-[640px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">📦 产出 ({{ artifacts.length }})</h3>
        <div class="space-y-2">
          <div v-for="a in artifacts" :key="a.artifact_id" class="p-3 rounded-lg bg-dark-900 border border-dark-border">
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">{{ a.type }}</span>
              <span class="text-[10px] text-text-muted">{{ a.step_id }}</span>
            </div>
            <div class="text-sm text-text-secondary mt-1">{{ a.summary }}</div>
            <a v-if="a.ref" :href="a.ref" target="_blank" class="text-[10px] text-accent-blue">查看产物</a>
          </div>
          <div v-if="!artifacts.length" class="text-text-muted text-sm text-center py-8">暂无产出</div>
        </div>
        <button @click="dialog=''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 记忆 -->
    <div v-if="dialog==='memory'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="dialog=''">
      <div class="w-[640px] max-h-[80vh] bg-dark-800 border border-dark-border rounded-xl p-6 overflow-auto">
        <h3 class="text-base font-medium mb-4">🧠 记忆 ({{ memories.length }})</h3>
        <div class="space-y-2">
          <div v-for="m in memories" :key="m.point_id" class="p-3 rounded-lg bg-dark-900 border border-dark-border">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] px-1.5 py-0.5 rounded" :class="m.verified ? 'bg-emerald-900/30 text-emerald-400' : 'bg-dark-700 text-text-muted'">{{ layerLabel(m.layer) }}</span>
              <span class="text-[10px] text-text-muted ml-auto">{{ formatTime(m.created_at) }}</span>
            </div>
            <div class="text-sm text-text-primary">{{ m.summary }}</div>
          </div>
          <div v-if="!memories.length" class="text-text-muted text-sm text-center py-8">暂无记忆</div>
        </div>
        <button @click="dialog=''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- 可行性画像（受限）-->
    <div v-if="dialog==='feasibility'" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="dialog=''">
      <div class="w-[560px] bg-dark-800 border border-dark-border rounded-xl p-6" data-testid="feasibility-panel">
        <h3 class="text-base font-medium mb-4">🔍 可行性画像</h3>
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-muted">输入模式</span>
            <span class="text-xs px-2 py-0.5 rounded bg-dark-600 text-text-primary">{{ inputModeText(feasibility.input_mode) }}</span>
            <span class="text-xs ml-auto" :class="inputCapabilityClass">{{ inputCapabilityText }}</span>
          </div>
          <div v-if="feasibility.runtime_evaluated_at" class="rounded-lg border border-dark-border bg-dark-900 px-3 py-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-text-muted">本轮结果</span>
              <span class="text-xs ml-auto" :class="executionCapabilityClass">{{ executionCapabilityText }}</span>
            </div>
            <div class="text-[10px] text-text-muted mt-1">
              实际证据：{{ runtimeEvidenceText }}
            </div>
          </div>
          <div>
            <div class="text-xs text-text-muted mb-1.5">输入资源可证明：</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="et in feasibility.allowed_evidence_types || []" :key="et" class="text-[10px] px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400">✓ {{ evidenceLabel(et) }}</span>
            </div>
          </div>
          <div>
            <div class="text-xs text-text-muted mb-1.5">暂时无法证明：</div>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="et in feasibility.blocked_evidence_types || []" :key="et" class="text-[10px] px-2 py-0.5 rounded bg-dark-700 text-text-muted">⏸️ {{ evidenceLabel(et) }}</span>
            </div>
          </div>
          <div v-if="goal.goal_statement" class="pt-3 border-t border-dark-border">
            <div class="text-xs text-text-muted">目标：</div>
            <div class="text-sm text-text-primary mt-1">{{ goal.goal_statement }}</div>
          </div>
        </div>
        <button @click="dialog=''" class="w-full mt-4 py-2 rounded-lg border border-dark-border text-sm text-text-secondary">关闭</button>
      </div>
    </div>

    <!-- Step 详情弹窗 -->
    <div v-if="stepDetail" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="stepDetail = null">
      <div class="w-[560px] bg-dark-800 border border-dark-border rounded-xl p-6 max-h-[80vh] overflow-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-base font-medium">{{ stepIcon(stepDetail.status) }} {{ stepDetail.name }}</h3>
          <button @click="stepDetail = null" class="text-text-muted hover:text-text-primary">✕</button>
        </div>
        <div class="space-y-3 text-sm">
          <div class="grid grid-cols-2 gap-3">
            <div class="p-2 rounded bg-dark-900"><div class="text-[10px] text-text-muted">能力</div><div class="text-text-primary font-mono text-xs mt-0.5">{{ stepDetail.capability_key }}</div></div>
            <div class="p-2 rounded bg-dark-900"><div class="text-[10px] text-text-muted">智能体</div><div class="text-text-primary text-xs mt-0.5">{{ stepDetail.agent_id }}</div></div>
            <div class="p-2 rounded bg-dark-900"><div class="text-[10px] text-text-muted">风险</div><div class="text-xs mt-0.5" :class="riskTextClass(stepDetail.risk_level)">{{ stepDetail.risk_level }}</div></div>
            <div class="p-2 rounded bg-dark-900"><div class="text-[10px] text-text-muted">证据类型</div><div class="text-text-primary text-xs mt-0.5">{{ evidenceLabel(stepDetail.evidence_type) }}</div></div>
          </div>
          <div v-if="stepDetail.status === 'degraded'" class="p-2 rounded bg-orange-900/10 border border-orange-900/30">
            <div class="text-[10px] text-orange-400">⚠️ 降级运行 → {{ stepDetail.fallback_applied }}</div>
            <div class="text-[10px] text-text-muted mt-0.5">{{ stepDetail.blocked_reason }}</div>
          </div>
          <div v-if="stepDetail.rationale" class="p-2 rounded bg-dark-900">
            <div class="text-[10px] text-text-muted">规划理由</div>
            <div class="text-text-secondary text-xs mt-0.5">{{ stepDetail.rationale }}</div>
          </div>
          <div v-if="stepDetail.attempts?.length" class="p-2 rounded bg-dark-900">
            <div class="text-[10px] text-text-muted mb-1">执行记录 ({{ stepDetail.attempts.length }})</div>
            <div v-for="(a, i) in stepDetail.attempts" :key="i" class="text-xs text-text-secondary border-l-2 border-dark-border pl-2 mb-1">
              #{{ a.attempt_no }} [{{ a.status }}] {{ a.output_summary?.slice(0, 60) }}
            </div>
          </div>
          <!-- 运行详情/日志：产物（喂了什么 + 怎么分析 + 产出什么）-->
          <div v-if="stepArtifact(stepDetail.step_id)" class="p-2 rounded bg-dark-900 border border-accent/20">
            <div class="text-[10px] text-accent mb-1">📄 运行详情 / 日志</div>
            <template v-if="stepArtifact(stepDetail.step_id)">
              <div v-if="stepArtifact(stepDetail.step_id).source_ref" class="text-[10px] text-cyan-400 mb-1">针对仓库：{{ stepArtifact(stepDetail.step_id).source_ref }}</div>
              <div class="text-[10px] text-text-muted">喂了什么（输入快照）：</div>
              <pre class="text-[10px] text-text-secondary whitespace-pre-wrap break-all max-h-24 overflow-auto bg-dark-950 rounded p-1 mb-1">{{ JSON.stringify(stepArtifact(stepDetail.step_id).inputs_snapshot || {}, null, 1).slice(0, 600) }}</pre>
              <div class="text-[10px] text-text-muted">怎么分析（思考/报告）：</div>
              <pre class="text-[10px] text-text-secondary whitespace-pre-wrap break-all max-h-40 overflow-auto bg-dark-950 rounded p-1 mb-1">{{ (stepArtifact(stepDetail.step_id).reasoning || '(无)').slice(0, 1500) }}</pre>
              <div class="text-[10px] text-text-muted">产出：<span class="text-text-secondary">{{ stepArtifact(stepDetail.step_id).summary }}</span></div>
            </template>
          </div>
          <div v-else-if="stepDetail.status==='running'" class="p-2 rounded bg-blue-900/10 text-[11px] text-blue-400">
            🔄 智能体执行中，产出回执后这里显示运行详情/日志…
          </div>
        </div>
      </div>
    </div>

    <!-- 智能体运行详情弹窗（点开智能体看日志/参与的每步产物）-->
    <div v-if="agentDetail" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="agentDetail = null">
      <div class="w-[600px] bg-dark-800 border border-dark-border rounded-xl p-6 max-h-[82vh] overflow-auto">
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-base font-medium">🤖 {{ agentDetail.agent_name }}</h3>
          <button @click="agentDetail = null" class="text-text-muted hover:text-text-primary">✕</button>
        </div>
        <div class="flex items-center gap-2 mb-3 text-xs">
          <span class="px-1.5 py-0.5 rounded" :class="statusBadge(agentDetail.status)">{{ agentStatusText(agentDetail.status) }}</span>
          <span class="text-text-muted">能力 {{ agentDetail.capability_key }}</span>
          <span class="text-text-muted">运行 {{ agentDetail.runs }} 次</span>
          <span class="text-text-muted ml-auto font-mono text-[10px]">{{ agentDetail.agent_id }}</span>
        </div>
        <div class="text-[11px] text-text-muted mb-2">参与步骤：{{ (agentDetail.served || []).join(', ') || '尚未执行' }}</div>
        <div class="space-y-2">
          <div v-for="art in agentArtifacts(agentDetail)" :key="art.artifact_id" class="p-2 rounded bg-dark-900 border border-dark-border">
            <div class="flex items-center gap-2 text-[10px]">
              <span class="px-1 rounded bg-accent/20 text-accent">{{ art.type }}</span>
              <span class="text-text-muted">{{ art.step_id }}</span>
              <span v-if="art.source_ref" class="text-cyan-400">📦{{ art.source_ref }}</span>
            </div>
            <div class="text-xs text-text-secondary mt-1">{{ art.summary }}</div>
            <details class="mt-1">
              <summary class="text-[10px] text-accent cursor-pointer">展开思考/日志</summary>
              <pre class="text-[10px] text-text-secondary whitespace-pre-wrap break-all max-h-48 overflow-auto bg-dark-950 rounded p-1 mt-1">{{ (art.reasoning || '(无思考记录)').slice(0, 2000) }}</pre>
            </details>
          </div>
          <div v-if="!agentArtifacts(agentDetail).length" class="text-text-muted text-xs text-center py-6">该智能体暂无产出记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import http from '@/api'

const route = useRoute()
const goalId = computed(() => route.params.id as string)

const goal = ref<any>({})
const steps = ref<any[]>([])
const events = ref<any[]>([])
const evidence = ref<any[]>([])
const artifacts = ref<any[]>([])
const memories = ref<any[]>([])
const feasibility = ref<any>({})
const summary = ref<any>(null)
const llmInfo = ref<any>(null)
const llmModelLabel = computed(() => {
  const p = llmInfo.value?.primary
  return p ? (p.name || p.model_name || p.model_id) : ''
})
// 本轮来源：取最近一条 code_update_round（持久显示，区别于一闪而过的横幅）
const roundActivation = computed(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    if (events.value[i].event === 'code_update_round') return events.value[i].payload || {}
  }
  return null
})
// 爆炸范围跳过 UI/设备：本轮触及了 side 但不含 client
const uiSkipped = computed(() => {
  const r = roundActivation.value
  return !!(r && Array.isArray(r.touched_sides) && r.touched_sides.length && !r.touched_sides.includes('client'))
})
function sideCnLabel(s: string) {
  return ({ backend: '后端', web: '前端', client: '客户端' } as Record<string, string>)[s] || s
}
// 爆炸范围明细（全部来自 code_update_round 事件 payload）
const blastFiles = computed(() => {
  const m = roundActivation.value?.changed_files_by_repo || {}
  const out: string[] = []
  for (const repo of Object.keys(m)) for (const f of (m[repo] || [])) out.push(`${repo}/${f}`)
  return out
})
const blastResetText = computed(() => {
  const ra = roundActivation.value?.reset_acceptance
  if (ra === 'all') return '全部验收点'
  return Array.isArray(ra) ? `${ra.length} 个验收点` : ''
})
async function fetchLlmInfo() {
  try {
    const res: any = await http.get('/ai/settings/llm')
    llmInfo.value = res.data || null
  } catch { /* ignore */ }
}
const superseded = ref<any[]>([])
const agentsReg = ref<any[]>([])
const stepDetail = ref<any>(null)
const dialog = ref('')
const selectedStepId = ref('')
const chat = ref<any[]>([])
const chatInput = ref('')
const chatLoading = ref(false)
const controlLoading = ref('')
const controlError = ref('')
const eventStream = ref<HTMLElement | null>(null)
const eventFilter = ref('all')
let pollTimer: any = null

// 逐秒走表（轮询间隔 3s 太粗，倒计时需要独立的 1s ticker 才能平滑递减）
const nowTs = ref(Math.floor(Date.now() / 1000))
let tickTimer: any = null

// ⏱️ 真实 plan 切换等待：完全由后端 goal.pending_plan_transition 驱动（非前端假倒计时）。
// 后端到点会真正启动下一轮 plan 并 $unset 该字段，下一次轮询自然收起横幅。
const planTransition = computed(() => {
  const pt = goal.value.pending_plan_transition
  return pt && pt.status === 'scheduled' ? pt : null
})
const planTransitionActive = computed(() => !!planTransition.value)
const planTransitionRemaining = computed(() => {
  const pt = planTransition.value
  if (!pt) return 0
  return Math.max(0, (pt.next_plan_at || 0) - nowTs.value)
})
const planTransitionText = computed(() => {
  const pt = planTransition.value
  if (!pt) return ''
  // pending_plan_transition 落库不含 label，按 to_kind 在前端映射
  const label = planKindLabel(pt.to_kind, pt.plan_version || goal.value.plan_version || 1)
  return planTransitionRemaining.value > 0
    ? `⏭️ 下一阶段〔${label}〕即将执行`
    : `⏭️ 正在启动下一阶段〔${label}〕…`
})

// 智能体列直接用持久注册表（中文名/状态/累计运行/参与步/能否执行）
const goalAgents = computed(() => {
  return (agentsReg.value || []).map((a: any) => ({
    agent_id: a.agent_id,
    agent_name: a.agent_name || a.agent_id,
    capability_key: a.capability_key,
    status: a.status,
    runs: a.runs || 0,
    served: a.served_steps || [],
    last_step: a.last_step || '',
    can_execute: a.can_execute,
  }))
})

// 历史轮次：被替换的旧计划（append-only 保留），按 plan_version 分组，供追溯
const historyRounds = computed(() => {
  const groups: Record<string, any> = {}
  for (const s of (superseded.value || [])) {
    const pv = s.plan_version || 1
    if (!groups[pv]) groups[pv] = { plan_version: pv, plan_kind: s.plan_kind || 'objective', steps: [] }
    groups[pv].steps.push(s)
  }
  return Object.values(groups).sort((a: any, b: any) => a.plan_version - b.plan_version)
})

// 某 step 的产物（运行详情/日志：思考 reasoning + 喂了什么 inputs + 产出）
function stepArtifact(stepId: string) {
  return artifacts.value.find((a: any) => a.step_id === stepId) || null
}
const showHistory = ref(false)

const orderedSteps = computed(() => {
  const result: any[] = []
  const visited = new Set<string>()
  const map: Record<string, any> = {}
  steps.value.forEach(s => map[s.step_id] = s)
  function visit(s: any) {
    if (!s || visited.has(s.step_id)) return
    for (const d of s.depends_on || []) visit(map[d])
    visited.add(s.step_id)
    result.push(s)
  }
  steps.value.forEach(visit)
  return result
})

const doneSteps = computed(() => steps.value.filter(s => ['completed', 'degraded', 'skipped'].includes(s.status)).length)
const trackPct = computed(() => steps.value.length ? Math.round(doneSteps.value / steps.value.length * 100) : 0)
const trackColor = computed(() => {
  if (steps.value.some(s => s.status === 'failed' || s.status === 'blocked')) return 'bg-red-400'
  if (steps.value.some(s => s.status === 'degraded')) return 'bg-orange-400'
  return 'bg-gradient-to-r from-accent to-accent-blue'
})
const passedCount = computed(() => (goal.value.acceptance || []).filter((a: any) => a.verdict === 'pass').length)
const canPause = computed(() => goal.value.status === 'running')
const canResume = computed(() => goal.value.status === 'paused')
const canCancel = computed(() => {
  const status = goal.value.status
  return !!status && !['completed', 'failed', 'cancelled'].includes(status)
})
const cancelButtonText = computed(() => ['guarding', 'partial_completed'].includes(goal.value.status) ? '停止守护' : '取消任务')

// 终态 / 守护：结束后给前端明确状态卡（含 summary 统计）
const terminalMeta = computed(() => {
  return ({
    completed: { icon: '🎉', title: '目标达标完成', tone: 'emerald' },
    partial_completed: { icon: '⚠️', title: '部分完成（诚实停止）', tone: 'orange' },
    failed: { icon: '✕', title: '任务失败', tone: 'red' },
    cancelled: { icon: '■', title: '任务已取消', tone: 'slate' },
    guarding: { icon: '🛡️', title: '已达标 · 持续守护中', tone: 'emerald' },
  } as Record<string, any>)[goal.value.status] || null
})
const terminalStats = computed(() => {
  const s = summary.value
  const acc = goal.value.acceptance || []
  return {
    passed: acc.filter((a: any) => a.verdict === 'pass').length,
    total: acc.length,
    durationSec: s?.duration?.total_sec ?? null,
    steps: s?.execution_stats || null,
    evidence: s?.evidence_collected ?? evidence.value.length,
  }
})
function fmtDuration(sec: number | null) {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60), r = sec % 60
  return r ? `${m}m${r}s` : `${m}m`
}
const inputCapabilityText = computed(() => feasibility.value.executable ? '✓ 输入可执行' : '⏸️ 输入受限')
const inputCapabilityClass = computed(() => feasibility.value.executable ? 'text-emerald-400' : 'text-amber-400')
const runtimeEvidenceTypes = computed(() => feasibility.value.runtime_evidence_types || [])
const runtimeExecutionTypes = computed(() => feasibility.value.runtime_execution_evidence_types || [])
const executionCapabilityText = computed(() => {
  if (typeof feasibility.value.runtime_executable === 'boolean') {
    return feasibility.value.runtime_executable ? '本轮已执行' : '本轮未执行'
  }
  return feasibility.value.executable ? '可执行' : '受限'
})
const executionCapabilityClass = computed(() => {
  if (typeof feasibility.value.runtime_executable === 'boolean') {
    return feasibility.value.runtime_executable ? 'text-emerald-400' : 'text-amber-400'
  }
  return feasibility.value.executable ? 'text-emerald-400' : 'text-amber-400'
})
const runtimeEvidenceText = computed(() => {
  if (!runtimeEvidenceTypes.value.length) return '暂无证据'
  const all = runtimeEvidenceTypes.value.map((et: string) => evidenceLabel(et)).join('、')
  if (!runtimeExecutionTypes.value.length) return `${all}；未产出 API/Web/设备/E2E 执行级证据`
  return all
})

// ===== 统一事件目录（基底）=====
// 新增/扩展任何事件，只在此处加一条：自动获得 中文文案 / 过滤分类 / 里程碑 / 闪现横幅。
// label 引用的 inputModeText/planKindLabel/codegenStageText/criticDecisionText 均为函数声明（已 hoist），运行期可调。
interface EventDef {
  label: (p: any) => string
  icon?: string
  cats: string[]              // 过滤分类（可多个）：thinking/plan/agent/codegen/risk/trigger/control/lifecycle/guard
  milestone?: boolean         // 是否进"节拍/里程碑"
  tone?: string               // 横幅/里程碑色调
  flash?: (p: any) => string  // 非空=该事件触发一次闪现横幅
}
function sideLabel(s: string) {
  return ({ backend: '后端', web: '前端', client: '客户端' } as Record<string, string>)[s] || s
}
const EVENT_CATALOG: Record<string, EventDef> = {
  profiling_started: { label: () => '开始可行性画像', icon: '🔍', cats: ['plan'] },
  feasibility_profiled: { label: p => `画像完成：${inputModeText(p.input_mode)}，可执行=${p.executable}`, icon: '🔍', cats: ['plan'], milestone: true },
  agents_registered: { label: p => `注册 ${p.count || 0} 个候选智能体`, icon: '⬡', cats: ['agent'] },
  steward_thinking: { label: p => `主管生成目标：${p.goal_statement || '正在综合目标'} [置信 ${((p.confidence||0)*100).toFixed(0)}%]`, icon: '🧠', cats: ['thinking'] },
  goal_generated: { label: p => `生成目标 + ${p.acceptance_count} 验收点 [置信 ${((p.confidence||0)*100).toFixed(0)}%]`, icon: '🎯', cats: ['thinking', 'plan'], milestone: true },
  capabilities_discovered: { label: p => `发现 ${p.count} 个可用能力`, icon: '🧰', cats: ['plan'] },
  planner_thinking: { label: p => `${planKindLabel(p.plan_kind || 'objective', p.plan_version || 1)}：${p.step_count || 0} 步分配`, icon: '📋', cats: ['thinking', 'plan'] },
  plan_generated: { label: p => `${p.round && p.round>1 ? `第${p.round}轮 ` : ''}规划 ${p.step_count} 步：${p.plan_summary || ''}`, icon: '📋', cats: ['plan'], milestone: true },
  plan_validation_failed: { label: p => `计划校验失败：${(p.problems||[]).join(', ')}`, icon: '🛑', cats: ['risk'] },
  resource_ready: { label: p => `资源准备完成：${(p.prepared || []).length} 个仓库`, icon: '📦', cats: ['plan'], milestone: true },
  step_submitted: { label: p => `激活【${p.agent_name || p.agent_id || p.capability}】执行 ${p.step_id}${p.step_name ? ` · ${p.step_name}` : ''}`, icon: '⚙️', cats: ['agent'] },
  step_no_real_agent: { label: p => `${p.step_id} 找不到真实智能体：${p.reason || ''}`, icon: '🛑', cats: ['agent', 'risk'] },
  codegen_progress: { label: p => `${codegenStageText(p.stage)}：${p.summary || ''}`, icon: '🧪', cats: ['codegen'] },
  step_degraded: { label: p => `${p.step_id} 降级：${p.reason}`, icon: '⚠️', cats: ['agent', 'risk'] },
  step_completed: { label: p => `${p.step_id} 完成`, icon: '✅', cats: ['agent'] },
  step_failed: { label: p => `${p.step_id} 失败：${p.error || ''}`, icon: '❌', cats: ['agent', 'risk'] },
  step_retrying: { label: p => `${p.step_id} 重试`, icon: '🔁', cats: ['agent'] },
  steward_evaluated: { label: p => `评估：${p.conclusion || ''}`, icon: '🧠', cats: ['thinking'] },
  critic_decision: { label: p => `质检结论：${criticDecisionText(p.decision)} — ${p.reason || ''}`, icon: '🔎', cats: ['thinking', 'risk'] },
  replan_triggered: { label: p => `🔄 第${p.round}轮重规划（未达成 ${(p.unmet||[]).join('、') || '—'}）：${p.reason || ''}`, icon: '🔄', cats: ['plan'], milestone: true },
  verification: { label: p => `验收：${p.passed}/${p.total_acceptance} 通过`, icon: '🔎', cats: ['plan'], milestone: true },
  plan_transition: { label: p => `⏱️ 等待 ${p.delay_sec || 0}s 后进入 ${p.to_label || planKindLabel(p.to_kind, p.plan_version || 1)}`, icon: '⏱️', cats: ['plan'] },
  plan_transition_started: { label: p => `▶️ 进入 ${p.to_label || planKindLabel(p.to_kind, p.plan_version || 1)}`, icon: '▶️', cats: ['plan'], milestone: true },
  // ── 触发 / 终态 / 控制 / 守护 / 自愈（新增，演示主线）──
  code_update_round: { label: p => `🔁 代码提交触发第 ${p.round || ''} 轮验证${p.touched_sides && p.touched_sides.length ? ` · 触及 ${p.touched_sides.map(sideLabel).join('、')}` : ''}`, icon: '🔁', cats: ['trigger', 'plan'], milestone: true, tone: 'indigo', flash: p => `🔁 检测到代码提交，启动第 ${p.round || ''} 轮验证${p.touched_sides && p.touched_sides.length ? `（触及 ${p.touched_sides.map(sideLabel).join('、')}）` : ''}` },
  code_update_ignored: { label: () => '📄 提交未触及可测试范围，跳过本轮', icon: '📄', cats: ['trigger'], tone: 'slate', flash: () => '📄 本次提交只动了文档/配置，未触发重验' },
  goal_completed: { label: p => `🎉 目标达标完成（${p.passed}/${p.total_acceptance} 验收通过）`, icon: '🎉', cats: ['lifecycle'], milestone: true, tone: 'emerald', flash: () => '🎉 目标已达标完成' },
  goal_guarding: { label: p => `🛡️ 已达标，转入持续守护（${p.passed}/${p.total_acceptance}）`, icon: '🛡️', cats: ['lifecycle', 'guard'], milestone: true, tone: 'emerald', flash: () => '🛡️ 已达标，进入持续守护，等待下次代码提交' },
  goal_partial: { label: p => `⚠️ 部分完成（${p.passed}/${p.total_acceptance}）：${p.reason || ''}`, icon: '⚠️', cats: ['lifecycle'], milestone: true, tone: 'orange', flash: () => '⚠️ 本轮部分完成（诚实停止，未达标）' },
  goal_paused: { label: p => `⏸️ 已暂停：${p.reason || ''}`, icon: '⏸️', cats: ['control'], milestone: true, tone: 'amber', flash: () => '⏸️ 任务已暂停调度' },
  goal_resumed: { label: p => `▶️ 已恢复：${p.reason || ''}`, icon: '▶️', cats: ['control'], milestone: true, tone: 'blue', flash: () => '▶️ 任务已恢复推进' },
  goal_cancelled: { label: p => `■ 已取消：${p.reason || ''}`, icon: '■', cats: ['control'], milestone: true, tone: 'slate', flash: () => '■ 任务已取消' },
  watchdog_advance: { label: () => '🩺 看门狗自愈：检测到卡死，自动推进恢复', icon: '🩺', cats: ['risk'], milestone: true, tone: 'amber', flash: () => '🩺 看门狗检测到卡死，已自动恢复推进' },
  probe_done: { label: p => `探查完成：${p.capability || ''}`, icon: '🔍', cats: ['plan'] },
  runtime_error: { label: p => `运行错误：${(p.error || '').slice(0, 80)}`, icon: '🛑', cats: ['risk'], tone: 'red' },
}

const eventFilters = [
  { key: 'all', label: '全部' },
  { key: 'milestone', label: '里程碑' },
  { key: 'thinking', label: '思考' },
  { key: 'plan', label: '计划' },
  { key: 'agent', label: '激活' },
  { key: 'codegen', label: '代码' },
  { key: 'risk', label: '异常' },
]
const filteredEvents = computed(() => {
  const f = eventFilter.value
  if (f === 'all') return events.value
  if (f === 'milestone') return events.value.filter((e: any) => EVENT_CATALOG[e.event]?.milestone)
  return events.value.filter((e: any) => EVENT_CATALOG[e.event]?.cats.includes(f))
})

// 节拍/里程碑：演示叙事主线（目标锁定→规划→执行→验收→守护→提交触发→自愈…）
const milestones = computed(() => events.value
  .filter((e: any) => EVENT_CATALOG[e.event]?.milestone)
  .map((e: any) => {
    const def = EVENT_CATALOG[e.event]!
    return { key: `${e.event}_${e.timestamp}`, icon: def.icon || '•', tone: def.tone || 'default',
             text: def.label(e.payload || {}), ts: e.timestamp }
  }))

// 事件驱动的统一闪现横幅（catalog 里带 flash 的事件触发；只闪新事件，刷新不重放旧的）
const eventFlash = ref('')
const eventFlashTone = ref('indigo')
let eventFlashTimer: any = null
let lastFlashKey = ''
const latestFlashEvent = computed(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    if (EVENT_CATALOG[events.value[i].event]?.flash) return events.value[i]
  }
  return null
})
watch(latestFlashEvent, (e: any) => {
  if (!e) return
  const key = `${e.event}_${e.timestamp}`
  if (key === lastFlashKey) return
  lastFlashKey = key
  if (Math.floor(Date.now() / 1000) - (e.timestamp || 0) > 20) return  // 不重放 20s 前的旧事件
  const def = EVENT_CATALOG[e.event]
  if (!def?.flash) return
  eventFlash.value = def.flash(e.payload || {})
  eventFlashTone.value = def.tone || 'indigo'
  if (eventFlashTimer) clearTimeout(eventFlashTimer)
  eventFlashTimer = setTimeout(() => { eventFlash.value = '' }, 5000)
})
function flashToneClass(tone: string) {
  return ({
    emerald: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
    indigo: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-100',
    amber: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
    orange: 'bg-orange-500/15 border-orange-500/40 text-orange-200',
    blue: 'bg-blue-500/15 border-blue-500/40 text-blue-200',
    red: 'bg-red-500/15 border-red-500/40 text-red-200',
    slate: 'bg-slate-500/15 border-slate-500/40 text-slate-200',
  } as Record<string, string>)[tone] || 'bg-indigo-500/15 border-indigo-500/40 text-indigo-100'
}

const activeStep = computed(() => {
  return orderedSteps.value.find((s: any) => s.status === 'running')
    || orderedSteps.value.find((s: any) => s.status === 'ready')
    || orderedSteps.value.find((s: any) => s.status === 'pending')
    || orderedSteps.value[orderedSteps.value.length - 1]
    || null
})
const activeAgent = computed(() => {
  const s = activeStep.value
  if (!s) return null
  return goalAgents.value.find((a: any) => a.agent_id === s.agent_id || a.last_step === s.step_id) || null
})
const passiveWaiting = computed(() => {
  const status = goal.value.status
  if (status === 'guarding') return true
  return status === 'partial_completed'
    && (goal.value.completion_policy === 'continuous' || goal.value.auto_replan === false)
})
const waitingTriggerText = computed(() => {
  if (goal.value.status === 'guarding') return '已达标，守护等待中'
  return '本轮已结束，等待下一次触发'
})
const waitingTriggerHint = computed(() => {
  if (goal.value.status === 'guarding') return '持续守护模式，下一次提交会重新激活'
  return goal.value.auto_replan === false ? '外部驱动模式，等待 webhook/提交触发下一轮' : '等待主管重新激活'
})
const latestDecision = computed(() => {
  return [...events.value].reverse().find((e: any) =>
    ['steward_thinking', 'planner_thinking', 'critic_decision', 'replan_triggered', 'codegen_progress'].includes(e.event)
  ) || null
})
const currentRound = computed(() => {
  const pv = goal.value.plan_version || activeStep.value?.plan_version || 1
  return planRounds.value.find((r: any) => r.plan_version === pv) || planRounds.value[planRounds.value.length - 1] || null
})
const currentRoundLabel = computed(() => currentRound.value ? planKindLabel(currentRound.value.plan_kind, currentRound.value.plan_version) : '等待规划')
const currentRoundProgress = computed(() => {
  const r = currentRound.value
  if (!r) return '尚未生成 plan'
  const done = r.steps.filter((s: any) => ['completed', 'degraded', 'skipped', 'failed'].includes(s.status)).length
  return `${done}/${r.steps.length} 步已终态`
})
const currentActionText = computed(() => {
  if (goal.value.status === 'paused') return '已暂停'
  return passiveWaiting.value ? waitingTriggerText.value : (activeStep.value?.name || statusText(goal.value.status || ''))
})
const currentActionHint = computed(() => {
  if (goal.value.status === 'paused') return '不会继续调度后续步骤，点击恢复可继续推进'
  if (passiveWaiting.value) return waitingTriggerHint.value
  const s = activeStep.value
  if (!s) return goal.value.goal_statement ? '目标已生成' : '等待主管生成第一轮计划'
  if (s.status === 'running') return s.depends_on?.length ? `由 ${depNames(s.depends_on)} 完成触发 · ${s.capability_key}` : `执行中 · ${s.capability_key}`
  if (s.status === 'pending') return s.depends_on?.length ? `等待前置 ${depNames(s.depends_on)}` : '等待调度'
  return `${stepStatusText(s.status)} · ${s.capability_key}`
})
const currentAgentText = computed(() => {
  if (goal.value.status === 'paused') return '调度已暂停'
  return passiveWaiting.value ? '暂无运行中智能体' : (activeAgent.value?.agent_name || activeStep.value?.agent_id || '尚未激活')
})
const currentAgentHint = computed(() => {
  if (goal.value.status === 'paused') return '已派出的任务不强杀，后续推进被暂停'
  if (passiveWaiting.value) return '上一轮智能体已回执，等待新输入'
  return activeAgent.value ? `运行 ${activeAgent.value.runs || 0} 次 · ${activeAgent.value.capability_key}` : '等待计划选择智能体'
})
const latestDecisionText = computed(() => latestDecision.value ? eventText(latestDecision.value) : '等待新决策')
const nextActionText = computed(() => {
  const status = goal.value.status
  const kind = goal.value.current_plan_kind
  if (status === 'paused') return '等待人工恢复'
  if (passiveWaiting.value) return status === 'guarding' ? '等待下一次代码提交' : '等待下一次触发'
  if (status === 'awaiting_approval') return '等待人工审批'
  if (status === 'verifying') return '质检验收'
  if (kind === 'resource') return '资源就绪后进入目标发现'
  if (kind === 'discovery') return '综合探查结果生成目标'
  if (kind === 'objective' && activeStep.value) return activeStep.value.status === 'running' ? '等待智能体回执' : '推进后续步骤'
  if (['completed', 'partial_completed', 'blocked', 'failed'].includes(status)) return statusText(status)
  return '等待主管推进'
})

const acceptanceRows = computed(() => {
  return (goal.value.acceptance || []).map((a: any) => {
    const step = steps.value.find((s: any) => (s.serves_acceptance || []).includes(a.id))
    const ev = evidence.value.find((x: any) => x.acceptance_id === a.id)
    const ag = step ? goalAgents.value.find((x: any) => x.agent_id === step.agent_id) : null
    return {
      ...a,
      step,
      evidence: ev,
      agentName: ag?.agent_name || step?.agent_id || '未分配',
      verdict: a.verdict || ev?.verdict || 'pending',
    }
  })
})

// ===== 自主流程四阶段：资源准备 → 目标发现 → 锁定目标 → 执行目标 =====
const flowStages = computed(() => {
  const ts = goal.value.target_state || 'unknown'
  const kind = goal.value.current_plan_kind || ''
  const status = goal.value.status || ''
  const hasResource = steps.value.some((s: any) => s.plan_kind === 'resource')
  const confirmed = ts === 'confirmed'
  const objectiveActive = kind === 'objective'
  const discoverActive = kind === 'discovery' || ts === 'discovering'
  const done = ['completed', 'partial_completed', 'guarding'].includes(status)
  return [
    { key: 'resource', icon: '📦', label: '资源准备',
      state: kind === 'resource' ? 'active' : (hasResource || discoverActive || confirmed || objectiveActive) ? 'done' : 'todo' },
    { key: 'discovery', icon: '🔍', label: '目标发现',
      state: (discoverActive && !confirmed) ? 'active' : (confirmed || objectiveActive) ? 'done' : 'todo' },
    { key: 'target', icon: '🎯', label: '锁定目标',
      state: confirmed ? 'done' : (discoverActive ? 'active' : 'todo') },
    { key: 'objective', icon: '🚀', label: '执行目标',
      state: done ? 'done' : objectiveActive ? 'active' : 'todo' },
  ]
})

// ===== plan 按轮次分组（plan_version + plan_kind）=====
function planKindLabel(kind: string, pv: number) {
  return ({ resource: `📦 Plan${pv} 资源准备`, discovery: `🔍 Plan${pv} 目标发现`,
            objective: `🚀 Plan${pv} 目标执行` } as Record<string, string>)[kind] || `Plan${pv}`
}
const planRounds = computed(() => {
  const groups: Record<string, any> = {}
  for (const s of orderedSteps.value) {
    const pv = s.plan_version || 1
    if (!groups[pv]) groups[pv] = { plan_version: pv, plan_kind: s.plan_kind || 'objective', steps: [] }
    groups[pv].steps.push(s)
  }
  return Object.values(groups).sort((a: any, b: any) => a.plan_version - b.plan_version)
})

// ===== replan 重新插入交互：plan_version 增大时弹醒目横幅，4s 自动淡出 =====
const replanFlash = ref('')
let flashTimer: any = null
watch(() => goal.value.plan_version, (nv, ov) => {
  if (ov != null && nv != null && nv > ov) {
    const rt = [...events.value].reverse().find((e: any) => e.event === 'replan_triggered')
    const round = (rt && rt.payload && rt.payload.round) || nv
    replanFlash.value = `🔄 主管重新规划：第 ${round} 轮计划已插入`
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(() => { replanFlash.value = '' }, 4000)
  }
})

// ===== 目标锁定过渡：target_state 变 confirmed（代码分析找到目标）→ 弹横幅给节拍 =====
const lockFlash = ref('')
let lockTimer: any = null
watch(() => goal.value.target_state, (nv, ov) => {
  if (nv === 'confirmed' && ov && ov !== 'confirmed') {
    const gs = (goal.value.goal_statement || '').slice(0, 40)
    lockFlash.value = `🎯 代码分析完成，已锁定目标${gs ? '：' + gs + '…' : ''} — 正在生成执行计划…`
    if (lockTimer) clearTimeout(lockTimer)
    lockTimer = setTimeout(() => { lockFlash.value = '' }, 4000)
  }
})

function stageStateClass(s: string) {
  return { active: 'border-accent text-accent bg-accent/10 animate-pulse', done: 'border-emerald-600/40 text-emerald-400 bg-emerald-900/10', todo: 'border-dark-border text-text-muted' }[s] || 'border-dark-border text-text-muted'
}
function roundKindClass(kind: string) {
  return { resource: 'text-amber-400', discovery: 'text-cyan-400', objective: 'text-blue-400' }[kind] || 'text-text-muted'
}
function targetStateText(ts: string) {
  return ({ unknown: '未知', discovering: '发现中', confirmed: '已锁定' } as Record<string, string>)[ts] || ts
}

function isEdgeDone(s: any) { return ['completed', 'degraded', 'skipped'].includes(s?.status) }
function isCurrentStep(s: any) { return activeStep.value && s?.step_id === activeStep.value.step_id }
function eventRelatedStep(e: any) {
  const p = e.payload || {}
  return p.step_id || ''
}
function selectEvent(e: any) {
  const sid = eventRelatedStep(e)
  if (!sid) return
  const s = steps.value.find((x: any) => x.step_id === sid)
  if (s) selectedStepId.value = sid
}

// ===== Plan 叙事关联 =====
function stepEvidence(stepId: string) {
  return evidence.value.filter((e: any) => e.step_id === stepId)
}
function accDesc(aid: string) {
  const a = (goal.value.acceptance || []).find((x: any) => x.id === aid)
  return a ? a.desc : aid
}
function accVerdict(aid: string) {
  const a = (goal.value.acceptance || []).find((x: any) => x.id === aid)
  return a ? a.verdict : 'pending'
}
function depNames(deps: string[]) {
  const map: Record<string, string> = {}
  steps.value.forEach((s: any) => map[s.step_id] = s.name)
  return deps.map(d => map[d] || d).join('、')
}
function stepHeadBg(s: string) {
  return { running: 'bg-blue-900/10', completed: 'bg-emerald-900/10', degraded: 'bg-orange-900/10', failed: 'bg-red-900/10' }[s] || ''
}
function statusBadge(s: string) {
  return { pending:'bg-dark-600 text-text-muted', ready:'bg-dark-600 text-text-secondary', running:'bg-blue-900/30 text-blue-400', completed:'bg-emerald-900/30 text-emerald-400', degraded:'bg-orange-900/30 text-orange-400', failed:'bg-red-900/30 text-red-400', blocked:'bg-red-900/30 text-red-400', waiting:'bg-amber-900/30 text-amber-400' }[s] || 'bg-dark-600 text-text-muted'
}

async function fetchData() {
  try {
    const res: any = await http.get('/ai/goal/detail', { params: { goal_id: goalId.value } })
    goal.value = res.data?.goal || {}
    steps.value = res.data?.steps || []
    events.value = res.data?.events || []
    evidence.value = res.data?.evidence || []
    artifacts.value = res.data?.artifacts || []
    superseded.value = res.data?.superseded_steps || []
    agentsReg.value = res.data?.agents || []
    memories.value = res.data?.memories || []
    feasibility.value = goal.value.feasibility || {}
    summary.value = res.data?.summary || null
    nextTick(() => { if (eventStream.value) eventStream.value.scrollTop = eventStream.value.scrollHeight })
  } catch {}
}

async function approve() {
  await http.post('/ai/goal/approve', { goal_id: goalId.value })
  fetchData()
}
async function controlGoal(action: 'pause' | 'resume' | 'cancel') {
  controlError.value = ''
  if (action === 'cancel') {
    const ok = window.confirm('确定要停止这个任务吗？已完成的计划、证据和记忆会保留，但后续不会再自动推进。')
    if (!ok) return
  }
  const reason = ({ pause: '前端人工暂停', resume: '前端人工恢复', cancel: '前端人工取消' } as Record<string, string>)[action]
  controlLoading.value = action
  try {
    await http.post(`/ai/goal/${action}`, { goal_id: goalId.value, reason })
    await fetchData()
  } catch (e: any) {
    controlError.value = e?.response?.data?.message || e?.message || '操作失败'
  } finally {
    controlLoading.value = ''
  }
}
function openStep(s: any) { stepDetail.value = s }
function selectStep(s: any) { selectedStepId.value = s.step_id; stepDetail.value = s }
const agentDetail = ref<any>(null)
function openAgent(a: any) { agentDetail.value = a }
function agentStatusText(s: string) {
  return ({ registered: '已注册待命', idle: '待命', running: '运行中', completed: '已完成',
            failed: '失败', degraded: '降级' } as Record<string, string>)[s] || s
}
// 取某智能体参与过的 step 的产物（按 served_steps），作为运行详情/日志
function agentArtifacts(a: any) {
  const set = new Set(a.served || [])
  return artifacts.value.filter((x: any) => set.has(x.step_id))
}

async function sendChat() {
  if (!chatInput.value.trim() || chatLoading.value) return
  const q = chatInput.value
  chatInput.value = ''
  chat.value.push({ role: 'user', content: q })
  chatLoading.value = true
  try {
    const res: any = await http.post('/ai/goal/chat', { goal_id: goalId.value, question: q })
    chat.value.push({ role: 'steward', content: res.data?.answer || '(无回复)' })
  } catch {
    chat.value.push({ role: 'steward', content: '⚠️ 对话失败' })
  } finally {
    chatLoading.value = false
  }
}

async function fetchChatHistory() {
  try {
    const res: any = await http.get('/ai/goal/chat/history', { params: { goal_id: goalId.value } })
    const msgs = res.data?.messages || []
    if (msgs.length) chat.value = msgs.map((m: any) => ({ role: m.role, content: m.content }))
  } catch {}
}

function shortAgent(a: string) { return (a || '').replace('agent_', '') }
function agentBorder(s: string) {
  return { running: 'border-blue-500/50', completed: 'border-emerald-900/40', degraded: 'border-orange-900/40', failed: 'border-red-900/40' }[s] || 'border-dark-border'
}
function agentDot(s: string) {
  return { running: 'bg-blue-400 animate-pulse', completed: 'bg-emerald-400', degraded: 'bg-orange-400', failed: 'bg-red-400', pending: 'bg-zinc-600' }[s] || 'bg-zinc-600'
}

function statusClass(s: string) {
  return { discovering:'bg-purple-900/30 text-purple-400', planning:'bg-purple-900/30 text-purple-400', awaiting_approval:'bg-amber-900/30 text-amber-400', running:'bg-blue-900/30 text-blue-400', paused:'bg-slate-700 text-slate-300', verifying:'bg-cyan-900/30 text-cyan-400', guarding:'bg-emerald-900/30 text-emerald-400', completed:'bg-emerald-900/30 text-emerald-400', partial_completed:'bg-orange-900/30 text-orange-400', blocked:'bg-red-900/30 text-red-400', failed:'bg-red-900/30 text-red-400', cancelled:'bg-dark-700 text-text-muted' }[s] || 'bg-dark-600 text-text-muted'
}
function statusText(s: string) {
  return { discovering:'画像中', planning:'规划中', awaiting_approval:'待审批', running:'执行中', paused:'已暂停', verifying:'验收中', guarding:'守护中', completed:'已完成', partial_completed:'部分完成', blocked:'阻塞', failed:'失败', cancelled:'已取消' }[s] || s
}
function inputModeText(m: string) {
  return { doc_only:'仅文档', repo_only:'仅代码', full:'文档+代码', mixed:'混合', empty:'无输入' }[m] || m || '-'
}
function evidenceLabel(et: string) {
  return { doc_review:'文档评审', static_analysis:'静态分析', testcase_generated:'用例生成', api_test:'API测试', web_test:'Web测试', device_test:'真机测试', e2e_test:'端到端' }[et] || et
}
function layerLabel(l: string) {
  return { raw_observation:'观察', inference:'推断', verified_fact:'已验证', project_rule:'项目规则' }[l] || l
}
function verdictIcon(v: string) {
  return { pass:'✅', fail:'❌', partial:'🟠', blocked:'🛑', prepared:'◔', pending:'○' }[v] || '○'
}
function verdictText(v: string) {
  return { pass:'通过', fail:'失败', partial:'部分', blocked:'阻塞', prepared:'已准备', pending:'待验证', not_applicable:'不适用' }[v] || v || '待验证'
}
function stepIcon(s: string) {
  return { pending:'○', ready:'◔', running:'🔄', waiting:'⏸️', completed:'✅', degraded:'⚠️', retrying:'🔁', failed:'❌', blocked:'🛑', skipped:'⏭️', cancelled:'⏹️' }[s] || '○'
}
function stepStatusText(s: string) {
  return { pending:'等待', ready:'就绪', running:'运行', waiting:'等待', completed:'完成', degraded:'降级', retrying:'重试', failed:'失败', blocked:'阻塞', skipped:'跳过', cancelled:'取消' }[s] || s
}
function stepBorder(s: string) {
  return { running:'border-blue-900/50', completed:'border-emerald-900/50', degraded:'border-orange-900/50', failed:'border-red-900/50', blocked:'border-red-900/50' }[s] || 'border-dark-border'
}
function trackNodeClass(s: string) {
  return { running:'border-blue-500/60 bg-blue-900/20', completed:'border-emerald-500/40 bg-emerald-900/10', degraded:'border-orange-500/50 bg-orange-900/10', failed:'border-red-500/50 bg-red-900/10', blocked:'border-red-500/50 bg-red-900/10', waiting:'border-amber-500/50 bg-amber-900/10' }[s] || 'border-dark-border bg-dark-900'
}
function riskClass(r: string) {
  return { low:'bg-emerald-900/30 text-emerald-400', medium:'bg-amber-900/30 text-amber-400', high:'bg-red-900/30 text-red-400' }[r] || 'bg-dark-600 text-text-muted'
}
function riskTextClass(r: string) {
  return { low:'text-emerald-400', medium:'text-amber-400', high:'text-red-400' }[r] || 'text-text-muted'
}
function actorIcon(a: string) {
  return { profiler:'🔍', steward:'🧠', planner:'📋', critic:'🔎', scheduler:'⚙️', device_worker:'🧪', ai_worker:'🤖', system:'⚡', human:'👤' }[a] || '•'
}
function actorName(a: string) {
  return { profiler:'可行性画像', steward:'记忆体', planner:'规划器', critic:'质检员', scheduler:'调度器', device_worker:'设备执行器', ai_worker:'AI执行器', system:'系统', human:'人工' }[a] || a
}
function actorColor(a: string) {
  return { profiler:'text-cyan-400', steward:'text-purple-400', planner:'text-blue-400', critic:'text-pink-400', scheduler:'text-text-secondary', device_worker:'text-emerald-400', ai_worker:'text-emerald-300', system:'text-text-muted', human:'text-amber-400' }[a] || 'text-text-muted'
}
function eventBg(a: string) {
  return { steward:'bg-purple-900/10 border border-purple-900/20', planner:'bg-blue-900/10 border border-blue-900/20', critic:'bg-pink-900/10 border border-pink-900/20', device_worker:'bg-emerald-900/10 border border-emerald-900/20', ai_worker:'bg-emerald-900/10 border border-emerald-900/20', human:'bg-amber-900/10 border border-amber-900/20' }[a] || 'bg-dark-900'
}
function shortText(v: string, n = 48) {
  const s = v || ''
  return s.length > n ? s.slice(0, n) + '...' : s
}
function codegenStageText(s: string) {
  return {
    interface_doc: '接口契约',
    route_scan: '路由扫描',
    script_generating: '生成脚本',
    script_generated: '脚本完成',
    script_reused: '复用脚本',
    script_running: '运行脚本',
    script_error: '脚本异常',
    script_healed: '自愈修复',
    mock_result: 'Mock结果',
    ui_script_generating: '生成UI脚本',
    ui_script_generated: 'UI脚本完成',
    ui_script_running: '运行UI脚本',
    device_test_start: 'UI自动化启动',
    mock_endpoints_fallback: 'Mock端点兜底',
    script_regenerate_forced: '强制重生成脚本',
    mock_config_adjusted: 'Mock配置校准',
    blocked: '阻塞',
    finished: '完成',
  }[s] || s || '进度'
}
function codegenStageClass(s: string) {
  if (['script_error', 'blocked'].includes(s)) return 'bg-red-900/30 text-red-300'
  if (['ui_script_generating', 'ui_script_generated', 'ui_script_running', 'device_test_start'].includes(s)) return 'bg-purple-900/30 text-purple-300'
  if (['script_healed', 'mock_result'].includes(s)) return 'bg-amber-900/30 text-amber-300'
  if (s === 'finished') return 'bg-emerald-900/30 text-emerald-300'
  return 'bg-blue-900/30 text-blue-300'
}
function eventText(e: any) {
  const def = EVENT_CATALOG[e.event]
  return def ? def.label(e.payload || {}) : e.event
}
function criticDecisionText(d: string) {
  return { complete:'达标完成', replan:'重新规划', partial:'部分完成' }[d] || d
}
function formatTime(ts: number) { return ts ? new Date(ts * 1000).toLocaleTimeString().slice(0, 8) : '' }
function shouldPollGoal() {
  return !['completed', 'failed', 'cancelled'].includes(goal.value.status)
}
function schedulePoll() {
  if (pollTimer) clearTimeout(pollTimer)
  const delay = passiveWaiting.value ? 10000 : 3000
  pollTimer = setTimeout(async () => {
    // 守护/外部驱动等待态仍需轻量轮询，以捕获 webhook 触发后的重新激活。
    if (shouldPollGoal()) await fetchData()
    if (shouldPollGoal()) schedulePoll()
  }, delay)
}

onMounted(() => {
  fetchData()
  fetchChatHistory()
  fetchLlmInfo()
  schedulePoll()
  tickTimer = setInterval(() => { nowTs.value = Math.floor(Date.now() / 1000) }, 1000)
})
onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
  if (tickTimer) clearInterval(tickTimer)
})
</script>

<style scoped>
/* 智能体完成时的勾选弹出动画 */
.agent-done { display: inline-block; animation: pop 0.5s ease; }
@keyframes pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.4); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
/* replan 横幅淡入淡出 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
/* 智能体工作中呼吸光效 */
.working-glow { animation: glow 1.5s ease-in-out infinite; }
@keyframes glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  50% { box-shadow: 0 0 7px 1px rgba(59,130,246,0.45); }
}
</style>
