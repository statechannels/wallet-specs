import { assign } from 'xstate';
import { store } from '../../';
import { isGuarantee, isIndirectFunding } from '../../ChannelStoreEntry';
import { checkThat } from '../../store';
import * as LedgerUpdate from '../ledger-update/protocol';
import { defundGuarantorInLedger } from '../virtual-defunding-as-leaf/protocol';

const PROTOCOL = 'virtual-defunding-as-hub';

export interface Init {
  jointChannelId: string;
}

type IDs = [string, string];
type ChannelsSet = Init & {
  guarantorChannelIds: IDs;
  ledgerChannelIds: IDs;
};

export const assignChannels = assign(
  ({ jointChannelId }: Init): ChannelsSet => {
    const { guarantorChannelIds } = checkThat(
      store.getEntry(jointChannelId).funding,
      isGuarantee
    );

    const { ledgerId: leftLedgerId } = checkThat(
      store.getEntry(guarantorChannelIds[0]).funding,
      isIndirectFunding
    );
    const { ledgerId: rightLedgerId } = checkThat(
      store.getEntry(guarantorChannelIds[1]).funding,
      isIndirectFunding
    );
    const ledgerChannelIds: [string, string] = [leftLedgerId, rightLedgerId];

    return { jointChannelId, guarantorChannelIds, ledgerChannelIds };
  }
);

function defundGuarantor(index: 0 | 1) {
  return ({
    guarantorChannelIds,
    jointChannelId,
    ledgerChannelIds,
  }: ChannelsSet) => {
    return defundGuarantorInLedger({
      index,
      hubLedgerId: ledgerChannelIds[index],
      guarantorChannelId: guarantorChannelIds[index],
      jointChannelId,
    });
  };
}
function defundLeftGuarantor(ctx: ChannelsSet): LedgerUpdate.Init {
  return defundGuarantor(0)(ctx);
}
function defundRightGuarantor(ctx: ChannelsSet): LedgerUpdate.Init {
  return defundGuarantor(1)(ctx);
}
const defundGuarantors = {
  type: 'parallel',
  states: {
    defundLeft: {
      invoke: {
        src: 'supportState',
        data: defundLeftGuarantor.name,
      },
      exit: 'garbageCollectLeftGuarantor',
    },
    defundRight: {
      invoke: {
        src: 'supportState',
        data: defundRightGuarantor.name,
      },
      exit: 'garbageCollectRightGuarantor',
    },
  },
  exit: 'garbageCollectJointChannel',
  onDone: 'success',
};

export const config = {
  key: PROTOCOL,
  initial: 'defundGuarantors',
  states: {
    defundGuarantors,
    success: { type: 'final' },
  },
};
