import {
  dynamodb,
  objectUrlPrefix,
} from "../deps.ts";

export async function renderIndexYaml(baseUrl: string, ownerId: string) {
  const charts = await dynamodb.executeStatement({
    Statement: `SELECT * FROM HelmCharts WHERE ChartOwner=? ORDER BY ChartName ASC`,
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
    const {
      ChartOwner, ChartName, ChartKey,
      HomeURL, IconURL, ProjectURLs,
      Keywords, Annotations,
      Maintainers,
    } = chartRecord;

    const versions = await dynamodb.executeStatement({
      Statement: `SELECT * FROM HelmReleases.ByReleasedAt WHERE ChartKey=? ORDER BY ReleasedAt DESC`,
      Parameters: [ ChartKey! ],
    }).then(x => x.Items);
    if (!versions?.length) continue;

    chunks.push(`  ${ChartName?.S}:`);
    for (const versionRecord of versions ?? []) {
      const {
        apiVersion, name, description, version, appVersion,
      } = versionRecord.ChartMeta?.M ?? {};
      // chunks.push(`  - ${JSON.stringify(versionRecord)}`);
      chunks.push(`  - name: ${JSON.stringify(name?.S)}`);
      // chart metadata
      if (HomeURL?.S) {
        chunks.push(`    home: ${JSON.stringify(HomeURL.S)}`);
      }
      if (IconURL?.S) {
        chunks.push(`    icon: ${JSON.stringify(IconURL.S)}`);
      }
      if (Keywords?.SS) {
        chunks.push(`    keywords: ${JSON.stringify(Keywords.SS)}`);
      }
      if (ProjectURLs?.SS) {
        chunks.push(`    sources: ${JSON.stringify(ProjectURLs?.SS ?? [])}`);
      }
      if (Annotations?.M) {
        chunks.push(`    annotations:`);
        for (const [key, value] of Object.entries(Annotations.M)) {
          if (!value?.S) continue;
          chunks.push(`      ${JSON.stringify(key)}: ${JSON.stringify(value.S)}`);
        }
      }
      if (Maintainers?.L?.length) {
        chunks.push(`    maintainers:`);
        for (const x of Maintainers?.L ?? []) {
          chunks.push(`    - name: ${JSON.stringify(x.M?.name?.S)}`);
          chunks.push(`      email: ${JSON.stringify(x.M?.email?.S)}`);
        }
      }
      // version metadata
      chunks.push(`    description: ${JSON.stringify(description?.S)}`);
      chunks.push(`    version: ${JSON.stringify(version?.S)}`);
      chunks.push(`    apiVersion: ${JSON.stringify(apiVersion?.S)}`);
      chunks.push(`    appVersion: ${JSON.stringify(appVersion?.S)}`);
      // version bookkeeping
      chunks.push(`    created: ${JSON.stringify(versionRecord.ReleasedAt?.S)}`);
      chunks.push(`    digest: ${JSON.stringify(versionRecord.Digest?.M?.sha256?.S)}`);
      chunks.push(`    urls:`);
      for (const download of versionRecord.Download?.SS ?? []) {
        if (download.startsWith(objectUrlPrefix)) {
          chunks.push(`    - ${JSON.stringify(`${baseUrl}${encodeURIComponent(`${name?.S}`)}/${encodeURIComponent(`${name?.S}`)}-${encodeURIComponent(`${version?.S}`)}.tgz`)}`);
        } else if (download.startsWith('https://')) {
          chunks.push(`    - ${JSON.stringify(download)}`);
        }
      }
    }
  }

  chunks.push('');
  return new Response(chunks.join('\n'));
}
