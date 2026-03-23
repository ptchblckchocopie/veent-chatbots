<script lang="ts">
	import '../app.css';
</script>

<svelte:head>
	<title>Veent Tix — Where Great Events Begin</title>
	<style>
		/* ── Bubble Button: fixed + animated ── */
		#dify-chatbot-bubble-button {
			position: fixed !important;
			z-index: 2147483647 !important;
			background: linear-gradient(135deg, #ef4444, #dc2626) !important;
			width: 60px !important;
			height: 60px !important;
			right: 28px !important;
			bottom: 28px !important;
			border-radius: 50% !important;
			border: none !important;
			cursor: pointer !important;
			box-shadow:
				0 4px 14px rgba(220, 38, 38, 0.45),
				0 0 0 0 rgba(220, 38, 38, 0.3) !important;
			transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
						box-shadow 0.3s ease !important;
			animation: bubbleEntrance 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both,
					   bubblePulse 3s ease-in-out 2s infinite !important;
		}
		#dify-chatbot-bubble-button:hover {
			transform: scale(1.1) !important;
			box-shadow:
				0 6px 20px rgba(220, 38, 38, 0.5),
				0 0 0 0 rgba(220, 38, 38, 0) !important;
		}
		#dify-chatbot-bubble-button:active {
			transform: scale(0.95) !important;
		}
		#dify-chatbot-bubble-button svg {
			width: 28px !important;
			height: 28px !important;
			transition: transform 0.3s ease !important;
		}
		#dify-chatbot-bubble-button:hover svg {
			transform: rotate(15deg) !important;
		}

		/* ── Chat Window: fixed + slide-up ── */
		#dify-chatbot-bubble-window {
			position: fixed !important;
			z-index: 2147483646 !important;
			width: 24rem !important;
			height: 42rem !important;
			max-height: calc(100vh - 120px) !important;
			right: 28px !important;
			bottom: 100px !important;
			border-radius: 16px !important;
			border: 1px solid rgba(255, 255, 255, 0.08) !important;
			box-shadow:
				0 25px 60px rgba(0, 0, 0, 0.5),
				0 10px 20px rgba(0, 0, 0, 0.3) !important;
			animation: windowSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both !important;
			overflow: hidden !important;
		}
		#dify-chatbot-bubble-window iframe {
			border: none !important;
			border-radius: 16px !important;
		}

		/* ── Keyframes ── */
		@keyframes bubbleEntrance {
			0% { transform: scale(0) rotate(-45deg); opacity: 0; }
			60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
			100% { transform: scale(1) rotate(0deg); opacity: 1; }
		}
		@keyframes bubblePulse {
			0%, 100% { box-shadow: 0 4px 14px rgba(220, 38, 38, 0.45), 0 0 0 0 rgba(220, 38, 38, 0.3); }
			50% { box-shadow: 0 4px 14px rgba(220, 38, 38, 0.45), 0 0 0 10px rgba(220, 38, 38, 0); }
		}
		@keyframes windowSlideUp {
			0% { transform: translateY(20px) scale(0.96); opacity: 0; }
			100% { transform: translateY(0) scale(1); opacity: 1; }
		}
	</style>
	{@html `<script>window.difyChatbotConfig = { token: 'wHjfix4x8U53nv9u' };</script>`}
	{@html `<script src="https://udify.app/embed.min.js" id="wHjfix4x8U53nv9u" defer></script>`}
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
	<!-- Navigation -->
	<nav class="flex items-center justify-between px-8 py-4 border-b border-zinc-800/50">
		<div class="flex items-center gap-1">
			<div class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">VEENT</div>
			<div class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">TIX</div>
		</div>
		<div class="flex items-center gap-6 text-sm text-zinc-400">
			<a href="https://veent.io/discover" target="_blank" class="hover:text-white transition-colors">Explore Events</a>
			<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Contacts</a>
			<a href="/organizer" class="flex items-center gap-1 px-4 py-2 bg-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-zinc-700 transition-colors">
				LOGIN <span class="text-base leading-none">&#x2197;</span>
			</a>
		</div>
	</nav>

	<!-- Hero Section -->
	<div class="max-w-6xl mx-auto px-8 py-16 lg:py-24">
		<div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
			<!-- Left: Text -->
			<div class="flex-1">
				<h1 class="text-5xl lg:text-6xl font-bold leading-tight mb-6">
					Where Great Events<br />Begin.
				</h1>
				<p class="text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed">
					Whether you're hosting concerts, conferences, or local gatherings,
					Veent Tix handles your tickets, attendees, and check-in process —
					so you can focus on delivering the experience.
				</p>
				<div class="flex items-center gap-4">
					<a href="https://veent.io/discover" target="_blank" class="px-6 py-3 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
						Book Your Ticket <span class="ml-1">&#x2197;</span>
					</a>
					<a href="https://v2.veent.io/sign-in" target="_blank" class="px-6 py-3 text-zinc-300 text-sm font-medium hover:text-white transition-colors">
						Create Event <span class="ml-1">&#x2197;</span>
					</a>
				</div>
			</div>

			<!-- Right: Dashboard Preview -->
			<div class="flex-1 max-w-xl w-full">
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden shadow-2xl shadow-black/40">
					<!-- Browser chrome -->
					<div class="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/80 border-b border-zinc-700/50">
						<div class="flex gap-1.5">
							<div class="w-3 h-3 rounded-full bg-red-500"></div>
							<div class="w-3 h-3 rounded-full bg-yellow-500"></div>
							<div class="w-3 h-3 rounded-full bg-green-500"></div>
						</div>
						<div class="flex-1 flex items-center justify-center">
							<div class="flex items-center gap-2 bg-zinc-700/60 rounded-md px-3 py-1 text-xs text-zinc-400">
								<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
								veent.io
							</div>
						</div>
					</div>
					<!-- Dashboard content mockup -->
					<div class="p-5 space-y-4">
						<div class="flex items-center gap-3">
							<div class="flex items-center gap-1">
								<div class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">VEENT</div>
								<div class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TIX</div>
							</div>
							<span class="text-[10px] text-zinc-500">Dashboard</span>
							<span class="text-[10px] text-zinc-500">Wallet</span>
						</div>
						<!-- Event card -->
						<div class="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
							<div class="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center text-lg shrink-0">
								🎵
							</div>
							<div class="min-w-0">
								<p class="text-xs font-semibold text-zinc-200 truncate">Lani Misalucha Live in CDO</p>
								<p class="text-[10px] text-zinc-500 mt-0.5">Sat Apr 18, 2026</p>
								<p class="text-[10px] text-zinc-500">Atrium, Limketkai Mall, CDO</p>
							</div>
						</div>
						<!-- Stats row -->
						<div class="grid grid-cols-3 gap-2">
							<div class="p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
								<p class="text-[10px] text-zinc-500">Gross Sales</p>
								<p class="text-sm font-bold text-zinc-200 mt-1">₱1.2M</p>
							</div>
							<div class="p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
								<p class="text-[10px] text-zinc-500">Attendees</p>
								<p class="text-sm font-bold text-zinc-200 mt-1">3,136</p>
							</div>
							<div class="p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
								<p class="text-[10px] text-zinc-500">Registrants</p>
								<p class="text-sm font-bold text-zinc-200 mt-1">3,200</p>
							</div>
						</div>
						<!-- Chart placeholder -->
						<div class="h-20 bg-zinc-800/30 rounded-lg border border-zinc-700/20 flex items-end justify-around px-4 pb-2 gap-1">
							{#each [40, 55, 35, 70, 60, 80, 45, 65, 75, 50] as h}
								<div class="w-full bg-red-600/40 rounded-sm" style="height: {h}%"></div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Recommended Events Section -->
		<div class="mt-24">
			<h2 class="text-2xl font-bold mb-6">Recommended Events</h2>
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
				{#each [
					{ name: 'Lani Misalucha Live in CDO', date: 'Apr 18, 2026', icon: '🎤' },
					{ name: 'TJ Monterde & KZ Tandingan', date: 'Jul 11, 2026', icon: '🎵' },
					{ name: 'Dahilayan Mountain Trail Ultra', date: 'May 2, 2026', icon: '🏔️' },
					{ name: 'USWAG Music Festival', date: 'Apr 18, 2026', icon: '🎶' },
					{ name: 'Bislig Ultra Trail', date: 'Apr 17, 2026', icon: '🏃' },
				] as event}
					<div class="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-3 hover:border-zinc-700/50 transition-colors cursor-pointer group">
						<div class="w-full aspect-[4/3] rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 mb-2.5 flex items-center justify-center group-hover:from-zinc-700 group-hover:to-zinc-800 transition-colors">
							<span class="text-3xl">{event.icon}</span>
						</div>
						<h3 class="text-xs font-semibold text-zinc-200 truncate">{event.name}</h3>
						<p class="text-[10px] text-zinc-500 mt-0.5">{event.date}</p>
					</div>
				{/each}
			</div>
			<div class="mt-4 text-center">
				<a href="https://veent.io/discover" target="_blank" class="text-sm text-zinc-500 hover:text-red-400 transition-colors">Explore for more →</a>
			</div>
		</div>

		<!-- Features Section -->
		<div class="mt-24">
			<h2 class="text-2xl font-bold mb-2">Want to Create your own Events?</h2>
			<p class="text-sm text-zinc-500 mb-8">Everything you need to run successful events, all in one platform.</p>
			<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
				{#each [
					{ name: 'Easy Event Setup', icon: '⚡' },
					{ name: 'Advanced Ticketing', icon: '🎫' },
					{ name: 'Secure Payments', icon: '🔒' },
					{ name: 'Real Time Analytics', icon: '📊' },
					{ name: 'Marketing Tools', icon: '📣' },
				] as feature}
					<div class="rounded-xl bg-zinc-900/40 border border-zinc-800/40 p-4 text-center">
						<span class="text-2xl">{feature.icon}</span>
						<p class="text-xs font-medium text-zinc-300 mt-2">{feature.name}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="border-t border-zinc-800/50 mt-12 px-8 py-8">
		<div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<div class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">VEENT</div>
				<div class="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">TIX</div>
				<span class="text-xs text-zinc-600 ml-2">&copy; 2025 Veent Tix. All rights reserved.</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-zinc-500">
				<a href="https://veent.io/discover" target="_blank" class="hover:text-white transition-colors">Discover</a>
				<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Contact Us</a>
				<a href="mailto:hello@veent.io" class="hover:text-white transition-colors">hello@veent.io</a>
			</div>
		</div>
	</footer>
</div>
