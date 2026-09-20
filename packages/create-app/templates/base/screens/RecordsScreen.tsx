import { useState } from 'react';
import { Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DataTable, useScreenCommands, type DataColumn } from '@rindra/desktop';

/** Replace this with your own row type — everything below is generic over it. */
interface Record {
  id: number;
  label: string;
  category: string;
  status: 'active' | 'pending' | 'closed';
  amount: number;
}

const ROWS: Record[] = [
  { id: 1, label: 'Premier enregistrement', category: 'A', status: 'active', amount: 120_000 },
  { id: 2, label: 'Deuxième enregistrement', category: 'A', status: 'pending', amount: 45_000 },
  { id: 3, label: 'Troisième enregistrement', category: 'B', status: 'active', amount: 0 },
  { id: 4, label: 'Quatrième enregistrement', category: 'B', status: 'closed', amount: 300_000 },
];

const money = (n: number): string => n.toLocaleString('fr-FR');

const columns: DataColumn<Record>[] = [
  { key: 'label', title: 'Libellé', dataIndex: 'label' },
  { key: 'category', title: 'Catégorie', dataIndex: 'category', width: 120 },
  {
    key: 'status',
    title: 'Statut',
    dataIndex: 'status',
    width: 130,
    render: (v: Record['status']) => (
      <Tag color={v === 'active' ? 'green' : v === 'pending' ? 'gold' : 'default'}>{v}</Tag>
    ),
    // Whenever a column has a custom `render`, give it an `exportValue` too —
    // otherwise CSV, print, grouping and filtering see the ReactNode.
    exportValue: (r) => r.status,
  },
  {
    key: 'amount',
    title: 'Montant',
    dataIndex: 'amount',
    width: 150,
    align: 'right',
    render: (v: number) => money(v),
    exportValue: (r) => r.amount,
    footer: (rows) => <strong>{money(rows.reduce((n, r) => n + r.amount, 0))}</strong>,
  },
];

export default function RecordsScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const [rows] = useState<Record[]>(ROWS);

  // Registered handlers are what a toolbar dispatches by id; they unregister
  // when this screen unmounts, which is what greys the buttons out.
  useScreenCommands({
    'record:new': () => console.log('nouvel enregistrement'),
  });

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('app.records')}</h1>
        <Button type="primary" icon={<PlusOutlined />}>
          {t('app.newRecord')}
        </Button>
      </header>

      <DataTable<Record>
        tableId="records"
        rowKey="id"
        columns={columns}
        dataSource={rows}
        exportName="enregistrements"
        groupable
        resizable
        filterable
        searchable
        rowNumbers
        multiSort
        columnControls
        emptyState={{ title: t('app.empty'), description: t('app.emptyHint') }}
      />
    </div>
  );
}
