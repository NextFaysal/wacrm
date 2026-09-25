import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'wacrm — WhatsApp CRM',
    short_name: 'wacrm',
    description: 'WhatsApp CRM & Shared Team Inbox',
    start_url: '/inbox',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#7c3aed',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
