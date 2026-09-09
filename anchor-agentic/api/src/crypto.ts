// AES-GCM token encryption and HMAC-SHA256 state signing — used for:
// - Storing GitHub access tokens at rest (encrypted before DB insert)
// - OAuth state CSRF-proofing (signed proof the connect request is legitimate)
// - Signed download URLs for R2 fallback (proves we minted the URL and it hasn't expired)

// Convert base64 string to raw bytes
function base64ToBytes(b64: string): Uint8Array {
	const binaryStr = atob(b64)
	const bytes = new Uint8Array(binaryStr.length)
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i)
	}
	return bytes
}

// Convert raw bytes to base64url (no padding)
function bytesToBase64Url(bytes: Uint8Array): string {
	const binaryStr = String.fromCharCode(...Array.from(bytes))
	return btoa(binaryStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Convert base64url back to raw bytes
function base64UrlToBytes(b64url: string): Uint8Array {
	// Add padding
	const padded = b64url + '==='.slice((b64url.length + 3) % 4)
	const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
	return base64ToBytes(b64)
}

// AES-256-GCM encryption with a random IV, returning {ciphertext, iv} both base64url
export async function encryptToken(
	token: string,
	keyB64: string
): Promise<{ ciphertext: string; iv: string }> {
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(keyB64),
		{ name: 'AES-GCM' },
		false,
		['encrypt']
	)

	const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for GCM
	const plaintext = new TextEncoder().encode(token)

	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)

	return {
		ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
		iv: bytesToBase64Url(iv),
	}
}

// Decrypt using the stored {ciphertext, iv}
export async function decryptToken(
	ciphertext: string,
	iv: string,
	keyB64: string
): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(keyB64),
		{ name: 'AES-GCM' },
		false,
		['decrypt']
	)

	const plaintext = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: base64UrlToBytes(iv) },
		key,
		base64UrlToBytes(ciphertext)
	)

	return new TextDecoder().decode(plaintext)
}

// HMAC-SHA256 signed state: base64url({payload}) || '.' || base64url(signature)
// where payload is base64url-encoded JSON of {data, exp} (exp in seconds since epoch)
export async function signState(
	data: Record<string, unknown>,
	keyB64: string,
	ttlSeconds: number = 600
): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(keyB64),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)

	const exp = Math.floor(Date.now() / 1000) + ttlSeconds
	const payload = { ...data, exp }
	const payloadStr = JSON.stringify(payload)
	const payloadB64 = bytesToBase64Url(new TextEncoder().encode(payloadStr))

	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
	const sigB64 = bytesToBase64Url(new Uint8Array(sig))

	return `${payloadB64}.${sigB64}`
}

// Verify signed state, returning the decoded data (with exp removed) if valid
export async function verifyState(
	signed: string,
	keyB64: string
): Promise<Record<string, unknown>> {
	const key = await crypto.subtle.importKey(
		'raw',
		base64ToBytes(keyB64),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['verify']
	)

	const [payloadB64, sigB64] = signed.split('.')
	if (!payloadB64 || !sigB64) throw new Error('invalid_state_format')

	let payload: Record<string, unknown> & { exp: number }
	try {
		const payloadStr = new TextDecoder().decode(base64UrlToBytes(payloadB64))
		payload = JSON.parse(payloadStr)
	} catch {
		throw new Error('invalid_state_payload')
	}

	// Check expiry
	if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
		throw new Error('state_expired')
	}

	// Verify signature
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		base64UrlToBytes(sigB64),
		new TextEncoder().encode(payloadB64)
	)
	if (!valid) throw new Error('invalid_state_signature')

	// Return data without exp
	const { exp, ...data } = payload
	return data
}
