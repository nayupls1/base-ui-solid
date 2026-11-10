import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesFieldset = createMultipleTypes(data);
export const TypesFieldsetAdditional = (_props: Record<string, unknown>) => null;
