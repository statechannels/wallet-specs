const config = {
  key: 'support-state',
  initial: 'waiting',
  states: {
    waiting: {
      entry: 'sendState',
      on: { CHANNEL_UPDATED: [{ target: 'success', cond: 'supported' }] },
    },
    success: { type: 'final' },
  },
};
const guards = { supported: context => true };
const customActions = {};
const machine = Machine(config, { guards, actions: customActions });