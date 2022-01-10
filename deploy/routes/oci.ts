export async function renderOciManifest(requestUrl: URL, ownerId: string, chartId: string, version: string, authorization: string | null) {
  if (!authorization) {
    return new Response(`{"errors":[{"code":"UNAUTHORIZED","message":"authentication required"}]}`, {
      status: 401,
      headers: {
        'content-type': 'application/json',
        'www-authenticate': `Bearer realm="${requestUrl.origin}/v2/token",service="${requestUrl.hostname}",scope="repository:${ownerId}/${chartId}:pull"`,
      }});
  }

  throw new Error(`TODO`);
}
