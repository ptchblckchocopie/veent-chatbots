<script lang="ts">
	import '../app.css';
	import FloatingAiAssistant from '$lib/components/ui/FloatingAiAssistant.svelte';
</script>

<svelte:head>
	<title>Veent Dashboard Assistant</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
	<!-- Nav -->
	<nav class="flex items-center justify-between px-8 py-4 border-b border-zinc-800/50">
		<div class="flex items-center gap-2">
			<div class="bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded">VEENT</div>
			<div class="bg-teal-600 text-white text-xs font-bold px-2 py-1 rounded">DASHBOARD</div>
		</div>
		<div class="flex items-center gap-6 text-sm text-zinc-400">
			<a href="https://dashboard.veent.io" target="_blank" class="hover:text-white transition-colors">Open Dashboard</a>
			<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Support</a>
			<a href="https://dashboard.veent.io" target="_blank" class="px-4 py-2 bg-teal-700 text-white text-xs font-medium rounded-lg hover:bg-teal-600 transition-colors">SIGN IN</a>
		</div>
	</nav>

	<div class="max-w-4xl mx-auto px-8 py-20">
		<h1 class="text-5xl font-bold leading-tight mb-6">
			Manage Your Events<br />with Confidence.
		</h1>
		<p class="text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed">
			Get instant help with event creation, ticket management, check-in setup,
			and everything in the Veent Dashboard. Your AI assistant for organizer operations.
		</p>
		<div class="flex items-center gap-4">
			<a href="https://dashboard.veent.io" target="_blank" class="px-6 py-3 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-600 transition-colors">
				Open Dashboard
			</a>
			<a href="https://veent.io/contacts" target="_blank" class="px-6 py-3 text-zinc-300 text-sm font-medium hover:text-white transition-colors">
				Contact Support →
			</a>
		</div>

		<!-- Feature cards -->
		<div class="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each [
				{ name: 'Event Creation', desc: 'Set up events, tickets, and registration forms', icon: '🎪' },
				{ name: 'Ticket Management', desc: 'Pricing, packages, vouchers, and stock control', icon: '🎫' },
				{ name: 'Check-in & Scanning', desc: 'QR scanning, areas, offline mode, and staff roles', icon: '📱' },
			] as feature}
				<div class="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-4 hover:border-teal-700/50 transition-colors">
					<div class="w-full h-32 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 mb-3 flex items-center justify-center">
						<span class="text-3xl">{feature.icon}</span>
					</div>
					<h3 class="text-sm font-semibold text-zinc-200">{feature.name}</h3>
					<p class="text-xs text-zinc-500 mt-1">{feature.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</div>

<FloatingAiAssistant />
