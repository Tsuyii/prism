import OpenAI from 'openai'
import { toFile } from 'openai/uploads'

const WHISPER_MAX_BYTES = 25 * 1024 * 1024 // 25 MB

export async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  if (buffer.length > WHISPER_MAX_BYTES) {
    console.warn(
      `[whisper] File ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB) exceeds 25 MB limit — skipping transcription`,
    )
    return ''
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'mp4'
  const mimeMap: Record<string, string> = {
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  }
  const mimeType = mimeMap[ext] ?? 'video/mp4'

  const file = await toFile(buffer, filename, { type: mimeType })
  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    response_format: 'text',
  })

  return result as string
}
