import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesMeter = createMultipleTypes(data);
export const TypesMeterAdditional = (_props: Record<string, unknown>) => null;
