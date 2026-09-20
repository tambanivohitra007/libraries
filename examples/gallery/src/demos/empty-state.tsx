import { Button, Card, Space } from 'antd';
import { PlusOutlined, SearchOutlined, WifiOutlined } from '@ant-design/icons';
import { EmptyState } from '@rindra/desktop';

/** Three shapes of "nothing here", because they call for different words: no
 *  data yet, nothing matched, or something went wrong. Only the first one
 *  deserves a call to action. */
export default function EmptyStateDemo(): React.JSX.Element {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" title="Rien encore — proposez l’action">
        <EmptyState
          title="Aucun élève"
          description="Ajoutez le premier élève pour commencer l’année."
          action={
            <Button type="primary" icon={<PlusOutlined />}>
              Nouvel élève
            </Button>
          }
        />
      </Card>

      <Card size="small" title="Recherche sans résultat — pas de CTA">
        <EmptyState
          icon={<SearchOutlined />}
          title="Aucun résultat pour « rakoto »"
          description="Vérifiez l’orthographe ou élargissez les filtres."
        />
      </Card>

      <Card size="small" title="Erreur — l’action est une reprise">
        <EmptyState
          icon={<WifiOutlined />}
          title="Serveur injoignable"
          description="La liste n’a pas pu être chargée."
          action={<Button>Réessayer</Button>}
        />
      </Card>
    </Space>
  );
}
