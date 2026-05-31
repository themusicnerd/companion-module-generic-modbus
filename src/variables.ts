import type { ModuleInstance } from './main.js'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const variables = [
		{ variableId: 'connected', name: 'Connected flag (true/false)' },
		{ variableId: 'connection_status', name: 'Connection status text' },
		{ variableId: 'relay_bitmap', name: 'Coil (relay) states as bitmap' },
		{ variableId: 'relays_on_count', name: 'Number of coils (relays) currently on' },
		{ variableId: 'input_bitmap', name: 'Input states as bitmap' },
		{ variableId: 'inputs_active_count', name: 'Number of active digital inputs' },
		{ variableId: 'input_register_bitmap', name: 'Input register values as comma-separated list' },
		{ variableId: 'holding_register_bitmap', name: 'Holding register values as comma-separated list' },
		{ variableId: 'last_error', name: 'Last connection or protocol error' },
		{ variableId: 'last_poll', name: 'Last successful coil (relay) poll timestamp' },
		{ variableId: 'last_input_poll', name: 'Last successful input poll timestamp' },
		{ variableId: 'last_register_poll', name: 'Last successful input/holding register poll timestamp' },
	]

	for (let channel = 1; channel <= self.getRelayCount(); channel++) {
		variables.push({
			variableId: `relay_${channel}`,
			name: `Coil (Relay) ${channel} state text`,
		})
	}

	for (let channel = 1; channel <= self.getInputCount(); channel++) {
		variables.push({
			variableId: `input_${channel}`,
			name: `Input ${channel} state text`,
		})
		variables.push({
			variableId: `input${channel}_status`,
			name: `Input ${channel} boolean state`,
		})
	}

	for (let channel = 1; channel <= self.getInputRegisterCount(); channel++) {
		variables.push({
			variableId: `input_register_${channel}`,
			name: `Input register ${channel} value`,
		})
	}

	for (let channel = 1; channel <= self.getHoldingRegisterCount(); channel++) {
		variables.push({
			variableId: `holding_register_${channel}`,
			name: `Holding register ${channel} value`,
		})
	}

	self.setVariableDefinitions(variables)
}
