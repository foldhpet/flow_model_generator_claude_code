import { describe, expect, it, beforeEach } from 'vitest'
import { encryptToken, decryptToken, signState, verifyState } from '../../src/crypto'

// 32-byte base64-encoded keys (AES-256 and HMAC-SHA256)
const TEST_KEY = 'kbVFaZeZPaWMePPbUsmMW27D24FcHLHZzdyWfDKVJlk='
const TEST_SIGNING_KEY = 'RBtXvS4qL2JnP8K1Y9mZ3eW6fD7oA0xC5bU2vJ4wT3s='

describe('encryptToken / decryptToken', () => {
	it('round-trip: encrypt and decrypt token', async () => {
		const token = 'ghu_abcdef1234567890'
		const { ciphertext, iv } = await encryptToken(token, TEST_KEY)

		expect(ciphertext).toBeTruthy()
		expect(iv).toBeTruthy()
		expect(ciphertext).not.toContain(token) // Should not contain plaintext

		const decrypted = await decryptToken(ciphertext, iv, TEST_KEY)
		expect(decrypted).toBe(token)
	})

	it('different keys fail to decrypt', async () => {
		const token = 'ghu_test'
		const { ciphertext, iv } = await encryptToken(token, TEST_KEY)

		const wrongKey = 'NJ9kL2mO5pR8sT1vW4xY7zA0bC3dE6fG9hI2jK5qL8M='
		await expect(decryptToken(ciphertext, iv, wrongKey)).rejects.toThrow()
	})

	it('tampered ciphertext fails to decrypt', async () => {
		const token = 'ghu_test'
		const { ciphertext, iv } = await encryptToken(token, TEST_KEY)

		const tampered = ciphertext.slice(0, -2) + 'XX'
		await expect(decryptToken(tampered, iv, TEST_KEY)).rejects.toThrow()
	})

	it('generates a different IV each time', async () => {
		const token = 'ghu_test'
		const { iv: iv1 } = await encryptToken(token, TEST_KEY)
		const { iv: iv2 } = await encryptToken(token, TEST_KEY)

		expect(iv1).not.toBe(iv2)
	})
})

describe('signState / verifyState', () => {
	it('round-trip: sign and verify state', async () => {
		const data = { userId: '123e4567-e89b-12d3-a456-426614174000' }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		expect(signed).toContain('.')
		const parts = signed.split('.')
		expect(parts.length).toBe(2)

		const verified = await verifyState(signed, TEST_SIGNING_KEY)
		expect(verified).toEqual(data)
	})

	it('rejects expired state', async () => {
		const data = { userId: 'user-123' }
		const signed = await signState(data, TEST_SIGNING_KEY, -1) // Already expired

		await expect(verifyState(signed, TEST_SIGNING_KEY)).rejects.toThrow('state_expired')
	})

	it('rejects tampered signature', async () => {
		const data = { userId: 'user-123' }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		const [payload, sig] = signed.split('.')
		const tampered = `${payload}.${sig.slice(0, -2)}XX`

		await expect(verifyState(tampered, TEST_SIGNING_KEY)).rejects.toThrow('invalid_state_signature')
	})

	it('rejects tampered payload', async () => {
		const data = { userId: 'user-123' }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		const [payload, sig] = signed.split('.')
		const tampered = `${payload.slice(0, -2)}XX.${sig}`

		await expect(verifyState(tampered, TEST_SIGNING_KEY)).rejects.toThrow()
	})

	it('rejects wrong key', async () => {
		const data = { userId: 'user-123' }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		const wrongKey = 'NJ9kL2mO5pR8sT1vW4xY7zA0bC3dE6fG9hI2jK5qL8M='
		await expect(verifyState(signed, wrongKey)).rejects.toThrow('invalid_state_signature')
	})

	it('rejects malformed state (no dot separator)', async () => {
		await expect(verifyState('nodothere', TEST_SIGNING_KEY)).rejects.toThrow('invalid_state_format')
	})

	it('includes nested data in the payload', async () => {
		const data = { userId: 'user-123', scope: 'repo', iat: 1234567890 }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		const verified = await verifyState(signed, TEST_SIGNING_KEY)
		expect(verified).toEqual(data)
	})

	it('does not include exp in the returned data', async () => {
		const data = { userId: 'user-123' }
		const signed = await signState(data, TEST_SIGNING_KEY, 600)

		const verified = await verifyState(signed, TEST_SIGNING_KEY)
		expect(verified).not.toHaveProperty('exp')
	})
})
