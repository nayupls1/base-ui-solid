import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesScrollArea = createMultipleTypes(data);
export const TypesScrollAreaAdditional = (_props: Record<string, unknown>) => null;
