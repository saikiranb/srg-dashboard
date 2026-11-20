import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sri Ram Garden – Society App",
    short_name: "SRG Society",
    description: "Pending works and live electrician/plumber service queue for Sri Ram Garden residents and staff.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#c8202f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      { name: "Service Requests", short_name: "Requests", url: "/service", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Staff Login", short_name: "Staff", url: "/staff", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
