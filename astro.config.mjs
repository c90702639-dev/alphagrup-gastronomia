// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://gastronomia.grupoalpha.com',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react(), sitemap()],
  adapter: netlify()
});
