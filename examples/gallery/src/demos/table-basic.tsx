import { DataTable, type DataColumn } from '@rindra/desktop';
import { eleves, ariary, type Eleve } from '../data';

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 110 },
  { key: 'statut', title: 'Statut', dataIndex: 'statut', width: 130 },
  {
    key: 'solde',
    title: 'Solde',
    dataIndex: 'solde',
    width: 140,
    align: 'right',
    render: (v: number) => ariary(v),
    // Plain text for CSV, print, grouping and filtering. Without it those
    // features would see the rendered ReactNode instead of the number.
    exportValue: (r) => r.solde,
  },
];

export default function TableBasic(): React.JSX.Element {
  return (
    <DataTable<Eleve>
      tableId="demo-basic"
      rowKey="id"
      columns={columns}
      dataSource={eleves}
      rowNumbers
      searchable
      pagination={{ pageSize: 6 }}
    />
  );
}
