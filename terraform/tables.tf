resource "aws_dynamodb_table" "HelmCharts" {
  name      = "HelmCharts"
  hash_key  = "ChartOwner"
  range_key = "ChartName"

  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  tags         = {}

  attribute {
    name = "ChartOwner"
    type = "S"
  }

  attribute {
    name = "ChartName"
    type = "S"
  }
}

resource "aws_dynamodb_table" "HelmReleases" {
  name      = "HelmReleases"
  hash_key  = "ChartKey"
  range_key = "ChartVersion"

  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  tags         = {}

  attribute {
    name = "ChartKey"
    type = "S"
  }

  attribute {
    name = "ChartVersion"
    type = "S"
  }

  attribute {
    name = "ReleasedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "ByReleasedAt"
    hash_key        = "ChartKey"
    range_key       = "ReleasedAt"
    projection_type = "ALL"
  }
}
