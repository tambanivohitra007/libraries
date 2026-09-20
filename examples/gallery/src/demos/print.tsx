import { useState } from 'react';
import { Alert, Button, Space } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { DataTable, DataTableConfigProvider, type DataColumn } from '@rindra/desktop';
import { DocumentPreview, PrintPreview } from '@rindra/desktop/print';
import '@rindra/desktop/print.css';
import { eleves, ariary, type Eleve } from '../data';

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 110 },
  { key: 'statut', title: 'Statut', dataIndex: 'statut', width: 130 },
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
 * `PrintPreview` from the print entry has exactly the props the grid's
 * `DataTableConfigProvider` expects, so wiring the two together is one line.
 * Press the printer button in the grid's toolbar.
 *
 * The second button opens the same preview directly, which is what you do for
 * a document that did not come from a grid.
 */
export default function PrintDemo(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Ce que le navigateur ne peut pas faire"
        description={
          <>
            PDF, impression silencieuse et export XLSX passent par{' '}
            <code>PreviewDeps</code>, que seul un hôte Electron peut fournir — ici ces actions
            restent donc en retrait. Aperçu, marges, filigrane, bandes, DOCX, CSV, TSV et JSON
            fonctionnent entièrement dans la page.
          </>
        }
      />

      <DataTableConfigProvider config={{ PrintPreview }}>
        <DataTable<Eleve>
          tableId="demo-print"
          rowKey="id"
          columns={columns}
          dataSource={eleves}
          exportName="eleves"
          searchable
          pagination={{ pageSize: 6 }}
        />
      </DataTableConfigProvider>

      <Button icon={<PrinterOutlined />} onClick={() => setOpen(true)}>
        Ouvrir l’aperçu directement
      </Button>
      <DocumentPreview
        open={open}
        onClose={() => setOpen(false)}
        printedByName="Galerie"
        source={{
          kind: 'table',
          data: {
            title: 'Liste des élèves',
            headers: ['Nom', 'Classe', 'Statut', 'Solde'],
            rows: eleves.map((e) => [e.nom, e.classe, e.statut, String(e.solde)]),
            totals: ['Total', '', '', String(eleves.reduce((n, e) => n + e.solde, 0))],
          },
        }}
      />
    </Space>
  );
}
