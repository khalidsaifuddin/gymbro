import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',testMatch:'*.spec.ts',timeout:60000,workers:1,expect:{timeout:5000},
  use:{browserName:'chromium',headless:true,
    launchOptions:{args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']}},
  webServer:[
    {command:'node scripts/serve-vision-smoke.mjs',url:'http://127.0.0.1:8091',reuseExistingServer:false},
    {command:'python -m http.server 8081 --bind 127.0.0.1 --directory dist',url:'http://127.0.0.1:8081',reuseExistingServer:false},
  ],
});
