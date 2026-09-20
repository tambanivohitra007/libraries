import { DataTable, DataTableConfigProvider, type DataColumn } from '@rindra/desktop';
import { PrintPreview } from '@rindra/desktop/print';
import '@rindra/desktop/print.css';
import { eleves, ariary, type Eleve } from '../data';

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 110 },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    width: 150,
    align: 'right',
    render: (v: number) => ariary(v),
    exportValue: (r) => r.solde,
    footer: (rows) => <strong>{ariary(rows.reduce((n, r) => n + r.solde, 0))}</strong>,
  },
];

/**
 * `exportName` turns on CSV export; providing `PrintPreview` turns on print.
 * With no `DesktopHostProvider` above — as in this browser-only gallery — the
 * export falls back to an anchor download instead of a native save dialog. That
 * fallback is the whole point of the host adapter.
 */
export default function TableExport(): React.JSX.Element {
  return (
    <DataTableConfigProvider config={{ PrintPreview }}>
      <DataTable<Eleve>
        tableId="demo-export"
        rowKey="id"
        columns={columns}
        dataSource={eleves}
        exportName="eleves"
        searchable
        pagination={{ pageSize: 6 }}
      />
    </DataTableConfigProvider>
  );
}
