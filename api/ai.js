const API_KEY = process.env.AI_API_KEY
const API_URL = process.env.AI_API_URL
const MODEL = process.env.AI_MODEL
const PASSWORD = process.env.PASSWORD

export const config = {
    runtime: 'nodejs'
}

function sendEvent(controller, encoder, event, data) {
    controller.enqueue(encoder.encode(`event: ${event}\n`))
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export default {
    async fetch(request) {
        const encoder = new TextEncoder()

        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ error: '只支持 POST 请求' }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        if (!API_KEY) {
            return new Response(JSON.stringify({ error: 'AI_API_KEY 未配置' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        let body
        try {
            body = await request.json()
        } catch {
            return new Response(JSON.stringify({ error: '无效的 JSON' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const { messages, password } = body

        if (!messages) {
            return new Response(JSON.stringify({ error: '缺少 messages 参数' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        if (PASSWORD && password !== PASSWORD) {
            return new Response(JSON.stringify({ error: '密码验证失败' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const stream = new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode(': connected\n\n'))

                try {
                    sendEvent(controller, encoder, 'status', { message: '正在连接 AI...' })

                    const response = await fetch(`${API_URL}/v1/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${API_KEY}`
                        },
                        body: JSON.stringify({
                            model: MODEL,
                            messages: messages,
                            stream: true
                        })
                    })

                    if (!response.ok) {
                        const errorText = await response.text()
                        throw new Error(`AI 请求失败: ${response.status} - ${errorText}`)
                    }

                    const reader = response.body.getReader()

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        controller.enqueue(value)
                    }

                    controller.close()
                } catch (error) {
                    console.error('AI API Error:', error)
                    sendEvent(controller, encoder, 'error', { error: error.message })
                    controller.close()
                }
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            }
        })
    }
}