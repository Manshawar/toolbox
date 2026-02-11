/**
 * pwa
 * https://vite-plugin-pwa.netlify.app
 */
import { VitePWA } from 'vite-plugin-pwa';

export function configPwaPlugin() {
  const options = {
    includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
    logLevel: 'silent',
    workbox: {
      maximumFileSizeToCacheInBytes: 3000000,
    },
    manifest: {
      name: 'langchainApp',
      short_name: 'langchainApp',
      description: 'langchainApp',
      theme_color: '#ffffff',
      icons: [
        {
          src: '/pwa/android-chrome-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/pwa/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/pwa/android-chrome-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
  };

  return VitePWA(options);
}
