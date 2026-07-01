// Ambient type for the gpt-tokenizer o200k_base encoding subpath.
// tsc uses classic node resolution (module: commonjs) and does not honor the package's
// "exports" map, so it cannot find the co-located .d.ts under esm/ or cjs/. esbuild
// resolves and bundles the real module at build time; this only supplies the type.
declare module 'gpt-tokenizer/encoding/o200k_base' {
  export function encode(text: string): number[];
}
