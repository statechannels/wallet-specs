import {
  add,
  AllocationItem,
  Balance,
  Channel,
  getChannelID,
  Guarantee,
} from '../../';
import { saveConfig } from '../../utils';
import { Init as CreateNullChannelArgs } from '../create-null-channel/protocol';
import { Init as SupportStateArgs } from '../support-state/protocol';

const PROTOCOL = 'virtual-funding-as-leaf';

enum Indices {
  Left = 0,
  Right = 1,
}

export interface Init {
  balances: Balance[];
  ledgerId: string;
  targetChannelId: string;
  jointChannel: Channel;
  guarantorChannel: Channel;
  index: Indices.Left | Indices.Right;
}

const total = (balances: Balance[]) => balances.map(b => b.wei).reduce(add);
export function jointChannelArgs({
  balances,
  jointChannel,
}: Init): CreateNullChannelArgs {
  const allocation: (i: Indices) => AllocationItem = i => ({
    destination: balances[i].address,
    amount: balances[i].wei,
  });

  return {
    channel: jointChannel,
    outcome: [
      allocation(Indices.Left),
      { destination: jointChannel.participants[1], amount: total(balances) },
      allocation(Indices.Right),
    ],
  };
}
const createJointChannel = {
  invoke: {
    src: 'createNullChannel',
    data: 'jointChannelArgs',
  },
};

export function guarantorChannelArgs({ jointChannel, index }: Init): Guarantee {
  const { participants } = jointChannel;

  return {
    target: getChannelID(jointChannel),
    // Note that index in the joint channel is twice the index in the target channel
    guarantee: [participants[2 * index], participants[1]],
  };
}

const createGuarantorChannel = {
  invoke: {
    src: 'createNullChannel',
    data: 'guarantorChannelArgs',
  },
};

export function fundGuarantorArgs({
  guarantorChannel,
  ledgerId,
  balances,
}: Init): SupportStateArgs {
  const amount = total(balances);
  return {
    channelID: ledgerId,
    outcome: [{ destination: getChannelID(guarantorChannel), amount }],
  };
}
const createChannels = {
  type: 'parallel',
  states: {
    createGuarantorChannel,
    createJointChannel,
  },
  onDone: 'fundGuarantor',
};

const fundGuarantor = {
  invoke: {
    src: 'supportState',
    data: 'guarantorOutcome',
    onDone: 'fundTarget',
  },
};

const fundTarget = {
  invoke: {
    src: 'supportState',
    data: 'jointOutcome',
    onDone: 'success',
  },
};

// PROTOCOL DEFINITION
const config = {
  key: PROTOCOL,
  initial: 'createChannels',
  states: {
    createChannels,
    fundGuarantor,
    fundTarget,
    success: { type: 'final' },
  },
};

const guards = {};
saveConfig(config, __dirname, { guards });
