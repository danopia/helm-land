resource "aws_s3_bucket_object" "dns-sync_0-1-0" {
  bucket = aws_s3_bucket.main.id
  key    = "cloudydeno/dns-sync/0.1.0.tgz"
  tags   = {}

  source = "charts/dns-sync-0.1.0.tgz"
  etag   = filemd5("charts/dns-sync-0.1.0.tgz")
  metadata = {
    sha256 = filesha256("charts/dns-sync-0.1.0.tgz")
  }

  cache_control = "public, max-age=604800, immutable"
  content_type  = "application/gzip"
}
