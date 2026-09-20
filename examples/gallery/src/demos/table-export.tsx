import { Modal, Table } from 'antd';
import {
  DataTable,
  DataTableConfigProvider,
  type DataColumn,
  type TablePrintProps,
} from '@rindra/desktop';
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
 * Printing is an app concern — letterheads, paper sizes, logos — so the grid
 * only flattens its rows to text and hands them over. This stand-in renders
 * them plainly; a real app would lay out a document here.
 */
function PrintPreview({ open, data, onClose }: TablePrintProps): React.JSX.Element | null {
  if (!data) return null;
  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} width={720} title={data.title}>
      <Table
        size="small"
        pagination={false}
        dataSource={data.rows.map((cells, i) => ({ key: i, cells }))}
        columns={data.headers.map((h, i) => ({
          title: h,
          key: h,
          render: (_: unknown, r: { cells: string[] }) => r.cells[i],
        }))}
        summary={() =>
          data.totals ? (
            <Table.Summary.Row>
              {data.totals.map((tot, i) => (
                <Table.Summary.Cell key={i} index={i}>
                  <strong>{tot}</strong>
                </Table.Summary.Cell>
              ))}
            </Table.Summary.Row>
          ) : null
        }
      />
    </Modal>
  );
}

/**
 * `exportName` turns on CSV export; a configured `PrintPreview` turns on print.
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
