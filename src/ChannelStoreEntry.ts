import { Channel, getChannelId, SignedState, State } from '.';
import { Participant, supported } from './store';

interface DirectFunding {
  type: 'Direct';
}

interface IndirectFunding {
  type: 'Indirect';
  ledgerId: string;
}

interface VirtualFunding {
  type: 'Virtual';
  jointChannelId: string;
  guarantorChannelId: string;
}

interface Guaranteed {
  type: 'Guarantee';
  guarantorChannelIds: [string, string];
}

export type Funding =
  | DirectFunding
  | IndirectFunding
  | VirtualFunding
  | Guaranteed;

export function isIndirectFunding(
  funding: Funding
): funding is IndirectFunding {
  return funding.type === 'Indirect';
}

export function isVirtualFunding(funding: Funding): funding is VirtualFunding {
  return funding.type === 'Virtual';
}

export function isGuarantee(funding: Funding): funding is Guaranteed {
  return funding.type === 'Guarantee';
}

export interface IChannelStoreEntry {
  states: SignedState[];
  privateKey: string;
  participants: Participant[];
  channel: Channel;
  funding?: Funding;
}

export class ChannelStoreEntry implements IChannelStoreEntry {
  public readonly states: SignedState[] = [];
  public privateKey: string;
  public participants: Participant[];
  public funding?: Funding;
  public channel: Channel;

  constructor(args: Partial<IChannelStoreEntry>) {
    const { privateKey, participants, channel } = args;
    if (privateKey && participants && channel) {
      this.privateKey = privateKey;
      this.participants = participants;
      this.channel = channel;
    } else {
      throw new Error('Required arguments missing');
    }
    this.states = args.states || [];
    this.funding = args.funding;
  }

  get args(): IChannelStoreEntry {
    const {
      states,
      privateKey,
      participants,
      channel,
      funding,
    }: IChannelStoreEntry = this;
    return {
      states,
      privateKey,
      participants,
      channel,
      funding,
    };
  }

  get ourIndex() {
    return this.participants.findIndex(
      p => p.signingAddress === this.privateKey
    );
  }

  get unsupportedStates(): SignedState[] {
    return this.states.filter(s => !supported(s));
  }

  get supportedState(): SignedState[] {
    // TODO: implementing this correctly requires implementing signatures
    return this.states.filter(supported);
  }

  get latestSupportedState(): State | undefined {
    const numStates = this.supportedState.length;
    if (numStates > 0) {
      return this.supportedState[numStates - 1].state;
    } else {
      return;
    }
  }

  get ourAddress(): string {
    return this.channel.participants[this.ourIndex];
  }

  get channelId() {
    return getChannelId(this.channel);
  }

  get latestState(): State {
    if (!this.states.length) {
      throw new Error('No states found');
    }
    return this.states.sort(s => -s.state.turnNum)[0].state;
  }

  get recipients(): string[] {
    return this.channel.participants.filter(p => p !== this.ourAddress);
  }
}
