import { InstanceBase, runEntrypoint, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import net from 'node:net'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'

export type RelayAction = 'on' | 'off' | 'toggle'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig
	relayStates: boolean[] = []
	inputStates: boolean[] = []
	isConnected = false
	lastError = 'Not connected'
	lastPollAt = 'Never'
	lastInputPollAt = 'Never'

	private pollTimer: NodeJS.Timeout | undefined
	private inputPollTimer: NodeJS.Timeout | undefined
	private pollInFlight = false
	private inputPollInFlight = false
	private transactionId = 0

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.resetRelayStateCache()

		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.updateVariables()

		await this.restartPolling()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.resetRelayStateCache()
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.updateVariables()
		await this.restartPolling()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	getRelayState(channel: number): boolean {
		return this.relayStates[channel - 1] ?? false
	}

	getRelayCount(): number {
		const count = Number(this.config.relayCount) || 8
		return Math.max(1, Math.min(30, count))
	}

	getInputState(channel: number): boolean {
		return this.inputStates[channel - 1] ?? false
	}

	hasInputSupport(): boolean {
		return !!this.config.hasDigitalInputs
	}

	getInputCount(): number {
		const count = Number(this.config.inputCount) || 8
		return this.hasInputSupport() ? Math.max(1, Math.min(8, count)) : 0
	}

	async executeRelayAction(channel: number, action: RelayAction): Promise<void> {
		await this.writeSingleCoil(channel - 1, action)
		await this.refreshRelayStates(`relay ${channel} ${action}`)
	}

	async executeAllRelaysAction(action: RelayAction): Promise<void> {
		await this.writeSingleCoil(0x00ff, action)
		await this.refreshRelayStates(`all relays ${action}`)
	}

	async pulseRelay(channel: number, durationMs: number): Promise<void> {
		await this.executeRelayAction(channel, 'on')
		await new Promise((resolve) => setTimeout(resolve, durationMs))
		await this.executeRelayAction(channel, 'off')
	}

	async forcePoll(): Promise<void> {
		await this.refreshRelayStates('manual poll')
		if (this.hasInputSupport()) {
			await this.refreshInputStates('manual poll')
		}
	}

	private async restartPolling(): Promise<void> {
		this.stopPolling()

		if (!this.config.host) {
			this.isConnected = false
			this.lastError = 'Host is not configured'
			this.updateStatus(InstanceStatus.BadConfig, this.lastError)
			this.updateVariables()
			this.checkFeedbacks('connected', 'relay_state')
			return
		}

		await this.refreshRelayStates('startup')
		if (this.hasInputSupport()) {
			await this.refreshInputStates('startup')
		}

		this.pollTimer = setInterval(() => {
			void this.refreshRelayStates('poll')
		}, this.config.pollInterval)
		if (this.hasInputSupport()) {
			this.inputPollTimer = setInterval(() => {
				void this.refreshInputStates('poll')
			}, this.config.inputPollInterval)
		}
	}

	private stopPolling(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
		if (this.inputPollTimer) {
			clearInterval(this.inputPollTimer)
			this.inputPollTimer = undefined
		}
	}

	private async refreshRelayStates(reason: string): Promise<void> {
		if (this.pollInFlight) return
		this.pollInFlight = true

		try {
			const relays = await this.readCoils(0, this.getRelayCount())
			this.relayStates = relays
			this.isConnected = true
			this.lastError = ''
			this.lastPollAt = new Date().toISOString()
			this.updateStatus(InstanceStatus.Ok)
			this.updateVariables()
			this.checkFeedbacks('connected', 'relay_state')
			this.log('debug', `State refresh successful (${reason})`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.isConnected = false
			this.lastError = message
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
			this.updateVariables()
			this.checkFeedbacks('connected', 'relay_state')
			this.log('warn', `State refresh failed (${reason}): ${message}`)
		} finally {
			this.pollInFlight = false
		}
	}

	private async refreshInputStates(reason: string): Promise<void> {
		if (!this.hasInputSupport() || this.inputPollInFlight) return
		this.inputPollInFlight = true

		try {
			const inputs = await this.readDiscreteInputs(0, this.getInputCount())
			const previousStates = [...this.inputStates]
			this.inputStates = inputs
			this.lastInputPollAt = new Date().toISOString()
			this.updateVariables()
			this.checkFeedbacks('input_state')

			for (let i = 0; i < inputs.length; i++) {
				if (inputs[i] !== previousStates[i]) {
					this.log('info', `Input ${i + 1} changed to ${inputs[i] ? 'active' : 'inactive'}`)
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.lastError = message
			this.updateVariables()
			this.log('warn', `Input refresh failed (${reason}): ${message}`)
		} finally {
			this.inputPollInFlight = false
		}
	}

	private updateVariables(): void {
		const values: Record<string, string> = {
			connected: this.isConnected ? 'true' : 'false',
			connection_status: this.isConnected ? 'Connected' : 'Disconnected',
			relay_bitmap: this.relayStates.map((state) => (state ? '1' : '0')).join(''),
			relays_on_count: String(this.relayStates.filter((state) => state).length),
			input_bitmap: this.inputStates.map((state) => (state ? '1' : '0')).join(''),
			inputs_active_count: String(this.inputStates.filter((state) => state).length),
			last_error: this.lastError || 'None',
			last_poll: this.lastPollAt,
			last_input_poll: this.lastInputPollAt,
		}

		for (let i = 0; i < this.getRelayCount(); i++) {
			values[`relay_${i + 1}`] = this.relayStates[i] ? 'On' : 'Off'
		}
		for (let i = 0; i < this.getInputCount(); i++) {
			values[`input_${i + 1}`] = this.inputStates[i] ? 'Active' : 'Inactive'
		}

		this.setVariableValues(values)
	}

	private resetRelayStateCache(): void {
		this.relayStates = Array<boolean>(this.getRelayCount()).fill(false)
		this.inputStates = Array<boolean>(this.getInputCount()).fill(false)
	}

	private async readCoils(startAddress: number, quantity: number): Promise<boolean[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x01, payload)
		const byteCount = responsePdu.readUInt8(1)
		const states: boolean[] = []

		for (let index = 0; index < quantity; index++) {
			const byteIndex = Math.floor(index / 8)
			if (byteIndex >= byteCount) break
			const mask = 1 << (index % 8)
			states.push((responsePdu[2 + byteIndex] & mask) !== 0)
		}

		while (states.length < quantity) {
			states.push(false)
		}

		return states
	}

	private async writeSingleCoil(address: number, action: RelayAction): Promise<void> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(address, 0)
		payload.writeUInt16BE(this.coilValueForAction(action), 2)
		await this.sendRequest(0x05, payload)
	}

	private async readDiscreteInputs(startAddress: number, quantity: number): Promise<boolean[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x02, payload)
		const byteCount = responsePdu.readUInt8(1)
		const states: boolean[] = []

		for (let index = 0; index < quantity; index++) {
			const byteIndex = Math.floor(index / 8)
			if (byteIndex >= byteCount) break
			const mask = 1 << (index % 8)
			states.push((responsePdu[2 + byteIndex] & mask) !== 0)
		}

		while (states.length < quantity) {
			states.push(false)
		}

		return states
	}

	private coilValueForAction(action: RelayAction): number {
		switch (action) {
			case 'on':
				return 0xff00
			case 'off':
				return 0x0000
			case 'toggle':
				return 0x5500
		}
	}

	private async sendRequest(functionCode: number, payload: Buffer): Promise<Buffer> {
		const transactionId = this.nextTransactionId()
		const pdu = Buffer.concat([Buffer.from([functionCode]), payload])
		const mbap = Buffer.alloc(7)

		mbap.writeUInt16BE(transactionId, 0)
		mbap.writeUInt16BE(0, 2)
		mbap.writeUInt16BE(pdu.length + 1, 4)
		mbap.writeUInt8(this.config.unitId, 6)

		const response = await this.exchange(Buffer.concat([mbap, pdu]), transactionId)
		if (response.length < 8) {
			throw new Error('Short Modbus TCP response')
		}

		const responseFunction = response.readUInt8(7)
		if (responseFunction === (functionCode | 0x80)) {
			throw new Error(`Device returned Modbus exception 0x${response.readUInt8(8).toString(16).padStart(2, '0')}`)
		}
		if (responseFunction !== functionCode) {
			throw new Error(`Unexpected Modbus function 0x${responseFunction.toString(16).padStart(2, '0')}`)
		}

		return response.subarray(7)
	}

	private async exchange(frame: Buffer, expectedTransactionId: number): Promise<Buffer> {
		return await new Promise<Buffer>((resolve, reject) => {
			const socket = new net.Socket()
			const chunks: Buffer[] = []
			let finished = false

			const finish = (callback: () => void): void => {
				if (finished) return
				finished = true
				socket.removeAllListeners()
				socket.destroy()
				callback()
			}

			socket.setTimeout(this.config.connectTimeout)

			socket.on('data', (chunk) => {
				chunks.push(chunk)
				const response = Buffer.concat(chunks)

				if (response.length >= 6) {
					const expectedLength = 6 + response.readUInt16BE(4)
					if (response.length >= expectedLength) {
						try {
							this.validateResponse(response, expectedTransactionId)
							finish(() => resolve(response.subarray(0, expectedLength)))
						} catch (error) {
							finish(() => reject(error instanceof Error ? error : new Error(String(error))))
						}
					}
				}
			})

			socket.on('error', (error) => {
				finish(() => reject(error))
			})

			socket.on('timeout', () => {
				finish(() => reject(new Error('Connection timed out')))
			})

			socket.connect(this.config.port, this.config.host, () => {
				socket.write(frame)
			})
		})
	}

	private validateResponse(response: Buffer, expectedTransactionId: number): void {
		const transactionId = response.readUInt16BE(0)
		const protocolId = response.readUInt16BE(2)
		const unitId = response.readUInt8(6)

		if (transactionId !== expectedTransactionId) {
			throw new Error('Mismatched Modbus transaction id')
		}
		if (protocolId !== 0) {
			throw new Error(`Unexpected Modbus protocol id ${protocolId}`)
		}
		if (unitId !== this.config.unitId) {
			throw new Error(`Unexpected Modbus unit id ${unitId}`)
		}
	}

	private nextTransactionId(): number {
		this.transactionId = (this.transactionId + 1) & 0xffff
		if (this.transactionId === 0) this.transactionId = 1
		return this.transactionId
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
