import { App as AntApp } from 'antd';
import __ANTD_LOCALE_NAME__ from '__ANTD_LOCALE_MODULE__';
import { AccentProvider, CommandsProvider } from '@rindra/desktop';
import RecordsScreen from './screens/RecordsScreen';

/**
 * The provider stack, outermost first:
 *   AccentProvider    accent + display mode, into CSS variables and antd's theme
 *   AntApp            antd's own — the grid raises notifications through it
 *   CommandsProvider  lets a toolbar invoke the active screen's handlers
 *
 * No DesktopHostProvider here: in a browser the library falls back to an anchor
 * download for CSV export, which is the right behaviour for this target.
 */
export function App(): React.JSX.Element {
  return (
    <AccentProvider locale={__ANTD_LOCALE_NAME__} defaultAccent="__ACCENT__">
      <AntApp>
        <CommandsProvider>
          <RecordsScreen />
        </CommandsProvider>
      </AntApp>
    </AccentProvider>
  );
}
