# S3-Compatible Object Storage Integration Plan

## Executive Summary

Your current S3 code **already follows the S3 API protocol** and can work with S3-compatible storage (MinIO, Rust FS, etc.) with **minimal changes**. The main differences are configuration-based (endpoint, authentication), not code-based, because S3-compatible storage implements the AWS S3 API specification.

---

## Part 1: S3 Protocol Compatibility - Why It Works

### Current Architecture
Your code uses AWS SDK which communicates via:
- **S3 API Protocol** (HTTP REST with AWS4 Signature signing)
- Standard S3 operations: `PutObject`, `GetObject`, etc.

### S3-Compatible Storage
MinIO, Rust FS, and similar systems:
- ✅ Implement the **exact same S3 API protocol**
- ✅ Support AWS4 signature signing (as shown in your curl example)
- ✅ Support IAM/Access Control
- ✅ Are "drop-in replacements" from a code perspective

### Result
**No code changes needed.** Only configuration changes (endpoint URL, credentials).

---

## Part 2: Configuration Comparison

### AWS S3 (Production)
```javascript
// Current setup
AWS.config.update({ 
  region: "us-east-1",
  accessKeyId: "YOUR_AWS_KEY",
  secretAccessKey: "YOUR_AWS_SECRET"
});
const s3 = new AWS.S3();
```

### S3-Compatible Storage (MinIO Example)
```javascript
// MinIO/Self-hosted setup
AWS.config.update({ 
  region: "cn-east-1",  // Can be any string for MinIO
  accessKeyId: "minioadmin",  // MinIO access key
  secretAccessKey: "minioadmin"  // MinIO secret key
});

const s3 = new AWS.S3({
  endpoint: "http://12.34.56.78:9000",  // MinIO server URL
  s3ForcePathStyle: true,  // MinIO requires path-style URLs
  signatureVersion: "v4"  // AWS4 signing (what your curl uses)
});
```

### Key Differences
| Aspect | AWS S3 | MinIO/S3-Compatible |
|--------|--------|----------------------|
| **Endpoint** | AWS managed (no config needed) | Custom: `http://host:port` |
| **Region** | Real AWS regions | Arbitrary string (for routing) |
| **s3ForcePathStyle** | false (virtual-hosted style) | true (path-style URLs) |
| **Signature** | v4 (default) | v4 (required) |

---

## Part 3: Understanding Your Curl Example

```bash
curl --location --request PUT 'http://12.34.56.78:9000/bucket-creation-by-api/password.txt' \
--header 'Content-Type: text/plain' \
--header 'X-Amz-Content-Sha256: ' \
--header 'X-Amz-Date: ' \
--header 'Authorization: AWS4-HMAC-SHA256 Credential=H4xcBZKQfvJjEnk3zp1N/20250801/cn-east-1/s3/aws4_request, SignedHeaders=content-length;content-type;host;x-amz-content-sha256;x-amz-date, Signature=' \
--data-binary '@/path/to/password.txt'
```

### Breaking Down the Config:
- **Endpoint**: `http://12.34.56.78:9000` → S3-compatible server IP and port
- **Bucket**: `bucket-creation-by-api` → Container for objects
- **Key**: `password.txt` → Object name/path
- **Content-Type**: `text/plain` → How the object is marked (your code does this)
- **Authorization header**: 
  - `AWS4-HMAC-SHA256` → Signature algorithm
  - `Credential=H4xcBZKQfvJjEnk3zp1N` → Access Key
  - `20250801/cn-east-1/s3/aws4_request` → Date scope / Region scope / Service (s3)
  - `Signature=...` → HMAC-SHA256 of request (SDK calculates this)

**The AWS SDK handles all these headers automatically.** Your Node.js code just needs the config.

---

## Part 4: IAM Setup for S3-Compatible Storage

### MinIO IAM (Not AWS IAM)
MinIO has its own user/access management:

#### Option 1: Default Credentials
```
Access Key: minioadmin
Secret Key: minioadmin
```
⚠️ **Not secure** - for development only.

#### Option 2: Create MinIO Users
```bash
# Connect to MinIO server
mc alias set minio http://12.34.56.78:9000 minioadmin minioadmin

# Create a user for your application
mc admin user add minio appuser apppassword123

# Create/assign policy
mc admin policy create minio readwrite-policy policy.json

mc admin policy attach minio readwrite-policy --user=appuser
```

#### Option 3: Policy-Based Access Control
MinIO uses JSON policy files (similar to AWS IAM):
```json
{
  "Version": "2012-10-17",
  "Statement": [
	{
	  "Effect": "Allow",
	  "Action": [
		"s3:GetObject",
		"s3:PutObject",
		"s3:DeleteObject"
	  ],
	  "Resource": "arn:aws:s3:::my-bucket/*"
	}
  ]
}
```

#### Option 4: LDAP/Active Directory Integration
MinIO can sync with corporate LDAP:
```
# Configure MinIO to use LDAP
MINIO_IDENTITY_LDAP_SERVER_ADDR=ldap.example.com:389
MINIO_IDENTITY_LDAP_LOOKUP_BIND_DN=cn=admin,dc=example,dc=com
MINIO_IDENTITY_LDAP_LOOKUP_BIND_PASSWORD=password
```

### Your Code Integration
```javascript
const config = {
  profile: process.env.APP_ENV,  // 'production' or 'development'
  awsRegion: process.env.AWS_REGION,
  s3Bucket: process.env.S3_BUCKET,
  s3Endpoint: process.env.S3_ENDPOINT,  // NEW: http://12.34.56.78:9000
  s3AccessKey: process.env.AWS_ACCESS_KEY_ID,
  s3SecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',  // NEW
};
```

---

## Part 5: nginx Proxy Configuration

### Use Case
nginx acts as:
- **Load balancer** across multiple MinIO instances
- **SSL terminator** (MinIO → nginx over HTTP, clients → nginx over HTTPS)
- **Request router** (different buckets/paths to different backends)
- **Request transformer** (adding headers, logging, etc.)

### Basic nginx Config for MinIO

```nginx
upstream minio_backend {
	# Multiple MinIO instances for HA
	server 12.34.56.78:9000;
	server 12.34.56.79:9000;
	server 12.34.56.80:9000;

	# Keepalive connections
	keepalive 32;
}

server {
	listen 80;
	# Or for HTTPS:
	# listen 443 ssl http2;
	# ssl_certificate /path/to/cert.pem;
	# ssl_certificate_key /path/to/key.pem;

	server_name s3.yourdomain.com;

	# Increase upload size for S3
	client_max_body_size 5G;

	# Proxy pass to MinIO
	location / {
		# Virtual-hosted style → path-style conversion (if needed)
		proxy_pass http://minio_backend;

		# Preserve S3-specific headers
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
		proxy_set_header X-Amz-Date $http_x_amz_date;
		proxy_set_header Authorization $http_authorization;
		proxy_set_header X-Amz-Content-Sha256 $http_x_amz_content_sha256;

		# Connection settings
		proxy_http_version 1.1;
		proxy_buffering off;  # Important for uploads/downloads
		proxy_request_buffering off;

		# WebSocket support (if MinIO uses it for admin)
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";

		# Timeouts for large transfers
		proxy_connect_timeout 60s;
		proxy_send_timeout 300s;
		proxy_read_timeout 300s;
	}

	# MinIO Admin Console (optional)
	location ^~ /minio/ui/ {
		proxy_pass http://minio_backend;
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;
	}
}
```

### nginx + SSL/TLS Termination
```nginx
server {
	listen 443 ssl http2;
	server_name s3.yourdomain.com;

	ssl_certificate /etc/nginx/certs/s3.crt;
	ssl_certificate_key /etc/nginx/certs/s3.key;

	# Security headers
	ssl_protocols TLSv1.2 TLSv1.3;
	ssl_ciphers HIGH:!aNULL:!MD5;

	client_max_body_size 5G;

	location / {
		proxy_pass http://minio_backend;
		proxy_set_header Host $host;
		proxy_set_header X-Forwarded-Proto https;

		# ... rest of config
	}
}

# Redirect HTTP to HTTPS
server {
	listen 80;
	server_name s3.yourdomain.com;
	return 301 https://$server_name$request_uri;
}
```

### Request Flow
```
Client
  ↓ (HTTPS)
nginx (SSL termination)
  ↓ (HTTP, signed S3 requests)
MinIO (12.34.56.78:9000)
  ↓ (Response)
nginx
  ↓ (HTTPS response)
Client
```

---

## Part 6: Implementation Steps

### Step 1: Create Environment Configuration
Create `.env.minio`:
```env
APP_ENV=development
AWS_REGION=cn-east-1
S3_BUCKET=bucket-creation-by-api
S3_ENDPOINT=http://12.34.56.78:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
```

### Step 2: Update S3.js Configuration
Modify `mvp/src/storage/s3.js`:
```javascript
const AWS = require("aws-sdk");
const { config } = require("../config");

AWS.config.update({ 
  region: config.awsRegion,
  accessKeyId: config.s3AccessKey,
  secretAccessKey: config.s3SecretKey
});

const s3InitOptions = {
  signatureVersion: "v4"
};

// If using S3-compatible storage
if (config.s3Endpoint) {
  s3InitOptions.endpoint = config.s3Endpoint;
  s3InitOptions.s3ForcePathStyle = config.s3ForcePathStyle || false;
}

const s3 = new AWS.S3(s3InitOptions);

// ... rest of code unchanged
```

### Step 3: Start MinIO
```bash
# Docker Compose
version: '3'
services:
  minio:
	image: minio/minio:latest
	ports:
	  - "9000:9000"  # S3 API
	  - "9001:9001"  # Admin Console
	environment:
	  MINIO_ROOT_USER: minioadmin
	  MINIO_ROOT_PASSWORD: minioadmin
	  MINIO_DEFAULT_BUCKETS: bucket-creation-by-api
	volumes:
	  - minio-storage:/minio_data
	command: minio server /minio_data

volumes:
  minio-storage:
```

### Step 4: Configure nginx
Copy nginx config from Part 5 above.

### Step 5: Test with Curl
```bash
curl --location --request PUT 'http://localhost:9000/bucket-creation-by-api/test.txt' \
  --header 'Content-Type: text/plain' \
  --data-binary 'Hello MinIO'
```

### Step 6: Test with Node.js Code
```javascript
const { uploadPdf } = require('./mvp/src/storage/s3');

uploadPdf({
  key: 'test-document.pdf',
  buffer: Buffer.from('PDF content...'),
  contentType: 'application/pdf'
}).then(() => console.log('Upload successful'))
  .catch(err => console.error('Upload failed:', err));
```

---

## Part 7: Deployment Scenarios

### Scenario 1: Local Development
```
Your App → S3.js → AWS SDK → MinIO (localhost:9000)
Config: S3_ENDPOINT=http://localhost:9000
```

### Scenario 2: Self-Hosted with nginx Load Balancer
```
Your App → S3.js → AWS SDK → nginx (s3.yourdomain.com) 
  → MinIO Cluster (12.34.56.78-80:9000)
Config: S3_ENDPOINT=https://s3.yourdomain.com
```

### Scenario 3: Hybrid (AWS S3 ↔ MinIO)
Toggle by environment:
```javascript
const endpoint = process.env.APP_ENV === 'production' 
  ? null  // Use AWS
  : 'http://12.34.56.78:9000';  // Use MinIO
```

### Scenario 4: Multi-Cloud (AWS + MinIO Failover)
```javascript
try {
  await uploadToAWS();
} catch (err) {
  console.log('AWS failed, falling back to MinIO');
  await uploadToMinIO();
}
```

---

## Part 8: Security Considerations

### TLS/SSL Encryption
- Always use HTTPS in production
- nginx terminates SSL
- MinIO ↔ nginx can be HTTP (internal network)

### Access Control
- Use strong credentials (not `minioadmin/minioadmin`)
- Implement IAM policies per application
- Consider LDAP integration for team access

### Network
- Restrict MinIO API port (9000) to internal networks only
- Only expose via nginx to external clients
- Use firewall rules

### Credentials Management
- Store in `.env` files (not git)
- Use secrets management (e.g., HashiCorp Vault, AWS Secrets Manager)
- Rotate access keys regularly

---

## Part 9: Summary Table

| Aspect | AWS S3 | MinIO/S3-Compatible |
|--------|--------|----------------------|
| **Code Changes** | No | Minimal (config only) |
| **Protocol** | AWS S3 API | AWS S3 API (compatible) |
| **Endpoint Config** | None (AWS managed) | Required |
| **Path Style** | Virtual-hosted | Path-style (usually) |
| **Signature** | v4 | v4 |
| **IAM** | AWS IAM | MinIO IAM (JSON policies) |
| **Proxy** | Not needed | Recommended (nginx) |
| **TLS** | AWS managed | nginx or MinIO SSL |
| **Cost** | Per GB + requests | Self-hosted infrastructure |
| **Scalability** | AWS managed | Requires clustering |
| **Compliance** | AWS certifications | Your responsibility |

---

## Conclusion

**Your current S3 code is already S3-protocol compliant.** To use S3-compatible storage:

1. ✅ **No code changes** (just config updates)
2. ✅ **Add endpoint configuration** (URL of MinIO server)
3. ✅ **Set s3ForcePathStyle = true** (for MinIO compatibility)
4. ✅ **Update credentials** (MinIO user/password instead of AWS)
5. ✅ **Optional: Deploy nginx** (for load balancing, SSL termination)
6. ✅ **Set up MinIO IAM** (users, policies, access control)

The beauty of S3 compatibility is **portability**: Your Node.js code works identically whether you're using AWS S3, MinIO, DigitalOcean Spaces, or any other S3-compatible storage.
