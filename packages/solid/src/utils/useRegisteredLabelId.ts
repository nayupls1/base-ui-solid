import { createEffect, type Accessor } from 'solid-js';
import { useBaseUiId } from '../internals/useBaseUiId';

type SetStateAction<T> = T | ((prev: T) => T);

export function useRegisteredLabelId(
  idProp: Accessor<string | undefined>,
  setLabelId: (value: SetStateAction<string | undefined>) => void,
): Accessor<string | undefined> {
  const id = useBaseUiId(idProp);

  createEffect(id, (currentId) => {
    setLabelId(currentId);
    return () => {
      setLabelId((existingId) => (existingId === currentId ? undefined : existingId));
    };
  });

  return id;
}
