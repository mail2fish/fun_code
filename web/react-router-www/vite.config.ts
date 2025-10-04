import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
// @ts-ignore - 插件可能没有类型声明
import viteCompression from "vite-plugin-compression";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    // 生成 .gz 文件（删除原文件，但保留 manifest.json 等必要元数据）
    viteCompression({
      algorithm: "gzip",
      ext: ".gz",
      deleteOriginFile: true,
      // 仅压缩 client 侧的脚本，避免影响 server 构建产物；且不过滤 .json，避免误删 manifest.json
      filter: (file: string) => /\/client\//.test(file) && /\.(?:js|mjs|cjs)(?:\?.*)?$/i.test(file),
      // 设为 0，确保所有符合的脚本都压缩
      threshold: 0,
    }),
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // 为 Monaco Editor 添加静态资源配置
  optimizeDeps: {
    include: ['monaco-editor', '@monaco-editor/react']
  },
  build: {
    // 确保 Monaco Editor 文件被正确复制
    rollupOptions: {
      external: []
    }
  }
});
