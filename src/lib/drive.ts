import { google } from 'googleapis'

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!)
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  return google.drive({ version: 'v3', auth })
}

export interface DriveFileMetadata {
  id: string
  name: string
  mimeType: string
  size: string
}

export async function getFileMetadata(fileId: string): Promise<DriveFileMetadata> {
  const drive = getDriveClient()
  const res = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size',
    supportsAllDrives: true,
  })
  return res.data as DriveFileMetadata
}

export async function downloadFileAsBuffer(fileId: string): Promise<Buffer> {
  const drive = getDriveClient()
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return Buffer.from(res.data as ArrayBuffer)
}
