// Keep CSS imports first to ensure CSS layer order is correct
import './css/index.css';
import './css/layout.css';
import { render } from '@solidjs/web';
import { App } from './App';

render(() => <App />, document.getElementById('root')!);
