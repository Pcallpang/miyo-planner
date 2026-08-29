import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // strictPort: 5174가 이미 쓰이면 조용히 다른 포트로 옮겨가지 말고 실패하게 한다
  // (electron이 기다리는 주소가 http://localhost:5174로 고정돼 있기 때문).
  server: { port: 5174, strictPort: true },
});
