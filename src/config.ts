import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	unitId: number
	relayCount: number
	hasDigitalInputs: boolean
	inputCount: number
	inputPollInterval: number
	pollInterval: number
	connectTimeout: number
	defaultPulseMs: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Modbus IP / hostname',
			width: 8,
			default: '',
			useVariables: true,
		},
		{
			type: 'number',
			id: 'port',
			label: 'Modbus TCP port',
			width: 4,
			min: 1,
			max: 65535,
			default: 502,
		},
		{
			type: 'number',
			id: 'unitId',
			label: 'Modbus unit id',
			width: 4,
			min: 1,
			max: 247,
			default: 1,
		},
		{
			type: 'dropdown',
			id: 'relayCount',
			label: 'Relay count',
			width: 4,
			default: 8,
			choices: [
				{ id: 8, label: '8 relays' },
				{ id: 30, label: '30 relays' },
			],
		},
		{
			type: 'checkbox',
			id: 'hasDigitalInputs',
			label: 'Enable digital input polling',
			width: 4,
			default: false,
		},
		{
			type: 'dropdown',
			id: 'inputCount',
			label: 'Digital input count',
			width: 4,
			default: 8,
			choices: [{ id: 8, label: '8 inputs' }],
			isVisible: (options) => !!options.hasDigitalInputs,
		},
		{
			type: 'number',
			id: 'inputPollInterval',
			label: 'Input poll interval (ms)',
			width: 4,
			min: 100,
			max: 10000,
			default: 250,
			isVisible: (options) => !!options.hasDigitalInputs,
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Relay poll interval (ms)',
			width: 4,
			min: 250,
			max: 10000,
			default: 1000,
		},
		{
			type: 'number',
			id: 'connectTimeout',
			label: 'Socket timeout (ms)',
			width: 4,
			min: 250,
			max: 10000,
			default: 2000,
		},
		{
			type: 'number',
			id: 'defaultPulseMs',
			label: 'Default pulse length (ms)',
			width: 4,
			min: 50,
			max: 60000,
			default: 500,
		},
	]
}
