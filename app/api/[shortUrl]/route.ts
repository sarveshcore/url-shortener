import { lookupUrl } from "@/app/actions"

export async function GET(request: Request, context: { params: Promise<{ shortUrl: string }> }) {
  try {
    // Await params to resolve the dynamic route parameters
    const { shortUrl } = await context.params
    const { longUrl } = await lookupUrl(shortUrl)

    // Use Response.redirect for reliable redirection
    return Response.redirect(longUrl, 302)
  } catch (error) {
    return new Response("URL not found or expired", { status: 404 })
  }
}