import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance, RelayAction } from './main.js'

const actionChoices = [
	{ id: 'on', label: 'On' },
	{ id: 'off', label: 'Off' },
	{ id: 'toggle', label: 'Toggle' },
] as const

export function UpdateActions(self: ModuleInstance): void {
	const relayChoices = Array.from({ length: self.getRelayCount() }, (_, index) => ({
		id: index + 1,
		label: `Relay ${index + 1}`,
	}))

	const actions: CompanionActionDefinitions = {
		set_relay: {
			name: 'Set relay state',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Relay',
					default: 1,
					choices: relayChoices,
				},
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					default: 'toggle',
					choices: [...actionChoices],
				},
			],
			callback: async (event) => {
				await self.executeRelayAction(Number(event.options.channel), String(event.options.action) as RelayAction)
			},
		},
		set_all_relays: {
			name: 'Set all relays',
			options: [
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					default: 'toggle',
					choices: [...actionChoices],
				},
			],
			callback: async (event) => {
				await self.executeAllRelaysAction(String(event.options.action) as RelayAction)
			},
		},
		pulse_relay: {
			name: 'Pulse relay',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Relay',
					default: 1,
					choices: relayChoices,
				},
				{
					id: 'duration',
					type: 'number',
					label: 'Pulse duration (ms)',
					default: self.config.defaultPulseMs || 500,
					min: 50,
					max: 60000,
				},
			],
			callback: async (event) => {
				await self.pulseRelay(Number(event.options.channel), Number(event.options.duration))
			},
		},
		poll_now: {
			name: 'Poll relay and input state now',
			options: [],
			callback: async () => {
				await self.forcePoll()
			},
		},
	}

	self.setActionDefinitions(actions)
}
