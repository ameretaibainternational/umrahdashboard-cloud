import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isDemoMode } from '@/lib/is-demo'
import { demoFileStore } from '@/lib/demo-file-store'

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

export function isR2Configured(): boolean {
  return isDemoMode() || getR2Config() !== null
}

function getClient(): S3Client {
  const cfg = getR2Config()
  if (!cfg) throw new Error('R2 is not configured. Add R2_* env vars to .env.local')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

function getBucket(): string {
  const cfg = getR2Config()
  if (!cfg) throw new Error('R2 is not configured')
  return cfg.bucket
}

export async function uploadPdf(key: string, body: Buffer): Promise<void> {
  if (isDemoMode()) {
    demoFileStore.set(key, body)
    return
  }
  const client = getClient()
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: body,
    ContentType: 'application/pdf',
  }))
}

export async function deletePdfKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  if (isDemoMode()) {
    keys.forEach(k => demoFileStore.delete(k))
    return
  }
  const client = getClient()
  await client.send(new DeleteObjectsCommand({
    Bucket: getBucket(),
    Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true },
  }))
}

/** List all invoice/voucher PDF keys in the R2 bucket. */
export async function listStoredPdfKeys(): Promise<string[]> {
  if (isDemoMode()) return demoFileStore.keys()
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
  const client = getClient()
  const bucket = getBucket()
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: '',
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key && (obj.Key.startsWith('invoices/') || obj.Key.startsWith('vouchers/'))) {
        keys.push(obj.Key)
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return keys
}

export async function getPdfBuffer(key: string): Promise<Buffer> {
  if (isDemoMode()) {
    const buf = demoFileStore.get(key)
    if (!buf) throw new Error('File not found in demo storage')
    return buf
  }
  const client = getClient()
  const res = await client.send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }))
  const bytes = await res.Body?.transformToByteArray()
  if (!bytes) throw new Error('Empty object from R2')
  return Buffer.from(bytes)
}

export async function getPresignedDownloadUrl(key: string, filename: string): Promise<string> {
  if (isDemoMode()) {
    const params = new URLSearchParams({ key, name: filename })
    return `/api/storage/demo-file?${params.toString()}`
  }
  const client = getClient()
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
      ResponseContentType: 'application/pdf',
    }),
    { expiresIn: 300 },
  )
}
