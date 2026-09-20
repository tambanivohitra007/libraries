import { useState } from 'react';
import { Card, Descriptions, Tag } from 'antd';
import { DataTable, EmptyState, type DataColumn } from '@rindra/desktop';
import { eleves, ariary, type Eleve } from '../data';

const columns: DataColumn<Eleve>[] = [
  { key: 'nom', title: 'Nom', dataIndex: 'nom' },
  { key: 'classe', title: 'Classe', dataIndex: 'classe', width: 100 },
];

/**
 * The grid keeps a cell cursor: arrow keys move it, and it stays put through
 * sorting and paging. `onActiveRowChange` follows that cursor, so a detail pane
 * tracks the keyboard as well as the mouse — click a row, then drive the list
 * with ↑/↓ without touching the mouse again.
 *
 * `rowClickSelects={false}` because here a click means "look at this", not
 * "tick it"; selection stays on the checkboxes.
 */
export default function TableMasterDetail(): React.JSX.Element {
  const [actif, setActif] = useState<Eleve | null>(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
      <DataTable<Eleve>
        tableId="demo-master-detail"
        rowKey="id"
        columns={columns}
        dataSource={eleves}
        rowClickSelects={false}
        onActiveRowChange={setActif}
        pagination={{ pageSize: 8 }}
      />
      <Card size="small" title="Détail">
        {actif ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Nom">{actif.nom}</Descriptions.Item>
            <Descriptions.Item label="Classe">{actif.classe}</Descriptions.Item>
            <Descriptions.Item label="Statut">
              <Tag color={actif.statut === 'Inscrit' ? 'green' : 'gold'}>{actif.statut}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Solde">{ariary(actif.solde)}</Descriptions.Item>
          </Descriptions>
        ) : (
          <EmptyState title="Aucune sélection" description="Choisissez une ligne à gauche." />
        )}
      </Card>
    </div>
  );
}
