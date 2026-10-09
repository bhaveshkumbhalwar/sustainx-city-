import { useState } from 'react';
import Icon from '../ui/Icon';
import SettingsPanel from './SettingsPanel';

export default function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`settings-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(true)}
        aria-label="Open settings"
        aria-haspopup="dialog"
      >
        <Icon name="settings" size={19} />
      </button>

      {isOpen && <SettingsPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
