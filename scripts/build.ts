import path from "node:path";

const rootDir = path.resolve(__dirname, "..");

const result = await Bun.build({
	entrypoints: [path.join(rootDir, "src/index.ts")],
	target: "node",
	outdir: path.join(rootDir, "dist"),
	// format: "cjs",
	minify: false,
	sourcemap: "none",
	packages: "external"
})

if (!result.success) {
  console.error('Build failed:', result.logs);
  process.exit(1);
}