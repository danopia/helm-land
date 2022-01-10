#!/usr/bin/env -S deno run --allow-env --allow-net=0.0.0.0:8000,dynamodb.eu-central-1.amazonaws.com
import { serve } from "./deps.ts";

import { renderIndexYaml } from "./routes/index-yaml.ts";
import { renderChartDownload } from "./routes/chart-download.ts";
import { renderOciManifest } from "./routes/oci.ts";

async function handler(req: Request) {
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent');
  console.log(req.method, url.pathname);

  try {

    if (url.pathname == '/cloudydeno/artifacthub-repo.yml') {
      return new Response('repositoryID: 17dca74f-e060-41a0-908c-434d03631c8d');
    }

    {
      const match = new URLPattern({ pathname: '/:owner/index.yaml' }).exec(url);
      if (match) {
        const baseUrl = new URL('.', url).toString();
        const resp = await renderIndexYaml(baseUrl, match.pathname.groups['owner']);
        if (resp) return resp;
      }
    }

    {
      const match = new URLPattern({ pathname: '/v2/:owner/:chart/manifests/:version' }).exec(url);
      if (match) {
        const {owner, chart, version} = match.pathname.groups;
        const resp = await renderOciManifest(url, owner, chart, version, req.headers.get('authorization'));
        if (resp) return resp;
      }
    }

    {
      const match = new URLPattern({ pathname: '/:owner/:chart/:filename.tgz' }).exec(url);
      if (match) {
        const {owner, chart, filename} = match.pathname.groups;
        if (filename.startsWith(`${chart}-`)) {
          const resp = await renderChartDownload(owner, chart, filename.slice(chart.length + 1), userAgent);
          if (resp) return resp;
        }
      }
    }

  } catch (err) {
    console.log(err.stack);
    return new Response('Internal Server Error\n\n' + err.message, { status: 500 });
  }

  return new Response("Not found", { status: 404 });
}

console.log("Listening on http://localhost:8000");
await serve(handler);
