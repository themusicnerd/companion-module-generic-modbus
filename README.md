# companion-module-generic-modbus

Generic Modbus TCP module for relay and digital input devices.

See [HELP.md](./companion/HELP.md) for end-user setup guidance and [LICENSE](./LICENSE).

## Waveshare notes

This module is intended to cover devices such as the Waveshare Modbus relay boards without hard-coding the implementation to one vendor.

Known Waveshare-style usage:

- coil-backed outputs exposed starting at address `0`
- digital inputs exposed as discrete inputs starting at address `0`
- unit id usually set to `1`
- common relay counts are `8`

That means many Waveshare boards can be configured directly with:

- host: your device IP
- port: `502`
- unit id: `1`
- coil (relay) start address: `0`
- coil (relay) count: `8`
- enable digital input polling: `true` or `false` depending on model
- digital input start address: `0`
- digital input count: `8`

If your exact model uses a different register map, adjust the start addresses and counts to match the device documentation.

## Companion usage examples

Examples for a typical Waveshare 8-relay board:

- Use the built-in `Toggle coil (relay) 1` through `Toggle coil (relay) 8` presets for quick button creation.
- Use `All coils (relays) on` and `All coils (relays) off` for master control buttons.
- Use the `Pulse coil (relay)` action for momentary closures.
- Use the `Coil (relay) is on` feedback to color a button when an output is active.

Examples for a Waveshare board with digital inputs:

- Enable digital input polling in the config.
- Use the `Digital input is active` feedback to reflect input state on buttons.
- Use variables such as `$(generic-modbus:input_1)` or `$(generic-modbus:input1_status)` in labels, triggers, or companion logic.

## Development

Executing a `yarn` command should perform all necessary steps to develop the module.

The module can be built once with `yarn build`. This should be enough to get the module to be loadable by Companion.

While developing the module, `yarn dev` runs the compiler in watch mode and recompiles on change.
