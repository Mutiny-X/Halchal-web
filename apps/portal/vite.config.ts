import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Browser security headers, sent with every page of the built site (the
 * site is served by `vite preview` on Railway).
 *
 * Enforced: the portal can't be shown inside another site's frame
 * (clickjacking), browsers won't guess file types, HTTPS is remembered, and
 * the page can't use the camera, microphone or location.
 *
 * The full content policy is sent as Report-Only for now: the browser
 * reports what it would block (in the console) without blocking, so the
 * Instagram / X / YouTube / Drive previews can be checked against it before
 * it is switched to enforcing.
 */
const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  "Content-Security-Policy-Report-Only": [
    "default-src 'self'",
    "script-src 'self' https://www.instagram.com https://platform.twitter.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src https://www.youtube.com https://drive.google.com https://www.instagram.com https://platform.twitter.com https://syndication.twitter.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; "),
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/uploads": {
        target: process.env.VITE_API_URL ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  preview: {
    host: true,
    strictPort: true,
    headers: securityHeaders,
    // Railway (and custom domains) proxy with their own Host header
    allowedHosts: true,
  },
});
