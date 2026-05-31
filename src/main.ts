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
	inputRegisterValues: number[] = []
	holdingRegisterValues: number[] = []
	isConnected = false
	lastError = 'Not connected'
	lastPollAt = 'Never'
	lastInputPollAt = 'Never'
	lastRegisterPollAt = 'Never'

	private pollTimer: NodeJS.Timeout | undefined
	private inputPollTimer: NodeJS.Timeout | undefined
	private registerPollTimer: NodeJS.Timeout | undefined
	private pollInFlight = false
	private inputPollInFlight = false
	private registerPollInFlight = false
	private transactionId = 0
	private requestQueue: Promise<void> = Promise.resolve()

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.resetStateCache()

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
		this.resetStateCache()
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
		return Math.max(1, Math.min(64, count))
	}

	getInputState(channel: number): boolean {
		return this.inputStates[channel - 1] ?? false
	}

	getInputCount(): number {
		const count = Number(this.config.inputCount)
		return this.hasInputSupport() ? Math.max(0, Math.min(64, Number.isFinite(count) ? count : 8)) : 0
	}

	hasInputSupport(): boolean {
		const value = this.config.hasDigitalInputs as unknown
		return value === true || value === 1 || value === '1' || value === 'true'
	}

	getInputRegisterValue(channel: number): number | undefined {
		return this.inputRegisterValues[channel - 1]
	}

	getInputRegisterCount(): number {
		if (!this.hasInputRegisterSupport()) return 0
		const count = Number(this.config.inputRegisterCount)
		return Math.max(0, Math.min(64, Number.isFinite(count) ? count : 0))
	}

	hasInputRegisterSupport(): boolean {
		const value = this.config.hasInputRegisters as unknown
		return value === true || value === 1 || value === '1' || value === 'true'
	}

	getHoldingRegisterValue(channel: number): number | undefined {
		return this.holdingRegisterValues[channel - 1]
	}

	getHoldingRegisterCount(): number {
		if (!this.hasHoldingRegisterSupport()) return 0
		const count = Number(this.config.holdingRegisterCount)
		return Math.max(0, Math.min(64, Number.isFinite(count) ? count : 0))
	}

	hasHoldingRegisterSupport(): boolean {
		const value = this.config.hasHoldingRegisters as unknown
		return value === true || value === 1 || value === '1' || value === 'true'
	}

	private hasRegisterSupport(): boolean {
		return this.getInputRegisterCount() > 0 || this.getHoldingRegisterCount() > 0
	}

	async executeRelayAction(channel: number, action: RelayAction): Promise<void> {
		if (channel < 1 || channel > this.getRelayCount()) {
			throw new Error(`Relay ${channel} is out of range`)
		}

		await this.runExclusive(async () => {
			const address = this.getRelayStartAddress() + channel - 1
			const state = action === 'toggle' ? !this.getRelayState(channel) : action === 'on'
			await this.writeSingleCoil(address, state)
			await this.readRelayStatesInternal(`relay ${channel} ${action}`)
		})
	}

	async executeAllRelaysAction(action: RelayAction): Promise<void> {
		await this.runExclusive(async () => {
			const relayCount = this.getRelayCount()
			if (action === 'toggle') {
				for (let channel = 1; channel <= relayCount; channel++) {
					await this.writeSingleCoil(this.getRelayStartAddress() + channel - 1, !this.getRelayState(channel))
				}
			} else {
				await this.writeMultipleCoils(
					this.getRelayStartAddress(),
					relayCount,
					Array<boolean>(relayCount).fill(action === 'on'),
				)
			}
			await this.readRelayStatesInternal(`all relays ${action}`)
		})
	}

	async pulseRelay(channel: number, durationMs: number): Promise<void> {
		await this.executeRelayAction(channel, 'on')
		await new Promise((resolve) => setTimeout(resolve, durationMs))
		await this.executeRelayAction(channel, 'off')
	}

	async forcePoll(): Promise<void> {
		await this.refreshRelayStates('manual poll')
		if (this.hasInputSupport() && this.getInputCount() > 0) {
			await this.refreshInputStates('manual poll')
		}
		if (this.hasRegisterSupport()) {
			await this.refreshRegisters('manual poll')
		}
	}

	private async restartPolling(): Promise<void> {
		this.stopPolling()

		if (!this.config.host) {
			this.isConnected = false
			this.lastError = 'Host is not configured'
			this.updateStatus(InstanceStatus.BadConfig, this.lastError)
			this.updateVariables()
			this.checkFeedbacks(
				'connected',
				'relay_state',
				'input_state',
				'InputState',
				'input_register_value',
				'holding_register_value',
			)
			return
		}

		await this.initialPoll()

		this.pollTimer = setInterval(() => {
			void this.refreshRelayStates('poll')
		}, this.config.pollInterval)

		if (this.hasInputSupport() && this.getInputCount() > 0) {
			this.inputPollTimer = setInterval(() => {
				void this.refreshInputStates('poll')
			}, this.config.inputPollInterval)
		}

		if (this.hasRegisterSupport()) {
			this.registerPollTimer = setInterval(() => {
				void this.refreshRegisters('poll')
			}, this.config.registerPollInterval)
		}
	}

	private async initialPoll(): Promise<void> {
		try {
			await this.forcePoll()
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.log('warn', `Initial Modbus poll failed: ${message}`)
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

		if (this.registerPollTimer) {
			clearInterval(this.registerPollTimer)
			this.registerPollTimer = undefined
		}
	}

	private async refreshRelayStates(reason: string): Promise<void> {
		if (this.pollInFlight) return
		this.pollInFlight = true

		try {
			await this.runExclusive(async () => this.readRelayStatesInternal(reason))
		} catch {
			// Keep the instance alive on poll failures; status is updated in readRelayStatesInternal.
		} finally {
			this.pollInFlight = false
		}
	}

	private async refreshInputStates(reason: string): Promise<void> {
		if (!this.hasInputSupport() || this.getInputCount() <= 0 || this.inputPollInFlight) return
		this.inputPollInFlight = true

		try {
			await this.runExclusive(async () => this.readInputStatesInternal(reason))
		} catch {
			// Keep the instance alive on poll failures; status is updated in readInputStatesInternal.
		} finally {
			this.inputPollInFlight = false
		}
	}

	private async refreshRegisters(reason: string): Promise<void> {
		if (!this.hasRegisterSupport() || this.registerPollInFlight) return
		this.registerPollInFlight = true

		try {
			await this.runExclusive(async () => this.readRegistersInternal(reason))
		} catch {
			// Keep the instance alive on poll failures; status is updated in readRegistersInternal.
		} finally {
			this.registerPollInFlight = false
		}
	}

	private async readRelayStatesInternal(reason: string): Promise<void> {
		try {
			const relays = await this.readCoils(this.getRelayStartAddress(), this.getRelayCount())
			this.relayStates = relays
			this.isConnected = true
			this.lastError = ''
			this.lastPollAt = new Date().toISOString()
			this.updateStatus(InstanceStatus.Ok)
			this.updateVariables()
			this.checkFeedbacks('connected', 'relay_state')
			this.log('debug', `Relay state refresh successful (${reason})`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.isConnected = false
			this.lastError = message
			this.updateStatus(InstanceStatus.ConnectionFailure, message)
			this.updateVariables()
			this.checkFeedbacks('connected', 'relay_state')
			this.log('warn', `Relay state refresh failed (${reason}): ${message}`)
			throw error
		}
	}

	private async readInputStatesInternal(reason: string): Promise<void> {
		try {
			const inputs = await this.readDiscreteInputs(this.getInputStartAddress(), this.getInputCount())
			const previousStates = [...this.inputStates]
			this.inputStates = inputs
			this.lastInputPollAt = new Date().toISOString()
			this.updateVariables()
			this.checkFeedbacks('input_state', 'InputState')

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
			throw error
		}
	}

	private async readRegistersInternal(reason: string): Promise<void> {
		try {
			if (this.getInputRegisterCount() > 0) {
				this.inputRegisterValues = await this.readInputRegisters(
					this.getInputRegisterStartAddress(),
					this.getInputRegisterCount(),
				)
			}
			if (this.getHoldingRegisterCount() > 0) {
				this.holdingRegisterValues = await this.readHoldingRegisters(
					this.getHoldingRegisterStartAddress(),
					this.getHoldingRegisterCount(),
				)
			}
			this.lastRegisterPollAt = new Date().toISOString()
			this.updateVariables()
			this.checkFeedbacks('input_register_value', 'holding_register_value')
			this.log('debug', `Register refresh successful (${reason})`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			this.lastError = message
			this.updateVariables()
			this.log('warn', `Register refresh failed (${reason}): ${message}`)
			throw error
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
			input_register_bitmap: this.inputRegisterValues.join(','),
			holding_register_bitmap: this.holdingRegisterValues.join(','),
			last_error: this.lastError || 'None',
			last_poll: this.lastPollAt,
			last_input_poll: this.lastInputPollAt,
			last_register_poll: this.lastRegisterPollAt,
		}

		for (let index = 0; index < this.getRelayCount(); index++) {
			values[`relay_${index + 1}`] = this.relayStates[index] ? 'On' : 'Off'
		}

		for (let index = 0; index < this.getInputCount(); index++) {
			const active = this.inputStates[index] ?? false
			values[`input_${index + 1}`] = active ? 'Active' : 'Inactive'
			values[`input${index + 1}_status`] = active ? 'true' : 'false'
		}

		for (let index = 0; index < this.getInputRegisterCount(); index++) {
			values[`input_register_${index + 1}`] = String(this.inputRegisterValues[index] ?? 0)
		}

		for (let index = 0; index < this.getHoldingRegisterCount(); index++) {
			values[`holding_register_${index + 1}`] = String(this.holdingRegisterValues[index] ?? 0)
		}

		this.setVariableValues(values)
	}

	private resetStateCache(): void {
		this.relayStates = Array<boolean>(this.getRelayCount()).fill(false)
		this.inputStates = Array<boolean>(this.getInputCount()).fill(false)
		this.inputRegisterValues = Array<number>(this.getInputRegisterCount()).fill(0)
		this.holdingRegisterValues = Array<number>(this.getHoldingRegisterCount()).fill(0)
	}

	private getRelayStartAddress(): number {
		return Math.max(0, Number(this.config.relayStartAddress) || 0)
	}

	private getInputStartAddress(): number {
		return Math.max(0, Number(this.config.inputStartAddress) || 0)
	}

	private getInputRegisterStartAddress(): number {
		return Math.max(0, Number(this.config.inputRegisterStartAddress) || 0)
	}

	private getHoldingRegisterStartAddress(): number {
		return Math.max(0, Number(this.config.holdingRegisterStartAddress) || 0)
	}

	private async readCoils(startAddress: number, quantity: number): Promise<boolean[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x01, payload)
		return this.unpackBitResponse(responsePdu, quantity)
	}

	private async readDiscreteInputs(startAddress: number, quantity: number): Promise<boolean[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x02, payload)
		return this.unpackBitResponse(responsePdu, quantity)
	}

	private async readHoldingRegisters(startAddress: number, quantity: number): Promise<number[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x03, payload)
		return this.unpackRegisterResponse(responsePdu, quantity)
	}

	private async readInputRegisters(startAddress: number, quantity: number): Promise<number[]> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)

		const responsePdu = await this.sendRequest(0x04, payload)
		return this.unpackRegisterResponse(responsePdu, quantity)
	}

	private unpackBitResponse(responsePdu: Buffer, quantity: number): boolean[] {
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

	private unpackRegisterResponse(responsePdu: Buffer, quantity: number): number[] {
		const byteCount = responsePdu.readUInt8(1)
		const values: number[] = []

		for (let index = 0; index < quantity; index++) {
			const offset = 2 + index * 2
			if (offset + 1 >= 2 + byteCount) break
			values.push(responsePdu.readUInt16BE(offset))
		}

		while (values.length < quantity) {
			values.push(0)
		}

		return values
	}

	private async writeSingleCoil(address: number, state: boolean): Promise<void> {
		const payload = Buffer.alloc(4)
		payload.writeUInt16BE(address, 0)
		payload.writeUInt16BE(state ? 0xff00 : 0x0000, 2)
		await this.sendRequest(0x05, payload)
	}

	private async writeMultipleCoils(startAddress: number, quantity: number, states: boolean[]): Promise<void> {
		const byteCount = Math.ceil(quantity / 8)
		const payload = Buffer.alloc(5 + byteCount)

		payload.writeUInt16BE(startAddress, 0)
		payload.writeUInt16BE(quantity, 2)
		payload.writeUInt8(byteCount, 4)

		for (let index = 0; index < quantity; index++) {
			if (states[index]) {
				payload[5 + Math.floor(index / 8)] |= 1 << (index % 8)
			}
		}

		await this.sendRequest(0x0f, payload)
	}

	private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
		const previousQueue = this.requestQueue
		let release: (() => void) | undefined
		this.requestQueue = new Promise<void>((resolve) => {
			release = resolve
		})

		await previousQueue

		try {
			return await operation()
		} finally {
			release?.()
		}
	}

	private async sendRequest(functionCode: number, payload: Buffer): Promise<Buffer> {
		const transactionId = this.nextTransactionId()
		const pdu = Buffer.concat([Buffer.from([functionCode]), payload])
		const mbap = Buffer.alloc(7)

		mbap.writeUInt16BE(transactionId, 0)
		mbap.writeUInt16BE(0, 2)
		mbap.writeUInt16BE(pdu.length + 1, 4)
		mbap.writeUInt8(this.config.unitId || 1, 6)

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

			socket.setTimeout(this.config.connectTimeout || 2000)

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
							const rejectionError = error instanceof Error ? error : new Error(String(error))
							finish(() => reject(rejectionError))
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

			socket.connect(this.config.port || 502, this.config.host, () => {
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
		if (unitId !== (this.config.unitId || 1)) {
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
