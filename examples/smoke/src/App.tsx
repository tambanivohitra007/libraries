import { App as AntApp } from 'antd';
import frFR from 'antd/locale/fr_FR';
import {
  AccentProvider,
  CommandsProvider,
  DataTable,
  DataTableConfigProvider,
  DesktopHostProvider,
  EmptyState,
  useAccent,
  type DataColumn,
  type DesktopHost,
  type TablePrintProps,
} from '@rindra/desktop';
import '@rindra/desktop/styles.css';

/** A row type the library knows nothing about — the grid is generic over it. */
interface Eleve {
  id: number;
  nom: string;
  classe: string;
  solde: number;
}

const rows: Eleve[] = [
  { id: 1, nom: 'Rakoto', classe: '6e A', solde: 120_000 },
  { id: 2, nom: 'Rasoa', classe: '6e A', solde: 0 },
];

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe' },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    exportValue: (r) => r.solde,
    footer: (rs) => rs.reduce((n, r) => n + r.solde, 0).toLocaleString('fr-FR'),
    aggregate: (leaves) => leaves.reduce((n, r) => n + r.solde, 0),
  },
];

/** An Electron app wires these to its preload bridge; a web build omits them
 *  and the grid falls back to a browser download. */
const electronHost: DesktopHost = {
  saveDocument: (name, content) => window.api.enregistrerDocument(name, content),
  revealFile: (p) => window.api.montrerFichier(p),
  openFile: (p) => window.api.ouvrirFichier(p),
  setChromePrefs: (prefs) => void window.api.setChromePrefs(prefs),
};

/** Printing stays an app concern; the grid just hands over flattened rows. */
function PrintPreview({ open, data }: TablePrintProps): React.JSX.Element | null {
  if (!open || !data) return null;
  return <div>{data.title}</div>;
}

function Screen(): React.JSX.Element {
  const { color, mode, setMode } = useAccent();
  return (
    <div style={{ borderColor: color }}>
      <button onClick={() => setMode(mode === 'clair' ? 'sombre' : 'clair')}>thème</button>
      <DataTable<Eleve>
        tableId="eleves"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        exportName="eleves"
        groupable
        resizable
        filterable
        searchable
        rowNumbers
        multiSort
        pinnable
        columnControls
        emptyState={{ title: 'Aucun élève', description: 'Ajoutez-en un pour commencer.' }}
        onActiveRowChange={(r) => console.log(r.nom)}
        onFilteredRowsChange={(rs) => console.log(rs.length)}
        rowContextItems={(r) => [{ key: 'open', label: `Ouvrir ${r.nom}` }]}
      />
      <EmptyState title="Rien ici" />
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <DesktopHostProvider host={electronHost}>
      <AccentProvider locale={frFR} defaultAccent="vert">
        <AntApp>
          <CommandsProvider>
            <DataTableConfigProvider config={{ defaultDensity: () => 'small', PrintPreview }}>
              <Screen />
            </DataTableConfigProvider>
          </CommandsProvider>
        </AntApp>
      </AccentProvider>
    </DesktopHostProvider>
  );
}
