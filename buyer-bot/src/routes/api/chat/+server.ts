import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { message, conversation_id } = await request.json();

	const res = await fetch(`${env.DIFY_API_URL}/chat-messages`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.DIFY_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			inputs: {},
			query: message,
			response_mode: 'streaming',
			conversation_id: conversation_id || '',
			user: 'test-user'
		})
	});

	if (!res.ok) {
		const err = await res.text();
		return new Response(JSON.stringify({ error: err }), { status: res.status });
	}

	// Stream the SSE response through
	return new Response(res.body, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
