/**
 * Rewrites React-specific API documentation to its Solid counterpart.
 */
export function solidifyType(type) {
  return type
    .replace(/React\.CSSProperties/g, 'JSX.CSSProperties')
    .replace(
      /ReactElement \| \(\(props: HTMLProps, state: ([\w.<>]+)\) => ReactElement\)/g,
      'keyof JSX.IntrinsicElements | JSX.Element | ((props: HTMLProps, state: $1) => JSX.Element)',
    )
    .replace(
      /ReactElement \| \(\(props: ([\w.<>]+), state: ([\w.<>]+)\) => ReactElement\)/g,
      'keyof JSX.IntrinsicElements | JSX.Element | ((props: $1, state: $2) => JSX.Element)',
    )
    .replace(/React\.ReactNode/g, 'JSX.Element')
    .replace(/ReactNode/g, 'JSX.Element')
    .replace(/React\.ReactElement/g, 'JSX.Element')
    .replace(/ReactElement/g, 'JSX.Element')
    .replace(/React\.RefObject</g, 'RefObject<')
    .replace(/React\.Ref</g, 'Ref<')
    .replace(/React\.(\w+Event)(<[^>]*>)?/g, '$1')
    .replace(/React\.ComponentPropsWithRef<'(\w+)'>/g, "JSX.IntrinsicElements['$1']")
    .replace(/React\.ComponentProps<'(\w+)'>/g, "JSX.IntrinsicElements['$1']")
    .replace(/React\.HTMLAttributes/g, 'JSX.HTMLAttributes')
    .replace(/React\.JSX\./g, 'JSX.')
    .replace(/React\.Dispatch<React\.SetStateAction<([^>]+)>>/g, '(value: $1) => void')
    .replace(/React\.(\w+)/g, '$1');
}

export function solidifyText(text) {
  return text
    .replace(/@base-ui\/react/g, 'base-ui-solidjs')
    .replace(/\bReact element\b/g, 'JSX element')
    .replace(/\bReactElement\b/g, 'JSX.Element')
    .replace(/\bReact component\b/g, 'Solid component')
    .replace(/\bReact node\b/g, 'JSX node')
    .replace(/\bReact\.CSSProperties\b/g, 'JSX.CSSProperties')
    .replace(/\bReact Hooks?\b/g, (m) => m.replace('React', 'Solid'));
}

/**
 * Rewrites a prop name from its React spelling.
 */
export function solidifyPropName(name) {
  if (name === 'className') {
    return 'class';
  }
  return name;
}
