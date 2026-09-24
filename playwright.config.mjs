import { defineConfig } from '@playwright/test';
export default defineConfig({
    testDir: './tests/browser', timeout: 15000, fullyParallel: true,
    forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    projects: [
        { name: 'regression', grepInvert: /@performance/ },
        // Measure after the other browser work finishes, with no competing tests
        // or trace DOM snapshots in the timed rendering loop.
        { name: 'performance', grep: /@performance/, dependencies: ['regression'],
            workers: 1, use: { trace: 'off' } },
    ],
    use: { baseURL: 'http://127.0.0.1:5180', trace: 'retain-on-failure', screenshot: 'only-on-failure',
        channel: process.env.FCM_TEST_CHANNEL || undefined },
    webServer: { command: 'npx vite --config tests/browser/vite.config.mjs --host 127.0.0.1 --port 5180 --strictPort',
        url: 'http://127.0.0.1:5180/tests/browser/fixture.html', reuseExistingServer: !process.env.CI },
});
