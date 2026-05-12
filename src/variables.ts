import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const variables = [
		{ variableId: 'connected', name: 'Connected flag (true/false)' },
		{ variableId: 'connection_status', name: 'Connection status text' },
		{ variableId: 'relay_bitmap', name: 'Relay states as bitmap' },
		{ variableId: 'relays_on_count', name: 'Number of relays currently on' },
		{ variableId: 'input_bitmap', name: 'Input states as bitmap' },
		{ variableId: 'inputs_active_count', name: 'Number of active digital inputs' },
		{ variableId: 'last_error', name: 'Last connection or protocol error' },
		{ variableId: 'last_poll', name: 'Last successful relay poll timestamp' },
		{ variableId: 'last_input_poll', name: 'Last successful input poll timestamp' },
	]

	for (let channel = 1; channel <= self.getRelayCount(); channel++) {
		variables.push({
			variableId: `relay_${channel}`,
			name: `Relay ${channel} state text`,
		})
	}
	for (let channel = 1; channel <= self.getInputCount(); channel++) {
		variables.push({
			variableId: `input_${channel}`,
			name: `Input ${channel} state text`,
		})
	}

	self.setVariableDefinitions(variables)
}
