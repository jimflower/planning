export const siteConfig = {
  name: import.meta.env.VITE_APP_NAME ?? 'Daily Planning Hub',
  url: 'https://planning.roseconnections.com.au',
  version: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
  autoSaveIntervalMs: 30_000, // 30 seconds
  maxCrewRows: 50,
  defaultStartTime: '06:30',
};
