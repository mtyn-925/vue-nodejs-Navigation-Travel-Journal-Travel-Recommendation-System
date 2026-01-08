const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 🟡 你的后端服务地址
        changeOrigin: true,
        pathRewrite: { '^/api': '/api' }
      }
    }
  }
})
