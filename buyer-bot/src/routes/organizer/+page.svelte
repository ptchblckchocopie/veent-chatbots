<script lang="ts">
	import '../../app.css';
	import { onMount } from 'svelte';

	onMount(() => {
		// Configure Dify chatbot for organizer bot
		// TODO: Replace with the organizer bot's Dify embed token
		(window as any).difyChatbotConfig = {
			token: 'ORGANIZER_BOT_TOKEN_HERE'
		};

		const script = document.createElement('script');
		script.src = 'https://udify.app/embed.min.js';
		script.id = 'organizer-dify-embed';
		script.defer = true;
		document.body.appendChild(script);
	});
</script>

<svelte:head>
	<title>Veent Dashboard — Organizer Assistant</title>
	<style>
		#dify-chatbot-bubble-button {
			background-color: #0d9488 !important;
		}
		#dify-chatbot-bubble-window {
			width: 24rem !important;
			height: 40rem !important;
		}
	</style>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
	<!-- Navigation -->
	<nav class="flex items-center justify-between px-8 py-4 border-b border-zinc-800/50">
		<div class="flex items-center gap-3">
			<a href="/" class="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors text-sm">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
				Back
			</a>
			<div class="w-px h-5 bg-zinc-700"></div>
			<div class="flex items-center gap-1">
				<div class="bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded">VEENT</div>
				<div class="bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded">DASHBOARD</div>
			</div>
		</div>
		<div class="flex items-center gap-6 text-sm text-zinc-400">
			<a href="https://dashboard.veent.io" target="_blank" class="hover:text-white transition-colors">Open Dashboard</a>
			<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Support</a>
		</div>
	</nav>

	<!-- Hero -->
	<div class="max-w-6xl mx-auto px-8 py-16 lg:py-24">
		<div class="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
			<!-- Left: Text -->
			<div class="flex-1">
				<h1 class="text-5xl lg:text-6xl font-bold leading-tight mb-6">
					Manage Your Events<br />with Confidence.
				</h1>
				<p class="text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed">
					Get instant help with event creation, ticket management, check-in setup,
					and everything in the Veent Dashboard. Your AI assistant for organizer operations.
				</p>
				<div class="flex items-center gap-4">
					<a href="https://dashboard.veent.io" target="_blank" class="px-6 py-3 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors">
						Open Dashboard <span class="ml-1">&#x2197;</span>
					</a>
					<a href="https://veent.io/contacts" target="_blank" class="px-6 py-3 text-zinc-300 text-sm font-medium hover:text-white transition-colors">
						Contact Support →
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
								dashboard.veent.io
							</div>
						</div>
					</div>
					<!-- Dashboard content -->
					<div class="p-5 space-y-4">
						<div class="flex items-center gap-3">
							<div class="flex items-center gap-1">
								<div class="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">VEENT</div>
								<div class="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">DASHBOARD</div>
							</div>
							<span class="text-[10px] text-zinc-500">Analytics</span>
							<span class="text-[10px] text-zinc-500">Events</span>
						</div>
						<!-- Stats row -->
						<div class="grid grid-cols-4 gap-2">
							{#each [
								{ label: 'Gross Sales', value: '₱1.2M' },
								{ label: 'Net Revenue', value: '₱980K' },
								{ label: 'Checked-In', value: '3,136' },
								{ label: 'Registrants', value: '3,200' },
							] as stat}
								<div class="p-2.5 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
									<p class="text-[10px] text-zinc-500">{stat.label}</p>
									<p class="text-xs font-bold text-zinc-200 mt-1">{stat.value}</p>
								</div>
							{/each}
						</div>
						<!-- Chart area -->
						<div class="grid grid-cols-2 gap-2">
							<!-- Pie chart mock -->
							<div class="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/20">
								<p class="text-[10px] text-zinc-500 mb-2">Ticket Distribution</p>
								<div class="w-16 h-16 mx-auto rounded-full border-4 border-teal-500 border-t-pink-500 border-r-yellow-500"></div>
							</div>
							<!-- Line chart mock -->
							<div class="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/20">
								<p class="text-[10px] text-zinc-500 mb-2">Revenue Trend</p>
								<div class="h-12 flex items-end justify-around gap-0.5">
									{#each [30, 45, 35, 60, 50, 75, 55, 70, 80, 65] as h}
										<div class="w-full bg-teal-600/40 rounded-sm" style="height: {h}%"></div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Feature cards -->
		<div class="mt-24">
			<h2 class="text-2xl font-bold mb-6">Organizer Tools</h2>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each [
					{ name: 'Event Creation', desc: 'Set up events, tickets, and registration forms', icon: '🎪' },
					{ name: 'Ticket Management', desc: 'Pricing, packages, vouchers, and stock control', icon: '🎫' },
					{ name: 'Check-in & Scanning', desc: 'QR scanning, areas, offline mode, and staff roles', icon: '📱' },
					{ name: 'Real-Time Analytics', desc: 'Sales, revenue, and attendance dashboards', icon: '📊' },
					{ name: 'Promotions', desc: 'Discount codes, early bird pricing, and bundles', icon: '🏷️' },
					{ name: 'Email & Comms', desc: 'Send updates and reminders to attendees', icon: '✉️' },
				] as feature}
					<div class="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-5 hover:border-teal-700/50 transition-colors">
						<span class="text-2xl">{feature.icon}</span>
						<h3 class="text-sm font-semibold text-zinc-200 mt-3">{feature.name}</h3>
						<p class="text-xs text-zinc-500 mt-1">{feature.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Footer -->
	<footer class="border-t border-zinc-800/50 mt-12 px-8 py-8">
		<div class="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<div class="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">VEENT</div>
				<div class="bg-teal-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">DASHBOARD</div>
				<span class="text-xs text-zinc-600 ml-2">&copy; 2025 Veent Tix. All rights reserved.</span>
			</div>
			<div class="flex items-center gap-4 text-xs text-zinc-500">
				<a href="/" class="hover:text-white transition-colors">Back to Home</a>
				<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Support</a>
				<a href="mailto:hello@veent.io" class="hover:text-white transition-colors">hello@veent.io</a>
			</div>
		</div>
	</footer>
</div>
