import { ReferenceTable } from '../components/ReferenceTable/ReferenceTable';
import type { ReferencePart } from '../components/ReferenceTable/types';

type TypesComponents = Record<string, (props: { hideDescription?: boolean }) => any>;

/**
 * Creates reference table components for every part described in a `types.md` file
 * (imported with the `?types` query). Use them in MDX as `<TypesAccordion.Root />`.
 */
export function createMultipleTypes(data: Record<string, ReferencePart>): TypesComponents {
  const types: TypesComponents = {};
  for (const [name, part] of Object.entries(data)) {
    types[name] = (props) => (
      <ReferenceTable data={part} multiple hideDescription={props.hideDescription} />
    );
  }
  return types;
}

/** Creates a reference table component for a single-part component. */
export function createTypes(data: Record<string, ReferencePart>) {
  const [first] = Object.values(data);
  return (props: { hideDescription?: boolean }) => (
    <ReferenceTable data={first} multiple={false} hideDescription={props.hideDescription} />
  );
}
