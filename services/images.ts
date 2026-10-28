/**
 * Helpers to request reasonably sized Wikimedia images.
 *
 * Wikipedia/Wikidata hand back original uploads (often 3–10 MB) and the app
 * renders them in cards of a few hundred pixels. Requesting the thumbnail
 * variant at the right width cuts the transferred bytes by ~10–50x.
 */

const WIKI_HOST = /(^|\.)(wikimedia\.org|wikipedia\.org)$/i;

function toHttps(url: string): string {
  return url.startsWith('http://') ? 'https://' + url.slice(7) : url;
}

export function toWikiThumb(
  url: string | null | undefined,
  width = 1280
): string | null {
  if (!url) return null;

  const httpsUrl = toHttps(url);

  try {
    const parsed = new URL(httpsUrl);
    if (!WIKI_HOST.test(parsed.hostname)) return httpsUrl;

    // Commons FilePath links (used by Wikidata P18): ?width= is supported.
    if (parsed.pathname.startsWith('/wiki/Special:FilePath/')) {
      parsed.searchParams.set('width', String(width));
      return parsed.toString();
    }

    // Already a thumbnail: /thumb/a/ab/File.jpg/320px-File.jpg
    if (parsed.pathname.includes('/thumb/')) {
      return httpsUrl.replace(/\/(\d+)px-/, `/${width}px-`);
    }

    // Original upload: /wikipedia/commons/a/ab/File.jpg
    const match = parsed.pathname.match(
      /^\/wikipedia\/([^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/i
    );
    if (match) {
      const [, project, first, second, file] = match;
      return `${parsed.origin}/wikipedia/${project}/thumb/${first}/${second}/${file}/${width}px-${file}`;
    }

    return httpsUrl;
  } catch {
    return httpsUrl;
  }
}

/**
 * Resolves the best available image from a Wikipedia REST summary payload,
 * preferring the thumbnail (resized) over the original upload.
 */
export function pickWikiImage(
  data: { thumbnail?: { source?: string } | null; originalimage?: { source?: string } | null } | null | undefined,
  width = 1280
): string | null {
  return (
    toWikiThumb(data?.thumbnail?.source, width) ||
    toWikiThumb(data?.originalimage?.source, width) ||
    null
  );
}
