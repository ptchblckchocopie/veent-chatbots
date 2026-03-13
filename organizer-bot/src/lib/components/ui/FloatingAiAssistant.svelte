<script lang="ts">
	import { Send, Info, Bot, X, Loader2, Sparkles, RotateCcw } from 'lucide-svelte';

	let isChatOpen = $state(false);
	let message = $state('');
	let charCount = $derived(message.length);
	const maxChars = 2000;
	let messages = $state<Array<{ role: string; content: string; id: number }>>([]);
	let msgIdCounter = 0;
	let loading = $state(false);
	let conversationId = $state('');
	let chatContainer: HTMLDivElement | undefined = $state();
	let chatRef: HTMLDivElement | undefined = $state();
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let showWelcome = $state(true);

	// Drag state
	let isDragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let btnX = $state(0);
	let btnY = $state(0);
	let startBtnX = 0;
	let startBtnY = 0;
	let hasMoved = false;

	// Char count color
	let charColor = $derived(
		charCount > maxChars * 0.9
			? 'text-red-400'
			: charCount > maxChars * 0.7
				? 'text-amber-400'
				: 'text-neutral-500'
	);

	function clampPosition(x: number, y: number) {
		const btnSize = 64;
		const maxX = window.innerWidth - btnSize;
		const maxY = window.innerHeight - btnSize;
		return {
			x: Math.max(0, Math.min(x, maxX)),
			y: Math.max(0, Math.min(y, maxY))
		};
	}

	function onPointerDown(e: PointerEvent) {
		isDragging = true;
		hasMoved = false;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		startBtnX = btnX;
		startBtnY = btnY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	}

	function onPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
		const clamped = clampPosition(startBtnX + dx, startBtnY + dy);
		btnX = clamped.x;
		btnY = clamped.y;
	}

	function onPointerUp() {
		isDragging = false;
		if (!hasMoved) {
			isChatOpen = !isChatOpen;
		}
	}

	let chatStyle = $derived.by(() => {
		const btnSize = 64;
		const chatW = 420;
		const chatMaxH = 520;
		const gap = 16;

		let left: number;
		if (btnX + btnSize > chatW) {
			left = btnX + btnSize - chatW;
		} else {
			left = btnX;
		}
		left = Math.max(8, Math.min(left, window.innerWidth - chatW - 8));

		let top: number;
		if (btnY - gap - chatMaxH > 8) {
			top = btnY - gap - chatMaxH;
		} else {
			top = btnY + btnSize + gap;
		}
		top = Math.max(8, Math.min(top, window.innerHeight - chatMaxH - 8));

		return `left:${left}px;top:${top}px;`;
	});

	$effect(() => {
		btnX = window.innerWidth - 64 - 24;
		btnY = window.innerHeight - 64 - 24;
	});

	$effect(() => {
		if (isChatOpen && textareaEl) {
			setTimeout(() => textareaEl?.focus(), 350);
		}
	});

	function scrollToBottom() {
		if (chatContainer) {
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
				}
			}, 50);
		}
	}

	async function handleSend() {
		const text = message.trim();
		if (!text || loading || charCount > maxChars) return;

		showWelcome = false;
		messages.push({ role: 'user', content: text, id: ++msgIdCounter });
		message = '';
		loading = true;
		scrollToBottom();

		messages.push({ role: 'assistant', content: '', id: ++msgIdCounter });
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
		showWelcome = true;
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

<div class="font-sans">
	<!-- Draggable Floating Button — Veent Red -->
	<button
		class="floating-ai-button fixed z-[60] w-16 h-16 rounded-full flex items-center justify-center"
		class:cursor-grabbing={isDragging}
		class:cursor-grab={!isDragging}
		class:btn-dragging={isDragging}
		class:btn-open={isChatOpen}
		style="left:{btnX}px;top:{btnY}px;touch-action:none;"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
	>
		<div class="btn-glow-ring"></div>
		<div class="btn-inner">
			<div class="relative z-10 icon-flip" class:icon-flipped={isChatOpen}>
				{#if isChatOpen}
					<X class="w-7 h-7 text-white drop-shadow-lg" />
				{:else}
					<Bot class="w-7 h-7 text-white drop-shadow-lg" />
				{/if}
			</div>
		</div>
		{#if !isChatOpen && !isDragging}
			<div class="btn-ping"></div>
		{/if}
	</button>

	<!-- Chat Interface -->
	{#if isChatOpen}
		<div
			bind:this={chatRef}
			class="chat-container fixed z-50 w-[420px] max-w-[calc(100vw-1rem)]"
			style={chatStyle}
		>
			<div class="chat-border-glow">
				<div
					class="chat-panel relative flex flex-col rounded-2xl overflow-hidden"
					style="max-height: calc(100vh - 140px);"
				>
					<!-- Header -->
					<div class="chat-header flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
						<div class="flex items-center gap-2">
							<div class="relative">
								<div class="vee-avatar w-8 h-8 rounded-full flex items-center justify-center">
									<Sparkles class="w-4 h-4 text-white" />
								</div>
								<div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-dot"></div>
							</div>
							<div>
								<span class="text-sm font-semibold" style="color:#F4F5F0">Vee</span>
								<span class="text-[10px] block -mt-0.5" style="color:#858582">Dashboard Assistant</span>
							</div>
						</div>
						<div class="flex items-center gap-1.5">
							<span class="tag-badge tag-organizer">Organizer</span>
							<span class="tag-badge tag-live">Live</span>
							{#if messages.length > 0}
								<button
									onclick={clearChat}
									class="p-1.5 rounded-lg transition-all duration-200 group hover-surface"
									title="Clear chat"
								>
									<RotateCcw class="w-3.5 h-3.5 transition-colors duration-500 group-hover:rotate-[-180deg]" style="color:#858582" />
								</button>
							{/if}
							<button
								onclick={() => (isChatOpen = false)}
								class="p-1.5 rounded-lg transition-all duration-200 group hover-surface"
							>
								<X class="w-4 h-4 transition-colors" style="color:#858582" />
							</button>
						</div>
					</div>

					<!-- Messages Area -->
					<div
						bind:this={chatContainer}
						class="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin min-h-[200px] max-h-[350px]"
					>
						<!-- Welcome State -->
						{#if showWelcome && messages.length === 0}
							<div class="welcome-container flex flex-col items-center justify-center py-6 text-center">
								<div class="welcome-avatar">
									<div class="w-14 h-14 rounded-2xl vee-avatar-welcome flex items-center justify-center backdrop-blur-sm">
										<Bot class="w-7 h-7" style="color:#F4F5F0" />
									</div>
								</div>
								<div class="welcome-text mt-4">
									<p class="text-sm font-medium" style="color:#F4F5F0">Hey! I'm Vee</p>
									<p class="text-xs mt-1 max-w-[280px] leading-relaxed" style="color:#858582">Your dashboard buddy. Think of me as that coworker who knows every button and menu.</p>
								</div>
								<div class="welcome-prompts flex flex-wrap gap-2 mt-5 justify-center">
									<button
										class="prompt-chip"
										onclick={() => { message = "I'm new here, where do I start?"; handleSend(); }}
									>
										<span class="prompt-chip-dot"></span>
										I'm new here
									</button>
									<button
										class="prompt-chip"
										onclick={() => { message = 'How do I set up tickets and pricing?'; handleSend(); }}
									>
										<span class="prompt-chip-dot"></span>
										Tickets & pricing
									</button>
									<button
										class="prompt-chip"
										onclick={() => { message = 'How do I scan tickets on event day?'; handleSend(); }}
									>
										<span class="prompt-chip-dot"></span>
										Event day check-in
									</button>
								</div>
							</div>
						{/if}

						<!-- Messages -->
						{#each messages as msg, i (msg.id)}
							{#if msg.role === 'user'}
								<div class="msg-row msg-user flex justify-end" style="animation-delay:{i * 30}ms">
									<div class="msg-bubble-user max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed" style="color:#F4F5F0">
										{msg.content}
									</div>
								</div>
							{:else}
								<div class="msg-row msg-assistant flex items-start gap-2.5" style="animation-delay:{i * 30}ms">
									<div class="shrink-0 mt-0.5">
										<div class="w-6 h-6 rounded-lg vee-icon-small flex items-center justify-center">
											<Sparkles class="w-3 h-3" style="color:#E21D48" />
										</div>
									</div>
									<div class="msg-bubble-assistant max-w-[82%] px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap" style="color:#F4F5F0">
										{#if !msg.content && loading}
											<div class="typing-indicator">
												<span></span>
												<span></span>
												<span></span>
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
					<div class="input-section shrink-0">
						<div class="relative px-4 pt-3 pb-2">
							<div class="input-wrapper rounded-xl transition-all duration-300"
								class:input-focused={message.length > 0}
							>
								<textarea
									bind:this={textareaEl}
									bind:value={message}
									onkeydown={handleKeyDown}
									rows={1}
									disabled={loading}
									class="w-full px-4 py-2.5 bg-transparent border-none outline-none resize-none text-sm font-normal leading-relaxed disabled:opacity-50"
									placeholder="Ask Vee anything..."
									style="scrollbar-width:none;max-height:80px;color:#F4F5F0;"
								></textarea>
								<div class="flex items-center justify-between px-3 pb-2">
									<div class="flex items-center gap-2">
										<span class="text-[10px] font-medium {charColor} transition-colors duration-300">
											{charCount}/{maxChars}
										</span>
									</div>
									<button
										onclick={handleSend}
										disabled={loading || !message.trim() || charCount > maxChars}
										class="send-btn group"
									>
										<Send class="w-4 h-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
									</button>
								</div>
							</div>
						</div>

						<!-- Footer -->
						<div class="flex items-center justify-between px-5 pb-3 pt-1 text-[10px]" style="color:#52524F">
							<div class="flex items-center gap-1.5">
								<kbd class="kbd-key">Enter</kbd>
								<span>send</span>
								<span style="color:#363636" class="mx-0.5">|</span>
								<kbd class="kbd-key">Shift+Enter</kbd>
								<span>new line</span>
							</div>
							<div class="flex items-center gap-1">
								<div class="w-1.5 h-1.5 bg-green-500 rounded-full status-pulse"></div>
								<span>Online</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ===== VEENT BRAND COLORS =====
	 * Dark BG:    #111111, #171717, #252323
	 * Surface:    #252323, #474747
	 * Cream text: #F4F5F0
	 * Muted text: #858582
	 * Red accent: #E21D48 / #D90C2A
	 * Border:     #363636
	 */

	/* ===== FLOATING BUTTON — Veent Red ===== */
	.floating-ai-button {
		background: linear-gradient(135deg, #E21D48 0%, #D90C2A 50%, #B80A23 100%);
		border: 1.5px solid rgba(255,255,255,0.12);
		box-shadow:
			0 0 20px rgba(226,29,72,0.4),
			0 0 40px rgba(217,12,42,0.2),
			inset 0 1px 0 rgba(255,255,255,0.15);
		transition: box-shadow 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.floating-ai-button:hover:not(.btn-dragging) {
		box-shadow:
			0 0 25px rgba(226,29,72,0.6),
			0 0 50px rgba(217,12,42,0.4),
			0 0 80px rgba(184,10,35,0.2),
			inset 0 1px 0 rgba(255,255,255,0.2);
		transform: scale(1.08) !important;
	}
	.floating-ai-button:active:not(.btn-dragging) {
		transform: scale(0.95) !important;
	}
	.btn-dragging {
		box-shadow:
			0 0 30px rgba(226,29,72,0.7),
			0 0 60px rgba(217,12,42,0.4) !important;
		transform: scale(1.12) !important;
	}
	.btn-inner {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.btn-glow-ring {
		position: absolute;
		inset: -3px;
		border-radius: 50%;
		background: conic-gradient(from 0deg, #E21D48, #D90C2A, #B80A23, #E21D48);
		opacity: 0.25;
		animation: glow-spin 4s linear infinite;
		filter: blur(6px);
	}
	.btn-open .btn-glow-ring { opacity: 0.4; }

	@keyframes glow-spin {
		to { transform: rotate(360deg); }
	}

	.icon-flip {
		transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.icon-flipped { transform: rotate(180deg); }

	.btn-ping {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: rgba(226,29,72,0.35);
		animation: soft-ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
	}
	@keyframes soft-ping {
		0% { transform: scale(1); opacity: 0.35; }
		75%, 100% { transform: scale(1.6); opacity: 0; }
	}

	/* ===== CHAT CONTAINER ===== */
	.chat-container {
		animation: chat-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
	}
	@keyframes chat-enter {
		0% { opacity: 0; transform: scale(0.9) translateY(12px); filter: blur(4px); }
		100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
	}

	.chat-border-glow {
		position: relative;
		border-radius: 1rem;
		padding: 1px;
		background: linear-gradient(135deg, rgba(226,29,72,0.2), rgba(54,54,54,0.4), rgba(226,29,72,0.15));
	}

	.chat-panel {
		background: linear-gradient(180deg, #171717 0%, #111111 100%);
		backdrop-filter: blur(40px) saturate(1.5);
		border-radius: calc(1rem - 1px);
	}

	/* ===== HEADER ===== */
	.chat-header {
		background: linear-gradient(180deg, rgba(37,35,35,0.5) 0%, transparent 100%);
		border-bottom: 1px solid rgba(54,54,54,0.5);
	}

	.vee-avatar {
		background: linear-gradient(135deg, #E21D48, #D90C2A);
		box-shadow: 0 2px 10px rgba(226,29,72,0.3);
	}

	.status-dot {
		background: #4ade80;
		border-color: #171717;
	}

	.hover-surface:hover {
		background: rgba(71,71,71,0.4);
	}

	.tag-badge {
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 600;
		border-radius: 6px;
		letter-spacing: 0.02em;
	}
	.tag-organizer {
		background: rgba(226,29,72,0.08);
		color: #F87171;
		border: 1px solid rgba(226,29,72,0.15);
	}
	.tag-live {
		background: rgba(34,197,94,0.08);
		color: #86efac;
		border: 1px solid rgba(34,197,94,0.12);
	}

	.status-pulse {
		animation: status-glow 2s ease-in-out infinite;
	}
	@keyframes status-glow {
		0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.4); }
		50% { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
	}

	/* ===== WELCOME ===== */
	.welcome-container { animation: welcome-fade 0.5s ease-out 0.2s both; }
	.welcome-avatar { animation: welcome-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both; }
	.welcome-text { animation: welcome-fade 0.5s ease-out 0.5s both; }
	.welcome-prompts { animation: welcome-fade 0.5s ease-out 0.7s both; }

	@keyframes welcome-fade {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes welcome-bounce {
		from { opacity: 0; transform: scale(0.5) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.vee-avatar-welcome {
		background: rgba(226,29,72,0.1);
		border: 1px solid rgba(226,29,72,0.15);
	}

	.prompt-chip {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-size: 12px;
		color: #858582;
		background: rgba(37,35,35,0.6);
		border: 1px solid rgba(54,54,54,0.5);
		border-radius: 20px;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.prompt-chip:hover {
		background: rgba(226,29,72,0.08);
		border-color: rgba(226,29,72,0.25);
		color: #F4F5F0;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(226,29,72,0.12);
	}
	.prompt-chip:active { transform: scale(0.97) translateY(0); }
	.prompt-chip-dot {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #E21D48;
		opacity: 0.5;
	}
	.prompt-chip:hover .prompt-chip-dot { opacity: 1; }

	/* ===== MESSAGES ===== */
	.msg-row { animation: msg-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
	.msg-user { animation-name: msg-slide-right; }
	.msg-assistant { animation-name: msg-slide-left; }

	@keyframes msg-slide-right {
		from { opacity: 0; transform: translateX(16px) scale(0.97); }
		to { opacity: 1; transform: translateX(0) scale(1); }
	}
	@keyframes msg-slide-left {
		from { opacity: 0; transform: translateX(-16px) scale(0.97); }
		to { opacity: 1; transform: translateX(0) scale(1); }
	}

	.msg-bubble-user {
		background: linear-gradient(135deg, #D90C2A 0%, #B80A23 100%);
		box-shadow: 0 2px 12px rgba(217,12,42,0.25);
		transition: box-shadow 0.2s;
	}
	.msg-bubble-user:hover {
		box-shadow: 0 4px 20px rgba(217,12,42,0.35);
	}

	.vee-icon-small {
		background: rgba(226,29,72,0.1);
		border: 1px solid rgba(226,29,72,0.12);
	}

	.msg-bubble-assistant {
		background: rgba(37,35,35,0.6);
		border: 1px solid rgba(54,54,54,0.4);
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.msg-bubble-assistant:hover {
		border-color: rgba(71,71,71,0.5);
		box-shadow: 0 2px 12px rgba(0,0,0,0.3);
	}

	/* ===== TYPING INDICATOR ===== */
	.typing-indicator {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 2px;
	}
	.typing-indicator span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #E21D48;
		opacity: 0.3;
		animation: typing-bounce 1.4s ease-in-out infinite;
	}
	.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
	.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }

	@keyframes typing-bounce {
		0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
		30% { transform: translateY(-6px); opacity: 0.8; }
	}

	/* ===== INPUT ===== */
	.input-section {
		background: linear-gradient(0deg, rgba(17,17,17,0.9) 0%, transparent 100%);
		border-top: 1px solid rgba(54,54,54,0.3);
	}

	.input-wrapper {
		background: rgba(37,35,35,0.5);
		border: 1px solid rgba(54,54,54,0.4);
		transition: all 0.3s ease;
	}
	.input-wrapper:focus-within,
	.input-focused {
		border-color: rgba(226,29,72,0.3);
		background: rgba(37,35,35,0.7);
		box-shadow: 0 0 0 3px rgba(226,29,72,0.06), 0 2px 12px rgba(226,29,72,0.08);
	}

	.input-wrapper textarea::placeholder {
		color: #52524F;
	}

	.send-btn {
		padding: 8px;
		background: linear-gradient(135deg, #E21D48, #D90C2A);
		border: none;
		border-radius: 10px;
		color: white;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 2px 8px rgba(226,29,72,0.25);
	}
	.send-btn:hover:not(:disabled) {
		transform: scale(1.1);
		box-shadow: 0 4px 16px rgba(226,29,72,0.4);
	}
	.send-btn:active:not(:disabled) { transform: scale(0.93); }
	.send-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
		transform: none;
	}

	.kbd-key {
		padding: 1px 4px;
		background: rgba(37,35,35,0.8);
		border: 1px solid rgba(54,54,54,0.5);
		border-radius: 3px;
		color: #858582;
		font-family: monospace;
		font-size: 9px;
	}

	/* ===== SCROLLBAR ===== */
	.scrollbar-thin {
		scrollbar-width: thin;
		scrollbar-color: rgba(71,71,71,0.3) transparent;
		scroll-behavior: smooth;
	}
	.scrollbar-thin::-webkit-scrollbar { width: 4px; }
	.scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
	.scrollbar-thin::-webkit-scrollbar-thumb {
		background-color: rgba(71,71,71,0.3);
		border-radius: 20px;
	}
	.scrollbar-thin::-webkit-scrollbar-thumb:hover {
		background-color: rgba(71,71,71,0.5);
	}
</style>
