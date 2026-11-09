import type { JSX } from '@solidjs/web';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { HTMLProps } from '../types';
import { useBaseUiId } from '../useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';

export function LabelableProvider(props: LabelableProvider.Props) {
  const defaultId = useBaseUiId();

  const [controlIdState, setControlIdState] = createSyncSignal<string | null | undefined>(
    defaultId(),
  );
  const [labelId, setLabelId] = createSyncSignal<string | undefined>(undefined);
  const [messageIds, setMessageIds] = createSyncSignal<string[]>([]);

  const controlId = () => {
    const state = controlIdState();
    return state === undefined ? defaultId() : state;
  };

  const registrations = new Map<symbol, string | null>();

  const parentContext = useLabelableContext();

  const registerControlId = (source: symbol, nextId: string | null | undefined) => {
    if (nextId === undefined) {
      registrations.delete(source);
    } else {
      registrations.set(source, nextId);
    }

    setControlIdState((prev) => {
      if (registrations.size === 0) {
        return prev;
      }

      let nextControlId: string | null | undefined;

      for (const id of registrations.values()) {
        if (id === prev) {
          return prev;
        }

        if (nextControlId === undefined) {
          nextControlId = id;
        }
      }

      return nextControlId;
    });
  };

  const resetControlId = () => {
    if (registrations.size === 0) {
      setControlIdState(defaultId());
    }
  };

  const getDescriptionProps = (externalProps: HTMLProps) => {
    const ids: string[] = externalProps['aria-describedby']
      ? String(externalProps['aria-describedby']).split(' ')
      : [];
    ids.push(...parentContext.messageIds, ...messageIds());

    return {
      ...externalProps,
      'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined,
    };
  };

  const contextValue: LabelableContext = {
    get controlId() {
      return controlId();
    },
    registerControlId,
    resetControlId,
    get labelId() {
      return labelId();
    },
    setLabelId: (value) => {
      setLabelId(value);
    },
    get messageIds() {
      return messageIds();
    },
    setMessageIds: (value) => {
      setMessageIds(value);
    },
    getDescriptionProps,
  };

  return <LabelableContext value={contextValue}>{props.children}</LabelableContext>;
}

type LabelableContext = import('./LabelableContext').LabelableContext;

export interface LabelableProviderState {}

export interface LabelableProviderProps {
  children?: JSX.Element;
}

export namespace LabelableProvider {
  export type State = LabelableProviderState;
  export type Props = LabelableProviderProps;
}
