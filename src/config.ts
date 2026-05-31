import type { SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	unitId: number
	relayStartAddress: number
	relayCount: number
	hasDigitalInputs: boolean
	inputStartAddress: number
	inputCount: number
	hasInputRegisters: boolean
	inputRegisterStartAddress: number
	inputRegisterCount: number
	hasHoldingRegisters: boolean
	holdingRegisterStartAddress: number
	holdingRegisterCount: number
	pollInterval: number
	inputPollInterval: number
	registerPollInterval: number
	connectTimeout: number
	defaultPulseMs: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'connection_section',
			width: 12,
			label: 'Connection',
			value: 'Modbus TCP connection settings',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP / hostname',
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
			type: 'static-text',
			id: 'coil_section',
			width: 12,
			label: 'Coils (Relays)',
			value: 'Use these settings for coil-backed outputs such as relay boards.',
		},
		{
			type: 'number',
			id: 'relayStartAddress',
			label: 'Coil (Relay) start address',
			width: 4,
			min: 0,
			max: 65535,
			default: 0,
		},
		{
			type: 'number',
			id: 'relayCount',
			label: 'Coil (Relay) count',
			width: 4,
			min: 1,
			max: 64,
			default: 8,
		},
		{
			type: 'static-text',
			id: 'digital_input_section',
			width: 12,
			label: 'Digital Inputs',
			value: 'Enable if the device exposes discrete inputs.',
		},
		{
			type: 'checkbox',
			id: 'hasDigitalInputs',
			label: 'Enable digital input polling',
			width: 4,
			default: true,
		},
		{
			type: 'number',
			id: 'inputStartAddress',
			label: 'Digital input start address',
			width: 4,
			min: 0,
			max: 65535,
			default: 0,
			isVisible: (options) =>
				options.hasDigitalInputs === true ||
				options.hasDigitalInputs === 1 ||
				options.hasDigitalInputs === '1' ||
				options.hasDigitalInputs === 'true',
		},
		{
			type: 'number',
			id: 'inputCount',
			label: 'Digital input count',
			width: 4,
			min: 0,
			max: 64,
			default: 8,
			isVisible: (options) =>
				options.hasDigitalInputs === true ||
				options.hasDigitalInputs === 1 ||
				options.hasDigitalInputs === '1' ||
				options.hasDigitalInputs === 'true',
		},
		{
			type: 'static-text',
			id: 'input_register_section',
			width: 12,
			label: 'Input Registers',
			value: 'Enable if the device exposes readable input registers (function code 0x04).',
		},
		{
			type: 'checkbox',
			id: 'hasInputRegisters',
			label: 'Enable input register polling',
			width: 4,
			default: false,
		},
		{
			type: 'number',
			id: 'inputRegisterStartAddress',
			label: 'Input register start address',
			width: 4,
			min: 0,
			max: 65535,
			default: 0,
			isVisible: (options) =>
				options.hasInputRegisters === true ||
				options.hasInputRegisters === 1 ||
				options.hasInputRegisters === '1' ||
				options.hasInputRegisters === 'true',
		},
		{
			type: 'number',
			id: 'inputRegisterCount',
			label: 'Input register count',
			width: 4,
			min: 0,
			max: 64,
			default: 0,
			isVisible: (options) =>
				options.hasInputRegisters === true ||
				options.hasInputRegisters === 1 ||
				options.hasInputRegisters === '1' ||
				options.hasInputRegisters === 'true',
		},
		{
			type: 'static-text',
			id: 'holding_register_section',
			width: 12,
			label: 'Holding Registers',
			value: 'Enable if the device exposes readable holding registers (function code 0x03).',
		},
		{
			type: 'checkbox',
			id: 'hasHoldingRegisters',
			label: 'Enable holding register polling',
			width: 4,
			default: false,
		},
		{
			type: 'number',
			id: 'holdingRegisterStartAddress',
			label: 'Holding register start address',
			width: 4,
			min: 0,
			max: 65535,
			default: 0,
			isVisible: (options) =>
				options.hasHoldingRegisters === true ||
				options.hasHoldingRegisters === 1 ||
				options.hasHoldingRegisters === '1' ||
				options.hasHoldingRegisters === 'true',
		},
		{
			type: 'number',
			id: 'holdingRegisterCount',
			label: 'Holding register count',
			width: 4,
			min: 0,
			max: 64,
			default: 0,
			isVisible: (options) =>
				options.hasHoldingRegisters === true ||
				options.hasHoldingRegisters === 1 ||
				options.hasHoldingRegisters === '1' ||
				options.hasHoldingRegisters === 'true',
		},
		{
			type: 'static-text',
			id: 'polling_section',
			width: 12,
			label: 'Polling',
			value: 'Polling rates and timeout settings for enabled sections.',
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Coil (Relay) poll interval (ms)',
			width: 4,
			min: 100,
			max: 10000,
			default: 500,
		},
		{
			type: 'number',
			id: 'inputPollInterval',
			label: 'Digital input poll interval (ms)',
			width: 4,
			min: 100,
			max: 10000,
			default: 250,
			isVisible: (options) =>
				options.hasDigitalInputs === true ||
				options.hasDigitalInputs === 1 ||
				options.hasDigitalInputs === '1' ||
				options.hasDigitalInputs === 'true',
		},
		{
			type: 'number',
			id: 'registerPollInterval',
			label: 'Register poll interval (ms)',
			width: 4,
			min: 100,
			max: 10000,
			default: 500,
			isVisible: (options) =>
				options.hasInputRegisters === true ||
				options.hasInputRegisters === 1 ||
				options.hasInputRegisters === '1' ||
				options.hasInputRegisters === 'true' ||
				options.hasHoldingRegisters === true ||
				options.hasHoldingRegisters === 1 ||
				options.hasHoldingRegisters === '1' ||
				options.hasHoldingRegisters === 'true',
		},
		{
			type: 'number',
			id: 'connectTimeout',
			label: 'Socket timeout (ms)',
			width: 4,
			min: 100,
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
