<script lang="ts">
	import '../app.css';
	import FloatingAiAssistant from '$lib/components/ui/FloatingAiAssistant.svelte';
</script>

<svelte:head>
	<title>Veent Tix Support Bot</title>
</svelte:head>

<!-- Demo page background simulating the Veent website -->
<div class="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
	<!-- Hero section -->
	<nav class="flex items-center justify-between px-8 py-4 border-b border-zinc-800/50">
		<div class="flex items-center gap-2">
			<div class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">VEENT</div>
			<div class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">TIX</div>
		</div>
		<div class="flex items-center gap-6 text-sm text-zinc-400">
			<a href="https://veent.io/discover" target="_blank" class="hover:text-white transition-colors">Explore Events</a>
			<a href="https://veent.io/contacts" target="_blank" class="hover:text-white transition-colors">Contacts</a>
			<a href="https://v2.veent.io/sign-in" target="_blank" class="px-4 py-2 bg-zinc-800 text-white text-xs font-medium rounded-lg hover:bg-zinc-700 transition-colors">LOGIN</a>
		</div>
	</nav>

	<div class="max-w-4xl mx-auto px-8 py-20">
		<h1 class="text-5xl font-bold leading-tight mb-6">
			Where Great Events<br />Begin.
		</h1>
		<p class="text-lg text-zinc-400 max-w-lg mb-10 leading-relaxed">
			Whether you're hosting concerts, conferences, or local gatherings,
			Veent Tix handles your tickets, attendees, and check-in process —
			so you can focus on delivering the experience.
		</p>
		<div class="flex items-center gap-4">
			<a href="https://veent.io/discover" target="_blank" class="px-6 py-3 bg-zinc-800 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors">
				Book Your Ticket
			</a>
			<a href="https://v2.veent.io/sign-in" target="_blank" class="px-6 py-3 text-zinc-300 text-sm font-medium hover:text-white transition-colors">
				Create Event →
			</a>
		</div>

		<!-- Event cards preview -->
		<div class="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each [
				{ name: 'Lani Misalucha Live in CDO', date: 'Apr 18, 2026' },
				{ name: 'TJ Monterde & KZ Tandingan', date: 'Jul 11, 2026' },
				{ name: 'Dahilayan Mountain Trail Ultra', date: 'May 2, 2026' },
			] as event}
				<div class="rounded-xl bg-zinc-900/60 border border-zinc-800/50 p-4 hover:border-zinc-700/50 transition-colors">
					<div class="w-full h-32 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 mb-3 flex items-center justify-center">
						<span class="text-3xl">🎵</span>
					</div>
					<h3 class="text-sm font-semibold text-zinc-200 truncate">{event.name}</h3>
					<p class="text-xs text-zinc-500 mt-1">{event.date}</p>
				</div>
			{/each}
		</div>
	</div>
</div>

<!-- Floating AI Chat Assistant Widget -->
<FloatingAiAssistant />
