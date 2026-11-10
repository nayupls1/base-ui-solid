import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesSelect = createMultipleTypes(data);
export const TypesSelectAdditional = (_props: Record<string, unknown>) => null;
