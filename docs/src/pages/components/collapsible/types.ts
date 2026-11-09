import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesCollapsible = createMultipleTypes(data);
export const TypesCollapsibleAdditional = (_props: Record<string, unknown>) => null;
