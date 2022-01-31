#!/usr/bin/env -S deno run --allow-env --allow-net
import { serve } from "./deps.ts";

import { renderIndexYaml } from "./routes/index-yaml.ts";
import { renderChartDownload } from "./routes/chart-download.ts";
import { routeOciRequest } from "./routes/oci.ts";

import { OciStoreHelm } from "./lib/oci-store-helm.ts";
const ociStore = new OciStoreHelm();

async function handler(req: Request) {
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent');
  console.log(req.method, url.pathname, url.search);

  try {

    if (url.pathname == '/') {
      return Response.redirect('https://github.com/danopia/helm-land');
    }

    if (url.pathname == '/cloudydeno/artifacthub-repo.yml') {
      return new Response('repositoryID: 17dca74f-e060-41a0-908c-434d03631c8d');
    }

    if (url.pathname.startsWith('/v2/')) {
      const resp = await routeOciRequest(ociStore, req, url);
      if (resp) return resp;
    }

    {
      const match = new URLPattern({ pathname: '/:owner/{index.yaml}?' }).exec(url);
      if (match) {
        const baseUrl = new URL('.', url).toString();
        const resp = await renderIndexYaml(baseUrl, match.pathname.groups['owner']);
        if (resp) return resp;
      }
    }

    {
      const match = new URLPattern({ pathname: '/:owner/:chart/:filename.tgz' }).exec(url);
      if (match) {
        const {owner, chart, filename} = match.pathname.groups;
        if (filename.startsWith(`${chart}-`)) {
          const method = req.method == 'HEAD' ? 'HEAD' : 'GET';
          const resp = await renderChartDownload(method, owner, chart, filename.slice(chart.length + 1), url.hostname, userAgent);
          if (resp) return resp;
        }
      }
    }

  } catch (err) {
    console.error(err.stack);
    return new Response('Internal Server Error\n\n' + err.message, { status: 500 });
  }

  return new Response("Not found", { status: 404 });
}

console.log("Listening on http://localhost:8000");
await serve(async req => {
  const resp = await handler(req);
  console.log(resp.status, req.url);
  return resp;
});
