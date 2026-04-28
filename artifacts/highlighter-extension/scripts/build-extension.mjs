import { build } from "esbuild";
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distDir = resolve(root, "dist");
const extensionSrc = resolve(root, "extension");

const ensureDir = (path) => {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
};

const bundle = async (entry, outFile) => {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    target: ["chrome114"],
    platform: "browser",
    minify: true,
    sourcemap: false,
    outfile: outFile,
    logLevel: "info",
  });
};

const buildIcons = async () => {
  const iconsOut = resolve(distDir, "icons");
  ensureDir(iconsOut);
  const source = resolve(extensionSrc, "icon-source.svg");
  if (!existsSync(source)) {
    throw new Error(`Missing icon source at ${source}`);
  }
  const sizes = [16, 32, 48, 128];
  const svg = readFileSync(source);
  for (const size of sizes) {
    await sharp(svg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(resolve(iconsOut, `icon-${size}.png`));
  }
};

const main = async () => {
  // Vite has already populated dist/ with the popup React app via the npm script.
  // We layer the extension scripts and assets on top of that output.
  ensureDir(distDir);

  await bundle(resolve(extensionSrc, "content.ts"), resolve(distDir, "content.js"));
  await bundle(resolve(extensionSrc, "background.ts"), resolve(distDir, "background.js"));

  copyFileSync(resolve(extensionSrc, "manifest.json"), resolve(distDir, "manifest.json"));
  copyFileSync(resolve(extensionSrc, "content.css"), resolve(distDir, "content.css"));
  copyFileSync(resolve(extensionSrc, "popup.html"), resolve(distDir, "popup.html"));
  copyFileSync(resolve(extensionSrc, "popup.js"), resolve(distDir, "popup.js"));

  await buildIcons();

  // Patch the popup html to load assets from the extension root (Vite adds an absolute base).
  const indexPath = resolve(distDir, "index.html");
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf8");
    const patched = html.replace(/(src|href)="\/(?!\/)/g, '$1="');
    writeFileSync(indexPath, patched, "utf8");
  }

  console.log("\nExtension build complete.");
  console.log(`  Output: ${distDir}`);
  console.log("  Load this folder as an unpacked extension in chrome://extensions.\n");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
