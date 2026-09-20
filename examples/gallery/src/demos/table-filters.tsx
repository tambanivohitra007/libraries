import { DataTable, type DataColumn } from '@rindra/desktop';
import { eleves, ariary, type Eleve } from '../data';

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 110 },
  { key: 'statut', title: 'Statut', dataIndex: 'statut', width: 140 },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    width: 150,
    align: 'right',
    render: (v: number) => ariary(v),
    exportValue: (r) => r.solde,
  },
];

/**
 * Three filtering surfaces, all on by default here:
 *  - the toolbar search box, across every text column at once;
 *  - a floating filter row under the headers (per column, always visible);
 *  - the filter builder in the toolbar, for and/or rules across columns.
 * Columns are resizable by dragging their borders, and both the widths and the
 * filter-row preference persist per `tableId`.
 */
export default function TableFilters(): React.JSX.Element {
  return (
    <DataTable<Eleve>
      tableId="demo-filters"
      rowKey="id"
      columns={columns}
      dataSource={eleves}
      filterable
      floatingFiltersDefault
      searchable
      resizable
      columnControls
      multiSort
      pagination={{ pageSize: 8 }}
    />
  );
}
