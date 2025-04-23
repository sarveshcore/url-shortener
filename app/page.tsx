"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clipboard, ExternalLink, Clock } from "lucide-react"
import { shortenUrl, lookupUrl, extendUrl, getUrls } from "@/app/actions"
import { toast } from "@/hooks/use-toast"
import FingerprintJS from "@fingerprintjs/fingerprintjs"

interface UrlData {
  shortUrl: string
  longUrl: string
  createdAt: string
  expiresAt: string
  clientId: string
}

export default function UrlShortener() {
  const [clientId, setClientId] = useState<string | null>(null)
  const [longUrl, setLongUrl] = useState("")
  const [shortUrlLookup, setShortUrlLookup] = useState("")
  const [urls, setUrls] = useState<UrlData[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  // Generate fingerprint on mount
  useEffect(() => {
    const initializeFingerprint = async () => {
      const fp = await FingerprintJS.load()
      const result = await fp.get()
      setClientId(result.visitorId)
    }
    initializeFingerprint()
  }, [])

  const fetchUrls = async () => {
    if (!clientId) return
    try {
      const response = await getUrls(page, 10, clientId)
      setUrls(response.urls)
      setTotalPages(response.totalPages)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch URLs",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    if (clientId) {
      fetchUrls()
      // Refresh the list every minute to update expiration times
      const interval = setInterval(fetchUrls, 60000)
      return () => clearInterval(interval)
    }
  }, [page, clientId])

  const handleShortenUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!longUrl || !clientId) return

    setIsLoading(true)
    try {
      await shortenUrl(longUrl, clientId)
      setLongUrl("")
      fetchUrls()
      toast({
        title: "URL Shortened",
        description: "Your URL has been shortened successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to shorten URL",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const extractShortCodeFromUrl = (input: string): string => {
    try {
      const url = new URL(input)
      const expectedOrigin = window.location.origin
      if (url.origin !== expectedOrigin) {
        throw new Error(`Invalid host: expected ${expectedOrigin}, got ${url.origin}`)
      }
      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts[0] !== 'api' || pathParts.length !== 2) {
        throw new Error("Invalid URL format: expected /api/<shortCode>")
      }
      return pathParts[1]
    } catch (error) {
      throw new Error("Invalid URL: " + (error as Error).message)
    }
  }

  const handleLookupUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shortUrlLookup || !clientId) return

    setIsLoading(true)
    try {
      let shortCode: string
      if (shortUrlLookup.startsWith('http://') || shortUrlLookup.startsWith('https://')) {
        shortCode = extractShortCodeFromUrl(shortUrlLookup)
      } else {
        shortCode = shortUrlLookup
      }
      const result = await lookupUrl(shortCode, clientId)
      toast({
        title: "Original URL",
        description: result.longUrl,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "URL not found or expired",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleExtendUrl = async (shortUrl: string) => {
    if (!clientId) return
    try {
      await extendUrl(shortUrl, clientId)
      fetchUrls()
      toast({
        title: "Expiration Extended",
        description: "URL expiration extended by 48 hours",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to extend URL expiration",
        variant: "destructive",
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/${text}`)
    toast({
      title: "Copied",
      description: "URL copied to clipboard",
      })
  }

  const openUrl = (shortUrl: string) => {
    window.open(`${window.location.origin}/api/${shortUrl}`, "_blank")
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffMs = expiry.getTime() - now.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffHrs < 0) return "Expired"
    if (diffHrs < 1) return "Less than 1 hour"
    if (diffHrs < 24) return `${diffHrs} hours`
    return `${Math.floor(diffHrs / 24)} days, ${diffHrs % 24} hours`
  }

  const canExtend = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffMs = expiry.getTime() - now.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    return diffHrs > 0 && diffHrs < 24
  }

  if (!clientId) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">URL Shortener</h1>

      <Tabs defaultValue="create" className="max-w-3xl mx-auto mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Shorten URL</TabsTrigger>
          <TabsTrigger value="lookup">Lookup URL</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Shortened URL</CardTitle>
              <CardDescription>Enter a long URL to generate a shortened version</CardDescription>
            </CardHeader>
            <form onSubmit={handleShortenUrl}>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <Input
                    placeholder="https://example.com/very/long/url/that/needs/shortening"
                    value={longUrl}
                    onChange={(e) => setLongUrl(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Shortening..." : "Shorten URL"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="lookup">
          <Card>
            <CardHeader>
              <CardTitle>Lookup Original URL</CardTitle>
              <CardDescription>Enter a shortened URL or code to find the original</CardDescription>
            </CardHeader>
            <form onSubmit={handleLookupUrl}>
              <CardContent>
                <div className="flex flex-col space-y-4">
                  <Input
                    placeholder="Enter short code or full URL (e.g., 'abcde')"
                    value={shortUrlLookup}
                    onChange={(e) => setShortUrlLookup(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Looking up..." : "Lookup URL"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Your URLs</h2>

        {urls.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Short URL</TableHead>
                    <TableHead className="hidden md:table-cell">Original URL</TableHead>
                    <TableHead>Expires In</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urls.map((url) => (
                    <TableRow key={url.shortUrl}>
                      <TableCell className="font-medium">
                        <a
                          href={`${window.location.origin}/api/${url.shortUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {`${window.location.origin}/api/${url.shortUrl}`}
                        </a>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-xs truncate">{url.longUrl}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{getTimeRemaining(url.expiresAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(url.shortUrl)}
                            title="Copy to clipboard"
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => openUrl(url.shortUrl)} title="Open URL">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {canExtend(url.expiresAt) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExtendUrl(url.shortUrl)}
                              title="Extend expiration by 48 hours"
                            >
                              Extend
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center mt-4">
              <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">You haven’t shortened any URLs yet</p>
          </div>
        )}
      </div>
    </div>
  )
}