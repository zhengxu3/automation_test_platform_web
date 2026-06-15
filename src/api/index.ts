import axios from 'axios'

const isDev = import.meta.env.DEV
const baseURL = '/api'

const http = axios.create({ baseURL, timeout: 30000 })

// 请求拦截：带 token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('ai_token')
  if (token) config.headers['X-AI-Token'] = token
  return config
})

// 响应拦截：处理 401
http.interceptors.response.use(
  res => {
    if (res.data.result_code === 401) {
      localStorage.removeItem('ai_token')
      window.location.href = '/login'
      return Promise.reject(res.data)
    }
    return res.data
  },
  err => Promise.reject(err)
)

export default http
