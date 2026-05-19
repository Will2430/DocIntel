output "s3_bucket" {
  value = aws_s3_bucket.docs.bucket
}

output "sqs_queue_url" {
  value = aws_sqs_queue.doc_jobs.id
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}
