import os

import boto3
from dagster import ConfigurableResource


class R2Resource(ConfigurableResource):
    """Thin wrapper around a boto3 S3 client configured for Cloudflare R2.

    Reads credentials from the environment (R2_ENDPOINT, R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY, R2_BUCKET) so the same code works locally (via
    .env + python-dotenv) and on GitHub Actions (via repo secrets injected
    as env vars).
    """

    def _client(self):
        return boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            # R2 rejects real AWS region names (e.g. picked up from local
            # ~/.aws config) - it only accepts its own region tokens, and
            # "auto" lets Cloudflare route to the bucket's actual location.
            region_name="auto",
        )

    def put_bytes(self, key: str, data: bytes) -> None:
        bucket = os.environ["R2_BUCKET"]
        self._client().put_object(Bucket=bucket, Key=key, Body=data)
