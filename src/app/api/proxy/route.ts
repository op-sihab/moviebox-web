import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const range = request.headers.get("range");
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    Referer: "https://moviebox.ph/",
    Accept: "*/*",
  };
  if (range) {
    headers["Range"] = range;
  }

  try {
    const upstreamRes = await fetch(url, {
      headers,
    });

    const responseHeaders = new Headers();
    const headersToForward = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "etag",
      "last-modified",
    ];

    headersToForward.forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) {
        responseHeaders.set(h, val);
      }
    });

    // Ensure standard video streaming headers are always present
    if (!responseHeaders.has("accept-ranges")) {
      responseHeaders.set("accept-ranges", "bytes");
    }
    if (!responseHeaders.has("content-type")) {
      responseHeaders.set("content-type", "video/mp4");
    }

    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Proxy error", { status: 502 });
  }
}
