import data from './types.md?types';
import { createMultipleTypes, createTypes } from 'docs/src/utils/createTypes';

export const TypesAccordion = createMultipleTypes(data);
export const TypesAccordionAdditional = (_props: Record<string, unknown>) => null;
