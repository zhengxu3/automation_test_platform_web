<template>
  <div class="h-screen flex items-center justify-center bg-dark-900">
    <div class="w-80 p-6 rounded-xl border border-dark-border bg-dark-800 shadow-lg shadow-black/20">
      <h2 class="text-lg font-medium mb-6 text-center bg-gradient-to-r from-accent to-accent-cyan bg-clip-text text-transparent">AI Platform</h2>
      <form @submit.prevent="handleLogin" class="space-y-4">
        <input v-model="form.username" placeholder="用户名" class="w-full px-4 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors" />
        <input v-model="form.password" type="password" placeholder="密码" class="w-full px-4 py-2.5 rounded-lg bg-dark-900 border border-dark-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors" />
        <button type="submit" :disabled="loading" class="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent to-accent-blue text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <p v-if="error" class="text-xs text-red-400 text-center">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '@/api'

const router = useRouter()
const form = ref({ username: '', password: '' })
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true; error.value = ''
  try {
    const res: any = await http.post('/auth/login', form.value)
    localStorage.setItem('ai_token', res.data.token)
    router.push('/')
  } catch (e: any) {
    error.value = e?.message || '登录失败'
  } finally { loading.value = false }
}
</script>
