import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesProgress = createMultipleTypes(data);
export const TypesProgressAdditional = (_props: Record<string, unknown>) => null;
