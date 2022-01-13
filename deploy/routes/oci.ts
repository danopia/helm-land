import { OciStore, RequestContext } from "../lib/oci-store.ts";

export async function routeOciRequest(store: OciStore, request: Request, url: URL) {
  const pathParts = url.pathname.split('/').slice(2);
  console.log('oci api:', pathParts);
  if (pathParts.length < 3) return null;

  const parameter = pathParts.pop();
  const route = pathParts.pop();
  if (!parameter || !route) return null;

  const context: RequestContext = {
    isHeadersOnly: request.method == 'HEAD',
    repoName: pathParts.join('/'),
    repoNames: pathParts.map(x => decodeURIComponent(x)),
    httpHost: url.hostname,
    userAgent: request.headers.get('user-agent'),
  };

  switch (true) {

    case route == 'tags' && parameter == 'list': {
      const numberRaw = url.searchParams.get('n');
      const number = typeof numberRaw == 'string' ? parseInt(numberRaw, 10) : undefined;
      const last = url.searchParams.get('last') ?? undefined;

      return new Response(JSON.stringify({
        name: pathParts.slice(-1)[0],
        tags: await store.listTags(context, number, last),
      }), {
        headers: {
          'content-type': 'application/json',
        }});
    }

    case route == 'blobs': {
      if (!parameter.startsWith('sha256:')) return null;
      return await store.getBlob(context, parameter);
    }
    case route == 'manifests': {
      if (!parameter.startsWith('sha256:')) {
        const digest = await store.resolveTag(context, parameter);
        if (!digest) return null;
        return await store.getManifest(context, digest);
      } else {
        return await store.getManifest(context, parameter);
      }
    }

  }

  return null;
}
