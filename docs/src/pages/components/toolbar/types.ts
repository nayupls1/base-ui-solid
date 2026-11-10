import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesToolbar = createMultipleTypes(data);
export const TypesToolbarAdditional = (_props: Record<string, unknown>) => null;
