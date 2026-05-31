## Generic Modbus TCP

This module is intended for Modbus TCP relay and digital input devices that expose:

- relay outputs as coils
- digital inputs as discrete inputs

The module now provides:

- configurable unit id, coil start address, input start address, and counts
- direct coil actions for on, off, toggle, pulse, and all-coils control
- coil, input, and register polling with state feedbacks and variables
- Companion button presets for per-coil toggle plus utility controls

### Waveshare devices

This module should work well with Waveshare devices that present:

- coil-backed outputs
- digital inputs as discrete inputs
- Modbus TCP on port `502`
- unit id `1`

That includes the common Waveshare Ethernet/PoE relay family where the device behaves like a standard Modbus TCP relay controller rather than needing a vendor-specific API.

Searching for `Waveshare` in Companion should also surface this module.

### Common Waveshare setup

These defaults should work for common Waveshare relay boards:

- port: `502`
- unit id: `1`
- coil (relay) start address: `0`
- coil (relay) count: `8`
- digital input start address: `0`
- digital input count: `8`

If your device uses different Modbus addressing, adjust the start addresses and counts to match its register map.

### Important note about coil offsets

Testing against a Waveshare unit on this system showed that `Read Coils` responded correctly at coil start address `0`, but timed out for offsets such as `1`, `2`, `7`, `8`, `16`, and higher.

For Waveshare boards like this one, you should keep:

- `Coil (Relay) start address`: `0`

If changing the coil offset causes timeouts instead of a Modbus exception, that usually indicates the device only responds on the base coil map starting at `0`.

### Example: Waveshare 8-relay board

Use these settings as a starting point:

- host: `192.168.x.x`
- port: `502`
- unit id: `1`
- coil (relay) start address: `0`
- coil (relay) count: `8`
- enable digital input polling: `false`
- coil (relay) poll interval: `500`

Recommended Companion usage:

- drag in the built-in `Toggle coil (relay) 1` to `Toggle coil (relay) 8` presets
- add `All coils (relays) on` and `All coils (relays) off` presets for master control
- use the `Coil (relay) is on` feedback on custom buttons if you want state indication
- use the `Pulse coil (relay)` action if the output should behave momentarily

### Example: Waveshare relay board with digital inputs

Use these settings as a starting point:

- host: `192.168.x.x`
- port: `502`
- unit id: `1`
- coil (relay) start address: `0`
- coil (relay) count: `8`
- enable digital input polling: `true`
- digital input start address: `0`
- digital input count: `8`
- input poll interval: `250`

Recommended Companion usage:

- use the `Digital input is active` feedback to show input state on buttons
- use variables such as `$(instance:input_1)` and `$(instance:input1_status)` in labels or triggers
- keep relay polling enabled so output button feedback stays in sync with the hardware

### Notes on generic compatibility

This module does not assume Waveshare-specific toggle commands. For compatibility with generic Modbus devices, toggle actions are implemented by reading the current state and then writing the inverse state.
