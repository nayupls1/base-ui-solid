import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesToast = createMultipleTypes(data);
export const TypesToastAdditional = (_props: Record<string, unknown>) => null;
