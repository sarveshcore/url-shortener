"use server"

import { revalidatePath } from "next/cache"
import Redis from "ioredis"

// Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

interface UrlMapping {
  shortUrl: string
  longUrl: string
  createdAt: string // ISO string
  expiresAt: string // ISO string
  clientId: string // Store client fingerprint
}

// Generate a short code (5 characters)
function generateShortCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  const length = 5

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return result
}

// Create a new shortened URL
export async function shortenUrl(longUrl: string, clientId: string) {
  if (!clientId) {
    throw new Error("Client ID required")
  }
  // Validate URL
  try {
    new URL(longUrl)
  } catch (e) {
    throw new Error("Invalid URL")
  }

  // Generate a unique short code
  let shortCode = generateShortCode()
  while (await redis.exists(`url:${shortCode}`)) {
    shortCode = generateShortCode()
  }

  // Create expiration date (48 hours from now)
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000)

  // Store the mapping in Redis with expiration
  const mapping: UrlMapping = {
    shortUrl: shortCode,
    longUrl,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    clientId,
  }
  await redis.set(`url:${shortCode}`, JSON.stringify(mapping), "EX", Math.ceil((expiresAt.getTime() - Date.now()) / 1000))

  // Store short code in client's URL list
  await redis.sadd(`user:${clientId}:urls`, shortCode)

  revalidatePath("/")
  return { shortUrl: shortCode }
}

// Look up a URL by its short code
export async function lookupUrl(shortCode: string, clientId?: string) {
  const data = await redis.get(`url:${shortCode}`)
  if (!data) {
    throw new Error("URL not found or expired")
  }

  const mapping: UrlMapping = JSON.parse(data)

  // Enforce ownership check only if clientId is provided
  if (clientId && mapping.clientId !== clientId) {
    throw new Error("Unauthorized access to URL")
  }

  const now = new Date()
  if (new Date(mapping.expiresAt) <= now) {
    await redis.del(`url:${shortCode}`)
    if (clientId) {
      await redis.srem(`user:${clientId}:urls`, shortCode)
    }
    throw new Error("URL not found or expired")
  }

  return mapping
}

// Extend the expiration of a URL by 48 hours
export async function extendUrl(shortCode: string, clientId: string) {
  if (!clientId) {
    throw new Error("Client ID required")
  }

  const data = await redis.get(`url:${shortCode}`)
  if (!data) {
    throw new Error("URL not found or expired")
  }

  const mapping: UrlMapping = JSON.parse(data)
  if (mapping.clientId !== clientId) {
    throw new Error("Unauthorized access to URL")
  }

  const now = new Date()
  if (new Date(mapping.expiresAt) <= now) {
    await redis.del(`url:${shortCode}`)
    await redis.srem(`user:${clientId}:urls`, shortCode)
    throw new Error("URL not found or expired")
  }

  // Add 48 hours to the current expiration time
  const newExpiresAt = new Date(new Date(mapping.expiresAt).getTime() + 48 * 60 * 60 * 1000)
  mapping.expiresAt = newExpiresAt.toISOString()

  // Update Redis with new expiration
  await redis.set(`url:${shortCode}`, JSON.stringify(mapping), "EX", Math.ceil((newExpiresAt.getTime() - now.getTime()) / 1000))

  revalidatePath("/")
  return { success: true }
}

// Get paginated list of URLs for the client
export async function getUrls(page = 1, pageSize = 10, clientId: string) {
  if (!clientId) {
    throw new Error("Client ID required")
  }

  const now = new Date()
  const shortCodes = await redis.smembers(`user:${clientId}:urls`)
  const mappings: UrlMapping[] = []

  for (const shortCode of shortCodes) {
    const data = await redis.get(`url:${shortCode}`)
    if (data) {
      const mapping: UrlMapping = JSON.parse(data)
      if (new Date(mapping.expiresAt) > now && mapping.clientId === clientId) {
        mappings.push(mapping)
      } else {
        // Clean up expired or invalid mappings
        await redis.del(`url:${shortCode}`)
        await redis.srem(`user:${clientId}:urls`, shortCode)
      }
    }
  }

  // Sort by creation date (newest first)
  mappings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalPages = Math.ceil(mappings.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const paginatedUrls = mappings.slice(startIndex, startIndex + pageSize)

  return {
    urls: paginatedUrls,
    totalPages: Math.max(1, totalPages),
  }
}