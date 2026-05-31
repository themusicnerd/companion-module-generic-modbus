import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance, RelayAction } from './main.js'

const relayActionChoices = [
	{ id: 'on', label: 'On' },
	{ id: 'off', label: 'Off' },
	{ id: 'toggle', label: 'Toggle' },
] as const

export function UpdateActions(self: ModuleInstance): void {
	const relayChoices = Array.from({ length: self.getRelayCount() }, (_, index) => ({
		id: index + 1,
		label: `Coil (Relay) ${index + 1}`,
	}))

	const actions: CompanionActionDefinitions = {
		output_relay: {
			name: 'Set output coil (relay) status',
			options: [
				{
					id: 'output',
					type: 'textinput',
					label: 'Coil (Relay) number',
					default: '1',
					useVariables: true,
				},
				{
					id: 'status',
					type: 'textinput',
					label: 'Status (1 = on, 0 = off)',
					default: '1',
					useVariables: true,
				},
			],
			callback: async (event) => {
				const output = parseInt(await self.parseVariablesInString(String(event.options.output ?? '')), 10)
				const status = parseInt(await self.parseVariablesInString(String(event.options.status ?? '')), 10)

				if (!Number.isNaN(output) && !Number.isNaN(status)) {
					await self.executeRelayAction(output, status === 1 ? 'on' : 'off')
				}
			},
		},
		set_relay: {
			name: 'Set coil (relay) state',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Coil (Relay)',
					default: 1,
					choices: relayChoices,
				},
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					default: 'toggle',
					choices: [...relayActionChoices],
				},
			],
			callback: async (event) => {
				await self.executeRelayAction(Number(event.options.channel), String(event.options.action) as RelayAction)
			},
		},
		set_all_relays: {
			name: 'Set all coils (relays)',
			options: [
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					default: 'toggle',
					choices: [...relayActionChoices],
				},
			],
			callback: async (event) => {
				await self.executeAllRelaysAction(String(event.options.action) as RelayAction)
			},
		},
		pulse_relay: {
			name: 'Pulse coil (relay)',
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Coil (Relay)',
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
			name: 'Poll coil/input/register state now',
			options: [],
			callback: async () => {
				await self.forcePoll()
			},
		},
	}

	self.setActionDefinitions(actions)
}
