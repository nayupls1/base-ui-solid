import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesRadio = createMultipleTypes(data);
export const TypesRadioAdditional = (_props: Record<string, unknown>) => null;
