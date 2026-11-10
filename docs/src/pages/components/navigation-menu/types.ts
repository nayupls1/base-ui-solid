import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesNavigationMenu = createMultipleTypes(data);
export const TypesNavigationMenuAdditional = (_props: Record<string, unknown>) => null;
