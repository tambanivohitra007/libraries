import { App as AntApp } from 'antd';
import __ANTD_LOCALE_NAME__ from '__ANTD_LOCALE_MODULE__';
import {
  AccentProvider,
  CommandsProvider,
  DataTableConfigProvider,
  DesktopHostProvider,
} from '@rindra/desktop';
import { PrintPreview } from '@rindra/desktop/print';
import { host } from './host';
import RecordsScreen from './screens/RecordsScreen';

/**
 * The provider stack, outermost first:
 *   DesktopHostProvider  native save / reveal / open, through the preload bridge
 *   AccentProvider       accent + display mode, into CSS variables and antd
 *   AntApp               antd's own — the grid raises notifications through it
 *   CommandsProvider     lets a toolbar invoke the active screen's handlers
 */
export function App(): React.JSX.Element {
  return (
    <DesktopHostProvider host={host}>
      <AccentProvider locale={__ANTD_LOCALE_NAME__} defaultAccent="__ACCENT__">
        <AntApp>
          <CommandsProvider>
            {/* Gives every grid its print action. Exports reach the native save
                dialog through the host adapter above. */}
            <DataTableConfigProvider config={{ PrintPreview }}>
              <RecordsScreen />
            </DataTableConfigProvider>
          </CommandsProvider>
        </AntApp>
      </AccentProvider>
    </DesktopHostProvider>
  );
}
