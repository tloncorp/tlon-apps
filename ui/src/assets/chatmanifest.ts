export default {
  name: 'Talk',
  short_name: 'Talk',
  description:
    'Send encrypted direct messages to one or many friends. Talk is a simple chat tool for catching up, getting work done, and everything in between.',
  start_url: '/apps/talk/',
  scope: '/apps/talk/',
  id: '/apps/talk/',
  icons: [
    {
      src: './talk-icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: './talk-icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
  ],
  theme_color: '#ffffff',
  background_color: '#ffffff',
  display: 'standalone',
};
