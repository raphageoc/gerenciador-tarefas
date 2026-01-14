import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base "/gerenciador-tarefas/", // <--- ADICIONE ESTA LINHA (Troque pelo nome exato do repo)
})
