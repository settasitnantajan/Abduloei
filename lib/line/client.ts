const LINE_API_URL = 'https://api.line.me/v2/bot/message'

interface LineTextMessage {
  type: 'text'
  text: string
}

export async function sendLineMessage(
  lineUserId: string,
  messages: LineTextMessage[]
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set, skipping')
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }
  }

  try {
    const res = await fetch(`${LINE_API_URL}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[LINE] Push message failed:', res.status, body)
      return { success: false, error: `LINE API ${res.status}: ${body}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[LINE] Push message error:', error)
    return { success: false, error: String(error) }
  }
}

export async function sendTextMessage(
  lineUserId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  return sendLineMessage(lineUserId, [{ type: 'text', text }])
}

export async function replyLineMessage(
  replyToken: string,
  messages: LineTextMessage[]
): Promise<{ success: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not set' }
  }

  try {
    const res = await fetch(`${LINE_API_URL}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[LINE] Reply message failed:', res.status, body)
      return { success: false, error: `LINE API ${res.status}: ${body}` }
    }

    return { success: true }
  } catch (error) {
    console.error('[LINE] Reply message error:', error)
    return { success: false, error: String(error) }
  }
}
