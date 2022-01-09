resource "aws_dynamodb_table_item" "HelmCharts_dns-sync" {
  table_name = aws_dynamodb_table.HelmCharts.name
  hash_key   = aws_dynamodb_table.HelmCharts.hash_key
  range_key  = aws_dynamodb_table.HelmCharts.range_key

  item = jsonencode({
    "ChartKey"   = { "S" = "cloudydeno/dns-sync" },
    "ChartOwner" = { "S" = "cloudydeno" },
    "ChartName"  = { "S" = "dns-sync" },

    "HomeURL" = { "S" = "https://github.com/cloudydeno/kubernetes-dns-sync/tree/main/examples/helm-chart" },
    "ProjectURLs" = { "SS" = [
      "https://github.com/cloudydeno/kubernetes-dns-sync",
    ] },
    "Maintainers" = { "L" = [{ "M" = {
      "name"  = { "S" = "Daniel Lamando" },
      "email" = { "S" = "dan+cloudydeno@danopia.net" },
    } }] },

    "Keywords" = { "SS" = [
      "dns",
    ] },
    "Annotations" = { "M" = {
      "category" = { "S" = "Infrastructure" },
    } },
  })
}

resource "aws_dynamodb_table_item" "HelmReleases_dns-sync_0-1-0" {
  table_name = aws_dynamodb_table.HelmReleases.name
  hash_key   = aws_dynamodb_table.HelmReleases.hash_key
  range_key  = aws_dynamodb_table.HelmReleases.range_key

  item = jsonencode({
    "ChartKey"     = { "S" = "cloudydeno/dns-sync" },
    "ChartVersion" = { "S" = "0.1.0" },
    "ReleasedAt"   = { "S" = "2021-12-04T16:14:33.000Z" },

    "ChartMeta" = {
      "M" = {
        "name"        = { "S" = "dns-sync" },
        "description" = { "S" = "Manage hosted DNS providers using a Kubernetes control plane" },
        "appVersion"  = { "S" = "latest" },
        "apiVersion"  = { "S" = "v2" },
        "type"        = { "S" = "application" },
        "version"     = { "S" = "0.1.0" },
      },
    },

    "Download" = { "SS" = [
      "s3://${aws_s3_bucket.main.id}/${aws_s3_bucket_object.dns-sync_0-1-0.key}?versionId=${aws_s3_bucket_object.dns-sync_0-1-0.version_id}",
    ] },
    "Digest" = { "M" = {
      "sha256" = { "S" = aws_s3_bucket_object.dns-sync_0-1-0.metadata.sha256 },
    } },
  })
}
