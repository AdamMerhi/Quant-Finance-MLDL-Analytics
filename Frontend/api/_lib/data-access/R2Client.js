// Thin wrapper around the AWS S3 SDK configured for Cloudflare R2.
// Mirrors data_pipeline/resources/r2.py: same env vars, same "auto" region
// (R2 rejects real AWS region names).

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export class R2Client {
  constructor() {
    this.bucket = process.env.R2_BUCKET;
    this.client = new S3Client({
      endpoint: process.env.R2_ENDPOINT,
      region: "auto",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  // Downloads an object and returns its full contents as a Buffer.
  async getObjectBuffer(key) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
