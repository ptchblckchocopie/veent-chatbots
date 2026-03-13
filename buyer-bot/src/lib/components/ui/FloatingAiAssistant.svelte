<script lang="ts">
	import { Paperclip, Link, Code, Mic, Send, Info, Bot, X, Loader2 } from 'lucide-svelte';

	let isChatOpen = $state(false);
	let message = $state('');
	let charCount = $derived(message.length);
	const maxChars = 2000;
	let messages = $state<Array<{ role: string; content: string }>>([]);
	let loading = $state(false);
	let conversationId = $state('');
	let chatContainer: HTMLDivElement | undefined = $state();
	let chatRef: HTMLDivElement | undefined = $state();

	function scrollToBottom() {
		if (chatContainer) {
			setTimeout(() => {
				if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
			}, 50);
		}
	}

	async function handleSend() {
		const text = message.trim();
		if (!text || loading) return;

		messages.push({ role: 'user', content: text });
		message = '';
		loading = true;
		scrollToBottom();

		messages.push({ role: 'assistant', content: '' });
		const assistantIdx = messages.length - 1;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, conversation_id: conversationId })
			});

			if (!res.ok) {
				messages[assistantIdx].content = 'Sorry, I encountered an error. Please try again.';
				loading = false;
				return;
			}

			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) continue;
					const data = line.slice(6).trim();
					if (!data) continue;

					try {
						const parsed = JSON.parse(data);

						if (parsed.event === 'agent_message' || parsed.event === 'message') {
							messages[assistantIdx].content += parsed.answer || '';
							scrollToBottom();
						}

						if (parsed.event === 'message_end' && parsed.conversation_id) {
							conversationId = parsed.conversation_id;
						}
					} catch {
						// skip non-JSON lines
					}
				}
			}
		} catch {
			messages[assistantIdx].content = 'Could not connect to the server. Please try again.';
		}

		loading = false;
		scrollToBottom();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	function clearChat() {
		messages = [];
		conversationId = '';
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (chatRef && !chatRef.contains(target) && !target.closest('.floating-ai-button')) {
			isChatOpen = false;
		}
	}

	$effect(() => {
		if (isChatOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	});
</script>

<div class="fixed bottom-6 right-6 z-50 font-sans">
	<!-- Floating 3D Glowing AI Logo -->
	<button
		class="floating-ai-button relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 transform {isChatOpen
			? 'rotate-90'
			: 'rotate-0'}"
		onclick={() => (isChatOpen = !isChatOpen)}
		style="
      background: linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(168,85,247,0.8) 100%);
      box-shadow: 0 0 20px rgba(139, 92, 246, 0.7), 0 0 40px rgba(124, 58, 237, 0.5), 0 0 60px rgba(109, 40, 217, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.2);
    "
	>
		<div class="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30"></div>
		<div class="absolute inset-0 rounded-full border-2 border-white/10"></div>
		<div class="relative z-10">
			{#if isChatOpen}
				<X class="w-8 h-8 text-white" />
			{:else}
				<Bot class="w-8 h-8 text-white" />
			{/if}
		</div>
		<div class="absolute inset-0 rounded-full animate-ping opacity-20 bg-indigo-500"></div>
	</button>

	<!-- Chat Interface -->
	{#if isChatOpen}
		<div
			bind:this={chatRef}
			class="chat-pop-in absolute bottom-20 right-0 w-[420px] max-w-[calc(100vw-2rem)] transition-all duration-300 origin-bottom-right"
		>
			<div
				class="relative flex flex-col rounded-3xl bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 border border-zinc-500/50 shadow-2xl backdrop-blur-3xl overflow-hidden"
				style="max-height: calc(100vh - 140px);"
			>
				<!-- Header -->
				<div class="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
					<div class="flex items-center gap-1.5">
						<div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
						<span class="text-xs font-medium text-zinc-400">Veent Tix Support</span>
					</div>
					<div class="flex items-center gap-2">
						<span
							class="px-2 py-1 text-[10px] font-medium bg-zinc-800/60 text-zinc-300 rounded-2xl"
						>
							Groq
						</span>
						<span
							class="px-2 py-1 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl"
						>
							Live
						</span>
						{#if messages.length > 0}
							<button
								onclick={clearChat}
								class="px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-700/60 rounded-2xl transition-colors"
							>
								Clear
							</button>
						{/if}
						<button
							onclick={() => (isChatOpen = false)}
							class="p-1.5 rounded-full hover:bg-zinc-700/50 transition-colors"
						>
							<X class="w-4 h-4 text-zinc-400" />
						</button>
					</div>
				</div>

				<!-- Messages Area -->
				<div
					bind:this={chatContainer}
					class="flex-1 overflow-y-auto px-5 py-3 space-y-3 scrollbar-thin min-h-[200px] max-h-[350px]"
				>
					{#if messages.length === 0}
						<div class="flex flex-col items-center justify-center py-8 text-center">
							<div
								class="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-3"
							>
								<Bot class="w-6 h-6 text-indigo-400" />
							</div>
							<p class="text-sm text-zinc-400 mb-1">Hi! I'm the Veent Tix assistant.</p>
							<p class="text-xs text-zinc-500">Ask about events, tickets, or anything else!</p>
							<div class="flex flex-wrap gap-2 mt-4 justify-center">
								<button
									class="px-3 py-1.5 text-xs bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 rounded-full hover:bg-zinc-700/60 hover:border-zinc-600/50 transition-all"
									onclick={() => {
										message = 'What events are happening in April?';
										handleSend();
									}}
								>
									Events in April?
								</button>
								<button
									class="px-3 py-1.5 text-xs bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 rounded-full hover:bg-zinc-700/60 hover:border-zinc-600/50 transition-all"
									onclick={() => {
										message = 'How do I buy a ticket?';
										handleSend();
									}}
								>
									How to buy tickets?
								</button>
								<button
									class="px-3 py-1.5 text-xs bg-zinc-800/60 text-zinc-300 border border-zinc-700/50 rounded-full hover:bg-zinc-700/60 hover:border-zinc-600/50 transition-all"
									onclick={() => {
										message = 'Can I get a refund?';
										handleSend();
									}}
								>
									Refund policy?
								</button>
							</div>
						</div>
					{/if}

					{#each messages as msg}
						{#if msg.role === 'user'}
							<div class="flex justify-end">
								<div
									class="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm leading-relaxed"
								>
									{msg.content}
								</div>
							</div>
						{:else}
							<div class="flex justify-start">
								<div
									class="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-zinc-800/60 border border-zinc-700/40 text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap"
								>
									{#if !msg.content && loading}
										<div class="flex items-center gap-2 text-zinc-400">
											<Loader2 class="w-3.5 h-3.5 animate-spin" />
											<span class="text-xs">Thinking...</span>
										</div>
									{:else}
										{msg.content}
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>

				<!-- Input Section -->
				<div class="shrink-0 border-t border-zinc-700/30">
					<div class="relative">
						<textarea
							bind:value={message}
							onkeydown={handleKeyDown}
							rows={2}
							disabled={loading}
							class="w-full px-5 py-3 bg-transparent border-none outline-none resize-none text-sm font-normal leading-relaxed text-zinc-100 placeholder-zinc-500 disabled:opacity-50"
							placeholder="Ask about events, tickets, refunds..."
							style="scrollbar-width: none;"
						></textarea>
					</div>

					<!-- Controls Section -->
					<div class="px-4 pb-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<div
									class="flex items-center gap-1 p-1 bg-zinc-800/40 rounded-xl border border-zinc-700/50"
								>
									<button
										class="group relative p-2 bg-transparent rounded-lg transition-all duration-300 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 hover:scale-105 transform"
										title="Upload files"
									>
										<Paperclip class="w-3.5 h-3.5" />
									</button>
									<button
										class="group relative p-2 bg-transparent rounded-lg transition-all duration-300 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 hover:scale-105 transform"
										title="Web link"
									>
										<Link class="w-3.5 h-3.5" />
									</button>
									<button
										class="group relative p-2 bg-transparent rounded-lg transition-all duration-300 text-zinc-500 hover:text-green-400 hover:bg-zinc-800/80 hover:scale-105 transform"
										title="Code"
									>
										<Code class="w-3.5 h-3.5" />
									</button>
								</div>
								<button
									class="group relative p-2 bg-transparent border border-zinc-700/30 rounded-lg transition-all duration-300 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 hover:scale-110 transform hover:border-red-500/30"
									title="Voice input"
								>
									<Mic class="w-3.5 h-3.5" />
								</button>
							</div>

							<div class="flex items-center gap-3">
								<div class="text-xs font-medium text-zinc-500">
									<span>{charCount}</span>/<span class="text-zinc-400">{maxChars}</span>
								</div>
								<button
									onclick={handleSend}
									disabled={loading || !message.trim()}
									class="group relative p-2.5 bg-gradient-to-r from-red-600 to-red-500 border-none rounded-xl cursor-pointer transition-all duration-300 text-white shadow-lg hover:from-red-500 hover:to-red-400 hover:scale-110 hover:shadow-red-500/30 hover:shadow-xl active:scale-95 transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
								>
									<Send
										class="w-4 h-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-12"
									/>
									<div
										class="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-50 transition-opacity duration-300 blur-lg transform scale-110"
									></div>
								</button>
							</div>
						</div>

						<!-- Footer Info -->
						<div
							class="flex items-center justify-between mt-2.5 pt-2.5 border-t border-zinc-800/50 text-[10px] text-zinc-500 gap-4"
						>
							<div class="flex items-center gap-1.5">
								<Info class="w-3 h-3" />
								<span>
									<kbd
										class="px-1 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-zinc-400 font-mono text-[10px]"
										>Shift+Enter</kbd
									> new line
								</span>
							</div>
							<div class="flex items-center gap-1">
								<div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
								<span>All systems operational</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Floating Overlay -->
				<div
					class="absolute inset-0 rounded-3xl pointer-events-none"
					style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), transparent, rgba(147, 51, 234, 0.05))"
				></div>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes popIn {
		0% {
			opacity: 0;
			transform: scale(0.8) translateY(20px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.chat-pop-in {
		animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
	}

	:global(.floating-ai-button:hover) {
		transform: scale(1.1) rotate(5deg) !important;
		box-shadow:
			0 0 30px rgba(139, 92, 246, 0.9),
			0 0 50px rgba(124, 58, 237, 0.7),
			0 0 70px rgba(109, 40, 217, 0.5) !important;
	}

	/* Custom scrollbar for messages */
	.scrollbar-thin {
		scrollbar-width: thin;
		scrollbar-color: rgba(113, 113, 122, 0.3) transparent;
	}

	.scrollbar-thin::-webkit-scrollbar {
		width: 4px;
	}

	.scrollbar-thin::-webkit-scrollbar-track {
		background: transparent;
	}

	.scrollbar-thin::-webkit-scrollbar-thumb {
		background-color: rgba(113, 113, 122, 0.3);
		border-radius: 20px;
	}
</style>
