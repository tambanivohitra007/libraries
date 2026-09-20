import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

export type Density = 'small' | 'middle' | 'large';

/** Everything the grid hands a print renderer. Deliberately plain text: the grid
 *  has already flattened cells through `exportValue`, so a renderer needs no
 *  knowledge of the row type. Apps are free to accept a wider shape — this is a
 *  structural subset, so an existing `PrintPreview` usually fits unchanged. */
export interface TablePrintData {
  title: string;
  headers: string[];
  rows: string[][];
  /** Totals row aligned to `headers`, present only when a column has a `footer`. */
  totals?: string[];
}

export interface TablePrintProps {
  open: boolean;
  data: TablePrintData | null;
  onClose: () => void;
}

export interface DataTableConfig {
  /** Starting density for a grid with no saved preference. Defaults to `middle`. */
  defaultDensity: () => Density;
  /** Print-preview renderer. Printing is an app concern — it needs letterheads,
   *  logos, paper sizes — so the grid only raises the intent and hands over the
   *  flattened rows. Leave it out and the print action disappears. */
  PrintPreview?: ComponentType<TablePrintProps>;
}

const fallback: DataTableConfig = {
  defaultDensity: () => 'middle',
};

const ConfigContext = createContext<DataTableConfig | null>(null);

export function DataTableConfigProvider({
  config,
  children,
}: {
  config: Partial<DataTableConfig>;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <ConfigContext.Provider value={{ ...fallback, ...config }}>{children}</ConfigContext.Provider>
  );
}

/** Grid configuration, falling back to sane defaults so `<DataTable>` works with
 *  no provider at all. */
export function useDataTableConfig(): DataTableConfig {
  return useContext(ConfigContext) ?? fallback;
}
