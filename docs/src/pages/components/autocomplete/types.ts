import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesAutocomplete = createMultipleTypes(data);
export const TypesAutocompleteAdditional = (_props: Record<string, unknown>) => null;
