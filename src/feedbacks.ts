import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const relayChoices = Array.from({ length: self.getRelayCount() }, (_, index) => ({
		id: index + 1,
		label: `Relay ${index + 1}`,
	}))
	const inputChoices = Array.from({ length: self.getInputCount() }, (_, index) => ({
		id: index + 1,
		label: `Input ${index + 1}`,
	}))

	self.setFeedbackDefinitions({
		connected: {
			name: 'Connected to Modbus device',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 128, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: () => self.isConnected,
		},
		relay_state: {
			name: 'Relay is on',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 160, 80),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Relay',
					default: 1,
					choices: relayChoices,
				},
			],
			callback: (feedback) => self.getRelayState(Number(feedback.options.channel)),
		},
		input_state: {
			name: 'Digital input is active',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(180, 90, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Input',
					default: 1,
					choices: inputChoices,
				},
			],
			callback: (feedback) => self.getInputState(Number(feedback.options.channel)),
		},
	})
}
