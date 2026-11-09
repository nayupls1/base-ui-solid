const DISABLE_SCROLLBAR_CLASS_NAME = 'base-ui-disable-scrollbar';
const STYLE_ATTRIBUTE = 'data-base-ui-style';

/**
 * Injects a deduplicated `<style>` element into the document head.
 * Mirrors React 19's hoisted `<style href precedence>` behavior used upstream.
 */
function injectStyle(id: string, css: string, nonce?: string) {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.head.querySelector(`style[${STYLE_ATTRIBUTE}="${id}"]`)) {
    return;
  }
  const style = document.createElement('style');
  style.setAttribute(STYLE_ATTRIBUTE, id);
  if (nonce) {
    style.nonce = nonce;
  }
  style.textContent = css;
  document.head.prepend(style);
}

export const styleDisableScrollbar = {
  className: DISABLE_SCROLLBAR_CLASS_NAME,
  inject(nonce?: string) {
    injectStyle(
      DISABLE_SCROLLBAR_CLASS_NAME,
      `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`,
      nonce,
    );
  },
};
