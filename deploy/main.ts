#!/usr/bin/env -S deno run --allow-env --allow-net=0.0.0.0:8000,dynamodb.eu-central-1.amazonaws.com
import { ApiFactory } from "https://deno.land/x/aws_api@v0.5.0/client/mod.ts";
import { DynamoDB } from "https://aws-api.deno.dev/v0.2/services/dynamodb.ts?actions=ExecuteStatement";
const dynamodb = new ApiFactory().makeNew(DynamoDB);

const chartBucket = Deno.env.get('CHART_BUCKET')!;
const objectUrlPrefix = `s3://${chartBucket}/`;

async function renderIndexYaml(baseUrl: string, ownerId: string) {
  const charts = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmCharts.ByOwner WHERE ChartOwner=? ORDER BY ChartKey ASC`,
    Parameters: [
      { S: ownerId },
    ],
  }).then(x => x.Items ?? []);

  const chunks = [
    `apiVersion: v1`,
    `generated: ${new Date().toISOString()}`,
    `entries:`,
  ];

  for (const chartRecord of charts) {
    chunks.push(`  ${chartRecord.ChartName?.S}:`);

    const versions = await dynamodb.executeStatement({
      Statement: `SELECT * FROM HelmReleases.ByReleasedAt WHERE ChartKey=? ORDER BY ReleasedAt DESC`,
      Parameters: [
        chartRecord.ChartKey!,
      ],
    }).then(x => x.Items);

    for (const versionRecord of versions ?? []) {
      // {"Download":{"SS":["s3://deno-helm-land/cloudydeno/dns-sync/dns-sync-0.1.0.tgz"]},"CreationDate":{"S":"2021-12-04T16:14:33.000Z"},"Digest":{"M":{"sha256":{"S":"d27724c8c53d48caeb835ef3a957a59e9c9cbaa516e8645469654c06a0265195"}}},"ChartVersion":{"S":"0.1.0"},"ChartMeta":{"M":{"name":{"S":"dns-sync"},"description":{"S":"Manage hosted DNS providers using a Kubernetes control plane"},"appVersion":{"S":"latest"},"apiVersion":{"S":"v2"},"type":{"S":"application"},"version":{"S":"0.1.0"}}},"ChartKey":{"S":"cloudydeno/dns-sync"}}
      const {
        apiVersion, name, description, version, appVersion,
      } = versionRecord.ChartMeta?.M ?? {};
      // chunks.push(`  - ${JSON.stringify(versionRecord)}`);
      chunks.push(`  - name: ${JSON.stringify(name?.S)}`);
      chunks.push(`    created: ${JSON.stringify(versionRecord.ReleasedAt?.S)}`);
      chunks.push(`    description: ${JSON.stringify(description?.S)}`);
      chunks.push(`    version: ${JSON.stringify(version?.S)}`);
      chunks.push(`    apiVersion: ${JSON.stringify(apiVersion?.S)}`);
      chunks.push(`    appVersion: ${JSON.stringify(appVersion?.S)}`);
      chunks.push(`    digest: ${JSON.stringify(versionRecord.Digest?.M?.sha256?.S)}`);
      chunks.push(`    urls:`);
      for (const download of versionRecord.Download?.SS ?? []) {
        if (download.startsWith(objectUrlPrefix)) {
          chunks.push(`    - ${JSON.stringify(`${baseUrl}${name?.S}-${version?.S}.tgz`)}`);
        } else if (download.startsWith('https://')) {
          chunks.push(`    - ${JSON.stringify(download)}`);
        }
      }
    }
  }

  chunks.push('');
  return new Response(chunks.join('\n'));
}

async function handler(req: Request) {
  const url = new URL(req.url);

  try {

    if (url.pathname == '/cloudydeno/index.yaml') {
      const baseUrl = new URL('.', url).toString();
      return await renderIndexYaml(baseUrl, 'cloudydeno');
    }

  } catch (err) {
    return new Response('Internal Server Error\n\n' + err.stack, { status: 500 });
  }

  return new Response("Not found", { status: 404 });
}

import { serve } from "https://deno.land/std@0.114.0/http/server.ts";
console.log("Listening on http://localhost:8000");
await serve(handler);
