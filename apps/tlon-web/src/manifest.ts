import { ManifestOptions } from 'vite-plugin-pwa';

const manifest: Partial<ManifestOptions> = {
  name: 'Sato',
  description:
    'Start, host, and cultivate communities. Own your communications, organize your resources, and share documents. Sato is a peer-to-peer collaboration tool built on Urbit that provides a few simple basics that communities can shape into something unique to their needs.',
  short_name: 'Sato',
  start_url: '/apps/groups',
  scope: '/apps/groups',
  id: '/apps/groups/',
  icons: [
    {
      src: './icon-512.png?v=sato-1',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: './icon-192.png?v=sato-1',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: './icon-512-maskable.png?v=sato-1',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
    {
      src: './icon-192-maskable.png?v=sato-1',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
  theme_color: '#ffffff',
  background_color: '#ffffff',
  display: 'standalone',
};

export default manifest;
