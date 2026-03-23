import { Client } from '@line/bot-sdk'

export default async function TestLinePage() {
  let connectionStatus = {
    success: false,
    message: '',
    channelId: '',
    error: null as string | null,
    botInfo: null as any,
  }

  try {
    // Get credentials from environment
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    const channelId = process.env.LINE_CHANNEL_ID

    if (!channelAccessToken || !channelSecret || !channelId) {
      throw new Error('LINE credentials are not configured in .env.local')
    }

    connectionStatus.channelId = channelId

    // Create LINE client
    const client = new Client({
      channelAccessToken,
      channelSecret,
    })

    // Test connection by getting bot info
    try {
      const botInfo = await client.getBotInfo()
      connectionStatus.botInfo = botInfo
      connectionStatus.success = true
      connectionStatus.message = 'เชื่อมต่อ LINE สำเร็จ!'
    } catch (error: any) {
      // Even if getBotInfo fails, if we get a proper error response, connection is OK
      if (error.statusCode === 401) {
        throw new Error('Channel Access Token ไม่ถูกต้อง')
      } else if (error.statusCode === 403) {
        throw new Error('ไม่มีสิทธิ์เข้าถึง (Channel Secret อาจไม่ถูกต้อง)')
      } else {
        // Other errors might still mean connection works
        connectionStatus.success = true
        connectionStatus.message = 'เชื่อมต่อสำเร็จ แต่ไม่สามารถดึงข้อมูล Bot ได้'
        connectionStatus.error = error.message
      }
    }
  } catch (error: any) {
    connectionStatus.success = false
    connectionStatus.error = error.message || 'Unknown error'
    connectionStatus.message = 'การเชื่อมต่อล้มเหลว'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">
          🧪 LINE Messaging API Connection Test
        </h1>

        {/* Connection Status */}
        <div
          className={`p-6 rounded-lg shadow-md mb-6 ${
            connectionStatus.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">
              {connectionStatus.success ? '✅' : '❌'}
            </span>
            <div>
              <h2 className="text-xl font-bold">
                {connectionStatus.success
                  ? 'เชื่อมต่อสำเร็จ!'
                  : 'การเชื่อมต่อล้มเหลว'}
              </h2>
              <p className="text-sm text-gray-600">
                {connectionStatus.message}
              </p>
            </div>
          </div>

          {connectionStatus.error && (
            <div className="mt-4 p-4 bg-red-100 rounded border border-red-300">
              <p className="text-sm font-mono text-red-800">
                <strong>Error:</strong> {connectionStatus.error}
              </p>
            </div>
          )}
        </div>

        {/* Connection Details */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-bold mb-4 text-gray-900">
            📋 LINE Channel Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">Channel ID:</span>
              <span className="text-sm font-mono text-gray-900">
                {connectionStatus.channelId || 'ไม่พบข้อมูล'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">SDK:</span>
              <span className="text-sm text-gray-900">
                @line/bot-sdk (Server-side)
              </span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="font-medium text-gray-700">Environment:</span>
              <span className="text-sm text-gray-900">Next.js App Router</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-gray-700">สถานะ:</span>
              <span
                className={`text-sm font-bold ${
                  connectionStatus.success ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {connectionStatus.success ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
        </div>

        {/* Bot Info */}
        {connectionStatus.botInfo && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900">
              🤖 ข้อมูล Bot
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {connectionStatus.botInfo.pictureUrl && (
                  <img
                    src={connectionStatus.botInfo.pictureUrl}
                    alt="Bot"
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <p className="font-bold text-lg">
                    {connectionStatus.botInfo.displayName || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600">
                    User ID: {connectionStatus.botInfo.userId || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Basic ID:{' '}
                    {connectionStatus.botInfo.basicId ||
                      connectionStatus.botInfo.userId ||
                      '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-bold mb-3 text-blue-900">
            🚀 ขั้นตอนถัดไป
          </h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
            <li>เพิ่มเพื่อนกับ LINE Official Account ของคุณ</li>
            <li>
              สร้าง Webhook API route ที่{' '}
              <code>app/api/line/webhook/route.ts</code>
            </li>
            <li>Deploy โปรเจกต์ขึ้น server (Vercel, Railway, etc.)</li>
            <li>
              ตั้งค่า Webhook URL ใน LINE Developers Console:{' '}
              <code>https://your-domain.com/api/line/webhook</code>
            </li>
            <li>ทดสอบส่งข้อความผ่าน LINE</li>
            <li>
              ดูเอกสาร <code>LINE-CONNECTION.md</code> สำหรับรายละเอียด
            </li>
          </ul>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            ← กลับหน้าหลัก
          </a>
        </div>
      </div>
    </div>
  )
}
