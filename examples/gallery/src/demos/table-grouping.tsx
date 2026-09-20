import { Tag } from 'antd';
import { DataTable, type DataColumn } from '@rindra/desktop';
import { eleves, ariary, type Eleve } from '../data';

const total = (rows: readonly Eleve[]): number => rows.reduce((n, r) => n + r.solde, 0);

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 110 },
  { key: 'sexe', title: 'Sexe', dataIndex: 'sexe', width: 80 },
  {
    key: 'statut',
    title: 'Statut',
    dataIndex: 'statut',
    width: 130,
    render: (v: Eleve['statut']) => (
      <Tag color={v === 'Inscrit' ? 'green' : v === 'En attente' ? 'gold' : 'default'}>{v}</Tag>
    ),
    exportValue: (r) => r.statut,
  },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    width: 150,
    align: 'right',
    render: (v: number) => ariary(v),
    exportValue: (r) => r.solde,
    // Shown on a collapsed group's header row...
    aggregate: (leaves) => <strong>{ariary(total(leaves as Eleve[]))}</strong>,
    // ...and in the sticky totals row across everything that survived filtering.
    footer: (rows) => <strong>{ariary(total(rows))}</strong>,
  },
];

/** Drag a column header into the band above the grid to group by it; drag a
 *  second one in to nest. The group header's own cells come from `aggregate`. */
export default function TableGrouping(): React.JSX.Element {
  return (
    <DataTable<Eleve>
      tableId="demo-grouping"
      rowKey="id"
      columns={columns}
      dataSource={eleves}
      groupable
      searchable
      pagination={{ pageSize: 12 }}
    />
  );
}
