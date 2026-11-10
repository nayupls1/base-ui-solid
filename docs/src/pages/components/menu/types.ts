import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesMenu = createMultipleTypes(data);
export const TypesMenuAdditional = (_props: Record<string, unknown>) => null;
