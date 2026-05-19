variable "aws_region" {
  type    = string
  default = "ap-southeast-1"
}

variable "project_name" {
  type    = string
  default = "docintel-mvp"
}

variable "s3_bucket" {
  type = string
}

variable "db_user" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type = string
}

variable "ami_id" {
  type = string
}

variable "api_instance_type" {
  type    = string
  default = "t3.small"
}

variable "key_pair_name" {
  type = string
}
