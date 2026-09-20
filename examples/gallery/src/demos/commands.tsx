import { useState } from 'react';
import { Button, Card, Space, Switch, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCommands, useScreenCommands } from '@rindra/desktop';

/** A toolbar that knows nothing about the screens below it: it dispatches
 *  command ids and greys out whatever no mounted screen handles. */
function Ruban(): React.JSX.Element {
  const { run, available } = useCommands();
  return (
    <Space>
      <Button
        icon={<PlusOutlined />}
        disabled={!available.has('eleve:new')}
        onClick={() => run('eleve:new')}
      >
        Nouveau
      </Button>
      <Button
        icon={<ReloadOutlined />}
        disabled={!available.has('eleve:refresh')}
        onClick={() => run('eleve:refresh')}
      >
        Actualiser
      </Button>
      <Button disabled={!available.has('facture:new')} onClick={() => run('facture:new')}>
        Nouvelle facture
      </Button>
    </Space>
  );
}

/** A screen registers its own handlers; they unregister when it unmounts, which
 *  is what drives the toolbar's disabled states. */
function EcranEleves({ onLog }: { onLog: (s: string) => void }): React.JSX.Element {
  useScreenCommands({
    'eleve:new': () => onLog('eleve:new — la modale du screen Élèves s’ouvre'),
    'eleve:refresh': () => onLog('eleve:refresh — rechargement'),
  });
  return <Tag color="green">Écran « Élèves » monté — il gère 2 commandes</Tag>;
}

export default function CommandsDemo(): React.JSX.Element {
  const [monte, setMonte] = useState(true);
  const [journal, setJournal] = useState<string[]>([]);
  const log = (s: string): void => setJournal((j) => [s, ...j].slice(0, 5));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Ruban />
      <Space>
        <Switch checked={monte} onChange={setMonte} />
        <span>Monter l’écran « Élèves »</span>
      </Space>
      {monte ? <EcranEleves onLog={log} /> : <Tag>Aucun écran monté</Tag>}
      <Card size="small" title="Commandes exécutées">
        {journal.length === 0 ? (
          <span style={{ color: 'var(--text-tertiary)' }}>
            Rien encore. « Nouvelle facture » reste grisé : aucun écran ne la gère.
          </span>
        ) : (
          journal.map((l, i) => <div key={i}>{l}</div>)
        )}
      </Card>
    </Space>
  );
}
