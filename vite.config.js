import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROUTES = [
  {
    path: '/privacy-policy',
    canonical: 'https://www.gesturestudio.in/privacy-policy',
    title: 'Privacy Policy | Gesture Studio',
    description: 'Privacy Policy for Gesture Studio. Learn how your account data, local camera tracking, and game scores are protected.',
  },
  {
    path: '/terms',
    canonical: 'https://www.gesturestudio.in/terms',
    title: 'Terms of Use | Gesture Studio',
    description: 'Terms of Use for Gesture Studio. Read our rules of play, account guidelines, acceptable use policies, and legal terms.',
  },
  {
    path: '/gesture-academy',
    canonical: 'https://www.gesturestudio.in/gesture-academy',
    title: 'Gesture Academy - Learn Hand Gestures | Gesture Studio',
    description: 'Master hand gesture controls with interactive webcam tutorials at Gesture Academy.',
  },
  {
    path: '/fruit-ninja',
    canonical: 'https://www.gesturestudio.in/fruit-ninja',
    title: 'Fruit Ninja - Free Webcam Hand Gesture Game | Gesture Studio',
    description: 'Slice juicy airborne fruits in real-time with finger swipes in your browser with zero downloads!',
  },
  {
    path: '/hill-climb',
    canonical: 'https://www.gesturestudio.in/hill-climb',
    title: 'Crazy Road - Webcam Motion Driving Game | Gesture Studio',
    description: 'Navigate lanes and dodge highway traffic using hand gestures at Gesture Studio.',
  },
  {
    path: '/flappy-bird',
    canonical: 'https://www.gesturestudio.in/flappy-bird',
    title: 'Flappy Bird - Hand Gesture Arcade Game | Gesture Studio',
    description: 'Flap through pipes with pinch gestures or air taps in your browser at Gesture Studio.',
  },
  {
    path: '/archery',
    canonical: 'https://www.gesturestudio.in/archery',
    title: 'Archery Challenge - Gesture Bow & Arrow Game | Gesture Studio',
    description: 'Draw back your bowstring with pinch gestures, aim, and strike moving targets at Gesture Studio.',
  },
  {
    path: '/bird-hunter',
    canonical: 'https://www.gesturestudio.in/bird-hunter',
    title: 'Bird Hunter - Hand Gesture Slingshot Game | Gesture Studio',
    description: 'Pull back slingshot with pinch gestures, aim at unpredictable birds, and unleash combo trick shots!',
  },
  {
    path: '/space-shooter',
    canonical: 'https://www.gesturestudio.in/space-shooter',
    title: 'Space Shooter - Motion Controlled Galaxy Game | Gesture Studio',
    description: 'Survive endless waves of galactic invaders with your index finger and pinch EMP blasts.',
  },
  {
    path: '/leaderboard',
    canonical: 'https://www.gesturestudio.in/leaderboard',
    title: 'Leaderboard - Global Player Rankings | Gesture Studio',
    description: 'View global player rankings, high scores, and competitive leaderboards across all gesture games.',
  },
  {
    path: '/achievements',
    canonical: 'https://www.gesturestudio.in/achievements',
    title: 'Achievements - Unlock Medals & Trophies | Gesture Studio',
    description: 'Track your gaming achievements, badges, and milestones on Gesture Studio.',
  },
  {
    path: '/profile',
    canonical: 'https://www.gesturestudio.in/profile',
    title: 'Player Profile | Gesture Studio',
    description: 'Manage your Gesture Studio player profile, custom avatars, level progression, and stats.',
  },
];

function generateRoutePagesPlugin() {
  return {
    name: 'generate-route-pages',
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist');
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) return;

      const template = fs.readFileSync(indexPath, 'utf-8');

      for (const route of ROUTES) {
        let routeHtml = template;

        // Replace canonical URL
        routeHtml = routeHtml.replace(
          /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${route.canonical}" />`
        );

        // Replace Open Graph URL
        routeHtml = routeHtml.replace(
          /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
          `<meta property="og:url" content="${route.canonical}" />`
        );

        // Replace Twitter URL
        routeHtml = routeHtml.replace(
          /<meta\s+name="twitter:url"\s+content="[^"]*"\s*\/?>/i,
          `<meta name="twitter:url" content="${route.canonical}" />`
        );

        // Replace Title if provided
        if (route.title) {
          routeHtml = routeHtml.replace(
            /<title>.*?<\/title>/i,
            `<title>${route.title}</title>`
          );
          routeHtml = routeHtml.replace(
            /<meta\s+name="title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="title" content="${route.title}" />`
          );
          routeHtml = routeHtml.replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${route.title}" />`
          );
          routeHtml = routeHtml.replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${route.title}" />`
          );
        }

        // Replace Description if provided
        if (route.description) {
          routeHtml = routeHtml.replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${route.description}" />`
          );
          routeHtml = routeHtml.replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${route.description}" />`
          );
          routeHtml = routeHtml.replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:description" content="${route.description}" />`
          );
        }

        const cleanSlug = route.path.replace(/^\/+/, '');
        const targetDir = path.join(distDir, cleanSlug);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'index.html'), routeHtml, 'utf-8');
        fs.writeFileSync(path.join(distDir, `${cleanSlug}.html`), routeHtml, 'utf-8');
      }
      console.log(`[generateRoutePagesPlugin] Generated static SEO pages for ${ROUTES.length} routes.`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), generateRoutePagesPlugin()],
});
