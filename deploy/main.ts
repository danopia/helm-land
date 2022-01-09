#!/usr/bin/env -S deno run --allow-env --allow-net=0.0.0.0:8000,dynamodb.eu-central-1.amazonaws.com
import { serve } from "./deps.ts";

import { renderIndexYaml } from "./routes/index-yaml.ts";
import { renderChartDownload } from "./routes/chart-download.ts";

async function handler(req: Request) {
  const url = new URL(req.url);
  const baseUrl = new URL('.', url).toString();
  const userAgent = req.headers.get('user-agent');
  console.log(req.method, url.pathname);

  try {

    {
      const match = new URLPattern({ pathname: '/:owner/index.yaml' }).exec(url);
      if (match) {
        const resp = await renderIndexYaml(baseUrl, match.pathname.groups['owner']);
        if (resp) return resp;
      }
    }

    {
      const match = new URLPattern({ pathname: '/:owner/:name/:filename.tgz' }).exec(url);
      if (match) {
        const {owner, name, filename} = match.pathname.groups;
        if (filename.startsWith(`${name}-`)) {
          const resp = await renderChartDownload(owner, name, filename.slice(name.length + 1));
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
