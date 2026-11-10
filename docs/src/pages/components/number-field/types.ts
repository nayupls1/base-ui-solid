import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesNumberField = createMultipleTypes(data);
export const TypesNumberFieldAdditional = (_props: Record<string, unknown>) => null;
