import type { MetadataRoute } from "next";

// What makes the site installable as an app on a phone or computer: it opens in its own window, with an icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chalkwork",
    short_name: "Chalkwork",
    description: "Write formulas, build boards and share them with a link.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0f0d",
    theme_color: "#0b0f0d",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
