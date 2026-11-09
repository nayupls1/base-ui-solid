import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesTooltip = createMultipleTypes(data);
export const TypesTooltipAdditional = (_props: Record<string, unknown>) => null;
