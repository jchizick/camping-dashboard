import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Field Protocol',
    short_name: 'Field Protocol',
    description: 'Trip plans, gear, crew, and field information in one workspace.',
    start_url: '/trips',
    scope: '/',
    display: 'standalone',
    background_color: '#071a13',
    theme_color: '#0a241a',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
