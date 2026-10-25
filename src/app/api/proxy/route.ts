import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 4 MB chunks: ensures instant 300ms initial playback and smooth seeking with strict HTTP 206 byte-ranges
const CHUNK_SIZE = 4 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const rawRange = request.headers.get("range");
  let forwardRange = rawRange;

  // Clamp open-ended or oversized ranges so the browser gets fast, seekable 4MB chunks
  if (rawRange && rawRange.startsWith("bytes=")) {
    const parts = rawRange.replace("bytes=", "").split("-");
    const start = parseInt(parts[0], 10) || 0;
    const end = parts[1] ? parseInt(parts[1], 10) : undefined;

    if (end === undefined || isNaN(end) || end - start > CHUNK_SIZE) {
      forwardRange = `bytes=${start}-${start + CHUNK_SIZE - 1}`;
    }
  } else if (!rawRange) {
    forwardRange = `bytes=0-${CHUNK_SIZE - 1}`;
  }

  const baseHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    Referer: "https://moviebox.ph/",
    Origin: "https://moviebox.ph",
    Accept: "*/*",
  };
  if (forwardRange) {
    baseHeaders["Range"] = forwardRange;
  }

  try {
    let upstreamRes = await fetch(url, { headers: baseHeaders });

    // Fallback: If rejected with 426 / 430 / 429, retry with clean curl UA + BD residential spoof IP
    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      const fallbackHeaders: Record<string, string> = {
        "User-Agent": "curl/8.21.0",
        Referer: "https://moviebox.ph/",
        Accept: "*/*",
        "X-Forwarded-For": "103.191.240.1",
        "X-Real-IP": "103.191.240.1",
        "Client-IP": "103.191.240.1",
      };
      if (forwardRange) {
        fallbackHeaders["Range"] = forwardRange;
      }
      const retryRes = await fetch(url, { headers: fallbackHeaders });
      if (retryRes.ok || retryRes.status === 206) {
        upstreamRes = retryRes;
      } else {
        const errText = await upstreamRes.text().catch(() => "");
        const retryErrText = await retryRes.text().catch(() => "");
        return new NextResponse(
          JSON.stringify({
            error: "Upstream error",
            attempt1: { status: upstreamRes.status, body: errText, headers: Object.fromEntries(upstreamRes.headers.entries()) },
            attempt2: { status: retryRes.status, body: retryErrText, headers: Object.fromEntries(retryRes.headers.entries()) }
          }),
          {
            status: upstreamRes.status,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstreamRes.headers.get("content-type") || "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Content-Length", String(buffer.length));

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    responseHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");

    return new NextResponse(buffer, {
      status: upstreamRes.status === 200 && contentRange ? 206 : upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Proxy error", { status: 502 });
  }
}
