resource "aws_dynamodb_table_item" "HelmCharts_dns-sync" {
  table_name = aws_dynamodb_table.HelmCharts.name
  hash_key   = aws_dynamodb_table.HelmCharts.hash_key
  range_key  = aws_dynamodb_table.HelmCharts.range_key

  item = <<ITEM
{
  "ChartKey": {
    "S": "cloudydeno/dns-sync"
  },
  "ChartName": {
    "S": "dns-sync"
  },
  "ChartOwner": {
    "S": "cloudydeno"
  },
  "HomeURL": {
    "S": "https://github.com/cloudydeno/kubernetes-dns-sync/tree/main/examples/helm-chart"
  },
  "Keywords": {
    "SS": [
      "dns"
    ]
  },
  "ProjectURLs": {
    "SS": [
      "https://github.com/cloudydeno/kubernetes-dns-sync"
    ]
  },
  "Annotations": {
    "M": {
      "category": {
        "S": "Infrastructure"
      }
    }
  },
  "Maintainers": {
    "L": [
      {
        "M": {
          "name": {
            "S": "Daniel Lamando"
          },
          "email": {
            "S": "dan+cloudydeno@danopia.net"
          }
        }
      }
    ]
  }
}
ITEM
}

resource "aws_dynamodb_table_item" "HelmReleases_dns-sync_0-1-0" {
  table_name = aws_dynamodb_table.HelmReleases.name
  hash_key   = aws_dynamodb_table.HelmReleases.hash_key
  range_key  = aws_dynamodb_table.HelmReleases.range_key

  item = <<ITEM
{
  "ChartKey": {
    "S": "cloudydeno/dns-sync"
  },
  "ChartVersion": {
    "S": "0.1.0"
  },
  "Download": {
    "SS": [
      "s3://deno-helm-land/cloudydeno/dns-sync/dns-sync-0.1.0.tgz?versionId=R0h4DtQP9Wonz3enlggadhxaxQ9A9iUP"
    ]
  },
  "Digest": {
    "M": {
      "sha256": {
        "S": "d27724c8c53d48caeb835ef3a957a59e9c9cbaa516e8645469654c06a0265195"
      }
    }
  },
  "ReleasedAt": {
    "S": "2021-12-04T16:14:33.000Z"
  },
  "ChartMeta": {
    "M": {
      "name": {
        "S": "dns-sync"
      },
      "description": {
        "S": "Manage hosted DNS providers using a Kubernetes control plane"
      },
      "appVersion": {
        "S": "latest"
      },
      "apiVersion": {
        "S": "v2"
      },
      "type": {
        "S": "application"
      },
      "version": {
        "S": "0.1.0"
      }
    }
  }
}
ITEM
}
