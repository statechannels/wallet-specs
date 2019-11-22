import { ChannelState } from '../..';
import { saveConfig } from '../../utils';
import { store } from '../../store';

const PROTOCOL = 'conclude-channel';

interface Init {
  channelID: string;
}

function finalState({ channelID }: Init): ChannelState {
  const latestState = store
    .getUnsupportedStates(channelID)
    .concat(store.getLatestWalletChannelSupport(channelID))
    .filter(({ state }) => store.signedByMe(state))
    .sort(({ state }) => state.turnNumber)
    .pop();

  if (!latestState) {
    throw new Error('No state');
  }

  return {
    ...latestState.state,
    turnNumber: latestState.state.turnNumber + 1,
    isFinal: true,
  };
}

const waiting = {
  invoke: {
    src: 'supportState',
    data: 'finalState',
  },
  onDone: 'success',
};

const config = {
  key: PROTOCOL,
  initial: 'waiting',
  states: {
    waiting,
    success: { type: 'final' },
  },
};

const guards = {};

saveConfig({ ...config }, { guards });