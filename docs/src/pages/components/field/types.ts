import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesField = createMultipleTypes(data);
export const TypesFieldAdditional = (_props: Record<string, unknown>) => null;
