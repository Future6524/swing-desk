import { getImage } from "@/lib/setups";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  const img = Number.isInteger(id) ? await getImage(id) : null;
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(img.data, {
    headers: {
      "Content-Type": img.mime,
      // Images are immutable rows, so they can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
