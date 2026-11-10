import { createSignal } from 'solid-js';
import { Field } from 'base-ui-solidjs/field';
import { Form } from 'base-ui-solidjs/form';
import { Button } from 'base-ui-solidjs/button';
import styles from './index.module.css';

interface FormState {
  serverErrors?: Form.Props['errors'];
}

export default function ActionStateForm() {
  // Solid has no `useActionState`: track the pending state and the last result with signals.
  const [state, setState] = createSignal<FormState>({});
  const [loading, setLoading] = createSignal(false);

  const formAction = async (event: SubmitEvent) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    setLoading(true);
    setState(await submitForm(state(), formData));
    setLoading(false);
  };

  return (
    <Form errors={state().serverErrors} onSubmit={formAction} class={styles.Form}>
      <Field.Root name="username" class={styles.Field}>
        <Field.Label class={styles.Label}>Username</Field.Label>
        <Field.Control
          type="text"
          autocomplete="username"
          required
          defaultValue="admin"
          placeholder="e.g. alice132"
          class={styles.Input}
        />
        <Field.Error class={styles.Error} />
      </Field.Root>
      <Button type="submit" disabled={loading()} focusableWhenDisabled class={styles.Button}>
        Submit
      </Button>
    </Form>
  );
}

// This could be a server function in a framework like SolidStart
async function submitForm(_previousState: FormState, formData: FormData) {
  // Mimic a server response
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  try {
    const username = formData.get('username') as string | null;

    if (username === 'admin') {
      return { success: false, serverErrors: { username: "'admin' is reserved for system use" } };
    }

    // 50% chance the username is taken
    const success = Math.random() > 0.5;

    if (!success) {
      return {
        serverErrors: { username: `${username} is unavailable` },
      };
    }
  } catch {
    return { serverErrors: { username: 'A server error has occurred' } };
  }

  return {};
}
