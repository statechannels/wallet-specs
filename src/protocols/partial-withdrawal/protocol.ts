import { add, Allocation, Channel, store, subtract } from '../..';
import { checkThat, isAllocation } from '../../store';
import * as ConcludeChannel from '../conclude-channel/protocol';
import * as CreateNullChannel from '../create-null-channel/protocol';
import * as LedgerUpdate from '../ledger-update/protocol';

const PROTOCOL = 'partial-withdrawal';
const success = { type: 'final' };

/*
participantMapping allows participants to change their signing keys in the new channel.

This protocol allows for more than one participant to withdraw from the channel.
This may be useful, for instance, if a customer of the hub decides to lower their "channel rent",
and the hub responds accordingly by lowering their stake.
This would have to be negotiated in a different, undetermined protocol.
*/
interface Init {
  ledgerId: string;
  newOutcome: Allocation;
  participantMapping: Record<string, string>;
}

function replacementChannelArgs({
  ledgerId,
  newOutcome,
  participantMapping,
}: Init): CreateNullChannel.Init {
  const { channel, outcome } = store.getLatestConsensus(ledgerId).state;
  const newParticipants = channel.participants
    .filter(p => newOutcome.find(allocation => allocation.destination === p))
    .map(p => participantMapping[p]);
  const newChannel: Channel = {
    chainId: channel.chainId,
    participants: newParticipants,
    channelNonce: store.getNextNonce(newParticipants),
  };

  const newChannelOutcome: Allocation = checkThat(outcome, isAllocation).map(
    ({ destination, amount }) => ({
      destination: participantMapping[destination],
      amount: subtract(outcome[destination], newOutcome[destination]),
    })
  );

  return {
    channel: newChannel,
    outcome: newChannelOutcome,
  };
}
const createReplacement = {
  entry: 'assignNewChannelId',
  invoke: {
    src: 'createNullChannel',
    data: replacementChannelArgs.name,
    onDone: 'updateOldChannelOutcome',
  },
};
type NewChannelCreated = Init & { newChannelId: string };

export function concludeOutcome({
  ledgerId,
  newOutcome,
  newChannelId,
}: NewChannelCreated): LedgerUpdate.Init {
  const { state } = store.getLatestConsensus(ledgerId);
  const currentlyAllocated = checkThat(state.outcome, isAllocation)
    .map(a => a.amount)
    .reduce(add, 0);
  const toBeWithdrawn = newOutcome.map(a => a.amount).reduce(add, 0);
  const targetOutcome = [
    ...newOutcome,
    {
      destination: newChannelId,
      amount: subtract(currentlyAllocated, toBeWithdrawn),
    },
  ];
  return {
    channelId: ledgerId,
    targetOutcome,
  };
}
const updateOldChannelOutcome = {
  invoke: {
    src: 'ledgerUpdate',
    data: concludeOutcome.name,
    onDone: 'concludeOldChannel',
  },
};

function oldChannelId({
  ledgerId: channelId,
}: NewChannelCreated): ConcludeChannel.Init {
  return { channelId };
}
const concludeOldChannel = {
  invoke: {
    src: 'concludeChannel',
    data: oldChannelId.name,
    onDone: 'transfer',
  },
};

const transfer = {
  invoke: {
    src: 'transferAll',
    data: oldChannelId.name,
    onDone: 'success',
  },
};

export const config = {
  key: PROTOCOL,
  initial: 'createReplacement',
  states: {
    createReplacement,
    updateOldChannelOutcome,
    concludeOldChannel,
    transfer,
    success,
  },
};
