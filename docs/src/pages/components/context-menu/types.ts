import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesContextMenu = createMultipleTypes(data);
export const TypesContextMenuAdditional = (_props: Record<string, unknown>) => null;
