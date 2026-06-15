export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f1117',   // 主背景（深蓝灰，不纯黑）
          800: '#1a1d2e',   // 卡片背景
          700: '#242838',   // hover 态
          600: '#2e3348',   // 次级面板
          border: '#2e3450', // 边框（可见但不抢眼）
        },
        accent: { DEFAULT: '#8b5cf6', blue: '#60a5fa', cyan: '#22d3ee' },
        text: {
          primary: '#e4e4e7',    // 主文字
          secondary: '#a1a1b5',  // 辅助文字
          muted: '#6b7094',      // 弱化文字
        }
      },
      fontFamily: { mono: ['JetBrains Mono', 'monospace'] }
    }
  }
}
