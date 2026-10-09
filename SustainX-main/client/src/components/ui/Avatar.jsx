import { initials } from '../../lib/format';

export default function Avatar({ name, size = 40, tone = 'green' }) {
  return (
    <span
      className={`avatar avatar-${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}