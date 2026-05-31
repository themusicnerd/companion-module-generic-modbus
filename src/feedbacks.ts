import { combineRgb, type CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

const comparatorChoices = [
	{ id: 'eq', label: '=' },
	{ id: 'ne', label: '!=' },
	{ id: 'gt', label: '>' },
	{ id: 'gte', label: '>=' },
	{ id: 'lt', label: '<' },
	{ id: 'lte', label: '<=' },
] as const

function compareValue(actual: number | undefined, comparator: string, expected: number): boolean {
	if (actual === undefined) return false

	switch (comparator) {
		case 'eq':
			return actual === expected
		case 'ne':
			return actual !== expected
		case 'gt':
			return actual > expected
		case 'gte':
			return actual >= expected
		case 'lt':
			return actual < expected
		case 'lte':
			return actual <= expected
		default:
			return false
	}
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	const relayChoices = Array.from({ length: self.getRelayCount() }, (_, index) => ({
		id: index + 1,
		label: `Coil (Relay) ${index + 1}`,
	}))
	const inputChoices = Array.from({ length: self.getInputCount() }, (_, index) => ({
		id: index + 1,
		label: `Input ${index + 1}`,
	}))
	const inputRegisterChoices = Array.from({ length: self.getInputRegisterCount() }, (_, index) => ({
		id: index + 1,
		label: `Input register ${index + 1}`,
	}))
	const holdingRegisterChoices = Array.from({ length: self.getHoldingRegisterCount() }, (_, index) => ({
		id: index + 1,
		label: `Holding register ${index + 1}`,
	}))

	const inputFeedbackDefinition = {
		name: 'Digital input is active',
		type: 'boolean' as const,
		defaultStyle: {
			bgcolor: combineRgb(180, 90, 0),
			color: combineRgb(255, 255, 255),
		},
		options: [
			{
				id: 'channel',
				type: 'dropdown' as const,
				label: 'Input',
				default: 1,
				choices: inputChoices,
			},
		],
		callback: (feedback: { options: Record<string, unknown> }) => self.getInputState(Number(feedback.options.channel)),
	}

	const registerFeedbackOptions = (label: string, choices: { id: number; label: string }[]) => [
		{
			id: 'channel',
			type: 'dropdown' as const,
			label,
			default: 1,
			choices,
		},
		{
			id: 'comparator',
			type: 'dropdown' as const,
			label: 'Comparison',
			default: 'eq',
			choices: [...comparatorChoices],
		},
		{
			id: 'value',
			type: 'number' as const,
			label: 'Value',
			default: 0,
			min: 0,
			max: 65535,
		},
	]

	const feedbacks: CompanionFeedbackDefinitions = {
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
			name: 'Coil (relay) is on',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 160, 80),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'channel',
					type: 'dropdown',
					label: 'Coil (Relay)',
					default: 1,
					choices: relayChoices,
				},
			],
			callback: (feedback) => self.getRelayState(Number(feedback.options.channel)),
		},
		input_state: inputFeedbackDefinition,
		InputState: {
			...inputFeedbackDefinition,
			name: 'Input State',
			options: [
				{
					id: 'input_number',
					type: 'number',
					label: 'Input Number',
					default: 1,
					min: 1,
					max: Math.max(1, self.getInputCount()),
				},
			],
			callback: (feedback: { options: Record<string, unknown> }) =>
				self.getInputState(Number(feedback.options.input_number)),
		},
		input_register_value: {
			name: 'Input register matches condition',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(0, 90, 140),
				color: combineRgb(255, 255, 255),
			},
			options: registerFeedbackOptions('Input register', inputRegisterChoices),
			callback: (feedback) =>
				compareValue(
					self.getInputRegisterValue(Number(feedback.options.channel)),
					String(feedback.options.comparator),
					Number(feedback.options.value),
				),
		},
		holding_register_value: {
			name: 'Holding register matches condition',
			type: 'boolean',
			defaultStyle: {
				bgcolor: combineRgb(90, 0, 140),
				color: combineRgb(255, 255, 255),
			},
			options: registerFeedbackOptions('Holding register', holdingRegisterChoices),
			callback: (feedback) =>
				compareValue(
					self.getHoldingRegisterValue(Number(feedback.options.channel)),
					String(feedback.options.comparator),
					Number(feedback.options.value),
				),
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
