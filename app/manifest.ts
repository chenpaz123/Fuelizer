import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fuelizer",
    short_name: "Fuelizer",
    description: "מעקב תדלוקים, טלמטריה וחיוב עבור הרכב שלכם",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    // Match app/globals.css's --background / --primary tokens exactly
    // (converted from HSL) rather than eyeballing a hex value.
    background_color: "#f4f7fa",
    theme_color: "#3c83f6",
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
