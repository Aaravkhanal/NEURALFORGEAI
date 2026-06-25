import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, model: clientModel, max_tokens: clientMaxTokens, temperature: clientTemp, system_prompt: clientSystem } = body;

    const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
    const MODEL = clientModel || process.env.DEFAULT_MODEL_NAME || 'meta/llama-3.1-70b-instruct';

    if (!NVIDIA_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'NVIDIA API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemMessage = {
      role: 'system',
      content: clientSystem || `You are NeuralForge, a helpful ML engineering assistant. You help users with machine learning tasks including:
- Finding and selecting datasets
- Data cleaning and preprocessing
- Model selection and comparison
- Training and hyperparameter tuning
- Deployment and monitoring

Be concise, helpful, and technical when needed. Use markdown formatting for code blocks and structured responses.`,
    };

    const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [systemMessage, ...messages],
        stream: true,
        max_tokens: clientMaxTokens || 4096,
        temperature: clientTemp ?? 0.3,
      }),
    });

    if (!nvidiaResponse.ok) {
      const errorText = await nvidiaResponse.text();
      console.error('NVIDIA API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get response from NVIDIA API' }),
        { status: nvidiaResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = nvidiaResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const encoder = new TextEncoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
