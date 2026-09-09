// US-037 AC3: R2 fallback for exports that exceed the client-side zipping threshold
// Threshold chosen based on JSZip performance: 500 KB is conservative but safe for browser environments

export const EXPORT_R2_THRESHOLD_BYTES = 500 * 1024 // 500 KB

export interface ExportFile {
  path: string
  content: string
}

export function shouldUseR2(files: ExportFile[]): boolean {
  let totalBytes = 0
  for (const file of files) {
    totalBytes += new TextEncoder().encode(file.content).length
  }
  return totalBytes > EXPORT_R2_THRESHOLD_BYTES
}

export function estimateSize(files: ExportFile[]): number {
  let totalBytes = 0
  for (const file of files) {
    totalBytes += new TextEncoder().encode(file.content).length
  }
  return totalBytes
}
