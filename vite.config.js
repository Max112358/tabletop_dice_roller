import { defineConfig } from "vite";

// Change this if your GitHub Pages URL is different.
// For project pages:  https://username.github.io/tabletop_dice_roller/
// Use: base: "/tabletop_dice_roller/"
//
// For a custom domain or user page:  https://example.com/
// Use: base: "/"
export default defineConfig({
  base: "/tabletop_dice_roller/",
  build: {
    outDir: "dist",
  },
});
