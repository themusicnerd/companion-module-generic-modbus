import { combineRgb, type CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

	for (let channel = 1; channel <= self.getRelayCount(); channel++) {
		presets[`relay_toggle_${channel}`] = {
			type: 'button',
			category: 'Relays',
			name: `Toggle relay ${channel}`,
			style: {
				text: `Relay ${channel}`,
				size: '14',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(32, 32, 32),
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_relay',
							options: {
								channel,
								action: 'toggle',
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'relay_state',
					options: {
						channel,
					},
					style: {
						bgcolor: combineRgb(0, 160, 80),
						color: combineRgb(255, 255, 255),
					},
				},
			],
		}
	}

	presets['all_on'] = {
		type: 'button',
		category: 'Relays',
		name: 'All relays on',
		style: {
			text: 'All On',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 80, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_all_relays',
						options: {
							action: 'on',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['all_off'] = {
		type: 'button',
		category: 'Relays',
		name: 'All relays off',
		style: {
			text: 'All Off',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(96, 0, 0),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_all_relays',
						options: {
							action: 'off',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['poll_now'] = {
		type: 'button',
		category: 'Utility',
		name: 'Poll now',
		style: {
			text: 'Poll',
			size: '14',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 96),
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'poll_now',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'connected',
				options: {},
				style: {
					bgcolor: combineRgb(0, 128, 0),
					color: combineRgb(255, 255, 255),
				},
			},
		],
	}

	self.setPresetDefinitions(presets)
}
