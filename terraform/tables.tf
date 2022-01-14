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

resource "aws_dynamodb_table" "HelmGrabs" {
  name      = "HelmGrabs"
  hash_key  = "ChartKey"
  range_key = "GrabbedAt"

  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  tags         = {}

  attribute {
    name = "ChartKey"
    type = "S"
  }

  attribute {
    name = "GrabbedAt"
    type = "S"
  }

  ttl {
    attribute_name = "RemoveAt"
    enabled        = true
  }
}

resource "aws_dynamodb_table" "HelmOCI" {
  name      = "HelmOCI"
  hash_key  = "ChartKey"
  range_key = "Digest"

  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  tags         = {}

  attribute {
    name = "ChartKey"
    type = "S"
  }

  attribute {
    name = "Digest"
    type = "S"
  }
}

resource "aws_dynamodb_table" "HelmTokens" {
  name      = "HelmTokens"
  hash_key  = "BearerToken"

  billing_mode = "PAY_PER_REQUEST"
  table_class  = "STANDARD"
  tags         = {}

  attribute {
    name = "BearerToken"
    type = "S"
  }

  ttl {
    attribute_name = "RemoveAt"
    enabled        = true
  }
}
