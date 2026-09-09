import JSZip from 'jszip'
import type { ExportFile, MarketplaceItemType } from '$lib/api/types'

// US-037: client-side zip packaging (Architecture Decision 4) or R2 fallback for large exports
export async function downloadExport(
	itemType: MarketplaceItemType,
	id: string,
	filenamePrefix: string
): Promise<void> {
	const res = await fetch(`/export/${itemType}/${id}`)
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { message?: string }
		throw new Error(body.message ?? 'Export failed')
	}

	const responseData = (await res.json()) as { files?: ExportFile[]; download_url?: string }

	// R2 fallback: if download_url is present, stream directly from R2 (Phase 5)
	if (responseData.download_url) {
		const a = document.createElement('a')
		a.href = responseData.download_url
		a.download = `${filenamePrefix}.zip`
		a.click()
		return
	}

	// Client-side zipping (common path)
	const { files } = responseData as { files: ExportFile[] }

	const zip = new JSZip()
	for (const file of files) {
		zip.file(file.path, file.content)
	}
	const blob = await zip.generateAsync({ type: 'blob' })

	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = `${filenamePrefix}.zip`
	a.click()
	URL.revokeObjectURL(url)
}
